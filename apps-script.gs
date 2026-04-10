// ════════════════════════════════════════════════════════
//  מבשר ציון — Google Apps Script
//  העתק את כל הקוד הזה ל-script.google.com
//  שם הגיליון יווצר אוטומטית בשם "מתפללים"
// ════════════════════════════════════════════════════════

const SHEET_NAME = 'מתפללים';
const ADMIN_PW   = 'Nir2026';   // ← שנה אם רוצה

// ── פותח / יוצר את הגיליון ──────────────────────────────
function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(['id', 'שם פרטי', 'שם משפחה', 'שם האב', 'שם האם',
                  'שם לתורה', 'טלפון', 'אימייל', 'כתובת',
                  'התנדבות', 'ילדים (JSON)', 'יארצייטים (JSON)',
                  'תאריך רישום', 'JSON מלא']);
    sh.setFrozenRows(1);
    sh.getRange('1:1').setFontWeight('bold')
      .setBackground('#1a2744').setFontColor('#c8a84b');
  }
  return sh;
}

// ── GET: מחזיר את כל המתפללים כ-JSON ────────────────────
function doGet(e) {
  const action = e?.parameter?.action || '';

  if (action === 'getAll') {
    const sh   = getSheet();
    const data = sh.getDataRange().getValues();
    const members = [];

    for (let i = 1; i < data.length; i++) {
      const jsonCol = data[i][13]; // עמודה 14 = JSON מלא
      if (!jsonCol) continue;
      try {
        members.push(JSON.parse(jsonCol));
      } catch (err) {
        // שורה פגומה — מדלג
      }
    }

    return ContentService
      .createTextOutput(JSON.stringify(members))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'getDuty') {
    return jsonResp(getDutyData());
  }

  if (action === 'getStats') {
    return jsonResp(getAnalyticsStats());
  }

  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', msg: 'Mevaser Zion API' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── POST: שמירה / עדכון / מחיקה ─────────────────────────
function doPost(e) {
  let payload;
  try {
    payload = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResp({ status: 'error', msg: 'Invalid JSON' });
  }

  const { action, member, id } = payload;

  if (action === 'save') {
    return jsonResp(saveMember(member));
  }
  if (action === 'update') {
    return jsonResp(updateMember(member));
  }
  if (action === 'delete') {
    return jsonResp(deleteMember(id));
  }
  if (action === 'saveDuty') {
    return jsonResp(saveDutyData(payload.duty));
  }
  if (action === 'trackVisit') {
    return jsonResp(trackVisit(payload));
  }
  if (action === 'heartbeat') {
    return jsonResp(recordHeartbeat(payload));
  }

  return jsonResp({ status: 'error', msg: 'Unknown action: ' + action });
}

// ── שמירת מתפלל חדש ─────────────────────────────────────
function saveMember(m) {
  if (!m || !m.id) return { status: 'error', msg: 'Missing id' };
  const sh = getSheet();

  // בדוק שה-id לא קיים כבר
  const ids = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), 1).getValues().flat();
  if (ids.includes(m.id)) {
    return updateMember(m); // כפול — עדכן במקום
  }

  sh.appendRow([
    m.id,
    m.firstName   || '',
    m.lastName    || '',
    m.fatherName  || '',
    m.motherName  || '',
    m.torahName   || '',
    m.phone       || '',
    m.email       || '',
    m.address     || '',
    (m.volunteering || []).join(', '),
    JSON.stringify(m.children   || []),
    JSON.stringify(m.yahrzeits  || []),
    m.timestamp   || new Date().toISOString(),
    JSON.stringify(m)
  ]);

  return { status: 'ok', id: m.id };
}

