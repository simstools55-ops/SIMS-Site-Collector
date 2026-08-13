# RC5 Apply

Changed Apps Script files from RC4:
- Code.gs — REPLACE
- ActiveUrlResolver.gs — REPLACE
- EvidencePackager.gs — REPLACE

All other .gs files: NO CHANGE.
appsscript.json: NO CHANGE.

Current RC4 run can be reused:
1. Replace the three files.
2. Save and reload the spreadsheet.
3. Choose `6. Repair Step 5 / Rebuild Evidence`.
4. Confirm YES.
5. Do not start a new 120-day collection.
6. At Step 5, Show Status should report about 428 target article URLs for the current tonbos55 evidence.
7. Let auto-resume finish and upload the newly generated Evidence ZIP.
