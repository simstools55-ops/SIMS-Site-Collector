function sdscInitOutputSheets_() {
  const ss = SpreadsheetApp.getActive();
  const defs = [
    [SDSC_CONFIG.sheets.siteDaily, ['date','clicks','impressions','ctr','position']],
    [SDSC_CONFIG.sheets.pageDaily, ['date','page','clicks','impressions','ctr','position']],
    [SDSC_CONFIG.sheets.queryDaily, ['date','query','clicks','impressions','ctr','position']],
    [SDSC_CONFIG.sheets.pageQuery, ['page','query','clicks','impressions','ctr','position']]
  ];
  defs.forEach(([name, headers]) => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    sh.clearContents();
    sh.getRange(1,1,1,headers.length).setValues([headers]);
    try { sh.hideSheet(); } catch (e) {}
  });
}

function sdscAppendRows_(sheetName, rows) {
  if (!rows || !rows.length) return;
  let delay = SDSC_CONFIG.sheetWriteRetryBaseMs || 1000;
  let lastError = null;
  for (let attempt = 0; attempt <= (SDSC_CONFIG.sheetWriteMaxRetries || 5); attempt++) {
    try {
      const ss = SpreadsheetApp.getActive();
      const sh = ss.getSheetByName(sheetName);
      if (!sh) throw new Error(`Output sheet not found: ${sheetName}`);
      const startRow = sh.getLastRow() + 1;
      sh.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);
      SpreadsheetApp.flush();
      return;
    } catch (e) {
      lastError = e;
      if (!sdscIsTransientSpreadsheetError_(e) || attempt >= (SDSC_CONFIG.sheetWriteMaxRetries || 5)) break;
      Utilities.sleep(delay);
      delay = Math.min(delay * 2, 16000);
    }
  }
  throw lastError || new Error(`Spreadsheet write failed: ${sheetName}`);
}

function sdscIsTransientSpreadsheetError_(e) {
  const msg = String(e && e.message ? e.message : e || '');
  return /スプレッドシートのサービスに接続できなくなりました|Service Spreadsheets failed|Service timed out|Internal error|一時的|temporarily|try again/i.test(msg);
}

function sdscDateRange_(startDate, endDate) {
  const out = [];
  const d = new Date(startDate + 'T00:00:00');
  const e = new Date(endDate + 'T00:00:00');
  while (d <= e) {
    out.push(Utilities.formatDate(d, 'Etc/UTC', 'yyyy-MM-dd'));
    d.setUTCDate(d.getUTCDate()+1);
  }
  return out;
}