// ── עדכון מתפלל קיים ────────────────────────────────────
function updateMember(m) {
  if (!m || !m.id) return { status: 'error', msg: 'Missing id' };
  const sh   = getSheet();
  const rows = sh.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === m.id) {
      const r = i + 1; // שורה ב-Sheets (1-based)
      sh.getRange(r, 2).setValue(m.firstName   || '');
      sh.getRange(r, 3).setValue(m.lastName    || '');
      sh.getRange(r, 4).setValue(m.fatherName  || '');
      sh.getRange(r, 5).setValue(m.motherName  || '');
      sh.getRange(r, 6).setValue(m.torahName   || '');
      sh.getRange(r, 7).setValue(m.phone       || '');
      sh.getRange(r, 8).setValue(m.email       || '');
      sh.getRange(r, 9).setValue(m.address     || '');
      sh.getRange(r, 10).setValue((m.volunteering || []).join(', '));
      sh.getRange(r, 11).setValue(JSON.stringify(m.children  || []));
      sh.getRange(r, 12).setValue(JSON.stringify(m.yahrzeits || []));
      sh.getRange(r, 14).setValue(JSON.stringify(m));
      return { status: 'ok', id: m.id };
    }
  }

  // לא נמצא — שמור חדש
  return saveMember(m);
}

// ── מחיקת מתפלל ─────────────────────────────────────────
function deleteMember(id) {
  if (!id) return { status: 'error', msg: 'Missing id' };
  const sh   = getSheet();
  const rows = sh.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === id) {
      sh.deleteRow(i + 1);
      return { status: 'ok', deleted: id };
    }
  }

  return { status: 'error', msg: 'Member not found: ' + id };
}

// ── תורנויות — גיליון נפרד ─────────────────────────────
const DUTY_SHEET_NAME = 'תורנויות';

function getDutySheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(DUTY_SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(DUTY_SHEET_NAME);
    sh.appendRow(['key', 'value', 'updatedAt']);
    sh.setFrozenRows(1);
    sh.getRange('1:1').setFontWeight('bold')
      .setBackground('#1e7d4b').setFontColor('#fff');
  }
  return sh;
}

function saveDutyData(duty) {
  if (!duty) return { status: 'error', msg: 'Missing duty data' };
  const sh = getDutySheet();
  const now = new Date().toISOString();
  // Store each key (queue, history, swaps) as a separate row
  const keys = ['queue', 'history', 'swaps', 'customs'];
  const rows = sh.getDataRange().getValues();

  for (const key of keys) {
    if (duty[key] === undefined) continue;
    let found = false;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === key) {
        sh.getRange(i + 1, 2).setValue(JSON.stringify(duty[key]));
        sh.getRange(i + 1, 3).setValue(now);
        found = true;
        break;
      }
    }
    if (!found) {
      sh.appendRow([key, JSON.stringify(duty[key]), now]);
    }
  }
  return { status: 'ok' };
}

function getDutyData() {
  const sh = getDutySheet();
  const rows = sh.getDataRange().getValues();
  const result = {};
  for (let i = 1; i < rows.length; i++) {
    try {
      result[rows[i][0]] = JSON.parse(rows[i][1]);
    } catch (e) {}
  }
  return { status: 'ok', duty: result };
}

// ── Helper ───────────────────────────────────────────────
function jsonResp(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ══════════════════════════════════════════════════════════
//  סטטיסטיקות ביקורים
// ══════════════════════════════════════════════════════════
const VISITS_SHEET = 'ביקורים';
const ACTIVE_SHEET = 'פעילים';

function getVisitsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(VISITS_SHEET);
  if (!sh) {
    sh = ss.insertSheet(VISITS_SHEET);
    sh.appendRow(['date', 'visitorId', 'timestamp', 'userAgent', 'isAdmin']);
    sh.setFrozenRows(1);
    sh.getRange('1:1').setFontWeight('bold').setBackground('#2563eb').setFontColor('#fff');
  }
  return sh;
}

function getActiveSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(ACTIVE_SHEET);
  if (!sh) {
    sh = ss.insertSheet(ACTIVE_SHEET);
    sh.appendRow(['visitorId', 'lastSeen', 'isAdmin']);
    sh.setFrozenRows(1);
    sh.getRange('1:1').setFontWeight('bold').setBackground('#1e7d4b').setFontColor('#fff');
  }
  return sh;
}

function trackVisit(payload) {
  if (!payload || !payload.vid) return { status: 'error', msg: 'Missing vid' };
  const sh = getVisitsSheet();
  const now = new Date();
  const dateStr = Utilities.formatDate(now, 'Asia/Jerusalem', 'yyyy-MM-dd');
  sh.appendRow([
    dateStr,
    payload.vid,
    now.toISOString(),
    (payload.ua || '').substring(0, 200),
    payload.isAdmin ? 'yes' : 'no'
  ]);
  // Also update active sheet
  recordHeartbeat(payload);
  return { status: 'ok' };
}

