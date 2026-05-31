import http from 'node:http';
import https from 'node:https';
import tls from 'node:tls';
import fs from 'node:fs/promises';

const DEBUG_TICKERS = new Set(['MRVL', 'LITE', 'NVDA', 'AVGO', 'AMD']);
const REQUEST_TIMEOUT_MS = 12000;
const BATCH_SIZE = 45;

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
const diagnostics = {};

function isRealTicker(t){return /^[A-Z][A-Z0-9.]{0,5}$/.test(String(t||'').toUpperCase())&&!/^V\d+$/i.test(String(t||''));}
function chunks(list, size){const out=[];for(let i=0;i<list.length;i+=size)out.push(list.slice(i,i+size));return out;}
function truncate(value, max=5000){const text=typeof value==='string'?value:JSON.stringify(value);return text.length>max?`${text.slice(0,max)}…[truncated ${text.length-max} chars]`:text;}
function displayName(ticker){return names[ticker]||ticker;}
function displaySector(ticker){return sectors[ticker]||sectorByTicker[ticker]||'Market scan';}
function proxyUrlFor(url){const target=new URL(url);if(target.protocol!=='https:')return process.env.HTTP_PROXY||process.env.http_proxy||'';return process.env.HTTPS_PROXY||process.env.https_proxy||process.env.HTTP_PROXY||process.env.http_proxy||'';}
function connectViaProxy(targetUrl, timeout){
  const target=new URL(targetUrl);
  const proxyRaw=proxyUrlFor(targetUrl);
  if(!proxyRaw)return null;
  const proxy=new URL(proxyRaw);
  return new Promise((resolve,reject)=>{
    const connectReq=http.request({
      host: proxy.hostname,
      port: Number(proxy.port||80),
      method: 'CONNECT',
      path: `${target.hostname}:${target.port||443}`,
      headers: {host: `${target.hostname}:${target.port||443}`},
      timeout
    });
    connectReq.once('connect',(res,socket,head)=>{
      if(res.statusCode!==200){socket.destroy();reject(new Error(`Proxy CONNECT ${res.statusCode} ${res.statusMessage||''}`.trim()));return;}
      if(head?.length) socket.unshift(head);
      const secureSocket=tls.connect({socket,servername:target.hostname},()=>resolve(secureSocket));
      secureSocket.once('error',reject);
    });
    connectReq.once('timeout',()=>connectReq.destroy(new Error('proxy connect timeout')));
    connectReq.once('error',reject);
    connectReq.end();
  });
}
function requestText(url, requestOptions){
  const target=new URL(url);
  return new Promise((resolve,reject)=>{
    const transport=target.protocol==='https:'?https:http;
    const req=transport.request(url,requestOptions,res=>{
      let data='';
      res.setEncoding('utf8');
      res.on('data',d=>data+=d);
      res.on('end',()=>{
        if(res.statusCode<200||res.statusCode>=300) reject(new Error(`HTTP ${res.statusCode}: ${truncate(data, 300)}`));
        else resolve(data);
      });
    });
    req.on('error',reject);
    req.on('timeout',()=>req.destroy(new Error('timeout')));
    req.end();
  });
}
async function get(url){
  const target=new URL(url);
  const headers={'user-agent':'Mozilla/5.0 LamborghiniV11 (+market-data-diagnostics)','accept':'text/csv,application/json,text/plain,*/*'};
  const baseOptions={method:'GET',headers,timeout:REQUEST_TIMEOUT_MS};
  let proxyError;
  if(target.protocol==='https:'&&proxyUrlFor(url)){
    try{
      const socket=await connectViaProxy(url, REQUEST_TIMEOUT_MS);
      return await requestText(url,{...baseOptions,createConnection:()=>socket,agent:false});
    }catch(e){
      proxyError=e;
      if(/^Proxy CONNECT (403|407)\b/.test(String(e.message||e))) throw e;
    }
  }
  try{return await requestText(url,baseOptions);}
  catch(e){
    if(proxyError) throw new Error(`${String(proxyError.message||proxyError)}; direct: ${String(e.message||e)}`);
    throw e;
  }
}
function parseCsvLine(line){const out=[];let cur='',quoted=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(quoted&&line[i+1]==='"'){cur+='"';i++;}else quoted=!quoted;continue;}if(ch===','&&!quoted){out.push(cur.trim());cur='';continue;}cur+=ch;}out.push(cur.trim());return out;}
function invalidQuote(ticker, error, source='stooq'){return {ticker,name:displayName(ticker),sector:displaySector(ticker),price:0,move:0,volume:0,source,status:'invalid',valid:false,error:String(error&&error.message||error||'No valid quote')};}
function rejectReason(ticker, parsed){
  if(!parsed) return 'No parsed response';
  if(parsed.symbol!==ticker) return `Ticker mismatch: expected ${ticker}, got ${parsed.symbol||'empty'}`;
  if(!Number.isFinite(parsed.price)||parsed.price<=0) return `Invalid price: ${parsed.priceRaw ?? parsed.price}`;
  if(parsed.date&&String(parsed.date).toLowerCase()==='n/d') return 'Quote date is N/D';
  return '';
}
function parseStooqCsv(csv){
  const rows=String(csv||'').trim().split(/\r?\n/).filter(Boolean);
  if(rows.length<2) throw new Error('No CSV data');
  const header=parseCsvLine(rows[0]).map(x=>x.toLowerCase());
  return rows.slice(1).map(line=>{
    const row=parseCsvLine(line);
    const mapped=Object.fromEntries(header.map((h,i)=>[h,row[i] ?? '']));
    const symbol=String(mapped.symbol||'').replace(/\.US$/i,'').toUpperCase();
    const open=Number(mapped.open);
    const close=Number(mapped.close);
    const volume=Number(mapped.volume);
    const move=Number.isFinite(open)&&open>0&&Number.isFinite(close)?((close-open)/open*100):0;
    return {symbol, price: close, priceRaw: mapped.close, open, volume, move, mapped};
  });
}
function quoteFromStooq(ticker, parsed){
  const reason=rejectReason(ticker, parsed);
  if(reason) throw new Error(reason);
  return {ticker,name:displayName(ticker),sector:displaySector(ticker),price:parsed.price,move:Number(parsed.move.toFixed(2)),volume:Number.isFinite(parsed.volume)?parsed.volume:0,source:'stooq',sourceSymbol:parsed.mapped.symbol,quoteDate:parsed.mapped.date,quoteTime:parsed.mapped.time,status:'ok',valid:true};
}
function quoteFromYahoo(ticker, result){
  const meta=result?.meta||{};
  const quote=result?.indicators?.quote?.[0]||{};
  const closes=(quote.close||[]).filter(Number.isFinite);
  const opens=(quote.open||[]).filter(Number.isFinite);
  const volumes=(quote.volume||[]).filter(Number.isFinite);
  const price=Number(meta.regularMarketPrice ?? closes.at(-1));
  const open=Number(meta.regularMarketOpen ?? opens.at(-1));
  const previousClose=Number(meta.previousClose ?? closes.at(-2));
  const moveBase=Number.isFinite(open)&&open>0?open:previousClose;
  const move=Number.isFinite(moveBase)&&moveBase>0?((price-moveBase)/moveBase*100):0;
  const parsed={symbol:String(meta.symbol||ticker).toUpperCase(),price,priceRaw:meta.regularMarketPrice ?? closes.at(-1),open,volume:Number(meta.regularMarketVolume ?? volumes.at(-1) ?? 0),meta};
  const reason=rejectReason(ticker, parsed);
  if(reason) throw new Error(reason);
  return {ticker,name:displayName(ticker),sector:displaySector(ticker),price,move:Number(move.toFixed(2)),volume:Number.isFinite(parsed.volume)?parsed.volume:0,source:'yahoo-chart',sourceSymbol:parsed.symbol,quoteDate:meta.regularMarketTime?new Date(meta.regularMarketTime*1000).toISOString().slice(0,10):undefined,quoteTime:meta.regularMarketTime?new Date(meta.regularMarketTime*1000).toISOString().slice(11,19):undefined,status:'ok',valid:true};
}
function recordDiagnostic(ticker, entry){
  if(!DEBUG_TICKERS.has(ticker)) return;
  diagnostics[ticker]??=[];
  diagnostics[ticker].push({...entry, rawResponse: truncate(entry.rawResponse||''), parsedResponse: entry.parsedResponse ?? null, reasonForRejection: entry.reasonForRejection||''});
}
async function quotesFromStooqBatch(list){
  const byTicker={};
  for(const batch of chunks(list,BATCH_SIZE)){
    const stooqSymbols=batch.map(t=>`${t.toLowerCase()}.us`).join(',');
    const url=`https://stooq.com/q/l/?s=${encodeURIComponent(stooqSymbols)}&f=sd2t2ohlcv&h&e=csv`;
    let raw='';
    try{
      raw=await get(url);
      const parsedRows=parseStooqCsv(raw);
      const bySymbol=Object.fromEntries(parsedRows.map(row=>[row.symbol,row]));
      for(const ticker of batch){
        const parsed=bySymbol[ticker]||null;
        const reason=rejectReason(ticker, parsed);
        recordDiagnostic(ticker,{source:'stooq',requestedUrl:url,rawResponse:raw,parsedResponse:parsed?.mapped||parsed,reasonForRejection:reason});
        try{byTicker[ticker]=quoteFromStooq(ticker, parsed);}catch(e){byTicker[ticker]=invalidQuote(ticker,e,'stooq');}
      }
    }catch(e){
      for(const ticker of batch){
        recordDiagnostic(ticker,{source:'stooq',requestedUrl:url,rawResponse:raw||String(e.message||e),parsedResponse:null,reasonForRejection:String(e.message||e)});
        byTicker[ticker]=invalidQuote(ticker,e,'stooq');
      }
    }
  }
  return byTicker;
}
function summarizeYahooResult(result){
  if(!result) return null;
  const quote=result.indicators?.quote?.[0]||{};
  return {
    meta: result.meta||{},
    timestamps: (result.timestamp||[]).slice(-5),
    open: (quote.open||[]).slice(-5),
    close: (quote.close||[]).slice(-5),
    volume: (quote.volume||[]).slice(-5)
  };
}
async function yahooQuote(ticker){
  const url=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=5d&interval=1d&includePrePost=false`;
  const raw=await get(url);
  let result=null;
  try{
    const json=JSON.parse(raw);
    result=json?.chart?.result?.[0]||null;
    const quote=quoteFromYahoo(ticker, result);
    recordDiagnostic(ticker,{source:'yahoo-chart',requestedUrl:url,rawResponse:raw,parsedResponse:summarizeYahooResult(result),reasonForRejection:''});
    return quote;
  }catch(e){
    recordDiagnostic(ticker,{source:'yahoo-chart',requestedUrl:url,rawResponse:raw,parsedResponse:summarizeYahooResult(result),reasonForRejection:String(e.message||e)});
    throw e;
  }
}
async function quotesFor(list){
  const stooqQuotes=await quotesFromStooqBatch(list);
  const out=[];
  for(const batch of chunks(list,8)){
    const settled=await Promise.all(batch.map(async ticker=>{
      const first=stooqQuotes[ticker]||invalidQuote(ticker,'Not requested','stooq');
      if(first.valid) return first;
      try{return await yahooQuote(ticker);}catch(e){
        const url=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=5d&interval=1d&includePrePost=false`;
        recordDiagnostic(ticker,{source:'yahoo-chart',requestedUrl:url,rawResponse:String(e.message||e),parsedResponse:null,reasonForRejection:String(e.message||e)});
        return {...first,error:`${first.error}; yahoo-chart: ${String(e.message||e)}`};
      }
    }));
    out.push(...settled);
  }
  return out;
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
const payload={updatedAt:new Date().toISOString(),source:'stooq+yahoo-chart',universeSize:validQuotes.length,groups,sectorStrength,regime,bestSector:sectorStrength[0]||null,worstSector:sectorStrength.at(-1)||null,quotes,radar,news:news.slice(0,30),diagnostics};
await fs.mkdir('data',{recursive:true});
await fs.writeFile('data/market.json',JSON.stringify(payload,null,2));
console.log(JSON.stringify({updatedAt:payload.updatedAt,source:payload.source,universeSize:payload.universeSize,invalid:quotes.length-validQuotes.length,regime:payload.regime,bestSector:payload.bestSector,worstSector:payload.worstSector,diagnostics:payload.diagnostics,topRadar:payload.radar.slice(0,5)},null,2));
process.exit(0);
