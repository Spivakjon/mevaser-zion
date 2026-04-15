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

  // Telegram webhook: body has update_id and either message/callback
  if (payload && typeof payload.update_id !== 'undefined') {
    return jsonResp(_handleTelegramUpdate(payload));
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

// ════════════════════════════════════════════════════════
//  TELEGRAM BOT — @MevaserZionBot
//  Token is read from Script Properties (NOT stored in code).
//  Setup: Run `telegramSetup()` once from the editor, passing your
//  bot token — it stores the token and registers the webhook.
// ════════════════════════════════════════════════════════
const TELEGRAM_API = 'https://api.telegram.org/bot';
const TG_REMIND_SHEET = 'תזכורות שנשלחו';
const TG_ADMINS_KEY = 'TELEGRAM_ADMINS'; // CSV of chat IDs allowed to run admin commands
const TG_TOKEN_KEY = 'TELEGRAM_BOT_TOKEN';

function _tgToken() {
  return PropertiesService.getScriptProperties().getProperty(TG_TOKEN_KEY) || '';
}
function _tgAdmins() {
  const raw = PropertiesService.getScriptProperties().getProperty(TG_ADMINS_KEY) || '';
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}
function _tgIsAdmin(chatId) {
  return _tgAdmins().indexOf(String(chatId)) >= 0;
}

function tgSend(chatId, text, opts) {
  opts = opts || {};
  const token = _tgToken();
  if (!token) { Logger.log('TELEGRAM_BOT_TOKEN not set'); return null; }
  const body = { chat_id: chatId, text: text, parse_mode: opts.parse_mode || 'HTML', disable_web_page_preview: true };
  if (opts.reply_markup) body.reply_markup = opts.reply_markup;
  try {
    const resp = UrlFetchApp.fetch(TELEGRAM_API + token + '/sendMessage', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(body),
      muteHttpExceptions: true
    });
    return JSON.parse(resp.getContentText());
  } catch (e) { Logger.log('tgSend error: ' + e); return null; }
}

// ── Setup helpers (run from editor) ──────────────────────
function telegramSetToken(token) {
  if (!token) throw new Error('Pass the bot token as argument');
  PropertiesService.getScriptProperties().setProperty(TG_TOKEN_KEY, String(token).trim());
  return 'Token saved. Now run telegramSetWebhook() with your /exec URL.';
}
function telegramSetAdmins(csvChatIds) {
  PropertiesService.getScriptProperties().setProperty(TG_ADMINS_KEY, String(csvChatIds || '').trim());
  return 'Admins updated: ' + csvChatIds;
}
function telegramSetWebhook(execUrl) {
  const token = _tgToken();
  if (!token) throw new Error('Token not set. Run telegramSetToken() first.');
  if (!execUrl) throw new Error('Pass your /exec URL (from Deploy → Web app)');
  const url = TELEGRAM_API + token + '/setWebhook?url=' + encodeURIComponent(execUrl);
  const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  return resp.getContentText();
}
function telegramGetWebhookInfo() {
  const token = _tgToken();
  if (!token) throw new Error('Token not set');
  const resp = UrlFetchApp.fetch(TELEGRAM_API + token + '/getWebhookInfo');
  return resp.getContentText();
}

// ── Member lookup helpers ───────────────────────────────
function _findMemberByTelegramChatId(chatId) {
  const members = _getAllMembers();
  for (const m of members) {
    if (m.reminders && String(m.reminders.telegramChatId || '') === String(chatId)) return m;
  }
  return null;
}
function _linkMemberToChat(memberId, chatId) {
  const sh = getSheet();
  const rows = sh.getDataRange().getValues();
  const jCol = JSON_COL;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === memberId) {
      const r = i + 1;
      const json = rows[i][jCol - 1];
      let m;
      try { m = JSON.parse(json); } catch (e) { m = {}; }
      m.reminders = m.reminders || { enabled: true, channels: { web: false, telegram: true }, events: {} };
      m.reminders.channels = m.reminders.channels || {};
      m.reminders.channels.telegram = true;
      m.reminders.telegramChatId = String(chatId);
      sh.getRange(r, jCol).setValue(JSON.stringify(m));
      return m;
    }
  }
  return null;
}

