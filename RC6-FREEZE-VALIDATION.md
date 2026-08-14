# SIMS Doctor Site Collector v0.2.0-RC6 Freeze Validation

## Scope
RC6 improves only the Evidence Package output-folder UX.

## Runtime validation
- Default output folder route: PASS
- Standard 120-day Collection on `https://windinglife55.com/`: COMPLETED, Step 6/6, Last error none
- User-specified Google Drive folder route: PASS
- Repair Step 5 / Rebuild Evidence to specified folder: COMPLETED, Last error none
- RC5 Hatena URL Repair logic: unchanged

## Final UX polish
- Clarified that Windows paths such as `C:\...` cannot be used.
- Instructed users to paste a browser Google Drive folder URL or folder ID.
- Removed duplicate display of the output-folder URL in the completion/status dialog.

## Files changed by final UX polish
- Code.gs
- EvidencePackager.gs

No other Apps Script files were changed by the final UX polish.
