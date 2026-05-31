import https from 'node:https';
import fs from 'node:fs/promises';

const MIN_VALID_QUOTES = 300;
const MOCK_QUOTES = process.env.MOCK_QUOTES === '1';
const refreshDiagnostics = {fetchStarted:new Date().toISOString(),source:'stooq',sourceReached:false,quotesDownloaded:0,marketJsonRewritten:false,newTimestampDetected:false,reason:''};

const groups = {
  semiconductors: ['NVDA','AMD','AVGO','MRVL','MU','ARM','TSM','QCOM','TXN','ADI','INTC','MPWR','NXPI','MCHP','ON','LSCC','SWKS','QRVO','GFS','WOLF','ALAB','SMTC','RMBS','CRUS','DIOD','POWI','SLAB','FORM','PI','SYNA','SIMO','CAMT','VECO','COHR','LITE'],
  semiconductor_equipment: ['ASML','AMAT','LRCX','KLAC','TER','ONTO','ACLS','AEIS','AMKR','ENTG','MKSI','UCTT','ICHR','NVMI','KLIC','COHU','BRKR','VNT','KEYS','FLEX','SANM','JBL'],
  cybersecurity: ['CRWD','PANW','ZS','FTNT','OKTA','CYBR','S','TENB','VRNS','CHKP','QLYS','RPD','GEN','NET','DDOG'],
  software: ['MSFT','GOOGL','AMZN','META','SNOW','MDB','NOW','CRM','ORCL','ADBE','TEAM','SHOP','UBER','MELI','PLTR','APP','HUBS','INTU','ADP','WDAY','ADSK','ANSS','CDNS','SNPS','ROP','PAYC','PCTY','DOCU','PATH','BILL','ESTC','GTLB','MNDY','DT','TWLO','FSLY','ZI','TTD','TOST','SQ','PYPL','AFRM','ROKU','SPOT','NFLX'],
  defense: ['RTX','LMT','NOC','GD','BA','HII','LHX','TXT','TDG','HEI','KTOS','LDOS','CACI','SAIC','BWXT','SPR','AXON','WWD','CW','MRCY'],
  financials: ['JPM','BAC','WFC','C','GS','MS','V','MA','AXP','BLK','SCHW','COIN','HOOD','CME','ICE','SPGI','MCO','AON','MMC','CB','TRV','PGR','AIG','MET','PRU','ALL','USB','PNC','TFC','BK','STT','DFS','SYF','ALLY','KKR','BX','APO','ARES','OWL','RJF'],
  healthcare: ['LLY','NVO','JNJ','MRK','PFE','ABBV','AMGN','REGN','VRTX','ISRG','UNH','TMO','DHR','SYK','MDT','BSX','ABT','BMY','GILD','BIIB','ZTS','ELV','HUM','CI','CVS','MCK','COR','CAH','GEHC','DXCM','IDXX','EW','RMD','ALGN','ILMN','HOLX','A','IQV','WAT','TECH'],
  consumer: ['WMT','COST','HD','LOW','TGT','DLTR','DG','MCD','SBUX','CMG','NKE','LULU','TJX','ROST','AMZN','TSLA','BKNG','ABNB','MAR','HLT','RCL','CCL','NCLH','DIS','CMCSA','PEP','KO','MNST','KDP','PG','CL','KMB','EL','COTY','YUM','DPZ','DRI','WING','SHAK','CAVA','WEN','TAP','STZ','BUD','KHC','GIS','K','CPB','SJM','HSY','MDLZ','KR','SYY'],
  broad_market: ['AAPL','IBM','CSCO','ANET','DELL','HPE','HPQ','NTAP','STX','WDC','GLW','TEL','APH','GRMN','MSI','TRMB','ZBRA','FICO','FTNT','AKAM','JNPR','VRSN','GDDY','MANH','TYL','DAY','LYFT','DASH','EBAY','ETSY','CHWY','W','CVNA','CAR','AZO','ORLY','GPC','AAP','KMX','TSCO','BBY','FIVE','BURL','OLLI','M','KSS','JWN','GPS','ANF','URBN','AEO','RL','TPR','CPRI','PVH','VFC','WYNN','LVS','MGM','CZR','PENN','DKNG','H','HST','EXPE','TRIP','MTCH','BMBL'],
  industrials: ['GE','GEV','ETN','PH','EMR','ROK','CAT','DE','HON','URI','HUBB','MMM','ITW','CMI','PCAR','FAST','GWW','WAB','OTIS','CARR','JCI','IR','XYL','DOV','FTV','IEX','PNR','AOS','AME','GNRC','NDSN','LECO','SWK','MAS','BLDR','TREX','OC','FBIN','ALLE','AER','DAL','UAL','AAL','LUV','ALK','FDX','UPS','CHRW','XPO','ODFL','JBHT','KNX','R','NSC','CSX','UNP'],
  energy_materials: ['XOM','CVX','COP','SLB','HAL','OXY','EOG','LNG','FSLR','ENPH','MPC','PSX','VLO','HES','DVN','FANG','PXD','BKR','WMB','KMI','OKE','TRGP','NEE','CEG','D','SO','DUK','AEP','EXC','SRE','PCG','PEG','XEL','ED','AWK','LIN','APD','SHW','ECL','FCX','NEM','NUE','STLD','CLF','X','AA','DD','DOW','PPG','ALB','MOS','CF','CTVA','IP','PKG','AVY'],
  real_estate: ['PLD','AMT','EQIX','CCI','PSA','O','WELL','VICI','SPG','DLR','EXR','AVB','EQR','INVH','ARE','VTR','ESS','MAA','UDR','CPT','KIM','REG','FRT','BXP','SLG'],
  etfs: ['SOXX','SMH','QQQ','SPY','IWM','DIA','XLK','XLY','XLF','XLE','XLV','XLI','XLP','XLU','XLC','ARKK','RSP','VTI','IWF','IWD','IWO','IWN','MDY','IJH','IJR','IYT','IYR','XBI','IBB','KRE','KBE','XRT','ITB','XHB','TAN','URA','BOTZ','HACK','CIBR','IGV','SKYY','FDN','VOO']
};

