const fs = require('fs');
const path = require('path');

function checkTickers(jsonPath, requiredTickers) {
  const symbols = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const missing = requiredTickers.filter(t => !symbols.includes(t));
  return missing;
}

// Example usage: edit these lists as needed
const usaRequired = ["WU", "WMT", "AAPL", "MSFT", "GOOG", "META", "TSLA", "NFLX", "PYPL", "AMZN", "BRK-B", "V", "JPM", "UNH", "HD", "PG", "MA", "DIS", "BAC", "ADBE", "CMCSA"];
const indiaRequired = ["WE.NS", "TCS.NS", "RELIANCE.NS", "INFY.NS", "HDFCBANK.NS", "HDFC.NS", "ICICIBANK.NS", "SBIN.NS", "LT.NS", "ITC.NS", "BAJFINANCE.NS"];

const usaPath = path.join(__dirname, '..', 'symbols_builtin', 'usa.json');
const indiaPath = path.join(__dirname, '..', 'symbols_builtin', 'india.json');

console.log('Checking USA tickers...');
const missingUSA = checkTickers(usaPath, usaRequired);
if (missingUSA.length === 0) {
  console.log('All required USA tickers are present.');
} else {
  console.log('Missing USA tickers:', missingUSA);
}

console.log('Checking India tickers...');
const missingIndia = checkTickers(indiaPath, indiaRequired);
if (missingIndia.length === 0) {
  console.log('All required India tickers are present.');
} else {
  console.log('Missing India tickers:', missingIndia);
}
