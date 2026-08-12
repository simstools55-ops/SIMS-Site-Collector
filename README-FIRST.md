# SIMS Doctor Site Collector v0.1.0

Purpose: collect Search Console evidence for SIMS Doctor Site Diagnosis without involving SIMS-Blog-Manager.

## Setup
1. Create a Google Spreadsheet.
2. Open Extensions > Apps Script.
3. Copy all `.gs` files and `appsscript.json` from this package.
4. Reload the spreadsheet.
5. Use menu: SIMS Doctor Site Collector > 1. Setup / Select Site.
6. Start collection.

## Output
A ZIP named `SIMS-Doctor-Site-Evidence-YYYYMMDD.zip` is created in Google Drive folder `SIMS-Doctor-Site-Collector`.

## Status
v0.1.0 is a functional vertical slice for real-site validation. It intentionally uses simple dialogs. A richer progress UI is planned after real Search Console validation.
