// ════════════════════════════════════════════════════════
//  מבשר ציון — Google Apps Script v2
//  מקור אמת ראשי — כל הנתונים נשמרים כאן
//  העתק את כל הקוד הזה ל-script.google.com
// ════════════════════════════════════════════════════════

const SHEET_NAME = 'מתפללים';
const DUTY_SHEET_NAME = 'תורנויות';
const SETTINGS_SHEET_NAME = 'הגדרות';
const VISITS_SHEET = 'ביקורים';
const ACTIVE_SHEET = 'פעילים';

// ── Sheet helpers ───────────────────────────────────────
var MEMBER_HEADERS = ['id','ת.ז.','שם פרטי','שם משפחה','שם האב','שם האם','שם לתורה',
  'טלפון','דוא"ל','תאריך לידה','פרשת בר מצווה','קריאה בתורה','הפטרה',
  'כתובת','שם בן/בת זוג','טלפון בן/בת זוג','ת.לידה בן/בת זוג',
  'התנדבות','תורן','דמי חבר','סכום','אמצעי תשלום',
  'ילדים (JSON)','יארצייטים (JSON)','תאריך רישום','סטטוס','תאריך מחיקה','JSON מלא'];
var JSON_COL = MEMBER_HEADERS.length; // last column = JSON מלא

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(MEMBER_HEADERS);
    sh.setFrozenRows(1);
    sh.getRange('1:1').setFontWeight('bold').setBackground('#1a2744').setFontColor('#c8a84b');
  }
  return sh;
}

function getDutySheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(DUTY_SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(DUTY_SHEET_NAME);
    sh.appendRow(['key', 'value', 'updatedAt']);
    sh.setFrozenRows(1);
    sh.getRange('1:1').setFontWeight('bold').setBackground('#1e7d4b').setFontColor('#fff');
  }
  return sh;
}

function getSettingsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SETTINGS_SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SETTINGS_SHEET_NAME);
    sh.appendRow(['key', 'value', 'updatedAt']);
    sh.setFrozenRows(1);
    sh.getRange('1:1').setFontWeight('bold').setBackground('#6366f1').setFontColor('#fff');
  }
  return sh;
}

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

