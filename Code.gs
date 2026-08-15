/**
 * SIMS Doctor Site Collector v0.2.0-RC7
 * Single-Code distribution.
 * Functional baseline: v0.2.0-RC6.
 * Active RC6 runtime modules are consolidated into this file.
 */

// ============================================================================
// Core / Menu / Runner (source: Code.gs)
// ============================================================================

const SDSC_VERSION='0.2.0-RC7';

function onOpen(){
  SpreadsheetApp.getUi()
    .createMenu('SIMS Doctor Site Collector')
    .addItem('1. Setup / Select Site','sdscShowSetupDialog')
    .addItem('2. Start Standard 120-day Collection','sdscStartStandardCollection')
    .addItem('3. Start Detailed 180-day Collection','sdscStartDetailedCollection')
    .addItem('4. Resume Collection','sdscResumeCollection')
    .addItem('5. Show Status','sdscShowStatus')
    .addItem('6. Repair Step 5 / Rebuild Evidence','sdscRepairStep5AndRebuild')
    .addSeparator()
    .addItem('Reset Collector State','sdscResetState')
    .addToUi();
}

function sdscShowSetupDialog(){
  const props=sdscGetAccessibleSites_();
  const current=sdscGetConfig_();
  const items=props.map((p,i)=>`${i+1}. ${p.siteUrl} [${p.permissionLevel}]`).join('\n');
  const ui=SpreadsheetApp.getUi();
  const prompt=ui.prompt(
    `SIMS Doctor Site Collector v${SDSC_VERSION}`,
    `Search Console property numberを入力してください。\n\n${items}\n\n現在: ${current.siteUrl||'(未設定)'}`,
    ui.ButtonSet.OK_CANCEL
  );
  if(prompt.getSelectedButton()!==ui.Button.OK)return;
  const idx=Number(prompt.getResponseText())-1;
  if(!Number.isInteger(idx)||idx<0||idx>=props.length){
    ui.alert('入力が正しくありません。');return;
  }

  let currentFolderText=`(既定: ${SDSC_CONFIG.outputFolderName})`;
  if(current.outputFolderId){
    try{
      const f=DriveApp.getFolderById(sdscResolveOutputFolderId_(current.outputFolderId));
      currentFolderText=`${f.getName()}\n${f.getUrl()}`;
    }catch(e){
      currentFolderText='(設定済みフォルダーを開けません。再設定してください)';
    }
  }
  const folderPrompt=ui.prompt(
    'Evidence Package 保存先',
    `Google Driveの保存先フォルダーURLまたはフォルダーIDを入力してください。\nWindowsのフォルダーパス（C:\\～）は使用できません。ブラウザ版Google Driveで保存先フォルダーを開き、そのURLを貼り付けてください。\n空欄なら既定フォルダー「${SDSC_CONFIG.outputFolderName}」を使用します。\n\n現在の保存先:\n${currentFolderText}`,
    ui.ButtonSet.OK_CANCEL
  );
  if(folderPrompt.getSelectedButton()!==ui.Button.OK)return;

  const folderInput=folderPrompt.getResponseText().trim();
  let folderId='';
  let folderName=SDSC_CONFIG.outputFolderName;
  let folderUrl='';
  if(folderInput){
    folderId=sdscResolveOutputFolderId_(folderInput);
    try{
      const folder=DriveApp.getFolderById(folderId);
      folderName=folder.getName();
      folderUrl=folder.getUrl();
    }catch(e){
      ui.alert('保存先フォルダーを開けませんでした。\nブラウザ版Google DriveのフォルダーURLまたはフォルダーIDを確認してください。\nWindowsのフォルダーパス（C:\\～）は使用できません。');
      return;
    }
  }

  sdscSaveConfig_({
    siteUrl:props[idx].siteUrl,
    permissionLevel:props[idx].permissionLevel,
    searchType:'web',
    timezone:Session.getScriptTimeZone()||'Asia/Tokyo',
    outputFolderId:folderId
  });

  if(!folderInput){
    const info=sdscGetOutputFolderInfo_({outputFolderId:''});
    folderName=info.name;
    folderUrl=info.url;
  }
  ui.alert(`設定しました。\n\nSite: ${props[idx].siteUrl}\n標準診断期間: 120日\nEvidence保存先: ${folderName}\n${folderUrl}`);
}
function sdscStartStandardCollection(){sdscStartCollection_(SDSC_CONFIG.standardPeriodDays);}
function sdscStartDetailedCollection(){sdscStartCollection_(SDSC_CONFIG.detailPeriodDays);}

function sdscStartCollection_(days){
  const config=sdscGetConfig_();
  if(!config.siteUrl)throw new Error('先に Setup / Select Site を実行してください。');
  if(!sdscDeleteLegacyRawSheetsWithConfirmation_())return;
  sdscClearResumeTrigger_();
  const run={
    format:'SIMS_DOCTOR_SITE_COLLECTOR_RUN_V2',
    collectorVersion:SDSC_VERSION,
    runId:`SITE-${Utilities.formatDate(new Date(),config.timezone||'Asia/Tokyo','yyyyMMdd-HHmmss')}`,
    status:'RUNNING',
    step:1,
    startedAt:new Date().toISOString(),
    updatedAt:new Date().toISOString(),
    period:sdscResolvePeriod_(days),
    cursors:{},rows:{},warnings:[],errors:[],
    progressText:'収集を開始します'
  };
  sdscSaveRun_(run);
  sdscPrepareCompactSheets_();
  sdscWriteStatus_(run);
  sdscResumeCollection();
}

