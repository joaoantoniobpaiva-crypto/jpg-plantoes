// Área do hospital: entrada (login/cadastro/senha) + painel (resumo, novo envio, envios, propostas, cadastro).
(()=>{
  const {$,el,chip,brl,lerMoeda,data,comp,tipoTxt,msg,mascaraMoeda,mascaraCnpj,mascaraTel,cnpjOk,hoje,mesAtual,paginas,gaveta,api}=window.JPG;
  const telas=['v-login','v-cadastro','v-reset','v-nova'];
  const mostrar=id=>telas.forEach(v=>$(v).classList.toggle('oculto',v!==id));
  const ETAPAS=['recebido','em análise','proposta enviada','concluído'];
  const vencida=p=>p.status==='aberta'&&p.validade<hoje();
  const stProp=p=>vencida(p)?'expirada':p.status;
  let hosp=null,envios=[],props=[],filtro='todos';

  mascaraMoeda($('e-valor'));mascaraCnpj($('c-cnpj'));mascaraTel($('c-tel'));
  $('ir-cadastro').onclick=()=>mostrar('v-cadastro');
  $('ir-reset').onclick=()=>mostrar('v-reset');
  $('ir-login1').onclick=$('ir-login2').onclick=()=>mostrar('v-login');
  if(location.hash==='#cadastro')mostrar('v-cadastro');

  if(!api.real){
    document.querySelectorAll('.demo').forEach(d=>d.classList.remove('oculto'));
    $('l-email').value='financeiro@santaclara.exemplo';$('l-senha').value='demonstracao';
    $('demo-entrar').onclick=()=>$('v-login').requestSubmit();
    $('demo-reset').onclick=async()=>{api.resetar();await api.entrar('','','hospital');abrir();};
  }

  // ---------- entrada ----------
  let falhas=0,bloqAte=0;
  $('v-login').addEventListener('submit',async e=>{
    e.preventDefault();
    if(Date.now()<bloqAte)return msg('l-msg','erro','Muitas tentativas. Aguarde um minuto.');
    const email=$('l-email').value.trim(),senha=$('l-senha').value;
    if(!email||!senha)return msg('l-msg','erro','Preencha e-mail e senha.');
    msg('l-msg','info','Entrando...');
    const erro=await api.entrar(email,senha,'hospital');
    if(erro){falhas++;if(falhas>=5){bloqAte=Date.now()+60000;falhas=0;}return msg('l-msg','erro','E-mail ou senha incorretos, ou e-mail ainda não confirmado.');}
    if(api.real)$('l-senha').value='';
    msg('l-msg','','');abrir();
  });
  $('v-cadastro').addEventListener('submit',async e=>{
    e.preventDefault();
    const c={razao:$('c-razao').value.trim(),cnpj:$('c-cnpj').value.trim(),resp:$('c-resp').value.trim(),tel:$('c-tel').value.trim(),email:$('c-email').value.trim(),senha:$('c-senha').value};
    if(c.razao.length<3||c.resp.length<3)return msg('c-msg','erro','Preencha o nome do hospital e o responsável.');
    if(!cnpjOk(c.cnpj))return msg('c-msg','erro','CNPJ inválido. Confira os números.');
    if(!/^\S+@\S+\.\S+$/.test(c.email))return msg('c-msg','erro','Confira o e-mail.');
    if(c.senha.length<10)return msg('c-msg','erro','A senha precisa de pelo menos 10 caracteres.');
    msg('c-msg','info','Criando cadastro...');
    const erro=await api.cadastrar(c);
    if(erro)return msg('c-msg','erro','Não foi possível criar o cadastro. Confira os dados ou tente entrar.');
    $('c-senha').value='';
    msg('c-msg','ok',api.real?'Pronto! Enviamos um e-mail para confirmar. Depois disso, a JPG libera o acesso do hospital.':'Demonstração: no site real, o hospital confirma o e-mail e a JPG libera o acesso pelo painel dela.');
  });
  $('v-reset').addEventListener('submit',async e=>{
    e.preventDefault();await api.resetSenha($('r-email').value.trim());
    msg('r-msg','ok','Se o e-mail estiver cadastrado, o link chegará em instantes.');
  });
  $('v-nova').addEventListener('submit',async e=>{
    e.preventDefault();const s=$('n-senha').value;if(s.length<10)return msg('n-msg','erro','Mínimo de 10 caracteres.');
    const erro=await api.novaSenha(s);if(erro)return msg('n-msg','erro','Não foi possível salvar. Peça um novo link.');
    $('n-senha').value='';abrir();
  });
  api.aoRecuperar(()=>{$('tela-app').classList.add('oculto');$('tela-entrada').classList.remove('oculto');mostrar('v-nova');});
  $('sair').onclick=async()=>{await api.sair();hosp=null;$('tela-app').classList.add('oculto');$('tela-entrada').classList.remove('oculto');mostrar('v-login');};

  // ---------- painel ----------
  const g=gaveta();
  const ir=paginas(pg=>{if(pg==='envios')listaEnvios();if(pg==='propostas')listaProps();});

  async function abrir(){
    hosp=await api.meuHospital();
    if(!hosp){await api.sair();mostrar('v-login');return msg('l-msg','erro','Cadastro não encontrado.');}
    $('tela-entrada').classList.add('oculto');$('tela-app').classList.remove('oculto');
    const ok=hosp.status==='aprovado';
    $('h-nome').textContent=hosp.razao_social;
    const b=$('h-badge');b.textContent=ok?'Liberado':hosp.status==='bloqueado'?'Bloqueado':'Em análise';b.className='badge '+(ok?'apr':'pend');
    $('faixa-pend').classList.toggle('oculto',ok);
    $('v-envio').classList.toggle('oculto',!ok);
    $('novo-bloq').textContent=ok?'Informe só o necessário. Dados de pacientes (quando a guia tiver) vão apenas no arquivo anexado, nunca nos campos de texto.':'O envio fica disponível assim que a JPG liberar o cadastro do hospital.';
    $('r-ola').replaceChildren('Olá, ',el('em',null,hosp.razao_social.replace(/\s*\(exemplo\)/,'')));
    if(!api.real){$('e-comp').value=mesAtual();$('e-valor').value=brl(38400);$('e-data').value=hoje(30);$('e-qtd').value='9';}
    conta();await recarregar();ir('resumo');
  }
  async function recarregar(){
    try{[envios,props]=await Promise.all([api.meusEnvios(),api.minhasPropostas()]);}catch(_){envios=[];props=[];}
    resumo();
  }

  function linhaEnvio(e){
    const li=el('li'),bt=el('button','linha');bt.type='button';
    const a=el('div','l-a');a.append(el('b',null,`${tipoTxt(e.tipo)} · ${comp(e.competencia)}`),el('span',null,`Enviado em ${data(e.criado_em)}${e.qtd_profissionais?' · '+e.qtd_profissionais+' profissionais':''}`));
    const v=el('div','l-v');v.append(el('b',null,brl(e.valor_total)),el('span',null,'paga em '+data(e.data_pagamento)));
    bt.append(a,v,chip(e.status));bt.onclick=()=>detalheEnvio(e);li.append(bt);return li;
  }
  function vazio(txt){return el('p','vazio',txt);}

  function resumo(){
    const m=mesAtual(),doMes=envios.filter(e=>String(e.criado_em).slice(0,7)===m);
    $('k-mes').textContent=brl(doMes.reduce((s,e)=>s+Number(e.valor_total),0));
    $('k-mes-s').textContent=doMes.length?`${doMes.length} envio${doMes.length>1?'s':''} em ${comp(m+'-01')}`:'nenhum envio este mês';
    $('k-anal').textContent=envios.filter(e=>e.status==='recebido'||e.status==='em análise').length;
    const abertas=props.filter(p=>stProp(p)==='aberta');
    $('k-prop').textContent=abertas.length;
    $('k-prop-s').textContent=abertas.length?'total de '+brl(abertas.reduce((s,p)=>s+Number(p.valor_liquido),0)):'nenhuma para responder';
    const conc=envios.filter(e=>e.status==='concluído');
    $('k-conc').textContent=conc.length;$('k-conc-s').textContent=conc.length?brl(conc.reduce((s,e)=>s+Number(e.valor_total),0))+' antecipados':'—';
    const n=$('n-prop');n.textContent=abertas.length;n.classList.toggle('oculto',!abertas.length);
    const ul=$('r-envios');ul.replaceChildren(...envios.slice(0,4).map(linhaEnvio));if(!envios.length)ul.append(vazio('Nenhum envio ainda. Comece pelo botão "Novo envio".'));
    const rp=$('r-props');rp.replaceChildren(...abertas.slice(0,2).map(cartaoProp));if(!abertas.length)rp.append(vazio('Nenhuma proposta aberta no momento.'));
  }

  const FILTROS=[['todos','Todos'],['recebido','Recebidos'],['em análise','Em análise'],['proposta enviada','Com proposta'],['concluído','Concluídos'],['recusado','Recusados']];
  function listaEnvios(){
    const f=$('f-envios');f.replaceChildren(...FILTROS.map(([v,t])=>{const b=el('button',null,t);b.type='button';b.setAttribute('aria-pressed',String(v===filtro));
      const q=v==='todos'?envios.length:envios.filter(e=>e.status===v).length;b.append(el('i',null,q));b.onclick=()=>{filtro=v;listaEnvios();};return b;}));
    const l=filtro==='todos'?envios:envios.filter(e=>e.status===filtro);
    const ul=$('l-envios');ul.replaceChildren(...l.map(linhaEnvio));if(!l.length)ul.append(vazio('Nada por aqui.'));
  }

  function detalheEnvio(e){
    const h=el('div');h.append(el('span','eyebrow','Envio'),el('h2',null,`${tipoTxt(e.tipo)} · ${comp(e.competencia)}`));
    const dl=el('dl','dados');[['Valor total',brl(e.valor_total)],['Pagamento previsto',data(e.data_pagamento)],['Profissionais',e.qtd_profissionais||'—'],['Enviado em',data(e.criado_em)],['Observações',e.observacoes||'—']]
      .forEach(([k,v])=>dl.append(el('dt',null,k),el('dd',null,String(v))));
    const tl=el('ol','etapas');const atual=ETAPAS.indexOf(e.status);
    if(e.status==='recusado'){tl.append(el('li','feito','Recebido'),el('li','feito recusa','Recusado pela JPG'));}
    else ETAPAS.forEach((s,i)=>tl.append(el('li',i<=atual?'feito':'',s[0].toUpperCase()+s.slice(1))));
    const arq=el('div','arquivos');arq.append(el('h3',null,'Arquivos'));
    const nomes=e.nomes_arquivos||[];if(!nomes.length)arq.append(vazio('Sem arquivos.'));nomes.forEach(n=>arq.append(el('span','arq',n)));
    const p=props.find(x=>x.envio_id===e.id);const extra=[];
    if(p){const bt=el('button','btn btn-t','Ver proposta');bt.type='button';bt.onclick=()=>{g.fechar();ir('propostas');};extra.push(bt);}
    g.abrir(h,tl,dl,arq,...extra);
  }

  function cartaoProp(p){
    const st=stProp(p),c=el('article','prop'+(st==='aberta'?' aberta':''));
    const t=el('div','prop-t');t.append(el('span',null,p.envios?`${tipoTxt(p.envios.tipo)} · ${comp(p.envios.competencia)}`:'Proposta'),chip(st));
    const v=el('div','prop-v');v.append(el('small',null,'A JPG paga agora'),el('b',null,brl(p.valor_liquido)),el('span',null,`pelo envio de ${brl(p.valor_face)}`));
    const dl=el('dl','dados mini');[['PIX até',data(p.pagamento_em)],['Válida até',data(p.validade)]].forEach(([k,x])=>dl.append(el('dt',null,k),el('dd',null,x)));
    c.append(t,v,dl);if(p.observacoes)c.append(el('p','obs',p.observacoes));
    if(st==='aberta'){
      const a=el('div','prop-acts'),sim=el('button','btn btn-t','Aceitar proposta'),nao=el('button','btn btn-o','Recusar');sim.type=nao.type='button';
      const m=el('p','msg');
      const resp=async ok=>{sim.disabled=nao.disabled=true;
        try{await api.responderProposta(p.id,ok);await recarregar();listaProps();}catch(_){m.textContent='Não foi possível responder. Atualize a página.';m.className='msg on erro';sim.disabled=nao.disabled=false;}};
      sim.onclick=()=>resp(true);nao.onclick=()=>{if(nao.dataset.conf){resp(false);}else{nao.dataset.conf='1';nao.textContent='Confirmar recusa';}};
      a.append(sim,nao);c.append(a,m);
    }else if(p.respondido_em)c.append(el('p','obs',`${st==='aceita'?'Aceita':'Respondida'} em ${data(p.respondido_em)}`));
    return c;
  }
  function listaProps(){const l=$('l-props');l.replaceChildren(...props.map(cartaoProp));if(!props.length)l.append(vazio('Nenhuma proposta ainda. Elas aparecem aqui depois que a JPG analisa um envio.'));}

  function conta(){
    const dl=$('d-conta');dl.replaceChildren();
    [['Hospital / clínica',hosp.razao_social],['CNPJ',hosp.cnpj],['Responsável',hosp.responsavel],['Telefone',hosp.telefone||'—'],['E-mail',hosp.email||'—'],['Situação',hosp.status==='aprovado'?'Liberado':hosp.status],['Cadastrado em',data(hosp.criado_em)]]
      .forEach(([k,v])=>dl.append(el('dt',null,k),el('dd',null,v)));
  }
  $('conta-senha').onclick=async()=>{if(hosp&&hosp.email)await api.resetSenha(hosp.email);msg('conta-msg','ok','Enviamos um link para trocar a senha no e-mail do cadastro.');};

  // ---------- novo envio ----------
  const EXT=['pdf','xlsx','xls','csv','png','jpg','jpeg'],MAX=10*1024*1024;
  $('v-envio').addEventListener('submit',async e=>{
    e.preventDefault();
    if(!hosp||hosp.status!=='aprovado')return;
    const valor=lerMoeda($('e-valor').value),competencia=$('e-comp').value,pag=$('e-data').value,files=[...$('e-arq').files];
    if(!valor||!competencia||!pag)return msg('e-msg','erro','Preencha tipo, competência, valor e data de pagamento.');
    if(api.real&&!files.length)return msg('e-msg','erro','Anexe a escala ou a relação de honorários.');
    if(files.length>5)return msg('e-msg','erro','Envie até 5 arquivos por vez.');
    for(const f of files){const x=f.name.split('.').pop().toLowerCase();
      if(!EXT.includes(x))return msg('e-msg','erro','Formato não aceito: '+f.name);
      if(f.size>MAX)return msg('e-msg','erro','Arquivo acima de 10 MB: '+f.name);}
    const btn=$('e-ok');btn.disabled=true;msg('e-msg','info','Enviando...');
    try{
      const qtd=parseInt($('e-qtd').value.replace(/\D/g,'')||'0',10)||null;
      await api.enviar({tipo:$('e-tipo').value,competencia:competencia+'-01',valor_total:valor,data_pagamento:pag,qtd_profissionais:qtd,observacoes:$('e-obs').value.trim().slice(0,800)||null},files);
      $('v-envio').reset();msg('e-msg','ok','Recebemos! A JPG vai analisar e a proposta aparece em "Propostas".');await recarregar();
    }catch(_){msg('e-msg','erro','Não foi possível enviar. Tente de novo ou fale com a JPG.');}
    btn.disabled=false;
  });

  // ---------- sessão existente ----------
  api.sessao('hospital').then(s=>{if(s)abrir();else if(location.hash!=='#cadastro')mostrar('v-login');});
})();