function jsonResp(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ════════════════════════════════════════════════════════
//  GET endpoints
// ════════════════════════════════════════════════════════
function doGet(e) {
  const action = e?.parameter?.action || '';

  // Full data load — members + duty + settings in one call
  if (action === 'loadAll') {
    return jsonResp({
      status: 'ok',
      members: _getAllMembers(),
      duty: _getDutyObj(),
      settings: _getSettingsObj()
    });
  }

  if (action === 'getAll') {
    return ContentService
      .createTextOutput(JSON.stringify(_getAllMembers()))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'getDuty') {
    return jsonResp({ status: 'ok', duty: _getDutyObj() });
  }

  if (action === 'getSettings') {
    return jsonResp({ status: 'ok', settings: _getSettingsObj() });
  }

  if (action === 'getStats') {
    return jsonResp(getAnalyticsStats());
  }

  return jsonResp({ status: 'ok', msg: 'Mevaser Zion API v2' });
}

// ════════════════════════════════════════════════════════
//  POST endpoints
// ════════════════════════════════════════════════════════
function doPost(e) {
  let payload;
  try {
    payload = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResp({ status: 'error', msg: 'Invalid JSON' });
  }

  const { action, member, id } = payload;

  // Member CRUD
  if (action === 'save' || action === 'add') {
    return jsonResp(saveMember(member));
  }
  if (action === 'update') {
    return jsonResp(updateMember(member));
  }
  if (action === 'delete') {
    return jsonResp(deleteMember(id));
  }

  // Bulk sync — replace all members at once
  if (action === 'sync') {
    return jsonResp(syncAllMembers(payload.members));
  }

  // Duty roster
  if (action === 'saveDuty') {
    return jsonResp(saveDutyData(payload.duty));
  }

  // Settings (aliyot, kiddush, announcements, zmanim, etc.)
  if (action === 'saveSettings') {
    return jsonResp(saveSettings(payload.settings));
  }

  // Analytics
  if (action === 'trackVisit') {
    return jsonResp(trackVisit(payload));
  }
  if (action === 'heartbeat') {
    return jsonResp(recordHeartbeat(payload));
  }

  return jsonResp({ status: 'error', msg: 'Unknown action: ' + action });
}

// ════════════════════════════════════════════════════════
//  Members
// ════════════════════════════════════════════════════════
function _memberToRow(m) {
  var sp = m.spouse || {};
  return [
    m.id,
    m.idNumber || '',
    m.firstName || '',
    m.lastName || '',
    m.fatherName || '',
    m.motherName || '',
    m.torahName || '',
    m.phone || '',
    m.email || '',
    m.birthDate || '',
    m.parasha || '',
    m.readP || '',
    m.readH || '',
    m.address || '',
    sp.name || '',
    sp.phone || '',
    sp.birthDate || '',
    (m.volunteering || []).join(', '),
    m.dutyRoster ? 'כן' : 'לא',
    m.membershipPaid ? 'כן' : 'לא',
    m.paymentAmount || '',
    m.paymentMethod || '',
    JSON.stringify(m.children || []),
    JSON.stringify(m.yahrzeits || []),
    m.timestamp || new Date().toISOString(),
    m._deleted ? 'לא פעיל' : 'פעיל',
    m._deletedAt || '',
    JSON.stringify(m)
  ];
}

function _getAllMembers() {
  const sh = getSheet();
  const data = sh.getDataRange().getValues();
  const members = [];
  const jCol = JSON_COL - 1; // 0-based index of JSON מלא column
  const statusCol = JSON_COL - 3; // סטטוס column (2 before JSON)
  for (let i = 1; i < data.length; i++) {
    // Skip inactive (deleted) members
    if (data[i][statusCol] === 'לא פעיל') continue;
    const jsonCol = data[i][jCol];
    if (!jsonCol) continue;
    try { members.push(JSON.parse(jsonCol)); } catch (err) {}
  }
  return members;
}

function saveMember(m) {
  if (!m || !m.id) return { status: 'error', msg: 'Missing id' };
  const sh = getSheet();
  const ids = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), 1).getValues().flat();
  if (ids.includes(m.id)) return updateMember(m);
  sh.appendRow(_memberToRow(m));
  return { status: 'ok', id: m.id };
}

function updateMember(m) {
  if (!m || !m.id) return { status: 'error', msg: 'Missing id' };
  const sh = getSheet();
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === m.id) {
      const r = i + 1;
      const row = _memberToRow(m);
      // Update all columns (skip id column 1)
      for (let c = 1; c < row.length; c++) {
        sh.getRange(r, c + 1).setValue(row[c]);
      }
      return { status: 'ok', id: m.id };
    }
  }
  return saveMember(m);
}

function deleteMember(id) {
  if (!id) return { status: 'error', msg: 'Missing id' };
  const sh = getSheet();
  const rows = sh.getDataRange().getValues();
  const now = Utilities.formatDate(new Date(), 'Asia/Jerusalem', 'yyyy-MM-dd HH:mm');
  const statusColIdx = MEMBER_HEADERS.indexOf('סטטוס') + 1; // 1-based
  const deletedAtColIdx = MEMBER_HEADERS.indexOf('תאריך מחיקה') + 1;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === id) {
      const r = i + 1;
      sh.getRange(r, statusColIdx).setValue('לא פעיל');
      sh.getRange(r, deletedAtColIdx).setValue(now);
      return { status: 'ok', deleted: id, markedInactive: true };
    }
  }
  return { status: 'error', msg: 'Member not found: ' + id };
}

