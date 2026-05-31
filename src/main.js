const STORAGE_KEY = 'lamborghini-v10-desk-state-v1';
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const pages = [
  ['home', 'Home Command Center', 'Home', '⌂'],
  ['portfolio', 'Portfolio', 'Portfolio', '▣'],
  ['radar', 'Opportunity Radar', 'Radar', '◎'],
  ['quick', 'Quick Analyze', 'Analyze', '✦'],
  ['macro', 'Macro Market Regime', 'Macro', '◌'],
  ['sector', 'Sector Rotation', 'Sectors', '↻'],
  ['leaders', 'Relative Strength Leaders', 'Leaders', '↗'],
  ['journal', 'Trade Journal', 'Journal', '▤'],
  ['graveyard', 'Trade Graveyard', 'Graveyard', '☠'],
  ['alerts', 'Alert Center', 'Alerts', '⚠'],
  ['settings', 'Settings', 'Settings', '⚙'],
].map(([id, label, short, icon]) => ({ id, label, short, icon }));

const seedTickers = ['NVDA', 'MSFT', 'AAPL', 'AMZN', 'META', 'GOOGL', 'TSLA', 'AMD', 'AVGO', 'LLY', 'JPM', 'V', 'XOM', 'CAT', 'BA', 'GE', 'PLTR', 'CRWD', 'SHOP', 'COIN', 'SMH', 'QQQ', 'SPY', 'XLK', 'XLE', 'XLF', 'IBIT'];
const sectorData = [
  ['Semiconductors', 'SMH', '+2.8%', 94, 'Leadership'],
  ['AI Infrastructure', 'AIQ', '+2.1%', 91, 'Acceleration'],
  ['Industrials', 'XLI', '+1.4%', 84, 'Rotation in'],
  ['Financials', 'XLF', '+0.9%', 77, 'Constructive'],
  ['Energy', 'XLE', '-0.3%', 58, 'Neutral'],
  ['Utilities', 'XLU', '-1.1%', 38, 'Defensive lag'],
];

const defaultState = {
  cash: 25000,
  riskPerTrade: 1.0,
  themeIntensity: 88,
  positions: [
    { id: uid(), ticker: 'NVDA', qty: 8, avg: 116.25, price: 124.8, thesis: 'AI momentum + RS leader' },
    { id: uid(), ticker: 'SMH', qty: 12, avg: 242.4, price: 258.9, thesis: 'Semis breadth breakout' },
  ],
  journal: [{ id: uid(), date: '2026-05-20', ticker: 'MSFT', setup: 'Pullback to 20D', result: '+2.4R', notes: 'Scaled at first target, trailed remainder.' }],
  graveyard: [{ id: uid(), ticker: 'TSLA', loss: '-1.0R', lesson: 'Entry chased after opening gap; wait for base reset.' }],
  alerts: [
    { id: uid(), ticker: 'QQQ', trigger: 'Close above 50D high', enabled: true },
    { id: uid(), ticker: 'XLF', trigger: 'Relative strength > SPY for 5 sessions', enabled: true },
  ],
};

let activePage = 'home';
let state = loadState();
let opportunities = generateOpportunities();
let quickTicker = 'NVDA';

function loadState() {
  try {
    return { ...defaultState, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
  } catch {
    return defaultState;
  }
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function money(value) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value) || 0); }
function hashTicker(ticker) { return ticker.toUpperCase().split('').reduce((acc, char) => acc + char.charCodeAt(0), 0); }
function esc(value = '') { return String(value).replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m])); }

