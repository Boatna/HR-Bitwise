/**
 * ==============================================================================
 * Executive Safety & Legal Compliance System - Google Apps Script Backend
 * Bitwise Group
 * ==============================================================================
 */

const SPREADSHEET_ID = '1nTcudsfjooM0mCtUpGWtoofNGadaW3yLjhZWIpj_5wc';
const DRIVE_ROOT_FOLDER_NAME = 'Bitwise Safety - ทะเบียนกฎหมาย (ไฟล์แนบ)';

const API_ALLOWED_SHEETS = [
  'KPI_Monthly', 'Inspection', 'CAR', 'Legal_Compliance', 'Employee',
  'Registration_Laws_and_Safety', 'AccidentReport', 'TopRisks', 'Highlights_Actions'
];

// ==============================================================================
// 1. Google Drive Helper Functions
// ==============================================================================

function getOrCreateRootFolder_() {
  const it = DriveApp.getFoldersByName(DRIVE_ROOT_FOLDER_NAME);
  if (it.hasNext()) return it.next();
  return DriveApp.createFolder(DRIVE_ROOT_FOLDER_NAME);
}

function getOrCreateSubFolder_(parentFolder, subName) {
  const safeName = (subName || 'ไม่ระบุลำดับ').toString().trim() || 'ไม่ระบุลำดับ';
  const it = parentFolder.getFoldersByName(safeName);
  if (it.hasNext()) return it.next();
  return parentFolder.createFolder(safeName);
}

function handleUploadFile(body) {
  try {
    const fileName   = body.fileName;
    let base64Data   = body.base64Data || '';
    const mimeType   = body.mimeType || 'application/pdf';
    const seq        = body.seq || '';
    const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
    const cleanFileName = String(fileName || 'attachment.pdf').replace(/[\\/:*?"<>|#%{}]/g, '_').slice(0, 180);

    if (!fileName || !base64Data) {
      return jsonResponse({ error: 'ต้องระบุ fileName และ base64Data สำหรับอัปโหลดไฟล์' });
    }
    if (mimeType !== 'application/pdf' && !/\.pdf$/i.test(fileName)) {
      return jsonResponse({ error: 'รองรับเฉพาะไฟล์ PDF เท่านั้น' });
    }

    // กรณีมี data:application/pdf;base64,... ให้ตัด prefix ออก
    if (base64Data.indexOf(',') !== -1) {
      base64Data = base64Data.split(',')[1];
    }

    console.log(`📤 กำลังอัปโหลดไฟล์: ${fileName}, seq: ${seq}`);

    const rootFolder   = getOrCreateRootFolder_();
    const targetFolder = getOrCreateSubFolder_(rootFolder, seq);

    const decodedBytes = Utilities.base64Decode(base64Data);
    if (decodedBytes.length > MAX_UPLOAD_BYTES) {
      return jsonResponse({ error: 'ไฟล์มีขนาดใหญ่เกิน 10MB' });
    }
    const blob = Utilities.newBlob(decodedBytes, mimeType, cleanFileName || 'attachment.pdf');
    const file = targetFolder.createFile(blob);
    
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const fileUrl = file.getUrl();

    console.log(`✅ ไฟล์ถูกสร้างเรียบร้อย: ${file.getName()}, ID: ${file.getId()}`);

    return jsonResponse({
      success: true,
      fileUrl: fileUrl,
      fileId: file.getId(),
      fileName: file.getName(),
      folder: targetFolder.getName()
    });
  } catch (err) {
    console.error('❌ handleUploadFile Error:', err.message);
    return jsonResponse({ error: 'อัปโหลดไฟล์ไม่สำเร็จ: ' + err.message });
  }
}

// ==============================================================================
// 2. Utility & Normalization Functions
// ==============================================================================

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.TEXT);
}

function logError(context, error) {
  console.error(`[${context}] Error:`, error.message);
  if (error.stack) console.error('Stack:', error.stack);
}

function toISODateString(value) {
  if (!value && value !== 0) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
    // รองรับรูปแบบ DD/MM/YYYY หรือ DD-MM-YYYY (เช่น 25/03/2026 หรือ 25/03/2569)
    const dmy = trimmed.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})$/);
    if (dmy) {
      let y = Number(dmy[3]);
      if (y > 2400) y -= 543;
      const m = String(Number(dmy[2])).padStart(2, '0');
      const d = String(Number(dmy[1])).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }
  if (value instanceof Date && !isNaN(value)) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const num = Number(value);
  if (!isNaN(num) && num > 1000) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    const d = new Date(excelEpoch + num * 86400000);
    const year  = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day   = String(d.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return null;
}

function excelSerialToDateString(serial) {
  return toISODateString(serial);
}

function isDateColumn(header) {
  const h = (header || '').toLowerCase();
  if (h === 'month') return false;
  if ((header || '').includes('วันที่')) return true;
  return h === 'date' || h === 'due_date' || h === 'sent_date' || h.includes('date');
}

function isMonthColumn(header) {
  return (header || '').toLowerCase() === 'month';
}

function isTimeColumn(header) {
  const h = (header || '').toLowerCase();
  return h === 'accident_time' || (h.endsWith('_time') && !h.includes('date'));
}

