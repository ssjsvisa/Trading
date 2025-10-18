import React, { useEffect, useState } from 'react';
import ColumnFilters from './ColumnFilters';

export default function SheetMarketGrid({ exchange }) {
  // Use the same columns as MarketsGrid
  const columns = [
  { key: 'symbol', label: 'Symbol', type: 'string' },
  { key: 'longName', label: 'Name', type: 'string' },
  { key: 'price', label: 'LTP', type: 'number' },
  { key: 'pe', label: 'PE', type: 'number' },
  { key: 'eps', label: 'EPS', type: 'number' },
  { key: 'mrtcap', label: 'MRT CAP', type: 'number' },
  { key: 'pctch', label: '%CH', type: 'number' },
  { key: 'dma50', label: '50DMA', type: 'number' },
    { key: 'dma200', label: '200DMA', type: 'number' },
    { key: 'volume', label: 'Volume', type: 'number' },
    { key: 'high52w', label: '52W H', type: 'number' },
    { key: 'low52w', label: '52W L', type: 'number' },
    { key: 'rsi', label: 'RSI', type: 'number' },
  ];
  const [sheetRows, setSheetRows] = useState([]);
  const [colFilters, setColFilters] = useState({});
  const [loading, setLoading] = useState(false);

  // Fetch Google Sheet CSV for the selected exchange
  useEffect(() => {
  async function fetchSheet() {
      setLoading(true);
      let csvUrl = '';
      if (exchange === 'usa') {
        csvUrl = import.meta.env.VITE_SHEET_URL_USA;
      } else if (exchange === 'india') {
        csvUrl = import.meta.env.VITE_SHEET_URL_INDIA;
      }
      if (!csvUrl) { setSheetRows([]); setLoading(false); return; }
      try {
        const res = await fetch(csvUrl);
        const text = await res.text();
        const lines = text.split(/\r?\n/).filter(Boolean);
        const headers = lines[0].split(',');
        const data = lines.slice(1).map(line => {
          const vals = line.split(',');
          const obj = {};
          headers.forEach((h, i) => {
            let v = vals[i] ? vals[i].trim() : '';
            if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
            obj[h.trim()] = v;
          });
          return obj;
        });
        if (data.length > 0) {
          // Debug: print the actual keys of the first row
          // eslint-disable-next-line no-console
          // console.log('Sheet first row keys:', Object.keys(data[0]));
        }
        setSheetRows(data);
      } catch (e) { setSheetRows([]); }
      setLoading(false);
    }
    fetchSheet();
  }, [exchange]);

  // Helper to clean symbol for matching
  function cleanSymbol(s) {
    if (!s) return '';
    let sym = s.trim();
    if (sym.startsWith('"') && sym.endsWith('"')) sym = sym.slice(1, -1);
    sym = sym.replace(/\s+/g, '');
    return sym.toUpperCase();
  }

  // Only show rows that are actually loaded (have LTP)
  const loadedRows = sheetRows.filter(r => r && r['LTP'] != null);
  const filteredRows = loadedRows.filter(r =>
    columns.every(col => {
      let val = r[col.label];
      // For 50DMA, use only '50DMA' header
      if (col.label === '50DMA') val = r['50DMA'];
  // For 52W H and 52W L, fallback to sheet label if missing
  if (col.label === '52W H') val = r['52W H'] != null ? r['52W H'] : r['high52w'];
  if (col.label === '52W L') val = r['52W L'] != null ? r['52W L'] : r['low52w'];
      const filterVal = colFilters[col.key];
      if (!filterVal) return true;
      if (val == null) return false;
      if (col.type === 'number') {
        // 52W H: percent distance or direct value (API grid logic)
        if (col.label === '52W H' && r['LTP'] != null && val != null && val !== 0) {
          const priceNum = Number(r['LTP']);
          const valNum = Number(val);
          if (!isNaN(priceNum) && !isNaN(valNum) && valNum !== 0) {
            const dist = ((valNum - priceNum) / valNum) * 100;
            if (filterVal.startsWith('<')) {
              const num = parseFloat(filterVal.slice(1));
              if (!isNaN(num)) return dist < num;
              return false;
            } else if (filterVal.startsWith('>')) {
              const num = parseFloat(filterVal.slice(1));
              if (!isNaN(num)) return dist > num;
              return false;
            } else if (!isNaN(Number(filterVal))) {
              // direct value match
              return String(valNum).includes(filterVal);
            } else {
              return true;
            }
          }
          return false;
        }
        // 52W L: percent distance or direct value (API grid logic)
        if (col.label === '52W L' && r['LTP'] != null && val != null && val !== 0) {
          const priceNum = Number(r['LTP']);
          const valNum = Number(val);
          if (!isNaN(priceNum) && !isNaN(valNum) && valNum !== 0) {
            const dist = ((priceNum - valNum) / valNum) * 100;
            if (filterVal.startsWith('<')) {
              const num = parseFloat(filterVal.slice(1));
              if (!isNaN(num)) return dist < num;
              return false;
            } else if (filterVal.startsWith('>')) {
              const num = parseFloat(filterVal.slice(1));
              if (!isNaN(num)) return dist > num;
              return false;
            } else if (!isNaN(Number(filterVal))) {
              // direct value match
              return String(valNum).includes(filterVal);
            } else {
              return true;
            }
          }
          return false;
        }
        // Default logic for other number columns
        if (filterVal.startsWith('<')) {
          const num = parseFloat(filterVal.slice(1));
          return !isNaN(num) && Number(val) < num;
        } else if (filterVal.startsWith('>')) {
          const num = parseFloat(filterVal.slice(1));
          return !isNaN(num) && Number(val) > num;
        } else if (!isNaN(Number(filterVal))) {
          return String(Number(val)).includes(filterVal);
        } else {
          return true;
        }
      } else {
        return String(val).toLowerCase().includes(filterVal.toLowerCase());
      }
    })
  );

  // Debug: print first 5 50DMA values from filteredRows
  if (filteredRows.length > 0) {
  // eslint-disable-next-line no-console
  // console.log('First 5 50DMA values:', filteredRows.slice(0, 5).map(r => r['50DMA']));
  }
  return (
    <div className="markets-grid metallic-panel">
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 8 }}>
        <div className="grid-count-label" style={{ color: '#e0e0e0', fontWeight: 600, fontSize: 15, textAlign: 'right', minWidth: 120 }}>
          {filteredRows.length} items
        </div>
      </div>
      {/* Remove grid-controls div and move ColumnFilters into <thead> */}
      {loading && <div className="grid-loading">Loading...</div>}
      <table className="metallic-table">
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.key}>{col.label}</th>
            ))}
          </tr>
            <tr>
              {columns.map(col => (
                <th key={col.key}>
                  <input
                    type="text"
                    value={colFilters[col.key] || ''}
                    onChange={e => setColFilters(f => ({ ...f, [col.key]: e.target.value }))}
                    placeholder={`Filter ${col.label}`}
                    style={{ width: '90%', fontSize: '12px', padding: '2px 4px', borderRadius: 4, border: '1px solid #1976d2' }}
                  />
                </th>
              ))}
            </tr>
        </thead>
        <tbody>
          {filteredRows.map((r, i) => (
            <tr key={i}>
              {columns.map(col => {
                let cell;
                if (col.key === 'symbol') {
                  const symbol = r[col.label] || r[col.key] || '-';
                  let tvSymbol = symbol;
                  // For USA, append exchange suffix if missing (e.g., NASDAQ: or NYSE:)
                  if (exchange === 'usa' && symbol && symbol !== '-') {
                    // Try to detect exchange from sheet, fallback to NASDAQ
                    let exch = r['Exchange'] || '';
                    if (exch) {
                      tvSymbol = `${exch}:${symbol}`;
                    } else {
                      tvSymbol = `NASDAQ:${symbol}`;
                    }
                  }
                  // For India, use NSE:SYMBOL
                  if (exchange === 'india' && symbol && symbol !== '-') {
                    // If symbol already contains 'NSE', remove it
                    let cleanSymbol = symbol.replace(/^NSE[-:]/i, '').replace(/^NSE/i, '').replace(/\s+/g, '');
                    tvSymbol = `NSE:${cleanSymbol}`;
                  }
                  // TradingView symbol page link format: https://www.tradingview.com/symbols/{EXCHANGE}-{SYMBOL}/
                  let tvLink = '-';
                  if (tvSymbol && tvSymbol.includes(':')) {
                    const [exch, sym] = tvSymbol.split(':');
                    tvLink = exch === 'NSE' && sym ? `https://www.tradingview.com/symbols/${exch}-${sym}/` : `https://www.tradingview.com/symbols/${exch}-${sym}/`;
                  }
                  cell = symbol === '-' ? '-' : (
                    <a
                      href={tvLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={tvLink}
                      className="symbol-link"
                    >
                      {symbol}
                    </a>
                  );
// Add CSS for symbol link hover effect
// You can move this to your main CSS file if preferred
const style = document.createElement('style');
style.innerHTML = `
  .symbol-link {
    color: #1976d2;
    text-decoration: underline;
    font-weight: 600;
    transition: color 0.2s;
  }
  .symbol-link:hover {
    color: #fff !important;
  }
`;
if (typeof window !== 'undefined' && !document.getElementById('symbol-link-style')) {
  style.id = 'symbol-link-style';
  document.head.appendChild(style);
}
                } else if (col.label === '50DMA') {
                  cell = r['50DMA'];
                  if (typeof cell === 'string') cell = cell.trim();
                  if (cell === '#N/A' || cell === '' || cell === undefined) cell = '-';
                  else if (!isNaN(Number(cell))) cell = Number(cell).toFixed(3).replace(/\.000$/, '');
                  else cell = '-';
                } else {
                  cell = r[col.label] || r[col.key] || '-';
                  if (cell === '#N/A' || cell === '' || cell === undefined) cell = '-';
                }
                return <td key={col.key}>{cell}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
