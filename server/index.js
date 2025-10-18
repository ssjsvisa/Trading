const fs = require('fs')
const path = require('path')
const envPath = path.join(__dirname, '.env')
if (fs.existsSync(envPath)) {
  try {
    require('dotenv').config({ path: envPath })
  } catch (e) {
    console.warn('dotenv load failed:', e && e.message)
  }
}
const express = require('express')
const ti = require('technicalindicators')
const cors = require('cors')

// Helper: fetch wrapper (Node 18+ has global fetch); fall back to node-fetch if needed
let _fetch = global.fetch
if (!_fetch) {
  try {
    _fetch = (...args) => import('node-fetch').then(m => m.default(...args))
  } catch (e) {
    console.error('no fetch available')
  }
}

const app = express()
app.use(cors())
app.use(express.json())

// Alpha Vantage quote endpoint
app.get('/api/alpha-quote', async (req, res) => {
  const symbol = req.query.symbol
  if (!symbol) return res.status(400).json({ error: 'symbol required' })
  try {
    res.json(result)
  } catch (e) {
    res.status(500).json({ error: String(e && e.message) })
  }
})

function computeRsi(closes, period = 14) {
  if (!closes || closes.length < period + 1) return null
  return ti.RSI.calculate({ values: closes.slice(-100), period }).slice(-1)[0]
}

app.get('/api/quote', async (req, res) => {
  // symbol expected like 'AAPL' or 'TCS.NS' or 'RELIANCE.NS' or 'TATASTEEL.NS'
  const symbol = req.query.symbol
  if (!symbol) return res.status(400).json({ error: 'symbol required' })
  try {
    // Use Yahoo Finance public endpoints directly
    // Quote endpoint
    const qres = await _fetch(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`)
    const qjson = await qres.json()
    const quote = qjson && qjson.quoteResponse && qjson.quoteResponse.result && qjson.quoteResponse.result[0]

    // Historical chart endpoint for closes
    const cres = await _fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5y&interval=1d`)
    const cjson = await cres.json()
    const timestamps = cjson && cjson.chart && cjson.chart.result && cjson.chart.result[0] && cjson.chart.result[0].timestamp
    const indicators = cjson && cjson.chart && cjson.chart.result && cjson.chart.result[0] && cjson.chart.result[0].indicators
    let closes = []
    if (indicators && indicators.adjclose && indicators.adjclose[0] && indicators.adjclose[0].adjclose) {
      closes = indicators.adjclose[0].adjclose.filter(v => v != null)
    } else if (indicators && indicators.quote && indicators.quote[0] && indicators.quote[0].close) {
      closes = indicators.quote[0].close.filter(v => v != null)
    }
    // Calculate 50DMA and 200DMA
    let dma50 = null, dma200 = null;
    if (closes && closes.length >= 50) {
      const last50 = closes.slice(-50);
      dma50 = last50.reduce((a, b) => a + b, 0) / 50;
    }
    if (closes && closes.length >= 200) {
      const last200 = closes.slice(-200);
      dma200 = last200.reduce((a, b) => a + b, 0) / 200;
    }
    const rsi = computeRsi(closes)
  // ...existing code...
      const fres = await _fetch(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=balanceSheetHistory`)
      const fjson = await fres.json()
      const bs = fjson && fjson.quoteSummary && fjson.quoteSummary.result && fjson.quoteSummary.result[0]
      if (bs && bs.balanceSheetHistory && bs.balanceSheetHistory.balanceSheetStatements && bs.balanceSheetHistory.balanceSheetStatements[0]) {
        const stmt = bs.balanceSheetHistory.balanceSheetStatements[0]
        const tse = stmt.totalStockholderEquity || stmt.totalEquity || null
        const shares = quote && (quote.sharesOutstanding || quote.sharesOutstanding)
        if (tse != null && shares) bookValue = tse / shares
      }
    } catch (e) {
      // ignore
    }

    // Build result with multiple fallbacks in case some endpoints are rate-limited
    const meta = cjson && cjson.chart && cjson.chart.result && cjson.chart.result[0] && cjson.chart.result[0].meta
    const priceFallback = meta && (meta.regularMarketPrice || (closes && closes.length ? closes[closes.length - 1] : null))
    const prevCloseFallback = meta && (meta.chartPreviousClose || meta.previousClose)
    const openFallback = (indicators && indicators.quote && indicators.quote[0] && indicators.quote[0].open && indicators.quote[0].open.slice(-1)[0]) || null
    const volumeFallback = (indicators && indicators.quote && indicators.quote[0] && indicators.quote[0].volume && indicators.quote[0].volume.slice(-1)[0]) || null

    const result = {
    symbol: (quote && quote.symbol) || (meta && meta.symbol) || symbol,
    currency: (quote && quote.currency) || (meta && meta.currency) || null,
    open: (quote && quote.regularMarketOpen) || openFallback || null,
    close: (quote && quote.regularMarketPreviousClose) || prevCloseFallback || null,
    prevClose: (quote && quote.regularMarketPreviousClose) || prevCloseFallback || null,
    price: (quote && quote.regularMarketPrice) || priceFallback || null,
    volume: (quote && quote.regularMarketVolume) || volumeFallback || null,
    high52: (quote && quote.fiftyTwoWeekHigh) || (meta && meta['fiftyTwoWeekHigh']) || null,
    low52: (quote && quote.fiftyTwoWeekLow) || (meta && meta['fiftyTwoWeekLow']) || null,
    rsi: rsi,
    dma50: dma50,
    dma200: dma200,
    bookValue,
    longName: (quote && (quote.longName || quote.shortName)) || (meta && meta.shortName) || null,
    summaryProfile: null,
    }
    // Try to fetch company profile separately
    try {
      const prof = await _fetch(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=assetProfile`)
      const pjson = await prof.json()
      const profRes = pjson && pjson.quoteSummary && pjson.quoteSummary.result && pjson.quoteSummary.result[0]
      result.summaryProfile = profRes && profRes.assetProfile && profRes.assetProfile.longBusinessSummary
      res.json(result)
  } catch (e) {
    console.error('quote error', e && (e.stack || e.message || e))
    res.status(500).json({ error: String(e && e.message) })
  }
});

