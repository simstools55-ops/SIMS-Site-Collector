function sdscFinalizeEvidence_(run) {
  const config = sdscGetConfig_();
  const ss = SpreadsheetApp.getActive();
  const files = [];
  const datasets = [];
  const map = [
    ['site_daily', SDSC_CONFIG.sheets.siteDaily],
    ['page_daily', SDSC_CONFIG.sheets.pageDaily],
    ['query_daily', SDSC_CONFIG.sheets.queryDaily],
    ['page_query', SDSC_CONFIG.sheets.pageQuery]
  ];
  map.forEach(([name, sheet]) => {
    const csv = sdscSheetToCsv_(ss.getSheetByName(sheet));
    files.push(Utilities.newBlob(csv, 'text/csv', `${name}.csv`));
    datasets.push({ name, file: `${name}.csv`, rowCount: Math.max(0, (ss.getSheetByName(sheet).getLastRow() || 1) - 1), status: 'VALID' });
  });
  const summaries = sdscBuildSummaries_();
  files.push(Utilities.newBlob(JSON.stringify(summaries.siteSummary, null, 2), 'application/json', 'site_summary.json'));
  files.push(Utilities.newBlob(summaries.pageSummaryCsv, 'text/csv', 'page_summary.csv'));
  files.push(Utilities.newBlob(summaries.querySummaryCsv, 'text/csv', 'query_summary.csv'));
  datasets.push({ name: 'page_summary', file: 'page_summary.csv', rowCount: summaries.pageSummaryRows, status: 'VALID' });
  datasets.push({ name: 'query_summary', file: 'query_summary.csv', rowCount: summaries.querySummaryRows, status: 'VALID' });

  const report = {
    format: 'SIMS_DOCTOR_SITE_COLLECTION_REPORT_V1',
    status: 'COMPLETED',
    startedAt: run.startedAt,
    completedAt: new Date().toISOString(),
    datasets,
    warnings: run.warnings || [],
    errors: run.errors || [],
    note: 'Search Console Search Analytics API does not guarantee every possible row; evidence quality must be evaluated by Doctor.'
  };
  files.push(Utilities.newBlob(JSON.stringify(report, null, 2), 'application/json', 'collection_report.json'));

  const manifest = {
    format: 'SIMS_DOCTOR_SITE_EVIDENCE_PACKAGE_V1',
    packageVersion: '1.0.0',
    collectorVersion: SDSC_VERSION,
    generatedAt: new Date().toISOString(),
    timezone: config.timezone || 'Asia/Tokyo',
    site: { siteUrl: config.siteUrl, searchConsoleProperty: config.siteUrl },
    period: run.period,
    searchType: 'web',
    datasets,
    evidenceQuality: { overall: 'VALID_WITH_LIMITATIONS', limitations: ['Search Console API internal row limits/top-row behavior may omit low-volume combinations.'] }
  };
  files.push(Utilities.newBlob(JSON.stringify(manifest, null, 2), 'application/json', 'manifest.json'));
  files.push(Utilities.newBlob(sdscReadmeText_(), 'text/plain', 'README-FIRST.md'));

  const zipName = `SIMS-Doctor-Site-Evidence-${Utilities.formatDate(new Date(), config.timezone || 'Asia/Tokyo', 'yyyyMMdd')}.zip`;
  const folder = sdscGetOrCreateFolder_(SDSC_CONFIG.outputFolderName);
  const file = folder.createFile(Utilities.zip(files, zipName));
  run.outputFileId = file.getId();
  run.outputFileUrl = file.getUrl();
  run.status = 'COMPLETED';
  run.step = 6;
  run.completedAt = new Date().toISOString();
  sdscClearResumeTrigger_();
  SpreadsheetApp.getUi().alert(`サイト診断用Evidence Packageを作成しました。\n${zipName}\n\nGoogle Drive: ${file.getUrl()}`);
}

function sdscBuildSummaries_() {
  const ss = SpreadsheetApp.getActive();
  const siteRows = sdscReadData_(ss.getSheetByName(SDSC_CONFIG.sheets.siteDaily));
  const pageRows = sdscReadData_(ss.getSheetByName(SDSC_CONFIG.sheets.pageDaily));
  const queryRows = sdscReadData_(ss.getSheetByName(SDSC_CONFIG.sheets.queryDaily));
  const siteSummary = sdscAggregatePeriods_(siteRows, true);
  const page = sdscAggregateDimensionPeriods_(pageRows);
  const query = sdscAggregateDimensionPeriods_(queryRows);
  return {
    siteSummary: { format: 'SIMS_DOCTOR_SITE_SUMMARY_V1', ...siteSummary },
    pageSummaryCsv: sdscObjectsToCsv_(page.rows, page.headers),
    querySummaryCsv: sdscObjectsToCsv_(query.rows, query.headers),
    pageSummaryRows: page.rows.length,
    querySummaryRows: query.rows.length
  };
}

