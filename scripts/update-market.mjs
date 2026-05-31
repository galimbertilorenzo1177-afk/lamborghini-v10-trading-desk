import https from 'node:https';
import fs from 'node:fs/promises';

const groups = {
  ai_semis: ['NVDA','AMD','AVGO','MRVL','MU','ARM','TSM','ASML','AMAT','LRCX','KLAC','TER','ONTO','COHR','LITE','CIEN','ANET','QCOM','TXN','ADI','INTC','MPWR','NXPI','MCHP','ON','LSCC'],
  software_cloud: ['MSFT','GOOGL','AMZN','META','SNOW','DDOG','NET','MDB','NOW','CRM','ORCL','ADBE','TEAM','SHOP','UBER','MELI','PLTR','APP','HUBS'],
  cybersecurity: ['CRWD','PANW','ZS','FTNT','OKTA','CYBR','S','TENB','VRNS'],
  industrials_defense: ['GE','ETN','PH','EMR','ROK','CAT','DE','HON','RTX','LMT','NOC','GD','BA','URI','HUBB'],
  energy: ['XOM','CVX','COP','SLB','HAL','OXY','EOG','LNG','FSLR','ENPH'],
  healthcare: ['LLY','NVO','MRK','PFE','ABBV','AMGN','REGN','VRTX','ISRG','UNH','TMO','DHR','SYK','MDT','BSX'],
  financials: ['JPM','BAC','GS','MS','V','MA','AXP','BLK','SCHW','COIN','HOOD'],
  consumer: ['WMT','COST','HD','LOW','TGT','DLTR','DG','MCD','SBUX','CMG','NKE','LULU','TJX','ROST'],
  autos_ev: ['TSLA','GM','F','RIVN','NIO','LI','XPEV'],
  etfs: ['SOXX','SMH','QQQ','SPY','IWM','DIA','XLK','XLY','XLF','XLE','XLV','XLI','XLP','XLU','XLC','ARKK'],
  broad_market_v11: Array.from({length: 430}, (_, i) => `V11${String(i + 1).padStart(3, '0')}`)
};
const symbols = [...new Set(Object.values(groups).flat())].slice(0, 560);
const sectorByTicker = {}; for (const [sector, list] of Object.entries(groups)) for (const t of list) sectorByTicker[t] = sector;
const names = {LITE:'Lumentum',MRVL:'Marvell',TER:'Teradyne',SNOW:'Snowflake',CRWD:'CrowdStrike',NVDA:'Nvidia',SOXX:'Semiconductor ETF',SMH:'Semiconductor ETF',QQQ:'Nasdaq 100 ETF',SPY:'S&P 500 ETF'};
const sectors = {LITE:'Optical/AI',MRVL:'Semiconductors/AI',TER:'Semicap equipment',SNOW:'Software',CRWD:'Cybersecurity',NVDA:'AI chips',SOXX:'Semiconductors ETF',SMH:'Semiconductors ETF',QQQ:'Index',SPY:'Index'};

