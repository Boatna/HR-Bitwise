const SPREADSHEET_ID = '1_Ig-84KfaUxpAnnGgfkTJTXOJA2-d2oJKbu_cdTbtY0';
const DRIVE_FOLDER_ID = '1Ejzpmpc6A1A-sVpSaJpPPaSz4JMv1f5B';

function assertConfigured_(value, label) {
  if (!value || value.indexOf('ใส่_') === 0) {
    throw new Error('ยังไม่ได้ตั้งค่า ' + label + ' กรุณาแก้ไขค่านี้ในไฟล์ Code.gs ให้เป็นของคุณเองก่อนใช้งานจริง');
  }
}

function normalizeMaybeDate_(value, tz) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, tz || Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return value;
}

function normalizeMaybeDateTime_(value, tz) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, tz || Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
  }
  return value;
}

function formatPhoneNumber(phone) {
  if (phone === undefined || phone === null) return '';
  let str = String(phone).trim();
  if (str.startsWith("'")) {
    str = str.substring(1).trim();
  }
  if (!str) return '';
  const digits = str.replace(/\D/g, '');
  if (digits.length === 9 && !str.startsWith('0')) {
    if (digits.startsWith('8') || digits.startsWith('9') || digits.startsWith('6')) {
      str = '0' + str;
    }
  } else if (digits.length === 8 && !str.startsWith('0')) {
    str = '0' + str;
  }
  return str;
}

function normalizeAddressNo(v) {
  if (v === undefined || v === null) return '';
  if (v instanceof Date || Object.prototype.toString.call(v) === '[object Date]') {
    return v.getDate() + '/' + (v.getMonth() + 1);
  }
  let str = String(v).trim();
  if (str.startsWith("'")) {
    str = str.substring(1).trim();
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const parts = str.split('T')[0].split('-');
    return parseInt(parts[2], 10) + '/' + parseInt(parts[1], 10);
  }
  return str;
}