function syncAllMembers(members) {
  if (!members || !Array.isArray(members)) return { status: 'error', msg: 'Missing members array' };
  const sh = getSheet();
  // Clear all data rows (keep header)
  if (sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow() - 1);
  // Re-write header in case columns changed
  sh.getRange(1, 1, 1, MEMBER_HEADERS.length).setValues([MEMBER_HEADERS]);
  // Write all members
  if (members.length > 0) {
    var rows = members.filter(function(m){return m.id}).map(_memberToRow);
    if (rows.length > 0) sh.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  }
  return { status: 'ok', count: members.length };
}

// ════════════════════════════════════════════════════════
//  Duty Roster
// ════════════════════════════════════════════════════════
function _getDutyObj() {
  const sh = getDutySheet();
  const rows = sh.getDataRange().getValues();
  const result = {};
  for (let i = 1; i < rows.length; i++) {
    try { result[rows[i][0]] = JSON.parse(rows[i][1]); } catch (e) {}
  }
  return result;
}

function saveDutyData(duty) {
  if (!duty) return { status: 'error', msg: 'Missing duty data' };
  const sh = getDutySheet();
  const now = new Date().toISOString();
  const keys = ['queue', 'history', 'swaps', 'customs', 'hidden'];
  const rows = sh.getDataRange().getValues();
  for (const key of keys) {
    if (duty[key] === undefined) continue;
    let found = false;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === key) {
        sh.getRange(i + 1, 2).setValue(JSON.stringify(duty[key]));
        sh.getRange(i + 1, 3).setValue(now);
        found = true; break;
      }
    }
    if (!found) sh.appendRow([key, JSON.stringify(duty[key]), now]);
  }
  return { status: 'ok' };
}

// ════════════════════════════════════════════════════════
//  Settings (key-value store)
// ════════════════════════════════════════════════════════
function _getSettingsObj() {
  const sh = getSettingsSheet();
  const rows = sh.getDataRange().getValues();
  const result = {};
  for (let i = 1; i < rows.length; i++) {
    try { result[rows[i][0]] = JSON.parse(rows[i][1]); } catch (e) {
      result[rows[i][0]] = rows[i][1]; // plain string fallback
    }
  }
  return result;
}

function saveSettings(settings) {
  if (!settings) return { status: 'error', msg: 'Missing settings' };
  const sh = getSettingsSheet();
  const now = new Date().toISOString();
  const rows = sh.getDataRange().getValues();
  for (const key in settings) {
    const val = typeof settings[key] === 'string' ? settings[key] : JSON.stringify(settings[key]);
    let found = false;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === key) {
        sh.getRange(i + 1, 2).setValue(val);
        sh.getRange(i + 1, 3).setValue(now);
        found = true; break;
      }
    }
    if (!found) sh.appendRow([key, val, now]);
  }
  return { status: 'ok' };
}

// ════════════════════════════════════════════════════════
//  Analytics
// ════════════════════════════════════════════════════════
function trackVisit(payload) {
  if (!payload || !payload.vid) return { status: 'error', msg: 'Missing vid' };
  const sh = getVisitsSheet();
  const now = new Date();
  const dateStr = Utilities.formatDate(now, 'Asia/Jerusalem', 'yyyy-MM-dd');
  sh.appendRow([dateStr, payload.vid, now.toISOString(), (payload.ua || '').substring(0, 200), payload.isAdmin ? 'yes' : 'no']);
  recordHeartbeat(payload);
  return { status: 'ok' };
}

