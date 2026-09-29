# My Money

A privacy-first household wealth and spending dashboard published with GitHub Pages.

## What it does

- Tracks property, super, shares, cash, vehicles, gold, commodities, other assets and loans.
- Shows gross assets, liabilities and net worth in a two-ring wealth chart.
- Imports CSV, XLS/XLSX and text-based PDF bank statements locally in the browser.
- Reviews imported transactions, skips duplicates and allows category corrections.
- Saves data only in the current browser and supports JSON backup and restore.
- Supports desktop and mobile layouts, keyboard navigation, light mode and dark mode.

## Privacy

Financial data and statement files are processed in the browser. This site has no account system, analytics or remote database. Browser storage is device-local and is not a substitute for a backup.

Scanned or image-only PDFs are not supported in this release. Use the bank’s CSV/XLSX export or a text-based PDF.

The pinned SheetJS and PDF.js browser readers are stored in `vendor/`; statement contents are never sent to those projects or a CDN.

## Run locally

Serve this directory with any static HTTP server and open `index.html`. Opening the file directly may prevent PDF worker loading in some browsers.

## Deployment

GitHub Pages serves the `main` branch at <https://lowcodesid.github.io/my-money/>.