// Helper to fetch a single symbol's data (reuse the same logic)
async function fetchQuote(symbol) {
  // Use Yahoo Finance endpoints
  const qres = await _fetch(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`)
  const qjson = await qres.json()
  const quote = qjson && qjson.quoteResponse && qjson.quoteResponse.result && qjson.quoteResponse.result[0]

  const cres = await _fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5y&interval=1d`)
  const cjson = await cres.json()
  const indicators = cjson && cjson.chart && cjson.chart.result && cjson.chart.result[0] && cjson.chart.result[0].indicators
  let closes = []
  if (indicators && indicators.adjclose && indicators.adjclose[0] && indicators.adjclose[0].adjclose) {
    closes = indicators.adjclose[0].adjclose.filter(v => v != null)
  } else if (indicators && indicators.quote && indicators.quote[0] && indicators.quote[0].close) {
    closes = indicators.quote[0].close.filter(v => v != null)
  }
  // Calculate 50DMA and 200DMA
  let dma50 = null, dma200 = null;
  if (closes && closes.length >= 50) {
    const last50 = closes.slice(-50);
    dma50 = last50.reduce((a, b) => a + b, 0) / 50;
  }
  if (closes && closes.length >= 200) {
    const last200 = closes.slice(-200);
    dma200 = last200.reduce((a, b) => a + b, 0) / 200;
  }
  console.log(`[${symbol}] closes length: ${closes.length}, dma50: ${dma50}, dma200: ${dma200}`);
  const rsi = computeRsi(closes)

  let bookValue = null
  try {
    const fres = await _fetch(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=balanceSheetHistory`)
    const fjson = await fres.json()
    const bs = fjson && fjson.quoteSummary && fjson.quoteSummary.result && fjson.quoteSummary.result[0]
    if (bs && bs.balanceSheetHistory && bs.balanceSheetHistory.balanceSheetStatements && bs.balanceSheetHistory.balanceSheetStatements[0]) {
      const stmt = bs.balanceSheetHistory.balanceSheetStatements[0]
      const tse = stmt.totalStockholderEquity || stmt.totalEquity || null
      const shares = quote && (quote.sharesOutstanding || quote.sharesOutstanding)
      if (tse != null && shares) bookValue = tse / shares
    }
  } catch (e) {
    // ignore
  }

  const meta = cjson && cjson.chart && cjson.chart.result && cjson.chart.result[0] && cjson.chart.result[0].meta
  const priceFallback = meta && (meta.regularMarketPrice || (closes && closes.length ? closes[closes.length - 1] : null))
  const prevCloseFallback = meta && (meta.chartPreviousClose || meta.previousClose)
  const openFallback = (indicators && indicators.quote && indicators.quote[0] && indicators.quote[0].open && indicators.quote[0].open.slice(-1)[0]) || null
  const volumeFallback = (indicators && indicators.quote && indicators.quote[0] && indicators.quote[0].volume && indicators.quote[0].volume.slice(-1)[0]) || null

  const result = {
  symbol: (quote && quote.symbol) || (meta && meta.symbol) || symbol,
  currency: (quote && quote.currency) || (meta && meta.currency) || null,
  open: (quote && quote.regularMarketOpen) || openFallback || null,
  close: (quote && quote.regularMarketPreviousClose) || prevCloseFallback || null,
  prevClose: (quote && quote.regularMarketPreviousClose) || prevCloseFallback || null,
  price: (quote && quote.regularMarketPrice) || priceFallback || null,
  volume: (quote && quote.regularMarketVolume) || volumeFallback || null,
  high52: (quote && quote.fiftyTwoWeekHigh) || (meta && meta['fiftyTwoWeekHigh']) || null,
  low52: (quote && quote.fiftyTwoWeekLow) || (meta && meta['fiftyTwoWeekLow']) || null,
  rsi,
  dma50,
  dma200,
  bookValue,
  longName: (quote && (quote.longName || quote.shortName)) || (meta && meta.shortName) || null,
  summaryProfile: null,
  }
  try {
    const prof = await _fetch(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=assetProfile`)
    const pjson = await prof.json()
    const profRes = pjson && pjson.quoteSummary && pjson.quoteSummary.result && pjson.quoteSummary.result[0]
    result.summaryProfile = profRes && profRes.assetProfile && profRes.assetProfile.longBusinessSummary
  } catch (e) {
    // ignore
  }
  // include recent closes for sparkline (last 30)
  result.recentCloses = closes && closes.length ? closes.slice(-30) : []
  return result
}