function analyzeTicker(rawTicker) {
  const ticker = (rawTicker || 'V10').trim().toUpperCase().slice(0, 8);
  const h = hashTicker(ticker);
  const rating = Math.max(1, Math.min(10, Math.round(((h % 89) / 10) + 1)));
  const trend = rating >= 8 ? 'Power trend' : rating >= 6 ? 'Costruttivo' : rating >= 4 ? 'Laterale' : 'Fragile';
  const conviction = rating >= 8 ? 'Alta' : rating >= 6 ? 'Media-alta' : rating >= 4 ? 'Media' : 'Bassa';
  const base = 40 + (h % 220) + ticker.length * 3.7;
  const entry = +(base * (1 + (rating - 5) / 100)).toFixed(2);
  const stop = +(entry * (1 - (0.035 + (10 - rating) * 0.004))).toFixed(2);
  const target = +(entry * (1 + (0.065 + rating * 0.01))).toFixed(2);
  const duration = rating >= 8 ? '2-6 settimane' : rating >= 6 ? '5-15 giorni' : 'Intraday / waitlist';
  const riskReward = +((target - entry) / (entry - stop)).toFixed(2);
  const reasons = [
    rating >= 7 ? 'forza relativa superiore al mercato' : 'forza relativa non ancora dominante',
    h % 2 === 0 ? 'volumi in espansione sulle candele verdi' : 'compressione di volatilità prima del trigger',
    rating >= 6 ? 'setup compatibile con regime risk-on' : 'serve conferma sopra resistenza primaria',
  ];
  return { ticker, rating, trend, conviction, entry, stop, target, duration, riskReward, reasons };
}

function generateOpportunities(count = 7) {
  const daySeed = Math.floor(Date.now() / 86400000);
  return seedTickers.map((ticker, index) => {
    const analysis = analyzeTicker(ticker);
    const rating = Math.max(1, Math.min(10, analysis.rating + ((daySeed + index * 13) % 5) - 2));
    return {
      ...analysis,
      rating,
      conviction: rating >= 8 ? 'Alta' : rating >= 6 ? 'Media-alta' : 'Speculativa',
      reason: `${analysis.reasons.join('; ')}. Trigger V10: breakout controllato con rischio definito.`,
    };
  }).sort((a, b) => b.rating - a.rating || b.riskReward - a.riskReward).slice(0, count);
}

function metrics() {
  const invested = state.positions.reduce((sum, p) => sum + Number(p.qty || 0) * Number(p.price || 0), 0);
  const pnl = state.positions.reduce((sum, p) => sum + Number(p.qty || 0) * (Number(p.price || 0) - Number(p.avg || 0)), 0);
  return { invested, pnl, equity: Number(state.cash || 0) + invested };
}

function metric(label, value, tone = 'neutral') { return `<div class="metric ${tone}"><span>${label}</span><strong>${value}</strong></div>`; }
function button(page) { return `<button class="${activePage === page.id ? 'active' : ''}" data-page="${page.id}"><span>${page.icon}</span> ${page.short}</button>`; }

function render() {
  const page = pages.find((p) => p.id === activePage) || pages[0];
  const { equity, pnl } = metrics();
  document.querySelector('#root').innerHTML = `
    <div class="app-shell">
      <aside class="side-rail">
        <div class="brand-lockup"><div class="bull-mark">⚡</div><div><span>V10</span><strong>Trading Desk</strong></div></div>
        <nav class="desktop-nav">${pages.map(button).join('')}</nav>
      </aside>
      <main class="main-stage">
        <header class="hero-card">
          <div class="hero-topline">${page.icon} Lamborghini dark blue cockpit</div>
          <div class="hero-title-row"><div><h1>${page.label}</h1><p>Desk operativo mobile-first per idee, rischio, alert e post-trade review.</p></div><div class="engine-badge">🔥 V10 LIVE</div></div>
          <div class="hero-metrics">${metric('Equity', money(equity))}${metric('Open P/L', `${pnl >= 0 ? '+' : ''}${money(pnl)}`, pnl >= 0 ? 'good' : 'bad')}${metric('Regime', 'Risk-on', 'good')}</div>
        </header>
        ${pageContent(activePage)}
      </main>
      <nav class="bottom-nav">${pages.slice(0, 5).map(button).join('')}</nav>
    </div>`;
  bindEvents();
}