function recordHeartbeat(payload) {
  if (!payload || !payload.vid) return { status: 'error', msg: 'Missing vid' };
  const sh = getActiveSheet();
  const rows = sh.getDataRange().getValues();
  const now = new Date().toISOString();
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
  const tz = 'Asia/Jerusalem';
  const todayStr = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  const twoMinAgo = new Date(now.getTime() - 2 * 60 * 1000);

  const activeRows = ash.getDataRange().getValues();
  let activeCount = 0, activeAdmins = 0;
  for (let i = 1; i < activeRows.length; i++) {
    if (new Date(activeRows[i][1]) >= twoMinAgo) {
      activeCount++;
      if (activeRows[i][2] === 'yes') activeAdmins++;
    }
  }

  const visitRows = vsh.getDataRange().getValues();
  const dailyCounts = {}, allVids = new Set();
  let todayTotal = 0;
  const todayUniq = new Set();
  for (let i = 1; i < visitRows.length; i++) {
    const date = String(visitRows[i][0]).substring(0, 10);
    const vid = visitRows[i][1];
    allVids.add(vid);
    if (!dailyCounts[date]) dailyCounts[date] = { total: 0, unique: new Set() };
    dailyCounts[date].total++; dailyCounts[date].unique.add(vid);
    if (date === todayStr) { todayTotal++; todayUniq.add(vid); }
  }

  const days = [];
  for (let d = 29; d >= 0; d--) {
    const dt = new Date(now.getTime() - d * 86400000);
    const ds = Utilities.formatDate(dt, tz, 'yyyy-MM-dd');
    const dc = dailyCounts[ds] || { total: 0, unique: new Set() };
    days.push({ date: ds, total: dc.total, unique: dc.unique.size });
  }

  return {
    status: 'ok', activeNow: activeCount, activeAdmins: activeAdmins,
    todayTotal: todayTotal, todayUnique: todayUniq.size,
    totalUniqueAllTime: allVids.size, totalVisitsAllTime: visitRows.length - 1, days: days
  };
}

