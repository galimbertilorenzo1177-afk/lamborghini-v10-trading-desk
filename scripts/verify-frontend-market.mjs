import fs from 'node:fs';
import vm from 'node:vm';

const market = JSON.parse(fs.readFileSync('data/market.json', 'utf8'));
const expected = {
  validQuotesCount: market.validQuotesCount,
  radar: Array.isArray(market.radar) ? market.radar.length : 0,
  sectorStrength: Array.isArray(market.sectorStrength) ? market.sectorStrength.length : 0,
  bestSector: market.bestSector?.sector || 'N/D',
  worstSector: market.worstSector?.sector || 'N/D',
  leaders: market.regime?.leaders,
  weak: market.regime?.weak,
};

async function renderApp(hash = '', payload = market, preload = {}) {
  let app = { innerHTML: '' };
  const storage = { ...preload };
  const document = {
    currentScript: { src: 'https://example.test/lamborghini-v10-trading-desk/src/app.js?v=test' },
    querySelector(selector) {
      if (selector === '#app') return app;
      if (selector === '#refresh') return { onclick: null };
      return { onclick: null, value: '', innerHTML: '' };
    },
    querySelectorAll() { return []; },
    addEventListener() {},
  };
  const context = {
    console,
    document,
    location: { hash },
    window: { addEventListener() {} },
    localStorage: {
      getItem(key) { return storage[key] || null; },
      setItem(key, value) { storage[key] = String(value); },
    },
    fetch: async (url) => {
      if (!String(url).startsWith('https://example.test/lamborghini-v10-trading-desk/data/market.json?')) {
        throw new Error(`Unexpected market URL: ${url}`);
      }
      return { ok: true, status: 200, json: async () => payload };
    },
    alert() {},
    URL,
  };

  vm.createContext(context);
  vm.runInContext(fs.readFileSync('src/app.js', 'utf8'), context);
  await new Promise((resolve) => setTimeout(resolve, 25));
  return { html: app.innerHTML, storage };
}

function metric(html, label) {
  const match = html.match(new RegExp(`<small>${label}</small>([^<]+)`));
  return match?.[1];
}

const failures = [];

const { html: homeHtml, storage } = await renderApp('');
const actual = {
  validQuotesCount: Number(metric(homeHtml, 'Quote valide')),
  radar: Number(metric(homeHtml, 'Radar reale')),
  bestSector: metric(homeHtml, 'Best sector') || 'N/D',
  worstSector: metric(homeHtml, 'Worst sector') || 'N/D',
};

if (actual.validQuotesCount !== expected.validQuotesCount) failures.push(`validQuotesCount ${actual.validQuotesCount} !== ${expected.validQuotesCount}`);
if (actual.radar !== expected.radar) failures.push(`radar ${actual.radar} !== ${expected.radar}`);
if (actual.bestSector !== expected.bestSector) failures.push(`bestSector ${actual.bestSector} !== ${expected.bestSector}`);
if (actual.worstSector !== expected.worstSector) failures.push(`worstSector ${actual.worstSector} !== ${expected.worstSector}`);
if (expected.sectorStrength <= 0) failures.push('sectorStrength is empty in data/market.json');

const lowerCasePortfolio = JSON.stringify([
  { t: 'lite', qty: 8, pmc: 1046.65, plan: 'case test' },
  { t: 'mrvl', qty: 15, pmc: 199.5, plan: 'case test' },
]);
const { html: portfolioHtml } = await renderApp('#portfolio', market, { lv10_portfolio: lowerCasePortfolio });
if (portfolioHtml.includes('Ticker not found in current market snapshot')) failures.push('portfolio lookup failed for MRVL/LITE');
if ((portfolioHtml.match(/Live price/g) || []).length !== 2) failures.push('portfolio did not render two live price blocks');
if (!portfolioHtml.includes('854.96') || !portfolioHtml.includes('205')) failures.push('portfolio did not render expected LITE/MRVL live prices');
if (!portfolioHtml.includes('P/L')) failures.push('portfolio did not render P/L');

const { html: leadersHtml } = await renderApp('#leaders');
const leaderCount = Number(metric(leadersHtml, 'Leader'));
const weakCount = Number(metric(leadersHtml, 'Weak'));
const articleCount = (leadersHtml.match(/<article/g) || []).length;
if (leaderCount !== expected.leaders) failures.push(`leader count ${leaderCount} !== ${expected.leaders}`);
if (weakCount !== expected.weak) failures.push(`weak count ${weakCount} !== ${expected.weak}`);
if (articleCount !== 40) failures.push(`leader/weak dashboard rendered ${articleCount} cards instead of 40`);


