// This script fetches NASDAQ and NYSE tickers and updates usa.json with all available symbols
const fs = require('fs');
const https = require('https');
const path = require('path');

const nasdaqUrl = 'https://ftp.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt';
const nyseUrl = 'https://ftp.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt';
const outFile = path.join(__dirname, '../symbols_builtin/usa.json');
const localNasdaq = path.join(__dirname, 'nasdaqlisted.txt');
const localNyse = path.join(__dirname, 'otherlisted.txt');

function fetchText(url, fallbackFile) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', async () => {
        // Try local file fallback
        if (fs.existsSync(fallbackFile)) {
          resolve(fs.readFileSync(fallbackFile, 'utf8'));
        } else {
          reject(new Error('Network error and no local file: ' + fallbackFile));
        }
      });
    }).on('error', async () => {
      if (fs.existsSync(fallbackFile)) {
        resolve(fs.readFileSync(fallbackFile, 'utf8'));
      } else {
        reject(new Error('Network error and no local file: ' + fallbackFile));
      }
    });
  });
}

(async () => {
  try {
    let nasdaq, nyse;
    try {
      nasdaq = await fetchText(nasdaqUrl, localNasdaq);
    } catch (e) {
      if (fs.existsSync(localNasdaq)) nasdaq = fs.readFileSync(localNasdaq, 'utf8');
      else throw e;
    }
    try {
      nyse = await fetchText(nyseUrl, localNyse);
    } catch (e) {
      if (fs.existsSync(localNyse)) nyse = fs.readFileSync(localNyse, 'utf8');
      else throw e;
    }
    const tickers = new Set();
    nasdaq.split(/\r?\n/).forEach(line => {
      if (line && !line.startsWith('Symbol|') && !line.startsWith('File Creation')) {
        const parts = line.split('|');
        if (parts[0] && /^[A-Z0-9\-.]+$/.test(parts[0])) tickers.add(parts[0].trim());
      }
    });
    nyse.split(/\r?\n/).forEach(line => {
      if (line && !line.startsWith('Symbol|') && !line.startsWith('File Creation')) {
        const parts = line.split('|');
        if (parts[0] && /^[A-Z0-9\-.]+$/.test(parts[0])) tickers.add(parts[0].trim());
      }
    });
    const unique = Array.from(tickers).sort();
    fs.writeFileSync(outFile, JSON.stringify(unique, null, 2));
    console.log('Updated usa.json with', unique.length, 'tickers');
  } catch (e) {
    console.error('Failed to update usa.json:', e);
    console.error('To use local fallback, download nasdaqlisted.txt and otherlisted.txt and place them in server/scripts/.');
  }
})();