const APPLICANT_FIELDS = [
  { header: 'วันที่สมัคร (Timestamp)', key: 'submittedAt', parse: (v, tz) => normalizeMaybeDateTime_(v, tz) },
  { header: 'รหัสผู้สมัคร (Applicant ID)', key: 'id' },
  {
    header: 'สถานะการเข้าเรียน (Attendance)', key: 'attended',
    format: v => (v ? 'ได้เข้ามาเรียนแล้ว' : 'ยังไม่มา'),
    parse: v => v === 'ได้เข้ามาเรียนแล้ว' || v === true
  },
  { header: 'คำนำหน้า', key: 'title' },
  { header: 'ชื่อ', key: 'firstName' },
  { header: 'นามสกุล', key: 'lastName' },
  { header: 'เพศ', key: 'gender' },
  { header: 'ชื่อ-สกุล ภาษาอังกฤษ', key: 'fullNameEn' },
  {
    header: 'เลขประจำตัวประชาชน', key: 'idCard',
    format: v => (v ? "'" + String(v).trim() : ''),
    parse: v => (v ? String(v).trim() : '')
  },
  { header: 'สัญชาติ', key: 'nationality', default: 'ไทย' },
  { header: 'วัน/เดือน/ปีเกิด', key: 'birthDate', parse: (v, tz) => normalizeMaybeDate_(v, tz) },
  {
    header: 'เบอร์โทรศัพท์', key: 'phone',
    format: v => (v ? "'" + formatPhoneNumber(v) : ''),
    parse: v => formatPhoneNumber(v)
  },
  { header: 'อีเมล', key: 'email' },
  {
    header: 'ที่อยู่ เลขที่', key: 'addressNo',
    format: v => (v ? "'" + String(v).trim() : ''),
    parse: v => normalizeAddressNo(v)
  },
  {
    header: 'หมู่', key: 'moo',
    format: v => (v ? "'" + String(v).trim() : ''),
    parse: v => (v ? String(v).trim() : '')
  },
  { header: 'ถนน', key: 'street' },
  { header: 'ซอย', key: 'soi' },
  { header: 'แขวง/ตำบล', key: 'subdistrict' },
  { header: 'เขต/อำเภอ', key: 'district' },
  { header: 'จังหวัด', key: 'province' },
  {
    header: 'รหัสไปรษณีย์', key: 'zipcode',
    format: v => (v ? "'" + String(v).trim() : ''),
    parse: v => (v ? String(v).trim() : '')
  },
  { header: 'วุฒิการศึกษาสูงสุด', key: 'education' },
  { header: 'สาขาที่เรียน', key: 'educationMajor' },
  { header: 'สภาพร่างกาย', key: 'bodyCondition', default: 'ปกติ' },
  {
    header: 'ประเภทความพิการ', key: 'disabilities',
    format: v => (Array.isArray(v) ? v.join(', ') : (v || '')),
    parse: v => (v ? String(v).split(',').map(s => s.trim()).filter(Boolean) : [])
  },
  { header: 'หน่วยงานที่รับสมัคร', key: 'agency' },
  {
    header: 'วัตถุประสงค์', key: 'objectives',
    format: v => (Array.isArray(v) ? v.join(', ') : (v || '')),
    parse: v => (v ? String(v).split(',').map(s => s.trim()).filter(Boolean) : [])
  },
  {
    header: 'การทดสอบ', key: 'tests',
    format: v => (Array.isArray(v) ? v.join(', ') : (v || '')),
    parse: v => (v ? String(v).split(',').map(s => s.trim()).filter(Boolean) : [])
  },
  { header: 'หลักสูตร', key: 'course' },
  { header: 'จำนวนชั่วโมงฝึก', key: 'trainingHours' },
  { header: 'สาขา', key: 'branch' },
  { header: 'ระดับ', key: 'level' },
  {
    header: 'ประเภทผู้สมัคร', key: 'applicantTypes',
    format: v => (Array.isArray(v) ? v.join(', ') : (v || '')),
    parse: v => (v ? String(v).split(',').map(s => s.trim()).filter(Boolean) : [])
  },
  { header: 'วันที่เริ่มการฝึกอบรม', key: 'startDate', parse: (v, tz) => normalizeMaybeDate_(v, tz) },
  {
    header: 'สถานภาพแรงงาน', key: 'employmentStatus',
    format: v => (v === 'employed' ? 'ทำงาน' : 'ไม่ทำงาน/ว่างงาน'),
    parse: v => (v === 'ทำงาน' ? 'employed' : 'unemployed')
  },
  { header: 'สังกัดการทำงาน', key: 'workSector' },
  { header: 'ประเภทย่อยภาครัฐ', key: 'govtType' },
  { header: 'ประเภทย่อยธุรกิจส่วนตัว', key: 'freelanceType' },
  { header: 'รายได้เฉลี่ยต่อเดือน', key: 'monthlyIncome' },
  { header: 'อาชีพ', key: 'occupation' },
  { header: 'ตำแหน่ง', key: 'position' },
  { header: 'อายุงาน (ปี)', key: 'workExperienceYears' },
  { header: 'ชื่อสถานที่ทำงาน', key: 'workplaceName' },
  { header: 'จังหวัดที่ทำงาน', key: 'workplaceProvince' },
  {
    header: 'โทรศัพท์ที่ทำงาน', key: 'workplacePhone',
    format: v => (v ? "'" + formatPhoneNumber(v) : ''),
    parse: v => formatPhoneNumber(v)
  },
  { header: 'กลุ่มอุตสาหกรรม', key: 'industryGroup' },
  { header: 'เหตุผลผู้ไม่มีงานทำ', key: 'unemployedReason' },
  { header: 'แหล่งที่ทราบการฝึก', key: 'infoSource' },
  {
    header: 'ความยินยอม PDPA', key: 'pdpaConsent',
    format: v => (v ? 'ยินยอม' : 'ไม่ยินยอม'),
    parse: v => v === 'ยินยอม' || v === true
  },
  { header: 'ความประสงค์จัดหางาน', key: 'jobAssist' },
  // --- คอลัมน์: ลิงก์ไฟล์บน Google Drive (แทนการฝัง Base64 ทั้งไฟล์ในชีต) ---
  { header: 'ลิงก์รูปถ่าย (Google Drive)', key: 'photoUrl' },
  { header: 'ลิงก์บัตรประชาชน (Google Drive)', key: 'idCardFileUrl' },
  { header: 'ลิงก์วุฒิการศึกษา (Google Drive)', key: 'educationFileUrl' },
  { header: 'ลิงก์ทรานสคริปต์ (Google Drive)', key: 'transcriptFileUrl' },
  { header: 'ลิงก์ใบรับรองการทำงาน (Google Drive)', key: 'workCertFileUrl' },
  { header: 'ข้อมูลดิบ JSON (Raw Data)', key: '__raw' }
];

