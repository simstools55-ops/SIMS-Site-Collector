function sdscCollectPageDaily_(run, deadline) {
  sdscCollectDailyDimension_(run, deadline, 'page', SDSC_CONFIG.sheets.pageDaily, 'pageDaily', 3);
}

function sdscCollectDailyDimension_(run, deadline, dimension, sheetName, cursorKey, nextStep) {
  const config = sdscGetConfig_();
  const dates = sdscDateRange_(run.period.startDate, run.period.endDate);
  const state = run.cursors[cursorKey] || { dayIndex: 0, startRow: 0 };
  let dayIndex = state.dayIndex;
  let startRow = state.startRow;
  while (dayIndex < dates.length && Date.now() < deadline) {
    const d = dates[dayIndex];
    const res = sdscSearchAnalyticsQuery_(config.siteUrl, {
      startDate: d, endDate: d, type: 'web', dataState: 'final',
      dimensions: [dimension], rowLimit: SDSC_CONFIG.rowLimit, startRow
    });
    const apiRows = res.rows || [];
    const rows = apiRows.map(r => [d, r.keys ? r.keys[0] : '', r.clicks || 0, r.impressions || 0, r.ctr || 0, r.position || 0]);
    sdscAppendRows_(sheetName, rows);
    run.rows[cursorKey] = (run.rows[cursorKey] || 0) + rows.length;
    if (apiRows.length < SDSC_CONFIG.rowLimit) {
      dayIndex++;
      startRow = 0;
    } else {
      startRow += SDSC_CONFIG.rowLimit;
    }
    run.cursors[cursorKey] = { dayIndex, startRow };
    sdscSaveRun_(run);
  }
  if (dayIndex >= dates.length) {
    run.step = nextStep;
    run.status = 'RUNNING';
  } else {
    sdscPauseAndSchedule_(run, `${cursorKey} partial`);
  }
}
