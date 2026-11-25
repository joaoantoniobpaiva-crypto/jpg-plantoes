// Núcleo compartilhado da área do hospital (portal.js) e do painel da JPG (admin.js).
// Sem Supabase configurado, tudo roda em MODO DEMONSTRAÇÃO: dados de exemplo guardados só neste navegador.
window.JPG = (()=>{
  const $=id=>document.getElementById(id);
  const cfg=window.JPG_CONFIG||{};
  const real=!!(cfg.SUPABASE_URL&&cfg.SUPABASE_ANON_KEY&&window.supabase);
  const brl=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const lerMoeda=s=>parseInt((s||'').replace(/\D/g,'')||'0',10)/100;
  const data=d=>d?new Date(d.length===10?d+'T12:00':d).toLocaleDateString('pt-BR'):'—';
  const comp=c=>c?c.slice(0,7).split('-').reverse().join('/'):'—';
  const tipoTxt=t=>t==='plantao'?'Plantões':'Honorários';
  const msg=(id,tipo,txt)=>{const m=$(id);if(!m)return;m.textContent=txt||'';m.className='msg'+(txt?' on '+tipo:'');};
  const el=(tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e;};
  const chip=s=>el('span','chip c-'+String(s).normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,'-'),s);
  const mascaraMoeda=i=>i.addEventListener('input',e=>{const v=lerMoeda(e.target.value);e.target.value=v?brl(v):'';});
  const mascaraCnpj=i=>i.addEventListener('input',e=>{let d=e.target.value.replace(/\D/g,'').slice(0,14);
    e.target.value=d.replace(/^(\d{2})(\d)/,'$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/,'$1.$2.$3').replace(/\.(\d{3})(\d)/,'.$1/$2').replace(/(\d{4})(\d)/,'$1-$2');});
  const mascaraTel=i=>i.addEventListener('input',e=>{let d=e.target.value.replace(/\D/g,'').slice(0,11);e.target.value=d.length>6?`(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`:d.length>2?`(${d.slice(0,2)}) ${d.slice(2)}`:d;});
  const cnpjOk=c=>{c=c.replace(/\D/g,'');if(c.length!==14||/^(\d)\1+$/.test(c))return false;
    const dv=n=>{let s=0,p=n-7;for(let i=0;i<n;i++){s+=+c[i]*p--;if(p<2)p=9;}const r=s%11;return r<2?0:11-r;};
    return dv(12)===+c[12]&&dv(13)===+c[13];};
  const uuid=()=>crypto.randomUUID?crypto.randomUUID():'x'+Date.now()+Math.random().toString(16).slice(2);
  const hoje=(dias=0)=>{const d=new Date();d.setDate(d.getDate()+dias);return d.toISOString().slice(0,10);};
  const mesAtual=()=>hoje().slice(0,7);

  // navegação por páginas dentro do painel (menu lateral)
  function paginas(onTroca){
    const ir=pg=>{document.querySelectorAll('.pg').forEach(p=>p.classList.toggle('oculto',p.id!=='pg-'+pg));
      document.querySelectorAll('.side-nav [data-pg]').forEach(b=>b.setAttribute('aria-current',b.dataset.pg===pg?'page':'false'));
      window.scrollTo(0,0);onTroca&&onTroca(pg);};
    document.querySelectorAll('[data-pg]').forEach(b=>b.addEventListener('click',()=>ir(b.dataset.pg)));
    return ir;
  }
  // gaveta de detalhes
  function gaveta(){
    const g=$('gaveta'),corpo=$('gaveta-corpo');
    const fechar=()=>{g.classList.remove('on');g.setAttribute('aria-hidden','true');};
    $('gaveta-x').onclick=fechar;g.addEventListener('click',e=>{if(e.target===g)fechar();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')fechar();});
    return {abrir:(...nos)=>{corpo.replaceChildren(...nos);g.classList.add('on');g.setAttribute('aria-hidden','false');$('gaveta-x').focus();},fechar};
  }

  // ===================== MODO DEMONSTRAÇÃO =====================
  const CHAVE='jpg-demo-v2';
  function semente(){
    const H1='demo-h1',H2='demo-h2',H3='demo-h3';
    const e=(id,h,tipo,c,v,pag,q,st,dias,arq)=>({id,hospital_id:h,tipo,competencia:c+'-01',valor_total:v,data_pagamento:pag,qtd_profissionais:q,observacoes:null,arquivos:[],nomes_arquivos:arq,status:st,criado_em:hoje(-dias)+'T10:00:00'});
    return {
      hospitais:[
        {id:H1,razao_social:'Hospital Santa Clara (exemplo)',cnpj:'11.222.333/0001-81',responsavel:'Marina Duarte',telefone:'(34) 99999-0001',email:'financeiro@santaclara.exemplo',status:'aprovado',criado_em:hoje(-60)},
        {id:H2,razao_social:'Clínica São Lucas (exemplo)',cnpj:'45.723.174/0001-10',responsavel:'Rafael Prado',telefone:'(34) 99999-0002',email:'adm@saolucas.exemplo',status:'pendente',criado_em:hoje(-1)},
        {id:H3,razao_social:'UPA Vila Nova (exemplo)',cnpj:'60.701.190/0001-04',responsavel:'Lúcia Ferreira',telefone:'(34) 99999-0003',email:'escala@upavilanova.exemplo',status:'aprovado',criado_em:hoje(-40)}],
      envios:[
        e('demo-e1',H1,'plantao','2026-09',48600,'2026-10-30',14,'concluído',55,['escala-setembro.pdf']),
        e('demo-e2',H1,'honorario','2026-10',21350,'2026-12-15',6,'proposta enviada',20,['relacao-convenios-out.xlsx']),
        e('demo-e3',H1,'plantao','2026-11',52900,'2026-12-20',16,'em análise',3,['escala-novembro.pdf','resumo-horas.xlsx']),
        e('demo-e4',H3,'plantao','2026-11',31200,'2026-12-28',9,'recebido',1,['escala-nov-upa.pdf'])],
      propostas:[
        {id:'demo-p1',envio_id:'demo-e1',hospital_id:H1,valor_face:48600,valor_liquido:46717,pagamento_em:hoje(-50),validade:hoje(-52),observacoes:null,status:'aceita',criado_em:hoje(-54),respondido_em:hoje(-53)},
        {id:'demo-p2',envio_id:'demo-e2',hospital_id:H1,valor_face:21350,valor_liquido:19840,pagamento_em:hoje(2),validade:hoje(5),observacoes:'PIX em até 24h após o aceite.',status:'aberta',criado_em:hoje(-2),respondido_em:null}],
      sessao:null
    };
  }
  const db={
    ler(){try{return JSON.parse(localStorage.getItem(CHAVE))||semente();}catch(_){return semente();}},
    gravar(d){try{localStorage.setItem(CHAVE,JSON.stringify(d));}catch(_){}},
    reset(){try{localStorage.removeItem(CHAVE);}catch(_){}}
  };
  const espera=()=>new Promise(r=>setTimeout(r,250));
  const juntar=(d,lista)=>lista.map(x=>({...x,hospitais:d.hospitais.find(h=>h.id===x.hospital_id)||null,envios:d.envios.find(e=>e.id===x.envio_id)||null}));
  const recentes=l=>l.slice().sort((a,b)=>String(b.criado_em).localeCompare(String(a.criado_em)));

  const demo={
    real:false,
    resetar(){db.reset();},
    async entrar(email,senha,papel){await espera();const d=db.ler();d.sessao=papel;db.gravar(d);return null;},
    async cadastrar(){await espera();return null;},
    async resetSenha(){await espera();},
    async novaSenha(){await espera();return null;},
    async sair(){const d=db.ler();d.sessao=null;db.gravar(d);},
    async sessao(papel){return db.ler().sessao===papel;},
    aoRecuperar(){},
    // hospital (o hospital de exemplo é o Santa Clara)
    async meuHospital(){return db.ler().hospitais[0];},
    async meusEnvios(){const d=db.ler();return recentes(d.envios.filter(e=>e.hospital_id===d.hospitais[0].id));},
    async minhasPropostas(){const d=db.ler();return recentes(juntar(d,d.propostas.filter(p=>p.hospital_id===d.hospitais[0].id)));},
    async enviar(dados,files){await espera();const d=db.ler();
      d.envios.push({id:uuid(),hospital_id:d.hospitais[0].id,...dados,arquivos:[],nomes_arquivos:files.map(f=>f.name),status:'recebido',criado_em:new Date().toISOString()});db.gravar(d);},
    async responderProposta(id,aceita){await espera();const d=db.ler();const p=d.propostas.find(x=>x.id===id);
      if(!p||p.status!=='aberta')throw new Error('indisponível');p.status=aceita?'aceita':'recusada';p.respondido_em=new Date().toISOString();db.gravar(d);},
    // JPG
    async souAdmin(){return true;},
    async hospitais(){return recentes(db.ler().hospitais);},
    async statusHospital(id,st){const d=db.ler();d.hospitais.find(h=>h.id===id).status=st;db.gravar(d);},
    async todosEnvios(){const d=db.ler();return recentes(juntar(d,d.envios));},
    async statusEnvio(id,st){const d=db.ler();d.envios.find(e=>e.id===id).status=st;db.gravar(d);},
    async todasPropostas(){const d=db.ler();return recentes(juntar(d,d.propostas));},
    async criarProposta(p){await espera();const d=db.ler();
      d.propostas.push({id:uuid(),...p,status:'aberta',criado_em:new Date().toISOString(),respondido_em:null});
      const e=d.envios.find(x=>x.id===p.envio_id);if(e)e.status='proposta enviada';db.gravar(d);},
    async linkArquivo(){return null;}
  };

  // ===================== MODO REAL (Supabase) =====================
  function criarReal(){
    const sb=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'}});
    const ok=({data,error})=>{if(error)throw error;return data;};
    const uid=async()=>{const {data:{user}}=await sb.auth.getUser();return user&&user.id;};
    const volta=location.origin+location.pathname;
    return {
      real:true,
      async entrar(email,senha){const {error}=await sb.auth.signInWithPassword({email,password:senha});return error;},
      async cadastrar(c){const {error}=await sb.auth.signUp({email:c.email,password:c.senha,options:{emailRedirectTo:volta,data:{razao_social:c.razao,cnpj:c.cnpj,responsavel:c.resp,telefone:c.tel}}});return error;},
      async resetSenha(email){await sb.auth.resetPasswordForEmail(email,{redirectTo:volta});},
      async novaSenha(s){const {error}=await sb.auth.updateUser({password:s});return error;},
      async sair(){await sb.auth.signOut();},
      async sessao(){const {data:{session}}=await sb.auth.getSession();return !!session&&!/type=recovery/.test(location.hash+location.search);},
      aoRecuperar(cb){sb.auth.onAuthStateChange(ev=>{if(ev==='PASSWORD_RECOVERY')cb();});},
      async meuHospital(){const id=await uid();if(!id)return null;
        const {data}=await sb.from('hospitais').select('id,razao_social,cnpj,responsavel,telefone,email,status,criado_em').eq('id',id).maybeSingle();return data;},
      async meusEnvios(){return ok(await sb.from('envios').select('id,tipo,competencia,valor_total,data_pagamento,qtd_profissionais,observacoes,nomes_arquivos,status,criado_em').order('criado_em',{ascending:false}).limit(200));},
      async minhasPropostas(){return ok(await sb.from('propostas').select('*,envios(tipo,competencia)').order('criado_em',{ascending:false}).limit(200));},
      async enviar(dados,files){
        const id=uuid(),hosp=await uid(),paths=[];
        for(const f of files){const x=f.name.split('.').pop().toLowerCase(),p=`${hosp}/${id}/${uuid()}.${x}`;
          ok(await sb.storage.from('envios').upload(p,f,{contentType:f.type||undefined,upsert:false}));paths.push(p);}
        ok(await sb.from('envios').insert({id,hospital_id:hosp,...dados,arquivos:paths,nomes_arquivos:files.map(f=>f.name.slice(0,120))}));
      },
      async responderProposta(id,aceita){ok(await sb.rpc('responder_proposta',{p_id:id,p_aceita:aceita}));},
      async souAdmin(){const {data,error}=await sb.rpc('is_admin');return !error&&data===true;},
      async hospitais(){return ok(await sb.from('hospitais').select('*').order('criado_em',{ascending:false}));},
      async statusHospital(id,st){ok(await sb.from('hospitais').update({status:st}).eq('id',id));},
      async todosEnvios(){return ok(await sb.from('envios').select('*,hospitais(razao_social,cnpj)').order('criado_em',{ascending:false}).limit(500));},
      async statusEnvio(id,st){ok(await sb.from('envios').update({status:st}).eq('id',id));},
      async todasPropostas(){return ok(await sb.from('propostas').select('*,hospitais(razao_social),envios(tipo,competencia)').order('criado_em',{ascending:false}).limit(500));},
      async criarProposta(p){ok(await sb.from('propostas').insert(p));ok(await sb.from('envios').update({status:'proposta enviada'}).eq('id',p.envio_id));},
      async linkArquivo(path){const d=ok(await sb.storage.from('envios').createSignedUrl(path,60));return d.signedUrl;}
    };
  }

  return {$,el,chip,brl,lerMoeda,data,comp,tipoTxt,msg,mascaraMoeda,mascaraCnpj,mascaraTel,cnpjOk,hoje,mesAtual,paginas,gaveta,
    api:real?criarReal():demo};
})();