function pageContent(page) {
  const { invested, equity, pnl } = metrics();
  const top = opportunities[0];
  const routes = {
    home: () => `<section class="grid two"><div class="panel command-panel"><div class="panel-title">🚀 Launch Control</div><h2>${top.ticker} rating ${top.rating}/10</h2><p>${top.reason}</p><div class="action-row"><button class="primary" data-page="radar">Apri Opportunity Radar ›</button><button data-page="quick">Quick Analyze</button></div></div><div class="panel stack">${metric('Capitale libero', money(state.cash))}${metric('Posizioni', state.positions.length)}${metric('Journal entries', state.journal.length)}${metric('P/L motore', `${pnl >= 0 ? '+' : ''}${money(pnl)}`, pnl >= 0 ? 'good' : 'bad')}</div><div class="panel wide"><div class="panel-title">≋ Command telemetry</div><div class="telemetry-grid"><div class="telemetry"><span>Equity curve</span><strong>${money(equity)}</strong><em>+7.8%</em></div><div class="telemetry"><span>Risk budget</span><strong>${state.riskPerTrade}%</strong><em>per trade</em></div><div class="telemetry"><span>Alert attivi</span><strong>${state.alerts.filter((a) => a.enabled).length}</strong><em>armed</em></div></div></div></section>`,
    portfolio: () => `<section class="grid two"><div class="panel"><div class="panel-title">💳 Capitale modificabile</div><label>Capitale libero<input data-bind="cash" type="number" value="${esc(state.cash)}"></label><div class="summary-strip">${metric('Investito', money(invested))}${metric('Equity', money(equity))}${metric('P/L', `${pnl >= 0 ? '+' : ''}${money(pnl)}`, pnl >= 0 ? 'good' : 'bad')}</div></div><div class="panel"><div class="panel-title">🎯 Nuova posizione</div><div class="form-grid"><input id="pos-ticker" placeholder="TICKER"><input id="pos-qty" placeholder="QTY" type="number"><input id="pos-avg" placeholder="AVG" type="number"><input id="pos-price" placeholder="PRICE" type="number"><input class="full" id="pos-thesis" placeholder="Tesi operativa"></div><button class="primary" data-action="add-position">Aggiungi posizione</button></div><div class="panel wide cards-list"><div class="panel-title">▣ Posizioni modificabili</div>${state.positions.map(positionCard).join('')}</div></section>`,
    radar: () => `<section class="panel wide"><div class="toolbar"><div class="panel-title">◎ Opportunità generate automaticamente</div><button class="primary" data-action="regen">✨ Rigenera</button></div><div class="opportunity-list">${opportunities.map(opportunityCard).join('')}</div></section>`,
    quick: () => quickAnalyze(),
    macro: () => dashboard('◌ Macro Market Regime', [['Equity breadth', 'Bullish', '+68% titoli sopra 50D'], ['Rates pressure', 'Neutral', 'rendimenti in range'], ['Credit spreads', 'Calm', 'nessun stress sistemico'], ['Dollar impulse', 'Watch', 'breakout DXY invaliderebbe beta']]),
    sector: () => `<section class="panel wide"><div class="panel-title">↻ Sector Rotation</div>${sectorData.map(([name, etf, flow, score, phase]) => `<div class="sector-row"><div><strong>${name}</strong><span>${etf} · ${phase}</span></div><div class="bar"><i style="width:${score}%"></i></div><b>${flow}</b></div>`).join('')}</section>`,
    leaders: () => `<section class="panel wide"><div class="panel-title">↗ Relative Strength Leaders</div><div class="leader-grid">${generateOpportunities(10).map((l, i) => `<div class="leader"><span>#${i + 1}</span><strong>${l.ticker}</strong><em>RS ${l.rating * 9 + i}</em></div>`).join('')}</div></section>`,
    journal: () => editableLog('Trade Journal', 'journal', ['date', 'ticker', 'setup', 'result', 'notes']),
    graveyard: () => editableLog('Trade Graveyard', 'graveyard', ['ticker', 'loss', 'lesson']),
    alerts: () => alerts(),
    settings: () => `<section class="panel wide"><div class="panel-title">⚙ Settings</div><label>Rischio per trade (%)<input data-bind="riskPerTrade" type="number" step="0.1" value="${esc(state.riskPerTrade)}"></label><label>Intensità neon cockpit<input data-bind="themeIntensity" type="range" min="30" max="100" value="${esc(state.themeIntensity)}"></label><button data-action="reset">Reset desk</button></section>`,
  };
  return routes[page]();
}