function sdscResumeCollection(){
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(5000)) return;
  try {
  const run=sdscGetRun_();
  if(!run||!run.runId)throw new Error('実行中または再開可能なCollector Runがありません。');

  // Recovery path for RC2 runs where ZIP generation succeeded but the final UI alert
  // failed in a time-based trigger context.
  if(run.outputFileUrl && Number(run.step) >= 7){
    run.status='COMPLETED';
    run.completedAt=run.completedAt||new Date().toISOString();
    run.progressText='Evidence Package生成完了';
    run.errors=[];
    sdscSaveRun_(run);
    sdscWriteStatus_(run);
    sdscClearResumeTrigger_();
    return;
  }

  if(run.status==='COMPLETED'){
    SpreadsheetApp.getUi().alert('このRunはすでに完了しています。');return;
  }
  run.status='RUNNING';
  run.updatedAt=new Date().toISOString();
  sdscSaveRun_(run);
  const deadline=Date.now()+SDSC_CONFIG.softExecutionMs;
  try{
    while(Date.now()<deadline-SDSC_CONFIG.deadlineGuardMs&&run.step<=6){
      if(run.step===1)sdscCollectSiteDaily_(run,deadline);
      else if(run.step===2)sdscCollectPagePeriod_(run,deadline);
      else if(run.step===3)sdscCollectPageWeekly_(run,deadline);
      else if(run.step===4)sdscCollectQueryPeriod_(run,deadline);
      else if(run.step===5)sdscCollectPageQueryTop_(run,deadline);
      else if(run.step===6)sdscFinalizeEvidence_(run);
      run.updatedAt=new Date().toISOString();
      sdscSaveRun_(run);
      sdscWriteStatus_(run);
      if(run.status==='PAUSED_AUTO_RESUME')break;
    }
    if(run.step<=6&&run.status!=='COMPLETED'&&run.status!=='PAUSED_AUTO_RESUME'){
      sdscPauseAndSchedule_(run,'安全時間に到達したため自動再開します');
    }
  }catch(e){
    run.errors=run.errors||[];
    run.errors.push({at:new Date().toISOString(),message:String(e&&e.stack?e.stack:e)});
    run.status='ERROR';
    run.progressText='エラーが発生しました。Show Statusで内容を確認してください。';
    sdscSaveRun_(run);
    sdscWriteStatus_(run);
    throw e;
  }
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function sdscRepairStep5AndRebuild(){
  const run=sdscGetRun_();
  if(!run||!run.runId)throw new Error('修復対象のCollector Runがありません。');
  const ui=SpreadsheetApp.getUi();
  const r=ui.alert(
    'Step 5を修復してEvidenceを再生成します',
    '取得済みの120日集計は再利用し、ページ別上位クエリだけを取り直します。\n現在のOutput ZIPは残ります。\n\n実行しますか？',
    ui.ButtonSet.YES_NO
  );
  if(r!==ui.Button.YES)return;

  sdscClearResumeTrigger_();

  const sh=SpreadsheetApp.getActive().getSheetByName(SDSC_CONFIG.sheets.pageQueryTop);
  if(!sh)throw new Error('pageQueryTopシートが見つかりません。');
  sh.clearContents();
  sh.getRange(1,1,1,6).setValues([['page','query','clicks','impressions','ctr','position']]);

  run.step=5;
  run.status='RUNNING';
  run.pageQueryTargetUrls=null;
  run.pageQueryTargetStrategy=null;
  run.urlResolution=null;
  run.cursors=run.cursors||{};
  run.cursors.pageQueryTop=0;
  run.rows=run.rows||{};
  run.rows.pageQueryTop=0;
  run.outputFileId=null;
  run.outputFileUrl=null;
  run.outputFolderId=null;
  run.outputFolderName=null;
  run.outputFolderUrl=null;
  run.completedAt=null;
  run.errors=[];
  run.progressText='Step 5修復を開始します';
  run.updatedAt=new Date().toISOString();
  sdscSaveRun_(run);
  sdscWriteStatus_(run);
  sdscResumeCollection();
}

function sdscShowStatus(){
  const run=sdscGetRun_();
  if(!run){SpreadsheetApp.getUi().alert(`SIMS Doctor Site Collector v${SDSC_VERSION}\nRunはありません。`);return;}
  sdscWriteStatus_(run);
  SpreadsheetApp.getUi().alert(
    `SIMS Doctor Site Collector v${SDSC_VERSION}\n\n`+
    `Site: ${sdscGetConfig_().siteUrl||''}\nRun: ${run.runId}\nStatus: ${run.status}\n`+
    `Step: ${run.status==='COMPLETED' ? '6/6' : `${Math.min(run.step,6)}/6`}\n期間: ${run.period.days}日\n\n${run.progressText||''}\n\n`+
    `Output: ${run.outputFileUrl||'(未生成)'}\n`+
    `保存先: ${run.outputFolderUrl||sdscSafeConfiguredOutputFolderUrl_()}\n`+
    `Last error: ${(run.errors&&run.errors.length)?run.errors[run.errors.length-1].message:'(なし)'}`
  );
}

function sdscSafeConfiguredOutputFolderUrl_(){
  try{
    return sdscGetOutputFolderInfo_(sdscGetConfig_()).url;
  }catch(e){
    return '(保存先を確認できません)';
  }
}
function sdscResetState(){
  const ui=SpreadsheetApp.getUi();
  const r=ui.alert('Collector状態をリセットしますか？','途中状態だけを削除します。',ui.ButtonSet.YES_NO);
  if(r!==ui.Button.YES)return;
  sdscClearResumeTrigger_();
  PropertiesService.getDocumentProperties().deleteProperty(SDSC_CONFIG.runPropertyKey);
  ui.alert('Collector状態をリセットしました。');
}

// ============================================================================
// Configuration / State (source: CollectorConfig.gs)
// ============================================================================

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

// ============================================================================
// Search Console API (source: SearchConsoleClient.gs)
// ============================================================================

function sdscGetAccessibleSites_() {
  const res = sdscFetchJson_(`${SDSC_CONFIG.apiBase}/sites`, { method: 'get' });
  return (res.siteEntry || []).filter(x => x.siteUrl && x.permissionLevel !== 'siteUnverifiedUser');
}
function sdscSearchAnalyticsQuery_(siteUrl, body) {
  const encoded = encodeURIComponent(siteUrl);
  return sdscFetchJson_(`${SDSC_CONFIG.apiBase}/sites/${encoded}/searchAnalytics/query`, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(body)
  });
}
function sdscFetchJson_(url, options) {
  const opts = Object.assign({}, options || {});
  opts.muteHttpExceptions = true;
  opts.headers = Object.assign({}, opts.headers || {}, {
    Authorization: `Bearer ${ScriptApp.getOAuthToken()}`
  });
  let delay = 1000;
  for (let i = 0; i <= SDSC_CONFIG.maxRetries; i++) {
    const response = UrlFetchApp.fetch(url, opts);
    const code = response.getResponseCode();
    const text = response.getContentText();
    if (code >= 200 && code < 300) return text ? JSON.parse(text) : {};
    if ((code === 429 || code >= 500) && i < SDSC_CONFIG.maxRetries) {
      Utilities.sleep(delay);
      delay = Math.min(delay * 2, 16000);
      continue;
    }
    throw new Error(`Search Console API error ${code}: ${text}`);
  }
  throw new Error('Search Console API retry limit exceeded.');
}

