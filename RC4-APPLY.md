# RC4 Apply

Apps Script changes from RC3:
- Code.gs — REPLACE
- ActiveUrlResolver.gs — REPLACE
- EvidencePackager.gs — REPLACE

All other .gs files: NO CHANGE.

Purpose:
- Prevent overlapping auto-resume/manual executions with DocumentLock.
- Preserve original GSC page URLs after normalization so exact page filters return query data.
- Deduplicate site_daily/page_weekly/page_query_top during packaging.
- Reject a false COMPLETED package when page_query_top is empty despite having target pages.
- Clear stale Last error after successful completion.

Test:
Start a NEW Standard 120-day Run. Do not Resume the old RC2/RC3 run.
