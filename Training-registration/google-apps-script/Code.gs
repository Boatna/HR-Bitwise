const SPREADSHEET_ID = '1_Ig-84KfaUxpAnnGgfkTJTXOJA2-d2oJKbu_cdTbtY0';
const DRIVE_FOLDER_ID = '1Ejzpmpc6A1A-sVpSaJpPPaSz4JMv1f5B';

function assertConfigured_(value, label) {
  if (!value || value.indexOf('ใส่_') === 0) {
    throw new Error('ยังไม่ได้ตั้งค่า ' + label + ' กรุณาแก้ไขค่านี้ในไฟล์ Code.gs ให้เป็นของคุณเองก่อนใช้งานจริง');
  }
}

const APPLICANT_FIELDS = [
  { header: 'วันที่สมัคร (Timestamp)', key: 'submittedAt' },
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
  { header: 'เลขประจำตัวประชาชน', key: 'idCard' },
  { header: 'สัญชาติ', key: 'nationality', default: 'ไทย' },
  { header: 'วัน/เดือน/ปีเกิด', key: 'birthDate' },
  { header: 'เบอร์โทรศัพท์', key: 'phone' },
  { header: 'อีเมล', key: 'email' },
  { header: 'ที่อยู่ เลขที่', key: 'addressNo' },
  { header: 'หมู่', key: 'moo' },
  { header: 'ถนน', key: 'street' },
  { header: 'ซอย', key: 'soi' },
  { header: 'แขวง/ตำบล', key: 'subdistrict' },
  { header: 'เขต/อำเภอ', key: 'district' },
  { header: 'จังหวัด', key: 'province' },
  { header: 'รหัสไปรษณีย์', key: 'zipcode' },
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
  { header: 'วันที่เริ่มการฝึกอบรม', key: 'startDate' },
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
  { header: 'โทรศัพท์ที่ทำงาน', key: 'workplacePhone' },
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

  let sheetCal = ss.getSheetByName('CalendarEvents');
  if (!sheetCal) sheetCal = ss.insertSheet('CalendarEvents');
  sheetCal.getRange(1, 1, 1, HEADERS_CALENDAR.length).setValues([HEADERS_CALENDAR]);
  sheetCal.getRange(1, 1, 1, HEADERS_CALENDAR.length)
    .setFontWeight('bold').setBackground('#0f172a').setFontColor('#ffffff');
  sheetCal.setFrozenRows(1);
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

function parseApplicantRow(row) {
  const obj = {};
  // ขั้นแรก: กระจายค่าจาก JSON ดิบ (ถ้ามี) เป็นค่าเริ่มต้น
  const rawIdx = APPLICANT_FIELDS.findIndex(f => f.key === '__raw');
  if (rawIdx >= 0) {
    try {
      Object.assign(obj, JSON.parse(row[rawIdx] || '{}'));
    } catch (e) { /* ignore */ }
  }
  // ขั้นสอง: ให้ค่าจากคอลัมน์ที่ระบุชัดเจนทับค่าจาก JSON ดิบเสมอ (แหล่งข้อมูลที่เชื่อถือได้กว่า)
  APPLICANT_FIELDS.forEach((f, i) => {
    if (f.key === '__raw') return;
    const raw = row[i];
    obj[f.key] = f.parse ? f.parse(raw) : raw;
  });
  return obj;
}

function getOrCreateFolder(name, parent) {
  const folders = parent.getFoldersByName(name);
  if (folders.hasNext()) return folders.next();
  return parent.createFolder(name);
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

// [FIX บั๊ก #2] ดึงไฟล์จาก Google Drive มาแปลงเป็น Base64 ฝั่งเซิร์ฟเวอร์
// เหตุผล: ตอนสร้าง PDF ด้วย html2canvas ฝั่ง client ถ้ารูปถ่ายเป็นลิงก์ Google Drive
// (cross-origin โดยไม่มี CORS header ที่ถูกต้อง) canvas จะถูกมองว่า "tainted"
// ทำให้ดาวน์โหลด/บันทึก PDF ออกมาแล้วไม่มีรูปถ่ายเลย การให้ Apps Script อ่านไฟล์เอง
// แล้วส่งเป็น Base64 กลับไปฝัง <img src="data:..."> จะไม่ติดปัญหา CORS อีกต่อไป
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
    const applicantsData = rows.map(parseApplicantRow);
    return createJsonResponse({ status: 'success', data: applicantsData });
  }

  if (action === 'getCalendarEvents') {
    setupSheets();
    const sheet = ss.getSheetByName('CalendarEvents');
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return createJsonResponse({ status: 'success', data: [] });
    const rows = data.slice(1).filter(r => r[0]);
    const events = rows.map(r => ({
      id: r[0], date: r[1], title: r[2], responsible: r[3], location: r[4], details: r[5]
    }));
    return createJsonResponse({ status: 'success', data: events });
  }

  // [FIX บั๊ก #2] endpoint ใหม่: ดึงไฟล์รูปจาก Drive เป็น Base64 สำหรับฝังใน PDF
  if (action === 'getFileBase64') {
    const fileId = e && e.parameter ? e.parameter.fileId : '';
    return handleGetFileBase64(fileId);
  }

  return createJsonResponse({ status: 'unknown_action', message: 'ไม่รู้จัก action: ' + action });
}

// [FIX บั๊ก #3] Action ที่ "เขียน" ข้อมูลลงชีต (เพิ่มผู้สมัคร / อัปเดตสถานะ / เพิ่มกิจกรรม)
// ต้องล็อกด้วย LockService ก่อนอ่าน-เขียน เพื่อป้องกันข้อมูลชนกันเวลามีคนยิง request
// เข้ามาพร้อมกันหลายคน (เช่น สมัครพร้อมกันตอนเปิดรับสมัครใหม่ๆ)
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
      // 1. เพิ่มผู้สมัครใหม่
      if (action === 'addApplicant') {
        const d = postData.data || {};
        const sheet = ss.getSheetByName('Applicants');
        sheet.appendRow(buildApplicantRow(d));
        return createJsonResponse({ status: 'success', message: 'บันทึกผู้สมัครสำเร็จ' });
      }

      // 2. อัปเดตสถานะการเข้าเรียน
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

      // 3. เพิ่มกิจกรรมปฏิทิน
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

      // 4. อัปโหลดไฟล์ (รูปถ่าย/เอกสารแนบ) ขึ้น Google Drive
      if (action === 'uploadFile') {
        return handleUploadFile(postData);
      }

      // 5. บันทึกไฟล์ PDF ใบสมัครลง Google Drive
      if (action === 'savePdfToDrive') {
        return handleSavePdfToDrive(postData);
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