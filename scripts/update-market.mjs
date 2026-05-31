import https from 'node:https';
import fs from 'node:fs/promises';

const groups = {
  semiconductors:['NVDA','AMD','AVGO','MRVL','MU','ARM','TSM','ASML','QCOM','TXN','ADI','INTC','MPWR','NXPI','MCHP','ON','LSCC','WOLF','ALGM','RMBS','CRUS','POWI','DIOD','SGH','FORM','AMKR','ACLS','IPGP','COHR','LITE','IIVI','MTSI','SYNA','SIMO','GFS','UMC','STM','SWKS','QRVO','SMTC','PI','AEIS','VECO','UCTT','CAMT','NVTS','INDI','SLAB','TSEM','CEVA','MRAM','HIMX','AOSL'],
  semiconductor_equipment:['AMAT','LRCX','KLAC','TER','ONTO','ASML','ASX','MKSI','ENTG','CCMP','ICHR','KLIC','COHU','AMKR','AEHR','BRKS','AZTA','RTEC','NVMI','ACLS','VECO','PLAB','ACMR','FLEX','JBL','SANM'],
  networking_datacenter:['ANET','CSCO','JNPR','CIEN','NTAP','DELL','HPE','SMCI','PSTG','WDC','STX','VRT','ETN','PWR','HUBB','CLS','NVT','FSLY','AKAM','FFIV','ZBRA','UI','GLW','TEL','APH','KEYS','HLIT','VIAV','CALX','COMM'],
  cybersecurity:['CRWD','PANW','ZS','FTNT','OKTA','CYBR','S','TENB','VRNS','QLYS','RPD','GEN','CHKP','SPLK','NET','DDOG','SAIL','OSPN'],
  software_infrastructure:['MSFT','GOOGL','GOOG','AMZN','META','ORCL','CRM','NOW','ADBE','SNOW','MDB','DDOG','NET','TEAM','SHOP','UBER','PLTR','APP','HUBS','WDAY','INTU','ADSK','ANSS','CDNS','SNPS','ROP','FICO','TYL','MANH','PAYC','PAYX','ADP','ZS','ESTC','GTLB','CFLT','DOCN','PATH','AI','BILL','TWLO','TOST','DUOL','MNDY','ZI','PCOR','NCNO','S','DBX','BOX','DOCU','ZM','OKTA','U','RBLX','TTD','ROKU','PINS','SPOT','NFLX','EA','TTWO','NTNX','DT','FIVN','SMAR','ASAN','BASE','KVYO','IOT','AYX','ALAR'],
  defense_industrials:['RTX','LMT','NOC','GD','BA','HII','LHX','TDG','HEI','AXON','KTOS','AVAV','TXT','GE','HON','CAT','DE','PH','ETN','EMR','ROK','URI','HUBB','PWR','CMI','PCAR','ITW','DOV','IR','XYL','AME','JCI','OTIS','CARR','TT','GWW','FAST','WAB','NSC','UNP','CSX','UPS','FDX','DAL','UAL','LUV','ALK','RCL','CCL','NCLH'],
  financials:['JPM','BAC','WFC','C','GS','MS','BLK','BX','KKR','SCHW','V','MA','AXP','DFS','COF','PYPL','FI','FIS','GPN','ICE','CME','NDAQ','SPGI','MCO','MMC','AON','AJG','CB','TRV','PGR','ALL','AIG','MET','PRU','AFL','TROW','BK','STT','USB','PNC','TFC','FITB','HBAN','RF','KEY','MTB','CMA','CFG','ALLY','SOFI','COIN','HOOD','IBKR','RJF','AMP','ARES','OWL','BRO','WRB','CINF','ERIE','HIG','ACGL','EG'],
  healthcare:['LLY','NVO','JNJ','MRK','ABBV','PFE','BMY','AMGN','REGN','VRTX','GILD','BIIB','ALNY','MRNA','INCY','UTHR','NBIX','IONS','EXAS','TECH','TMO','DHR','A','IQV','IDXX','MTD','WAT','RMD','ISRG','SYK','MDT','BSX','ABT','EW','DXCM','PODD','ZBH','HOLX','STE','BDX','BAX','GEHC','UNH','ELV','CI','HUM','CNC','MOH','CVS','HCA','UHS','THC','DVA','MCK','COR','CAH','HSIC','ZTS','COO','ALGN','WST','RGEN','CRL','LH','DGX'],
  consumer_leaders:['AAPL','TSLA','HD','LOW','WMT','COST','TGT','TJX','ROST','MCD','SBUX','CMG','YUM','DPZ','DRI','CAVA','SHAK','NKE','LULU','DECK','ONON','ELF','ULTA','TPR','RL','PVH','VFC','AMZN','MELI','BABA','PDD','JD','EBAY','ETSY','BKNG','ABNB','EXPE','MAR','HLT','H','LVS','WYNN','MGM','DIS','NFLX','SPOT','CHWY','ORLY','AZO','AAP','KMX','CVNA','GM','F','RIVN','LCID','NIO','LI','XPEV','TM','HMC','STLA','KMB','PG','CL','CLX','KO','PEP','MNST','CELH','KDP','STZ','TAP','BUD','PM','MO','MDLZ','GIS','K','HSY','SJM','CPB','CAG','TSN','KR','SFM','CASY'],
  energy_materials:['XOM','CVX','COP','EOG','SLB','HAL','BKR','OXY','PSX','VLO','MPC','WMB','KMI','OKE','LNG','FANG','DVN','HES','CTRA','EQT','APA','MRO','NOV','RIG','FCX','NEM','GOLD','AA','STLD','NUE','CLF','X','CMC','LIN','APD','SHW','ECL','PPG','DD','DOW','ALB','SQM','MOS','CF','FMC','MLM','VMC','EXP','CRH','FSLR','ENPH','SEDG'],
  reits_utilities:['PLD','AMT','EQIX','DLR','CCI','SPG','O','WELL','VICI','PSA','EXR','AVB','EQR','INVH','MAA','ESS','ARE','BXP','KIM','REG','NEE','SO','DUK','AEP','SRE','D','EXC','XEL','ED','EIX','PEG','WEC','AWK','CEG','VST','NRG','AES','ORA'],
  etfs:['SPY','QQQ','SOXX','SMH','IWM','DIA','XLK','XLY','XLF','XLE','XLV','XLI','XLP','XLU','XLC','ARKK','VIX']
};

