# RC10 Progress UX

## Main changes
- After choosing destination/name and starting collection, the same dialog switches to a live progress view.
- The progress view polls the run state automatically every few seconds.
- Displays status, step, progress text, start datetime, completion datetime, package name, and destination.
- `収集状況` sheet is styled as a product-facing screen and includes completion datetime.

## Package naming
Default format remains:
`SIMS-Evidence-{サイト名}-{yyyyMMdd-HHmm}.zip`

Example:
`SIMS-Evidence-ガジェット探検記-20260815-1507.zip`

## Compatibility
Collection/Evidence datasets and Drive OAuth scope are unchanged.
