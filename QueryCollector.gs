function sdscCollectQueryDaily_(run, deadline) {
  sdscCollectDailyDimension_(run, deadline, 'query', SDSC_CONFIG.sheets.queryDaily, 'queryDaily', 4);
}
