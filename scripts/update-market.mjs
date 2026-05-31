import https from 'node:https';
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

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
const STOOQ_DEBUG_TICKERS = new Set(['MRVL','LITE','NVDA','AVGO','AMD']);
const STOOQ_FIELDS = ['symbol','date','time','open','high','low','close','volume'];
const diagnostics = {
  stooqExpectedTickerFormat: 'US equities must be requested as lowercase ticker plus .us, for example nvda.us. Stooq CSV echoes the symbol as NVDA.US.',
  stooqRawResponses: {},
  secondarySource: 'yahoo-chart'
};

function isRealTicker(t){return /^[A-Z][A-Z0-9.]{0,5}$/.test(String(t||'').toUpperCase())&&!/^V\d+$/i.test(String(t||''));}
function get(url, timeout=5000){return new Promise((resolve,reject)=>{const req=https.get(url,{headers:{'user-agent':'Mozilla/5.0 LamborghiniV11'},timeout},res=>{let data='';res.setEncoding('utf8');res.on('data',d=>data+=d);res.on('end',()=>resolve({body:data,statusCode:res.statusCode,headers:res.headers,url}));});req.on('error',reject);req.on('timeout',()=>req.destroy(new Error('timeout')));});}
function parseCsvLine(line){const out=[];let cur='',quoted=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(quoted&&line[i+1]==='"'){cur+='"';i++;}else quoted=!quoted;continue;}if(ch===','&&!quoted){out.push(cur);cur='';continue;}cur+=ch;}out.push(cur);return out.map(x=>x.trim());}
export function parseStooqCsv(csv){
  const rows=String(csv||'').trim().split(/\r?\n/).filter(Boolean).map(parseCsvLine);
  if(!rows.length) throw new Error('No CSV data');
  const first=rows[0].map(x=>x.toLowerCase());
  const hasHeader=first.includes('symbol')&&first.includes('close');
  const header=hasHeader?first:STOOQ_FIELDS;
  const row=hasHeader?rows[1]:rows[0];
  if(!row) throw new Error('No CSV quote row');
  return Object.fromEntries(header.map((h,i)=>[h,row[i] ?? '']));
}
function baseQuote(ticker){return {ticker,name:names[ticker]||ticker,sector:sectors[ticker]||sectorByTicker[ticker]||'Market scan'};}
function invalidQuote(ticker, error, source='stooq'){return {...baseQuote(ticker),price:0,move:0,volume:0,source,status:'invalid',valid:false,error:String(error&&error.message||error||'No valid quote')};}
export function stooqSymbolFor(ticker){return `${ticker.toLowerCase()}.us`;}
async function stooqQuote(ticker){
  const sym=stooqSymbolFor(ticker);
  const url=`https://stooq.com/q/l/?s=${encodeURIComponent(sym)}&f=sd2t2ohlcv&h&e=csv`;
  const response=await get(url);
  if(STOOQ_DEBUG_TICKERS.has(ticker)) diagnostics.stooqRawResponses[ticker]={url,statusCode:response.statusCode,body:response.body};
  if(response.statusCode<200||response.statusCode>=300) throw new Error(`Stooq HTTP ${response.statusCode}`);
  const mapped=parseStooqCsv(response.body);
  const symbol=String(mapped.symbol||'').replace(/\.US$/i,'').toUpperCase();
  const open=Number(mapped.open);
  const close=Number(mapped.close);
  const volume=Number(mapped.volume);
  if(symbol!==ticker) throw new Error(`Ticker mismatch: expected ${ticker}, got ${symbol||'empty'}`);
  if(!Number.isFinite(close)||close<=0) throw new Error('Invalid close price');
  const move=Number.isFinite(open)&&open>0?((close-open)/open*100):0;
  return {...baseQuote(ticker),price:close,move:Number(move.toFixed(2)),volume:Number.isFinite(volume)?volume:0,source:'stooq',sourceSymbol:mapped.symbol,quoteDate:mapped.date,quoteTime:mapped.time,status:'ok',valid:true};
}
async function yahooQuote(ticker, stooqError){
  const url=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=5d&interval=1d`;
  const response=await get(url, 5000);
  if(response.statusCode<200||response.statusCode>=300) throw new Error(`Yahoo HTTP ${response.statusCode}; Stooq failed: ${stooqError&&stooqError.message||stooqError}`);
  let json;
  try{json=JSON.parse(response.body);}catch(e){throw new Error(`Yahoo JSON parse failed: ${e.message}; Stooq failed: ${stooqError&&stooqError.message||stooqError}`);}
  const result=json?.chart?.result?.[0];
  const meta=result?.meta||{};
  const quote=result?.indicators?.quote?.[0]||{};
  const closes=(quote.close||[]).filter(Number.isFinite);
  const opens=(quote.open||[]).filter(Number.isFinite);
  const volumes=(quote.volume||[]).filter(Number.isFinite);
  const close=Number(meta.regularMarketPrice ?? closes.at(-1));
  const open=Number(meta.regularMarketOpen ?? opens.at(-1));
  const previousClose=Number(meta.previousClose ?? (closes.length>1?closes.at(-2):NaN));
  const volume=Number(meta.regularMarketVolume ?? volumes.at(-1));
  if(!Number.isFinite(close)||close<=0) throw new Error(`Yahoo invalid price; Stooq failed: ${stooqError&&stooqError.message||stooqError}`);
  const basis=Number.isFinite(previousClose)&&previousClose>0?previousClose:open;
  const move=Number.isFinite(basis)&&basis>0?((close-basis)/basis*100):0;
  return {...baseQuote(ticker),price:close,move:Number(move.toFixed(2)),volume:Number.isFinite(volume)?volume:0,source:'yahoo-chart',sourceSymbol:meta.symbol||ticker,quoteDate:meta.regularMarketTime?new Date(meta.regularMarketTime*1000).toISOString().slice(0,10):'',quoteTime:meta.regularMarketTime?new Date(meta.regularMarketTime*1000).toISOString().slice(11,19):'',status:'ok',valid:true,primarySourceError:`stooq: ${stooqError&&stooqError.message||stooqError}`};
}
async function quote(ticker){
  try{return await stooqQuote(ticker);}catch(stooqError){
    if(STOOQ_DEBUG_TICKERS.has(ticker)&&!diagnostics.stooqRawResponses[ticker]) diagnostics.stooqRawResponses[ticker]={url:`https://stooq.com/q/l/?s=${encodeURIComponent(stooqSymbolFor(ticker))}&f=sd2t2ohlcv&h&e=csv`,error:String(stooqError&&stooqError.message||stooqError)};
    try{return await yahooQuote(ticker, stooqError);}catch(secondaryError){return invalidQuote(ticker, `Stooq failed: ${stooqError&&stooqError.message||stooqError}; yahoo-chart failed: ${secondaryError&&secondaryError.message||secondaryError}`, 'stooq,yahoo-chart');}
  }
}
async function quotesFor(list, concurrency=8){
  const results=new Array(list.length);let next=0;
  const worker=async()=>{while(next<list.length){const i=next++;results[i]=await quote(list[i]);}};
  await Promise.all(Array.from({length:Math.min(concurrency,list.length)},worker));
  return results;
}
async function newsFor(ticker){return [];} // eslint-disable-line no-unused-vars
function radarScore(q){let r=5;if(q.move>12)r=4.4;else if(q.move>6)r=6.1;else if(q.move>2)r=8.1;else if(q.move>0.8)r=6.9;else if(q.move<-4)r=3.8;else if(q.move<-2)r=4.4;if(q.volume>1000000)r+=0.2;return Math.max(1,Math.min(9.5,Number(r.toFixed(1))));}
function sectorRanking(quotes){const by={};for(const q of quotes){if(!q.valid||!q.price)continue;const k=q.sector||'Broad market';by[k]??={sector:k,count:0,avgMove:0,leaders:0,weak:0};by[k].count++;by[k].avgMove+=q.move;if(q.move>.8)by[k].leaders++;if(q.move<-1)by[k].weak++;}return Object.values(by).map(x=>({...x,avgMove:Number((x.avgMove/Math.max(1,x.count)).toFixed(2)),score:Number((50+x.avgMove*8+x.leaders*2-x.weak*2).toFixed(1))})).sort((a,b)=>b.score-a.score);}
function regimeFrom(quotes, sectorStrength){const priced=quotes.filter(q=>q.valid&&q.price>0),adv=priced.filter(q=>q.move>0).length,leaders=priced.filter(q=>q.move>.8).length,weak=priced.filter(q=>q.move<-1).length,breadth=priced.length?adv/priced.length:0,spread=sectorStrength.length>1?sectorStrength[0].avgMove-sectorStrength.at(-1).avgMove:0;let label='selettivo';if(breadth>.58&&leaders>weak*1.2)label='risk-on';else if(breadth<.42&&weak>leaders)label='risk-off';else if(spread>3)label='rotazione settoriale';return {label,score:Number((breadth*100).toFixed(1)),breadth:Number((breadth*100).toFixed(1)),leaders,weak,priced:priced.length};}

