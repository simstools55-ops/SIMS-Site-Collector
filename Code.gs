/**
 * SIMS Site Collector v0.2.0-RC9
 * Single-Code distribution.
 * Functional baseline: v0.2.0-RC6.
 * Active RC6 runtime modules are consolidated into this file.
 */

// ============================================================================
// Core / Menu / Runner (source: Code.gs)
// ============================================================================

const SDSC_VERSION='0.2.0-RC10';

function onOpen(){
  sdscTidyUserSheets_();
  const ui=SpreadsheetApp.getUi();
  ui.createMenu('SIMS Site Collector')
    .addItem('1. 収集するサイトを選ぶ','sdscShowSetupDialog')
    .addItem('2. 通常の診断データを収集（120日）','sdscPrepareStandardCollection')
    .addItem('3. 収集状況を確認','sdscShowStatus')
    .addSeparator()
    .addSubMenu(
      ui.createMenu('追加の操作')
        .addItem('詳しく収集する（180日）','sdscPrepareDetailedCollection')
        .addItem('中断した収集を再開','sdscResumeCollection')
    )
    .addSubMenu(
      ui.createMenu('保守・トラブル対応')
        .addItem('Step 5を修復してEvidenceを再生成','sdscRepairStep5AndRebuild')
        .addItem('収集中の状態をリセット','sdscResetState')
        .addItem('内部シートを再整理','sdscTidyUserSheets')
    )
    .addToUi();
}

function sdscShowSetupDialog(){
  const props=sdscGetAccessibleSites_();
  const current=sdscGetConfig_();
  const items=props.map((p,i)=>`${i+1}. ${p.siteUrl} [${p.permissionLevel}]`).join('\n');
  const ui=SpreadsheetApp.getUi();
  const prompt=ui.prompt(
    `SIMS Site Collector v${SDSC_VERSION}`,
    `収集するサイトの番号を入力してください。\n\n${items}\n\n現在: ${current.siteUrl||'(未設定)'}`,
    ui.ButtonSet.OK_CANCEL
  );
  if(prompt.getSelectedButton()!==ui.Button.OK)return;
  const idx=Number(prompt.getResponseText())-1;
  if(!Number.isInteger(idx)||idx<0||idx>=props.length){
    ui.alert('入力が正しくありません。');return;
  }

  const selectedSiteUrl=props[idx].siteUrl;
  const suggestedSiteName=sdscSuggestedSiteName_(selectedSiteUrl);
  const namePrompt=ui.prompt(
    'サイト名',
    `Evidence Packageのファイル名に使うサイト名を入力してください。\n\n例: ガジェット探検記\n\n空欄の場合は「${suggestedSiteName}」を使用します。`,
    ui.ButtonSet.OK_CANCEL
  );
  if(namePrompt.getSelectedButton()!==ui.Button.OK)return;
  const siteName=namePrompt.getResponseText().trim()||suggestedSiteName;

  sdscSaveConfig_({
    siteUrl:selectedSiteUrl,
    siteName:siteName,
    permissionLevel:props[idx].permissionLevel,
    searchType:'web',
    timezone:Session.getScriptTimeZone()||'Asia/Tokyo',
    outputFolderId:current.outputFolderId||'',
    outputFileName:current.outputFileName||''
  });

  ui.alert(`設定しました。\n\nサイト名: ${siteName}\n対象サイト: ${selectedSiteUrl}\n標準収集期間: 120日\n\nEvidence Packageは「サイト名＋収集日時」が分かる名前で自動生成されます。`);
}
function sdscPrepareStandardCollection(){sdscShowSaveAndStartDialog_(SDSC_CONFIG.standardPeriodDays);}
function sdscPrepareDetailedCollection(){sdscShowSaveAndStartDialog_(SDSC_CONFIG.detailPeriodDays);}
function sdscStartStandardCollection(){sdscStartCollection_(SDSC_CONFIG.standardPeriodDays);}
function sdscStartDetailedCollection(){sdscStartCollection_(SDSC_CONFIG.detailPeriodDays);}