// ════════════════════════════════════════════════════════
//  Hebcal Server-Side Fetch (runs daily via trigger)
//  Fetches parasha, shabbat times, omer, holidays from Hebcal
//  and saves to Settings sheet — clients never call Hebcal directly
// ════════════════════════════════════════════════════════
function fetchWeeklyHebcal() {
  // Calculate upcoming Shabbat (Saturday)
  var now = new Date();
  var day = now.getDay(); // 0=Sun..6=Sat
  var daysUntilSat = (6 - day + 7) % 7;
  if (daysUntilSat === 0) daysUntilSat = 0; // Saturday itself
  var shabbat = new Date(now);
  shabbat.setDate(now.getDate() + daysUntilSat);
  var y = shabbat.getFullYear(), m = shabbat.getMonth() + 1, d = shabbat.getDate();
  var weekKey = y + '-' + (m < 10 ? '0' + m : m) + '-' + (d < 10 ? '0' + d : d);

  // Read zmanim settings for city selection
  var settings = _getSettingsObj();
  var zmanimCfg = settings.zmanim || {};
  var cities = {
    'tel-aviv': { lat: 32.088, lon: 34.781, b: 21 },
    'jerusalem': { lat: 31.778, lon: 35.235, b: 40 },
    'haifa': { lat: 32.794, lon: 34.990, b: 30 },
    'beer-sheva': { lat: 31.252, lon: 34.791, b: 18 }
  };
  var city = cities[zmanimCfg.city || 'tel-aviv'] || cities['tel-aviv'];
  var bVal = zmanimCfg.city === 'custom' ? (zmanimCfg.customB || 21) : city.b;

  // 1. Fetch Shabbat times + parasha from Hebcal
  var shUrl = 'https://www.hebcal.com/shabbat?cfg=json&geo=pos&latitude=' + city.lat +
    '&longitude=' + city.lon + '&tzid=Asia/Jerusalem&b=' + bVal + '&m=50&lg=he&i=on' +
    '&gy=' + y + '&gm=' + m + '&gd=' + d;
  var shResp = UrlFetchApp.fetch(shUrl, { muteHttpExceptions: true });
  var shData = JSON.parse(shResp.getContentText());

  var parName = '', candles = '', havdalah = '';
  if (shData && shData.items) {
    for (var i = 0; i < shData.items.length; i++) {
      var it = shData.items[i];
      if (it.category === 'parashat') parName = it.hebrew || it.title || '';
      if (it.category === 'holiday' && !parName) parName = it.hebrew || it.title || '';
      if (it.category === 'candles' && it.date) candles = it.date.substring(11, 16);
      if (it.category === 'havdalah' && it.date) havdalah = it.date.substring(11, 16);
    }
  }

  // 2. Fetch Hebrew date
  var hd2 = null;
  var hdUrl = 'https://www.hebcal.com/converter?cfg=json&gy=' + y + '&gm=' + m + '&gd=' + d + '&g2h=1';
  var hdResp = UrlFetchApp.fetch(hdUrl, { muteHttpExceptions: true });
  var hdData = JSON.parse(hdResp.getContentText());
  if (hdData && !hdData.error) {
    hd2 = { hd: hdData.hd, hm: hdData.hm, hy: hdData.hy };
  }

  // 3. Fetch omer count for today
  var todayStr = Utilities.formatDate(now, 'Asia/Jerusalem', 'yyyy-MM-dd');
  var omerDay = 0;
  var omerUrl = 'https://www.hebcal.com/hebcal?cfg=json&v=1&o=on&i=on&start=' + todayStr + '&end=' + todayStr;
  var omerResp = UrlFetchApp.fetch(omerUrl, { muteHttpExceptions: true });
  var omerData = JSON.parse(omerResp.getContentText());
  if (omerData && omerData.items) {
    for (var j = 0; j < omerData.items.length; j++) {
      if (omerData.items[j].category === 'omer') omerDay = omerData.items[j].omer || 0;
    }
  }

  // 4. Fetch upcoming holidays (2 weeks)
  var endDate = new Date(now);
  endDate.setDate(endDate.getDate() + 14);
  var endStr = Utilities.formatDate(endDate, 'Asia/Jerusalem', 'yyyy-MM-dd');
  var holidays = [];
  var holUrl = 'https://www.hebcal.com/hebcal?cfg=json&v=1&maj=on&min=on&i=on&lg=he&start=' + todayStr + '&end=' + endStr;
  var holResp = UrlFetchApp.fetch(holUrl, { muteHttpExceptions: true });
  var holData = JSON.parse(holResp.getContentText());
  if (holData && holData.items) {
    for (var k = 0; k < holData.items.length; k++) {
      var hi = holData.items[k];
      if (hi.category === 'holiday' && hi.date) {
        holidays.push({ name: hi.hebrew || hi.title, date: hi.date.substring(0, 10) + 'T00:00:00.000Z' });
      }
    }
  }

  // 5. Save to Settings sheet
  var hebcalWeek = {
    weekKey: weekKey,
    hd2: hd2,
    parName: parName,
    shTimes: candles ? { candles: candles, havdalah: havdalah } : null,
    omerDay: omerDay,
    holidays: holidays,
    ts: Date.now()
  };

  saveSettings({ hebcal_week: hebcalWeek });
  Logger.log('Hebcal fetched for ' + weekKey + ': ' + parName + ', candles=' + candles + ', havdalah=' + havdalah);
  return hebcalWeek;
}

// Run this once to set up the daily trigger:
function setupDailyHebcalTrigger() {
  // Remove existing triggers for this function
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'fetchWeeklyHebcal') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  // Create new trigger: every day at 5:00-6:00 AM Israel time
  ScriptApp.newTrigger('fetchWeeklyHebcal')
    .timeBased()
    .atHour(5)
    .everyDays(1)
    .inTimezone('Asia/Jerusalem')
    .create();
  Logger.log('Daily Hebcal trigger created (05:00 Israel time)');
}

function cleanupActiveSheet() {
  const sh = getActiveSheet();
  const rows = sh.getDataRange().getValues();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const del = [];
  for (let i = 1; i < rows.length; i++) if (new Date(rows[i][1]) < cutoff) del.push(i + 1);
  for (let j = del.length - 1; j >= 0; j--) sh.deleteRow(del[j]);
}