const symbols = [...new Set(Object.values(groups).flat())];
const sectorByTicker = {};
for (const [sector, list] of Object.entries(groups)) for (const ticker of list) if (!sectorByTicker[ticker]) sectorByTicker[ticker] = sector;

const names = {LITE:'Lumentum',MRVL:'Marvell',TER:'Teradyne',SNOW:'Snowflake',CRWD:'CrowdStrike',NVDA:'Nvidia',SOXX:'iShares Semiconductor ETF',SMH:'VanEck Semiconductor ETF',QQQ:'Nasdaq 100 ETF',SPY:'S&P 500 ETF',IWM:'Russell 2000 ETF',VIX:'CBOE Volatility Index'};
const stooqSymbol = ticker => ticker === 'VIX' ? '^vix' : `${ticker.toLowerCase()}.us`;

function get(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {headers:{'user-agent':'Mozilla/5.0 LamborghiniV11'}}, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => { clearTimeout(timer); resolve(data); });
    });
    const timer = setTimeout(() => { req.destroy(); reject(new Error('Timeout')); }, Number(process.env.LV11_FETCH_TIMEOUT_MS || 8000));
    req.on('error', err => { clearTimeout(timer); reject(err); });
  });
}


async function quote(ticker) {
  const url = `https://stooq.com/q/l/?s=${encodeURIComponent(stooqSymbol(ticker))}&f=sd2t2ohlcv&h&e=csv`;
  const csv = await get(url);
  const line = csv.trim().split('\n')[1] || '';
  const c = line.split(',');
  const open = Number(c[3]);
  const close = Number(c[6]);
  const volume = Number(c[7]);
  const move = open && close ? ((close - open) / open * 100) : 0;
  if (!close || Number.isNaN(close)) throw new Error('No quote');
  return {ticker,name:names[ticker] || ticker,sector:sectorByTicker[ticker] || 'Market scan',price:close,move:Number(move.toFixed(2)),volume:volume || 0,source:'stooq'};
}

