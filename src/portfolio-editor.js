(function(){
  'use strict';

  var STORAGE_KEY='lv10_portfolio';
  var WATCH_KEY='lv10_watch';

  function $(q,root){return (root||document).querySelector(q)}
  function esc(x){return String(x==null?'':x).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function ticker(v){return String(v||'').toUpperCase().trim().replace(/\.US$/,'')}
  function number(v){return Number(String(v||'').replace(',','.'))||0}
  function load(key,fallback){try{var v=localStorage.getItem(key);return v?JSON.parse(v):fallback}catch(e){return fallback}}
  function save(key,value){localStorage.setItem(key,JSON.stringify(value))}

  function portfolioPage(){return (location.hash.replace('#','')||'home')==='portfolio'}

  function addOrUpdatePosition(pos){
    var list=load(STORAGE_KEY,[]);
    var t=ticker(pos.t);
    if(!t){alert('Inserisci un ticker valido');return false}
    if(!pos.qty||pos.qty<=0){alert('Inserisci una quantità maggiore di zero');return false}
    if(!pos.pmc||pos.pmc<=0){alert('Inserisci un PMC maggiore di zero');return false}

    var existing=list.findIndex(function(p){return ticker(p.t)===t});
    var clean={
      t:t,
      qty:Number(pos.qty),
      pmc:Number(pos.pmc),
      date:pos.date||'',
      plan:pos.plan||''
    };

    if(existing>=0){
      var ok=confirm(t+' è già nel portafoglio. Vuoi aggiornare quantità e PMC?');
      if(!ok)return false;
      list[existing]=Object.assign({},list[existing],clean);
    }else{
      list.push(clean);
    }
    save(STORAGE_KEY,list);

    var watch=load(WATCH_KEY,[]);
    if(!watch.some(function(w){return ticker(w.t)===t})){
      watch.push({t:t,name:t,sector:'Manual portfolio',price:0,move:0,event:'manual portfolio add',note:'added from portfolio editor',source:'portfolio-local'});
      save(WATCH_KEY,watch);
    }
    return true;
  }

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
          '<label>Ticker<input id="portfolioAddTicker" placeholder="AMPG"></label>'+
          '<label>Quantità<input id="portfolioAddQty" type="number" step="1" placeholder="100"></label>'+
          '<label>PMC / Prezzo medio<input id="portfolioAddPmc" type="number" step="0.01" placeholder="5.28"></label>'+
          '<label>Data acquisto<input id="portfolioAddDate" type="date"></label>'+
        '</div>'+
        '<label>Note / piano<textarea id="portfolioAddPlan" placeholder="Es. posizione swing, stop mentale, target..."></textarea></label>'+
        '<button id="portfolioAddSave" type="button">Salva posizione</button> '+
        '<button id="portfolioAddCancel" class="ghost" type="button">Annulla</button>'+
      '</div>';

    page.insertBefore(card,page.firstChild);

    $('#portfolioAddToggle').onclick=function(){
      var form=$('#portfolioAddForm');
      form.style.display=form.style.display==='none'?'block':'none';
      var input=$('#portfolioAddTicker');
      if(form.style.display==='block'&&input)input.focus();
    };
    $('#portfolioAddCancel').onclick=function(){
      $('#portfolioAddForm').style.display='none';
    };
    $('#portfolioAddSave').onclick=function(){
      var ok=addOrUpdatePosition({
        t:$('#portfolioAddTicker').value,
        qty:number($('#portfolioAddQty').value),
        pmc:number($('#portfolioAddPmc').value),
        date:$('#portfolioAddDate').value,
        plan:$('#portfolioAddPlan').value.trim()
      });
      if(ok){
        alert('Posizione salvata. Ricarico il Portfolio.');
        location.hash='#portfolio';
        location.reload();
      }
    };
  }

  function schedule(){setTimeout(inject,150)}
  window.addEventListener('hashchange',schedule);
  window.addEventListener('load',schedule);
  new MutationObserver(function(){if(portfolioPage())inject()}).observe(document.documentElement,{childList:true,subtree:true});
})();
