# SIMS Doctor Site Collector v0.2.0-RC6 Apply Guide

## Apps Script files to replace
- `CollectorConfig.gs`
- `Code.gs`
- `EvidencePackager.gs`

No other `.gs` file needs replacement.

## Repository files updated
- `VERSION`
- `CHANGELOG.md`
- `README-FIRST.md`
- `RC6-APPLY.md` (new)

## Compatibility
Existing RC5 configurations continue to work. If no output folder is configured, Evidence Package ZIP files continue to be saved in the existing `SIMS-Doctor-Site-Collector` folder.

## Recommended verification
1. Replace only the three Apps Script files listed above.
2. Reload the spreadsheet.
3. Run `1. Setup / Select Site`.
4. Select the Search Console property.
5. Enter a Google Drive folder URL/ID, or leave blank to use the default folder.
6. Run collection and confirm Show Status displays both the ZIP URL and destination folder URL.
