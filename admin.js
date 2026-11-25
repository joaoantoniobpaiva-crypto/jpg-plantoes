// Painel da JPG: resumo, hospitais (liberar/bloquear), envios (status, arquivos, proposta), propostas.
(()=>{
  const {$,el,chip,brl,lerMoeda,data,comp,tipoTxt,msg,mascaraMoeda,hoje,paginas,gaveta,api}=window.JPG;
  const telas=['v-login','v-reset','v-nova'];
  const mostrar=id=>telas.forEach(v=>$(v).classList.toggle('oculto',v!==id));
  const ST_ENV=['recebido','em análise','proposta enviada','concluído','recusado'];
  const vencida=p=>p.status==='aberta'&&p.validade<hoje();
  const stProp=p=>vencida(p)?'expirada':p.status;
  const nomeH=x=>(x.hospitais&&x.hospitais.razao_social)||'Hospital';
  let hosps=[],envios=[],props=[],fH='pendente',fE='todos',fP='todos';

  $('ir-reset').onclick=()=>mostrar('v-reset');
  $('ir-login').onclick=()=>mostrar('v-login');
  if(!api.real){
    document.querySelectorAll('.demo').forEach(d=>d.classList.remove('oculto'));
    $('l-email').value='socio@jpgmercantil.exemplo';$('l-senha').value='demonstracao';
    $('demo-entrar').onclick=()=>$('v-login').requestSubmit();
    $('demo-reset').onclick=async()=>{api.resetar();await api.entrar('','','admin');abrir();};
  }

  // ---------- entrada ----------
  let falhas=0,bloqAte=0;
  $('v-login').addEventListener('submit',async e=>{
    e.preventDefault();
    if(Date.now()<bloqAte)return msg('l-msg','erro','Muitas tentativas. Aguarde um minuto.');
    const email=$('l-email').value.trim(),senha=$('l-senha').value;
    if(!email||!senha)return msg('l-msg','erro','Preencha e-mail e senha.');
    msg('l-msg','info','Entrando...');
    const erro=await api.entrar(email,senha,'admin');
    if(erro){falhas++;if(falhas>=5){bloqAte=Date.now()+60000;falhas=0;}return msg('l-msg','erro','E-mail ou senha incorretos.');}
    if(api.real)$('l-senha').value='';
    abrir();
  });
  $('v-reset').addEventListener('submit',async e=>{e.preventDefault();await api.resetSenha($('r-email').value.trim());msg('r-msg','ok','Se o e-mail estiver cadastrado, o link chegará em instantes.');});
  $('v-nova').addEventListener('submit',async e=>{e.preventDefault();const s=$('n-senha').value;if(s.length<10)return msg('n-msg','erro','Mínimo de 10 caracteres.');
    const erro=await api.novaSenha(s);if(erro)return msg('n-msg','erro','Não foi possível salvar. Peça um novo link.');$('n-senha').value='';abrir();});
  api.aoRecuperar(()=>{$('tela-app').classList.add('oculto');$('tela-entrada').classList.remove('oculto');mostrar('v-nova');});
  $('sair').onclick=async()=>{await api.sair();$('tela-app').classList.add('oculto');$('tela-entrada').classList.remove('oculto');mostrar('v-login');};

  const g=gaveta();
  const ir=paginas(pg=>{if(pg==='hospitais')listaH();if(pg==='envios')listaE();if(pg==='propostas')listaP();});

  async function abrir(){
    if(!(await api.souAdmin())){await api.sair();mostrar('v-login');return msg('l-msg','erro','Acesso só para os sócios da JPG.');}
    msg('l-msg','','');
    $('tela-entrada').classList.add('oculto');$('tela-app').classList.remove('oculto');
    await recarregar();ir('resumo');
  }
  async function recarregar(){
    try{[hosps,envios,props]=await Promise.all([api.hospitais(),api.todosEnvios(),api.todasPropostas()]);}catch(_){hosps=[];envios=[];props=[];}
    resumo();
  }
  const vazio=t=>el('p','vazio',t);
  const conta=(id,n)=>{const c=$(id);c.textContent=n;c.classList.toggle('oculto',!n);};

  // ---------- resumo ----------
  function resumo(){
    const pend=hosps.filter(h=>h.status==='pendente'),novos=envios.filter(e=>e.status==='recebido'||e.status==='em análise');
    const abertas=props.filter(p=>stProp(p)==='aberta'),aceitas=props.filter(p=>p.status==='aceita');
    $('k-pend').textContent=pend.length;
    $('k-novos').textContent=novos.length;$('k-novos-s').textContent=novos.length?brl(novos.reduce((s,e)=>s+Number(e.valor_total),0))+' em escalas':'tudo em dia';
    $('k-prop').textContent=abertas.length;$('k-prop-s').textContent=abertas.length?brl(abertas.reduce((s,p)=>s+Number(p.valor_liquido),0))+' aguardando aceite':'nenhuma aguardando';
    $('k-ant').textContent=brl(aceitas.reduce((s,p)=>s+Number(p.valor_liquido),0));
    $('k-ant-s').textContent=aceitas.length?`${aceitas.length} proposta${aceitas.length>1?'s':''} · face ${brl(aceitas.reduce((s,p)=>s+Number(p.valor_face),0))}`:'—';
    conta('n-hosp',pend.length);conta('n-env',novos.length);
    const rh=$('r-hosp');rh.replaceChildren(...pend.slice(0,4).map(linhaH));if(!pend.length)rh.append(vazio('Nenhum cadastro esperando liberação.'));
    const re=$('r-env');re.replaceChildren(...novos.slice(0,4).map(linhaE));if(!novos.length)re.append(vazio('Nenhum envio esperando proposta.'));
  }

  function filtros(id,lista,atual,campo,opcoes,cb){
    $(id).replaceChildren(...opcoes.map(([v,t])=>{const b=el('button',null,t);b.type='button';b.setAttribute('aria-pressed',String(v===atual));
      b.append(el('i',null,v==='todos'?lista.length:lista.filter(x=>campo(x)===v).length));b.onclick=()=>cb(v);return b;}));
  }

  // ---------- hospitais ----------
  function linhaH(h){
    const li=el('li'),bt=el('button','linha');bt.type='button';
    const a=el('div','l-a');a.append(el('b',null,h.razao_social),el('span',null,`CNPJ ${h.cnpj} · ${h.responsavel}`));
    const v=el('div','l-v');v.append(el('span',null,'cadastro em'),el('b',null,data(h.criado_em)));
    bt.append(a,v,chip(h.status==='aprovado'?'liberado':h.status));bt.onclick=()=>detalheH(h);li.append(bt);return li;
  }
  function listaH(){
    filtros('f-hosp',hosps,fH,h=>h.status,[['pendente','Para liberar'],['aprovado','Liberados'],['bloqueado','Bloqueados'],['todos','Todos']],v=>{fH=v;listaH();});
    const l=fH==='todos'?hosps:hosps.filter(h=>h.status===fH);
    const ul=$('l-hosp');ul.replaceChildren(...l.map(linhaH));if(!l.length)ul.append(vazio('Nada por aqui.'));
  }
  function detalheH(h){
    const t=el('div');t.append(el('span','eyebrow','Hospital'),el('h2',null,h.razao_social));
    const dl=el('dl','dados');[['CNPJ',h.cnpj],['Responsável',h.responsavel],['Telefone',h.telefone||'—'],['E-mail',h.email||'—'],['Situação',h.status==='aprovado'?'Liberado':h.status],['Cadastro',data(h.criado_em)]]
      .forEach(([k,v])=>dl.append(el('dt',null,k),el('dd',null,v)));
    const meus=envios.filter(e=>e.hospital_id===h.id);
    const res=el('p','obs',meus.length?`${meus.length} envio${meus.length>1?'s':''} · ${brl(meus.reduce((s,e)=>s+Number(e.valor_total),0))} no total`:'Nenhum envio ainda.');
    const av=el('p','aviso','Antes de liberar: conferir o CNPJ (situação na Receita, processos pelo CNPJ no JusBrasil) e se o responsável é mesmo do hospital.');
    const m=el('p','msg'),acts=el('div','prop-acts');
    const muda=async st=>{acts.querySelectorAll('button').forEach(b=>b.disabled=true);
      try{await api.statusHospital(h.id,st);await recarregar();listaH();g.fechar();}catch(_){m.textContent='Não foi possível salvar.';m.className='msg on erro';acts.querySelectorAll('button').forEach(b=>b.disabled=false);}};
    const bt=(txt,cls,st)=>{const b=el('button','btn '+cls,txt);b.type='button';b.onclick=()=>muda(st);return b;};
    if(h.status!=='aprovado')acts.append(bt(h.status==='bloqueado'?'Reativar':'Liberar hospital','btn-t','aprovado'));
    if(h.status!=='bloqueado')acts.append(bt('Bloquear','btn-o','bloqueado'));
    g.abrir(t,dl,res,...(h.status==='pendente'?[av]:[]),acts,m);
  }

  // ---------- envios ----------
  function linhaE(e){
    const li=el('li'),bt=el('button','linha');bt.type='button';
    const a=el('div','l-a');a.append(el('b',null,nomeH(e)),el('span',null,`${tipoTxt(e.tipo)} · ${comp(e.competencia)} · enviado em ${data(e.criado_em)}`));
    const v=el('div','l-v');v.append(el('b',null,brl(e.valor_total)),el('span',null,'paga em '+data(e.data_pagamento)));
    bt.append(a,v,chip(e.status));bt.onclick=()=>detalheE(e);li.append(bt);return li;
  }
  function listaE(){
    filtros('f-env',envios,fE,e=>e.status,[['todos','Todos'],['recebido','Recebidos'],['em análise','Em análise'],['proposta enviada','Com proposta'],['concluído','Concluídos'],['recusado','Recusados']],v=>{fE=v;listaE();});
    const l=fE==='todos'?envios:envios.filter(e=>e.status===fE);
    const ul=$('l-env');ul.replaceChildren(...l.map(linhaE));if(!l.length)ul.append(vazio('Nada por aqui.'));
  }
  function detalheE(e){
    const t=el('div');t.append(el('span','eyebrow',nomeH(e)),el('h2',null,`${tipoTxt(e.tipo)} · ${comp(e.competencia)}`));
    const dias=Math.max(0,Math.round((new Date(e.data_pagamento+'T12:00')-new Date())/864e5));
    const dl=el('dl','dados');[['Valor total',brl(e.valor_total)],['Pagamento previsto',`${data(e.data_pagamento)} (${dias} dias)`],['Profissionais',e.qtd_profissionais||'—'],['Enviado em',data(e.criado_em)],['Observações',e.observacoes||'—']]
      .forEach(([k,v])=>dl.append(el('dt',null,k),el('dd',null,String(v))));
    // arquivos
    const arq=el('div','arquivos');arq.append(el('h3',null,'Arquivos'));const am=el('p','msg');
    const nomes=e.nomes_arquivos||[],paths=e.arquivos||[];
    if(!nomes.length)arq.append(vazio('Sem arquivos.'));
    nomes.forEach((n,i)=>{const b=el('button','arq baixar','⤓ '+n);b.type='button';
      b.onclick=async()=>{if(!api.real||!paths[i]){am.textContent='Demonstração: no site real, o arquivo baixa por um link privado que vale 60 segundos.';am.className='msg on info';return;}
        try{const u=await api.linkArquivo(paths[i]);if(u)window.open(u,'_blank','noopener');}catch(_){am.textContent='Não foi possível abrir o arquivo.';am.className='msg on erro';}};
      arq.append(b);});
    arq.append(am);
    // status
    const sb=el('div','campo');const lb=el('label','lbl','Situação do envio');lb.htmlFor='a-st';const sel=el('select');sel.id='a-st';
    ST_ENV.forEach(s=>{const o=el('option',null,s[0].toUpperCase()+s.slice(1));o.value=s;o.selected=s===e.status;sel.append(o);});
    const sm=el('p','msg');sel.onchange=async()=>{try{await api.statusEnvio(e.id,sel.value);e.status=sel.value;await recarregar();if(!$('pg-envios').classList.contains('oculto'))listaE();sm.textContent='Situação atualizada.';sm.className='msg on ok';}
      catch(_){sm.textContent='Não foi possível salvar.';sm.className='msg on erro';}};
    sb.append(lb,sel,sm);
    // proposta
    const ja=props.filter(p=>p.envio_id===e.id);
    const blocoP=el('div','arquivos');blocoP.append(el('h3',null,'Proposta'));
    ja.forEach(p=>{const c=el('p','obs');c.append(chip(stProp(p)),` ${brl(p.valor_liquido)} por ${brl(p.valor_face)} · válida até ${data(p.validade)}`);blocoP.append(c);});
    const temAberta=ja.some(p=>stProp(p)==='aberta'||p.status==='aceita');
    if(!temAberta&&e.status!=='recusado'&&e.status!=='concluído')blocoP.append(formProposta(e));
    else if(!ja.length)blocoP.append(vazio('Envio encerrado.'));
    g.abrir(t,dl,arq,sb,blocoP);
  }
  function formProposta(e){
    const f=el('form');f.noValidate=true;
    const campo=(id,txt,tipo,val)=>{const c=el('div','campo'),l=el('label','lbl',txt),i=el('input');l.htmlFor=id;i.id=id;i.type=tipo||'text';if(val)i.value=val;c.append(l,i);return [c,i];};
    const [c1,iv]=campo('p-liq','Valor que a JPG paga agora','text');iv.inputMode='numeric';mascaraMoeda(iv);
    const [c2,ip]=campo('p-pix','PIX até','date',hoje(1)),[c3,iva]=campo('p-val','Proposta válida até','date',hoje(3));
    const ob=el('div','campo'),ol=el('label','lbl','Observação para o hospital (opcional)'),ot=el('textarea');ol.htmlFor='p-obs';ot.id='p-obs';ot.maxLength=800;ob.append(ol,ot);
    const conta=el('p','aviso','Digite o valor para ver o deságio. Essa conta aparece só aqui, nunca para o hospital.');
    const dias=Math.max(1,Math.round((new Date(e.data_pagamento+'T12:00')-new Date())/864e5));
    iv.addEventListener('input',()=>{const v=lerMoeda(iv.value),face=Number(e.valor_total);if(!v||v>=face){conta.textContent='O valor precisa ser menor que '+brl(face)+'.';return;}
      const des=(face-v)/face,am=Math.pow(face/v,30/dias)-1;
      conta.textContent=`Deságio ${brl(face-v)} (${(des*100).toFixed(2).replace('.',',')}% da face) · equivale a ${(am*100).toFixed(2).replace('.',',')}% a.m. em ${dias} dias`;});
    const sug=Number(e.valor_total)/Math.pow(1.04,dias/30);iv.value=brl(Math.floor(sug));iv.dispatchEvent(new Event('input'));
    const b=el('button','btn btn-t','Enviar proposta ao hospital');b.type='submit';const m=el('p','msg');
    f.append(c1,conta,el('div','grid2'),ob,b,m);f.querySelector('.grid2').append(c2,c3);
    f.addEventListener('submit',async ev=>{ev.preventDefault();
      const v=lerMoeda(iv.value);
      if(!v||v>=Number(e.valor_total)){m.textContent='Confira o valor.';m.className='msg on erro';return;}
      if(!ip.value||!iva.value||iva.value<hoje()){m.textContent='Confira as datas (validade a partir de hoje).';m.className='msg on erro';return;}
      b.disabled=true;
      try{await api.criarProposta({envio_id:e.id,hospital_id:e.hospital_id,valor_face:Number(e.valor_total),valor_liquido:v,pagamento_em:ip.value,validade:iva.value,observacoes:ot.value.trim()||null});
        await recarregar();g.fechar();if(!$('pg-envios').classList.contains('oculto'))listaE();}
      catch(_){m.textContent='Não foi possível enviar a proposta.';m.className='msg on erro';b.disabled=false;}});
    return f;
  }

  // ---------- propostas ----------
  function listaP(){
    filtros('f-prop',props,fP,stProp,[['todos','Todas'],['aberta','Abertas'],['aceita','Aceitas'],['recusada','Recusadas'],['expirada','Expiradas']],v=>{fP=v;listaP();});
    const l=fP==='todos'?props:props.filter(p=>stProp(p)===fP);
    const ul=$('l-prop');ul.replaceChildren(...l.map(p=>{
      const li=el('li'),bt=el('button','linha');bt.type='button';
      const a=el('div','l-a');a.append(el('b',null,nomeH(p)),el('span',null,`${p.envios?tipoTxt(p.envios.tipo)+' · '+comp(p.envios.competencia)+' · ':''}enviada em ${data(p.criado_em)} · válida até ${data(p.validade)}`));
      const v=el('div','l-v');v.append(el('b',null,brl(p.valor_liquido)),el('span',null,'face '+brl(p.valor_face)));
      bt.append(a,v,chip(stProp(p)));bt.onclick=()=>{const e=envios.find(x=>x.id===p.envio_id);if(e)detalheE(e);};li.append(bt);return li;}));
    if(!l.length)ul.append(vazio('Nada por aqui.'));
  }

  api.sessao('admin').then(s=>{if(s)abrir();});
})();