function formatTimeString(value) {
  if (value === null || value === undefined || value === '') return '';
  if (value instanceof Date && !isNaN(value)) {
    const hh = String(value.getHours()).padStart(2, '0');
    const mm = String(value.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }
  if (typeof value === 'number' && value >= 0 && value < 1) {
    const totalMinutes = Math.round(value * 24 * 60);
    const hh = String(Math.floor(totalMinutes / 60) % 24).padStart(2, '0');
    const mm = String(totalMinutes % 60).padStart(2, '0');
    return `${hh}:${mm}`;
  }
  const str = String(value).trim();
  const m = str.match(/^(\d{1,2}):(\d{2})/);
  if (m) {
    return `${String(Number(m[1])).padStart(2, '0')}:${m[2]}`;
  }
  return str;
}

function normalizeMonthValue(value) {
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }
  if (typeof value === 'number' && value > 1000) {
    const iso = excelSerialToDateString(value);
    return typeof iso === 'string' ? iso.slice(0, 7) : value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(trimmed)) return trimmed;
    const match = trimmed.match(/(\d{4})[-\s](\d{1,2})/);
    if (match) return `${match[1]}-${String(match[2]).padStart(2, '0')}`;
    return trimmed;
  }
  if (value === null || value === undefined) return null;
  return value;
}

function cleanPlantString(str) {
  if (!str) return '';
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/[.,()_\-\/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizePlant(value) {
  if (!value) return '';
  const cleaned = cleanPlantString(value);
  if (cleaned.includes('heat exchanger')) return 'bitwise heat exchanger co ltd';
  if (cleaned.includes('thai tasaki') || cleaned.includes('tasaki')) return 'thai tasaki engineering co ltd';
  if (cleaned.includes('bitwise')) return 'bitwise thailand co ltd';
  return cleaned;
}

function samePlant(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return normalizePlant(a) === normalizePlant(b);
}

function assertAllowedSheet_(sheetName) {
  if (!API_ALLOWED_SHEETS.includes(sheetName)) {
    throw new Error('ไม่อนุญาตให้เข้าถึงแท็บนี้ผ่าน API: ' + sheetName);
  }
}

function ensureRegistrationReviewDateHeader_(sheet) {
  if (!sheet || sheet.getName() !== 'Registration_Laws_and_Safety') return;
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) return;
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => h.toString().trim());
  if (headers.includes('วันที่ประเมินล่าสุด')) return;

  const oldIdx = headers.indexOf('อัปเดตล่าสุด');
  if (oldIdx !== -1) {
    sheet.getRange(1, oldIdx + 1).setValue('วันที่ประเมินล่าสุด');
    sheet.getRange(2, oldIdx + 1, Math.max(sheet.getLastRow() - 1, 1), 1).setNumberFormat('@STRING@');
  } else {
    sheet.getRange(1, lastCol + 1).setValue('วันที่ประเมินล่าสุด');
    sheet.getRange(2, lastCol + 1, Math.max(sheet.getLastRow() - 1, 1), 1).setNumberFormat('@STRING@');
  }
}

function accidentDateToUTC_(rawDate) {
  if (rawDate instanceof Date && !isNaN(rawDate)) {
    const iso = Utilities.formatDate(rawDate, 'Asia/Bangkok', 'yyyy-MM-dd');
    const [y, m, dd] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, dd));
  }
  const iso = toISODateString(rawDate);
  if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, dd] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, dd));
  }
  return null;
}

function accidentDateToISO_(rawDate) {
  const d = accidentDateToUTC_(rawDate);
  if (!d) return null;
  return Utilities.formatDate(d, 'UTC', 'yyyy-MM-dd');
}

/**
 * ตรวจสอบอย่างถูกต้องว่าเป็นอุบัติเหตุหยุดงาน (Lost Time Incident: LTI) หรือไม่
 * ป้องกันบั๊กกรณี "ไม่หยุดงาน" ซึ่งมีคำว่า "หยุดงาน" อยู่ข้างใน
 */
function isLostTimeIncident_(lostTimeVal, severityVal) {
  const lt = (lostTimeVal || '').toString().trim().toLowerCase();
  if (lt) {
    if (lt.includes('ไม่หยุดงาน') || lt.includes('not lti') || lt.includes('no lost time') || lt.includes('non-lost time') || lt.includes('without lost time')) {
      return false;
    }
    if (lt.includes('หยุดงาน') || lt === 'lti' || lt.includes('lost time')) {
      return true;
    }
  }
  const sev = (severityVal || '').toString().trim().toLowerCase();
  if (sev.includes('disability') || sev.includes('fatality') || sev.includes('สูญเสียอวัยวะ') || sev.includes('เสียชีวิต') || sev.includes('ทุพพลภาพ')) {
    return true;
  }
  return false;
}

// ==============================================================================
// 3. GET Handlers (Query & Calculations)
// ==============================================================================

