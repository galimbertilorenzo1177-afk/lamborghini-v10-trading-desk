#!/usr/bin/env node

import https from 'node:https';
import fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const EXTRA_TICKERS = ['AMPG','FCEL','INCY','CHOR','FLNC'];
const DATA_PATH = 'data/market.json';

function get(url, timeout=16000){
  return new Promise((resolve,reject)=>{
    let done=false;
    const timer=setTimeout(()=>{ if(done)return; done=true; reject(new Error('network timeout')); },timeout);
    https.get(url,{headers:{'user-agent':'Mozilla/5.0 LamborghiniV16 portfolio patch'}},res=>{
      if(res.statusCode<200||res.statusCode>=300){ clearTimeout(timer); res.resume(); reject(new Error('HTTP '+res.statusCode)); return; }
      let data='';
      res.on('data',d=>data+=d);
      res.on('end',()=>{ if(done)return; done=true; clearTimeout(timer); resolve(data); });
    }).on('error',e=>{ if(done)return; done=true; clearTimeout(timer); reject(e); });
  });
}
function parseCsvLine(line){
  const out=[];let cur='',quoted=false;
  for(const ch of line){
    if(ch==='"'){quoted=!quoted;continue;}
    if(ch===','&&!quoted){out.push(cur);cur='';continue;}
    cur+=ch;
  }
  out.push(cur);return out;
}
function cleanNum(v){
  const n=Number(String(v??'').trim().replace(/,/g,''));
  return Number.isFinite(n)?n:NaN;
}
function nameFor(t){
  return ({AMPG:'Amplitech Group',FCEL:'FuelCell Energy',INCY:'Incyte',CHOR:'Chord Energy',FLNC:'Fluence Energy'})[t]||t;
}
function sectorFor(t){
  return ({AMPG:'Semiconductors/AI',FCEL:'Energy/clean tech',INCY:'Healthcare/biotech',CHOR:'Energy',FLNC:'Energy/clean tech'})[t]||'Portfolio manual';
}
async function fetchExtraQuotes(tickers){
  const query=tickers.map(t=>t.toLowerCase()+'.us').join(',');
  const url=`https://stooq.com/q/l/?s=${encodeURIComponent(query)}&f=sd2t2ohlcv&h&e=csv`;
  const csv=await get(url);
  const rows=csv.trim().split(/\r?\n/).filter(Boolean);
  if(rows.length<2)return [];
  const header=parseCsvLine(rows[0]).map(h=>String(h||'').trim().toLowerCase());
  const results=[];
  for(const line of rows.slice(1)){
    const row=parseCsvLine(line);
    const mapped=Object.fromEntries(header.map((h,i)=>[h,row[i]]));
    const ticker=String(mapped.symbol||'').replace(/\.US$/i,'').toUpperCase();
    if(!tickers.includes(ticker))continue;
    const close=cleanNum(mapped.close);
    const open=cleanNum(mapped.open);
    const volume=cleanNum(mapped.volume);
    if(!Number.isFinite(close)||close<=0)continue;
    const move=Number.isFinite(open)&&open>0?Number((((close-open)/open)*100).toFixed(2)):0;
    results.push({
      ticker,
      t:ticker,
      symbol:ticker,
      name:nameFor(ticker),
      sector:sectorFor(ticker),
      price:close,
      close,
      last:close,
      move,
      volume:Number.isFinite(volume)?volume:0,
      source:'stooq',
      sourceSymbol:mapped.symbol,
      quoteDate:mapped.date,
      quoteTime:mapped.time,
      status:'ok',
      valid:true,
      downloaded:true,
      event:'portfolio universe patch',
      note:'extra ticker needed by portfolio'
    });
  }
  return results;
}
function isValid(q){return q&&q.valid!==false&&Number(q.price||q.close||q.last)>0&&String(q.ticker||q.t||q.symbol||'').trim();}

const child=spawnSync(process.execPath,['scripts/update-market.mjs'],{stdio:'inherit',env:process.env});
if(child.status!==0){
  console.warn('Base update-market.mjs exited with status',child.status,'; portfolio patch will still try to preserve/publish existing market.json.');
}

let market;
try{
  market=JSON.parse(await fs.readFile(DATA_PATH,'utf8'));
}catch(e){
  console.error('Cannot read data/market.json after base refresh:',e);
  process.exit(child.status||1);
}

try{
  const extras=await fetchExtraQuotes(EXTRA_TICKERS);
  const byTicker=new Map((market.quotes||[]).map(q=>[String(q.ticker||q.t||q.symbol||'').toUpperCase(),q]));
  for(const q of extras)byTicker.set(q.ticker,q);
  market.quotes=Array.from(byTicker.values());

  const configured=new Set((market.configuredTickers||[]).map(t=>String(t).toUpperCase()));
  for(const t of EXTRA_TICKERS)configured.add(t);
  market.configuredTickers=Array.from(configured);
  market.configuredTickersCount=market.configuredTickers.length;

  const valid=market.quotes.filter(isValid);
  market.validQuotesCount=valid.length;
  market.universeSize=valid.length;
  market.invalidQuotesCount=Math.max(0,market.quotes.length-valid.length);

  market.refreshDiagnostics=Object.assign({},market.refreshDiagnostics||{}, {
    portfolioPatchTickers: EXTRA_TICKERS,
    portfolioPatchAcceptedTickers: extras.map(q=>q.ticker),
    validQuotes: valid.length,
    validatedCount: valid.length,
    acceptedCount: valid.length,
    acceptanceCount: valid.length,
    reason: '',
    rejectionReason: ''
  });

  await fs.writeFile(DATA_PATH,JSON.stringify(market,null,2));
  console.log(JSON.stringify({portfolioPatch:'ok',addedOrUpdated:extras.map(q=>q.ticker),validQuotesCount:market.validQuotesCount,configuredTickersCount:market.configuredTickersCount},null,2));
}catch(e){
  console.warn('Portfolio ticker patch failed:',e.message||e);
}

process.exit(0);
