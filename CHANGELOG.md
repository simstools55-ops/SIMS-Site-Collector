# Changelog

## v0.1.1 - Spreadsheet resilience hotfix
- Added exponential retry for transient Google Sheets write failures.
- Transient Spreadsheet service failures now pause and auto-resume instead of immediately ending the run as ERROR.
- Added bounded run-level transient retry protection.
- Existing run checkpoints remain reusable; no reset is required for the observed Step 3 failure.
- Clarified that `rowLimit: 25000` is the Search Console API page size per request, not a total collection cap.


## 0.1.0
- Initial vertical slice.
- Search Console property selection via Sites API.
- 180-day collection for site daily, page daily, query daily, and page-query data.
- Checkpointed resumable execution with time trigger.
- Evidence ZIP packaging with manifest and collection report.
- SBM-independent architecture.