function recordHeartbeat(payload) {
  if (!payload || !payload.vid) return { status: 'error', msg: 'Missing vid' };
  const sh = getActiveSheet();
  const rows = sh.getDataRange().getValues();
  const now = new Date().toISOString();
  // Update existing row or append new
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === payload.vid) {
      sh.getRange(i + 1, 2).setValue(now);
      sh.getRange(i + 1, 3).setValue(payload.isAdmin ? 'yes' : 'no');
      return { status: 'ok' };
    }
  }
  sh.appendRow([payload.vid, now, payload.isAdmin ? 'yes' : 'no']);
  return { status: 'ok' };
}

function getAnalyticsStats() {
  const vsh = getVisitsSheet();
  const ash = getActiveSheet();
  const now = new Date();
  const jerusalemTZ = 'Asia/Jerusalem';
  const todayStr = Utilities.formatDate(now, jerusalemTZ, 'yyyy-MM-dd');

  // ── Active users (heartbeat within last 2 minutes) ──
  const activeRows = ash.getDataRange().getValues();
  const twoMinAgo = new Date(now.getTime() - 2 * 60 * 1000);
  let activeCount = 0;
  let activeAdmins = 0;
  for (let i = 1; i < activeRows.length; i++) {
    const lastSeen = new Date(activeRows[i][1]);
    if (lastSeen >= twoMinAgo) {
      activeCount++;
      if (activeRows[i][2] === 'yes') activeAdmins++;
    }
  }

  // ── Visit data: aggregate last 30 days ──
  const visitRows = vsh.getDataRange().getValues();
  const dailyCounts = {};   // date → { total, unique: Set }
  const allUniqueVids = new Set();
  let todayTotal = 0;
  const todayUniqueSet = new Set();

  for (let i = 1; i < visitRows.length; i++) {
    const date = String(visitRows[i][0]).substring(0, 10);
    const vid = visitRows[i][1];
    allUniqueVids.add(vid);
    if (!dailyCounts[date]) dailyCounts[date] = { total: 0, unique: new Set() };
    dailyCounts[date].total++;
    dailyCounts[date].unique.add(vid);
    if (date === todayStr) {
      todayTotal++;
      todayUniqueSet.add(vid);
    }
  }

  // Build last 30 days array
  const days = [];
  for (let d = 29; d >= 0; d--) {
    const dt = new Date(now.getTime() - d * 86400000);
    const ds = Utilities.formatDate(dt, jerusalemTZ, 'yyyy-MM-dd');
    const dc = dailyCounts[ds] || { total: 0, unique: new Set() };
    days.push({ date: ds, total: dc.total, unique: dc.unique.size });
  }

  return {
    status: 'ok',
    activeNow: activeCount,
    activeAdmins: activeAdmins,
    todayTotal: todayTotal,
    todayUnique: todayUniqueSet.size,
    totalUniqueAllTime: allUniqueVids.size,
    totalVisitsAllTime: visitRows.length - 1,
    days: days
  };
}

// Clean up old active entries (run daily via trigger if desired)
function cleanupActiveSheet() {
  const sh = getActiveSheet();
  const rows = sh.getDataRange().getValues();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const toDelete = [];
  for (let i = 1; i < rows.length; i++) {
    if (new Date(rows[i][1]) < oneDayAgo) toDelete.push(i + 1);
  }
  // Delete from bottom up to preserve indices
  for (let j = toDelete.length - 1; j >= 0; j--) {
    sh.deleteRow(toDelete[j]);
  }
}

// ── בדיקה ידנית מה-IDE (אופציונלי) ─────────────────────
function testSave() {
  const fake = {
    id: 'test_001',
    firstName: 'משה', lastName: 'כהן',
    fatherName: 'אברהם', phone: '050-1234567',
    volunteering: ['קניות לקידוש'],
    children: [], yahrzeits: [],
    timestamp: new Date().toISOString()
  };
  Logger.log(saveMember(fake));
  Logger.log(deleteMember('test_001'));
}
