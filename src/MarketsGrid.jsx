import React, { useEffect, useState } from 'react'
import ColumnFilters from './ColumnFilters';
import axios from 'axios'

export default function MarketsGrid({ exchange }) {
  const [sheetRows, setSheetRows] = useState([]);
  const [viewSymbol, setViewSymbol] = useState(null);
  const [alphaData, setAlphaData] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
  // Column definitions for filters
  const columns = [
    { key: 'symbol', label: 'Symbol', type: 'string' },
    { key: 'longName', label: 'Name', type: 'string' },
    { key: 'price', label: 'LTP', type: 'number' },
    { key: 'pe', label: 'PE', type: 'number' },
    { key: 'dma50', label: '50DMA', type: 'number' },
    { key: 'dma200', label: '200DMA', type: 'number' },
    { key: 'volume', label: 'Volume', type: 'number' },
    { key: 'high52w', label: '52W H', type: 'number' },
    { key: 'low52w', label: '52W L', type: 'number' },
    { key: 'rsi', label: 'RSI', type: 'number' },
  ];
  const [colFilters, setColFilters] = useState({});
  const PAGE_SIZE = 100;
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState('symbol');
  const [dir, setDir] = useState('asc');
  const [progress, setProgress] = useState(100);
  const [loadedCount, setLoadedCount] = useState(0);
  const [totalToFetch, setTotalToFetch] = useState(0);

  const loadPage = async (p = 1) => {
    setLoading(true);
    try {
  const apiUrl = import.meta.env.VITE_API_MARKET_URL || '/api/market';
  const res = await axios.get(`${apiUrl}?exchange=${exchange}&page=${p}&pageSize=${PAGE_SIZE}&sort=${sort}&dir=${dir}${filter ? `&search=${encodeURIComponent(filter)}` : ''}`);
      if (p === 1) setRows(res.data.results);
      else setRows(prev => [...prev, ...res.data.results]);
      setTotal(res.data.total);
      setPage(res.data.page);
      setProgress(res.data.progress ?? 100);
      setLoadedCount(res.data.loadedCount ?? 0);
      setTotalToFetch(res.data.totalToFetch ?? 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPage(1); }, [exchange, filter, sort, dir]);

  // Fetch Google Sheet CSV for the selected exchange
  useEffect(() => {
    async function fetchSheet() {
      let csvUrl = '';
      if (exchange === 'usa') {
        csvUrl = import.meta.env.VITE_SHEET_URL_USA;
      } else if (exchange === 'india') {
        csvUrl = import.meta.env.VITE_SHEET_URL_INDIA;
      }
      if (!csvUrl) { setSheetRows([]); return; }
      try {
        const res = await fetch(csvUrl);
        const text = await res.text();
        // Simple CSV parse
        const lines = text.split(/\r?\n/).filter(Boolean);
        const headers = lines[0].split(',');
        const data = lines.slice(1).map(line => {
          const vals = line.split(',');
          const obj = {};
          headers.forEach((h, i) => {
            let v = vals[i] ? vals[i].trim() : '';
            // Remove surrounding quotes if present
            if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
            obj[h.trim()] = v;
          });
          return obj;
        });
        setSheetRows(data);
      } catch (e) { setSheetRows([]); }
    }
    fetchSheet();
  }, [exchange]);

  // Filter rows by column filters (all filters must match)
  // Only show rows that are actually loaded (have price or other key data)
  const loadedRows = rows.filter(r => r && r.price != null);
  const filteredRows = loadedRows.filter(r =>
    columns.every(col => {
      let val = r[col.key];
      // For 52W H and 52W L, fallback to high52/low52 if high52w/low52w are missing
      if (col.key === 'high52w') val = (r.high52w != null ? r.high52w : r.high52);
      if (col.key === 'low52w') val = (r.low52w != null ? r.low52w : r.low52);
      const filterVal = colFilters[col.key];
      if (!filterVal) return true;
      if (val == null) return false;
      if (col.type === 'number') {
        // Custom logic for 52W H filter: Distance from 52W High (%)
        if (col.key === 'high52w' && r.price != null && val != null && val !== 0) {
          const dist = ((val - r.price) / val) * 100;
          if (filterVal.startsWith('<')) {
            const num = parseFloat(filterVal.slice(1));
            if (!isNaN(num)) {
              return dist < num;
            }
          } else if (filterVal.startsWith('>')) {
            const num = parseFloat(filterVal.slice(1));
            if (!isNaN(num)) {
              return dist > num;
            }
          }
        }
        // Custom logic for 52W L filter: Distance from 52W Low (%)
        if (col.key === 'low52w' && r.price != null && val != null && val !== 0) {
          const dist = ((r.price - val) / val) * 100;
          if (filterVal.startsWith('<')) {
            const num = parseFloat(filterVal.slice(1));
            if (!isNaN(num)) {
              return dist < num;
            }
          } else if (filterVal.startsWith('>')) {
            const num = parseFloat(filterVal.slice(1));
            if (!isNaN(num)) {
              return dist > num;
            }
          }
        }
        // Default logic for other number columns
        if (filterVal.startsWith('<')) {
          const num = parseFloat(filterVal.slice(1));
          return !isNaN(num) && Number(val) < num;
        } else if (filterVal.startsWith('>')) {
          const num = parseFloat(filterVal.slice(1));
          return !isNaN(num) && Number(val) > num;
        } else if (!isNaN(Number(filterVal))) {
          return String(val).includes(filterVal);
        } else {
          return true;
        }
      } else {
        return String(val).toLowerCase().includes(filterVal.toLowerCase());
      }
    })
  );

  const Sparkline = ({ data }) => {
    if (!data || data.length === 0) return <div className="sparkline" />;
    const w = 80, h = 24, pad = 2;
    const min = Math.min(...data), max = Math.max(...data);
    const points = data.map((v, i) => {
      const x = pad + (i / (data.length - 1)) * (w - pad * 2);
      const y = h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2);
      return `${x},${y}`;
    }).join(' ');
    return (
      <svg className="sparkline" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <polyline fill="none" stroke="#b0b0b0" strokeWidth="1.5" points={points} />
      </svg>
    );
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const toggleSort = (field) => {
    if (sort === field) {
      setDir(d => (d === 'asc' ? 'desc' : 'asc'));
      setPage(1);
      setRows([]);
    } else {
      setSort(field);
      setDir('asc');
      setPage(1);
      setRows([]);
    }
  };

  const loadAll = async () => {
    if (loading) return;
    setLoading(true);
    try {
  const apiUrl = import.meta.env.VITE_API_MARKET_URL || '/api/market';
  const res = await axios.get(`${apiUrl}?exchange=${exchange}&all=1&sort=${sort}&dir=${dir}${filter ? `&search=${encodeURIComponent(filter)}` : ''}`);
      setRows(res.data.results);
      setTotal(res.data.total);
      setPage(1);
      setProgress(res.data.progress ?? 100);
      setLoadedCount(res.data.loadedCount ?? 0);
      setTotalToFetch(res.data.totalToFetch ?? 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const Spinner = () => (
    <svg width="18" height="18" viewBox="0 0 50 50" aria-hidden>
      <circle cx="25" cy="25" r="20" fill="none" stroke="#b0b0b0" strokeWidth="4" strokeLinecap="round">
        <animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="1s" repeatCount="indefinite" />
      </circle>
    </svg>
  );


  // Helper to clean symbol for matching
  function cleanSymbol(s) {
    if (!s) return '';
    let sym = s.trim();
    if (sym.startsWith('"') && sym.endsWith('"')) sym = sym.slice(1, -1);
    sym = sym.replace(/\s+/g, ''); // remove all spaces
    return sym.toUpperCase();
  }

  // Build a symbol-to-PE map from sheetRows
  const peMap = React.useMemo(() => {
    const map = {};
    sheetRows.forEach(r => {
      const sym = cleanSymbol(r.Symbol);
      if (r.PE) map[sym] = r.PE;
    });
    return map;
  }, [sheetRows]);

  // Find matching row in sheet for viewSymbol
  const sheetData = viewSymbol ? sheetRows.find(r => {
    return cleanSymbol(r.Symbol) === cleanSymbol(viewSymbol);
  }) : null;

  const closePopup = () => {
    setViewSymbol(null);
    setAlphaData(null);
  };

  return (
    <div className="markets-grid metallic-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div className="grid-progress" style={{ color: '#e0e0e0', fontWeight: 600 }}>
          Loading market data: {progress}% ({loadedCount} / {totalToFetch})
        </div>
        <div className="grid-count-label" style={{ color: '#e0e0e0', fontWeight: 600, fontSize: 15, textAlign: 'right' }}>
          Page {page} / {totalPages} &bull; {total.toLocaleString()} items
          {filteredRows.length !== total && (
            <span style={{ marginLeft: 12, color: '#90caf9', fontWeight: 500 }}>
              Filtered: {filteredRows.length} items
            </span>
          )}
        </div>
      </div>
      <div className="grid-controls">
        <input className="metallic-input" placeholder="Search symbol or name" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <div className="grid-info">
          <button className="metallic-btn" onClick={() => loadPage(1)} disabled={loading}>Reload</button>
          <button className="metallic-btn" onClick={loadAll} disabled={loading || rows.length >= total}>Load all</button>
        </div>
      </div>
      {loading && <div className="grid-loading"><Spinner /> <span>Loading...</span></div>}
      <table className="metallic-table">
        <thead>
          <tr>
            <th className="sortable" onClick={() => toggleSort('symbol')}>Symbol {sort === 'symbol' ? (dir === 'asc' ? '▲' : '▼') : ''}</th>
            <th className="sortable" onClick={() => toggleSort('longName')}>Name {sort === 'longName' ? (dir === 'asc' ? '▲' : '▼') : ''}</th>
            <th className="sortable" onClick={() => toggleSort('price')}>LTP {sort === 'price' ? (dir === 'asc' ? '▲' : '▼') : ''}</th>
            <th className="sortable" onClick={() => toggleSort('pe')}>PE {sort === 'pe' ? (dir === 'asc' ? '▲' : '▼') : ''}</th>
            <th>50DMA</th>
            <th>200DMA</th>
            <th className="sortable" onClick={() => toggleSort('volume')}>Volume {sort === 'volume' ? (dir === 'asc' ? '▲' : '▼') : ''}</th>
            <th className="sortable" onClick={() => toggleSort('high52')}>52W H {sort === 'high52' ? (dir === 'asc' ? '▲' : '▼') : ''}</th>
            <th className="sortable" onClick={() => toggleSort('low52')}>52W L {sort === 'low52' ? (dir === 'asc' ? '▲' : '▼') : ''}</th>
            <th className="sortable" onClick={() => toggleSort('rsi')}>RSI {sort === 'rsi' ? (dir === 'asc' ? '▲' : '▼') : ''}</th>
            <th>Today</th>
            <th>View</th>
          </tr>
          <ColumnFilters filters={colFilters} setFilters={setColFilters} columns={columns} />
        </thead>
        <tbody>
          {filteredRows.map((r, i) => {
            const chg = (r.price != null && r.prevClose != null) ? (r.price - r.prevClose) : null;
            const pct = (chg != null && r.prevClose) ? (chg / r.prevClose * 100) : null;
            const value = (r.price != null && r.volume != null) ? (r.price * r.volume) : null;
            const tvUrl = exchange === 'india'
              ? `https://www.tradingview.com/symbols/NSE-${r.symbol.replace(/\.NS$/i, '')}/`
              : `https://www.tradingview.com/symbols/${r.symbol}/`;
            const peVal = peMap[cleanSymbol(r.symbol)] || '-';
            return (
              <tr key={i}>
                <td><a href={tvUrl} target="_blank" rel="noopener noreferrer" className="symbol-link">{r.symbol}</a></td>
                <td>{r.longName || '-'}</td>
                <td className="bold">{r.price !== null && r.price !== undefined ? Number(r.price).toFixed(2) : '-'}</td>
                <td>{peVal}</td>
                <td>{r.dma50 !== null && r.dma50 !== undefined ? Number(r.dma50).toFixed(2) : '-'}</td>
                <td>{r.dma200 !== null && r.dma200 !== undefined ? Number(r.dma200).toFixed(2) : '-'}</td>
                <td>{r.volume !== null && r.volume !== undefined ? Number(r.volume).toLocaleString() : '-'}</td>
                <td>{(r.high52w !== null && r.high52w !== undefined) ? Number(r.high52w).toFixed(2) : (r.high52 !== null && r.high52 !== undefined ? Number(r.high52).toFixed(2) : '-')}</td>
                <td>{(r.low52w !== null && r.low52w !== undefined) ? Number(r.low52w).toFixed(2) : (r.low52 !== null && r.low52 !== undefined ? Number(r.low52).toFixed(2) : '-')}</td>
                <td>{r.rsi ? Number(r.rsi).toFixed(2) : '-'}</td>
                <td><Sparkline data={r.recentCloses} /></td>
                <td>
                  <button className="metallic-btn" style={{padding:'2px 8px',fontSize:13}} onClick={() => setViewSymbol(r.symbol)}>View</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length < total && (
        <div className="grid-loadmore">
          <button className="metallic-btn" onClick={() => loadPage(page + 1)} disabled={loading}>Load more</button>
        </div>
      )}
    {/* Popup for Google Sheet info */}
    {viewSymbol && (
      <div className="alpha-popup-overlay" style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.45)',zIndex:9999,display:'flex',alignItems:'flex-start',justifyContent:'flex-end'}}>
        <div className="alpha-popup metallic-panel" style={{minWidth:350,maxWidth:500,padding:24,margin:'32px 32px 0 0',borderRadius:8,background:'#222',color:'#e0e0e0',boxShadow:'0 2px 16px #000'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
            <div style={{fontWeight:700,fontSize:18}}>Sheet Data: {viewSymbol}</div>
            <button className="metallic-btn" style={{fontSize:16,padding:'2px 10px'}} onClick={closePopup}>Close</button>
          </div>
          {sheetData ? (
            <table style={{width:'100%',fontSize:15}}>
              <tbody>
                {Object.entries(sheetData).map(([k,v]) => (
                  <tr key={k}>
                    <td style={{fontWeight:600,padding:'4px 8px',textAlign:'right'}}>{k}</td>
                    <td style={{padding:'4px 8px'}}>{v !== null && v !== undefined ? v : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{color:'#f88'}}>No data found for this symbol in the sheet.</div>
          )}
        </div>
      </div>
    )}
  </div>
  );
}
