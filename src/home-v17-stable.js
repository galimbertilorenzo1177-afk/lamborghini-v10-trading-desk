(function(){
  'use strict';
  var PORT='lv10_portfolio', MARKET='lv10_market', OV='lv10_portfolio_price_overrides';
  var FALLBACK={COHR:376.99,DDOG:234.11,FCEL:17.33,INCY:102.38,NOW:112.45};
  var last='';
  function get(k,f){try{var v=localStorage.getItem(k);return v?JSON.parse(v):f}catch(e){return f}}
  function num(v){if(typeof v==='number')return isFinite(v)?v:0;var s=String(v||'').replace(/\s/g,'').replace(',','.');var x=Number(s.replace(/[^0-9.\-]/g,''));return isFinite(x)?x:0}
  function tick(v){return String(v||'').trim().toUpperCase().replace(/\.US$/,'').replace(/[^A-Z0-9.]/g,'')}
  function pct(v){return (v>0?'+':'')+(Number(v)||0).toFixed(2)+'%'}
  function cl(s){return s>=70?'good':s>=45?'warn':'bad'}
  function page(){return location.hash.replace('#','')||'home'}
  function quotes(){var m=get(MARKET,{quotes:[]}),ov=get(OV,{}),out={};(m.quotes||[]).forEach(function(q){var k=tick(q.ticker||q.t||q.symbol),p=num(q.price||q.close||q.last);if(k&&p>0)out[k]=p});Object.keys(FALLBACK).forEach(function(k){out[k]=num((ov[k]&&ov[k].price)||FALLBACK[k])});return out}
  function positions(){var q=quotes();return (get(PORT,[])||[]).map(function(p){var t=tick(p.t),pmc=num(p.pmc),qty=num(p.qty),live=q[t]||0;return {t:t,pmc:pmc,qty:qty,live:live,pl:live&&pmc?(live/pmc-1)*100:0}}).filter(function(r){return r.t&&r.pmc&&r.qty})}
  function macro(){var m=get(MARKET,{}),r=m.regime||{},s=50,b=num(r.breadth||r.score),l=num(r.leaders),w=num(r.weak),v=num(m.validQuotesCount||m.frontendValidQuotesCount);if(b)s+=(b-50)*.6;s+=Math.min(15,l*.15);s-=Math.min(20,w*.18);if(v>=300)s+=5;return Math.max(0,Math.min(100,Math.round(s)))}
  function verdict(r,ma){var s=50+Math.max(-25,Math.min(25,r.pl*.9));if(r.t==='FCEL')s-=24;if(r.t==='INCY')s+=14;if((r.t==='COHR'||r.t==='DDOG'||r.t==='NOW')&&ma<55)s-=8;s=Math.max(0,Math.min(100,Math.round(s)));var a='MANTIENI / MONITORA';if(s>=70)a='MANTIENI';else if(s<28)a='NESSUNA MEDIAZIONE';else if(s<38)a='RIDURRE SU RIMBALZI';else if(s<50)a='DIFENSIVA';if(r.t==='FCEL')a='NESSUNA MEDIAZIONE';if(r.t==='INCY'&&r.pl>=0)a='MANTIENI';return {score:s,action:a}}
  function html(rows,ma){var best=rows.slice().sort(function(a,b){return b.pl-a.pl})[0],worst=rows.slice().sort(function(a,b){return a.pl-b.pl})[0];var head=ma>=70?'Mercato costruttivo':ma>=45?'Mercato selettivo':'Mercato difensivo';var h='<section id="home-v17-stable" class="card hero"><div><div class="section-title"><h2>Cosa fare oggi</h2><span class="rating">V17</span></div><p><b>'+head+'</b> · Macro '+ma+'/100. Prima gestione rischio, poi nuove opportunità.</p>';rows.forEach(function(r){var v=verdict(r,ma),e=v.score>=70?'🟢':v.score>=45?'🟡':'🔴';h+='<div class="row"><b>'+e+' '+r.t+' '+pct(r.pl)+'</b><span class="pill '+cl(v.score)+'">'+v.action+'</span></div>'});if(best&&worst)h+='<p><b>Migliore:</b> '+best.t+' '+pct(best.pl)+' · <b>Più delicata:</b> '+worst.t+' '+pct(worst.pl)+'</p>';h+='<p><b>Regola V17:</b> niente mediazioni impulsive senza conferma macro, settore e catalyst.</p></div></section>';return h}
  function hideLegacy(){var cards=document.querySelectorAll('.page > .card');for(var i=0;i<cards.length;i++){var c=cards[i],txt=c.textContent||'';if(c.id==='home-v17-stable')continue;if(txt.indexOf('Operating desk con freshness')>=0||txt.indexOf('Regime breadth')>=0&&txt.indexOf('leverage forbidden')>=0){c.style.display='none'}}}
  function apply(force){if(page()!=='home')return;var pg=document.querySelector('.page');if(!pg)return;var rows=positions(),ma=macro();if(!rows.length)return;var key=ma+'|'+rows.map(function(r){return r.t+':'+r.pl.toFixed(2)}).join('|');if(!force&&key===last&&document.getElementById('home-v17-stable')){hideLegacy();return}last=key;var old=document.getElementById('home-v17-stable');if(old)old.outerHTML=html(rows,ma);else{var w=document.createElement('div');w.innerHTML=html(rows,ma);if(w.firstElementChild)pg.insertBefore(w.firstElementChild,pg.firstElementChild)}hideLegacy()}
  function start(){var i=0,t=setInterval(function(){i++;apply(i===1);if(i>=10)clearInterval(t)},700)}
  window.addEventListener('load',start);
  window.addEventListener('hashchange',function(){last='';setTimeout(start,300)});
  window.addEventListener('storage',function(){last='';setTimeout(function(){apply(true)},300)});
  setInterval(function(){apply(false)},2500);
})();