const capitalProfile73 = JSON.stringify({
  totalCapital: 5000,
  tradingCapital: 2000,
  freeCash: 73,
  etfCapital: 1500,
  riskPct: 0.8,
  targetProfitPct: 6,
  leverageAllowed: false,
});
const { html: capitalHomeHtml } = await renderApp('', market, { lv10_capital_profile: capitalProfile73 });
if (!capitalHomeHtml.includes('<small>Free cash</small>€73')) failures.push('home did not render persisted freeCash 73');
const { html: capitalPortfolioHtml } = await renderApp('#portfolio', market, { lv10_capital_profile: capitalProfile73 });
if (!capitalPortfolioHtml.includes('Capitale libero<input data-capital-profile="freeCash" type="number" step="0.01" value="73"')) failures.push('portfolio free cash input did not render persisted value 73');
const { html: capitalRadarHtml } = await renderApp('#radar', market, { lv10_capital_profile: capitalProfile73 });
for (const ticker of ['AMD', 'MU', 'LSCC']) {
  const start = capitalRadarHtml.indexOf(`<b class="ticker">${ticker}</b>`);
  if (start < 0) {
    failures.push(`${ticker} missing from capital-constrained radar`);
    continue;
  }
  const end = capitalRadarHtml.indexOf('</article>', start);
  const article = capitalRadarHtml.slice(start, end);
  const sizeMatch = article.match(/<small>Size suggerita<\/small>€([0-9.,]+)/);
  const sharesMatch = article.match(/<small>Max shares<\/small>(\d+) az\./);
  if (!sizeMatch || !sharesMatch) {
    failures.push(`${ticker} missing capital sizing metrics`);
    continue;
  }
  const size = Number(sizeMatch[1].replace(/\./g, '').replace(',', '.'));
  const shares = Number(sharesMatch[1]);
  const quote = market.quotes.find((q) => q.ticker === ticker);
  if (size > 73) failures.push(`${ticker} suggested size ${size} exceeds freeCash 73`);
  if (quote?.price > 73 && shares !== 0) failures.push(`${ticker} suggested shares ${shares} despite price above freeCash 73`);
}


const diagnosticPayload = {
  ...market,
  refreshDiagnostics: {
    fetchStarted: '2026-05-31T10:00:00.000Z',
    source: 'stooq',
    sourceReached: true,
    quotesDownloaded: market.validQuotesCount,
    downloadedCount: market.validQuotesCount,
    validatedCount: market.validQuotesCount,
    acceptedCount: market.validQuotesCount,
    rejectionReason: '',
    marketJsonRewritten: true,
    newTimestampDetected: true,
    reason: '',
    previousTimestamp: '2026-05-30T10:00:00.000Z',
    newlyGeneratedTimestamp: '2026-05-31T10:00:00.000Z',
    timestampComparisonResult: 'new timestamp differs from previous timestamp',
    timestampUpdateCodePath: 'write-new-snapshot: valid quotes met minimum; payload timestamps use newlyGeneratedTimestamp',
  },
};
const { html: diagnosticsHtml } = await renderApp('#diagnostics', diagnosticPayload);
for (const snippet of ['Refresh status', 'Source: stooq', '<small>Fetch started</small>', '<small>Source reached</small><span class="good">YES</span>', `<small>Quotes downloaded</small>${market.validQuotesCount}`, `<small>downloadedCount</small>${market.validQuotesCount}`, `<small>validatedCount</small>${market.validQuotesCount}`, `<small>acceptedCount</small>${market.validQuotesCount}`, '<small>rejectionReason</small>', '<small>market.json rewritten</small><span class="good">YES</span>', '<small>New timestamp detected</small>YES', '<small>Previous timestamp</small>2026-05-30T10:00:00.000Z', '<small>Newly generated timestamp</small>2026-05-31T10:00:00.000Z', '<small>Timestamp comparison</small>new timestamp differs from previous timestamp', '<small>Timestamp update code path</small>write-new-snapshot: valid quotes met minimum; payload timestamps use newlyGeneratedTimestamp']) {
  if (!diagnosticsHtml.includes(snippet)) failures.push(`diagnostics missing ${snippet}`);
}


const rejectedAttemptPayload = {
  ...market,
  refreshDiagnostics: {
    fetchStarted: '2026-05-31T23:45:35.754Z',
    source: 'stooq',
    sourceReached: true,
    downloadedCount: 0,
    validatedCount: 0,
    acceptedCount: 0,
    rejectionReason: `below minimum 0/${market.minimumValidQuotes || 300}; preserving existing snapshot with ${market.validQuotesCount}`,
    quotesDownloaded: 0,
    marketJsonRewritten: true,
    newTimestampDetected: false,
    reason: `below minimum 0/${market.minimumValidQuotes || 300}; preserving existing snapshot with ${market.validQuotesCount}`,
  },
};
const { html: rejectedDiagnosticsHtml } = await renderApp('#diagnostics', rejectedAttemptPayload);
for (const snippet of ['<small>Quotes downloaded</small>0', '<small>downloadedCount</small>0', '<small>validatedCount</small>0', '<small>acceptedCount</small>0', `Reason: below minimum 0/${market.minimumValidQuotes || 300}; preserving existing snapshot with ${market.validQuotesCount}`]) {
  if (!rejectedDiagnosticsHtml.includes(snippet)) failures.push(`rejected diagnostics missing ${snippet}`);
}

const nestedPayload = { ...market, quotes: undefined, data: { quotes: market.quotes, radar: market.radar, sectorStrength: market.sectorStrength, regime: market.regime, validQuotesCount: market.validQuotesCount, bestSector: market.bestSector, worstSector: market.worstSector } };
const { html: nestedHtml } = await renderApp('#leaders', nestedPayload);
if (Number(metric(nestedHtml, 'Universe ranked')) !== expected.validQuotesCount) failures.push('nested data.quotes path was not ranked correctly');

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(JSON.stringify({ expected, actual, portfolio: 'MRVL/LITE live prices rendered', leaders: { leaderCount, weakCount, articleCount }, marketUrl: storage.lv10_market_url }, null, 2));
