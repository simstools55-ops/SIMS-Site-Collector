const SDSC_VERSION = '0.1.1';

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('SIMS Doctor Site Collector')
    .addItem('1. Setup / Select Site', 'sdscShowSetupDialog')
    .addItem('2. Start 180-day Collection', 'sdscStartCollection')
    .addItem('3. Resume Collection', 'sdscResumeCollection')
    .addItem('4. Show Status', 'sdscShowStatus')
    .addSeparator()
    .addItem('Reset Collector State', 'sdscResetState')
    .addToUi();
}

function sdscShowSetupDialog() {
  const props = sdscGetAccessibleSites_();
  const current = sdscGetConfig_();
  const items = props.map((p, i) => `${i + 1}. ${p.siteUrl} [${p.permissionLevel}]`).join('\n');
  const ui = SpreadsheetApp.getUi();
  const prompt = ui.prompt(
    `SIMS Doctor Site Collector v${SDSC_VERSION}`,
    `Search Console property numberを入力してください。\n\n${items}\n\n現在: ${current.siteUrl || '(未設定)'}`,
    ui.ButtonSet.OK_CANCEL
  );
  if (prompt.getSelectedButton() !== ui.Button.OK) return;
  const idx = Number(prompt.getResponseText()) - 1;
  if (!Number.isInteger(idx) || idx < 0 || idx >= props.length) {
    ui.alert('入力が正しくありません。');
    return;
  }
  sdscSaveConfig_({
    siteUrl: props[idx].siteUrl,
    permissionLevel: props[idx].permissionLevel,
    searchType: 'web',
    periodDays: 180,
    timezone: Session.getScriptTimeZone() || 'Asia/Tokyo'
  });
  ui.alert(`設定しました。\n${props[idx].siteUrl}\n診断期間: 180日\n検索タイプ: web`);
}

function sdscStartCollection() {
  const config = sdscGetConfig_();
  if (!config.siteUrl) throw new Error('先に Setup / Select Site を実行してください。');
  sdscClearResumeTrigger_();
  const period = sdscResolvePeriod_(config.periodDays || 180);
  const run = {
    format: 'SIMS_DOCTOR_SITE_COLLECTOR_RUN_V1',
    collectorVersion: SDSC_VERSION,
    runId: `SITE-${Utilities.formatDate(new Date(), config.timezone || 'Asia/Tokyo', 'yyyyMMdd-HHmmss')}`,
    status: 'RUNNING',
    step: 1,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    period,
    cursors: {},
    rows: {},
    warnings: [],
    errors: []
  };
  sdscSaveRun_(run);
  sdscInitOutputSheets_();
  sdscResumeCollection();
}

function sdscResumeCollection() {
  const run = sdscGetRun_();
  if (!run || !run.runId) throw new Error('実行中または再開可能なCollector Runがありません。');
  if (run.status === 'COMPLETED') {
    SpreadsheetApp.getUi().alert('このRunはすでに完了しています。');
    return;
  }
  run.status = 'RUNNING';
  run.updatedAt = new Date().toISOString();
  sdscSaveRun_(run);
  const deadline = Date.now() + SDSC_CONFIG.softExecutionMs;
  try {
    while (Date.now() < deadline && run.step <= 5) {
      if (run.step === 1) sdscCollectSiteDaily_(run, deadline);
      else if (run.step === 2) sdscCollectPageDaily_(run, deadline);
      else if (run.step === 3) sdscCollectQueryDaily_(run, deadline);
      else if (run.step === 4) sdscCollectPageQuery_(run, deadline);
      else if (run.step === 5) sdscFinalizeEvidence_(run);
      run.updatedAt = new Date().toISOString();
      run.transientFailureCount = 0;
      sdscSaveRun_(run);
      if (run.status === 'PAUSED_AUTO_RESUME') break;
    }
    if (run.step <= 5 && run.status !== 'COMPLETED') {
      sdscPauseAndSchedule_(run, 'soft execution limit reached');
    }
  } catch (e) {
    run.errors = run.errors || [];
    run.errors.push({ at: new Date().toISOString(), message: String(e && e.stack ? e.stack : e) });
    if (sdscIsTransientSpreadsheetError_(e)) {
      run.transientFailureCount = (run.transientFailureCount || 0) + 1;
      if (run.transientFailureCount <= (SDSC_CONFIG.transientRunMaxRetries || 6)) {
        sdscPauseAndSchedule_(run, `transient spreadsheet error; auto retry ${run.transientFailureCount}`);
        return;
      }
    }
    run.status = 'ERROR';
    sdscSaveRun_(run);
    throw e;
  }
}

function sdscShowStatus() {
  const run = sdscGetRun_();
  if (!run) {
    SpreadsheetApp.getUi().alert(`SIMS Doctor Site Collector v${SDSC_VERSION}\nRunはありません。`);
    return;
  }
  const config = sdscGetConfig_();
  SpreadsheetApp.getUi().alert(
    `SIMS Doctor Site Collector v${SDSC_VERSION}\n\n` +
    `Site: ${config.siteUrl || ''}\n` +
    `Run: ${run.runId}\nStatus: ${run.status}\nStep: ${run.step}/5\n` +
    `Rows: ${JSON.stringify(run.rows || {})}\n` +
    `Output: ${run.outputFileUrl || '(未生成)'}`
  );
}

function sdscResetState() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.alert('Collector状態をリセットしますか？', '途中状態だけを削除します。取得済みシートは残ります。', ui.ButtonSet.YES_NO);
  if (r !== ui.Button.YES) return;
  sdscClearResumeTrigger_();
  PropertiesService.getDocumentProperties().deleteProperty(SDSC_CONFIG.runPropertyKey);
  ui.alert('Collector状態をリセットしました。');
}
