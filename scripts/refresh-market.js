const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const MARKET_PATH = path.join(ROOT, "data", "market.json");
const MINIMUM_VALID_QUOTES = 300;
const BATCH_SIZE = 40;

function nowIso() {
  return new Date().toISOString();
}

function readJsonSafe(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function normalizeTicker(ticker) {
  return String(ticker || "")
    .toUpperCase()
    .trim()
    .replace(/\.US$/, "");
}

function isRealTicker(ticker) {
  const t = normalizeTicker(ticker);
  return /^[A-Z][A-Z0-9.]{0,5}$/.test(t) && !/^V\d+$/i.test(t);
}

function stooqSymbol(ticker) {
  return normalizeTicker(ticker).toLowerCase().replace(/\./g, "-") + ".us";
}

function fromStooqSymbol(symbol) {
  return String(symbol || "")
    .toUpperCase()
    .replace(/\.US$/, "")
    .replace(/-/g, ".");
}

function collectConfiguredTickers(existing) {
  const out = [];

  if (Array.isArray(existing.configuredTickers)) {
    out.push(...existing.configuredTickers);
  }

  if (existing.groups && typeof existing.groups === "object") {
    for (const group of Object.values(existing.groups)) {
      if (Array.isArray(group)) out.push(...group);
    }
  }

  for (const key of ["quotes", "radar"]) {
    if (Array.isArray(existing[key])) {
      for (const q of existing[key]) {
        out.push(q.ticker || q.t || q.symbol);
      }
    }
  }

  const seen = new Set();
  return out
    .map(normalizeTicker)
    .filter(isRealTicker)
    .filter((t) => {
      if (seen.has(t)) return false;
      seen.add(t);
      return true;
    });
}

function buildExistingQuoteMap(existing) {
  const map = new Map();
  const quotes = Array.isArray(existing.quotes) ? existing.quotes : [];

  for (const q of quotes) {
    const t = normalizeTicker(q.ticker || q.t || q.symbol);
    if (isRealTicker(t)) map.set(t, q);
  }

  return map;
}

function csvParseLine(line) {
  const out = [];
  let cur = "";
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      quoted = !quoted;
      continue;
    }

    if (ch === "," && !quoted) {
      out.push(cur);
      cur = "";
      continue;
    }

    cur += ch;
  }

  out.push(cur);
  return out;
}

function parseCsv(csv) {
  const lines = String(csv || "")
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = csvParseLine(lines[0]).map((h) => h.trim());

  return lines.slice(1).map((line) => {
    const values = csvParseLine(line);
    const row = {};
    headers.forEach((h, i) => {
      row[h] = values[i];
    });
    return row;
  });
}

async function fetchStooqBatch(tickers) {
  const symbols = tickers.map(stooqSymbol).join(",");
  const url =
    "https://stooq.com/q/l/?s=" +
    encodeURIComponent(symbols) +
    "&f=sd2t2ohlcv&h&e=csv";

  const res = await fetch(url, {
    headers: {
      "User-Agent": "lamborghini-v16-market-refresh/1.0",
      "Cache-Control": "no-cache",
    },
  });

  if (!res.ok) {
    throw new Error(`Stooq HTTP ${res.status}`);
  }

  return parseCsv(await res.text());
}

function quoteFromRow(row, existingByTicker) {
  const ticker = normalizeTicker(fromStooqSymbol(row.Symbol));
  const price = Number(row.Close);
  const open = Number(row.Open);
  const high = Number(row.High);
  const low = Number(row.Low);
  const volume = Number(row.Volume);
  const date = row.Date;
  const time = row.Time;

  const old = existingByTicker.get(ticker) || {};
  const oldPrice = Number(old.price || old.close || old.last || 0);

  const move =
    Number.isFinite(price) && price > 0 && Number.isFinite(oldPrice) && oldPrice > 0
      ? ((price - oldPrice) / oldPrice) * 100
      : Number(old.move || old.changePercent || 0);

  const valid =
    isRealTicker(ticker) &&
    Number.isFinite(price) &&
    price > 0 &&
    date &&
    date !== "N/D";

  return {
    ticker,
    t: ticker,
    symbol: ticker,
    name: old.name || ticker,
    sector: old.sector || "Broad market",
    price,
    close: price,
    last: price,
    open: Number.isFinite(open) ? open : null,
    high: Number.isFinite(high) ? high : null,
    low: Number.isFinite(low) ? low : null,
    volume: Number.isFinite(volume) ? volume : null,
    move: Number.isFinite(move) ? Number(move.toFixed(2)) : 0,
    changePercent: Number.isFinite(move) ? Number(move.toFixed(2)) : 0,
    quoteDate: date,
    quoteTime: time,
    source: "stooq",
    quoteSource: "stooq",
    valid,
    status: valid ? "valid" : "invalid",
    dataError: !valid,
    error: valid ? "" : "invalid or missing Stooq quote",
  };
}

