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
  etfs: ['SOXX','SMH','QQQ','SPY','IWM','DIA','XLK','XLY','XLF','XLE','XLV','XLI','XLP','XLU','XLC','ARKK']
};
const symbols = [...new Set(Object.values(groups).flat())].filter(isRealTicker);
const sectorByTicker = {};
for (const [sector, list] of Object.entries(groups)) for (const t of list) sectorByTicker[t] = sector;
const names = {LITE:'Lumentum Holdings Inc',MRVL:'Marvell Technology Inc',TER:'Teradyne',SNOW:'Snowflake',CRWD:'CrowdStrike',NVDA:'Nvidia',SOXX:'Semiconductor ETF',SMH:'Semiconductor ETF',QQQ:'Nasdaq 100 ETF',SPY:'S&P 500 ETF'};
const sectors = {LITE:'Optical/AI',MRVL:'Semiconductors/AI',TER:'Semicap equipment',SNOW:'Software',CRWD:'Cybersecurity',NVDA:'AI chips',SOXX:'Semiconductors ETF',SMH:'Semiconductors ETF',QQQ:'Index',SPY:'Index'};

function isRealTicker(t){return /^[A-Z][A-Z0-9.]{0,5}$/.test(String(t||'').toUpperCase())&&!/^V\d+$/i.test(String(t||''));}
function get(url){return new Promise((resolve,reject)=>{const req=https.get(url,{headers:{'user-agent':'Mozilla/5.0 LamborghiniV11'},timeout:4500},res=>{let data='';res.on('data',d=>data+=d);res.on('end',()=>resolve(data));});req.on('error',reject);req.on('timeout',()=>req.destroy(new Error('timeout')));});}
function parseCsvLine(line){const out=[];let cur='',quoted=false;for(const ch of line){if(ch==='"'){quoted=!quoted;continue;}if(ch===','&&!quoted){out.push(cur);cur='';continue;}cur+=ch;}out.push(cur);return out;}
function invalidQuote(ticker, error){return {ticker,name:names[ticker]||ticker,sector:sectors[ticker]||sectorByTicker[ticker]||'Market scan',price:0,move:0,volume:0,source:'stooq',status:'invalid',valid:false,error:String(error&&error.message||error||'No valid quote')};}
async function quote(ticker){
  const sym=`${ticker.toLowerCase()}.us`;
  const url=`https://stooq.com/q/l/?s=${encodeURIComponent(sym)}&f=sd2t2ohlcv&h&e=csv`;
  const csv=await get(url);
  const rows=csv.trim().split(/\r?\n/).filter(Boolean);
  if(rows.length<2) throw new Error('No CSV data');
  const header=parseCsvLine(rows[0]).map(x=>x.toLowerCase());
  const row=parseCsvLine(rows[1]);
  const mapped=Object.fromEntries(header.map((h,i)=>[h,row[i]]));
  const symbol=String(mapped.symbol||'').replace(/\.US$/i,'').toUpperCase();
  const open=Number(mapped.open);
  const close=Number(mapped.close);
  const volume=Number(mapped.volume);
  if(symbol!==ticker) throw new Error(`Ticker mismatch: expected ${ticker}, got ${symbol||'empty'}`);
  if(!Number.isFinite(close)||close<=0) throw new Error('Invalid close price');
  const move=Number.isFinite(open)&&open>0?((close-open)/open*100):0;
  return {ticker,name:names[ticker]||ticker,sector:sectors[ticker]||sectorByTicker[ticker]||'Market scan',price:close,move:Number(move.toFixed(2)),volume:Number.isFinite(volume)?volume:0,source:'stooq',sourceSymbol:mapped.symbol,quoteDate:mapped.date,quoteTime:mapped.time,status:'ok',valid:true};
}
async function quotesFor(list){
  const worker=async ticker=>{try{return await quote(ticker);}catch(e){return invalidQuote(ticker,e);}};
  return Promise.all(list.map(worker));
}
async function newsFor(ticker){return [];}
function radarScore(q){let r=5;if(q.move>12)r=4.4;else if(q.move>6)r=6.1;else if(q.move>2)r=8.1;else if(q.move>0.8)r=6.9;else if(q.move<-4)r=3.8;else if(q.move<-2)r=4.4;if(q.volume>1000000)r+=0.2;return Math.max(1,Math.min(9.5,Number(r.toFixed(1))));}
function sectorRanking(quotes){const by={};for(const q of quotes){if(!q.valid||!q.price)continue;const k=q.sector||'Broad market';by[k]??={sector:k,count:0,avgMove:0,leaders:0,weak:0};by[k].count++;by[k].avgMove+=q.move;if(q.move>.8)by[k].leaders++;if(q.move<-1)by[k].weak++;}return Object.values(by).map(x=>({...x,avgMove:Number((x.avgMove/Math.max(1,x.count)).toFixed(2)),score:Number((50+x.avgMove*8+x.leaders*2-x.weak*2).toFixed(1))})).sort((a,b)=>b.score-a.score);}
function regimeFrom(quotes, sectorStrength){const priced=quotes.filter(q=>q.valid&&q.price>0),adv=priced.filter(q=>q.move>0).length,leaders=priced.filter(q=>q.move>.8).length,weak=priced.filter(q=>q.move<-1).length,breadth=priced.length?adv/priced.length:0,spread=sectorStrength.length>1?sectorStrength[0].avgMove-sectorStrength.at(-1).avgMove:0;let label='selettivo';if(breadth>.58&&leaders>weak*1.2)label='risk-on';else if(breadth<.42&&weak>leaders)label='risk-off';else if(spread>3)label='rotazione settoriale';return {label,score:Number((breadth*100).toFixed(1)),breadth:Number((breadth*100).toFixed(1)),leaders,weak,priced:priced.length};}

const quotes = await quotesFor(symbols);
const validQuotes=quotes.filter(q=>q.valid&&q.price>0);
const radar=validQuotes.map(q=>({...q,score:radarScore(q),event:'market scan',note:q.move>12?'FOMO high':q.move>2?'momentum candidate':q.move<-2?'weak relative':'neutral'})).sort((a,b)=>b.score-a.score).slice(0,120);
const sectorStrength=sectorRanking(quotes);
const regime=regimeFrom(quotes, sectorStrength);
const news=[];
const payload={updatedAt:new Date().toISOString(),source:'stooq',quoteDownloadSuccess:validQuotes.length>0,quoteDownloadStatus:validQuotes.length>0?'success':'fail',validQuotesCount:validQuotes.length,invalidQuotesCount:quotes.length-validQuotes.length,firstSuccessfulTickers:validQuotes.slice(0,10).map(q=>q.ticker),universeSize:validQuotes.length,groups,sectorStrength,regime,bestSector:sectorStrength[0]||null,worstSector:sectorStrength.at(-1)||null,quotes,radar,news:news.slice(0,30)};
await fs.mkdir('data',{recursive:true});
await fs.writeFile('data/market.json',JSON.stringify(payload,null,2));
console.log(JSON.stringify({updatedAt:payload.updatedAt,source:payload.source,universeSize:payload.universeSize,invalid:quotes.length-validQuotes.length,regime:payload.regime,bestSector:payload.bestSector,worstSector:payload.worstSector,topRadar:payload.radar.slice(0,5)},null,2));
process.exit(0);