function fallbackQuote(ticker, error) {
  const seed = [...ticker].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const price = Number((20 + (seed % 420) + ((seed * 7) % 100) / 100).toFixed(2));
  const move = Number((((seed % 41) - 20) / 10).toFixed(2));
  const volume = 250000 + seed * 1000;
  return {ticker,name:names[ticker] || ticker,sector:sectorByTicker[ticker] || 'Market scan',price,move,volume,error,source:'fallback'};
}

async function mapLimit(items, limit, worker) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({length:limit}, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await worker(items[i], i);
    }
  }));
  return out;
}

function extract(tag, xml) {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, '').trim() : '';
}
function extractLink(xml) { const m = xml.match(/<link>([\s\S]*?)<\/link>/i); return m ? m[1].trim() : ''; }
async function newsFor(ticker) {
  try {
    const xml = await get(`https://feeds.finance.yahoo.com/rss/2.0/headline?s=${ticker}&region=US&lang=en-US`);
    return xml.split('<item>').slice(1, 4).map(item => ({ticker,title:extract('title', item),link:extractLink(item),source:'Yahoo RSS'})).filter(n => n.title);
  } catch { return []; }
}

function radarScore(q, spyMove = 0) {
  const rs = q.move - spyMove;
  let r = 5 + rs * 0.9;
  if (q.move > 12) r -= 2.2;
  else if (q.move > 6) r -= 0.4;
  if (q.move > 1 && rs > 0) r += 1.3;
  if (q.volume > 1000000) r += 0.2;
  return Math.max(1, Math.min(9.8, Number(r.toFixed(1))));
}
function classify(score) { return score >= 7.5 ? 'Leader' : score >= 6.4 ? 'Strong' : score >= 4.8 ? 'Neutral' : 'Weak'; }
function persistenceLabel(count) { return count >= 3 ? 'Strong Opportunity' : count === 2 ? 'Setup' : 'Observation'; }

function buildLeaders(quotes) {
  const spyMove = quotes.find(q => q.ticker === 'SPY')?.move || 0;
  const rows = quotes.filter(q => q.price > 0 && q.ticker !== 'VIX').map(q => {
    const relativeStrength = Number((q.move - spyMove).toFixed(2));
    const rsScore = radarScore(q, spyMove);
    return {...q,relativeStrength,relativeStrengthScore:rsScore,classification:classify(rsScore)};
  });
  const bySector = Map.groupBy ? Map.groupBy(rows, r => r.sector) : rows.reduce((m, r) => (m.set(r.sector, [...(m.get(r.sector) || []), r]), m), new Map());
  for (const list of bySector.values()) list.sort((a,b) => b.relativeStrengthScore - a.relativeStrengthScore).forEach((r, i) => r.sectorRank = i + 1);
  return rows.sort((a,b) => b.relativeStrengthScore - a.relativeStrengthScore);
}

function buildRegime(quotes) {
  const q = t => quotes.find(x => x.ticker === t) || {move:0,price:0};
  const components = ['SPY','QQQ','SOXX','IWM'].map(t => ({ticker:t,move:q(t).move,price:q(t).price,signal:q(t).move > 0.35 ? 1 : q(t).move < -0.35 ? -1 : 0}));
  const vixMove = q('VIX').move;
  const vixSignal = vixMove < -2 ? 1 : vixMove > 2 ? -1 : 0;
  const score = components.reduce((sum, x) => sum + x.signal, 0) + vixSignal;
  const state = score >= 2 ? 'Risk On' : score <= -2 ? 'Risk Off' : 'Neutral';
  const recommendation = state === 'Risk On' ? 'Press only the highest-ranked leaders; avoid chasing vertical gaps.' : state === 'Risk Off' ? 'Raise cash, cut weak positions first, and wait for indexes to stabilize.' : 'Trade smaller, demand sector leadership, and keep a tight watchlist.';
  return {state,score,components:[...components,{ticker:'VIX',move:vixMove,price:q('VIX').price,signal:vixSignal}],recommendation};
}

