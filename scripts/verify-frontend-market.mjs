import fs from 'node:fs';
import vm from 'node:vm';

const market = JSON.parse(fs.readFileSync('data/market.json', 'utf8'));
const expected = {
  validQuotesCount: market.validQuotesCount,
  radar: Array.isArray(market.radar) ? market.radar.length : 0,
  sectorStrength: Array.isArray(market.sectorStrength) ? market.sectorStrength.length : 0,
  bestSector: market.bestSector?.sector || 'N/D',
  worstSector: market.worstSector?.sector || 'N/D',
};

let app = { innerHTML: '' };
const storage = {};
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
  location: { hash: '' },
  window: { addEventListener() {} },
  localStorage: {
    getItem(key) { return storage[key] || null; },
    setItem(key, value) { storage[key] = String(value); },
  },
  fetch: async (url) => {
    if (!String(url).startsWith('https://example.test/lamborghini-v10-trading-desk/data/market.json?')) {
      throw new Error(`Unexpected market URL: ${url}`);
    }
    return { ok: true, status: 200, json: async () => market };
  },
  alert() {},
  URL,
};

vm.createContext(context);
vm.runInContext(fs.readFileSync('src/app.js', 'utf8'), context);
await new Promise((resolve) => setTimeout(resolve, 25));

const html = app.innerHTML;
function metric(label) {
  const match = html.match(new RegExp(`<small>${label}</small>([^<]+)`));
  return match?.[1];
}
const actual = {
  validQuotesCount: Number(metric('Quote valide')),
  radar: Number(metric('Radar reale')),
  bestSector: metric('Best sector') || 'N/D',
  worstSector: metric('Worst sector') || 'N/D',
};

const failures = [];
if (actual.validQuotesCount !== expected.validQuotesCount) failures.push(`validQuotesCount ${actual.validQuotesCount} !== ${expected.validQuotesCount}`);
if (actual.radar !== expected.radar) failures.push(`radar ${actual.radar} !== ${expected.radar}`);
if (actual.bestSector !== expected.bestSector) failures.push(`bestSector ${actual.bestSector} !== ${expected.bestSector}`);
if (actual.worstSector !== expected.worstSector) failures.push(`worstSector ${actual.worstSector} !== ${expected.worstSector}`);
if (expected.sectorStrength <= 0) failures.push('sectorStrength is empty in data/market.json');

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(JSON.stringify({ expected, actual, marketUrl: storage.lv10_market_url }, null, 2));
