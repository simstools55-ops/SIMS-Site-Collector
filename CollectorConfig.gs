const SDSC_CONFIG = Object.freeze({
  apiBase: 'https://www.googleapis.com/webmasters/v3',
  searchType: 'web',
  periodDays: 180,
  rowLimit: 25000,
  maxRetries: 5,
  softExecutionMs: 4.5 * 60 * 1000,
  resumeDelayMinutes: 2,
  configPropertyKey: 'SDSC_CONFIG_V1',
  runPropertyKey: 'SDSC_RUN_V1',
  outputFolderName: 'SIMS-Doctor-Site-Collector',
  sheets: {
    siteDaily: '_SDSC_SITE_DAILY',
    pageDaily: '_SDSC_PAGE_DAILY',
    queryDaily: '_SDSC_QUERY_DAILY',
    pageQuery: '_SDSC_PAGE_QUERY'
  }
});

function sdscGetConfig_() {
  const raw = PropertiesService.getDocumentProperties().getProperty(SDSC_CONFIG.configPropertyKey);
  return raw ? JSON.parse(raw) : {};
}
function sdscSaveConfig_(obj) {
  PropertiesService.getDocumentProperties().setProperty(SDSC_CONFIG.configPropertyKey, JSON.stringify(obj));
}
function sdscGetRun_() {
  const raw = PropertiesService.getDocumentProperties().getProperty(SDSC_CONFIG.runPropertyKey);
  return raw ? JSON.parse(raw) : null;
}
function sdscSaveRun_(run) {
  PropertiesService.getDocumentProperties().setProperty(SDSC_CONFIG.runPropertyKey, JSON.stringify(run));
}
function sdscResolvePeriod_(days) {
  const tz = Session.getScriptTimeZone() || 'Asia/Tokyo';
  const end = new Date();
  end.setDate(end.getDate() - 3); // Search Console final data lag guard
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  return {
    startDate: Utilities.formatDate(start, tz, 'yyyy-MM-dd'),
    endDate: Utilities.formatDate(end, tz, 'yyyy-MM-dd'),
    days
  };
}