function doGet(e) {
  try {
    const params = (e && e.parameter) || {};

    if (params.health === '1') {
      return jsonResponse({ success: true, status: 'ok', timestamp: new Date().toISOString() });
    }

    const calcType = params.calc;
    if (calcType === 'daysNoIncident') {
      return handleDaysNoIncident_(params);
    }
    if (calcType === 'accidentStats') {
      return handleAccidentStats_(params);
    }
    if (calcType === 'accidentAnalytics') {
      return handleAccidentAnalytics_(params);
    }

    const sheetName = params.sheet;
    if (!sheetName) {
      return jsonResponse({
        error: 'ต้องระบุ ?sheet=ชื่อแท็บ',
        availableSheets: getSheetNames()
      });
    }

    assertAllowedSheet_(sheetName);
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      return jsonResponse({
        error: `ไม่พบแท็บชื่อ "${sheetName}"`,
        availableSheets: getSheetNames()
      });
    }

    ensureRegistrationReviewDateHeader_(sheet);

    const data = sheet.getDataRange().getValues();
    if (data.length < 2) {
      return jsonResponse({
        success: true,
        rows: [],
        headers: data.length > 0 ? data[0] : [],
        totalRows: 0,
        message: 'ยังไม่มีข้อมูลในแท็บนี้'
      });
    }

    const headers = data[0].map(h => h.toString().trim());
    const rows = data.slice(1).map((row, idx) => {
      const obj = {
        _rowIndex: idx + 2,
        _originalIndex: idx
      };
      headers.forEach((h, i) => {
        if (h) {
          let value = row[i];

          if (isMonthColumn(h)) {
            value = normalizeMonthValue(value);
          } else if (isTimeColumn(h)) {
            value = formatTimeString(value);
          } else if (isDateColumn(h)) {
            value = toISODateString(value) || value;
          } else if (value instanceof Date) {
            value = Utilities.formatDate(value, 'Asia/Bangkok', 'yyyy-MM-dd');
          }

          obj[h] = value !== undefined && value !== null ? value : '';
        }
      });
      return obj;
    });

    return jsonResponse({
      success: true,
      sheetName: sheetName,
      headers: headers,
      rows: rows,
      totalRows: rows.length,
      lastUpdated: new Date().toISOString()
    });

  } catch (err) {
    logError('doGet', err);
    return jsonResponse({ error: err.message, stack: err.stack });
  }
}

function handleDaysNoIncident_(params) {
  try {
    const plant = params.plant || '';
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('AccidentReport');

    if (!sheet) {
      return jsonResponse({ days: null, lastAccidentDate: null, message: 'ยังไม่มีแท็บ AccidentReport' });
    }

    const data = sheet.getDataRange().getValues();
    if (data.length < 2) {
      return jsonResponse({ days: null, lastAccidentDate: null });
    }

    const headers = data[0].map(h => h.toString().trim());
    const dateIdx     = headers.indexOf('accident_date');
    const companyIdx  = headers.indexOf('company');
    const lostTimeIdx = headers.indexOf('lost_time');
    const severityIdx = headers.indexOf('severity_type');

    if (dateIdx === -1) {
      return jsonResponse({ days: null, lastAccidentDate: null, message: 'ไม่พบคอลัมน์ accident_date' });
    }

    let latestDate = null;
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (plant && companyIdx !== -1) {
        const rowPlant = (row[companyIdx] || '').toString();
        if (!samePlant(rowPlant, plant)) continue;
      }
      
      const lostTimeVal = lostTimeIdx !== -1 ? row[lostTimeIdx] : '';
      const severityVal = severityIdx !== -1 ? row[severityIdx] : '';
      const isLti = isLostTimeIncident_(lostTimeVal, severityVal);

      if (!isLti) continue;

      const rawDate = row[dateIdx];
      const d = accidentDateToUTC_(rawDate);

      if (d && !isNaN(d) && (!latestDate || d > latestDate)) {
        latestDate = d;
      }
    }

    if (!latestDate) {
      return jsonResponse({ days: null, lastAccidentDate: null });
    }

    const bangkokTodayStr = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');
    const [ty, tm, td] = bangkokTodayStr.split('-').map(Number);
    const todayUTC = new Date(Date.UTC(ty, tm - 1, td));
    const diffDays = Math.max(0, Math.floor((todayUTC - latestDate) / 86400000));
    const lastAccidentDateStr = Utilities.formatDate(latestDate, 'UTC', 'yyyy-MM-dd');

    return jsonResponse({
      days: diffDays,
      lastAccidentDate: lastAccidentDateStr
    });
  } catch (err) {
    logError('handleDaysNoIncident_', err);
    return jsonResponse({ days: null, lastAccidentDate: null, error: err.message });
  }
}

