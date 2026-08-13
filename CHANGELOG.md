# Changelog

## 0.2.0-RC5 - Hatena URL Repair
- Replaced browser-style URL parsing with Apps Script-safe string/regex URL parsing.
- Verified tonbos55 RC4 Evidence contains 3,191 raw /entry/ rows collapsing to 428 normalized article URLs.
- Preserves exact fragment-free GSC page URL for Search Console page-equals queries.
- Adds `Repair Step 5 / Rebuild Evidence` to reuse already collected 120-day summary data.
- Adds fail-closed validation when observed pages exist but the URL resolver selects zero targets.

## 0.2.0-RC4 - Evidence Integrity Hotfix
- Fixed exact-page query lookup after URL normalization by preserving original GSC URLs.
- Added DocumentLock to prevent concurrent collection runs and duplicate writes.
- Deduplicates site_daily, page_weekly, and page_query_top in final Evidence.
- Adds final Evidence integrity validation; empty page_query_top can no longer be marked valid when target pages exist.
- Clears stale Last error on successful completion.
- Records URL resolution metadata in Evidence manifest/report.

## 0.2.0-RC3 - Trigger Finalize Hotfix
- Removed SpreadsheetApp.getUi() call from Evidence finalization so auto-resume triggers can complete safely.
- Added recovery path for RC2 runs where the ZIP was created but the final UI alert caused ERROR.
- Show Status displays completed internal step 7 as 6/6.

## 0.2.0-RC2 - Large-Site Optimization
- Added URL normalization before Step 5.
- Added sitemap.xml, sitemap index, and robots.txt sitemap discovery.
- Step 5 now uses GSC × sitemap intersection when available.
- Added conservative Hatena/WordPress article URL fallback.
- Deduplicates fragments, query strings, and trailing-slash variants.
- Reduces the 419-article test site's 3,354-URL Step 5 bottleneck.

## 0.2.0-RC1
- Switched default collection period to 120 days.
- Added explicit optional 180-day detailed collection.
- Removed full pageDaily/queryDaily raw storage.
- Added compact page period summary collection.
- Added page weekly trend evidence.
- Added query period summary collection.
- Added per-page top-20 query evidence.
- Added explicit legacy raw-sheet cleanup confirmation.
- Added compact status sheet and clearer progress text.
- Prevents the large-site 10,000,000-cell workbook failure observed on a 419-article site.
