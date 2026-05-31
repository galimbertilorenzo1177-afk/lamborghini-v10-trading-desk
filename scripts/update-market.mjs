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
const diagnosticTickers = new Set(['MRVL','LITE','NVDA','AVGO','AMD']);
const sectorByTicker = {};
for (const [sector, list] of Object.entries(groups)) for (const t of list) sectorByTicker[t] = sector;
const names = {LITE:'Lumentum Holdings Inc',MRVL:'Marvell Technology Inc',TER:'Teradyne',SNOW:'Snowflake',CRWD:'CrowdStrike',NVDA:'Nvidia',SOXX:'Semiconductor ETF',SMH:'Semiconductor ETF',QQQ:'Nasdaq 100 ETF',SPY:'S&P 500 ETF'};
const sectors = {LITE:'Optical/AI',MRVL:'Semiconductors/AI',TER:'Semicap equipment',SNOW:'Software',CRWD:'Cybersecurity',NVDA:'AI chips',SOXX:'Semiconductors ETF',SMH:'Semiconductors ETF',QQQ:'Index',SPY:'Index'};
const stooqColumns = ['symbol','date','time','open','high','low','close','volume'];

function isRealTicker(t){return /^[A-Z][A-Z0-9.]{0,5}$/.test(String(t||'').toUpperCase())&&!/^V\d+$/i.test(String(t||''));}
function truncate(value, max=3000){const text=typeof value==='string'?value:JSON.stringify(value);return text.length>max?`${text.slice(0,max)}…[truncated ${text.length-max} chars]`:text;}
function get(url){return new Promise((resolve,reject)=>{const req=https.get(url,{headers:{'user-agent':'Mozilla/5.0 LamborghiniV11'},timeout:12000},res=>{let data='';res.setEncoding('utf8');res.on('data',d=>data+=d);res.on('end',()=>{if(res.statusCode<200||res.statusCode>=300) reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0,200)}`)); else resolve(data);});});req.on('error',reject);req.on('timeout',()=>req.destroy(new Error('timeout')));});}
function parseCsv(text){const rows=[];let row=[],cur='',quoted=false;for(let i=0;i<text.length;i++){const ch=text[i],next=text[i+1];if(ch==='"'){if(quoted&&next==='"'){cur+='"';i++;}else quoted=!quoted;continue;}if(ch===','&&!quoted){row.push(cur);cur='';continue;}if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&next==='\n')i++;row.push(cur);if(row.some(x=>String(x).trim()!==''))rows.push(row);row=[];cur='';continue;}cur+=ch;}row.push(cur);if(row.some(x=>String(x).trim()!==''))rows.push(row);return rows;}
function parseNumber(value){const text=String(value??'').trim().replace(/,/g,'');if(!text||/^N\/?D$/i.test(text)||/^null$/i.test(text))return null;const n=Number(text);return Number.isFinite(n)?n:null;}
function normalizeTicker(value){return String(value||'').trim().replace(/\.US$/i,'').toUpperCase();}
function baseQuote(ticker){return {ticker,name:names[ticker]||ticker,sector:sectors[ticker]||sectorByTicker[ticker]||'Market scan'};}
function invalidQuote(ticker, error, source='market-data'){return {...baseQuote(ticker),price:0,move:0,volume:0,source,status:'invalid',valid:false,error:String(error&&error.message||error||'No valid quote')};}
function rejectReason(ticker, parsed){
  if(!parsed) return 'No parsed response';
  if(parsed.error) return parsed.error;
  const symbol=normalizeTicker(parsed.symbol||parsed.ticker);
  if(symbol!==ticker) return `Ticker mismatch: expected ${ticker}, got ${symbol||'empty'}`;
  if(!Number.isFinite(parsed.close)||parsed.close<=0) return `Invalid close price: ${parsed.close??'empty'}`;
  return null;
}
function quoteFromParsed(ticker, parsed, source){
  const reason=rejectReason(ticker, parsed);
  if(reason) throw new Error(reason);
  const open=Number.isFinite(parsed.open)&&parsed.open>0?parsed.open:(Number.isFinite(parsed.previousClose)&&parsed.previousClose>0?parsed.previousClose:parsed.close);
  const move=open>0?((parsed.close-open)/open*100):0;
  return {...baseQuote(ticker),price:parsed.close,move:Number(move.toFixed(2)),volume:Number.isFinite(parsed.volume)?parsed.volume:0,source,sourceSymbol:parsed.symbol,quoteDate:parsed.date,quoteTime:parsed.time,status:'ok',valid:true};
}
function mapStooqRows(csv){
  const rows=parseCsv(csv);
  if(!rows.length) return new Map();
  const first=rows[0].map(x=>String(x).trim().toLowerCase());
  const hasHeader=first.some(x=>['symbol','date','time','open','high','low','close','volume'].includes(x));
  const header=(hasHeader?first:stooqColumns).map(x=>x.toLowerCase());
  const dataRows=hasHeader?rows.slice(1):rows;
  const out=new Map();
  for(const row of dataRows){
    const raw=Object.fromEntries(header.map((h,i)=>[h,row[i]??'']));
    const parsed={symbol:raw.symbol,date:raw.date,time:raw.time,open:parseNumber(raw.open),high:parseNumber(raw.high),low:parseNumber(raw.low),close:parseNumber(raw.close),volume:parseNumber(raw.volume),raw};
    const ticker=normalizeTicker(parsed.symbol);
    if(ticker) out.set(ticker, parsed);
  }
  return out;
}
function mapYahooQuote(json){
  const data=JSON.parse(json);
  const results=data?.quoteResponse?.result||[];
  const out=new Map();
  for(const item of results){
    const ticker=normalizeTicker(item.symbol);
    const parsed={symbol:item.symbol,date:item.regularMarketTime?new Date(item.regularMarketTime*1000).toISOString().slice(0,10):undefined,time:item.regularMarketTime?new Date(item.regularMarketTime*1000).toISOString().slice(11,19):undefined,open:parseNumber(item.regularMarketOpen),previousClose:parseNumber(item.regularMarketPreviousClose),close:parseNumber(item.regularMarketPrice),volume:parseNumber(item.regularMarketVolume),raw:item};
    if(ticker) out.set(ticker, parsed);
  }
  return out;
}
function diagnosticEntry({source,ticker,url,rawResponse,parsedResponse,reason}){return {source,ticker,requestedUrl:url,rawResponse:truncate(rawResponse),parsedResponse,reasonForRejection:reason||null};}
function stooqUrl(list){return `https://stooq.com/q/l/?s=${encodeURIComponent(list.map(t=>`${t.toLowerCase()}.us`).join(','))}&f=sd2t2ohlcv&h&e=csv`;}
function yahooUrl(list){return `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(list.join(','))}`;}
async function fetchStooq(list){
  const url=stooqUrl(list);
  const raw=await get(url);
  return {source:'stooq',url,raw,map:mapStooqRows(raw)};
}
async function fetchYahoo(list){
  const url=yahooUrl(list);
  const raw=await get(url);
  return {source:'yahoo',url,raw,map:mapYahooQuote(raw)};
}
fetchStooq.source='stooq';
fetchStooq.urlFor=stooqUrl;
fetchYahoo.source='yahoo';
fetchYahoo.urlFor=yahooUrl;
async function quotesFor(list){
  const quotes=new Map();
  const diagnostics={};
  for (const t of diagnosticTickers) diagnostics[t]=[];
  for (const provider of [fetchStooq, fetchYahoo]){
    const missing=list.filter(t=>!quotes.has(t));
    if(!missing.length) break;
    let result;
    try{result=await provider(missing);}catch(error){
      for(const ticker of missing.filter(t=>diagnosticTickers.has(t))) diagnostics[ticker].push(diagnosticEntry({source:provider.source,ticker,url:provider.urlFor(missing),rawResponse:String(error&&error.message||error),parsedResponse:null,reason:String(error&&error.message||error)}));
      continue;
    }
    for(const ticker of missing){
      const parsed=result.map.get(ticker)||null;
      const reason=rejectReason(ticker, parsed);
      if(diagnosticTickers.has(ticker)) diagnostics[ticker].push(diagnosticEntry({source:result.source,ticker,url:result.url,rawResponse:result.raw,parsedResponse:parsed,reason}));
      if(!reason){
        try{quotes.set(ticker, quoteFromParsed(ticker, parsed, result.source));}catch{}
      }
    }
  }
  return {quotes:list.map(t=>quotes.get(t)||invalidQuote(t, diagnostics[t]?.at(-1)?.reasonForRejection||'No provider returned a valid quote')), diagnostics};
}
async function newsFor(ticker){return [];}
function radarScore(q){let r=5;if(q.move>12)r=4.4;else if(q.move>6)r=6.1;else if(q.move>2)r=8.1;else if(q.move>0.8)r=6.9;else if(q.move<-4)r=3.8;else if(q.move<-2)r=4.4;if(q.volume>1000000)r+=0.2;return Math.max(1,Math.min(9.5,Number(r.toFixed(1))));}
function sectorRanking(quotes){const by={};for(const q of quotes){if(!q.valid||!q.price)continue;const k=q.sector||'Broad market';by[k]??={sector:k,count:0,avgMove:0,leaders:0,weak:0};by[k].count++;by[k].avgMove+=q.move;if(q.move>.8)by[k].leaders++;if(q.move<-1)by[k].weak++;}return Object.values(by).map(x=>({...x,avgMove:Number((x.avgMove/Math.max(1,x.count)).toFixed(2)),score:Number((50+x.avgMove*8+x.leaders*2-x.weak*2).toFixed(1))})).sort((a,b)=>b.score-a.score);}
function regimeFrom(quotes, sectorStrength){const priced=quotes.filter(q=>q.valid&&q.price>0),adv=priced.filter(q=>q.move>0).length,leaders=priced.filter(q=>q.move>.8).length,weak=priced.filter(q=>q.move<-1).length,breadth=priced.length?adv/priced.length:0,spread=sectorStrength.length>1?sectorStrength[0].avgMove-sectorStrength.at(-1).avgMove:0;let label='selettivo';if(breadth>.58&&leaders>weak*1.2)label='risk-on';else if(breadth<.42&&weak>leaders)label='risk-off';else if(spread>3)label='rotazione settoriale';return {label,score:Number((breadth*100).toFixed(1)),breadth:Number((breadth*100).toFixed(1)),leaders,weak,priced:priced.length};}

const {quotes, diagnostics} = await quotesFor(symbols);
const validQuotes=quotes.filter(q=>q.valid&&q.price>0);
const radar=validQuotes.map(q=>({...q,score:radarScore(q),event:'market scan',note:q.move>12?'FOMO high':q.move>2?'momentum candidate':q.move<-2?'weak relative':'neutral'})).sort((a,b)=>b.score-a.score).slice(0,120);
const sectorStrength=sectorRanking(quotes);
const regime=regimeFrom(quotes, sectorStrength);
const news=[];
const payload={updatedAt:new Date().toISOString(),source:'market-data',universeSize:validQuotes.length,groups,sectorStrength,regime,bestSector:sectorStrength[0]||null,worstSector:sectorStrength.at(-1)||null,quotes,radar,news:news.slice(0,30),diagnostics};
await fs.mkdir('data',{recursive:true});
await fs.writeFile('data/market.json',JSON.stringify(payload,null,2));
console.log(JSON.stringify({updatedAt:payload.updatedAt,source:payload.source,universeSize:payload.universeSize,invalid:quotes.length-validQuotes.length,regime:payload.regime,bestSector:payload.bestSector,worstSector:payload.worstSector,diagnostics:payload.diagnostics,topRadar:payload.radar.slice(0,5)},null,2));
process.exit(0);
