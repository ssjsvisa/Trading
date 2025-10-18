import React, { useState } from 'react'
import axios from 'axios'
import MarketsGrid from './MarketsGrid'
import SheetMarketGrid from './SheetMarketGrid'

function QuotePanel({ symbol }) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [news, setNews] = useState(null)
  const [error, setError] = useState('')

  const fetch = async () => {
    setLoading(true)
    setError('')
    try {
      const q = await axios.get(`/api/quote?symbol=${encodeURIComponent(symbol)}`)
      setData(q.data)
      const n = await axios.get(`/api/news?symbol=${encodeURIComponent(symbol)}`)
      setNews(n.data)
    } catch (e) {
      setError(String(e && e.response && e.response.data && e.response.data.error) || String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={fetch} disabled={loading}>Refresh</button>
      </div>
      {error && <div className="error">{error}</div>}
      {loading && <div>Loading...</div>}
      {data && (
        <div className="quote">
          <h2>{data.longName || data.symbol}</h2>
          <div>Price: {data.price !== null && data.price !== undefined ? Number(data.price).toFixed(2) : '-'} {data.currency}</div>
          <div>Open: {data.open !== null && data.open !== undefined ? Number(data.open).toFixed(2) : '-'} Close: {data.close !== null && data.close !== undefined ? Number(data.close).toFixed(2) : '-'} PrevClose: {data.prevClose !== null && data.prevClose !== undefined ? Number(data.prevClose).toFixed(2) : '-'}</div>
          <div>52W High: {data.high52 !== null && data.high52 !== undefined ? Number(data.high52).toFixed(2) : '-'} 52W Low: {data.low52 !== null && data.low52 !== undefined ? Number(data.low52).toFixed(2) : '-'} Volume: {data.volume ? Number(data.volume).toLocaleString() : '-'}</div>
          <div>RSI: {data.rsi ? Number(data.rsi).toFixed(2) : 'n/a'}</div>
          <div>Book Value (approx): {data.bookValue ? Number(data.bookValue).toFixed(2) : 'n/a'}</div>
          <h3>Company Info</h3>
          <pre className="data">{data.summaryProfile || 'No profile available'}</pre>
        </div>
      )}
      {news && (
        <div>
          <h3>Latest News</h3>
          <ul>
            {news.map((item, i) => (
              <li key={i}><a href={item.url} target="_blank" rel="noreferrer">{item.title}</a> <small>{item.publisher}</small></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [exchange, setExchange] = useState('usa');
  const [view, setView] = useState('api'); // 'api' or 'sheet'

  return (
    <div className="container metallic-bg">
      <div className="centered">
        <h1 className="metallic-title">Market Quotes <span className="subtitle">USA & India</span></h1>
        <div className="controls metallic-controls">
          <button className={exchange === 'usa' ? 'active metallic-btn' : 'metallic-btn'} onClick={() => setExchange('usa')}>USA</button>
          <button className={exchange === 'india' ? 'active metallic-btn' : 'metallic-btn'} onClick={() => setExchange('india')}>India</button>
          <button className={view === 'api' ? 'active metallic-btn' : 'metallic-btn'} style={{marginLeft:16}} onClick={() => setView('api')}>API Market Grid</button>
          <button className={view === 'sheet' ? 'active metallic-btn' : 'metallic-btn'} onClick={() => setView('sheet')}>Sheet Market Grid</button>
        </div>
      </div>

      <div className="central-view">
        {view === 'api' ? (
          <div>
            <h2 className="metallic-sub">{exchange === 'usa' ? 'USA Market' : 'India Market (NSE)'}</h2>
            <MarketsGrid exchange={exchange} />
          </div>
        ) : (
          <div>
            <h2 className="metallic-sub">{exchange === 'usa' ? 'USA Market (Sheet)' : 'India Market (Sheet)'}</h2>
            <SheetMarketGrid exchange={exchange} />
          </div>
        )}
      </div>
    </div>
  );
}