async function main(){
  const quotes = await quotesFor(symbols);
  const validQuotes=quotes.filter(q=>q.valid&&q.price>0);
  const radar=validQuotes.map(q=>({...q,score:radarScore(q),event:'market scan',note:q.move>12?'FOMO high':q.move>2?'momentum candidate':q.move<-2?'weak relative':'neutral'})).sort((a,b)=>b.score-a.score).slice(0,120);
  const sectorStrength=sectorRanking(quotes);
  const regime=regimeFrom(quotes, sectorStrength);
  const news=[];
  const quoteSources=[...new Set(validQuotes.map(q=>q.source))];
  const payload={updatedAt:new Date().toISOString(),source:quoteSources.length===1?quoteSources[0]:quoteSources.join('+')||'none',universeSize:validQuotes.length,groups,sectorStrength,regime,bestSector:sectorStrength[0]||null,worstSector:sectorStrength.at(-1)||null,quotes,radar,news:news.slice(0,30),diagnostics};
  await fs.mkdir('data',{recursive:true});
  await fs.writeFile('data/market.json',JSON.stringify(payload,null,2));
  console.log(JSON.stringify({updatedAt:payload.updatedAt,source:payload.source,universeSize:payload.universeSize,invalid:quotes.length-validQuotes.length,stooqExpectedTickerFormat:diagnostics.stooqExpectedTickerFormat,stooqRawResponses:diagnostics.stooqRawResponses,regime:payload.regime,bestSector:payload.bestSector,worstSector:payload.worstSector,topRadar:payload.radar.slice(0,5)},null,2));
  process.exit(validQuotes.length?0:1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error=>{console.error(error);process.exit(1);});
}
