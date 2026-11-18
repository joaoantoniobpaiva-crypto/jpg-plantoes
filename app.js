(()=>{
  const WPP='5534991451135', TAXA=0.04;
  const brl=v=>v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const lerMoeda=s=>parseInt((s||'').replace(/\D/g,'')||'0',10)/100;
  const mascMoeda=el=>el.addEventListener('input',()=>{const v=lerMoeda(el.value);el.value=v?brl(v):'';});

  // nav
  const nav=document.getElementById('nav');
  const wpp=document.querySelector('.wpp'),hero=document.querySelector('.hero');
  const onScroll=()=>{nav.classList.toggle('solid',scrollY>40);wpp.classList.toggle('on',scrollY>hero.offsetHeight-200);};
  addEventListener('scroll',onScroll,{passive:true});onScroll();

  // reveal
  const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}}),{threshold:.12,rootMargin:'0px 0px -40px 0px'});
  document.querySelectorAll('.rv').forEach(el=>io.observe(el));

  // simulador: líquido = valor / (1+taxa)^(dias/30)
  const sv=document.getElementById('s-valor'), liq=document.getElementById('s-liq'), sub=document.getElementById('s-sub'), pill=document.getElementById('s-pill');
  let dias=30;
  const calc=()=>{const v=lerMoeda(sv.value);const l=v/Math.pow(1+TAXA,dias/30);liq.textContent=v>0?brl(l):'—';sub.textContent=v>0?`Em ${dias} dias, de ${brl(v)} do plantão`:'Digite um valor';pill.textContent=dias+' dias';};
  sv.addEventListener('input',()=>{const v=lerMoeda(sv.value);sv.value=v?brl(v):'';calc();});
  document.querySelectorAll('.dias button').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.dias button').forEach(x=>x.setAttribute('aria-pressed',x===b));dias=+b.dataset.d;calc();}));
  calc();
  document.getElementById('s-pedir').addEventListener('click',()=>{
    const v=lerMoeda(sv.value); if(v){document.getElementById('f-valor').value=brl(v);}
    const d=new Date();d.setDate(d.getDate()+dias);document.getElementById('f-data').value=d.toISOString().slice(0,10);
    setTimeout(()=>document.getElementById('f-nome').focus({preventScroll:true}),700);
  });

  // formulário
  const ufs='AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO'.split(' ');
  const uf=document.getElementById('f-uf');
  uf.innerHTML='<option value="">UF</option>'+ufs.map(u=>`<option${u==='MG'?' selected':''}>${u}</option>`).join('');
  const escolha={prof:'Médico(a)',tipo:'Plantão'};
  document.querySelectorAll('.seg').forEach(g=>g.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{
    g.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b));
    escolha[g.dataset.campo]=b.dataset.v;
    if(b.dataset.reg) document.getElementById('lbl-reg').textContent=b.dataset.reg;
    if(g.dataset.campo==='tipo'){const h=b.dataset.v==='Plantão';document.getElementById('lbl-pagador').textContent=h?'Hospital que paga o plantão':'Convênio que paga o honorário';document.getElementById('f-pagador').placeholder=h?'Ex.: Hospital Santa Clara':'Ex.: nome do convênio';}
  })));
  mascMoeda(document.getElementById('f-valor'));
  const cel=document.getElementById('f-cel');
  cel.addEventListener('input',()=>{let d=cel.value.replace(/\D/g,'').slice(0,11);cel.value=d.length>6?`(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`:d.length>2?`(${d.slice(0,2)}) ${d.slice(2)}`:d;});

  document.getElementById('pedido').addEventListener('submit',e=>{
    e.preventDefault();
    const f=e.target, nome=f.nome.value.trim();
    if(!nome){f.nome.focus();f.nome.style.borderColor='#9A2F2F';return;}
    const dt=f.data.value?f.data.value.split('-').reverse().join('/'):'';
    const reg=document.getElementById('lbl-reg').textContent;
    const linhas=['Olá, quero antecipar com a JPG.','',
      `Nome: ${nome}`,`Profissão: ${escolha.prof}`+(f.registro.value?` · ${reg} ${f.registro.value}`:'')+(f.uf.value?`/${f.uf.value}`:''),
      `Tipo: ${escolha.tipo}`, f.pagador.value&&`Quem paga: ${f.pagador.value}`, f.valor.value&&`Valor a receber: ${f.valor.value}`, dt&&`Pagamento previsto: ${dt}`, f.cel.value&&`Celular: ${f.cel.value}`].filter(Boolean);
    window.open(`https://wa.me/${WPP}?text=${encodeURIComponent(linhas.join('\n'))}`,'_blank','noopener');
  });
})();
