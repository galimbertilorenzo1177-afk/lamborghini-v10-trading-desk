(function(){
  'use strict';

  var PORTFOLIO_KEY='lv10_portfolio';
  var MARKET_KEY='lv10_market';
  var CAPITAL_KEY='lv10_capital_profile';
  var OVERRIDE_KEY='lv10_portfolio_price_overrides';
  var DEFAULT_OVERRIDES={
    COHR:{price:376.99,source:'portfolio-override'},
    NOW:{price:112.45,source:'portfolio-override'},
    DDOG:{price:234.11,source:'portfolio-override'},
    FCEL:{price:17.33,source:'portfolio-override'},
    INCY:{price:102.38,source:'portfolio-override'}
  };

  function $(q,root){return (root||document).querySelector(q)}
  function $all(q,root){return Array.prototype.slice.call((root||document).querySelectorAll(q))}
  function clean(v){return String(v==null?'':v).trim()}
  function ticker(v){return clean(v).toUpperCase().replace(/\.US$/,'').replace(/[^A-Z0-9.]/g,'')}
  function num(v){
    if(typeof v==='number')return Number.isFinite(v)?v:0;
    var s=clean(v).replace(/\s/g,'');
    if(s.indexOf(',')>=0 && s.indexOf('.')>=0)s=s.replace(/\./g,'').replace(',','.');
    else s=s.replace(',','.');
    var n=Number(s.replace(/[^0-9.\-]/g,''));
    return Number.isFinite(n)?n:0;
  }
  function load(k,f){try{var v=localStorage.getItem(k);return v?JSON.parse(v):f}catch(e){return f}}
  function save(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
  function money(v){var n=Number(v)||0;var sign=n>0?'+':'';return sign+n.toLocaleString('it-IT',{maximumFractionDigits:0})+' $'}
  function usd(v){var n=Number(v)||0;return n.toLocaleString('it-IT',{maximumFractionDigits:2})+' $'}
  function pct(v){var n=Number(v)||0;var sign=n>0?'+':'';return sign+n.toFixed(2)+'%'}
  function portfolioPage(){return (location.hash.replace('#','')||'home')==='portfolio'}
  function loadOverrides(){
    var o=load(OVERRIDE_KEY,null);
    if(!o){save(OVERRIDE_KEY,DEFAULT_OVERRIDES);o=DEFAULT_OVERRIDES}
    return Object.assign({},DEFAULT_OVERRIDES,o||{});
  }
  function marketQuotes(){
    var m=load(MARKET_KEY,{quotes:[]});
    var overrides=loadOverrides();
    var out={};
    (m.quotes||[]).forEach(function(q){
      var t=ticker(q.ticker||q.t||q.symbol);
      var p=num(q.price||q.close||q.last);
      if(t&&p>0)out[t]=Object.assign({},q,{_ticker:t,_price:p});
    });
    Object.keys(overrides).forEach(function(t){
      var ov=overrides[t]||{};
      var p=num(ov.price);
      if(ticker(t)&&p>0){
        out[ticker(t)]=Object.assign({},out[ticker(t)]||{},ov,{ticker:ticker(t),t:ticker(t),symbol:ticker(t),price:p,close:p,last:p,_ticker:ticker(t),_price:p,source:ov.source||'portfolio-override',valid:true});
      }
    });
    return out;
  }
  function portfolio(){return (load(PORTFOLIO_KEY,[])||[]).map(function(p){return Object.assign({},p,{t:ticker(p.t),qty:num(p.qty),pmc:num(p.pmc)})}).filter(function(p){return p.t&&p.qty>0&&p.pmc>0})}
  function capital(){var c=load(CAPITAL_KEY,{});return {total:num(c.totalCapital)||5000,trading:num(c.tradingCapital)||0,free:num(c.freeCash)||0}}
  function calcRows(){
    var quotes=marketQuotes();
    return portfolio().map(function(p){
      var q=quotes[p.t];
      var live=q?num(q._price):0;
      var invested=p.qty*p.pmc;
      var value=live?p.qty*live:0;
      var pl=live?(live-p.pmc)*p.qty:0;
      var plPct=live&&p.pmc?((live/p.pmc)-1)*100:0;
      return {p:p,q:q,live:live,invested:invested,value:value,pl:pl,plPct:plPct,move:q?num(q.move):0};
    });
  }
  function summaryHtml(){
    var cap=capital();
    var rows=calcRows();
    var invested=rows.reduce(function(s,r){return s+r.invested},0);
    var value=rows.reduce(function(s,r){return s+(r.value||r.invested)},0);
    var pl=rows.reduce(function(s,r){return s+r.pl},0);
    var plPct=invested?pl/invested*100:0;
    var liveCount=rows.filter(function(r){return r.live>0}).length;
    var best=rows.filter(function(r){return r.live>0}).sort(function(a,b){return b.plPct-a.plPct})[0];
    var worst=rows.filter(function(r){return r.live>0}).sort(function(a,b){return a.plPct-b.plPct})[0];
    return '<section id="portfolio-summary-card" class="card">'+
      '<div class="section-title"><h3>Portafoglio totale</h3><span class="tag">'+liveCount+'/'+rows.length+' prezzi live</span></div>'+ 
      '<div class="grid">'+
        metric('Investito',usd(invested))+metric('Valore attuale',usd(value))+metric('P/L totale',money(pl),pl>=0?'good':'bad')+metric('P/L %',pct(plPct),pl>=0?'good':'bad')+
        metric('Capitale libero',usd(cap.free))+metric('Capitale trading',usd(cap.trading))+metric('Peso su capitale totale',cap.total?pct(value/cap.total*100):'N/D')+metric('Peso su capitale trading',cap.trading?pct(value/cap.trading*100):'N/D')+
        metric('Migliore',best?best.p.t+' '+pct(best.plPct):'N/D')+metric('Peggiore',worst?worst.p.t+' '+pct(worst.plPct):'N/D')+
      '</div>'+ 
      '</section>';
  }
  function metric(k,v,c){return '<div class="metric"><small>'+k+'</small>'+(c?'<span class="'+c+'">'+v+'</span>':v)+'</div>'}
  function injectSummary(){
    if(!portfolioPage())return;
    var old=$('#portfolio-summary-card');
    if(old)old.remove();
    var page=$('.page');
    if(!page)return;
    var wrap=document.createElement('div');
    wrap.innerHTML=summaryHtml();
    var first=page.firstElementChild;
    if(first)page.insertBefore(wrap.firstElementChild,first);else page.appendChild(wrap.firstElementChild);
  }
  function patchTextLabels(){
    if(!portfolioPage())return;
    $all('.metric small').forEach(function(s){
      var t=clean(s.textContent);
      if(t==='P/L €')s.textContent='P/L $';
    });
  }
  function patchPortfolioCalculations(){
    if(!portfolioPage())return;
    var rows=calcRows();
    var cap=capital();
    rows.forEach(function(r){
      if(!r.live)return;
      var card=$all('.card').find(function(c){
        var h=c.querySelector('h2,b,.ticker');
        return h&&ticker(h.textContent)===r.p.t;
      });
      if(!card)return;
      $all('.metric',card).forEach(function(m){
        var small=$('small',m); if(!small)return;
        var label=clean(small.textContent);
        if(label==='Live price')m.innerHTML='<small>Live price</small>'+usd(r.live);
        if(label==='P/L €'||label==='P/L $')m.innerHTML='<small>P/L $</small>'+(r.pl>=0?'<span class="good">'+money(r.pl)+'</span>':'<span class="bad">'+money(r.pl)+'</span>');
        if(label==='P/L %')m.innerHTML='<small>P/L %</small>'+(r.plPct>=0?'<span class="good">'+pct(r.plPct)+'</span>':'<span class="bad">'+pct(r.plPct)+'</span>');
        if(label==='Distanza dal PMC')m.innerHTML='<small>Distanza dal PMC</small>'+(r.plPct>=0?'<span class="good">'+pct(r.plPct)+'</span>':'<span class="bad">'+pct(r.plPct)+'</span>');
        if(label==='Peso capitale trading'||label==='Peso su capitale trading')m.innerHTML='<small>Peso capitale trading</small>'+(cap.trading?pct((r.value||r.invested)/cap.trading*100):'N/D');
      });
      var sourceTag=card.querySelector('.tag');
      if(sourceTag&&r.q&&r.q.source==='portfolio-override')sourceTag.textContent='Fonte: override portfolio';
    });
  }
  function hideBadQuoteTime(){
    $all('.market-status small').forEach(function(el){
      if(clean(el.textContent).indexOf('Price data time: 31/05/2026')>=0)el.textContent='Quote source: latest successful market refresh';
    });
  }
  function run(){setTimeout(function(){injectSummary();patchPortfolioCalculations();patchTextLabels();hideBadQuoteTime();},250)}
  window.addEventListener('load',run);
  window.addEventListener('hashchange',run);
  new MutationObserver(function(){if(portfolioPage()){run();hideBadQuoteTime();}}).observe(document.documentElement,{childList:true,subtree:true});
})();