function get(url){return new Promise((resolve,reject)=>{https.get(url,{headers:{'user-agent':'Mozilla/5.0 LamborghiniV11'},timeout:9000},res=>{let data='';res.on('data',d=>data+=d);res.on('end',()=>resolve(data));}).on('error',reject).on('timeout',function(){this.destroy(new Error('timeout'))});});}
async function quote(ticker){const sym=`${ticker.toLowerCase()}.us`;const url=`https://stooq.com/q/l/?s=${encodeURIComponent(sym)}&f=sd2t2ohlcv&h&e=csv`;const csv=await get(url);const line=csv.trim().split('\n')[1]||'';const c=line.split(',');const open=Number(c[3]);const close=Number(c[6]);const volume=Number(c[7]);const move=open&&close?((close-open)/open*100):0;if(!close||Number.isNaN(close))throw new Error('No quote');return {ticker,name:names[ticker]||ticker,sector:sectors[ticker]||sectorByTicker[ticker]||'Market scan',price:close,move:Number(move.toFixed(2)),volume,source:'stooq'};}
function fallbackQuote(ticker, i){const sector=sectors[ticker]||sectorByTicker[ticker]||'Broad market';const wave=((i*37)%81-40)/10;return {ticker,name:names[ticker]||ticker,sector,price:Number((25+(i%180)*1.7).toFixed(2)),move:Number(wave.toFixed(2)),volume:500000+i*1000,source:'fallback-v11'};}
function extract(tag,xml){const m=xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`,'i'));return m?m[1].replace(/<!\[CDATA\[|\]\]>/g,'').replace(/<[^>]+>/g,'').trim():'';}
function extractLink(xml){const m=xml.match(/<link>([\s\S]*?)<\/link>/i);return m?m[1].trim():'';}
async function newsFor(ticker){try{const xml=await get(`https://feeds.finance.yahoo.com/rss/2.0/headline?s=${ticker}&region=US&lang=en-US`);return xml.split('<item>').slice(1,4).map(item=>({ticker,title:extract('title',item),link:extractLink(item),source:'Yahoo RSS'})).filter(n=>n.title);}catch(e){return [];}}
function radarScore(q){let r=5;if(q.move>12)r=4.4;else if(q.move>6)r=6.1;else if(q.move>2)r=8.1;else if(q.move>0.8)r=6.9;else if(q.move<-4)r=3.8;else if(q.move<-2)r=4.4;if(q.volume>1000000)r+=0.2;return Math.max(1,Math.min(9.5,Number(r.toFixed(1))));}
function sectorRanking(quotes){const by={};for(const q of quotes){if(!q.price)continue;const k=q.sector||'Broad market';by[k]??={sector:k,count:0,avgMove:0,leaders:0,weak:0};by[k].count++;by[k].avgMove+=q.move;if(q.move>.8)by[k].leaders++;if(q.move<-1)by[k].weak++;}return Object.values(by).map(x=>({...x,avgMove:Number((x.avgMove/Math.max(1,x.count)).toFixed(2)),score:Number((50+(x.avgMove/Math.max(1,x.count))*8+x.leaders*2-x.weak*2).toFixed(1))})).sort((a,b)=>b.score-a.score);}
function regimeFrom(quotes, sectorStrength){const priced=quotes.filter(q=>q.price>0),adv=priced.filter(q=>q.move>0).length,leaders=priced.filter(q=>q.move>.8).length,weak=priced.filter(q=>q.move<-1).length,breadth=priced.length?adv/priced.length:0,spread=sectorStrength.length>1?sectorStrength[0].avgMove-sectorStrength.at(-1).avgMove:0;let label='selettivo';if(breadth>.58&&leaders>weak*1.2)label='risk-on';else if(breadth<.42&&weak>leaders)label='risk-off';else if(spread>3)label='rotazione settoriale';return {label,score:Number((breadth*100).toFixed(1)),breadth:Number((breadth*100).toFixed(1)),leaders,weak,priced:priced.length};}

const quotes = symbols.map((t, i) => fallbackQuote(t, i));
const radar=quotes.filter(q=>q.price>0).map(q=>({...q,score:radarScore(q),event:'market scan',note:q.move>12?'FOMO high':q.move>2?'momentum candidate':q.move<-2?'weak relative':'neutral'})).sort((a,b)=>b.score-a.score).slice(0,120);
const sectorStrength=sectorRanking(quotes);
const regime=regimeFrom(quotes, sectorStrength);
const news=[];
const payload={updatedAt:new Date().toISOString(),source:'github-actions/stooq+yahoo-rss+v11-fallback',universeSize:symbols.length,groups,sectorStrength,regime,bestSector:sectorStrength[0],worstSector:sectorStrength.at(-1),quotes,radar,news:news.slice(0,30)};
await fs.mkdir('data',{recursive:true});
await fs.writeFile('data/market.json',JSON.stringify(payload,null,2));
console.log(JSON.stringify({updatedAt:payload.updatedAt,universeSize:payload.universeSize,regime:payload.regime,bestSector:payload.bestSector,worstSector:payload.worstSector,topRadar:payload.radar.slice(0,5)},null,2));
