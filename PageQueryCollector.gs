function sdscCollectPageQuery_(run, deadline) {
  const config = sdscGetConfig_();
  let startRow = run.cursors.pageQuery || 0;
  while (Date.now() < deadline) {
    const res = sdscSearchAnalyticsQuery_(config.siteUrl, {
      startDate: run.period.startDate,
      endDate: run.period.endDate,
      type: 'web', dataState: 'final',
      dimensions: ['page', 'query'],
      rowLimit: SDSC_CONFIG.rowLimit,
      startRow
    });
    const apiRows = res.rows || [];
    const rows = apiRows.map(r => [r.keys ? r.keys[0] : '', r.keys ? r.keys[1] : '', r.clicks || 0, r.impressions || 0, r.ctr || 0, r.position || 0]);
    sdscAppendRows_(SDSC_CONFIG.sheets.pageQuery, rows);
    run.rows.pageQuery = (run.rows.pageQuery || 0) + rows.length;
    if (apiRows.length < SDSC_CONFIG.rowLimit) {
      run.step = 5;
      run.status = 'RUNNING';
      run.cursors.pageQuery = startRow + apiRows.length;
      return;
    }
    startRow += SDSC_CONFIG.rowLimit;
    run.cursors.pageQuery = startRow;
    sdscSaveRun_(run);
  }
  sdscPauseAndSchedule_(run, 'page_query partial');
}
