# Trading React (free-data)

This repository now contains a minimal React frontend (Vite) that demonstrates fetching free market data from Alpha Vantage (requires a free API key from https://www.alphavantage.co).

All resources used here are free: Alpha Vantage has a free tier for personal use, and the app uses client-side requests (for demo only). If you want production usage, you should proxy requests server-side to protect API keys and respect rate limits.

Run locally (Windows PowerShell):

```powershell
cd 'D:\ssjsvisa\Trading'
npm install
npm run dev
```

Open the printed local URL (usually http://localhost:5173) and enter your free Alpha Vantage API key to fetch daily data for a symbol.

Next steps I can help with:
- Add client-side caching and charting (using Chart.js or Recharts)
- Add a small Node.js proxy to keep the Alpha Vantage key secret (still free tier)
- Wire multiple free data sources (yfinance via server) or add paper trading connectors (Alpaca paper API — free with signup)

Server proxy (Yahoo Finance)
-----------------------------
I added a small Express server in `server/` that uses `yahoo-finance2` to fetch quotes, historicals and news, and computes RSI and an approximate book value where possible.

Run server:

```powershell
cd server
npm install
npm start
```

Client dev with proxy (in project root):

```powershell
npm install
npm start
```

API endpoints (development proxied):
- GET /api/quote?symbol=AAPL  — returns quote fields, 52-week high/low, volume, RSI, bookValue, company profile
- GET /api/news?symbol=AAPL   — returns news items from Yahoo searchNews


