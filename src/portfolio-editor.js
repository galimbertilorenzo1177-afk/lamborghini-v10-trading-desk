(function(){
  'use strict';

  var STORAGE_KEY='lv10_portfolio';
  var WATCH_KEY='lv10_watch';
  var KNOWN_NAMES={
    'AMPLITECH GROUP':'AMPG',
    'AMPLITECH':'AMPG',
    'DATADOG':'DDOG',
    'FLUENCE':'FLNC',
    'FLUENCE ENERGY':'FLNC',
    'COHERENT':'COHR',
    'MARVELL':'MRVL',
    'MARVELL TECHNOLOGY':'MRVL',
    'LUMENTUM':'LITE',
    'LUMENTUM HOLDINGS':'LITE'
  };

  function $(q,root){return (root||document).querySelector(q)}
  function cleanText(v){return String(v||'').trim()}
  function ticker(v){
    var raw=cleanText(v).toUpperCase().replace(/\.US$/,'');
    raw=KNOWN_NAMES[raw]||raw;
    raw=raw.replace(/[^A-Z0-9.]/g,'');
    return raw;
  }
  function number(v){return Number(String(v||'').replace(',','.'))||0}
  function load(key,fallback){try{var v=localStorage.getItem(key);return v?JSON.parse(v):fallback}catch(e){return fallback}}
  function save(key,value){localStorage.setItem(key,JSON.stringify(value))}
  function portfolioPage(){return (location.hash.replace('#','')||'home')==='portfolio'}

  function labelText(el){var label=el.closest&&el.closest('label');return label?String(label.textContent||'').toLowerCase():''}
  function fieldByLabel(root, words){
    var fields=Array.prototype.slice.call(root.querySelectorAll('input,textarea'));
    for(var i=0;i<fields.length;i++){
      var txt=labelText(fields[i]);
      for(var j=0;j<words.length;j++) if(txt.indexOf(words[j])>=0) return fields[i];
    }
    return null;
  }
  function valuesFromVisibleForm(root){
    var inputs=Array.prototype.slice.call(root.querySelectorAll('input'));
    var textareas=Array.prototype.slice.call(root.querySelectorAll('textarea'));
    var tickerEl=fieldByLabel(root,['ticker','simbolo'])||inputs[0];
    var nameEl=fieldByLabel(root,['nome']);
    var qtyEl=fieldByLabel(root,['quant']);
    var pmcEl=fieldByLabel(root,['pmc','prezzo medio']);
    var dateEl=fieldByLabel(root,['data']);
    var noteEl=fieldByLabel(root,['note','piano'])||textareas[0];
    return {
      t:tickerEl?tickerEl.value:'',
      name:nameEl?nameEl.value:'',
      qty:number(qtyEl?qtyEl.value:''),
      pmc:number(pmcEl?pmcEl.value:''),
      date:dateEl?dateEl.value:'',
      plan:noteEl?cleanText(noteEl.value):''
    };
  }
  function bestTickerFromForm(root,pos){
    var candidates=[pos.t,pos.name];
    Array.prototype.slice.call(root.querySelectorAll('input,textarea')).forEach(function(el){candidates.push(el.value)});
    for(var i=0;i<candidates.length;i++){
      var t=ticker(candidates[i]);
      if(t && /^[A-Z]/.test(t)) return t;
    }
    return '';
  }
  function addOrUpdatePosition(pos,root){
    var list=load(STORAGE_KEY,[]);
    var t=bestTickerFromForm(root,pos);
    if(!t){alert('Inserisci il ticker, esempio AMPG o COHR');return false}
    if(!pos.qty||pos.qty<=0){alert('Inserisci una quantità maggiore di zero');return false}
    if(!pos.pmc||pos.pmc<=0){alert('Inserisci un PMC maggiore di zero');return false}

    var existing=list.findIndex(function(p){return ticker(p.t)===t});
    var clean={t:t,name:cleanText(pos.name)||t,qty:Number(pos.qty),pmc:Number(pos.pmc),date:pos.date||'',plan:pos.plan||''};
    if(existing>=0){
      if(!confirm(t+' è già nel portafoglio. Vuoi aggiornare quantità e PMC?'))return false;
      list[existing]=Object.assign({},list[existing],clean);
    }else{
      list.push(clean);
    }
    save(STORAGE_KEY,list);

    var watch=load(WATCH_KEY,[]);
    if(!watch.some(function(w){return ticker(w.t)===t})){
      watch.push({t:t,name:clean.name||t,sector:'Manual portfolio',price:0,move:0,event:'manual portfolio add',note:'added from portfolio editor',source:'portfolio-local'});
      save(WATCH_KEY,watch);
    }
    return true;
  }

  function value(id,root){var el=$('#'+id,root)||document.getElementById(id);return el?el.value:''}

  function inject(){
    if(!portfolioPage())return;
    if($('#portfolio-add-card'))return;
    var page=$('.page');
    if(!page)return;

    var card=document.createElement('section');
    card.className='card';
    card.id='portfolio-add-card';
    card.innerHTML=
      '<div class="section-title"><h3>Aggiungi titolo al portafoglio</h3><button id="portfolioAddToggle" class="ghost" type="button">+ Aggiungi posizione</button></div>'+ 
      '<div id="portfolioAddForm" style="display:none">'+
        '<div class="grid">'+
          '<label>Ticker / simbolo<input id="portfolioAddTicker" autocomplete="off" autocapitalize="characters" placeholder="AMPG"></label>'+ 
          '<label>Nome titolo<input id="portfolioAddName" autocomplete="off" placeholder="Amplitech Group"></label>'+ 
          '<label>Quantità<input id="portfolioAddQty" type="number" step="1" placeholder="100"></label>'+ 
          '<label>PMC / Prezzo medio<input id="portfolioAddPmc" type="number" step="0.01" placeholder="5.28"></label>'+ 
          '<label>Data acquisto<input id="portfolioAddDate" type="date"></label>'+ 
        '</div>'+ 
        '<label>Note / piano<textarea id="portfolioAddPlan" placeholder="Es. posizione swing, stop mentale, target..."></textarea></label>'+ 
        '<button id="portfolioAddSave" type="button">Salva posizione</button> '+
        '<button id="portfolioAddCancel" class="ghost" type="button">Annulla</button>'+ 
      '</div>';

    page.insertBefore(card,page.firstChild);

    $('#portfolioAddToggle',card).onclick=function(){
      var form=$('#portfolioAddForm',card);
      form.style.display=form.style.display==='none'?'block':'none';
      var input=$('#portfolioAddTicker',card);
      if(form.style.display==='block'&&input)input.focus();
    };
    $('#portfolioAddCancel',card).onclick=function(){ $('#portfolioAddForm',card).style.display='none'; };
    $('#portfolioAddSave',card).onclick=function(ev){
      ev.preventDefault();
      ev.stopPropagation();
      var ok=addOrUpdatePosition({
        t:value('portfolioAddTicker',card),
        name:value('portfolioAddName',card),
        qty:number(value('portfolioAddQty',card)),
        pmc:number(value('portfolioAddPmc',card)),
        date:value('portfolioAddDate',card),
        plan:cleanText(value('portfolioAddPlan',card))
      },card);
      if(ok){ alert('Posizione salvata. Ricarico il Portfolio.'); location.hash='#portfolio'; location.reload(); }
    };
  }

  document.addEventListener('click',function(ev){
    if(!portfolioPage())return;
    var btn=ev.target&&ev.target.closest&&ev.target.closest('button');
    if(!btn)return;
    var text=String(btn.textContent||'').toLowerCase();
    if(text.indexOf('salva posizione')<0)return;
    var root=btn.closest('.card')||document;
    var pos=valuesFromVisibleForm(root);
    if(!pos.t && !pos.name)return;
    ev.preventDefault();
    ev.stopPropagation();
    if(ev.stopImmediatePropagation)ev.stopImmediatePropagation();
    var ok=addOrUpdatePosition(pos,root);
    if(ok){ alert('Posizione salvata. Ricarico il Portfolio.'); location.hash='#portfolio'; location.reload(); }
  },true);

  function schedule(){setTimeout(inject,150)}
  window.addEventListener('hashchange',schedule);
  window.addEventListener('load',schedule);
  new MutationObserver(function(){if(portfolioPage())inject()}).observe(document.documentElement,{childList:true,subtree:true});
})();
