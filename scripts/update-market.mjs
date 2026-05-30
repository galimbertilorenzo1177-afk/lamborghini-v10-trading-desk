import https from 'node:https';
import fs from 'node:fs/promises';

const symbols = ['LITE','MRVL','TER','SNOW','CRWD','CIEN','KLAC','ONTO','COHR','NVDA','SOXX'];
const stooqMap = Object.fromEntries(symbols.map(s => [s, `${s.toLowerCase()}.us`]));
stooqMap.SOXX = 'soxx.us';

function get(url){
  return new Promise((resolve,reject)=>{
    https.get(url,{headers:{'user-agent':'Mozilla/5.0 LamborghiniV10'}},res=>{
      let data='';
      res.on('data',d=>data+=d);
      res.on('end',()=>resolve(data));
    }).on('error',reject);
  });
}

async function quote(ticker){
  const s = stooqMap[ticker] || `${ticker.toLowerCase()}.us`;
  const url = `https://stooq.com/q/l/?s=${encodeURIComponent(s)}&f=sd2t2ohlcv&h&e=csv`;
  const csv = await get(url);
  const line = csv.trim().split('\n')[1] || '';
  const c = line.split(',');
  const open = Number(c[3]);
  const close = Number(c[6]);
  const volume = Number(c[7]);
  const move = open && close ? ((close-open)/open*100) : 0;
  if(!close || Number.isNaN(close)) throw new Error(`No quote for ${ticker}`);
  return {ticker, price: close, move: Number(move.toFixed(2)), volume, source:'stooq'};
}

function extract(tag, xml){
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g,'').replace(/<[^>]+>/g,'').trim() : '';
}
function extractLink(xml){
  const m = xml.match(/<link>([\s\S]*?)<\/link>/i);
  return m ? m[1].trim() : '';
}
async function newsFor(ticker){
  try{
    const xml = await get(`https://feeds.finance.yahoo.com/rss/2.0/headline?s=${ticker}&region=US&lang=en-US`);
    return xml.split('<item>').slice(1,4).map(item=>({ticker,title:extract('title',item),link:extractLink(item),source:'Yahoo RSS'})).filter(n=>n.title);
  }catch(e){ return []; }
}

const quotes=[];
for(const t of symbols){
  try{ quotes.push(await quote(t)); }
  catch(e){ quotes.push({ticker:t, price:0, move:0, error:e.message, source:'stooq'}); }
}
let news=[];
for(const t of ['LITE','MRVL','TER','NVDA','SOXX']) news = news.concat(await newsFor(t));

const payload = {
  updatedAt: new Date().toISOString(),
  source: 'github-actions/stooq+yahoo-rss',
  quotes,
  news: news.slice(0,15)
};

await fs.mkdir('data',{recursive:true});
await fs.writeFile('data/market.json', JSON.stringify(payload,null,2));
console.log(JSON.stringify(payload,null,2));
