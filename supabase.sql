-- JPG Mercantil · área do hospital + painel da JPG.
-- Rodar UMA vez num projeto NOVO do Supabase: SQL Editor > New query > colar tudo > Run.
-- Princípio: tudo bloqueado por padrão (RLS). O hospital só vê o que é dele; só a JPG (tabela admins) vê tudo.

-- ===================== TABELAS =====================
create table if not exists public.admins (
  email text primary key check (email = lower(email))
);

create table if not exists public.hospitais (
  id uuid primary key references auth.users(id) on delete cascade,
  razao_social text not null check (char_length(razao_social) between 3 and 120),
  cnpj text not null check (cnpj ~ '^[0-9./-]{14,18}$'),
  responsavel text not null check (char_length(responsavel) between 3 and 100),
  telefone text check (telefone is null or char_length(telefone) <= 20),
  email text,
  status text not null default 'pendente' check (status in ('pendente','aprovado','bloqueado')),
  criado_em timestamptz not null default now()
);

create table if not exists public.envios (
  id uuid primary key,
  hospital_id uuid not null references public.hospitais(id) on delete cascade,
  tipo text not null check (tipo in ('plantao','honorario')),
  competencia date not null,
  valor_total numeric(14,2) not null check (valor_total > 0 and valor_total < 100000000),
  data_pagamento date not null,
  qtd_profissionais int check (qtd_profissionais is null or qtd_profissionais between 1 and 5000),
  observacoes text check (observacoes is null or char_length(observacoes) <= 800),
  arquivos text[] not null default '{}' check (cardinality(arquivos) <= 5),
  nomes_arquivos text[] not null default '{}' check (cardinality(nomes_arquivos) <= 5),
  status text not null default 'recebido' check (status in ('recebido','em análise','proposta enviada','concluído','recusado')),
  criado_em timestamptz not null default now()
);
create index if not exists envios_hospital_idx on public.envios(hospital_id, criado_em desc);

create table if not exists public.propostas (
  id uuid primary key default gen_random_uuid(),
  envio_id uuid not null references public.envios(id) on delete cascade,
  hospital_id uuid not null references public.hospitais(id) on delete cascade,
  valor_face numeric(14,2) not null check (valor_face > 0),
  valor_liquido numeric(14,2) not null check (valor_liquido > 0 and valor_liquido <= valor_face),
  pagamento_em date not null,
  validade date not null,
  observacoes text check (observacoes is null or char_length(observacoes) <= 800),
  status text not null default 'aberta' check (status in ('aberta','aceita','recusada','expirada')),
  criado_em timestamptz not null default now(),
  respondido_em timestamptz
);
create index if not exists propostas_hospital_idx on public.propostas(hospital_id, criado_em desc);

-- ===================== QUEM É DA JPG =====================
-- Admin = e-mail na tabela admins E e-mail confirmado. Funciona com security definer para não expor auth.users.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admins a join auth.users u on lower(u.email) = a.email
    where u.id = auth.uid() and u.email_confirmed_at is not null
  );
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ===================== RLS =====================
alter table public.admins    enable row level security;
alter table public.hospitais enable row level security;
alter table public.envios    enable row level security;
alter table public.propostas enable row level security;
alter table public.admins    force row level security;
alter table public.hospitais force row level security;
alter table public.envios    force row level security;
alter table public.propostas force row level security;

revoke all on public.admins, public.hospitais, public.envios, public.propostas from anon;
revoke all on public.admins from authenticated;
revoke insert, update, delete, truncate on public.hospitais from authenticated;
revoke update, delete, truncate on public.envios from authenticated;
revoke insert, update, delete, truncate on public.propostas from authenticated;
-- a JPG só muda o STATUS de hospitais e envios (a política abaixo exige ser admin)
grant select on public.hospitais, public.envios, public.propostas to authenticated;
grant update (status) on public.hospitais to authenticated;
grant update (status) on public.envios to authenticated;
grant insert on public.envios to authenticated;
grant insert (envio_id, hospital_id, valor_face, valor_liquido, pagamento_em, validade, observacoes) on public.propostas to authenticated;
grant update (status) on public.propostas to authenticated;

