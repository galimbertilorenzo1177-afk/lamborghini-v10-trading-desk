(function(){
  'use strict';
  var KEY='lv10_market';
  function get(k,f){try{var v=localStorage.getItem(k);return v?JSON.parse(v):f}catch(e){return f}}
  function dt(v){var d=v?new Date(v):null;return d&&!isNaN(d.getTime())?d:null}
  function esc(x){return String(x==null?'':x).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function marketTs(){var m=get(KEY,{}),r=m.refreshDiagnostics||{};return m.snapshotGeneratedAt||m.lastSuccessfulMarketFetchAt||r.snapshotGeneratedAt||r.lastSuccessfulMarketFetchAt||m.updatedAt||m.lastUpdated||m.timestamp||m.generatedAt||localStorage.getItem('lv10_last_successful_market_fetch_at')||''}
  function priceTs(){var m=get(KEY,{}),r=m.refreshDiagnostics||{};return m.lastMarketQuoteTime||r.lastMarketQuoteTime||m.lastPriceChangeAt||r.lastPriceChangeAt||localStorage.getItem('lv10_last_price_change_at')||''}
  function ageMin(){var d=dt(marketTs());return d?Math.max(0,Math.round((Date.now()-d.getTime())/60000)):9999}
  function isRadar(){return /radar/i.test(location.hash)||/Expanded Radar/i.test(document.body.innerText||'')}
  function card(html){var d=document.createElement('div');d.className='card v17-data-gate';d.style.borderColor='var(--yellow)';d.innerHTML=html;return d}
  function insertGate(){if(!isRadar())return;var old=document.getElementById('v17-data-quality-gate');if(old)old.remove();var age=ageMin(),fresh=age<=60,ts=marketTs(),pts=priceTs();var html='<div id="v17-data-quality-gate"><div class="section-title"><h3>Data Quality Gate</h3><span class="pill '+(fresh?'good':'bad')+'">'+(fresh?'RADAR OK':'RADAR BLOCCATO')+'</span></div>'+(fresh?'<p><b>Dati entro soglia:</b> il radar può essere usato per analisi swing, sempre con conferma broker.</p>':'<p><b>NO TRADE:</b> market.json oltre 60 minuti. I candidati del radar sono solo watchlist/analisi, non segnali operativi.</p>')+'<div class="grid"><div class="metric"><small>Market age</small>'+age+' min</div><div class="metric"><small>Last market update</small>'+esc(ts||'N/D')+'</div><div class="metric"><small>Price data time</small>'+esc(pts||'N/D')+'</div><div class="metric"><small>Regola</small>'+(fresh?'Conferma broker':'Blocca entry')+'</div></div><p><b>Controllo qualità:</b> se il prezzo del desk non coincide col broker, prevale sempre Directa/Investing. Il desk declassa automaticamente il radar a watchlist quando i dati sono vecchi.</p></div>';
    var page=document.querySelector('.page')||document.querySelector('#app')||document.body;
    var ms=document.querySelector('.market-status');
    if(ms&&ms.parentNode)ms.parentNode.insertBefore(card(html),ms.nextSibling);else page.insertBefore(card(html),page.firstChild);
  }
  function patchRadarCards(){if(!isRadar())return;var stale=ageMin()>60;var cards=[].slice.call(document.querySelectorAll('article.card,.card')).filter(function(c){return /Fonte:|Prezzo|Verdetto|Swing Watch|market scan|Micron|MU\b/i.test(c.innerText||'')&&!/v17-data-gate|Data Quality Gate/i.test(c.className+' '+c.innerText)});cards.forEach(function(c){if(c.querySelector('.v17-quality-note'))return;var txt=c.innerText||'',ticker=(txt.match(/\b[A-Z]{1,5}\b/)||[''])[0],price=(txt.match(/Prezzo\s*\n?\s*([0-9]+(?:[\.,][0-9]+)?)/i)||[])[1];var warn='';if(stale)warn='NO TRADE / Analysis only: dati market.json non freschi.';if(ticker==='MU'&&price&&Number(String(price).replace(',','.'))<80)warn+=' Verifica prezzo MU su broker: possibile scala/fonte non allineata.';if(!warn)return;var n=document.createElement('div');n.className='metric v17-quality-note';n.style.textAlign='left';n.style.marginTop='10px';n.innerHTML='<small>Quality Gate</small><b class="bad">'+esc(warn.split(':')[0])+'</b><br><span class="muted" style="font-size:13px;">'+esc(warn)+'</span>';c.appendChild(n);});
  }
  function run(){insertGate();patchRadarCards()}
  run();
  window.addEventListener('hashchange',function(){setTimeout(run,120)});
  window.addEventListener('load',function(){setTimeout(run,200)});
  setInterval(run,1500);
})();
