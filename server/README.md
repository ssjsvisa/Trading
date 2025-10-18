This folder contains the Express proxy used by the client.

Scripts:

- scripts/fetch_symbols.js -> Attempts to download full NASDAQ + otherlisted and NSE symbol lists and writes them to ../symbol-cache/{usa,india}.json

Usage:

Run the script with Node 18+ (or install node-fetch):

node scripts/fetch_symbols.js

If your environment blocks the remote downloads, the script will report errors. In that case the server falls back to builtin lists in symbols_builtin/ or a small hardcoded list.