// ============================================================================
// Checkpoint / Auto Resume (source: CheckpointStore.gs)
// ============================================================================

function sdscPauseAndSchedule_(run, note) {
  run.status = 'PAUSED_AUTO_RESUME';
  run.pauseReason = note || '';
  run.updatedAt = new Date().toISOString();
  sdscSaveRun_(run);
  sdscClearResumeTrigger_();
  ScriptApp.newTrigger('sdscResumeCollection')
    .timeBased()
    .after(SDSC_CONFIG.resumeDelayMinutes * 60 * 1000)
    .create();
}
function sdscClearResumeTrigger_() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'sdscResumeCollection') ScriptApp.deleteTrigger(t);
  });
}

// ============================================================================
// Period Helpers (source: PeriodHelpers.gs)
// ============================================================================

function sdscDateRange_(startDate, endDate) {
  const out = [];
  const d = new Date(startDate + 'T00:00:00Z');
  const e = new Date(endDate + 'T00:00:00Z');
  while (d <= e) {
    out.push(Utilities.formatDate(d, 'Etc/UTC', 'yyyy-MM-dd'));
    d.setUTCDate(d.getUTCDate()+1);
  }
  return out;
}
function sdscShiftDate_(dateStr, deltaDays) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate()+deltaDays);
  return Utilities.formatDate(d, 'Etc/UTC', 'yyyy-MM-dd');
}
function sdscPeriodDefinitions_(run) {
  const days = run.period.days;
  const half = Math.floor(days / 2);
  const firstEnd = sdscShiftDate_(run.period.startDate, half - 1);
  const secondStart = sdscShiftDate_(firstEnd, 1);
  const recentStart = sdscShiftDate_(run.period.endDate, -27);
  const prevEnd = sdscShiftDate_(recentStart, -1);
  const prevStart = sdscShiftDate_(prevEnd, -27);
  return [
    {key:'full', startDate:run.period.startDate, endDate:run.period.endDate},
    {key:'first_half', startDate:run.period.startDate, endDate:firstEnd},
    {key:'second_half', startDate:secondStart, endDate:run.period.endDate},
    {key:'recent28', startDate:recentStart, endDate:run.period.endDate},
    {key:'previous28', startDate:prevStart, endDate:prevEnd}
  ];
}
function sdscWeekDefinitions_(run) {
  const dates = sdscDateRange_(run.period.startDate, run.period.endDate);
  const out = [];
  for (let i=0; i<dates.length; i+=7) {
    out.push({startDate:dates[i], endDate:dates[Math.min(i+6, dates.length-1)]});
  }
  return out;
}

// ============================================================================
// Active URL Resolver (source: ActiveUrlResolver.gs)
// ============================================================================