const symbols = [...new Set(Object.values(groups).flat())].filter(isRealTicker);
const sectorByTicker = {};
for (const [sector, list] of Object.entries(groups)) for (const t of list) if (!sectorByTicker[t]) sectorByTicker[t] = sector;

const names = {
  LITE:'Lumentum Holdings Inc',MRVL:'Marvell Technology Inc',TER:'Teradyne',SNOW:'Snowflake',CRWD:'CrowdStrike',NVDA:'Nvidia',AMD:'Advanced Micro Devices',AVGO:'Broadcom',MU:'Micron Technology',ARM:'Arm Holdings',TSM:'Taiwan Semiconductor',ASML:'ASML Holding',AMAT:'Applied Materials',LRCX:'Lam Research',KLAC:'KLA Corp',ONTO:'Onto Innovation',PANW:'Palo Alto Networks',ZS:'Zscaler',FTNT:'Fortinet',OKTA:'Okta',CYBR:'CyberArk',MSFT:'Microsoft',GOOGL:'Alphabet',AMZN:'Amazon',META:'Meta Platforms',SOXX:'Semiconductor ETF',SMH:'Semiconductor ETF',QQQ:'Nasdaq 100 ETF',SPY:'S&P 500 ETF'
};

function isRealTicker(t){return /^[A-Z][A-Z0-9.]{0,5}$/.test(String(t||'').toUpperCase())&&!/^V\d+$/i.test(String(t||''));}
function get(url, timeout=12000){return new Promise((resolve,reject)=>{const req=https.get(url,{headers:{'user-agent':'Mozilla/5.0 LamborghiniV11'},timeout},res=>{refreshDiagnostics.sourceReached=true;let data='';res.on('data',d=>data+=d);res.on('end',()=>resolve(data));});req.on('error',reject);req.on('timeout',()=>req.destroy(new Error('network timeout')));});}
function parseCsvLine(line){const out=[];let cur='',quoted=false;for(const ch of line){if(ch==='"'){quoted=!quoted;continue;}if(ch===','&&!quoted){out.push(cur);cur='';continue;}cur+=ch;}out.push(cur);return out;}
function quoteName(ticker){return names[ticker]||ticker;}
function invalidQuote(ticker, error){return {ticker,name:quoteName(ticker),sector:sectorByTicker[ticker]||'Market scan',price:0,move:0,volume:0,source:'stooq',status:'invalid',valid:false,error:String(error&&error.message||error||'No valid quote')};}
function mapQuote(mapped, expectedTicker){
  const symbol=String(mapped.symbol||'').replace(/\.US$/i,'').toUpperCase();
  const open=Number(mapped.open);
  const close=Number(mapped.close);
  const volume=Number(mapped.volume);
  if(symbol!==expectedTicker) throw new Error(`Ticker mismatch: expected ${expectedTicker}, got ${symbol||'empty'}`);
  if(!Number.isFinite(close)||close<=0) throw new Error('Invalid close price');
  const move=Number.isFinite(open)&&open>0?((close-open)/open*100):0;
  return {ticker:expectedTicker,name:quoteName(expectedTicker),sector:sectorByTicker[expectedTicker]||'Market scan',price:close,move:Number(move.toFixed(2)),volume:Number.isFinite(volume)?volume:0,source:'stooq',sourceSymbol:mapped.symbol,quoteDate:mapped.date,quoteTime:mapped.time,status:'ok',valid:true};
}
async function quoteBatch(batch){
  if (MOCK_QUOTES) { refreshDiagnostics.sourceReached=true; return batch.map((ticker, i) => ({ticker,name:quoteName(ticker),sector:sectorByTicker[ticker]||'Market scan',price:Number((50+(i%25)*3+(ticker.charCodeAt(0)%17)).toFixed(2)),move:Number((((ticker.charCodeAt(0)+ticker.length)%9)-4).toFixed(2)),volume:1000000+i,source:'stooq-mock',sourceSymbol:`${ticker}.US`,quoteDate:'2026-05-31',quoteTime:'00:00:00',status:'ok',valid:true})); }
  const query=batch.map(t=>`${t.toLowerCase()}.us`).join(',');
  const url=`https://stooq.com/q/l/?s=${encodeURIComponent(query)}&f=sd2t2ohlcv&h&e=csv`;
  const csv=await get(url);
  const rows=csv.trim().split(/\r?\n/).filter(Boolean);
  if(rows.length<2) throw new Error('No CSV data');
  const header=parseCsvLine(rows[0]).map(x=>x.toLowerCase());
  const out=new Map();
  for(const line of rows.slice(1)){
    const row=parseCsvLine(line);
    const mapped=Object.fromEntries(header.map((h,i)=>[h,row[i]]));
    const symbol=String(mapped.symbol||'').replace(/\.US$/i,'').toUpperCase();
    if(!batch.includes(symbol)) continue;
    try { out.set(symbol, mapQuote(mapped, symbol)); } catch(e) { out.set(symbol, invalidQuote(symbol, e)); }
  }
  return batch.map(t=>out.get(t)||invalidQuote(t,'No CSV row returned'));
}
async function quoteSingle(ticker){return (await quoteBatch([ticker]))[0];}
async function quoteBatchSafe(batch){
  for (let attempt=0; attempt<2; attempt++) {
    try { return await quoteBatch(batch); } catch(e) { if(attempt===1 && batch.length===1) return [invalidQuote(batch[0], e)]; }
  }
  return Promise.all(batch.map(t=>quoteSingle(t).catch(e=>invalidQuote(t,e))));
}
async function quotesFor(list){
  const chunks=[];
  for (let i=0;i<list.length;i+=25) chunks.push(list.slice(i,i+25));
  const results=[];
  const concurrency=4;
  let next=0;
  async function worker(){
    while(next<chunks.length){
      const idx=next++;
      const batchQuotes=await quoteBatchSafe(chunks[idx]);
      results[idx]=batchQuotes;
    }
  }
  await Promise.all(Array.from({length:concurrency}, worker));
  return results.flat();
}
function radarScore(q){let r=5;if(q.move>12)r=4.4;else if(q.move>6)r=6.1;else if(q.move>2)r=8.1;else if(q.move>0.8)r=6.9;else if(q.move<-4)r=3.8;else if(q.move<-2)r=4.4;if(q.volume>1000000)r+=0.2;return Math.max(1,Math.min(9.5,Number(r.toFixed(1))));}
function quoteMapByTicker(quotes){return new Map(quotes.map(q=>[q.ticker,q]));}
function sectorCountsFor(quotes){
  const byTicker=quoteMapByTicker(quotes);
  return Object.entries(groups).map(([sector,list])=>{
    let valid=0,failed=0;
    for (const ticker of list) {
      const q=byTicker.get(ticker);
      if(q&&q.valid&&q.price>0) valid++; else failed++;
    }
    return {sector,configured:list.length,valid,failed};
  }).sort((a,b)=>b.valid-a.valid||b.configured-a.configured);
}
function sectorRanking(quotes){const byTicker=quoteMapByTicker(quotes);return sectorCountsFor(quotes).filter(x=>x.valid>0).map(x=>{const qs=(groups[x.sector]||[]).map(t=>byTicker.get(t)).filter(q=>q&&q.valid&&q.price>0);const avg=qs.reduce((s,q)=>s+q.move,0)/Math.max(1,qs.length);const leaders=qs.filter(q=>q.move>.8).length,weak=qs.filter(q=>q.move<-1).length;return {...x,count:x.valid,avgMove:Number(avg.toFixed(2)),leaders,weak,score:Number((50+avg*8+leaders*2-weak*2).toFixed(1))};}).sort((a,b)=>b.score-a.score);}
function regimeFrom(quotes, sectorStrength){const priced=quotes.filter(q=>q.valid&&q.price>0),adv=priced.filter(q=>q.move>0).length,leaders=priced.filter(q=>q.move>.8).length,weak=priced.filter(q=>q.move<-1).length,breadth=priced.length?adv/priced.length:0,spread=sectorStrength.length>1?sectorStrength[0].avgMove-sectorStrength.at(-1).avgMove:0;let label='selettivo';if(breadth>.58&&leaders>weak*1.2)label='risk-on';else if(breadth<.42&&weak>leaders)label='risk-off';else if(spread>3)label='rotazione settoriale';return {label,score:Number((breadth*100).toFixed(1)),breadth:Number((breadth*100).toFixed(1)),leaders,weak,priced:priced.length};}

