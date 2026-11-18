(()=>{
  const $=id=>document.getElementById(id);
  const cfg=window.JPG_CONFIG||{};
  const views=['v-off','v-login','v-cadastro','v-reset','v-nova','v-painel'];
  const show=id=>views.forEach(v=>$(v).classList.toggle('oculto',v!==id));
  const msg=(id,tipo,txt)=>{const m=$(id);m.textContent=txt||'';m.className='msg'+(txt?' on '+tipo:'');};
  const brl=v=>Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const lerMoeda=s=>parseInt((s||'').replace(/\D/g,'')||'0',10)/100;

  if(!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY||!window.supabase){show('v-off');return;}
  const sb=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'}});

  // máscaras
  $('e-valor').addEventListener('input',e=>{const v=lerMoeda(e.target.value);e.target.value=v?brl(v):'';});
  $('c-cnpj').addEventListener('input',e=>{let d=e.target.value.replace(/\D/g,'').slice(0,14);
    e.target.value=d.replace(/^(\d{2})(\d)/,'$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/,'$1.$2.$3').replace(/\.(\d{3})(\d)/,'.$1/$2').replace(/(\d{4})(\d)/,'$1-$2');});
  $('c-tel').addEventListener('input',e=>{let d=e.target.value.replace(/\D/g,'').slice(0,11);e.target.value=d.length>6?`(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`:d.length>2?`(${d.slice(0,2)}) ${d.slice(2)}`:d;});
  const cnpjOk=c=>{c=c.replace(/\D/g,'');if(c.length!==14||/^(\d)\1+$/.test(c))return false;
    const dv=n=>{let s=0,p=n-7;for(let i=0;i<n;i++){s+=+c[i]*p--;if(p<2)p=9;}const r=s%11;return r<2?0:11-r;};
    return dv(12)===+c[12]&&dv(13)===+c[13];};

  // navegação entre telas
  $('ir-cadastro').onclick=()=>show('v-cadastro');
  $('ir-reset').onclick=()=>show('v-reset');
  $('ir-login1').onclick=$('ir-login2').onclick=()=>show('v-login');
  if(location.hash==='#cadastro')show('v-cadastro');

  // login (com freio simples de tentativas)
  let falhas=0,bloqAte=0;
  $('v-login').addEventListener('submit',async e=>{
    e.preventDefault();
    if(Date.now()<bloqAte)return msg('l-msg','erro','Muitas tentativas. Aguarde um minuto.');
    const email=$('l-email').value.trim(),senha=$('l-senha').value;
    if(!email||!senha)return msg('l-msg','erro','Preencha e-mail e senha.');
    msg('l-msg','info','Entrando...');
    const {error}=await sb.auth.signInWithPassword({email,password:senha});
    if(error){falhas++;if(falhas>=5){bloqAte=Date.now()+60000;falhas=0;}return msg('l-msg','erro','E-mail ou senha incorretos, ou e-mail ainda não confirmado.');}
    $('l-senha').value='';msg('l-msg','','');abrirPainel();
  });

  // cadastro: os dados vão como metadados; o banco cria a ficha "em análise" por gatilho
  $('v-cadastro').addEventListener('submit',async e=>{
    e.preventDefault();
    const razao=$('c-razao').value.trim(),cnpj=$('c-cnpj').value.trim(),resp=$('c-resp').value.trim(),tel=$('c-tel').value.trim(),email=$('c-email').value.trim(),senha=$('c-senha').value;
    if(razao.length<3||resp.length<3)return msg('c-msg','erro','Preencha o nome do hospital e o responsável.');
    if(!cnpjOk(cnpj))return msg('c-msg','erro','CNPJ inválido. Confira os números.');
    if(senha.length<10)return msg('c-msg','erro','A senha precisa de pelo menos 10 caracteres.');
    msg('c-msg','info','Criando cadastro...');
    const {error}=await sb.auth.signUp({email,password:senha,options:{emailRedirectTo:location.origin+location.pathname,data:{razao_social:razao,cnpj,responsavel:resp,telefone:tel}}});
    if(error)return msg('c-msg','erro','Não foi possível criar o cadastro. Confira os dados ou tente entrar.');
    $('c-senha').value='';
    msg('c-msg','ok','Pronto! Enviamos um e-mail para confirmar. Depois disso, a JPG libera o acesso do hospital.');
  });

  $('v-reset').addEventListener('submit',async e=>{
    e.preventDefault();
    await sb.auth.resetPasswordForEmail($('r-email').value.trim(),{redirectTo:location.origin+location.pathname});
    msg('r-msg','ok','Se o e-mail estiver cadastrado, o link chegará em instantes.'); // resposta igual, sem revelar quem tem conta
  });
  $('v-nova').addEventListener('submit',async e=>{
    e.preventDefault();
    const s=$('n-senha').value;if(s.length<10)return msg('n-msg','erro','Mínimo de 10 caracteres.');
    const {error}=await sb.auth.updateUser({password:s});
    if(error)return msg('n-msg','erro','Não foi possível salvar. Peça um novo link.');
    $('n-senha').value='';abrirPainel();
  });
  sb.auth.onAuthStateChange(ev=>{if(ev==='PASSWORD_RECOVERY')show('v-nova');});

  $('sair').onclick=async()=>{await sb.auth.signOut();$('hist-l').replaceChildren();show('v-login');};

  // painel
  let hosp=null;
  async function abrirPainel(){
    const {data:{user}}=await sb.auth.getUser();
    if(!user)return show('v-login');
    const {data,error}=await sb.from('hospitais').select('razao_social,status').eq('id',user.id).maybeSingle();
    if(error||!data){await sb.auth.signOut();show('v-login');return msg('l-msg','erro','Cadastro não encontrado.');}
    hosp={...data,id:user.id};
    const ok=data.status==='aprovado';
    $('p-nome').textContent=data.razao_social;
    const b=$('p-badge');b.textContent=ok?'Liberado':'Em análise';b.className='badge '+(ok?'apr':'pend');
    $('p-sub').textContent=ok?'Envie a escala ou a relação de honorários abaixo.':'A JPG está conferindo o cadastro. Assim que liberar, o envio fica disponível aqui.';
    $('v-envio').classList.toggle('oculto',!ok);
    show('v-painel');
    carregarHist();
  }
  async function carregarHist(){
    const {data}=await sb.from('envios').select('competencia,tipo,valor_total,status,criado_em').order('criado_em',{ascending:false}).limit(15);
    const ul=$('hist-l');ul.replaceChildren();
    $('hist').classList.toggle('oculto',!data||!data.length);
    (data||[]).forEach(r=>{
      const li=document.createElement('li'),a=document.createElement('span'),b=document.createElement('b');
      a.textContent=`${r.tipo==='plantao'?'Plantões':'Honorários'} · ${r.competencia.slice(0,7).split('-').reverse().join('/')} · ${brl(r.valor_total)}`;
      b.textContent=r.status;li.append(a,b);ul.append(li);
    });
  }

  const EXT=['pdf','xlsx','xls','csv','png','jpg','jpeg'], MAX=10*1024*1024;
  $('v-envio').addEventListener('submit',async e=>{
    e.preventDefault();
    if(!hosp||hosp.status!=='aprovado')return;
    const valor=lerMoeda($('e-valor').value),comp=$('e-comp').value,data=$('e-data').value,files=[...$('e-arq').files];
    if(!valor||!comp||!data)return msg('e-msg','erro','Preencha tipo, competência, valor e data de pagamento.');
    if(files.length>5)return msg('e-msg','erro','Envie até 5 arquivos por vez.');
    for(const f of files){const x=f.name.split('.').pop().toLowerCase();
      if(!EXT.includes(x))return msg('e-msg','erro','Formato não aceito: '+f.name);
      if(f.size>MAX)return msg('e-msg','erro','Arquivo acima de 10 MB: '+f.name);}
    const btn=$('e-ok');btn.disabled=true;msg('e-msg','info','Enviando...');
    const id=crypto.randomUUID(),paths=[];
    try{
      for(const f of files){
        const x=f.name.split('.').pop().toLowerCase(),p=`${hosp.id}/${id}/${crypto.randomUUID()}.${x}`;
        const {error}=await sb.storage.from('envios').upload(p,f,{contentType:f.type||undefined,upsert:false});
        if(error)throw error;paths.push(p);
      }
      const qtd=parseInt($('e-qtd').value.replace(/\D/g,'')||'0',10)||null;
      const {error}=await sb.from('envios').insert({id,hospital_id:hosp.id,tipo:$('e-tipo').value,competencia:comp+'-01',valor_total:valor,data_pagamento:data,qtd_profissionais:qtd,observacoes:$('e-obs').value.trim().slice(0,800)||null,arquivos:paths});
      if(error)throw error;
      $('v-envio').reset();msg('e-msg','ok','Recebemos! A JPG vai analisar e falar com você.');carregarHist();
    }catch(_){msg('e-msg','erro','Não foi possível enviar. Tente de novo ou fale com a JPG.');}
    btn.disabled=false;
  });

  // sessão existente
  sb.auth.getSession().then(({data:{session}})=>{if(session&&!/type=recovery/.test(location.hash+location.search))abrirPainel();else if(!session&&location.hash!=='#cadastro')show('v-login');});
})();