// ── Webhook detection + handler (plugged into doPost) ───
function _handleTelegramUpdate(update) {
  try {
    const msg = update.message || update.edited_message || (update.callback_query && update.callback_query.message);
    if (!msg) return { status: 'ok', ignored: true };
    const chatId = String(msg.chat.id);
    const text = (update.message && update.message.text) || '';
    const isAdmin = _tgIsAdmin(chatId);

    // Deep-linked /start <memberId>
    if (/^\/start(\s|$)/.test(text)) {
      const arg = (text.split(/\s+/)[1] || '').trim();
      if (arg.indexOf('LINK_') === 0) {
        const memberId = arg.substring(5);
        const m = _linkMemberToChat(memberId, chatId);
        if (m) {
          tgSend(chatId, '✓ <b>החשבון קושר בהצלחה</b>\n\nשלום ' + (m.firstName || '') + '!\nמעתה תקבל/י תזכורות לטלגרם לפי ההעדפות שהגדרת.\n\nשלח /status כדי לראות את ההעדפות שלך.');
          return { status: 'ok' };
        }
        tgSend(chatId, '⚠ לא נמצא מתפלל עם המזהה הזה. אנא פתח/י את הקישור מהאזור האישי באפליקציה.');
        return { status: 'ok' };
      }
      tgSend(chatId, '🕍 <b>ברוכים הבאים לבוט קהילת מבשר ציון</b>\n\n<b>לקישור החשבון</b>, יש שתי דרכים:\n1. מהאפליקציה: "האזור שלי" ← תזכורות ← "קשר לטלגרם" (עדיף)\n2. להעתיק את קוד הקישור מהאפליקציה ולשלוח כאן: <code>/link &lt;הקוד&gt;</code>\n\n<b>פקודות:</b>\n/status — הצג העדפות\n/unlink — ניתוק\n/help — עזרה' + (isAdmin ? '\n\n<b>פקודות מנהל:</b>\n/pending /duty /stats /announce' : ''));
      return { status: 'ok' };
    }

    // Manual linking fallback: /link MEMBER_ID
    if (/^\/link\s+/.test(text)) {
      const memberId = text.replace(/^\/link\s+/, '').trim();
      if (!memberId) { tgSend(chatId, 'שימוש: /link <קוד הקישור מהאפליקציה>'); return { status: 'ok' }; }
      const m = _linkMemberToChat(memberId, chatId);
      if (m) {
        tgSend(chatId, '✓ <b>החשבון קושר בהצלחה</b>\n\nשלום ' + (m.firstName || '') + '!\nמעתה תקבל/י תזכורות לטלגרם לפי ההעדפות שהגדרת.');
      } else {
        tgSend(chatId, '⚠ לא נמצא מתפלל עם הקוד הזה. ודא/י שהעתקת את הקוד המלא מהאפליקציה.');
      }
      return { status: 'ok' };
    }

    if (text === '/help') {
      const help = '<b>פקודות:</b>\n/start — התחלה / קישור\n/status — ההעדפות שלי\n/unlink — ניתוק מהחשבון' + (isAdmin ? '\n\n<b>מנהל:</b>\n/pending — מתפללים שלא שילמו\n/duty — תורנים השבוע\n/stats — סטטיסטיקות\n/announce [טקסט] — שליחת הכרזה לכולם' : '');
      tgSend(chatId, help);
      return { status: 'ok' };
    }

    if (text === '/status') {
      const m = _findMemberByTelegramChatId(chatId);
      if (!m) { tgSend(chatId, '⚠ החשבון לא מקושר. שלח /start מהאפליקציה.'); return { status: 'ok' }; }
      const r = m.reminders || {};
      let out = '👤 <b>' + (m.firstName || '') + ' ' + (m.lastName || '') + '</b>\n';
      out += r.enabled ? '✓ תזכורות פעילות\n' : '✗ תזכורות מושבתות\n';
      const evs = r.events || {};
      const names = { candles: 'הדלקת נרות', minchaErev: 'מנחה ערב שבת', shacharit: 'שחרית שבת', havdalah: 'צאת שבת', yahrzeit: 'יארצייט', barMitzvah: 'בר/בת מצווה', duty: 'תורנות', birthday: 'יום הולדת' };
      const units = { minutes: 'דקות', hours: 'שעות', days: 'ימים', weeks: 'שבועות' };
      for (const k in evs) {
        if (!evs[k] || !evs[k].length) continue;
        const parts = evs[k].map(o => o.n + ' ' + (units[o.unit] || o.unit)).join(', ');
        out += '• ' + (names[k] || k) + ': ' + parts + ' לפני\n';
      }
      tgSend(chatId, out);
      return { status: 'ok' };
    }

    if (text === '/unlink') {
      const m = _findMemberByTelegramChatId(chatId);
      if (!m) { tgSend(chatId, 'לא מקושר.'); return { status: 'ok' }; }
      _linkMemberToChat(m.id, ''); // clears
      tgSend(chatId, '✓ החשבון נותק.');
      return { status: 'ok' };
    }

    // Admin commands
    if (!isAdmin) {
      tgSend(chatId, 'פקודה לא מוכרת. שלח /help.');
      return { status: 'ok' };
    }

    if (text === '/pending') {
      const ms = _getAllMembers().filter(m => !m.membershipPaid);
      let out = '<b>מתפללים שטרם שילמו (' + ms.length + ')</b>\n';
      ms.slice(0, 40).forEach((m, i) => { out += (i + 1) + '. ' + (m.firstName || '') + ' ' + (m.lastName || '') + (m.phone ? ' — ' + m.phone : '') + '\n'; });
      if (ms.length > 40) out += '\n(מוצגים 40 ראשונים)';
      tgSend(chatId, out);
      return { status: 'ok' };
    }

    if (text === '/duty') {
      const duty = _getDutyObj();
      const queue = duty.queue || [];
      const members = _getAllMembers();
      const names = queue.slice(0, 2).map(id => { const m = members.find(x => x.id === id); return m ? (m.firstName + ' ' + m.lastName) : id; });
      tgSend(chatId, '🧹 <b>תורנים הקרובים:</b>\n' + (names.length ? names.join(' · ') : 'לא הוגדרו'));
      return { status: 'ok' };
    }

    if (text === '/stats') {
      const members = _getAllMembers();
      const paid = members.filter(m => m.membershipPaid).length;
      const duty = members.filter(m => m.dutyRoster).length;
      const kids = members.reduce((s, m) => s + ((m.children || []).length), 0);
      const linked = members.filter(m => m.reminders && m.reminders.telegramChatId).length;
      tgSend(chatId, '📊 <b>סטטיסטיקות</b>\n• משפחות: ' + members.length + '\n• שילמו: ' + paid + '/' + members.length + '\n• ילדים: ' + kids + '\n• בתורנות: ' + duty + '\n• מקושרים לטלגרם: ' + linked);
      return { status: 'ok' };
    }

    if (/^\/announce\s+/.test(text)) {
      const msgText = text.replace(/^\/announce\s+/, '').trim();
      if (!msgText) { tgSend(chatId, 'שימוש: /announce <טקסט>'); return { status: 'ok' }; }
      const members = _getAllMembers();
      let count = 0;
      for (const m of members) {
        const cid = m.reminders && m.reminders.telegramChatId;
        if (cid && m.reminders.enabled) { tgSend(cid, '📢 <b>הכרזה:</b>\n' + msgText); count++; }
      }
      tgSend(chatId, '✓ נשלח ל־' + count + ' מקושרים.');
      return { status: 'ok' };
    }

    tgSend(chatId, 'פקודה לא מוכרת. שלח /help.');
    return { status: 'ok' };
  } catch (e) {
    Logger.log('Telegram update error: ' + e);
    return { status: 'error', msg: String(e) };
  }
}

