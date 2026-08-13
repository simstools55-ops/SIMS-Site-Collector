# SIMS Doctor Site Collector v0.2.0-RC2

Large-Site Compact Evidence architecture.

## Main change
v0.1.x stored pageDaily/queryDaily raw rows in Google Sheets. Large sites can exceed the workbook 10,000,000-cell limit.

v0.2.0-RC2 does not store those huge raw datasets. It collects:
- site_daily.csv
- page_summary.csv
- page_weekly.csv
- query_summary.csv
- page_query_top.csv

Standard diagnosis is 120 days. Detailed collection remains available at 180 days.

## Important migration note
Do not resume a v0.1.x run with v0.2.0-RC2.
Start a new run. At start, the tool asks permission to delete legacy raw evidence sheets so the workbook can recover cell capacity.

## RC2 optimization
Step 5 now normalizes observed GSC URLs and narrows page-level query collection using sitemap/robots.txt discovery. If sitemap discovery is not usable, a conservative Hatena/WordPress article-URL heuristic is used.