// Bulk quotes: /api/quotes?symbols=AAPL,MSFT or POST body with symbols
app.get('/api/quotes', async (req, res) => {
  const symbolsParam = req.query.symbols
  if (!symbolsParam) return res.status(400).json({ error: 'symbols query required (comma separated)' })
  const symbols = symbolsParam.split(',').map(s => s.trim()).filter(Boolean)
  try {
    // Fetch in sequence to reduce burst requests (avoid rate limiting)
    const results = []
    for (const s of symbols) {
      try {
        const r = await fetchQuote(s)
        results.push(r)
      } catch (inner) {
        results.push({ symbol: s, error: String(inner && inner.message) })
      }
    }
    res.json(results)
  } catch (e) {
    res.status(500).json({ error: String(e && e.message) })
  }
})

app.get('/api/news', async (req, res) => {
  const symbol = req.query.symbol
  if (!symbol) return res.status(400).json({ error: 'symbol required' })
  try {
    const yfModule = await import('yahoo-finance2')
    const yf = yfModule && (yfModule.default || yfModule)
    // searchNews may not always be available; try news or search
    let data = []
    try {
      data = await yf.searchNews(symbol)
    } catch (inner) {
      try {
        data = await yf.news(symbol)
      } catch (inner2) {
        data = []
      }
    }
    res.json(data)
  } catch (e) {
    console.error('news error', e && (e.stack || e.message || e))
    res.status(500).json({ error: String(e && e.message) })
  }
})

const port = process.env.PORT || 4000
app.listen(port, () => console.log('server listening on', port))

// --- Symbol list download & market pagination ---
const SYMBOL_CACHE_DIR = path.join(__dirname, 'symbol-cache')
if (!fs.existsSync(SYMBOL_CACHE_DIR)) fs.mkdirSync(SYMBOL_CACHE_DIR, { recursive: true })

