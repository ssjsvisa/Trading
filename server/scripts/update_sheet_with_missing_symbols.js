// Automated script to append missing symbols to Google Sheet using Sheets API
// Usage: node update_sheet_with_missing_symbols.js
// Requires: npm install googleapis
// Place credentials.json in server/scripts/

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

// --- CONFIG ---
const EXCHANGE = 'usa'; // 'usa' or 'india'
const SYMBOL_CACHE = path.join(__dirname, '../symbol-cache/' + EXCHANGE + '.json');
const SHEET_ID = EXCHANGE === 'usa'
  ? '1H2rH5rmC4I57YYj0kMT6qLhqusIGo8R0'
  : '1rtgEL_VIF2VBPh0wwnlZCQot9NgXrn4I';
const SHEET_NAME = EXCHANGE === 'usa' ? 'US Shares' : 'IND Shares';
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');

function cleanSymbol(s) {
  if (!s) return '';
  let sym = s.trim();
  if (sym.startsWith('"') && sym.endsWith('"')) sym = sym.slice(1, -1);
  sym = sym.replace(/\s+/g, '');
  return sym.toUpperCase();
}

async function authorize() {
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  // Token file
  const TOKEN_PATH = path.join(__dirname, 'token.json');
  if (fs.existsSync(TOKEN_PATH)) {
    oAuth2Client.setCredentials(JSON.parse(fs.readFileSync(TOKEN_PATH)));
    return oAuth2Client;
  }
  // First time: prompt for authorization
  const authUrl = oAuth2Client.generateAuthUrl({ access_type: 'offline', scope: ['https://www.googleapis.com/auth/spreadsheets'] });
  console.log('Authorize this app by visiting this url:', authUrl);
  const readline = require('readline').createInterface({ input: process.stdin, output: process.stdout });
  readline.question('Enter the code from that page here: ', code => {
    readline.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error retrieving access token', err);
      oAuth2Client.setCredentials(token);
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
      console.log('Token stored to', TOKEN_PATH);
    });
  });
  throw new Error('Authorization required. Restart after token is saved.');
}

async function main() {
  // Load local symbol list
  if (!fs.existsSync(SYMBOL_CACHE)) {
    console.error('Symbol cache not found:', SYMBOL_CACHE);
    process.exit(1);
  }
  const symbols = JSON.parse(fs.readFileSync(SYMBOL_CACHE, 'utf8'));
  const symbolSet = new Set(symbols.map(cleanSymbol));

  // Authorize Sheets API
  const auth = await authorize();
  const sheets = google.sheets({ version: 'v4', auth });

  // Read existing sheet symbols
  const getRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A:A`, // Assumes Symbol is in column A
  });
  const sheetSymbols = new Set((getRes.data.values || []).map(row => cleanSymbol(row[0])));

  // Find missing symbols
  const missing = Array.from(symbolSet).filter(sym => !sheetSymbols.has(sym));
  if (!missing.length) {
    console.log('No missing symbols to add.');
    return;
  }
  console.log('Appending', missing.length, 'missing symbols...');

  // Append missing symbols to sheet
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A:A`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: missing.map(s => [s]),
    },
  });
  console.log('Done. Added missing symbols to sheet.');
}

main().catch(e => { console.error(e); process.exit(1); });
