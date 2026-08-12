function sdscCollectSiteDaily_(run, deadline) {
  const config = sdscGetConfig_();
  const dates = sdscDateRange_(run.period.startDate, run.period.endDate);
  const cursor = run.cursors.siteDaily || 0;
  const rows = [];
  let i = cursor;
  for (; i < dates.length && Date.now() < deadline; i++) {
    const d = dates[i];
    const res = sdscSearchAnalyticsQuery_(config.siteUrl, {
      startDate: d, endDate: d, type: 'web', dataState: 'final', rowLimit: 1
    });
    const r = (res.rows || [])[0] || {};
    rows.push([d, r.clicks || 0, r.impressions || 0, r.ctr || 0, r.position || 0]);
  }
  sdscAppendRows_(SDSC_CONFIG.sheets.siteDaily, rows);
  run.cursors.siteDaily = i;
  run.rows.siteDaily = (run.rows.siteDaily || 0) + rows.length;
  if (i >= dates.length) {
    run.step = 2;
    run.status = 'RUNNING';
  } else {
    sdscPauseAndSchedule_(run, 'site_daily partial');
  }
}