// ════════════════════════════════════════════════════════
//  Reminder scheduler — runs on a time-based trigger
//  Checks upcoming events and sends due reminders.
//  Call setupReminderTrigger() once to register a 10-min trigger.
// ════════════════════════════════════════════════════════
function setupReminderTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  for (const t of triggers) if (t.getHandlerFunction() === 'sendDueReminders') ScriptApp.deleteTrigger(t);
  ScriptApp.newTrigger('sendDueReminders').timeBased().everyMinutes(10).create();
  return 'Reminder trigger set (every 10 min)';
}

function _getSentLogSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(TG_REMIND_SHEET);
  if (!sh) {
    sh = ss.insertSheet(TG_REMIND_SHEET);
    sh.appendRow(['memberId', 'eventKey', 'offsetKey', 'eventDate', 'sentAt']);
    sh.setFrozenRows(1);
  }
  return sh;
}
function _wasSent(memberId, eventKey, offsetKey, eventDate) {
  const sh = _getSentLogSheet();
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === memberId && rows[i][1] === eventKey && rows[i][2] === offsetKey && String(rows[i][3]) === String(eventDate)) return true;
  }
  return false;
}
function _markSent(memberId, eventKey, offsetKey, eventDate) {
  _getSentLogSheet().appendRow([memberId, eventKey, offsetKey, eventDate, new Date().toISOString()]);
}