const quotes = await quotesFor(symbols);
const validQuotes=quotes.filter(q=>q.valid&&q.price>0);
const failedQuotes=quotes.filter(q=>!q.valid||!q.price).map(q=>({ticker:q.ticker,sector:q.sector,error:q.error||'invalid quote'}));
const radar=validQuotes.map(q=>({...q,score:radarScore(q),event:'market scan',note:q.move>12?'FOMO high':q.move>2?'momentum candidate':q.move<-2?'weak relative':'neutral'})).sort((a,b)=>b.score-a.score).slice(0,160);
const sectorCounts=sectorCountsFor(quotes);
const sectorStrength=sectorRanking(quotes);
const regime=regimeFrom(quotes, sectorStrength);
refreshDiagnostics.quotesDownloaded=validQuotes.length;
const payload={updatedAt:new Date().toISOString(),source:'stooq',refreshDiagnostics,minimumValidQuotes:MIN_VALID_QUOTES,quoteDownloadSuccess:validQuotes.length>=MIN_VALID_QUOTES,quoteDownloadStatus:validQuotes.length>=MIN_VALID_QUOTES?'success':`below minimum ${validQuotes.length}/${MIN_VALID_QUOTES}`,validQuotesCount:validQuotes.length,invalidQuotesCount:quotes.length-validQuotes.length,configuredTickers:symbols,configuredTickersCount:symbols.length,failedQuotes,firstSuccessfulTickers:validQuotes.slice(0,10).map(q=>q.ticker),universeSize:validQuotes.length,groups,sectorCounts,sectorStrength,regime,bestSector:sectorStrength[0]||null,worstSector:sectorStrength.at(-1)||null,quotes,radar,news:[]};
await fs.mkdir('data',{recursive:true});
let existingUpdatedAt='';
if (validQuotes.length < MIN_VALID_QUOTES && !MOCK_QUOTES) {
  let existing=null;
  try { existing=JSON.parse(await fs.readFile('data/market.json','utf8')); } catch {}
  existingUpdatedAt=existing&&(existing.updatedAt||existing.lastUpdated||existing.timestamp||existing.generatedAt||'')||'';
  if (existing&&Number(existing.validQuotesCount||existing.universeSize||0) >= MIN_VALID_QUOTES) {
    refreshDiagnostics.marketJsonRewritten=true;
    refreshDiagnostics.newTimestampDetected=false;
    refreshDiagnostics.reason=`below minimum ${validQuotes.length}/${MIN_VALID_QUOTES}; preserving existing snapshot with ${existing.validQuotesCount||existing.universeSize}`;
    const preserved={...existing,refreshDiagnostics,lastRefreshAttemptAt:payload.updatedAt,lastRefreshAttemptStatus:payload.quoteDownloadStatus,lastRefreshAttemptSuccess:false,staleSnapshot:true};
    await fs.writeFile('data/market.json',JSON.stringify(preserved,null,2));
    console.error(`Preserving existing data/market.json: refresh returned ${validQuotes.length}/${MIN_VALID_QUOTES} valid quotes; existing snapshot has ${existing.validQuotesCount||existing.universeSize}.`);
    console.log(JSON.stringify({refreshStatus:refreshDiagnostics,updatedAt:preserved.updatedAt,lastRefreshAttemptAt:preserved.lastRefreshAttemptAt,source:preserved.source,configured:payload.configuredTickersCount,universeSize:preserved.universeSize,invalid:payload.invalidQuotesCount,minimum:MIN_VALID_QUOTES,status:payload.quoteDownloadStatus,preservedSnapshot:true},null,2));
    process.exit(0);
  }
} else {
  try { const existing=JSON.parse(await fs.readFile('data/market.json','utf8')); existingUpdatedAt=existing.updatedAt||existing.lastUpdated||existing.timestamp||existing.generatedAt||''; } catch {}
}
refreshDiagnostics.newTimestampDetected=!existingUpdatedAt||payload.updatedAt!==existingUpdatedAt;
payload.refreshDiagnostics=refreshDiagnostics;
try {
  refreshDiagnostics.marketJsonRewritten=true;
  refreshDiagnostics.reason=validQuotes.length>=MIN_VALID_QUOTES?'':'below minimum valid quotes';
  payload.refreshDiagnostics=refreshDiagnostics;
  await fs.writeFile('data/market.json',JSON.stringify(payload,null,2));
} catch(e) {
  refreshDiagnostics.marketJsonRewritten=false;
  refreshDiagnostics.reason=e&&e.code==='EACCES'?'write permission denied':String(e&&e.message||e||'market.json write failed');
  console.error(`market.json rewrite failed: ${refreshDiagnostics.reason}`);
  console.log(JSON.stringify({refreshStatus:refreshDiagnostics,updatedAt:payload.updatedAt,source:payload.source,configured:payload.configuredTickersCount,universeSize:payload.universeSize,invalid:payload.invalidQuotesCount,minimum:MIN_VALID_QUOTES,status:payload.quoteDownloadStatus},null,2));
  process.exit(1);
}
console.log(JSON.stringify({refreshStatus:refreshDiagnostics,updatedAt:payload.updatedAt,source:payload.source,configured:payload.configuredTickersCount,universeSize:payload.universeSize,invalid:payload.invalidQuotesCount,minimum:MIN_VALID_QUOTES,status:payload.quoteDownloadStatus,regime:payload.regime,bestSector:payload.bestSector,worstSector:payload.worstSector,topRadar:payload.radar.slice(0,5)},null,2));
process.exit(validQuotes.length >= MIN_VALID_QUOTES ? 0 : 1);
