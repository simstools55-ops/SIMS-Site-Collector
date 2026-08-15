# SIMS Doctor Site Collector v0.2.0-RC7

## Purpose
This release changes the Apps Script distribution structure only.
The active v0.2.0-RC6 runtime modules are consolidated into a single `Code.gs`.

## Apps Script files
- `Code.gs` - replace
- `appsscript.json` - unchanged from RC6

## Removed from Apps Script project
The old modular `.gs` files are no longer required after applying RC7.
Do not keep both the old modular files and the new single `Code.gs`, because duplicate function definitions would remain.

## Functional baseline
- Collector behavior: RC6 baseline
- Evidence output-folder UX: retained
- Hatena active URL repair: retained
- Compact collection flow: retained

## Apply
See `RC7-APPLY.md`.
