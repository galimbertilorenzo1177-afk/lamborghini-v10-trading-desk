(function(){
'use strict';
var P='lv10_portfolio',M='lv10_market',O='lv10_portfolio_price_overrides';
var D={COHR:376.99,NOW:112.45,DDOG:234.11,FCEL:17.33,INCY:102.38};
function g(k,f){try{var v=localStorage.getItem(k);return v?JSON.parse(v):f}catch(e){return f}}
function n(v){if(typeof v==='number')return isFinite(v)?v:0;var s=String(v||'').replace(/\s/g,'').replace(',','.');var x=Number(s.replace(/[^0-9.\-]/g,''));return isFinite(x)?x:0}
function t(v){return String(v||'').trim().toUpperCase().replace(/\.US$/,'').replace(/[^A-Z0-9.]/g,'')}
function pc(v){return (v>0?'+':'')+(Number(v)||0).toFixed(2)+'%'}
function cls(s){return s>=70?'good':s>=45?'warn':'bad'}
function page(){return (location.hash.replace('#','')||'home')}
function market(){return g(M,{quotes:[],sectorStrength:[],regime:{}})}
function qmap(){var m=market(),o=g(O,{}),out={};(m.quotes||[]).forEach(function(q){var k=t(q.ticker||q.t||q.symbol),p=n(q.price||q.close||q.last);if(k&&p>0)out[k]={price:p,sector:q.sector||q.group||'',move:n(q.changePercent||q.changePct||q.move)}});Object.keys(D).forEach(function(k){out[k]=Object.assign(out[k]||{sector:''},{price:n((o[k]&&o[k].price)||D[k]),override:true})});return out}
function sectorScores(){var m=market(),out={};(m.sectorStrength||[]).forEach(function(s){var name=String(s.sector||s.name||'').toLowerCase();var score=n(s.score)||Math.max(0,Math.min(100,50+n(s.avgMove)*8+n(s.leaders)*2-n(s.weak)*2));if(name)out[name]=score});return out}
function macro(){var m=market(),r=m.regime||{},s=50,b=n(r.breadth||r.score),l=n(r.leaders),w=n(r.weak),v=n(m.validQuotesCount||m.frontendValidQuotesCount);if(b)s+=(b-50)*.6;s+=Math.min(15,l*.15);s-=Math.min(20,w*.18);if(v>=300)s+=5;return Math.max(0,Math.min(100,Math.round(s)))}
function rows(){var q=qmap();return (g(P,[])||[]).map(function(p){var k=t(p.t),pmc=n(p.pmc),qty=n(p.qty),live=q[k]?n(q[k].price):0,pl=live&&pmc?(live/pmc-1)*100:0;return {t:k,pmc:pmc,qty:qty,live:live,pl:pl,sector:q[k]&&q[k].sector||'manual',override:q[k]&&q[k].override}}).filter(function(x){return x.t&&x.qty&&x.pmc})}
function sectorScore(r){var ss=sectorScores(),key=String(r.sector||'').toLowerCase();if(ss[key])return ss[key];if(r.t==='COHR')return ss.semiconductor_equipment||ss.semiconductors||55;if(r.t==='NOW'||r.t==='DDOG')return ss.software||55;if(r.t==='INCY')return ss.healthcare||55;if(r.t==='FCEL')return ss.energy_materials||ss.energy||45;return 50}
function catalyst(r){if(r.t==='FCEL')return {score:25,label:'speculativo'};if(r.t==='INCY')return {score:60,label:'difensivo/biotech'};if(r.t==='COHR')return {score:45,label:'serve conferma semiconduttori'};if(r.t==='DDOG'||r.t==='NOW')return {score:50,label:'software da confermare'};return {score:50,label:'nessun catalyst inserito'}}
function risk(r){var loss=Math.max(0,-r.pl),base=70-loss*.9;if(r.t==='FCEL')base-=25;if(r.t==='INCY')base+=8;return Math.max(0,Math.min(100,Math.round(base)))}
function score(r,ma){var sec=sectorScore(r),cat=catalyst(r).score,ri=risk(r),pos=50+Math.max(-25,Math.min(25,r.pl*.9));var total=Math.round(ma*.25+sec*.25+cat*.2+ri*.2+pos*.1);return Math.max(0,Math.min(100,total))}
function action(s,r){if(r.t==='FCEL')return 'NESSUNA MEDIAZIONE';if(s>=72)return 'MANTIENI / POSSIBILE LEADER';if(s>=58)return 'MANTIENI';if(s>=45)return 'MONITORA';if(s>=34)return 'DIFENSIVA';return 'RIDURRE SU FORZA'}
function card(){var ma=macro(),rs=rows();if(!rs.length)return '';var html='<section id="v175-intelligence" class="card"><div class="section-title"><h3>Intelligence Layer V17.5</h3><span class="tag">macro + settore + rischio</span></div><p>Score piu completo: non solo prezzo, ma contesto macro, settore, catalyst manuale e rischio posizione.</p>';rs.forEach(function(r){var s=score(r,ma),sec=sectorScore(r),cat=catalyst(r),ri=risk(r);html+='<article class="card mini"><div class="section-title"><h3>'+r.t+'</h3><span class="pill '+cls(s)+'">'+s+'/100</span></div><div class="grid">';html+='<div class="metric"><small>Macro</small>'+ma+'</div><div class="metric"><small>Settore</small>'+Math.round(sec)+'</div><div class="metric"><small>Catalyst</small>'+cat.score+'</div><div class="metric"><small>Rischio</small>'+ri+'</div></div>';html+='<p><b>'+action(s,r)+'</b> · '+cat.label+' · P/L '+pc(r.pl)+'</p></article>'});html+='</section>';return html}
function inject(){var p=page();if(p!=='home'&&p!=='portfolio')return;var old=document.querySelector('#v175-intelligence');if(old)return;var pg=document.querySelector('.page');if(!pg)return;var w=document.createElement('div');w.innerHTML=card();if(!w.firstElementChild)return;if(p==='home'){var after=document.querySelector('#v17-synth-agent');if(after&&after.parentNode)after.parentNode.insertBefore(w.firstElementChild,after.nextSibling);else pg.insertBefore(w.firstElementChild,pg.firstElementChild)}else{pg.appendChild(w.firstElementChild)}}
function run(){setTimeout(inject,700)}
window.addEventListener('load',run);window.addEventListener('hashchange',run);
})();
