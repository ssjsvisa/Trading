// This script fetches the official NSE equity list and updates india.json with all tickers (2000+)
const fs = require('fs');
const https = require('https');
const path = require('path');

const url = 'https://archives.nseindia.com/content/equities/EQUITY_L.csv';
const outFile = path.join(__dirname, '../symbols_builtin/india.json');

function fetchCSV(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

(async () => {
  try {
    const csv = await fetchCSV(url);
    const lines = csv.split(/\r?\n/);
    const tickers = [];
    for (let i = 1; i < lines.length; ++i) {
      const cols = lines[i].split(',');
      if (cols[0] && /^[A-Z0-9]+$/.test(cols[0])) tickers.push(cols[0].trim() + '.NS');
    }
    const unique = Array.from(new Set(tickers)).sort();
    fs.writeFileSync(outFile, JSON.stringify(unique, null, 2));
    console.log('Updated india.json with', unique.length, 'tickers');
  } catch (e) {
    console.error('Failed to update india.json:', e);
  }
})();