function opportunityCard(op) {
  return `<article class="opportunity-card"><div class="score-ring"><strong>${op.rating}</strong><span>/10</span></div><div><h3>${op.ticker}</h3><p>${op.reason}</p><div class="trade-grid"><span>Conviction <b>${op.conviction}</b></span><span>Duration <b>${op.duration}</b></span><span>Entry <b>${op.entry}</b></span><span>Stop <b>${op.stop}</b></span><span>Target <b>${op.target}</b></span><span>R/R <b>${op.riskReward}</b></span></div></div></article>`;
}
function positionCard(pos) {
  return `<div class="position-card"><input data-pos="${pos.id}" data-field="ticker" value="${esc(pos.ticker)}"><input data-pos="${pos.id}" data-field="qty" type="number" value="${esc(pos.qty)}"><input data-pos="${pos.id}" data-field="avg" type="number" value="${esc(pos.avg)}"><input data-pos="${pos.id}" data-field="price" type="number" value="${esc(pos.price)}"><span class="pill ${pos.price - pos.avg >= 0 ? 'good' : 'bad'}">${money((pos.price - pos.avg) * pos.qty)}</span><button data-remove-position="${pos.id}">Rimuovi</button><textarea data-pos="${pos.id}" data-field="thesis">${esc(pos.thesis)}</textarea></div>`;
}
function quickAnalyze() {
  const a = analyzeTicker(quickTicker);
  return `<section class="grid two"><div class="panel"><div class="panel-title">✦ Inserisci ticker</div><input class="ticker-input" id="quick-ticker" value="${esc(quickTicker)}" placeholder="es. NVDA"><p class="muted">Analisi sintetica generata localmente con scoring tecnico, rischio e piano trade.</p></div><div class="panel analyze-card"><div class="panel-title">✦ Risposta completa</div><h2>${a.ticker} — ${a.trend}</h2><div class="score-line"><span>Rating</span><strong>${a.rating}/10</strong></div><p><b>Conviction:</b> ${a.conviction}. <b>Durata:</b> ${a.duration}. <b>R/R:</b> ${a.riskReward}.</p><div class="trade-grid highlighted"><span>Entry <b>${a.entry}</b></span><span>Stop <b>${a.stop}</b></span><span>Target <b>${a.target}</b></span></div><ul>${a.reasons.map((r) => `<li>${r}</li>`).join('')}</ul><p class="risk-note">Piano: entra solo su conferma, dimensiona con rischio massimo predefinito e annulla se il prezzo chiude sotto stop.</p></div></section>`;
}
function dashboard(title, items) {
  return `<section class="panel wide"><div class="panel-title">${title}</div><div class="dashboard-list">${items.map(([label, status, detail]) => `<div class="dash-row"><span>✓</span><div><strong>${label}</strong><span>${detail}</span></div><b>${status}</b></div>`).join('')}</div></section>`;
}
function editableLog(title, key, fields) {
  return `<section class="panel wide"><div class="panel-title">▤ ${title}</div><div class="form-grid">${fields.map((f) => `<input id="${key}-${f}" placeholder="${f.toUpperCase()}" ${f === 'date' ? `value="${new Date().toISOString().slice(0, 10)}"` : ''}>`).join('')}<button class="primary" data-log-add="${key}">Salva</button></div><div class="log-list">${state[key].map((entry) => `<div class="log-card">${fields.map((f) => `<span><b>${f}</b>${esc(entry[f])}</span>`).join('')}<button data-log-remove="${key}:${entry.id}">Elimina</button></div>`).join('')}</div></section>`;
}
function alerts() {
  return `<section class="panel wide"><div class="panel-title">⚠ Alert Center</div><div class="form-grid"><input id="alert-ticker" placeholder="TICKER"><input id="alert-trigger" placeholder="Trigger"><button class="primary" data-action="add-alert">Arma alert</button></div>${state.alerts.map((a) => `<div class="alert-row"><span>⚠</span><div><strong>${a.ticker}</strong><span>${a.trigger}</span></div><label class="switch"><input data-alert="${a.id}" type="checkbox" ${a.enabled ? 'checked' : ''}><i></i></label></div>`).join('')}</section>`;
}