function buildSectorStrength(quotes) {
  const bySector = {};

  for (const q of quotes) {
    const sector = q.sector || "Broad market";
    if (!bySector[sector]) {
      bySector[sector] = {
        sector,
        count: 0,
        avgMove: 0,
        leaders: 0,
        weak: 0,
      };
    }

    bySector[sector].count += 1;
    bySector[sector].avgMove += Number(q.move || 0);

    if (Number(q.move || 0) > 0.8) bySector[sector].leaders += 1;
    if (Number(q.move || 0) < -1) bySector[sector].weak += 1;
  }

  return Object.values(bySector)
    .map((x) => {
      x.avgMove = Number((x.avgMove / Math.max(1, x.count)).toFixed(2));
      x.score = Number((50 + x.avgMove * 8 + x.leaders * 2 - x.weak * 2).toFixed(1));
      return x;
    })
    .sort((a, b) => b.score - a.score);
}

function detectRegime(quotes, sectorStrength) {
  const priced = quotes.filter((q) => q.valid);
  const advancing = priced.filter((q) => Number(q.move || 0) > 0).length;
  const leaders = priced.filter((q) => Number(q.move || 0) > 0.8).length;
  const weak = priced.filter((q) => Number(q.move || 0) < -1).length;
  const breadth = priced.length ? advancing / priced.length : 0;

  const best = sectorStrength[0];
  const worst = sectorStrength[sectorStrength.length - 1];
  const spread = best && worst ? best.avgMove - worst.avgMove : 0;

  let label = "selettivo";
  if (breadth > 0.58 && leaders > weak * 1.2) label = "risk-on";
  else if (breadth < 0.42 && weak > leaders) label = "risk-off";
  else if (spread > 3) label = "rotazione settoriale";

  return {
    label,
    score: Number((breadth * 100).toFixed(1)),
    breadth: Number((breadth * 100).toFixed(1)),
    leaders,
    weak,
    priced: priced.length,
  };
}

function radarScore(q) {
  let score = 5;
  const move = Number(q.move || 0);

  if (move > 18) score = 3.9;
  else if (move > 12) score = 4.8;
  else if (move > 5) score = 6.1;
  else if (move > 2) score = 7.6;
  else if (move > 0.8) score = 6.7;
  else if (move < -4) score = 3.6;
  else if (move < -2) score = 4.2;

  return Number(Math.max(1, Math.min(9.5, score)).toFixed(1));
}

