const SDSC_CONFIG = Object.freeze({
  apiBase: 'https://www.googleapis.com/webmasters/v3',
  searchType: 'web',
  standardPeriodDays: 120,
  detailPeriodDays: 180,
  rowLimit: 5000,
  topQueriesPerPage: 20,
  maxBatchesPerInvocation: 16,
  deadlineGuardMs: 30000,
  maxRetries: 5,
  softExecutionMs: 4.5 * 60 * 1000,
  resumeDelayMinutes: 2,
  configPropertyKey: 'SDSC_CONFIG_V2',
  runPropertyKey: 'SDSC_RUN_V2',
  outputFolderName: 'SIMS-Doctor-Site-Collector',
  sheets: {
    status: '_SDSC_STATUS',
    siteDaily: '_SDSC_SITE_DAILY',
    pagePeriod: '_SDSC_PAGE_PERIOD',
    pageWeekly: '_SDSC_PAGE_WEEKLY',
    queryPeriod: '_SDSC_QUERY_PERIOD',
    pageQueryTop: '_SDSC_PAGE_QUERY_TOP'
  },
  legacyRawSheets: [
    '_SDSC_PAGE_DAILY',
    '_SDSC_QUERY_DAILY',
    '_SDSC_PAGE_QUERY'
  ]
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

function sdscResolveOutputFolderId_(input) {
  const value=String(input||'').trim();
  if(!value)return '';
  const m=value.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : value;
}
function sdscGetOutputFolderInfo_(config) {
  const folderId=sdscResolveOutputFolderId_(config&&config.outputFolderId);
  if(folderId){
    try{
      const folder=DriveApp.getFolderById(folderId);
      return {folder:folder,id:folder.getId(),name:folder.getName(),url:folder.getUrl(),isDefault:false};
    }catch(e){
      throw new Error('設定済みのEvidence保存先フォルダーを開けません。Setup / Select Site で保存先を再設定してください。');
    }
  }
  const folder=sdscGetOrCreateFolder_(SDSC_CONFIG.outputFolderName);
  return {folder:folder,id:folder.getId(),name:folder.getName(),url:folder.getUrl(),isDefault:true};
}

function sdscResolvePeriod_(days) {
  const tz = Session.getScriptTimeZone() || 'Asia/Tokyo';
  const end = new Date();
  end.setDate(end.getDate() - 3);
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  return {
    startDate: Utilities.formatDate(start, tz, 'yyyy-MM-dd'),
    endDate: Utilities.formatDate(end, tz, 'yyyy-MM-dd'),
    days
  };
}