async function downloadText(url) {
  const maxAttempts = 3
  let lastErr = null
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await _fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
      if (!res) throw new Error('no response')
      if (!res.ok) throw new Error(`status ${res.status} ${res.statusText}`)
      return await res.text()
    } catch (e) {
      lastErr = e
      console.warn(`downloadText attempt ${attempt} failed for ${url}:`, e && e.message)
      // small backoff
      // eslint-disable-next-line no-await-in-loop
      await new Promise(r => setTimeout(r, 500 * attempt))
    }
  }
  throw new Error('Failed to fetch ' + url + ' - last error: ' + (lastErr && lastErr.message))
}

async function buildUSASymbols() {
  // Fetch NASDAQ listed symbols and other listed (NYSE)
  const nasUrls = [
    'https://ftp.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt',
    'https://ftp.nasdaqtrader.com/SymbolDirectory/nasdaqlisted.txt'
  ]
  const otherUrls = [
    'https://ftp.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt',
    'https://ftp.nasdaqtrader.com/SymbolDirectory/otherlisted.txt'
  ]
  const symbols = new Set()
  try {
    let nasTxt = null
    for (const u of nasUrls) {
      try { nasTxt = await downloadText(u); break } catch (e) { /* try next */ }
    }
    if (nasTxt) {
      nasTxt.split(/\r?\n/).forEach(line => {
        if (!line || line.startsWith('File Creation')) return
        if (line.startsWith('Symbol|')) return
        const parts = line.split('|')
        if (parts[0]) symbols.add(parts[0].trim())
      })
    } else {
      console.warn('Failed to download NASDAQ list from all known endpoints')
    }
  } catch (e) {
    console.warn('Failed to download NASDAQ list', e && e.message)
  }
  try {
    let othTxt = null
    for (const u of otherUrls) {
      try { othTxt = await downloadText(u); break } catch (e) { /* try next */ }
    }
    if (othTxt) {
      othTxt.split(/\r?\n/).forEach(line => {
        if (!line || line.startsWith('File Creation')) return
        if (line.startsWith('Symbol|')) return
        const parts = line.split('|')
        // otherlisted includes Exchange in 2nd column
        const sym = parts[0] && parts[0].trim()
        if (sym) symbols.add(sym)
      })
    } else {
      console.warn('Failed to download otherlisted symbols from all known endpoints')
    }
  } catch (e) {
    console.warn('Failed to download otherlisted', e && e.message)
  }
  // If we couldn't fetch anything, try to use builtin list in repo
  if (symbols.size === 0) {
    const builtin = path.join(__dirname, 'symbols_builtin', 'usa.json')
    if (fs.existsSync(builtin)) {
      try {
        const b = JSON.parse(fs.readFileSync(builtin, 'utf8'))
        if (Array.isArray(b) && b.length) return b
      } catch (e) { /* ignore */ }
    }
    const cacheFile = path.join(SYMBOL_CACHE_DIR, 'usa.json')
    if (fs.existsSync(cacheFile)) {
      try {
        const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'))
        if (Array.isArray(cached) && cached.length) return cached
      } catch (e) { /* ignore */ }
    }
    // last-resort small list to keep app usable
    console.warn('Falling back to small built-in USA symbol list (hardcoded)')
    return ['AAPL','MSFT','AMZN','GOOG','META','TSLA','NVDA','BRK-B','JPM','V']
  }
  return Array.from(symbols).sort()
}