const HEADERS_CALENDAR = [
  'รหัสกิจกรรม (Event ID)',
  'วันที่ (YYYY-MM-DD)',
  'การดำเนินงาน / กิจกรรม / หลักสูตร',
  'ผู้รับผิดชอบ',
  'สถานที่จัดกิจกรรม',
  'รายละเอียดเพิ่มเติม'
];

const HEADERS_MANAGERS = [
  'ชื่อผู้ดูแลระบบ',
  'รหัส PIN (6 หลัก)',
  'สถานะ',
  'หมายเหตุ'
];

function getSS_() {
  assertConfigured_(SPREADSHEET_ID, 'SPREADSHEET_ID');
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function setupSheets() {
  const ss = getSS_();

  let sheetApp = ss.getSheetByName('Applicants');
  if (!sheetApp) sheetApp = ss.insertSheet('Applicants');
  const headers = APPLICANT_FIELDS.map(f => f.header);
  sheetApp.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheetApp.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold').setBackground('#0284c7').setFontColor('#ffffff');
  sheetApp.setFrozenRows(1);
  const PLAIN_TEXT_APPLICANT_KEYS = [
    'submittedAt', 'id', 'idCard', 'birthDate', 'phone', 'addressNo', 'moo', 'zipcode',
    'startDate', 'workplacePhone'
  ];
  PLAIN_TEXT_APPLICANT_KEYS.forEach(key => {
    const colIdx = APPLICANT_FIELDS.findIndex(f => f.key === key);
    if (colIdx >= 0) {
      sheetApp.getRange(2, colIdx + 1, 5000, 1).setNumberFormat('@');
    }
  });

  let sheetCal = ss.getSheetByName('CalendarEvents');
  if (!sheetCal) sheetCal = ss.insertSheet('CalendarEvents');
  sheetCal.getRange(1, 1, 1, HEADERS_CALENDAR.length).setValues([HEADERS_CALENDAR]);
  sheetCal.getRange(1, 1, 1, HEADERS_CALENDAR.length)
    .setFontWeight('bold').setBackground('#0f172a').setFontColor('#ffffff');
  sheetCal.setFrozenRows(1);
  sheetCal.getRange(2, 2, 5000, 1).setNumberFormat('@');

  let sheetMgr = ss.getSheetByName('Managers');
  const isNewManagerSheet = !sheetMgr;
  if (!sheetMgr) sheetMgr = ss.insertSheet('Managers');
  sheetMgr.getRange(1, 1, 1, HEADERS_MANAGERS.length).setValues([HEADERS_MANAGERS]);
  sheetMgr.getRange(1, 1, 1, HEADERS_MANAGERS.length)
    .setFontWeight('bold').setBackground('#7c3aed').setFontColor('#ffffff');
  sheetMgr.setFrozenRows(1);
  sheetMgr.getRange(2, 2, Math.max(sheetMgr.getMaxRows() - 1, 1), 1).setNumberFormat('@');
  if (isNewManagerSheet) {
    sheetMgr.getRange(2, 1, 1, HEADERS_MANAGERS.length).setValues([
      ['ผู้ดูแลระบบ (ค่าเริ่มต้น)', '123456', 'ใช้งาน', 'กรุณาเปลี่ยนรหัส PIN นี้ทันทีหลังติดตั้งระบบ']
    ]);
  }
}

// [เพิ่มใหม่] ฟังก์ชันสำหรับรันครั้งเดียวจากเมนู Apps Script (Run > repairExistingPlainTextColumns)
// ซ่อมแซมคอลัมน์ข้อความล้วน วันที่ รหัส PIN เบอร์โทร และเลขที่บ้าน ให้ถูกต้อง
function repairExistingPlainTextColumns() {
  const ss = getSS_();
  const tz = ss.getSpreadsheetTimeZone();

  const sheetApp = ss.getSheetByName('Applicants');
  if (sheetApp) {
    const lastRow = sheetApp.getLastRow();
    if (lastRow > 1) {
      const PLAIN_TEXT_KEYS = [
        'submittedAt', 'id', 'idCard', 'birthDate', 'phone', 'addressNo', 'moo', 'zipcode',
        'startDate', 'workplacePhone'
      ];
      PLAIN_TEXT_KEYS.forEach(key => {
        const colIdx = APPLICANT_FIELDS.findIndex(f => f.key === key);
        if (colIdx < 0) return;
        const range = sheetApp.getRange(2, colIdx + 1, lastRow - 1, 1);
        const values = range.getValues();
        const fixed = values.map(row => {
          const v = row[0];
          if (v instanceof Date) {
            if (key === 'submittedAt') return [normalizeMaybeDateTime_(v, tz)];
            if (key === 'addressNo') return [normalizeAddressNo(v)];
            return [normalizeMaybeDate_(v, tz)];
          }
          if (key === 'phone' || key === 'workplacePhone') {
            return [formatPhoneNumber(v)];
          }
          if (key === 'addressNo') {
            return [normalizeAddressNo(v)];
          }
          if (v !== undefined && v !== null) {
            return [String(v)];
          }
          return [''];
        });
        range.setNumberFormat('@');
        range.setValues(fixed);
      });
    }
  }

  const sheetCal = ss.getSheetByName('CalendarEvents');
  if (sheetCal) {
    const range = sheetCal.getRange(2, 2, Math.max(sheetCal.getLastRow() - 1, 1), 1);
    const values = range.getValues();
    const fixed = values.map(row => {
      const v = row[0];
      return [v instanceof Date ? normalizeMaybeDate_(v, tz) : v];
    });
    range.setNumberFormat('@');
    range.setValues(fixed);
  }

  const sheetMgr = ss.getSheetByName('Managers');
  if (sheetMgr) {
    const range = sheetMgr.getRange(2, 2, Math.max(sheetMgr.getLastRow() - 1, 1), 1);
    const values = range.getValues();
    const fixed = values.map(row => {
      const v = row[0];
      return [v instanceof Date ? Utilities.formatDate(v, tz, 'HHmmss') : String(v)];
    });
    range.setNumberFormat('@');
    range.setValues(fixed);
  }

  Logger.log('ซ่อมแซมฟอร์แมตคอลัมน์ข้อความล้วนเรียบร้อยแล้ว');
}

function buildApplicantRow(d) {
  return APPLICANT_FIELDS.map(f => {
    if (f.key === '__raw') {
      const copy = Object.assign({}, d);
      delete copy.photoDataUrl;
      return JSON.stringify(copy);
    }
    let v = d[f.key];
    if ((v === undefined || v === null || v === '') && f.default !== undefined) v = f.default;
    if (f.format) return f.format(v);
    return (v === undefined || v === null) ? '' : v;
  });
}

function parseApplicantRow(row, tz) {
  const obj = {};
  const rawIdx = APPLICANT_FIELDS.findIndex(f => f.key === '__raw');
  let rawJsonObj = null;
  if (rawIdx >= 0 && row[rawIdx]) {
    try {
      rawJsonObj = JSON.parse(row[rawIdx]);
      Object.assign(obj, rawJsonObj);
    } catch (e) { /* ignore */ }
  }
  
  APPLICANT_FIELDS.forEach((f, i) => {
    if (f.key === '__raw') return;
    const raw = row[i];
    let parsedVal = f.parse ? f.parse(raw, tz) : raw;
    if (typeof parsedVal === 'string' && parsedVal.charAt(0) === "'") {
      parsedVal = parsedVal.substring(1);
    }
    // If addressNo in sheet got turned into Date, prefer the original from __raw if available
    if (f.key === 'addressNo') {
      const isDate = raw instanceof Date || Object.prototype.toString.call(raw) === '[object Date]';
      if (rawJsonObj && rawJsonObj.addressNo && (isDate || /^\d{4}-\d{2}-\d{2}/.test(String(raw)))) {
        obj[f.key] = rawJsonObj.addressNo;
        return;
      }
      obj[f.key] = normalizeAddressNo(parsedVal);
      return;
    }
    // If phone in sheet lost its leading 0, restore it or prefer __raw
    if (f.key === 'phone' || f.key === 'workplacePhone') {
      if (rawJsonObj && rawJsonObj[f.key] && (!parsedVal || !String(parsedVal).startsWith('0'))) {
        obj[f.key] = formatPhoneNumber(rawJsonObj[f.key]);
        return;
      }
      obj[f.key] = formatPhoneNumber(parsedVal);
      return;
    }
    if (parsedVal !== undefined && parsedVal !== null && parsedVal !== '') {
      obj[f.key] = parsedVal;
    } else if (obj[f.key] === undefined) {
      obj[f.key] = '';
    }
  });
  return obj;
}

// [แก้ไข] เดิมฟังก์ชันนี้ไม่มีการล็อก (lock) เลย เมื่อฝั่งหน้าเว็บอัปโหลดไฟล์ 5 ไฟล์
// (รูปถ่าย/บัตรประชาชน/วุฒิการศึกษา/ทรานสคริปต์/ใบรับรองงาน) พร้อมกันแบบขนาน (Promise.all)
// โดยตั้งชื่อโฟลเดอร์ย่อยเดียวกัน (รหัสผู้สมัคร) ทุกไฟล์ — คำขอทั้ง 5 รายการนี้ไปถึง Apps Script
// เกือบพร้อมกัน แต่ละคำขอจะรันฟังก์ชันนี้แยกกัน (แต่ละ execution เป็นคนละ instance) แล้วเช็คว่า
// "มีโฟลเดอร์ชื่อนี้หรือยัง" พร้อมๆ กัน ซึ่งตอนเช็คยังไม่มีทั้งคู่ (race condition) จึงสร้างโฟลเดอร์
// ชื่อซ้ำกันขึ้นมาหลายโฟลเดอร์ ทำให้ไฟล์ของผู้สมัครคนเดียวกันกระจัดกระจายไปคนละโฟลเดอร์
//
// แก้ใหม่: ใช้ LockService.getScriptLock() ล็อกเฉพาะช่วง "เช็ค + สร้างโฟลเดอร์" ให้ทำงานทีละคำขอ
// เท่านั้น (ใช้เวลาสั้นมาก ไม่กระทบความเร็วโดยรวม) การอัปโหลดไฟล์จริงยังคงทำงานขนานกันได้ตามปกติ
function getOrCreateFolder(name, parent) {
  const lock = LockService.getScriptLock();
  let gotLock = false;
  try {
    gotLock = lock.tryLock(30000);
  } catch (e) {
    gotLock = false;
  }
  try {
    // ตรวจซ้ำอีกครั้งหลังได้ lock แล้ว เผื่อ request อื่นสร้างโฟลเดอร์นี้ไปแล้วระหว่างที่เรารอ
    const folders = parent.getFoldersByName(name);
    if (folders.hasNext()) return folders.next();
    return parent.createFolder(name);
  } finally {
    if (gotLock) {
      try { lock.releaseLock(); } catch (e) { /* ignore */ }
    }
  }
}

function getUploadFolder(subfolder) {
  assertConfigured_(DRIVE_FOLDER_ID, 'DRIVE_FOLDER_ID');
  const root = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  if (subfolder) return getOrCreateFolder(String(subfolder), root);
  return root;
}

function base64ToBlob(base64Data, mimeType, fileName) {
  const commaIdx = String(base64Data).indexOf(',');
  const pureBase64 = commaIdx >= 0 ? base64Data.substring(commaIdx + 1) : base64Data;
  const bytes = Utilities.base64Decode(pureBase64);
  return Utilities.newBlob(bytes, mimeType || 'application/octet-stream', fileName || ('file_' + Date.now()));
}

function handleUploadFile(postData) {
  try {
    if (!postData.base64Data) {
      return createJsonResponse({ status: 'error', message: 'ไม่พบข้อมูลไฟล์ (base64Data)' });
    }
    const folder = getUploadFolder(postData.subfolder);
    const blob = base64ToBlob(postData.base64Data, postData.mimeType, postData.fileName);
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const directUrl = 'https://drive.google.com/uc?export=view&id=' + file.getId();
    return createJsonResponse({
      status: 'success',
      fileId: file.getId(),
      url: file.getUrl(),
      directUrl: directUrl
    });
  } catch (err) {
    return createJsonResponse({ status: 'error', message: 'อัปโหลดไฟล์ไม่สำเร็จ: ' + err.toString() });
  }
}

function handleSavePdfToDrive(postData) {
  try {
    if (!postData.base64Data) {
      return createJsonResponse({ status: 'error', message: 'ไม่พบข้อมูล PDF (base64Data)' });
    }
    const folder = getUploadFolder(postData.subfolder || 'ใบสมัคร (PDF)');
    const fileName = postData.fileName || ('ใบสมัคร_' + Date.now() + '.pdf');
    const blob = base64ToBlob(postData.base64Data, 'application/pdf', fileName);
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return createJsonResponse({
      status: 'success',
      fileId: file.getId(),
      url: file.getUrl()
    });
  } catch (err) {
    return createJsonResponse({ status: 'error', message: 'บันทึก PDF ลง Drive ไม่สำเร็จ: ' + err.toString() });
  }
}

function handleGetFileBase64(fileId) {
  try {
    if (!fileId) {
      return createJsonResponse({ status: 'error', message: 'ไม่พบ fileId ที่ต้องการดึงข้อมูล' });
    }
    const file = DriveApp.getFileById(fileId);
    const blob = file.getBlob();
    const base64 = Utilities.base64Encode(blob.getBytes());
    const mimeType = blob.getContentType() || 'application/octet-stream';
    return createJsonResponse({
      status: 'success',
      fileId: fileId,
      mimeType: mimeType,
      base64: base64,
      dataUri: 'data:' + mimeType + ';base64,' + base64
    });
  } catch (err) {
    return createJsonResponse({ status: 'error', message: 'ไม่สามารถอ่านไฟล์จาก Google Drive ได้: ' + err.toString() });
  }
}

function handleVerifyManagerPin(postData) {
  try {
    const pin = String(postData.pin || '').trim();
    if (!/^[0-9]{6}$/.test(pin)) {
      return createJsonResponse({ status: 'error', message: 'รูปแบบรหัส PIN ไม่ถูกต้อง' });
    }
    const ss = getSS_();
    const sheet = ss.getSheetByName('Managers');
    if (!sheet) {
      return createJsonResponse({ status: 'error', message: 'ยังไม่ได้ตั้งค่าชีต Managers กรุณารัน setupSheets() ก่อน' });
    }
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const name = data[i][0];
      const rowPin = String(data[i][1] || '').trim().padStart(6, '0');
      const status = String(data[i][2] || '').trim();
      if (!name) continue;
      if (rowPin === pin && status === 'ใช้งาน') {
        return createJsonResponse({ status: 'success', name: name });
      }
    }
    return createJsonResponse({ status: 'error', message: 'รหัส PIN ไม่ถูกต้องหรือไม่มีสิทธิ์เข้าใช้งาน' });
  } catch (err) {
    return createJsonResponse({ status: 'error', message: 'ตรวจสอบรหัส PIN ไม่สำเร็จ: ' + err.toString() });
  }
}