async function main() {
  const startedAt = nowIso();
  const existing = readJsonSafe(MARKET_PATH, {});
  const configuredTickers = collectConfiguredTickers(existing);
  const existingByTicker = buildExistingQuoteMap(existing);
  const minimumValidQuotes = Number(existing.minimumValidQuotes || MINIMUM_VALID_QUOTES);

  const rows = [];
  const failedBatches = [];

  for (let i = 0; i < configuredTickers.length; i += BATCH_SIZE) {
    const batch = configuredTickers.slice(i, i + BATCH_SIZE);

    try {
      const batchRows = await fetchStooqBatch(batch);
      rows.push(...batchRows);
    } catch (err) {
      failedBatches.push({
        batch,
        error: err.message,
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  const downloadedQuotes = rows.map((row) => quoteFromRow(row, existingByTicker));
  const acceptedQuotes = downloadedQuotes.filter((q) => q.valid);
  const rejectedQuotes = downloadedQuotes.filter((q) => !q.valid);

  const downloadedCount = downloadedQuotes.length;
  const validatedCount = acceptedQuotes.length;
  const acceptedCount = acceptedQuotes.length;

  const lastMarketQuoteTime =
    acceptedQuotes
      .map((q) => {
        if (!q.quoteDate || q.quoteDate === "N/D") return null;
        return new Date(`${q.quoteDate}T00:00:00.000Z`);
      })
      .filter((d) => d && !Number.isNaN(d.getTime()))
      .sort((a, b) => b - a)[0]
      ?.toISOString() || existing.lastMarketQuoteTime || "";

  const previousTimestamp =
    existing.snapshotGeneratedAt ||
    existing.lastSuccessfulMarketFetchAt ||
    existing.updatedAt ||
    "";

  if (acceptedCount < minimumValidQuotes) {
    const preserved = {
      ...existing,
      quoteDownloadSuccess: false,
      quoteDownloadStatus: "preserved-existing-snapshot",
      quoteDownloadError: `below minimum ${acceptedCount}/${minimumValidQuotes}; preserving existing snapshot with ${
        existing.validQuotesCount || 0
      }`,
      refreshDiagnostics: {
        ...(existing.refreshDiagnostics || {}),
        fetchStarted: startedAt,
        source: "stooq",
        sourceReached: downloadedCount > 0,
        downloadedCount,
        quotesDownloaded: downloadedCount,
        validatedCount,
        validQuotes: validatedCount,
        acceptedCount,
        acceptanceCount: acceptedCount,
        rejectedCount: rejectedQuotes.length,
        minimumValidQuotes,
        marketJsonRewritten: false,
        previousTimestamp,
        newlyGeneratedTimestamp: previousTimestamp,
        newTimestampDetected: false,
        timestampComparisonResult: "preserved existing snapshot because acceptedCount is below minimum",
        timestampUpdateCodePath: "scripts/refresh-market.js",
        timestampWillAdvance: false,
        reason: `below minimum ${acceptedCount}/${minimumValidQuotes}; preserving existing snapshot with ${
          existing.validQuotesCount || 0
        }`,
        failedBatches,
      },
    };

    writeJson(MARKET_PATH, preserved);
    console.log(
      `FAILED: downloaded=${downloadedCount} validated=${validatedCount} accepted=${acceptedCount}/${minimumValidQuotes}`
    );
    process.exitCode = 0;
    return;
  }

  const generatedAt = nowIso();
  const sectorStrength = buildSectorStrength(acceptedQuotes);
  const regime = detectRegime(acceptedQuotes, sectorStrength);
  const bestSector = sectorStrength[0] || null;
  const worstSector = sectorStrength[sectorStrength.length - 1] || null;

  const snapshot = {
    ...existing,

    updatedAt: generatedAt,
    snapshotGeneratedAt: generatedAt,
    lastSuccessfulMarketFetchAt: generatedAt,
    lastPriceChangeAt:
      generatedAt !== previousTimestamp ? generatedAt : existing.lastPriceChangeAt || generatedAt,
    lastMarketQuoteTime,

    source: "stooq",
    minimumValidQuotes,
    quoteDownloadSuccess: true,
    quoteDownloadStatus: "success",
    quoteDownloadError: "",

    configuredTickers,
    configuredTickersCount: configuredTickers.length,

    validQuotesCount: acceptedCount,
    invalidQuotesCount: rejectedQuotes.length,
    universeSize: acceptedCount,

    quotes: acceptedQuotes,
    failedQuotes: rejectedQuotes.map((q) => ({
      ticker: q.ticker,
      sector: q.sector || "N/D",
      error: q.error || "invalid quote",
    })),

    sectorStrength,
    bestSector,
    worstSector,
    regime,

    radar: acceptedQuotes
      .map((q) => ({
        ...q,
        score: radarScore(q),
        event:
          Number(q.move || 0) > 2
            ? "market momentum"
            : Number(q.move || 0) < -2
              ? "relative weakness"
              : "market scan",
        note:
          Number(q.move || 0) > 2
            ? "momentum candidate"
            : Number(q.move || 0) < -2
              ? "weak relative"
              : "neutral",
      }))
      .sort((a, b) => Number(b.score || 0) - Number(a.score || 0)),

    refreshDiagnostics: {
      fetchStarted: startedAt,
      source: "stooq",
      sourceReached: true,

      downloadedCount,
      quotesDownloaded: downloadedCount,

      validatedCount,
      validQuotes: validatedCount,

      acceptedCount,
      acceptanceCount: acceptedCount,

      rejectedCount: rejectedQuotes.length,
      minimumValidQuotes,

      marketJsonRewritten: true,

      previousTimestamp,
      newlyGeneratedTimestamp: generatedAt,
      snapshotGeneratedAt: generatedAt,
      lastSuccessfulMarketFetchAt: generatedAt,
      lastMarketQuoteTime,

      newTimestampDetected: generatedAt !== previousTimestamp,
      timestampComparisonResult:
        generatedAt !== previousTimestamp
          ? "new timestamp differs from previous timestamp"
          : "new timestamp matches previous timestamp",
      timestampUpdateCodePath: "scripts/refresh-market.js",
      timestampWillAdvance: true,

      reason: "",
      failedBatches,
    },
  };

  writeJson(MARKET_PATH, snapshot);

  console.log(
    `OK: downloaded=${downloadedCount} validated=${validatedCount} accepted=${acceptedCount}/${minimumValidQuotes}`
  );
  console.log(`market.json updatedAt=${generatedAt}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
