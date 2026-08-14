const SDSC_VERSION='0.2.0-RC6';

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
    `Google Driveの保存先フォルダーURLまたはフォルダーIDを入力してください。\n空欄なら既定フォルダー「${SDSC_CONFIG.outputFolderName}」を使用します。\n\n現在の保存先:\n${currentFolderText}`,
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
      ui.alert('保存先フォルダーを開けませんでした。\nGoogle DriveフォルダーURLまたはフォルダーIDを確認してください。');
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