function bindEvents() {
  document.querySelectorAll('[data-page]').forEach((el) => el.addEventListener('click', () => { activePage = el.dataset.page; render(); }));
  document.querySelectorAll('[data-bind]').forEach((el) => el.addEventListener('input', () => { state[el.dataset.bind] = el.value; saveState(); }));
  document.querySelectorAll('[data-pos]').forEach((el) => el.addEventListener('input', () => { const p = state.positions.find((x) => x.id === el.dataset.pos); if (p) p[el.dataset.field] = el.value; saveState(); }));
  document.querySelectorAll('[data-remove-position]').forEach((el) => el.addEventListener('click', () => { state.positions = state.positions.filter((p) => p.id !== el.dataset.removePosition); saveState(); render(); }));
  document.querySelectorAll('[data-alert]').forEach((el) => el.addEventListener('change', () => { const a = state.alerts.find((x) => x.id === el.dataset.alert); if (a) a.enabled = el.checked; saveState(); render(); }));
  const quick = document.querySelector('#quick-ticker');
  if (quick) quick.addEventListener('input', () => { quickTicker = quick.value; render(); document.querySelector('#quick-ticker')?.focus(); });
}

document.addEventListener('click', (event) => {
  const action = event.target.closest('[data-action]')?.dataset.action;
  const logAdd = event.target.closest('[data-log-add]')?.dataset.logAdd;
  const logRemove = event.target.closest('[data-log-remove]')?.dataset.logRemove;
  if (action === 'regen') opportunities = generateOpportunities();
  if (action === 'reset') { localStorage.removeItem(STORAGE_KEY); state = structuredClone(defaultState); }
  if (action === 'add-position') {
    const ticker = document.querySelector('#pos-ticker').value.trim().toUpperCase();
    if (ticker) state.positions.push({ id: uid(), ticker, qty: document.querySelector('#pos-qty').value, avg: document.querySelector('#pos-avg').value, price: document.querySelector('#pos-price').value, thesis: document.querySelector('#pos-thesis').value });
  }
  if (action === 'add-alert') {
    const ticker = document.querySelector('#alert-ticker').value.trim().toUpperCase();
    if (ticker) state.alerts.unshift({ id: uid(), ticker, trigger: document.querySelector('#alert-trigger').value, enabled: true });
  }
  if (logAdd) {
    const fields = logAdd === 'journal' ? ['date', 'ticker', 'setup', 'result', 'notes'] : ['ticker', 'loss', 'lesson'];
    const entry = Object.fromEntries(fields.map((f) => [f, document.querySelector(`#${logAdd}-${f}`).value]));
    if (entry.ticker) state[logAdd].unshift({ id: uid(), ...entry, ticker: entry.ticker.toUpperCase() });
  }
  if (logRemove) {
    const [key, id] = logRemove.split(':');
    state[key] = state[key].filter((x) => x.id !== id);
  }
  if (action || logAdd || logRemove) { saveState(); render(); }
});

render();
