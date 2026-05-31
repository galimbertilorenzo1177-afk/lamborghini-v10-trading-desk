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

const nestedPayload = { ...market, quotes: undefined, data: { quotes: market.quotes, radar: market.radar, sectorStrength: market.sectorStrength, regime: market.regime, validQuotesCount: market.validQuotesCount, bestSector: market.bestSector, worstSector: market.worstSector } };
const { html: nestedHtml } = await renderApp('#leaders', nestedPayload);
if (Number(metric(nestedHtml, 'Universe ranked')) !== expected.validQuotesCount) failures.push('nested data.quotes path was not ranked correctly');

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(JSON.stringify({ expected, actual, portfolio: 'MRVL/LITE live prices rendered', leaders: { leaderCount, weakCount, articleCount }, marketUrl: storage.lv10_market_url }, null, 2));
