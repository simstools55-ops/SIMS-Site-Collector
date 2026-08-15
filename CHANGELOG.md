# v0.2.0-RC10.3

- Added required Apps Script UI OAuth scope:
  `https://www.googleapis.com/auth/script.container.ui`
- Fixes authorization failures when opening the Evidence Package save dialog.
- No collection logic changes from RC10.2.

# v0.2.0-RC10.2

- Removed dialog opening from `収集状況を確認`; it now refreshes and opens the status sheet.
- Progress during collection remains inside the explicitly opened collection/save UI.
- Every new run now enforces the Evidence Package name `SIMS-Evidence-{site name}-{yyyyMMdd-HHmm}.zip`.
- Legacy/custom `outputFileName` values are no longer inherited by new runs.
- The generated filename is fixed at run start and reused through automatic resumes.
- Updated product version/header to RC10.2.

# v0.2.0-RC10.1

- Reduced top-level menu to two normal actions.
- Moved `収集状況を確認` into `追加の操作`.
- Replaced modeless manual status dialog with a modal dialog to avoid UI permission errors.
- Persist the actual generated Evidence Package filename.
- Recover the filename from Drive for older completed runs when possible.
- Aligned source header/version comments to RC10.1.

# v0.2.0-RC10

- Added a live collection progress dialog with automatic polling.
- Progress remains visible through staged/auto-resume collection runs.
- Shows start time, completion time, current step, package filename and destination.
- Added completion datetime to the user-facing `収集状況` sheet.
- Restyled the status sheet with product-like Japanese UI formatting.
- Evidence package default filenames continue to use site name + collection date/time.
- Added siteName to Evidence manifest metadata.

# v0.2.0-RC9.1

- Evidence Package filename now always includes a friendly site name and collection date/time.
- Added site-name input when selecting a site.
- Default filename is regenerated on every collection and can still be edited before saving.
- Example: `SIMS-Evidence-ガジェット探検記-20260815-1449.zip`.

# v0.2.0-RC9

- Renamed the visible status sheet to `収集状況` and localized user-facing fields.
- Added a Windows-like Drive save dialog before collection starts.
- Users can browse Drive folders, choose the destination, and edit the ZIP file name.
- Removed Drive URL/folder-ID entry from normal setup flow.
- Internal collection sheets remain hidden with stable internal names.
- No Search Console collection or Evidence contract logic changes.

# v0.2.0-RC8

- Reorganized the menu around normal user workflow.
- Moved detailed/recovery actions into submenus.
- Hide internal collection sheets from normal users.
- Automatically remove only an empty default Sheet1/シート1.
- No collection/evidence logic changes.

# Changelog

## 0.2.0-RC7 - Single Code Distribution
- Consolidated the active RC6 Apps Script runtime into one `Code.gs`.
- Removed legacy v0.1 runtime modules from the distribution path.
- No intended collector feature or evidence-contract changes.
- `appsscript.json` remains unchanged from RC6.

## 0.2.0-RC6 - Evidence Storage UX
- Added optional Google Drive Evidence output folder configuration during Setup.
- Accepts either a Google Drive folder URL or folder ID.
- Keeps backward compatibility: blank/unconfigured uses the existing `SIMS-Doctor-Site-Collector` folder.
- Shows the resolved Evidence destination folder in Setup confirmation, status, and completion progress.
- Preserves RC5 Hatena URL Repair and Evidence collection behavior.

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