async function buildIndiaSymbols() {
  // Try NSE equities list
  const urls = [
    'https://archives.nseindia.com/content/equities/EQUITY_L.csv',
    'https://www1.nseindia.com/content/equities/EQUITY_L.csv'
  ]
  for (const url of urls) {
    try {
      const txt = await downloadText(url)
      const lines = txt.split(/\r?\n/)
      const syms = []
      // CSV columns: SYMBOL,NAME,.... find header index
      lines.forEach((ln, i) => {
        if (!ln) return
        if (i === 0 && ln.toUpperCase().includes('SYMBOL')) return
        const parts = ln.split(',')
        if (parts[0] && parts[0] !== 'SYMBOL') syms.push(parts[0].trim() + '.NS')
      })
      if (syms.length) return Array.from(new Set(syms)).sort()
    } catch (e) {
      console.warn('Failed to fetch NSE list from', url, e && e.message)
    }
  }
  // fallback: small predefined list
  const builtin = path.join(__dirname, 'symbols_builtin', 'india.json')
  if (fs.existsSync(builtin)) {
    try { const b = JSON.parse(fs.readFileSync(builtin, 'utf8')); if (Array.isArray(b) && b.length) return b } catch(e) { /* ignore */ }
  }
  const cacheFile = path.join(SYMBOL_CACHE_DIR, 'india.json')
  if (fs.existsSync(cacheFile)) {
    try { const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8')); if (Array.isArray(cached) && cached.length) return cached } catch(e) { /* ignore */ }
  }
  return ['TCS.NS','RELIANCE.NS','INFY.NS','HDFC.NS','HDFCBANK.NS','ICICIBANK.NS','SBIN.NS']
}

async function getCachedSymbols(exchange) {
  const file = path.join(SYMBOL_CACHE_DIR, `${exchange}.json`)
  let list = []
  // Prefer builtin symbol lists included in the repo (avoid remote downloads when available)
  const builtinFile = path.join(__dirname, 'symbols_builtin', `${exchange}.json`)
  if (fs.existsSync(builtinFile)) {
    try {
      const builtin = JSON.parse(fs.readFileSync(builtinFile, 'utf8'))
      if (Array.isArray(builtin) && builtin.length > 0) return builtin
    } catch (e) { /* ignore and continue */ }
  }
  if (fs.existsSync(file)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
      }
      // empty cache - fall through to rebuild
    } catch(e) { /* fallthrough to rebuild */ }
  }
  if (exchange === 'usa') list = await buildUSASymbols()
  else if (exchange === 'india') list = await buildIndiaSymbols()
  // If downloads failed and returned empty list, provide a safe fallback so UI isn't empty
  if (!list || !Array.isArray(list) || list.length === 0) {
    console.warn(`Symbol list for ${exchange} is empty; using fallback list`)
    if (exchange === 'usa') list = ['AAPL','MSFT','AMZN','GOOG','META','TSLA','NVDA','BRK-B','JPM','V']
    else if (exchange === 'india') list = ['TCS.NS','RELIANCE.NS','INFY.NS','HDFC.NS','HDFCBANK.NS','ICICIBANK.NS','SBIN.NS']
  }
  try {
    fs.writeFileSync(file, JSON.stringify(list), 'utf8')
  } catch (e) {
    console.warn('Failed to write symbol cache', e && e.message)
  }
  return list
}

async function batchMap(arr, batchSize, fn, delayMs = 0, onBatch = null) {
  const out = [];
  for (let i = 0; i < arr.length; i += batchSize) {
    const slice = arr.slice(i, i + batchSize);
    const res = await Promise.all(slice.map(s => fn(s).catch(e => ({ symbol: s, error: String(e && e.message) }))));
    out.push(...res);
    if (onBatch) onBatch(out.length, arr.length);
    if (delayMs && i + batchSize < arr.length) await new Promise(r => setTimeout(r, delayMs));
  }
  return out;
}

// GET /api/market?exchange=usa|india&page=1&pageSize=100&search=&sort=price&dir=desc
// --- Market data cache ---
// Progressive background loader for each exchange
const PROGRESSIVE_BATCH_SIZE = 100;
const PROGRESSIVE_INTERVAL_MS = 60 * 1000; // 1 minute
['usa', 'india'].forEach(exchange => {
  setInterval(async () => {
    try {
      const list = await getCachedSymbols(exchange);
      let cacheKey = exchange;
      let cache = marketCache[cacheKey] || {};
      // Find uncached symbols
      const uncached = list.filter(s => !cache[s]);
      if (uncached.length === 0) return;
      const batch = uncached.slice(0, PROGRESSIVE_BATCH_SIZE);
      const fetched = await batchMap(batch, 10, fetchQuote, 1000);
      fetched.forEach(r => {
        cache[r.symbol] = r;
      });
      marketCache[cacheKey] = cache;
      marketCache[cacheKey + 'Timestamp'] = Date.now();
      console.log(`[${exchange}] Progressive batch loaded: ${batch.length}, cached: ${Object.keys(cache).length}/${list.length}`);
    } catch (e) {
      console.error(`[${exchange}] Progressive loader error:`, e);
    }
  }, PROGRESSIVE_INTERVAL_MS);
});
const marketCache = {
  usa: {}, // symbol -> data
  india: {},
  usaTimestamp: 0,
  indiaTimestamp: 0,
}