function sdscShowSaveAndStartDialog_(days){
  const config=sdscGetConfig_();
  if(!config.siteUrl)throw new Error('先に「1. 収集するサイトを選ぶ」を実行してください。');
  const defaultName=sdscDefaultEvidenceFileName_(config.siteName, config.siteUrl, config.timezone||'Asia/Tokyo');
  const initialFolder=sdscPickerFolderInfo_(config.outputFolderId||'');
  const title=days===SDSC_CONFIG.detailPeriodDays?'詳しく収集する（180日）':'通常の診断データを収集（120日）';
  const html=HtmlService.createHtmlOutput(sdscSaveDialogHtml_({
    days:days,
    title:title,
    siteUrl:config.siteUrl,
    siteName:config.siteName||sdscSuggestedSiteName_(config.siteUrl),
    defaultFileName:defaultName,
    initialFolderId:initialFolder.id,
    initialFolderName:initialFolder.name
  })).setWidth(620).setHeight(520);
  SpreadsheetApp.getUi().showModalDialog(html,'Evidence Package の保存');
}

function sdscSuggestedSiteName_(siteUrl){
  return String(siteUrl||'site')
    .replace(/^sc-domain:/i,'')
    .replace(/^https?:\/\//i,'')
    .replace(/\/.*$/,'')
    .replace(/^www\./i,'')
    .trim()||'site';
}

function sdscSafeFilePart_(value,fallback){
  let v=String(value||'').trim()
    .replace(/[\\/:*?"<>|]/g,'-')
    .replace(/\s+/g,'-')
    .replace(/-+/g,'-')
    .replace(/^-+|-+$/g,'');
  return v||fallback||'site';
}

function sdscDefaultEvidenceFileName_(siteName,siteUrl,tz){
  const site=sdscSafeFilePart_(siteName||sdscSuggestedSiteName_(siteUrl),'site');
  const stamp=Utilities.formatDate(new Date(),tz||'Asia/Tokyo','yyyyMMdd-HHmm');
  return `SIMS-Evidence-${site}-${stamp}.zip`;
}

function sdscNormalizeZipName_(name){
  let v=String(name||'').trim().replace(/[\\/:*?\"<>|]/g,'-');
  if(!v)v='SIMS-Evidence.zip';
  if(!/\.zip$/i.test(v))v+='.zip';
  return v;
}

function sdscPickerFolderInfo_(folderId){
  if(folderId){
    try{
      const f=DriveApp.getFolderById(folderId);
      return {id:f.getId(),name:f.getName()};
    }catch(e){}
  }
  const root=DriveApp.getRootFolder();
  return {id:root.getId(),name:'マイドライブ'};
}

function sdscListDriveFolders(parentId){
  let folder;
  try{folder=parentId?DriveApp.getFolderById(parentId):DriveApp.getRootFolder();}
  catch(e){folder=DriveApp.getRootFolder();}
  const items=[];
  const it=folder.getFolders();
  let count=0;
  while(it.hasNext()&&count<200){
    const f=it.next();
    items.push({id:f.getId(),name:f.getName()});
    count++;
  }
  items.sort((a,b)=>a.name.localeCompare(b.name,'ja'));
  let parent=null;
  try{
    const ps=folder.getParents();
    if(ps.hasNext()){
      const p=ps.next();
      parent={id:p.getId(),name:p.getName()||'マイドライブ'};
    }
  }catch(e){}
  return {id:folder.getId(),name:folder.getName()||'マイドライブ',parent:parent,folders:items,truncated:count>=200};
}

function sdscSaveCollectionSettingsAndStart(payload){
  const config=sdscGetConfig_();
  if(!config.siteUrl)throw new Error('対象サイトが設定されていません。');
  const folderId=String(payload&&payload.folderId||'').trim();
  const days=Number(payload&&payload.days||SDSC_CONFIG.standardPeriodDays);
  const fileName=sdscNormalizeZipName_(payload&&payload.fileName);
  let folder=DriveApp.getRootFolder();
  if(folderId)folder=DriveApp.getFolderById(folderId);
  config.outputFolderId=folder.getId();
  config.outputFileName=fileName;
  sdscSaveConfig_(config);
  const initialized=sdscStartCollection_(days,fileName,folder.getId(),true);
  if(!initialized)return {ok:false,cancelled:true};
  return {
    ok:true,
    folderName:folder.getName()||'マイドライブ',
    fileName:fileName,
    siteName:config.siteName||sdscSuggestedSiteName_(config.siteUrl),
    siteUrl:config.siteUrl
  };
}

function sdscSaveDialogHtml_(o){
  const data=JSON.stringify(o).replace(/</g,'\\u003c');
  return `<!doctype html><html><head><base target="_top"><style>
    body{font-family:Arial,'Noto Sans JP',sans-serif;margin:0;color:#202124;background:#fff}
    .wrap{padding:20px}.title{font-size:18px;font-weight:700;margin-bottom:6px}
    .sub{font-size:12px;color:#5f6368;margin-bottom:16px;word-break:break-all}
    label{display:block;font-weight:700;font-size:13px;margin:14px 0 6px}
    input{box-sizing:border-box;width:100%;padding:9px 10px;border:1px solid #dadce0;border-radius:6px;font-size:14px}
    .picker{border:1px solid #dadce0;border-radius:8px;overflow:hidden}
    .bar{display:flex;align-items:center;gap:8px;padding:8px 10px;background:#f8f9fa;border-bottom:1px solid #dadce0}
    .where{font-weight:700;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .folders{height:220px;overflow:auto}.folder{padding:9px 12px;border-bottom:1px solid #f1f3f4;cursor:pointer}.folder:hover{background:#f8f9fa}
    button{border:1px solid #dadce0;background:#fff;border-radius:6px;padding:7px 12px;cursor:pointer}.primary{background:#1a73e8;color:#fff;border-color:#1a73e8}
    .actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}.hint{font-size:12px;color:#5f6368;margin-top:6px}
    .selected{margin-top:8px;font-size:12px;color:#1a73e8}.msg{font-size:12px;color:#d93025;margin-top:8px}
    .progressCard{padding:6px}.brand{font-size:12px;font-weight:700;color:#1967d2;letter-spacing:.4px}.progressTitle{font-size:22px;font-weight:700;margin:8px 0 6px;color:#202124}.progressSite{padding:12px 14px;background:#eef4ff;border-radius:8px;font-weight:700;color:#174ea6;margin:12px 0}.progressSite span{font-size:12px;font-weight:400;color:#5f6368}.statusPill{display:inline-block;padding:5px 10px;border-radius:999px;background:#e8f0fe;color:#174ea6;font-size:12px;font-weight:700}.statusPill.completed{background:#e6f4ea;color:#137333}.statusPill.error{background:#fce8e6;color:#c5221f}.statusPill.paused_auto_resume{background:#fef7e0;color:#b06000}.progressBar{height:12px;background:#e8eaed;border-radius:999px;overflow:hidden;margin:16px 0 8px}.progressBar>div{height:100%;width:0;background:#1a73e8;transition:width .3s}.stepText{font-size:13px;font-weight:700;margin-bottom:16px}.progressGrid{display:grid;grid-template-columns:95px 1fr;gap:8px 12px;padding:14px;background:#f8f9fa;border-radius:8px;font-size:12px}.progressGrid>div:nth-child(odd){font-weight:700;color:#5f6368}.progressGrid>div:nth-child(even){word-break:break-all}
  </style></head><body><div class="wrap">
    <div class="title">${o.title}</div><div class="sub">サイト名: ${o.siteName}<br>対象サイト: ${o.siteUrl}</div>
    <label>保存先フォルダ</label><div class="picker"><div class="bar"><button id="up">↑ 上へ</button><div id="where" class="where"></div><button id="choose">このフォルダを選択</button></div><div id="folders" class="folders"></div></div>
    <div id="selected" class="selected"></div>
    <label>ファイル名</label><input id="filename" value=""><div class="hint">通常は自動生成された名前のままで構いません。</div>
    <div id="msg" class="msg"></div><div class="actions"><button onclick="google.script.host.close()">キャンセル</button><button class="primary" id="start">保存して収集開始</button></div>
  </div><script>
    const opt=${data}; let current=null; let selected={id:opt.initialFolderId,name:opt.initialFolderName};
    document.getElementById('filename').value=opt.defaultFileName;
    function esc(s){return String(s||'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));}
    function load(id){document.getElementById('folders').innerHTML='<div class="folder">読み込み中...</div>';google.script.run.withSuccessHandler(render).withFailureHandler(err=>showErr(err.message)).sdscListDriveFolders(id);}
    function render(d){current=d;document.getElementById('where').textContent=d.name;document.getElementById('up').disabled=!d.parent;const box=document.getElementById('folders');box.innerHTML=d.folders.length?'':'<div class="folder">サブフォルダはありません</div>';d.folders.forEach(f=>{const el=document.createElement('div');el.className='folder';el.textContent='📁 '+f.name;el.onclick=()=>load(f.id);box.appendChild(el);});if(d.truncated){const x=document.createElement('div');x.className='folder';x.textContent='※ 200件まで表示しています';box.appendChild(x);}}
    document.getElementById('up').onclick=()=>{if(current&&current.parent)load(current.parent.id)};
    document.getElementById('choose').onclick=()=>{if(!current)return;selected={id:current.id,name:current.name};document.getElementById('selected').textContent='保存先: '+selected.name;};
    document.getElementById('start').onclick=()=>{
      const fn=document.getElementById('filename').value.trim();
      if(!fn){showErr('ファイル名を入力してください。');return;}
      const b=document.getElementById('start');b.disabled=true;b.textContent='準備しています...';
      google.script.run.withSuccessHandler(r=>{
        if(!r||!r.ok){b.disabled=false;b.textContent='保存して収集開始';return;}
        showProgressScreen(r);
        google.script.run.withFailureHandler(err=>showProgressError(err.message)).sdscResumeCollection();
        pollProgress();
      }).withFailureHandler(err=>{b.disabled=false;b.textContent='保存して収集開始';showErr(err.message)}).sdscSaveCollectionSettingsAndStart({folderId:selected.id,fileName:fn,days:opt.days});
    };
    function showProgressScreen(r){
      document.querySelector('.wrap').innerHTML='<div class="progressCard">'+
        '<div class="brand">SIMS Site Collector</div>'+ 
        '<div class="progressTitle">診断データを収集しています</div>'+ 
        '<div class="progressSite">'+esc(r.siteName||'')+'<br><span>'+esc(r.siteUrl||'')+'</span></div>'+ 
        '<div class="statusPill" id="pstatus">準備中</div>'+ 
        '<div class="progressBar"><div id="pbar"></div></div>'+ 
        '<div class="stepText" id="pstep">収集を開始しています...</div>'+ 
        '<div class="progressGrid">'+
          '<div>開始日時</div><div id="pstart">-</div>'+ 
          '<div>完了日時</div><div id="pend">-</div>'+ 
          '<div>ファイル名</div><div id="pfile">'+esc(r.fileName||'')+'</div>'+ 
          '<div>保存先</div><div id="pfolder">'+esc(r.folderName||'')+'</div>'+ 
        '</div>'+ 
        '<div id="perror" class="msg"></div>'+ 
        '<div class="actions"><button id="closeProgress" onclick="google.script.host.close()">閉じる</button></div>'+ 
      '</div>';
    }
    function pollProgress(){
      google.script.run.withSuccessHandler(d=>{
        if(!d)return;
        updateProgress(d);
        if(d.status!=='COMPLETED'&&d.status!=='ERROR')setTimeout(pollProgress,3000);
      }).withFailureHandler(err=>{showProgressError(err.message);setTimeout(pollProgress,5000)}).sdscGetRunProgressForUi();
    }
    function updateProgress(d){
      const pill=document.getElementById('pstatus'); if(!pill)return;
      pill.textContent=d.statusLabel||d.status||''; pill.className='statusPill '+String(d.status||'').toLowerCase();
      document.getElementById('pbar').style.width=(d.progressPercent||0)+'%';
      document.getElementById('pstep').textContent=(d.stepLabel||'')+(d.progressText?' — '+d.progressText:'');
      document.getElementById('pstart').textContent=d.startedAt||'-';
      document.getElementById('pend').textContent=d.completedAt||'-';
      document.getElementById('pfile').textContent=d.outputFileName||document.getElementById('pfile').textContent;
      document.getElementById('pfolder').textContent=d.outputFolderName||document.getElementById('pfolder').textContent;
      if(d.error)document.getElementById('perror').textContent=d.error;
      if(d.status==='COMPLETED')document.querySelector('.progressTitle').textContent='収集が完了しました';
      if(d.status==='ERROR')document.querySelector('.progressTitle').textContent='収集中にエラーが発生しました';
    }
    function showProgressError(m){const e=document.getElementById('perror');if(e)e.textContent=m||'進捗を取得できませんでした。';}
    function showErr(m){document.getElementById('msg').textContent=m||'エラーが発生しました。'}
    document.getElementById('selected').textContent='保存先: '+selected.name; load(opt.initialFolderId);
  </script></body></html>`;
}

function sdscStartCollection_(days,fileName,folderId,deferResume){
  const config=sdscGetConfig_();
  if(!config.siteUrl)throw new Error('先に「1. 収集するサイトを選ぶ」を実行してください。');
  if(!sdscDeleteLegacyRawSheetsWithConfirmation_())return false;
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
    progressText:'収集を開始します',
    outputFileName:sdscNormalizeZipName_(fileName||config.outputFileName||sdscDefaultEvidenceFileName_(config.siteName,config.siteUrl,config.timezone||'Asia/Tokyo')),
    requestedOutputFolderId:String(folderId||config.outputFolderId||'')
  };
  sdscSaveRun_(run);
  sdscPrepareCompactSheets_();
  sdscWriteStatus_(run);
  if(!deferResume)sdscResumeCollection();
  return true;
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
    run.progressText='エラーが発生しました。「3. 収集状況を確認」で内容を確認してください。';
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

function sdscFormatDateTime_(iso){
  if(!iso)return '';
  try{return Utilities.formatDate(new Date(iso),Session.getScriptTimeZone()||'Asia/Tokyo','yyyy/MM/dd HH:mm:ss');}
  catch(e){return String(iso||'');}
}

function sdscEstimateProgressPercent_(run){
  if(!run)return 0;
  if(run.status==='COMPLETED')return 100;
  const step=Math.max(1,Math.min(Number(run.step||1),6));
  let within=0;
  if(step===1&&run.period&&run.period.days){within=Math.min(1,Number((run.cursors||{}).siteDaily||0)/Number(run.period.days));}
  else if(step===5&&run.pageQueryTargetUrls&&run.pageQueryTargetUrls.length){within=Math.min(1,Number((run.cursors||{}).pageQueryTop||0)/run.pageQueryTargetUrls.length);}
  const pct=((step-1)+within)/6*100;
  return Math.max(2,Math.min(98,Math.round(pct)));
}

function sdscGetRunProgressForUi(){
  const run=sdscGetRun_();
  const config=sdscGetConfig_();
  if(!run)return {status:'NONE',statusLabel:'未開始',progressPercent:0};
  const step=Math.min(Number(run.step||0),6);
  return {
    status:run.status||'',
    statusLabel:sdscStatusLabel_(run.status),
    progressPercent:sdscEstimateProgressPercent_(run),
    step:step,
    stepLabel:run.status==='COMPLETED'?'6/6 完了':`${step}/6`,
    progressText:run.progressText||'',
    startedAt:sdscFormatDateTime_(run.startedAt),
    completedAt:sdscFormatDateTime_(run.completedAt),
    outputFileName:run.outputFileName||'',
    outputFileUrl:run.outputFileUrl||'',
    outputFolderName:run.outputFolderName||'',
    siteName:config.siteName||sdscSuggestedSiteName_(config.siteUrl),
    siteUrl:config.siteUrl||'',
    error:(run.errors&&run.errors.length)?run.errors[run.errors.length-1].message:''
  };
}

function sdscShowStatus(){
  const run=sdscGetRun_();
  if(!run){SpreadsheetApp.getUi().alert(`SIMS Site Collector v${SDSC_VERSION}
収集履歴はありません。`);return;}
  sdscWriteStatus_(run);
  const html=HtmlService.createHtmlOutput(sdscProgressDialogHtml_()).setWidth(560).setHeight(440);
  SpreadsheetApp.getUi().showModelessDialog(html,'SIMS Site Collector｜収集状況');
}

function sdscProgressDialogHtml_(){
  return `<!doctype html><html><head><base target="_top"><style>
  body{font-family:Arial,'Noto Sans JP',sans-serif;margin:0;background:#f7f9fc;color:#202124}.wrap{padding:22px}.brand{font-size:12px;font-weight:700;color:#1967d2}.title{font-size:22px;font-weight:700;margin:7px 0 14px}.card{background:#fff;border:1px solid #e0e5ee;border-radius:12px;padding:18px;box-shadow:0 1px 2px rgba(0,0,0,.04)}.pill{display:inline-block;padding:5px 10px;border-radius:999px;background:#e8f0fe;color:#174ea6;font-size:12px;font-weight:700}.pill.completed{background:#e6f4ea;color:#137333}.pill.error{background:#fce8e6;color:#c5221f}.pill.paused_auto_resume{background:#fef7e0;color:#b06000}.bar{height:12px;background:#e8eaed;border-radius:999px;overflow:hidden;margin:15px 0 8px}.bar>div{height:100%;background:#1a73e8;width:0;transition:width .3s}.step{font-size:13px;font-weight:700;margin-bottom:16px}.grid{display:grid;grid-template-columns:95px 1fr;gap:8px 12px;background:#f8f9fa;border-radius:8px;padding:14px;font-size:12px}.grid>div:nth-child(odd){font-weight:700;color:#5f6368}.grid>div:nth-child(even){word-break:break-all}.err{color:#c5221f;font-size:12px;margin-top:12px}.actions{text-align:right;margin-top:14px}button{padding:7px 14px;border:1px solid #dadce0;background:#fff;border-radius:6px;cursor:pointer}
  </style></head><body><div class="wrap"><div class="brand">SIMS SITE COLLECTOR</div><div class="title" id="title">収集状況</div><div class="card"><div id="status" class="pill">確認中</div><div class="bar"><div id="bar"></div></div><div id="step" class="step"></div><div class="grid"><div>サイト名</div><div id="site"></div><div>開始日時</div><div id="start"></div><div>完了日時</div><div id="end"></div><div>ファイル名</div><div id="file"></div><div>保存先</div><div id="folder"></div></div><div id="err" class="err"></div><div class="actions"><button onclick="google.script.host.close()">閉じる</button></div></div></div><script>
  function poll(){google.script.run.withSuccessHandler(d=>{update(d);if(d.status!=='COMPLETED'&&d.status!=='ERROR')setTimeout(poll,3000)}).withFailureHandler(()=>setTimeout(poll,5000)).sdscGetRunProgressForUi()}
  function update(d){document.getElementById('status').textContent=d.statusLabel||'';document.getElementById('status').className='pill '+String(d.status||'').toLowerCase();document.getElementById('bar').style.width=(d.progressPercent||0)+'%';document.getElementById('step').textContent=(d.stepLabel||'')+(d.progressText?' — '+d.progressText:'');document.getElementById('site').textContent=d.siteName||d.siteUrl||'';document.getElementById('start').textContent=d.startedAt||'-';document.getElementById('end').textContent=d.completedAt||'-';document.getElementById('file').textContent=d.outputFileName||'-';document.getElementById('folder').textContent=d.outputFolderName||'-';document.getElementById('err').textContent=d.error||'';if(d.status==='COMPLETED')document.getElementById('title').textContent='収集が完了しました';}
  poll();
  </script></body></html>`;
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
    status: '収集状況',
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
      throw new Error('設定済みのEvidence保存先フォルダーを開けません。「1. 収集するサイトを選ぶ」で保存先を再設定してください。');
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

function sdscTidyUserSheets(){
  sdscTidyUserSheets_();
  SpreadsheetApp.getUi().alert(
    'シートを整理しました。\n\n利用者が通常確認するのは「収集状況」シートだけです。\n収集用の内部シートは非表示にしました。'
  );
}

function sdscTidyUserSheets_(){
  const ss=SpreadsheetApp.getActive();
  const legacyStatus=ss.getSheetByName('_SDSC_STATUS');
  if(legacyStatus&&!ss.getSheetByName(SDSC_CONFIG.sheets.status)){
    try{legacyStatus.setName(SDSC_CONFIG.sheets.status);}catch(e){}
  }
  const internalNames=[
    SDSC_CONFIG.sheets.siteDaily,
    SDSC_CONFIG.sheets.pagePeriod,
    SDSC_CONFIG.sheets.pageWeekly,
    SDSC_CONFIG.sheets.queryPeriod,
    SDSC_CONFIG.sheets.pageQueryTop
  ];

  internalNames.forEach(name=>{
    const sh=ss.getSheetByName(name);
    if(sh){
      try{sh.hideSheet();}catch(e){}
    }
  });

  const status=ss.getSheetByName(SDSC_CONFIG.sheets.status);
  if(status){
    try{status.showSheet();}catch(e){}
  }

  // A newly-created spreadsheet contains a blank "シート1" / "Sheet1".
  // Delete it only when it is still effectively empty and another sheet exists.
  ['シート1','Sheet1'].forEach(name=>{
    const sh=ss.getSheetByName(name);
    if(!sh||ss.getSheets().length<=1)return;
    if(sdscIsEffectivelyBlankSheet_(sh)){
      try{ss.deleteSheet(sh);}catch(e){}
    }
  });
}

function sdscIsEffectivelyBlankSheet_(sh){
  if(!sh)return false;
  try{
    if(sh.getLastRow()===0||sh.getLastColumn()===0)return true;
    const values=sh.getDataRange().getDisplayValues();
    for(let r=0;r<values.length;r++){
      for(let c=0;c<values[r].length;c++){
        if(String(values[r][c]||'').trim()!=='')return false;
      }
    }
    return true;
  }catch(e){
    return false;
  }
}

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
  sdscTidyUserSheets_();
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
function sdscStatusLabel_(status){
  const map={RUNNING:'収集中',PAUSED_AUTO_RESUME:'自動再開待ち',COMPLETED:'完了',ERROR:'エラー'};
  return map[String(status||'')]||String(status||'未開始');
}

function sdscWriteStatus_(run) {
  const sh = SpreadsheetApp.getActive().getSheetByName(SDSC_CONFIG.sheets.status);
  if (!sh) return;
  const config=sdscGetConfig_();
  const rows = [
    ['バージョン', SDSC_VERSION],
    ['サイト名', config.siteName || sdscSuggestedSiteName_(config.siteUrl) || ''],
    ['対象サイト', config.siteUrl || ''],
    ['状態', sdscStatusLabel_(run.status)],
    ['進行ステップ', run.status==='COMPLETED'?'6/6':`${Math.min(Number(run.step||0),6)}/6`],
    ['収集期間', `${run.period ? run.period.days : ''}日`],
    ['進捗', run.progressText || ''],
    ['開始日時', sdscFormatDateTime_(run.startedAt)],
    ['完了日時', sdscFormatDateTime_(run.completedAt) || (run.status==='COMPLETED'?'完了時刻を確認中':'-')],
    ['パッケージ名', run.outputFileName || '(未生成)'],
    ['Evidence Package', run.outputFileUrl || '(未生成)'],
    ['保存先', run.outputFolderName || ''],
    ['最新エラー', (run.errors && run.errors.length) ? run.errors[run.errors.length-1].message : 'なし']
  ];
  sh.clear();
  sh.getRange(1,1,1,2).setValues([['SIMS Site Collector','収集状況']]);
  sh.getRange(2,1,1,2).setValues([['項目','内容']]);
  sh.getRange(3,1,rows.length,2).setValues(rows);
  sh.setFrozenRows(2);
  sh.setColumnWidth(1,140);
  sh.setColumnWidth(2,520);
  sh.getRange(1,1,1,2).merge().setValue('SIMS Site Collector｜収集状況').setFontWeight('bold').setFontSize(16).setBackground('#174ea6').setFontColor('#ffffff').setHorizontalAlignment('left');
  sh.getRange(2,1,1,2).setFontWeight('bold').setBackground('#dbe8ff').setFontColor('#174ea6');
  sh.getRange(3,1,rows.length,1).setFontWeight('bold').setBackground('#f3f6fb').setFontColor('#4a5568');
  sh.getRange(3,2,rows.length,1).setWrap(true).setVerticalAlignment('top');
  const statusCell=sh.getRange(6,2); // row 3 + status index 3
  if(run.status==='COMPLETED')statusCell.setBackground('#e6f4ea').setFontColor('#137333').setFontWeight('bold');
  else if(run.status==='ERROR')statusCell.setBackground('#fce8e6').setFontColor('#c5221f').setFontWeight('bold');
  else if(run.status==='PAUSED_AUTO_RESUME')statusCell.setBackground('#fef7e0').setFontColor('#b06000').setFontWeight('bold');
  else statusCell.setBackground('#e8f0fe').setFontColor('#174ea6').setFontWeight('bold');
  sh.getRange(1,1,rows.length+2,2).setBorder(true,true,true,true,true,true,'#d9e2f1',SpreadsheetApp.BorderStyle.SOLID);
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
    site:{siteName:config.siteName||sdscSuggestedSiteName_(config.siteUrl),siteUrl:config.siteUrl,searchConsoleProperty:config.siteUrl},
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

  const zipName=sdscNormalizeZipName_(run.outputFileName||config.outputFileName||sdscDefaultEvidenceFileName_(config.siteName,config.siteUrl,config.timezone||'Asia/Tokyo'));
  const folderInfo=sdscGetOutputFolderInfo_({outputFolderId:run.requestedOutputFolderId||config.outputFolderId||''});
  const file=folderInfo.folder.createFile(Utilities.zip(files,zipName));
  run.outputFileId=file.getId();
  run.outputFileUrl=file.getUrl();
  run.outputFolderId=folderInfo.id;
  run.outputFolderName=folderInfo.name;
  run.outputFolderUrl=folderInfo.url;
  run.status='COMPLETED';
  run.step=7;
  run.completedAt=new Date().toISOString();
  run.progressText=`Evidence Package生成完了：${zipName}`;
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