function handleAccidentStats_(params) {
  try {
    const plant       = params.plant || '';
    const filterMonth = params.month || '';
    const filterYear  = params.year  || '';

    const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('AccidentReport');

    if (!sheet) {
      return jsonResponse({
        success: true, months: {}, bodyParts: {}, causes: {}, natures: {},
        severityTypes: {}, nationalities: {}, thaiInjured: 0, myanmarInjured: 0,
        lostDays: 0, message: 'ยังไม่มีแท็บ AccidentReport'
      });
    }

    const data = sheet.getDataRange().getValues();
    if (data.length < 2) {
      return jsonResponse({
        success: true, months: {}, bodyParts: {}, causes: {}, natures: {},
        severityTypes: {}, nationalities: {}, thaiInjured: 0, myanmarInjured: 0, lostDays: 0
      });
    }

    const headers = data[0].map(h => h.toString().trim());
    const idx = {};
    headers.forEach((h, i) => { idx[h] = i; });

    const months        = {};
    const bodyParts     = {};
    const causes        = {};
    const natures       = {};
    const severityTypes = {};
    const nationalities = {};
    let thaiInjured     = 0;
    let myanmarInjured  = 0;
    let lostDays        = 0;

    const addCount = (obj, key) => {
      if (!key) return;
      obj[key] = (obj[key] || 0) + 1;
    };

    for (let r = 1; r < data.length; r++) {
      const row = data[r];

      if (plant && idx['company'] !== undefined) {
        const rowPlant = (row[idx['company']] || '').toString();
        if (!samePlant(rowPlant, plant)) continue;
      }

      let iso = null;
      if (idx['accident_date'] !== undefined) {
        iso = accidentDateToISO_(row[idx['accident_date']]);
      }

      const lostTimeVal = idx['lost_time'] !== undefined ? (row[idx['lost_time']] || '').toString().trim() : '';
      const severityVal = idx['severity_type'] !== undefined ? (row[idx['severity_type']] || '').toString().trim() : '';
      const isLti = isLostTimeIncident_(lostTimeVal, severityVal);

      if (iso) {
        const m = iso.slice(0, 7);
        if (!months[m]) months[m] = { total_incidents: 0, lti: 0, not_lti: 0 };
        months[m].total_incidents++;
        if (isLti) months[m].lti++;
        else months[m].not_lti++;
      }

      let passesDetailFilter = true;
      if (filterMonth) {
        passesDetailFilter = !!(iso && iso.slice(0, 7) === filterMonth);
      } else if (filterYear) {
        passesDetailFilter = !!(iso && iso.slice(0, 4) === String(filterYear));
      }
      if (!passesDetailFilter) continue;

      if (idx['injured_parts'] !== undefined) {
        (row[idx['injured_parts']] || '').toString().split(',')
          .map(s => s.trim()).filter(Boolean).forEach(p => addCount(bodyParts, p));
      }
      if (idx['cause'] !== undefined) {
        (row[idx['cause']] || '').toString().split(',')
          .map(s => s.trim()).filter(Boolean).forEach(c => addCount(causes, c));
      }
      if (idx['nature'] !== undefined) {
        (row[idx['nature']] || '').toString().split(',')
          .map(s => s.trim()).filter(Boolean).forEach(n => addCount(natures, n));
      }
      if (idx['severity_type'] !== undefined) {
        const severity = (row[idx['severity_type']] || '').toString().trim();
        if (severity) addCount(severityTypes, severity);
      }

      if (idx['leave_actual_days'] !== undefined && isLti) {
        lostDays += Number(row[idx['leave_actual_days']]) || 0;
      }

      const nationality = idx['nationality'] !== undefined ? String(row[idx['nationality']] || '').trim().toLowerCase() : '';
      if (nationality) {
        addCount(nationalities, row[idx['nationality']]);
        if (nationality.includes('ไทย') || nationality.includes('thai')) thaiInjured++;
        else if (nationality.includes('พม่า') || nationality.includes('เมียนมา') || nationality.includes('myanmar') || nationality.includes('burma')) myanmarInjured++;
      }
    }

    return jsonResponse({
      success: true,
      months,
      bodyParts,
      causes,
      natures,
      severityTypes,
      nationalities,
      thaiInjured,
      myanmarInjured,
      lostDays
    });
  } catch (err) {
    logError('handleAccidentStats_', err);
    return jsonResponse({
      success: false, error: err.message, months: {}, bodyParts: {}, causes: {}, natures: {},
      severityTypes: {}, nationalities: {}, thaiInjured: 0, myanmarInjured: 0, lostDays: 0
    });
  }
}

function ageToRangeLabel_(age) {
  const n = Number(age);
  if (isNaN(n) || n <= 0) return null;
  if (n < 20) return 'ต่ำกว่า 20 ปี';
  if (n <= 29) return '20-29 ปี';
  if (n <= 39) return '30-39 ปี';
  if (n <= 49) return '40-49 ปี';
  if (n <= 59) return '50-59 ปี';
  return '60 ปีขึ้นไป';
}

function tenureToRangeLabel_(years, months) {
  const y = Number(years) || 0;
  const m = Number(months) || 0;
  const totalYears = y + (m / 12);
  if (y === 0 && m === 0 && !years && !months) return null;
  if (totalYears < 1) return 'น้อยกว่า 1 ปี';
  if (totalYears < 3) return '1-3 ปี';
  if (totalYears < 5) return '3-5 ปี';
  if (totalYears < 10) return '5-10 ปี';
  return '10 ปีขึ้นไป';
}

function timeToRangeLabel_(timeStr) {
  const formatted = formatTimeString(timeStr);
  const m = formatted.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const hh = Number(m[1]);
  if (isNaN(hh) || hh < 0 || hh > 23) return null;
  if (hh < 4)  return '00:00-03:59';
  if (hh < 8)  return '04:00-07:59';
  if (hh < 12) return '08:00-11:59';
  if (hh < 16) return '12:00-15:59';
  if (hh < 20) return '16:00-19:59';
  return '20:00-23:59';
}