function sdscParseUrl_(url) {
  const s = String(url || '').trim();
  const m = s.match(/^(https?):\/\/([^\/?#]+)([^?#]*)(?:\?[^#]*)?(?:#.*)?$/i);
  if (!m) return null;
  return {
    protocol: m[1].toLowerCase(),
    host: m[2].toLowerCase(),
    path: m[3] || '/'
  };
}

function sdscNormalizeUrl_(url) {
  const p = sdscParseUrl_(url);
  if (!p) return String(url || '').split('#')[0].split('?')[0];
  let path = p.path || '/';
  path = path.replace(/\/+$/, '');
  if (path === '') path = '/';
  return `${p.protocol}://${p.host}${path}`;
}

function sdscSameHost_(a, b) {
  const pa = sdscParseUrl_(a);
  const pb = sdscParseUrl_(b);
  return !!(pa && pb && pa.host === pb.host);
}

function sdscLooksLikeArticleUrl_(url, siteUrl) {
  if (!sdscSameHost_(url, siteUrl)) return false;
  const p = sdscParseUrl_(url);
  if (!p) return false;
  const path = p.path || '/';
  const lower = path.toLowerCase();

  const excluded = [
    '/archive', '/archives', '/category/', '/categories/', '/tag/', '/tags/',
    '/search/', '/about', '/information/', '/privacy', '/contact', '/feed',
    '/rss', '/sitemap', '/wp-admin', '/wp-login', '/author/', '/page/'
  ];
  if (path === '/' || excluded.some(x => lower.indexOf(x) >= 0)) return false;

  // Hatena Blog canonical article path, including HHMMSS tail.
  if (/^\/entry\/\d{4}\/\d{2}\/\d{2}\/[^\/?#]+\/?$/.test(path)) return true;

  // Common WordPress numeric permalink.
  if (/^\/\d+\/?$/.test(path)) return true;

  // Dated permalink fallback.
  if (/^\/\d{4}\/\d{2}\/\d{2}\/.+/.test(path)) return true;

  return false;
}

function sdscResolveActiveArticleUrls_(observedPages, siteUrl) {
  const observedMap = {};
  (observedPages || []).forEach(p => {
    const original = String(p || '');
    const n = sdscNormalizeUrl_(original);
    // Prefer the fragment/query-free exact GSC URL as the page filter target.
    if (!observedMap[n] || (!original.includes('#') && !original.includes('?'))) {
      observedMap[n] = original;
    }
  });

  const sitemapUrls = sdscDiscoverSitemapArticleUrls_(siteUrl);
  const sitemapSet = {};
  sitemapUrls.forEach(u => { sitemapSet[sdscNormalizeUrl_(u)] = true; });

  const intersectionKeys = Object.keys(observedMap).filter(n => sitemapSet[n]);
  if (intersectionKeys.length >= 20) {
    return {
      strategy: 'SITEMAP_INTERSECTION',
      pages: intersectionKeys.map(n => observedMap[n]).sort(),
      observedCount: Object.keys(observedMap).length,
      sitemapCount: Object.keys(sitemapSet).length
    };
  }

  const heuristic = Object.keys(observedMap)
    .filter(n => sdscLooksLikeArticleUrl_(observedMap[n], siteUrl))
    .map(n => observedMap[n])
    .sort();

  return {
    strategy: 'ARTICLE_URL_HEURISTIC',
    pages: heuristic,
    observedCount: Object.keys(observedMap).length,
    sitemapCount: Object.keys(sitemapSet).length
  };
}

function sdscDiscoverSitemapArticleUrls_(siteUrl) {
  const seeds = sdscSitemapSeeds_(siteUrl);
  const visited = {};
  const urls = [];
  const queue = seeds.slice();
  const maxSitemaps = 60;

  while (queue.length && Object.keys(visited).length < maxSitemaps) {
    const sitemapUrl = queue.shift();
    if (!sitemapUrl || visited[sitemapUrl]) continue;
    visited[sitemapUrl] = true;
    try {
      const response = UrlFetchApp.fetch(sitemapUrl, {
        muteHttpExceptions: true,
        followRedirects: true,
        headers: {'User-Agent':'SIMS-Doctor-Site-Collector/0.2'}
      });
      const code = response.getResponseCode();
      if (code < 200 || code >= 300) continue;
      const doc = XmlService.parse(response.getContentText());
      const root = doc.getRootElement();
      const ns = root.getNamespace();
      const rootName = root.getName().toLowerCase();

      if (rootName === 'sitemapindex') {
        root.getChildren('sitemap', ns).forEach(node => {
          const loc = node.getChildText('loc', ns);
          if (loc && !visited[loc]) queue.push(loc.trim());
        });
      } else if (rootName === 'urlset') {
        root.getChildren('url', ns).forEach(node => {
          const loc = node.getChildText('loc', ns);
          if (loc && sdscSameHost_(loc.trim(), siteUrl)) urls.push(loc.trim());
        });
      }
    } catch (e) {}
  }
  return [...new Set(urls)];
}

function sdscSitemapSeeds_(siteUrl) {
  const base = String(siteUrl || '').replace(/\/+$/, '');
  const out = [`${base}/sitemap.xml`, `${base}/sitemap_index.xml`];
  try {
    const res = UrlFetchApp.fetch(`${base}/robots.txt`, {muteHttpExceptions:true});
    if (res.getResponseCode() >= 200 && res.getResponseCode() < 300) {
      res.getContentText().split(/\r?\n/).forEach(line => {
        const m = line.match(/^\s*Sitemap:\s*(\S+)/i);
        if (m) out.push(m[1]);
      });
    }
  } catch (e) {}
  return [...new Set(out)];
}

// ============================================================================
// Storage (source: Storage.gs)
// ============================================================================

function sdscPrepareCompactSheets_() {
  const ss = SpreadsheetApp.getActive();
  const defs = [
    [SDSC_CONFIG.sheets.status, ['item','value']],
    [SDSC_CONFIG.sheets.siteDaily, ['date','clicks','impressions','ctr','position']],
    [SDSC_CONFIG.sheets.pagePeriod, ['period','page','clicks','impressions','ctr','position']],
    [SDSC_CONFIG.sheets.pageWeekly, ['week_start','week_end','page','clicks','impressions','ctr','position']],
    [SDSC_CONFIG.sheets.queryPeriod, ['period','query','clicks','impressions','ctr','position']],
    [SDSC_CONFIG.sheets.pageQueryTop, ['page','query','clicks','impressions','ctr','position']]
  ];
  defs.forEach(([name, headers]) => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    sh.clearContents();
    sh.getRange(1,1,1,headers.length).setValues([headers]);
    if (name !== SDSC_CONFIG.sheets.status) {
      try { sh.hideSheet(); } catch (e) {}
    }
  });
}
function sdscAppendRows_(sheetName, rows) {
  if (!rows || !rows.length) return;
  const sh = SpreadsheetApp.getActive().getSheetByName(sheetName);
  if (!sh) throw new Error(`Output sheet not found: ${sheetName}`);
  sh.getRange(sh.getLastRow()+1, 1, rows.length, rows[0].length).setValues(rows);
}
function sdscDeleteLegacyRawSheetsWithConfirmation_() {
  const ss = SpreadsheetApp.getActive();
  const existing = SDSC_CONFIG.legacyRawSheets
    .map(n => ss.getSheetByName(n))
    .filter(Boolean);
  if (!existing.length) return true;
  const ui = SpreadsheetApp.getUi();
  const answer = ui.alert(
    '旧Collectorの巨大な生データシートを削除します',
    'v0.2.0では pageDaily / queryDaily の大量生データを保存しません。\n' +
    '1,000万セル制限を回避するため、旧Collectorの生データ用シートを削除します。\n\n' +
    'Evidence ZIPなど必要な成果物がある場合は先に保存してください。\n\n削除して新しい収集を開始しますか？',
    ui.ButtonSet.YES_NO
  );
  if (answer !== ui.Button.YES) return false;
  existing.forEach(sh => ss.deleteSheet(sh));
  return true;
}
function sdscWriteStatus_(run) {
  const sh = SpreadsheetApp.getActive().getSheetByName(SDSC_CONFIG.sheets.status);
  if (!sh) return;
  const rows = [
    ['Version', SDSC_VERSION],
    ['Site', sdscGetConfig_().siteUrl || ''],
    ['Run', run.runId || ''],
    ['Status', run.status || ''],
    ['Step', `${run.step || 0}/6`],
    ['Period', `${run.period ? run.period.days : ''} days`],
    ['Progress', run.progressText || ''],
    ['Output', run.outputFileUrl || ''],
    ['Last error', (run.errors && run.errors.length) ? run.errors[run.errors.length-1].message : '']
  ];
  sh.clearContents();
  sh.getRange(1,1,1,2).setValues([['item','value']]);
  sh.getRange(2,1,rows.length,2).setValues(rows);
  sh.autoResizeColumns(1,2);
}
function sdscReadData_(sheetName) {
  const sh = SpreadsheetApp.getActive().getSheetByName(sheetName);
  if (!sh) return [];
  const v = sh.getDataRange().getValues();
  return v.length > 1 ? v.slice(1) : [];
}
function sdscSheetToCsv_(sheetName) {
  const sh = SpreadsheetApp.getActive().getSheetByName(sheetName);
  return sdscValuesToCsv_(sh.getDataRange().getDisplayValues());
}
function sdscValuesToCsv_(rows) {
  return rows.map(r => r.map(v => `"${String(v == null ? '' : v).replace(/"/g,'""')}"`).join(',')).join('\r\n');
}

// ============================================================================
// Collectors (source: Collectors.gs)
// ============================================================================

function sdscCollectSiteDaily_(run, deadline) {
  const config = sdscGetConfig_();
  const dates = sdscDateRange_(run.period.startDate, run.period.endDate);
  let i = run.cursors.siteDaily || 0;
  const rows = [];
  while (i < dates.length && Date.now() < deadline - SDSC_CONFIG.deadlineGuardMs) {
    const d = dates[i];
    const res = sdscSearchAnalyticsQuery_(config.siteUrl, {
      startDate:d, endDate:d, type:'web', dataState:'final', rowLimit:1
    });
    const r = (res.rows || [])[0] || {};
    rows.push([d,r.clicks||0,r.impressions||0,r.ctr||0,r.position||0]);
    i++;
  }
  sdscAppendRows_(SDSC_CONFIG.sheets.siteDaily, rows);
  run.cursors.siteDaily = i;
  run.rows.siteDaily = (run.rows.siteDaily||0) + rows.length;
  run.progressText = `サイト日次データ: ${i}/${dates.length}日`;
  if (i >= dates.length) run.step = 2;
  else sdscPauseAndSchedule_(run, run.progressText);
}

function sdscCollectPeriodDimension_(run, deadline, dimension, sheetName, cursorKey, nextStep) {
  const config = sdscGetConfig_();
  const periods = sdscPeriodDefinitions_(run);
  let state = run.cursors[cursorKey] || {periodIndex:0,startRow:0};
  let batches = 0;
  while (
    state.periodIndex < periods.length &&
    Date.now() < deadline - SDSC_CONFIG.deadlineGuardMs &&
    batches < SDSC_CONFIG.maxBatchesPerInvocation
  ) {
    const p = periods[state.periodIndex];
    const res = sdscSearchAnalyticsQuery_(config.siteUrl, {
      startDate:p.startDate, endDate:p.endDate, type:'web', dataState:'final',
      dimensions:[dimension], rowLimit:SDSC_CONFIG.rowLimit, startRow:state.startRow
    });
    const apiRows = res.rows || [];
    const rows = apiRows.map(r => [
      p.key,
      r.keys ? r.keys[0] : '',
      r.clicks||0,r.impressions||0,r.ctr||0,r.position||0
    ]);
    sdscAppendRows_(sheetName, rows);
    run.rows[cursorKey] = (run.rows[cursorKey]||0) + rows.length;
    if (apiRows.length < SDSC_CONFIG.rowLimit) {
      state = {periodIndex:state.periodIndex+1,startRow:0};
    } else {
      state.startRow += SDSC_CONFIG.rowLimit;
    }
    run.cursors[cursorKey] = state;
    run.progressText = `${cursorKey}: 期間 ${Math.min(state.periodIndex+1,periods.length)}/${periods.length}・${run.rows[cursorKey]}行`;
    sdscSaveRun_(run);
    batches++;
  }
  if (state.periodIndex >= periods.length) run.step = nextStep;
  else sdscPauseAndSchedule_(run, run.progressText);
}

function sdscCollectPagePeriod_(run, deadline) {
  sdscCollectPeriodDimension_(run, deadline, 'page', SDSC_CONFIG.sheets.pagePeriod, 'pagePeriod', 3);
}
function sdscCollectQueryPeriod_(run, deadline) {
  sdscCollectPeriodDimension_(run, deadline, 'query', SDSC_CONFIG.sheets.queryPeriod, 'queryPeriod', 5);
}

function sdscCollectPageWeekly_(run, deadline) {
  const config = sdscGetConfig_();
  const weeks = sdscWeekDefinitions_(run);
  let state = run.cursors.pageWeekly || {weekIndex:0,startRow:0};
  let batches = 0;
  while (
    state.weekIndex < weeks.length &&
    Date.now() < deadline - SDSC_CONFIG.deadlineGuardMs &&
    batches < SDSC_CONFIG.maxBatchesPerInvocation
  ) {
    const w = weeks[state.weekIndex];
    const res = sdscSearchAnalyticsQuery_(config.siteUrl, {
      startDate:w.startDate,endDate:w.endDate,type:'web',dataState:'final',
      dimensions:['page'],rowLimit:SDSC_CONFIG.rowLimit,startRow:state.startRow
    });
    const apiRows = res.rows || [];
    const rows = apiRows.map(r => [
      w.startDate,w.endDate,r.keys?r.keys[0]:'',
      r.clicks||0,r.impressions||0,r.ctr||0,r.position||0
    ]);
    sdscAppendRows_(SDSC_CONFIG.sheets.pageWeekly, rows);
    run.rows.pageWeekly=(run.rows.pageWeekly||0)+rows.length;
    if (apiRows.length < SDSC_CONFIG.rowLimit) state={weekIndex:state.weekIndex+1,startRow:0};
    else state.startRow += SDSC_CONFIG.rowLimit;
    run.cursors.pageWeekly=state;
    run.progressText=`ページ週次: ${Math.min(state.weekIndex+1,weeks.length)}/${weeks.length}週・${run.rows.pageWeekly}行`;
    sdscSaveRun_(run);
    batches++;
  }
  if (state.weekIndex >= weeks.length) run.step=4;
  else sdscPauseAndSchedule_(run,run.progressText);
}

function sdscCollectPageQueryTop_(run, deadline) {
  const config = sdscGetConfig_();

  if (!run.pageQueryTargetUrls) {
    const pageRows = sdscReadData_(SDSC_CONFIG.sheets.pagePeriod)
      .filter(r => r[0] === 'full' && r[1]);
    const observedPages = [...new Set(pageRows.map(r => String(r[1])))];
    const resolved = sdscResolveActiveArticleUrls_(observedPages, config.siteUrl);

    run.pageQueryTargetUrls = resolved.pages;
    run.pageQueryTargetStrategy = resolved.strategy;
    run.urlResolution = {
      observedPages: resolved.observedCount,
      sitemapUrls: resolved.sitemapCount,
      targetPages: resolved.pages.length,
      strategy: resolved.strategy
    };
    run.cursors.pageQueryTop = 0;
    run.progressText =
      `ページ別上位クエリ対象を確定: ${resolved.pages.length}ページ ` +
      `(${resolved.strategy}, GSC ${resolved.observedCount} URL → 対象 ${resolved.pages.length})`;
    sdscSaveRun_(run);
  }

  const pages = run.pageQueryTargetUrls || [];
  let i = run.cursors.pageQueryTop || 0;
  let batches = 0;

  while (
    i < pages.length &&
    Date.now() < deadline - SDSC_CONFIG.deadlineGuardMs &&
    batches < SDSC_CONFIG.maxBatchesPerInvocation
  ) {
    const page = pages[i];
    const res = sdscSearchAnalyticsQuery_(config.siteUrl, {
      startDate: run.period.startDate,
      endDate: run.period.endDate,
      type: 'web',
      dataState: 'final',
      dimensions: ['query'],
      rowLimit: SDSC_CONFIG.topQueriesPerPage,
      startRow: 0,
      dimensionFilterGroups: [{
        groupType: 'and',
        filters: [{
          dimension: 'page',
          operator: 'equals',
          expression: page
        }]
      }]
    });

    const rows = (res.rows || []).map(r => [
      page,
      r.keys ? r.keys[0] : '',
      r.clicks || 0,
      r.impressions || 0,
      r.ctr || 0,
      r.position || 0
    ]);

    sdscAppendRows_(SDSC_CONFIG.sheets.pageQueryTop, rows);
    run.rows.pageQueryTop = (run.rows.pageQueryTop || 0) + rows.length;
    i++;
    run.cursors.pageQueryTop = i;
    run.progressText =
      `ページ別上位クエリ: ${i}/${pages.length}ページ ` +
      `(${run.pageQueryTargetStrategy || 'UNKNOWN'})`;
    sdscSaveRun_(run);
    batches++;
  }

  if (i >= pages.length) run.step = 6;
  else sdscPauseAndSchedule_(run, run.progressText);
}

// ============================================================================
// Evidence Packager (source: EvidencePackager.gs)
// ============================================================================

function sdscFinalizeEvidence_(run) {
  const config=sdscGetConfig_();
  const files=[];
  const datasets=[];
  run.warnings=run.warnings||[];

  const siteRaw=sdscReadData_(SDSC_CONFIG.sheets.siteDaily);
  const siteRows=sdscDedupeRows_(siteRaw, r=>String(r[0]||''));
  if(siteRows.length!==siteRaw.length) run.warnings.push(`site_daily duplicate rows removed: ${siteRaw.length-siteRows.length}`);
  const siteValues=[['date','clicks','impressions','ctr','position']].concat(siteRows);
  files.push(Utilities.newBlob(sdscValuesToCsv_(siteValues),'text/csv','site_daily.csv'));
  datasets.push({name:'site_daily',file:'site_daily.csv',rowCount:siteRows.length,status:siteRows.length===run.period.days?'VALID':'WARNING'});

  const pageSummary=sdscBuildWideSummary_(sdscReadData_(SDSC_CONFIG.sheets.pagePeriod),'page');
  files.push(Utilities.newBlob(pageSummary.csv,'text/csv','page_summary.csv'));
  datasets.push({name:'page_summary',file:'page_summary.csv',rowCount:pageSummary.rowCount,status:'VALID'});

  const weeklyRaw=sdscReadData_(SDSC_CONFIG.sheets.pageWeekly);
  const weeklyRows=sdscDedupeRows_(weeklyRaw,r=>`${r[0]}|${r[1]}|${r[2]}`);
  if(weeklyRows.length!==weeklyRaw.length) run.warnings.push(`page_weekly duplicate rows removed: ${weeklyRaw.length-weeklyRows.length}`);
  const weeklyValues=[['week_start','week_end','page','clicks','impressions','ctr','position']].concat(weeklyRows);
  files.push(Utilities.newBlob(sdscValuesToCsv_(weeklyValues),'text/csv','page_weekly.csv'));
  datasets.push({name:'page_weekly',file:'page_weekly.csv',rowCount:weeklyRows.length,status:'VALID'});

  const querySummary=sdscBuildWideSummary_(sdscReadData_(SDSC_CONFIG.sheets.queryPeriod),'query');
  files.push(Utilities.newBlob(querySummary.csv,'text/csv','query_summary.csv'));
  datasets.push({name:'query_summary',file:'query_summary.csv',rowCount:querySummary.rowCount,status:'VALID'});

  const pqRaw=sdscReadData_(SDSC_CONFIG.sheets.pageQueryTop);
  const pqRows=sdscDedupeRows_(pqRaw,r=>`${r[0]}|${r[1]}`);
  if(pqRows.length!==pqRaw.length) run.warnings.push(`page_query_top duplicate rows removed: ${pqRaw.length-pqRows.length}`);
  const pqValues=[['page','query','clicks','impressions','ctr','position']].concat(pqRows);
  files.push(Utilities.newBlob(sdscValuesToCsv_(pqValues),'text/csv','page_query_top.csv'));

  const targetCount=(run.urlResolution&&run.urlResolution.targetPages)||0;
  const pqStatus=(targetCount>0&&pqRows.length===0)?'ERROR':'VALID';
  datasets.push({name:'page_query_top',file:'page_query_top.csv',rowCount:pqRows.length,status:pqStatus});

  if(siteRows.length!==run.period.days) {
    run.warnings.push(`site_daily expected ${run.period.days} dates but found ${siteRows.length}`);
  }
  const observedCount=(run.urlResolution&&run.urlResolution.observedPages)||0;
  if(observedCount>0&&targetCount===0) {
    throw new Error(`Evidence validation failed: URL resolver selected 0 target pages from ${observedCount} observed pages.`);
  }
  if(targetCount>0&&pqRows.length===0) {
    throw new Error(`Evidence validation failed: page_query_top is empty for ${targetCount} target pages.`);
  }

  const report={
    format:'SIMS_DOCTOR_SITE_COLLECTION_REPORT_V2',
    status:'COMPLETED',
    startedAt:run.startedAt,
    completedAt:new Date().toISOString(),
    datasets,
    warnings:run.warnings||[],
    errors:[],
    storageMode:'COMPACT_EVIDENCE',
    urlResolution:run.urlResolution||null,
    note:'Large raw pageDaily/queryDaily datasets are intentionally not stored. Page trend is represented by page_weekly and period summaries.'
  };
  files.push(Utilities.newBlob(JSON.stringify(report,null,2),'application/json','collection_report.json'));

  const manifest={
    format:'SIMS_DOCTOR_SITE_EVIDENCE_PACKAGE_V2',
    packageVersion:'2.0.0-rc6',
    collectorVersion:SDSC_VERSION,
    generatedAt:new Date().toISOString(),
    timezone:config.timezone||'Asia/Tokyo',
    site:{siteUrl:config.siteUrl,searchConsoleProperty:config.siteUrl},
    period:run.period,
    searchType:'web',
    storageMode:'COMPACT_EVIDENCE',
    urlResolution:run.urlResolution||null,
    datasets,
    evidenceQuality:{
      overall:run.warnings.length?'VALID_WITH_LIMITATIONS':'VALID',
      limitations:[
        'Search Console API may omit low-volume combinations.',
        'page_query_top contains up to the configured top queries per observed active article page.',
        'Page trend is weekly rather than full page-by-day raw storage.'
      ],
      warnings:run.warnings
    }
  };
  files.push(Utilities.newBlob(JSON.stringify(manifest,null,2),'application/json','manifest.json'));
  files.push(Utilities.newBlob(sdscReadmeText_(),'text/plain','README-FIRST.md'));

  const zipName=`SIMS-Doctor-Site-Evidence-${Utilities.formatDate(new Date(),config.timezone||'Asia/Tokyo','yyyyMMdd')}.zip`;
  const folderInfo=sdscGetOutputFolderInfo_(config);
  const file=folderInfo.folder.createFile(Utilities.zip(files,zipName));
  run.outputFileId=file.getId();
  run.outputFileUrl=file.getUrl();
  run.outputFolderId=folderInfo.id;
  run.outputFolderName=folderInfo.name;
  run.outputFolderUrl=folderInfo.url;
  run.status='COMPLETED';
  run.step=7;
  run.completedAt=new Date().toISOString();
  run.progressText=`Evidence Package生成完了\n保存先: ${folderInfo.name}`;
  run.errors=[];
  sdscSaveRun_(run);
  sdscWriteStatus_(run);
  sdscClearResumeTrigger_();
}

function sdscDedupeRows_(rows,keyFn){
  const map={};
  (rows||[]).forEach(r=>{ const k=keyFn(r); if(k) map[k]=r; });
  return Object.keys(map).sort().map(k=>map[k]);
}

function sdscBuildWideSummary_(rows, keyLabel) {
  const periods=['full','first_half','second_half','recent28','previous28'];
  const by={};
  rows.forEach(r=>{
    const period=String(r[0]||'');
    const key=String(r[1]||'');
    if(!key)return;
    by[key]=by[key]||{};
    by[key][period]={
      clicks:Number(r[2]||0),impressions:Number(r[3]||0),
      ctr:Number(r[4]||0),position:Number(r[5]||0)
    };
  });
  const headers=['key'];
  periods.forEach(p=>headers.push(`clicks_${p}`,`impressions_${p}`,`ctr_${p}`,`position_${p}`));
  const out=[headers];
  Object.keys(by).sort().forEach(key=>{
    const row=[key];
    periods.forEach(p=>{
      const m=by[key][p]||{clicks:0,impressions:0,ctr:0,position:0};
      row.push(m.clicks,m.impressions,m.ctr,m.position);
    });
    out.push(row);
  });
  return {csv:sdscValuesToCsv_(out),rowCount:out.length-1};
}
function sdscGetOrCreateFolder_(name) {
  const it=DriveApp.getFoldersByName(name);
  return it.hasNext()?it.next():DriveApp.createFolder(name);
}
function sdscReadmeText_() {
  return [
    'SIMS Doctor Site Evidence Package v2',
    '',
    'このZIPをSIMS Doctor Site Diagnosisへ添付してください。',
    'Collectorは診断を行わず、Search Console Evidenceのみを収集します。',
    '',
    'Compact Evidence:',
    '- site_daily.csv',
    '- page_summary.csv',
    '- page_weekly.csv',
    '- query_summary.csv',
    '- page_query_top.csv',
    '',
    'pageDaily/queryDailyの巨大な生データはGoogle Sheetsの1,000万セル制限回避のため保存しません。'
  ].join('\n');
}
