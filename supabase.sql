-- JPG Mercantil · área do hospital. Rodar uma vez no Supabase: SQL Editor > New query > Run.
-- Princípio: tudo bloqueado por padrão (RLS). O hospital só enxerga e grava o que é dele, e só depois de aprovado.

create table if not exists public.hospitais (
  id uuid primary key references auth.users(id) on delete cascade,
  razao_social text not null check (char_length(razao_social) between 3 and 120),
  cnpj text not null check (cnpj ~ '^[0-9./-]{14,18}$'),
  responsavel text not null check (char_length(responsavel) between 3 and 100),
  telefone text check (telefone is null or char_length(telefone) <= 20),
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
  status text not null default 'recebido' check (status in ('recebido','em análise','proposta enviada','concluído','recusado')),
  criado_em timestamptz not null default now()
);
create index if not exists envios_hospital_idx on public.envios(hospital_id, criado_em desc);

alter table public.hospitais enable row level security;
alter table public.envios   enable row level security;
alter table public.hospitais force row level security;
alter table public.envios   force row level security;

-- Hospital lê só a própria ficha. Não grava direto (a ficha nasce pelo gatilho; aprovação é só sua, no painel).
drop policy if exists hosp_le_proprio on public.hospitais;
create policy hosp_le_proprio on public.hospitais for select to authenticated using (id = auth.uid());

-- Envios: lê só os seus; grava só se aprovado e em seu nome; não edita nem apaga.
drop policy if exists env_le on public.envios;
create policy env_le on public.envios for select to authenticated using (hospital_id = auth.uid());
drop policy if exists env_insere on public.envios;
create policy env_insere on public.envios for insert to authenticated
  with check (
    hospital_id = auth.uid()
    and status = 'recebido'
    and exists (select 1 from public.hospitais h where h.id = auth.uid() and h.status = 'aprovado')
  );

revoke all on public.hospitais, public.envios from anon;
revoke update, delete, truncate on public.hospitais, public.envios from authenticated;
revoke insert on public.hospitais from authenticated;

-- Gatilho: cria a ficha "pendente" quando alguém se cadastra (dados validados de novo no banco).
create or replace function public.novo_hospital() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.hospitais (id, razao_social, cnpj, responsavel, telefone)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data->>'razao_social',''), 120),
    left(coalesce(new.raw_user_meta_data->>'cnpj',''), 18),
    left(coalesce(new.raw_user_meta_data->>'responsavel',''), 100),
    left(new.raw_user_meta_data->>'telefone', 20)
  );
  return new;
exception when others then
  -- dados inválidos: cadastro é recusado
  raise exception 'cadastro inválido';
end $$;
drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario after insert on auth.users for each row execute function public.novo_hospital();

-- Arquivos: bucket PRIVADO, 10 MB, só formatos de documento. Pasta = id do hospital.
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
  using (bucket_id = 'envios' and (storage.foldername(name))[1] = auth.uid()::text);

-- Para APROVAR um hospital (só você, no painel do Supabase):
--   update public.hospitais set status = 'aprovado' where cnpj = '00.000.000/0000-00';
-- Para ver os envios: Table Editor > envios. Arquivos: Storage > envios.