function handleAccidentAnalytics_(params) {
  try {
    const plant = params.plant || '';
    const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('AccidentReport');

    const empty = {
      success: true, targetYearCE: 2026, targetYearBE: 2569,
      yearlyCounts: {}, monthlyLostDays: {}, byDepartment: {},
      byAgeRange: {}, byTenureRange: {}, byTimeRange: {}, byNationality: {}
    };
    if (!sheet) return jsonResponse(Object.assign(empty, { message: 'ยังไม่มีแท็บ AccidentReport' }));

    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return jsonResponse(empty);

    const headers = data[0].map(h => h.toString().trim());
    const idx = {};
    headers.forEach((h, i) => { idx[h] = i; });

    const addCount = (obj, key) => { if (!key) return; obj[key] = (obj[key] || 0) + 1; };

    const yearlyCounts    = {};
    const monthlyLostDays = {};
    const byDepartment    = {};
    const byAgeRange      = {};
    const byTenureRange   = {};
    const byTimeRange     = {};
    const byNationality   = {};

    ['ต่ำกว่า 20 ปี','20-29 ปี','30-39 ปี','40-49 ปี','50-59 ปี','60 ปีขึ้นไป'].forEach(k => byAgeRange[k] = 0);
    ['น้อยกว่า 1 ปี','1-3 ปี','3-5 ปี','5-10 ปี','10 ปีขึ้นไป'].forEach(k => byTenureRange[k] = 0);
    ['00:00-03:59','04:00-07:59','08:00-11:59','12:00-15:59','16:00-19:59','20:00-23:59'].forEach(k => byTimeRange[k] = 0);

    // 1) ค้นหาปีที่มีในข้อมูลทั้งหมด
    const allYearsInSheet = new Set();
    const parsedRows = [];

    for (let r = 1; r < data.length; r++) {
      const row = data[r];
      if (plant && idx['company'] !== undefined) {
        const rowPlant = (row[idx['company']] || '').toString();
        if (!samePlant(rowPlant, plant)) continue;
      }
      let iso = null;
      if (idx['accident_date'] !== undefined) {
        iso = accidentDateToISO_(row[idx['accident_date']]);
      }
      if (!iso) continue;
      const ceYear = Number(iso.slice(0, 4));
      if (!isNaN(ceYear)) {
        allYearsInSheet.add(ceYear);
        const beYear = ceYear + 543;
        yearlyCounts[beYear] = (yearlyCounts[beYear] || 0) + 1;
        parsedRows.push({ iso, ceYear, row });
      }
    }

    // 2) กำหนด Target Year สำหรับ demographic breakdowns
    let targetYearCE = params.year ? Number(params.year) : null;
    if (!targetYearCE || isNaN(targetYearCE)) {
      if (allYearsInSheet.size > 0) {
        targetYearCE = Math.max(...Array.from(allYearsInSheet));
      } else {
        targetYearCE = new Date().getFullYear();
      }
    }
    const targetYearBE = targetYearCE + 543;

    // 3) ประมวลผลเฉพาะปีเป้าหมาย (Dynamic Year)
    parsedRows.forEach(({ iso, ceYear, row }) => {
      if (ceYear !== targetYearCE) return;

      if (idx['leave_actual_days'] !== undefined) {
        const mm = iso.slice(5, 7);
        const days = Number(row[idx['leave_actual_days']]) || 0;
        if (days > 0) monthlyLostDays[mm] = (monthlyLostDays[mm] || 0) + days;
      }

      if (idx['department'] !== undefined) {
        const dept = (row[idx['department']] || '').toString().trim();
        if (dept) addCount(byDepartment, dept);
      }

      if (idx['age'] !== undefined) {
        const label = ageToRangeLabel_(row[idx['age']]);
        if (label) addCount(byAgeRange, label);
      }

      if (idx['tenure_years'] !== undefined || idx['tenure_months'] !== undefined) {
        const label = tenureToRangeLabel_(
          idx['tenure_years'] !== undefined ? row[idx['tenure_years']] : 0,
          idx['tenure_months'] !== undefined ? row[idx['tenure_months']] : 0
        );
        if (label) addCount(byTenureRange, label);
      }

      if (idx['accident_time'] !== undefined) {
        const label = timeToRangeLabel_(row[idx['accident_time']]);
        if (label) addCount(byTimeRange, label);
      }

      if (idx['nationality'] !== undefined) {
        const nat = (row[idx['nationality']] || '').toString().trim();
        if (nat) addCount(byNationality, nat);
      }
    });

    return jsonResponse({
      success: true,
      targetYearCE,
      targetYearBE,
      yearlyCounts,
      monthlyLostDays,
      byDepartment,
      byAgeRange,
      byTenureRange,
      byTimeRange,
      byNationality
    });
  } catch (err) {
    logError('handleAccidentAnalytics_', err);
    return jsonResponse({
      success: false, error: err.message,
      yearlyCounts: {}, monthlyLostDays: {}, byDepartment: {}, byAgeRange: {}, byTenureRange: {}, byTimeRange: {}, byNationality: {}
    });
  }
}

// ==============================================================================
// 4. POST Handlers (Mutations with Concurrency Lock)
// ==============================================================================

function doPost(e) {
  try {
    if (!e?.postData?.contents) {
      return jsonResponse({ error: 'ไม่พบข้อมูลใน request body' });
    }

    let body;
    try {
      body = JSON.parse(e.postData.contents);
    } catch (err) {
      return jsonResponse({ error: 'JSON format ไม่ถูกต้อง: ' + err.message });
    }

    const action = (body.action || '').toString().toLowerCase();

    if (action === 'uploadfile') {
      return handleUploadFile(body);
    }

    if (!body.sheet) {
      return jsonResponse({ error: 'ต้องระบุ sheet' });
    }

    const lock = LockService.getScriptLock();
    const gotLock = lock.tryLock(15000);
    if (!gotLock) {
      return jsonResponse({ error: 'ระบบกำลังประมวลผลคำขออื่นอยู่ กรุณาลองใหม่อีกครั้ง' });
    }

    try {
      assertAllowedSheet_(body.sheet);
      const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      const sheet = ss.getSheetByName(body.sheet);
      if (!sheet) {
        return jsonResponse({ error: `ไม่พบแท็บชื่อ "${body.sheet}"` });
      }

      ensureRegistrationReviewDateHeader_(sheet);

      const lastCol = sheet.getLastColumn();
      if (lastCol === 0) {
        return jsonResponse({ error: 'แท็บนี้ยังไม่มี header' });
      }

      const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => h.toString().trim());

      switch (action) {
        case 'add':
          return handleAddRow(sheet, headers, body.data);
        case 'update':
          return handleUpdateRow(sheet, headers, body.rowIndex, body.data);
        case 'delete':
          return handleDeleteRow(sheet, body.rowIndex);
        case 'batchdelete':
          return handleBatchDeleteRows(sheet, body.rowIndexes);
        case 'batchgroupsave':
          return handleBatchGroupSave(sheet, headers, body);
        default:
          return jsonResponse({ error: 'action ไม่ถูกต้องหรือไม่รองรับ: ' + action });
      }
    } finally {
      lock.releaseLock();
    }

  } catch (err) {
    logError('doPost', err);
    return jsonResponse({ error: err.message, stack: err.stack });
  }
}

