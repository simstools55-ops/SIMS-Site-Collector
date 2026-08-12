# Implementation Status - v0.1.0

This release is a vertical slice to validate the end-to-end collection path on a real Search Console property.

## Implemented
- Search Console Sites API property discovery.
- OAuth using `webmasters.readonly`.
- 180-day site daily collection.
- 180-day page daily collection with paging.
- 180-day query daily collection with paging.
- Page x query aggregate collection with paging.
- Exponential retry for 429/5xx.
- Checkpoint and time-trigger auto resume.
- Hidden staging sheets.
- Evidence Package ZIP generation.
- Manifest, collection report, site/page/query summaries.

## Known v0.1 limitation
Google states that Search Analytics can omit data when page/query dimensions are requested and exposes at most 50K rows per day per search type. v0.1 collects page/query aggregate combinations over the full period as a practical vertical slice. Before v1.0, real-site measurements will determine whether page-query must be collected per-day into chunk files to maximize coverage without exceeding Spreadsheet cell limits.

## Next validation
Run against one real site with several hundred pages and compare row counts, run duration, API failures, output ZIP size, and Doctor usefulness.
