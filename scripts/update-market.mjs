import https from 'node:https';
import fs from 'node:fs/promises';

const symbols = ['LITE','MRVL','TER','SNOW','CRWD','CIEN','KLAC','ONTO','COHR','NVDA','SOXX','SMH','QQQ','SPY','AMD','AVGO','MU','AMAT','LRCX','ASML','TSM','ANET','PANW','PLTR','DDOG','NET','NOW','CRM','MSFT','GOOGL','AMZN','META'];
const names = {LITE:'Lumentum',MRVL:'Marvell',TER:'Teradyne',SNOW:'Snowflake',CRWD:'CrowdStrike',NVDA:'Nvidia',SOXX:'Semiconductor ETF',SMH:'Semiconductor ETF',QQQ:'Nasdaq 100 ETF',SPY:'S&P 500 ETF'};
const sectors = {LITE:'Optical/AI',MRVL:'Semiconductors/AI',TER:'Semicap equipment',SNOW:'Software',CRWD:'Cybersecurity',NVDA:'AI chips',SOXX:'Semiconductors ETF',SMH:'Semiconductors ETF',QQQ:'Index',SPY:'Index'};

function get(url){return new Promise((resolve,reject)=>{https.get(url,{headers:{'user-agent':'Mozilla/5.0 LamborghiniV10'}},res=>{let data='';res.on('data',d=>data+=d);res.on('end',()=>resolve(data));}).on('error',reject);});}
async function quote(ticker){const sym=`${ticker.toLowerCase()}.us`;const url=`https://stooq.com/q/l/?s=${encodeURIComponent(sym)}&f=sd2t2ohlcv&h&e=csv`;const csv=await get(url);const line=csv.trim().split('\n')[1]||'';const c=line.split(',');const open=Number(c[3]);const close=Number(c[6]);const volume=Number(c[7]);const move=open&&close?((close-open)/open*100):0;if(!close||Number.isNaN(close))throw new Error('No quote');return {ticker,name:names[ticker]||ticker,sector:sectors[ticker]||'Market scan',price:close,move:Number(move.toFixed(2)),volume,source:'stooq'};}
function extract(tag,xml){const m=xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`,'i'));return m?m[1].replace(/<!\[CDATA\[|\]\]>/g,'').replace(/<[^>]+>/g,'').trim():'';}
function extractLink(xml){const m=xml.match(/<link>([\s\S]*?)<\/link>/i);return m?m[1].trim():'';}
async function newsFor(ticker){try{const xml=await get(`https://feeds.finance.yahoo.com/rss/2.0/headline?s=${ticker}&region=US&lang=en-US`);return xml.split('<item>').slice(1,4).map(item=>({ticker,title:extract('title',item),link:extractLink(item),source:'Yahoo RSS'})).filter(n=>n.title);}catch(e){return [];}}
function radarScore(q){let r=5;if(q.move>12)r=4.6;else if(q.move>6)r=6.1;else if(q.move>2)r=8.1;else if(q.move>0.8)r=6.9;else if(q.move<-4)r=3.8;else if(q.move<-2)r=4.4;if(q.volume>1000000)r+=0.2;return Math.max(1,Math.min(9.5,Number(r.toFixed(1))));}

const quotes=[];
for(const t of symbols){try{quotes.push(await quote(t));}catch(e){quotes.push({ticker:t,name:names[t]||t,sector:sectors[t]||'Market scan',price:0,move:0,error:e.message,source:'stooq'});}}
const radar=quotes.filter(q=>q.price>0).map(q=>({...q,score:radarScore(q),event:'market scan',note:q.move>12?'FOMO high':q.move>2?'momentum candidate':q.move<-2?'weak relative':'neutral'})).sort((a,b)=>b.score-a.score).slice(0,25);
let news=[];for(const t of ['LITE','MRVL','TER','NVDA','SOXX','SMH','QQQ']) news=news.concat(await newsFor(t));
const payload={updatedAt:new Date().toISOString(),source:'github-actions/stooq+yahoo-rss',universeSize:symbols.length,quotes,radar,news:news.slice(0,20)};
await fs.mkdir('data',{recursive:true});
await fs.writeFile('data/market.json',JSON.stringify(payload,null,2));
console.log(JSON.stringify({updatedAt:payload.updatedAt,universeSize:payload.universeSize,topRadar:payload.radar.slice(0,5)},null,2));