app.get('/api/market', async (req, res) => {
  const exchange = (req.query.exchange || 'usa').toLowerCase();
  const page = Math.max(1, parseInt(req.query.page || '1'));
  const pageSize = Math.max(10, Math.min(500, parseInt(req.query.pageSize || '100')));
  const search = (req.query.search || '').trim().toLowerCase();
  const sort = req.query.sort || 'symbol';
  const dir = (req.query.dir || 'asc').toLowerCase();
  const refresh = req.query.refresh === '1';
  const loadAll = req.query.all === '1';
  try {
    let cacheKey = exchange;
    let cacheTimestampKey = exchange + 'Timestamp';
    let cache = marketCache[cacheKey];
    let cacheTime = marketCache[cacheTimestampKey];
    const CACHE_TTL = 60 * 60 * 1000; // 1 hour
    const list = await getCachedSymbols(exchange);

    // Only fetch and cache tickers for the current page or search
    let symbolsToFetch = [];
    let filteredSymbols = list;
    if (search) {
      filteredSymbols = list.filter(s => s.toLowerCase().includes(search));
    }
    const total = filteredSymbols.length;
    const start = (page - 1) * pageSize;
    const pageSymbols = filteredSymbols.slice(start, start + pageSize);
    // Find which symbols are missing from cache
    symbolsToFetch = pageSymbols.filter(s => !cache[s]);
    // If searching, prioritize fetching the searched symbol if not cached
    if (search && filteredSymbols.length === 1 && !cache[filteredSymbols[0]]) {
      symbolsToFetch = [filteredSymbols[0]];
    }
    // Fetch missing symbols in batches of 10
    if (symbolsToFetch.length > 0) {
      const fetched = await batchMap(symbolsToFetch, 10, fetchQuote, 1000);
      fetched.forEach(r => {
        // Use correct price and prevClose from API response
        const price = r && typeof r.price === 'number' ? r.price : (r.price != null ? Number(r.price) : null);
        const prev = r && typeof r.prevClose === 'number' ? r.prevClose : (r.prevClose != null ? Number(r.prevClose) : null);
        const vol = r && typeof r.volume === 'number' ? r.volume : (r.volume != null ? Number(r.volume) : null);
        r.chg = (price != null && prev != null) ? (price - prev) : null;
        r.pct = (r.chg != null && prev != null && prev !== 0) ? (r.chg / prev * 100) : null;
        r.value = (price != null && vol != null) ? (price * vol) : null;
        cache[r.symbol] = r;
      });
      marketCache[cacheKey] = cache;
      marketCache[cacheTimestampKey] = Date.now();
    }

    // Use cached data for all sorting/filtering/pagination
    let filtered = filteredSymbols.map(s => cache[s] || { symbol: s });
    if (sort) {
      filtered = [...filtered].sort((a, b) => {
        if (sort === 'symbol') {
          const sa = a && a.symbol ? String(a.symbol).toUpperCase() : '';
          const sb = b && b.symbol ? String(b.symbol).toUpperCase() : '';
          if (sa < sb) return dir === 'asc' ? -1 : 1;
          if (sa > sb) return dir === 'asc' ? 1 : -1;
          return 0;
        }
        const av = a && a[sort] != null ? Number(a[sort]) : (dir === 'asc' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
        const bv = b && b[sort] != null ? Number(b[sort]) : (dir === 'asc' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
        return dir === 'asc' ? (av - bv) : (bv - av);
      });
    }
    const results = loadAll ? filtered : filtered.slice(0, pageSize);
    // Progress: percent of cached tickers for this exchange
    const loadedCount = Object.keys(cache).length;
    const totalToFetch = list.length;
    const progress = Math.round((loadedCount / totalToFetch) * 100);
    res.json({ total, page, pageSize, results, progress, loadedCount, totalToFetch });
  } catch (e) {
    res.status(500).json({ error: String(e && e.message) });
  }
});