function sdscAggregateDimensionPeriods_(rows) {
  const by = {};
  rows.forEach(r => {
    const key = r[1];
    if (!key) return;
    (by[key] ||= []).push(r);
  });
  const headers = ['key','clicks_180d','impressions_180d','ctr_180d','position_180d','clicks_first90d','impressions_first90d','position_first90d','clicks_last90d','impressions_last90d','position_last90d','clicks_recent28d','impressions_recent28d','position_recent28d','clicks_previous28d','impressions_previous28d','position_previous28d'];
  const out = Object.keys(by).map(key => {
    const p = sdscAggregatePeriods_(by[key], false);
    return [key,
      p.full_period.clicks,p.full_period.impressions,p.full_period.ctr,p.full_period.position,
      p.first_90_days.clicks,p.first_90_days.impressions,p.first_90_days.position,
      p.last_90_days.clicks,p.last_90_days.impressions,p.last_90_days.position,
      p.recent_28_days.clicks,p.recent_28_days.impressions,p.recent_28_days.position,
      p.previous_28_days.clicks,p.previous_28_days.impressions,p.previous_28_days.position
    ];
  });
  return { headers, rows: out };
}

function sdscAggregatePeriods_(rows, siteShape) {
  const sorted = rows.slice().sort((a,b) => String(a[0]).localeCompare(String(b[0])));
  const dates = [...new Set(sorted.map(r => r[0]))];
  const first90Dates = new Set(dates.slice(0, 90));
  const last90Dates = new Set(dates.slice(-90));
  const recent28Dates = new Set(dates.slice(-28));
  const previous28Dates = new Set(dates.slice(-56, -28));
  return {
    full_period: sdscWeightedMetrics_(sorted, siteShape),
    first_90_days: sdscWeightedMetrics_(sorted.filter(r => first90Dates.has(r[0])), siteShape),
    last_90_days: sdscWeightedMetrics_(sorted.filter(r => last90Dates.has(r[0])), siteShape),
    recent_28_days: sdscWeightedMetrics_(sorted.filter(r => recent28Dates.has(r[0])), siteShape),
    previous_28_days: sdscWeightedMetrics_(sorted.filter(r => previous28Dates.has(r[0])), siteShape)
  };
}

function sdscWeightedMetrics_(rows, siteShape) {
  let clicks=0, impressions=0, posImp=0;
  const ci = siteShape ? 1 : 2;
  const ii = siteShape ? 2 : 3;
  const pi = siteShape ? 4 : 5;
  rows.forEach(r => { clicks += Number(r[ci] || 0); impressions += Number(r[ii] || 0); posImp += Number(r[pi] || 0) * Number(r[ii] || 0); });
  return { clicks, impressions, ctr: impressions ? clicks/impressions : 0, position: impressions ? posImp/impressions : 0 };
}

function sdscSheetToCsv_(sh) {
  return sdscValuesToCsv_(sh.getDataRange().getDisplayValues());
}
function sdscObjectsToCsv_(rows, headers) { return sdscValuesToCsv_([headers].concat(rows)); }
function sdscValuesToCsv_(rows) {
  return rows.map(r => r.map(v => `"${String(v == null ? '' : v).replace(/"/g,'""')}"`).join(',')).join('\r\n');
}
function sdscReadData_(sh) { const v=sh.getDataRange().getValues(); return v.length > 1 ? v.slice(1) : []; }
function sdscGetOrCreateFolder_(name) {
  const it = DriveApp.getFoldersByName(name); return it.hasNext() ? it.next() : DriveApp.createFolder(name);
}
function sdscReadmeText_() {
  return [
    'SIMS Doctor Site Evidence Package',
    '',
    'このZIPをSIMS Doctor Site Diagnosisへ添付してください。',
    'Collectorは診断を行わず、Search Console Evidenceのみを収集します。',
    '',
    'Important:',
    '- Search Console APIはすべての低ボリューム行を必ず返すものではありません。',
    '- Doctorはcollection_report.jsonとmanifest.jsonを先に検証してください.'
  ].join('\n');
}