function doGet(e) {
  const action = e && e.parameter && e.parameter.action ? e.parameter.action : 'ping';
  const ss = getSS_();

  if (action === 'ping') {
    return createJsonResponse({ status: 'success', message: 'HR Bitwise Google Sheet API พร้อมใช้งาน', timestamp: new Date().toISOString() });
  }

  if (action === 'getApplicants') {
    setupSheets();
    const sheet = ss.getSheetByName('Applicants');
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return createJsonResponse({ status: 'success', data: [] });
    const idColIdx = APPLICANT_FIELDS.findIndex(f => f.key === 'id');
    const rows = data.slice(1).filter(r => r[idColIdx]); // ข้ามแถวว่าง
    const tz = ss.getSpreadsheetTimeZone();
    const applicantsData = rows.map(r => parseApplicantRow(r, tz));
    return createJsonResponse({ status: 'success', data: applicantsData });
  }

  if (action === 'getCalendarEvents') {
    setupSheets();
    const sheet = ss.getSheetByName('CalendarEvents');
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return createJsonResponse({ status: 'success', data: [] });
    const rows = data.slice(1).filter(r => r[0]);
    const tz = ss.getSpreadsheetTimeZone();
    const events = rows.map(r => ({
      id: r[0], date: normalizeMaybeDate_(r[1], tz), title: r[2], responsible: r[3], location: r[4], details: r[5]
    }));
    return createJsonResponse({ status: 'success', data: events });
  }

  if (action === 'getFileBase64') {
    const fileId = e && e.parameter ? e.parameter.fileId : '';
    return handleGetFileBase64(fileId);
  }

  return createJsonResponse({ status: 'unknown_action', message: 'ไม่รู้จัก action: ' + action });
}