function todayISODate_() {
  return Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');
}

function autoStampEvaluationDate_(sheetName, headers, data, sheet, rowIndex) {
  if (sheetName !== 'Registration_Laws_and_Safety') return data;
  if (!headers.includes('วันที่ประเมินล่าสุด')) return data;
  if (!data || !Object.prototype.hasOwnProperty.call(data, 'ผลการประเมิน')) return data;

  const newResult = (data['ผลการประเมิน'] || '').toString().trim();
  if (!newResult) return data;

  if (rowIndex) {
    const resultColIdx = headers.indexOf('ผลการประเมิน');
    const reviewDateColIdx = headers.indexOf('วันที่ประเมินล่าสุด');
    if (resultColIdx !== -1) {
      const oldResult = (sheet.getRange(rowIndex, resultColIdx + 1).getValue() || '').toString().trim();
      if (oldResult === newResult) {
        // ผลการประเมินเหมือนเดิม: ถ้ามีวันที่เดิมส่งมาให้คงไว้ ถ้าไม่มีให้ดึงค่าเดิมจากชีตมาเก็บ
        if (!data['วันที่ประเมินล่าสุด'] && reviewDateColIdx !== -1) {
          const oldReviewDate = sheet.getRange(rowIndex, reviewDateColIdx + 1).getValue();
          const iso = toISODateString(oldReviewDate);
          if (iso) data['วันที่ประเมินล่าสุด'] = iso;
        }
        return data;
      }
    }
  }

  data['วันที่ประเมินล่าสุด'] = todayISODate_();
  return data;
}

function getRequiredFields(sheetName) {
  const requiredMap = {
    'KPI_Monthly':        ['month', 'plant'],
    'Inspection':         ['month', 'plant'],
    'CAR':                ['month', 'plant', 'department'],
    'Legal_Compliance':   ['item', 'plant'],
    'TopRisks':           ['risk_name', 'plant'],
    'Highlights_Actions': ['text', 'plant'],
    'Employee':           ['รหัสพนักงาน', 'ชื่อ-นามสกุล'],
    'Registration_Laws_and_Safety': ['ลำดับ', 'ชื่อกฎหมาย'],
    'AccidentReport':     ['accident_date', 'emp_name']
  };
  return requiredMap[sheetName] || [];
}

function validateRowData(sheetName, headers, data, isUpdate) {
  const errors = [];
  const requiredFields = getRequiredFields(sheetName);

  requiredFields.forEach(field => {
    const hasField = data && Object.prototype.hasOwnProperty.call(data, field);
    if (isUpdate && !hasField) return;
    if (!data || !data[field] || data[field].toString().trim() === '') {
      errors.push(`ฟิลด์ "${field}" จำเป็นต้องมีค่า`);
    }
  });

  if (data && data.month) {
    if (!/^\d{4}-\d{2}$/.test(data.month)) {
      errors.push('รูปแบบเดือนต้องเป็น YYYY-MM (เช่น 2026-06)');
    }
  }

  ['date', 'due_date', 'sent_date', 'accident_date', 'leave_start_date', 'leave_end_date', 'วันที่ประกาศ', 'วันที่มีผลบังคับใช้'].forEach(field => {
    if (data && data[field]) {
      const val = String(data[field]).trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) {
        errors.push(`รูปแบบ ${field} ต้องเป็น YYYY-MM-DD`);
      }
    }
  });

  return errors;
}

function normalizeValue(value) {
  if (value === '' || value === null || value === undefined) return '';

  const strVal = String(value).trim();
  // รหัสพนักงาน หรือข้อความที่มีเลขนำหน้า 0 ห้ามแปลงเป็น number
  if (/^0\d+/.test(strVal)) return strVal;
  // วันที่และเดือน ห้ามแปลงเป็น number
  if (/^\d{4}-\d{2}(-\d{2})?$/.test(strVal)) return strVal;

  const num = Number(value);
  if (!isNaN(num) && strVal !== '') {
    return Number.isInteger(num) ? num : (Math.abs(num - Math.round(num)) < 1e-9 ? Math.round(num) : num);
  }
  return value;
}

function autoStampAccidentSubmittedDate_(sheetName, headers, data) {
  if (sheetName !== 'AccidentReport') return data;
  if (!headers.includes('submitted_date')) return data;
  if (!data['submitted_date']) data['submitted_date'] = todayISODate_();
  return data;
}

