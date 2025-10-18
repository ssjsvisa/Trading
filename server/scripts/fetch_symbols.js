const fs = require('fs')
const path = require('path')

// Simple fetch wrapper that works in Node 18+ or with node-fetch
let _fetch = global.fetch
if (!_fetch) {
  try {
    _fetch = (...args) => import('node-fetch').then(m => m.default(...args))
  } catch (e) {
    console.error('no fetch available; please run with Node 18+ or install node-fetch')
    process.exit(1)
  }
}

const SYMBOL_CACHE_DIR = path.join(__dirname, '..', 'symbol-cache')
if (!fs.existsSync(SYMBOL_CACHE_DIR)) fs.mkdirSync(SYMBOL_CACHE_DIR, { recursive: true })

async function downloadText(url, attempts = 3) {
  let lastErr
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await _fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      return await res.text()
    } catch (e) {
      lastErr = e
      console.warn(`download attempt ${i} failed for ${url}: ${e && e.message}`)
      await new Promise(r => setTimeout(r, 500 * i))
    }
  }
  throw new Error('Failed to download ' + url + ': ' + (lastErr && lastErr.message))
}

async function buildUSASymbols() {
  const nasUrls = [
    'https://ftp.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt',
    'https://ftp.nasdaqtrader.com/SymbolDirectory/nasdaqlisted.txt'
  ]
  const otherUrls = [
    'https://ftp.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt',
    'https://ftp.nasdaqtrader.com/SymbolDirectory/otherlisted.txt'
  ]
  const symbols = new Set()
  for (const u of nasUrls) {
    try {
      const txt = await downloadText(u)
      txt.split(/\r?\n/).forEach(line => {
        if (!line || line.startsWith('File Creation')) return
        if (line.startsWith('Symbol|')) return
        const parts = line.split('|')
        if (parts[0]) symbols.add(parts[0].trim())
      })
      break
    } catch (e) {
      console.warn('nasdaq url failed:', u, e.message)
    }
  }
  for (const u of otherUrls) {
    try {
      const txt = await downloadText(u)
      txt.split(/\r?\n/).forEach(line => {
        if (!line || line.startsWith('File Creation')) return
        if (line.startsWith('Symbol|')) return
        const parts = line.split('|')
        const sym = parts[0] && parts[0].trim()
        if (sym) symbols.add(sym)
      })
      break
    } catch (e) {
      console.warn('otherlisted url failed:', u, e.message)
    }
  }
  return Array.from(symbols).sort()
}

async function buildIndiaSymbols() {
  const urls = [
    'https://archives.nseindia.com/content/equities/EQUITY_L.csv',
    'https://www1.nseindia.com/content/equities/EQUITY_L.csv'
  ]
  for (const url of urls) {
    try {
      const txt = await downloadText(url)
      const lines = txt.split(/\r?\n/)
      const syms = []
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
  throw new Error('Failed to build India symbols from known endpoints')
}

async function main() {
  try {
    console.log('Building USA symbol list...')
    const usa = await buildUSASymbols()
    if (!usa || usa.length === 0) throw new Error('No USA symbols downloaded')
    fs.writeFileSync(path.join(SYMBOL_CACHE_DIR, 'usa.json'), JSON.stringify(usa, null, 2), 'utf8')
    console.log('Wrote', usa.length, 'USA symbols to', path.join(SYMBOL_CACHE_DIR, 'usa.json'))
  } catch (e) {
    console.error('Failed to build USA symbols:', e && e.message)
  }

  try {
    console.log('Building India symbol list...')
    const ind = await buildIndiaSymbols()
    if (!ind || ind.length === 0) throw new Error('No India symbols downloaded')
    fs.writeFileSync(path.join(SYMBOL_CACHE_DIR, 'india.json'), JSON.stringify(ind, null, 2), 'utf8')
    console.log('Wrote', ind.length, 'India symbols to', path.join(SYMBOL_CACHE_DIR, 'india.json'))
  } catch (e) {
    console.error('Failed to build India symbols:', e && e.message)
  }
  console.log('Done')
}

main().catch(e => { console.error(e && e.stack); process.exit(1) })