const LOCK_REQUIRED_ACTIONS = ['addApplicant', 'updateAttendance', 'addEvent'];

function doPost(e) {
  const ss = getSS_();
  setupSheets();

  let action = '';
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({ status: 'error', message: 'ไม่พบข้อมูลที่ส่งมา (postData ว่าง)' });
    }
    const postData = JSON.parse(e.postData.contents);
    action = postData.action;

    let lock = null;
    if (LOCK_REQUIRED_ACTIONS.indexOf(action) !== -1) {
      lock = LockService.getScriptLock();
      const gotLock = lock.tryLock(15000); // รอสูงสุด 15 วินาที
      if (!gotLock) {
        return createJsonResponse({
          status: 'error',
          message: 'ระบบกำลังประมวลผลคำขออื่นอยู่ กรุณาลองใหม่อีกครั้งในอีกสักครู่ (บันทึกไม่สำเร็จเนื่องจากมีผู้ใช้งานพร้อมกัน)'
        });
      }
    }

    try {
      if (action === 'addApplicant') {
        const d = postData.data || {};
        const sheet = ss.getSheetByName('Applicants');
        sheet.appendRow(buildApplicantRow(d));
        return createJsonResponse({ status: 'success', message: 'บันทึกผู้สมัครสำเร็จ' });
      }

      if (action === 'updateAttendance') {
        const applicantId = postData.applicantId;
        const attended = postData.attended;
        const sheet = ss.getSheetByName('Applicants');
        const idColIdx = APPLICANT_FIELDS.findIndex(f => f.key === 'id');
        const attColIdx = APPLICANT_FIELDS.findIndex(f => f.key === 'attended');
        const data = sheet.getDataRange().getValues();
        for (let i = 1; i < data.length; i++) {
          if (data[i][idColIdx] === applicantId) {
            sheet.getRange(i + 1, attColIdx + 1).setValue(attended ? 'ได้เข้ามาเรียนแล้ว' : 'ยังไม่มา');
            return createJsonResponse({ status: 'success', message: 'อัปเดตสถานะสำเร็จ' });
          }
        }
        return createJsonResponse({ status: 'not_found', message: 'ไม่พบรหัสผู้สมัคร: ' + applicantId });
      }

      if (action === 'addEvent') {
        const evt = postData.event || {};
        const sheet = ss.getSheetByName('CalendarEvents');
        sheet.appendRow([
          evt.id || 'evt-' + Date.now(),
          evt.date || '',
          evt.title || '',
          evt.responsible || '',
          evt.location || '',
          evt.details || ''
        ]);
        return createJsonResponse({ status: 'success', message: 'บันทึกกิจกรรมสำเร็จ' });
      }

      if (action === 'uploadFile') {
        return handleUploadFile(postData);
      }

      if (action === 'savePdfToDrive') {
        return handleSavePdfToDrive(postData);
      }

      if (action === 'verifyManagerPin') {
        return handleVerifyManagerPin(postData);
      }

      return createJsonResponse({ status: 'invalid_action', message: 'ไม่รู้จัก action: ' + action });
    } finally {
      if (lock) lock.releaseLock();
    }
  } catch (error) {
    return createJsonResponse({ status: 'error', message: error.toString() });
  }
}

function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}