-- Hospitais: cada um lê a própria ficha; a JPG lê todas e muda o status.
drop policy if exists hosp_le_proprio on public.hospitais;
create policy hosp_le_proprio on public.hospitais for select to authenticated using (id = auth.uid() or public.is_admin());
drop policy if exists hosp_admin_status on public.hospitais;
create policy hosp_admin_status on public.hospitais for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Envios: hospital lê os seus e grava só se aprovado e em seu nome; a JPG lê todos e muda o status.
drop policy if exists env_le on public.envios;
create policy env_le on public.envios for select to authenticated using (hospital_id = auth.uid() or public.is_admin());
drop policy if exists env_insere on public.envios;
create policy env_insere on public.envios for insert to authenticated
  with check (
    hospital_id = auth.uid()
    and status = 'recebido'
    and exists (select 1 from public.hospitais h where h.id = auth.uid() and h.status = 'aprovado')
  );
drop policy if exists env_admin_status on public.envios;
create policy env_admin_status on public.envios for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Propostas: hospital lê as suas; só a JPG cria e muda. O hospital responde pela função responder_proposta.
drop policy if exists prop_le on public.propostas;
create policy prop_le on public.propostas for select to authenticated using (hospital_id = auth.uid() or public.is_admin());
drop policy if exists prop_admin_cria on public.propostas;
create policy prop_admin_cria on public.propostas for insert to authenticated
  with check (public.is_admin() and exists (select 1 from public.envios e where e.id = envio_id and e.hospital_id = propostas.hospital_id));
drop policy if exists prop_admin_muda on public.propostas;
create policy prop_admin_muda on public.propostas for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Hospital aceita ou recusa uma proposta ABERTA, dentro da validade, que seja dele.
create or replace function public.responder_proposta(p_id uuid, p_aceita boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.propostas p
     set status = case when p_aceita then 'aceita' else 'recusada' end,
         respondido_em = now()
   where p.id = p_id
     and p.hospital_id = auth.uid()
     and p.status = 'aberta'
     and p.validade >= current_date
     and exists (select 1 from public.hospitais h where h.id = auth.uid() and h.status = 'aprovado');
  if not found then raise exception 'proposta indisponível'; end if;
end $$;
revoke all on function public.responder_proposta(uuid, boolean) from public, anon;
grant execute on function public.responder_proposta(uuid, boolean) to authenticated;

-- ===================== CADASTRO =====================
-- Gatilho: cria a ficha "pendente" quando um HOSPITAL se cadastra pelo site (dados validados de novo no banco).
-- Usuários criados no painel do Supabase sem esses dados (os sócios) não viram hospital.
create or replace function public.novo_hospital() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.raw_user_meta_data->>'razao_social' is null then return new; end if;
  insert into public.hospitais (id, razao_social, cnpj, responsavel, telefone, email)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data->>'razao_social',''), 120),
    left(coalesce(new.raw_user_meta_data->>'cnpj',''), 18),
    left(coalesce(new.raw_user_meta_data->>'responsavel',''), 100),
    left(new.raw_user_meta_data->>'telefone', 20),
    lower(new.email)
  );
  return new;
exception when others then
  raise exception 'cadastro inválido';
end $$;
drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario after insert on auth.users for each row execute function public.novo_hospital();

-- ===================== ARQUIVOS =====================
-- Bucket PRIVADO, 10 MB, só formatos de documento. Pasta = id do hospital.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('envios','envios', false, 10485760,
  array['application/pdf','text/csv','application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','image/png','image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = 10485760;

drop policy if exists arq_insere on storage.objects;
create policy arq_insere on storage.objects for insert to authenticated
  with check (
    bucket_id = 'envios'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (select 1 from public.hospitais h where h.id = auth.uid() and h.status = 'aprovado')
  );
drop policy if exists arq_le on storage.objects;
create policy arq_le on storage.objects for select to authenticated
  using (bucket_id = 'envios' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- ===================== DEPOIS DE RODAR =====================
-- 1) Authentication > Providers > Email: deixar "Confirm email" LIGADO.
-- 2) Sócios da JPG: Authentication > Users > Add user (e-mail + senha, marcar "Auto Confirm"). Depois:
--      insert into public.admins (email) values ('socio1@exemplo.com'), ('socio2@exemplo.com');
-- 3) Authentication > URL Configuration: colocar o endereço do site (GitHub Pages) em Site URL e Redirect URLs.
-- 4) Settings > API: copiar Project URL e anon public key para o config.js. NUNCA a service_role.
-- Liberar hospitais, ver envios, baixar arquivos e mandar propostas: tudo pelo painel admin.html.
