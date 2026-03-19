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

// ── Helper ───────────────────────────────────────────────
function jsonResp(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
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