function autoDeriveLostTime_(sheetName, headers, data) {
  if (sheetName !== 'AccidentReport') return data;
  if (!headers.includes('lost_time') || !data) return data;
  const hasLostTime = Object.prototype.hasOwnProperty.call(data, 'lost_time') && (data['lost_time'] || '').toString().trim() !== '';
  if (hasLostTime) return data;
  const severity = (data['severity_type'] || '').toString().trim();
  if (!severity) return data;
  const LOST_TIME_MAP = {
    'ปฐมพยาบาล (First Aid)': 'ไม่หยุดงาน',
    'รักษาพยาบาล (Medical Treatment)': 'ไม่หยุดงาน',
    'สูญเสียอวัยวะบางส่วน (Partial Disability)': 'หยุดงาน',
    'ทุพพลภาพ (Disability)': 'หยุดงาน',
    'เสียชีวิต (Fatality)': 'หยุดงาน'
  };
  if (LOST_TIME_MAP[severity]) data['lost_time'] = LOST_TIME_MAP[severity];
  return data;
}

function handleAddRow(sheet, headers, data) {
  const sheetName = sheet.getName();
  if (sheetName === 'Employee') {
    const duplicateError = validateEmployeeDuplicate_(sheet, headers, data, null);
    if (duplicateError) return jsonResponse({ error: duplicateError });
  }

  data = autoStampEvaluationDate_(sheetName, headers, data, sheet, null);
  data = autoStampAccidentSubmittedDate_(sheetName, headers, data);
  data = autoDeriveLostTime_(sheetName, headers, data);

  const errors = validateRowData(sheetName, headers, data, false);
  if (errors.length > 0) {
    return jsonResponse({ error: errors.join(', ') });
  }

  const newRow = headers.map(header => normalizeValue(data && data[header] !== undefined ? data[header] : ''));
  sheet.appendRow(newRow);

  return jsonResponse({
    success: true,
    message: 'เพิ่มข้อมูลสำเร็จ',
    rowIndex: sheet.getLastRow(),
    data: data
  });
}

function handleUpdateRow(sheet, headers, rowIndex, data) {
  if (!rowIndex) return jsonResponse({ error: 'ต้องระบุ rowIndex สำหรับการแก้ไข' });
  if (rowIndex < 2) return jsonResponse({ error: 'ไม่สามารถแก้ไขแถว header ได้' });

  const lastRow = sheet.getLastRow();
  if (rowIndex > lastRow) return jsonResponse({ error: `ไม่พบแถวที่ ${rowIndex}` });

  const sheetName = sheet.getName();
  if (sheetName === 'Employee') {
    const duplicateError = validateEmployeeDuplicate_(sheet, headers, data, Number(rowIndex));
    if (duplicateError) return jsonResponse({ error: duplicateError });
  }

  data = autoStampEvaluationDate_(sheetName, headers, data, sheet, rowIndex);
  data = autoDeriveLostTime_(sheetName, headers, data);

  const errors = validateRowData(sheetName, headers, data, true);
  if (errors.length > 0) {
    return jsonResponse({ error: errors.join(', ') });
  }

  // อัปเดตทั้งแถวแบบ batch
  const currentRow = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
  const updatedRow = headers.map((header, i) => {
    return (data && data[header] !== undefined) ? normalizeValue(data[header]) : currentRow[i];
  });
  sheet.getRange(rowIndex, 1, 1, headers.length).setValues([updatedRow]);

  return jsonResponse({ success: true, message: 'แก้ไขข้อมูลสำเร็จ', rowIndex });
}

function handleDeleteRow(sheet, rowIndex) {
  if (!rowIndex) return jsonResponse({ error: 'ต้องระบุ rowIndex สำหรับการลบ' });
  if (rowIndex < 2) return jsonResponse({ error: 'ไม่สามารถลบแถว header ได้' });

  const lastRow = sheet.getLastRow();
  if (rowIndex > lastRow) return jsonResponse({ error: `ไม่พบแถวที่ ${rowIndex}` });

  sheet.deleteRow(rowIndex);
  return jsonResponse({ success: true, message: 'ลบข้อมูลสำเร็จ', rowIndex });
}

function handleBatchDeleteRows(sheet, rowIndexes) {
  if (!Array.isArray(rowIndexes) || !rowIndexes.length) {
    return jsonResponse({ error: 'ต้องระบุ rowIndexes เป็น Array' });
  }
  // เรียงลำดับจากมากไปน้อย เพื่อให้ลบจากล่างขึ้นบน index จะไม่คลาดเคลื่อน
  const sorted = [...new Set(rowIndexes.map(Number))].filter(idx => idx >= 2).sort((a, b) => b - a);
  sorted.forEach(idx => {
    if (idx <= sheet.getLastRow()) {
      sheet.deleteRow(idx);
    }
  });
  return jsonResponse({ success: true, message: `ลบข้อมูล ${sorted.length} แถวสำเร็จ` });
}

