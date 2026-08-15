# SIMS Doctor Site Collector v0.2.0-RC7 Apply Guide

## First migration from RC6 modular layout
1. Open the Site Collector Apps Script project.
2. Replace the existing `Code.gs` with the RC7 `Code.gs`.
3. Delete the other old `.gs` source files from the Apps Script project.
4. Keep `appsscript.json` unchanged.
5. Reload the spreadsheet and verify the SIMS Doctor Site Collector menu.
6. Run Setup / Select Site, then Show Status.
7. Run one standard collection and confirm that an Evidence Package ZIP is created.

## Future RC7-based updates
Normally only `Code.gs` needs replacement.

## File classification
- Replace: `Code.gs`
- Change not required: `appsscript.json`
- Delete after migration: old modular `.gs` files
- New repository/distribution docs: `VERSION`, `README-FIRST.md`, `RC7-APPLY.md`, `CHANGELOG.md`