function _offsetMs(off) {
  const u = off.unit; const n = +off.n || 0;
  if (u === 'minutes') return n * 60000;
  if (u === 'hours') return n * 3600000;
  if (u === 'days') return n * 86400000;
  if (u === 'weeks') return n * 604800000;
  return 0;
}

function sendDueReminders() {
  const now = Date.now();
  const window = 10 * 60 * 1000; // 10-minute fire window
  const members = _getAllMembers();
  const weekCache = _getWeeklyHebcal();
  const candleTs = _parseDateTime(weekCache && weekCache.shTimes && weekCache.shTimes.candlesISO);
  const havdalahTs = _parseDateTime(weekCache && weekCache.shTimes && weekCache.shTimes.havdalahISO);

  for (const m of members) {
    const r = m.reminders;
    if (!r || !r.enabled) continue;
    if (!(r.channels && r.channels.telegram && r.telegramChatId)) continue;

    const evs = r.events || {};
    // Fixed Shabbat events
    if (evs.candles && candleTs) {
      for (const off of evs.candles) { const fire = candleTs - _offsetMs(off); if (_inWindow(fire, now, window) && !_wasSent(m.id, 'candles', off.n + off.unit, candleTs)) { tgSend(r.telegramChatId, '🕯 <b>הדלקת נרות</b> בעוד ' + _humanOffset(off) + ' (' + _fmtTime(candleTs) + ')'); _markSent(m.id, 'candles', off.n + off.unit, candleTs); } }
    }
    if (evs.havdalah && havdalahTs) {
      for (const off of evs.havdalah) { const fire = havdalahTs - _offsetMs(off); if (_inWindow(fire, now, window) && !_wasSent(m.id, 'havdalah', off.n + off.unit, havdalahTs)) { tgSend(r.telegramChatId, '✨ <b>צאת שבת</b> בעוד ' + _humanOffset(off) + ' (' + _fmtTime(havdalahTs) + ')'); _markSent(m.id, 'havdalah', off.n + off.unit, havdalahTs); } }
    }
    // TODO: yahrzeit, barMitzvah, duty, birthday — require Hebrew date calculation per member.
    // Those are scheduled once we confirm the Shabbat flow works.
  }
  return 'done';
}

function _parseDateTime(s) { if (!s) return null; const d = new Date(s); return isNaN(d) ? null : d.getTime(); }
function _inWindow(fire, now, win) { return fire >= now - win / 2 && fire <= now + win / 2; }
function _humanOffset(off) {
  const names = { minutes: 'דקות', hours: 'שעות', days: 'ימים', weeks: 'שבועות' };
  return off.n + ' ' + (names[off.unit] || off.unit);
}
function _fmtTime(ts) { return Utilities.formatDate(new Date(ts), 'Asia/Jerusalem', 'HH:mm'); }

function _getWeeklyHebcal() {
  const sh = getSettingsSheet();
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) if (rows[i][0] === 'hebcal_week') { try { return JSON.parse(rows[i][1]); } catch (e) {} }
  return null;
}
