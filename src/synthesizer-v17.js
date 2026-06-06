(function(){
'use strict';
var P='lv10_portfolio',M='lv10_market',O='lv10_portfolio_price_overrides';
var D={COHR:376.99,NOW:112.45,DDOG:234.11,FCEL:17.33,INCY:102.38};
var lastKey='';
function g(k,f){try{var v=localStorage.getItem(k);return v?JSON.parse(v):f}catch(e){return f}}
function n(v){if(typeof v==='number')return isFinite(v)?v:0;var s=String(v||'').replace(/\s/g,'').replace(',','.');var x=Number(s.replace(/[^0-9.\-]/g,''));return isFinite(x)?x:0}
function t(v){return String(v||'').trim().toUpperCase().replace(/\.US$/,'').replace(/[^A-Z0-9.]/g,'')}
function pc(v){return (v>0?'+':'')+(Number(v)||0).toFixed(2)+'%'}
function cls(s){return s>=70?'good':s>=45?'warn':'bad'}
function page(){return (location.hash.replace('#','')||'home')}
function cleanLegacy(){['v16-synth-agent','v16-macro-agent','v16-sector-agent','v16-position-doctor','v16-opportunity-agent','decision-agents-bundle','decision-agents-portfolio'].forEach(function(id){var all=document.querySelectorAll('#'+id);for(var i=0;i<all.length;i++)all[i].style.display='none'})}
function qmap(){var m=g(M,{quotes:[]}),o=g(O,{}),out={};(m.quotes||[]).forEach(function(q){var k=t(q.ticker||q.t||q.symbol),p=n(q.price||q.close||q.last);if(k&&p>0)out[k]=p});Object.keys(D).forEach(function(k){out[k]=n((o[k]&&o[k].price)||D[k])});return out}
function rows(){var q=qmap();return (g(P,[])||[]).map(function(p){var k=t(p.t),pmc=n(p.pmc),qty=n(p.qty),live=q[k]||0;return {t:k,pmc:pmc,qty:qty,live:live,pl:live&&pmc?(live/pmc-1)*100:0}}).filter(function(r){return r.t&&r.pmc&&r.qty})}
function macro(){var m=g(M,{}),r=m.regime||{},s=50,b=n(r.breadth||r.score),l=n(r.leaders),w=n(r.weak),v=n(m.validQuotesCount||m.frontendValidQuotesCount);if(b)s+=(b-50)*.6;s+=Math.min(15,l*.15);s-=Math.min(20,w*.18);if(v>=300)s+=5;return Math.max(0,Math.min(100,Math.round(s)))}
function verdict(r,ma){var s=50+Math.max(-25,Math.min(25,r.pl*.9));if(r.t==='FCEL')s-=24;if(r.t==='INCY')s+=14;if((r.t==='COHR'||r.t==='DDOG'||r.t==='NOW')&&ma<55)s-=8;s=Math.max(0,Math.min(100,Math.round(s)));var a='MANTIENI / MONITORA';if(s>=70)a='MANTIENI';else if(s<28)a='NESSUNA MEDIAZIONE';else if(s<38)a='RIDURRE SU RIMBALZI';else if(s<50)a='DIFENSIVA';if(r.t==='FCEL')a='NESSUNA MEDIAZIONE';if(r.t==='INCY'&&r.pl>=0)a='MANTIENI';return {s:s,a:a}}
function build(rs,ma){var best=rs.slice().sort(function(a,b){return b.pl-a.pl})[0],worst=rs.slice().sort(function(a,b){return a.pl-b.pl})[0];var head=ma>=70?'Mercato costruttivo':ma>=45?'Mercato selettivo':'Mercato difensivo';var html='<section id="v17-synth-agent" class="card hero"><div><div class="section-title"><h2>Cosa fare oggi</h2><span class="rating">V17</span></div><p><b>'+head+'</b> · Macro '+ma+'/100. Prima gestione rischio, poi nuove opportunità.</p>';rs.forEach(function(r){var v=verdict(r,ma),e=v.s>=70?'🟢':v.s>=45?'🟡':'🔴';html+='<div class="row"><b>'+e+' '+r.t+' '+pc(r.pl)+'</b><span class="pill '+cls(v.s)+'">'+v.a+'</span></div>'});html+='<p><b>Migliore:</b> '+best.t+' '+pc(best.pl)+' · <b>Più delicata:</b> '+worst.t+' '+pc(worst.pl)+'</p><p><b>Regola V17:</b> niente mediazioni impulsive senza conferma macro, settore e catalyst.</p></div></section>';return html}
function inject(force){cleanLegacy();if(page()!=='home')return;var pg=document.querySelector('.page');if(!pg)return;var ma=macro(),rs=rows();if(!rs.length)return;var key=ma+'|'+rs.map(function(x){return x.t+':'+x.pl.toFixed(2)}).join('|');if(!force&&key===lastKey&&document.querySelector('#v17-synth-agent'))return;lastKey=key;var old=document.querySelector('#v17-synth-agent');if(old){old.outerHTML=build(rs,ma);cleanLegacy();return}var w=document.createElement('div');w.innerHTML=build(rs,ma);if(w.firstElementChild)pg.insertBefore(w.firstElementChild,pg.firstElementChild);cleanLegacy()}
function run(force){setTimeout(function(){inject(!!force)},900)}
window.addEventListener('load',function(){run(true)});
window.addEventListener('hashchange',function(){lastKey='';run(true)});
window.addEventListener('storage',function(){lastKey='';run(true)});
})();