function handleBatchGroupSave(sheet, headers, body) {
  const sharedData = body.sharedData || {};
  const itemsToUpdate = body.itemsToUpdate || [];
  const itemsToAdd    = body.itemsToAdd || [];
  const rowsToDelete  = body.rowsToDelete || [];

  // 1. อัปเดตรายการเดิมก่อนเสมอ (ขณะที่ rowIndex ยังไม่ถูกเลื่อนจากการลบแถว)
  itemsToUpdate.forEach(item => {
    const rIndex = Number(item.rowIndex);
    if (rIndex >= 2 && rIndex <= sheet.getLastRow()) {
      const merged = Object.assign({}, sharedData, item.data);
      autoStampEvaluationDate_(sheet.getName(), headers, merged, sheet, rIndex);
      const currentRow = sheet.getRange(rIndex, 1, 1, headers.length).getValues()[0];
      const updatedRow = headers.map((h, colIdx) => {
        return (merged[h] !== undefined) ? normalizeValue(merged[h]) : currentRow[colIdx];
      });
      sheet.getRange(rIndex, 1, 1, headers.length).setValues([updatedRow]);
    }
  });

  // 2. ลบรายการที่ถูกลบออก (เรียงลำดับจากล่างขึ้นบน เพื่อไม่ให้ index รวน)
  if (Array.isArray(rowsToDelete) && rowsToDelete.length > 0) {
    const sortedDelete = [...new Set(rowsToDelete.map(Number))].filter(idx => idx >= 2).sort((a, b) => b - a);
    sortedDelete.forEach(idx => {
      if (idx <= sheet.getLastRow()) sheet.deleteRow(idx);
    });
  }

  // 3. เพิ่มรายการใหม่
  itemsToAdd.forEach(item => {
    const merged = Object.assign({}, sharedData, item.data);
    autoStampEvaluationDate_(sheet.getName(), headers, merged, sheet, null);
    const newRow = headers.map(h => normalizeValue(merged[h] !== undefined ? merged[h] : ''));
    sheet.appendRow(newRow);
  });

  return jsonResponse({
    success: true,
    message: 'บันทึกทั้งฉบับแบบ Batch สำเร็จเรียบร้อย'
  });
}

function validateEmployeeDuplicate_(sheet, headers, data, currentRowIndex) {
  if (!data || headers.indexOf('รหัสพนักงาน') === -1) return '';
  const code = String(data['รหัสพนักงาน'] || '').trim();
  if (!code) return '';
  const codeCol = headers.indexOf('รหัสพนักงาน') + 1;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return '';
  const values = sheet.getRange(2, codeCol, lastRow - 1, 1).getDisplayValues();
  for (let i = 0; i < values.length; i++) {
    const actualRow = i + 2;
    if (currentRowIndex && actualRow === currentRowIndex) continue;
    if (String(values[i][0] || '').trim().toLowerCase() === code.toLowerCase()) {
      return `รหัสพนักงาน '${code}' มีอยู่แล้วในแถวที่ ${actualRow}`;
    }
  }
  return '';
}

function getSheetNames() {
  try {
    return SpreadsheetApp.openById(SPREADSHEET_ID).getSheets().map(s => s.getName());
  } catch (err) {
    return [];
  }
}

// ==============================================================================
// 5. Schema Setup & Maintenance
// ==============================================================================

const CANONICAL_SCHEMAS = {
  'KPI_Monthly': ['month','plant','total_incidents','target_incidents','lti','target_lti','not_lti','target_not_lti','near_miss','target_near_miss','days_no_incident','ifr','target_ifr','isr','target_isr'],
  'Inspection': ['month','plant','safety_inspection','internal_audit','monitoring'],
  'CAR': ['month','plant','department','open','closed','overdue'],
  'Legal_Compliance': ['item','plant','agency','due_date','sent_date','status'],
  'Employee': ['รหัสพนักงาน','ชื่อ-นามสกุล','แผนก','ตำแหน่ง','Plant','สัญชาติ','วันเกิด','วันที่เริ่มงาน'],
  'Registration_Laws_and_Safety': ['ลำดับ','กระทรวง','ชื่อกฎหมาย','วันที่ประกาศ','วันที่มีผลบังคับใช้','รายละเอียดข้อกำหนดกฎหมาย','ความถี่','กำหนดการ','ผลการประเมิน','วันที่ประเมินล่าสุด','ผู้รับผิดชอบ','หมายเหตุ','ไฟล์แนบ'],
  'TopRisks': ['risk_name','plant','level','description'],
  'Highlights_Actions': ['text','plant','date','status'],
  'AccidentReport': [
    'company','emp_code','emp_name','position','department','age','nationality',
    'tenure_years','tenure_months','tenure_days',
    'supervisor_code','supervisor_name',
    'accident_date','accident_time',
    'incident_detail','incident_result','treatment_detail',
    'injured_parts','injured_parts_other','equipment','location',
    'cause','cause_other','nature','nature_other',
    'severity_type','lost_time','leave_start_date','leave_end_date','leave_actual_days',
    'submitted_by','submitted_date'
  ]
};

function setupSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const created = [], existed = [];

  Object.entries(CANONICAL_SCHEMAS).forEach(([name, headers]) => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      const monthColIdx = headers.indexOf('month');
      if (monthColIdx !== -1) {
        sheet.getRange(2, monthColIdx + 1, 999, 1).setNumberFormat('@STRING@');
      }
      headers.forEach((h, i) => {
        const isDateLike = /date/i.test(h) || h.includes('วันที่');
        if (isDateLike) {
          sheet.getRange(2, i + 1, 999, 1).setNumberFormat('@STRING@');
        }
      });
      created.push(name);
    } else {
      const firstRow = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
      if (firstRow.every(cell => cell === '')) {
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      }
      existed.push(name);
    }
  });

  return {
    created, existed,
    message: `สร้างแท็บใหม่ ${created.length} รายการ, มีอยู่แล้ว ${existed.length} รายการ`
  };
}