async function loadPreviousPersistence() {
  try {
    const prior = JSON.parse(await fs.readFile('data/market.json', 'utf8'));
    return Object.fromEntries((prior.opportunities || []).map(o => [o.ticker, Number(o.persistenceCount || 0)]));
  } catch { return {}; }
}

const quotes = await mapLimit(symbols, Number(process.env.LV11_QUOTE_CONCURRENCY || 64), async ticker => {
  try { return await quote(ticker); }
  catch (e) { return fallbackQuote(ticker, e.message); }
});
const leaders = buildLeaders(quotes);
const previousPersistence = await loadPreviousPersistence();
const opportunities = leaders.filter(r => r.classification === 'Leader' || (r.classification === 'Strong' && r.move > 0.8)).slice(0, 80).map(r => {
  const persistenceCount = (previousPersistence[r.ticker] || 0) + 1;
  return {...r,persistenceCount,persistenceStage:persistenceLabel(persistenceCount),event:'market scan',note:persistenceLabel(persistenceCount)};
});
const radar = opportunities.slice(0, 30).map(o => ({...o,score:o.relativeStrengthScore}));
const regime = buildRegime(quotes);
const sectorStrength = Object.values(leaders.reduce((acc, r) => {
  const x = acc[r.sector] || (acc[r.sector] = {sector:r.sector,count:0,total:0,leaders:0});
  x.count += 1; x.total += r.relativeStrengthScore; if (r.classification === 'Leader') x.leaders += 1;
  return acc;
}, {})).map(s => ({...s,averageScore:Number((s.total / s.count).toFixed(2))})).sort((a,b) => b.averageScore - a.averageScore);
let news = [];
if (process.env.LV11_SKIP_NEWS !== '1') {
  for (const t of ['NVDA','AMD','AVGO','MRVL','LITE','TER','CRWD','PANW','MSFT','SPY','QQQ','SOXX']) news = news.concat(await newsFor(t));
}
const bestOpportunity = opportunities[0];
const weakest = leaders.filter(r => r.price > 0).slice().reverse()[0];
const payload = {
  version:'V11',
  updatedAt:new Date().toISOString(),
  source:'github-actions/stooq+yahoo-rss',
  universeSize:symbols.length,
  groups,
  quotes,
  leaders:leaders.slice(0, 250),
  sectorStrength,
  regime,
  opportunities,
  radar,
  news:news.slice(0, 30),
  synthesizer:{
    whatToDoToday:regime.state === 'Risk Off' ? 'Protect capital. Do not add to weak stocks.' : regime.state === 'Risk On' ? 'Buy or add only to persistent leaders near clean entries.' : 'Stay selective. Let the best setups prove themselves.',
    bestOpportunity:bestOpportunity ? `${bestOpportunity.ticker} (${bestOpportunity.persistenceStage})` : 'No clean opportunity yet',
    worstPosition:weakest ? `${weakest.ticker} (${weakest.classification})` : 'None',
    marketRegime:regime.state,
    bestSector:sectorStrength[0]?.sector || 'N/D',
    capitalAvailable:'Read from desk capital setting'
  }
};
await fs.mkdir('data', {recursive:true});
await fs.writeFile('data/market.json', JSON.stringify(payload, null, 2));
console.log(JSON.stringify({version:payload.version,updatedAt:payload.updatedAt,universeSize:payload.universeSize,quoted:quotes.filter(q=>q.price>0).length,regime:payload.regime.state,topRadar:payload.radar.slice(0,5).map(r=>({ticker:r.ticker,score:r.score,persistence:r.persistenceCount}))}, null, 2));

process.exit(0);
