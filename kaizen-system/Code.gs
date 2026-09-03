const CONFIG = {
  APP_URL: 'https://boatna.github.io/HR-Bitwise/kaizen-system/Index.html',
  SPREADSHEET_ID: '1dFEcm2IJ7fAhvKWKIcT_fmOQHsAyXB5egnMHoxn7BuI',
  DRIVE_FOLDER_ID: '1zAhdARz-0WX55ufwxiwxzZGYTtdTh8Xp',
  DATA_SHEET: 'Data',
  EMPLOYEE_SHEET: 'HR_Employees',
  EMPLOYEE_ALL_SHEET: 'HR_Employees',
  MANAGERS_SHEET: 'Managers',
  HISTORY_SHEET: 'History',
  COMMENT_SHEET: 'Comments',
  PROGRESS_SHEET: 'MonthlyProgress',

  TARGET_DEFAULT: 6,
  TARGET_EXEMPT: 4,
  TARGET_ZERO: 0,

  EXEMPT_POSITIONS: ['ที่ปรึกษา', 'หน.หน่วย', 'ผู้เชี่ยวชาญ', 'จป.วิชาชีพ', 'หัวหน้าแผนก'],
  ZERO_TARGET_POSITIONS: ['ผู้จัดการฝ่าย', 'กรรมการผู้จัดการ', 'ผู้จัดการทั่วไป'],

  HEAD_APPROVER_POSITIONS: ['หน.หน่วย', 'จป.วิชาชีพ', 'หัวหน้าแผนก'],
  DIRECTOR_APPROVER_POSITIONS: ['ผู้เชี่ยวชาญ', 'ผู้จัดการฝ่าย', 'กรรมการผู้จัดการ'],

  CATEGORIES: {
    P: 'ผลผลิต (Productivity)',
    D: 'การส่งมอบ (Delivery)',
    E: 'สิ่งแวดล้อม (Environment)',
    S: 'ความปลอดภัย (Safety)',
    Q: 'คุณภาพ (Quality)',
    E2: 'พลังงาน (Energy)',
    C: 'ลดต้นทุน (Cost)',
    M: 'ขวัญกำลังใจ (Morale)'
  },

  KAIZEN_TYPES: {
    automation: 'Automation Kaizen',
    karakuri: 'Karakuri Kaizen',
    genco: 'Genco Kaizen',
    project: 'Project Kaizen',
    service: 'Service Kaizen',
    innovation: 'Kaizen for Innovation',
    suggestion: 'Kaizen Suggestion System'
  },

  STATUS_PENDING_HEAD: 'รอหัวหน้าแผนกตรวจ',
  STATUS_PENDING_DIRECTOR: 'รอผู้จัดการตรวจ',
  STATUS_APPROVED: 'ผ่าน',
  STATUS_REJECTED: 'ตีกลับ',

  COMPANY_NAME: 'บริษัท บิทไว้ส์ (ประเทศไทย) จำกัด',
  FORM_CODE: 'F-Hr-45 Rev.1',

  EMAIL_ENABLED: true,
  EMAIL_SENDER_NAME: 'ระบบบันทึก Kaizen',
  EMAIL_CC: '',

  MAX_FILE_SIZE: 10 * 1024 * 1024,
  MAX_FILES_PER_KAIZEN: 10,
  MAX_TOTAL_UPLOAD_SIZE: 50 * 1024 * 1024,

  SCRIPT_PROP_FOLDER_ID_KEY: 'SCRIPT_PROP_FOLDER_ID_KEY',

  CACHE_DURATION_SECONDS: 300,
  RECENT_TRANSACTIONS_TTL: 60000
};

const AUTO_FOLDER_NAME = 'Kaizen Attachments (Auto)';
const HR_EMP_COL = {
  EMPID: 1, NAME: 2, DEPARTMENT: 3, POSITION: 4, PLANT: 5,
  PREFIX: 6, FIRSTNAME: 7, LASTNAME: 8, EMAIL: 9, TASKS: 10, DONE: 11
};
const DATA_COL = {
  ID: 1, DATE: 2, EMPID: 3, NAME: 4, DEPARTMENT: 5, TITLE: 6, DETAIL: 7,
  RESULT: 8, PDF: 9, EXCEL: 10, TIMESTAMP: 11, CATEGORIES: 12,
  MANAGER_APPROVER: 13, DIRECTOR_APPROVER: 14, STATUS: 15,
  P: 16, D: 17, E: 18, S: 19, Q: 20, E2: 21, C: 22, M: 23,
  REJECT_REASON: 24, REVIEWED_BY: 25, REVIEWED_DATE: 26,
  FORM_PDF_URL: 27, BEFORE_IMAGE_URL: 28, AFTER_IMAGE_URL: 29,
  BEFORE_PROBLEM: 30, AFTER_SOLUTION: 31, MULTIPLE_FILES: 32,
  KAIZEN_TYPE: 33, HEAD_APPROVER: 34, HEAD_APPROVED_DATE: 35
};

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('ระบบบันทึก Kaizen')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function doPost(e) {
  let result;
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error('ไม่พบข้อมูลที่ส่งมา');
    }
    const params = JSON.parse(e.postData.contents);
    const action = params.action;

    if (params.payload && params.payload.transactionId) {
      if (checkAndMarkTransaction_(params.payload.transactionId)) {
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: 'คำขอนี้ถูกดำเนินการแล้ว กรุณารอสักครู่'
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    switch (action) {
      case 'identifyUser':
        result = identifyUser(params.payload && params.payload.role, params.payload && params.payload.id);
        break;
      case 'getMyRecords':
        result = getMyRecords(params.payload && params.payload.empId);
        break;
      case 'addKaizenRecord':
        result = addKaizenRecord(params.payload);
        break;
      case 'addKaizenRecordWithMultipleFiles':
        result = addKaizenRecordWithMultipleFiles(params.payload);
        break;
      case 'resubmitKaizenRecord':
        result = resubmitKaizenRecord(params.payload);
        break;
      case 'deleteKaizenRecord':
        result = deleteKaizenRecord(params.payload);
        break;
      case 'getReviewQueue':
        result = getReviewQueue(params.payload && params.payload.reviewerId, params.payload);
        break;
      case 'getEmployeesForManager':
        result = getEmployeesForManager(
          params.payload && params.payload.reviewerId,
          params.payload && params.payload.beYear
        );
        break;
      case 'addKaizenRecordByManager':
        result = addKaizenRecordByManager(params.payload);
        break;
      case 'getMonthlyProgressForManager':
        result = getMonthlyProgressForManager(
          params.payload && params.payload.reviewerId,
          params.payload && params.payload.beYear
        );
        break;
      case 'saveMonthlyProgressCount':
        result = saveMonthlyProgressCount(params.payload);
        break;
      case 'reviewKaizenRecord':
        result = reviewKaizenRecord(params.payload);
        break;
      case 'getDashboardData':
        result = getDashboardData(
          params.payload && params.payload.beYear,
          params.payload && params.payload.department
        );
        break;
      case 'getKaizenHistory':
        result = getKaizenHistory(params.payload);
        break;
      case 'addComment':
        result = addComment(params.payload);
        break;
      case 'getComments':
        result = getComments(params.payload && params.payload.kaizenId);
        break;
      case 'deleteComment':
        result = deleteComment(params.payload);
        break;
      case 'advancedSearch':
        result = advancedSearch(params.payload);
        break;
      case 'getDepartments':
        result = getDepartments();
        break;
      case 'getEmployeeKaizenHistory':
        result = getEmployeeKaizenHistory(params.payload);
        break;
      case 'autoRepairAllSheets':
        result = autoRepairAllSheets();
        break;
      case 'setupDatabase':
        result = setupDatabase();
        break;
      case 'repairDepartmentNames':
        result = repairDepartmentNames();
        break;
      case 'syncManagerDepartments':
        result = syncManagerDepartments();
        break;
      case 'repairDataColumnAlignment':
        result = repairDataColumnAlignment();
        break;
      case 'debugReviewQueue':
        result = debugReviewQueue(params.payload && params.payload.reviewerId);
        break;
      case 'getEmailLogs':
        result = getEmailLogs(params.payload);
        break;
      case 'getAllEmployeesRaw':
        result = getAllEmployeesRaw(params.payload && params.payload.reviewerId);
        break;
      case 'updateEmployeeRecord':
        result = updateEmployeeRecord(params.payload);
        break;
      case 'addEmployeeRecord':
        result = addEmployeeRecord(params.payload);
        break;
      case 'deleteEmployeeRecord':
        result = deleteEmployeeRecord(params.payload);
        break;
      default:
        result = { success: false, message: 'ไม่รู้จัก action: ' + action };
    }
  } catch (err) {
    Logger.log('[ERROR] doPost: ' + (err.stack || err.message));
    result = {
      success: false,
      message: 'เกิดข้อผิดพลาด: ' + (err.message || 'ระบบไม่สามารถดำเนินการได้')
    };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function checkAndMarkTransaction_(transactionId) {
  if (!transactionId) return false;

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
  } catch (e) {
    return false;
  }

  try {
    const props = PropertiesService.getScriptProperties();
    const key = 'txn_' + transactionId;
    const existing = props.getProperty(key);

    if (existing) {
      const timestamp = parseInt(existing, 10);
      if (Date.now() - timestamp < CONFIG.RECENT_TRANSACTIONS_TTL) {
        return true;
      }
    }

    props.setProperty(key, String(Date.now()));
    cleanupOldTransactions_();
    return false;
  } catch (e) {
    return false;
  } finally {
    lock.releaseLock();
  }
}

function cleanupOldTransactions_() {
  try {
    const props = PropertiesService.getScriptProperties();
    const allKeys = props.getKeys();
    const now = Date.now();
    
    allKeys.forEach(key => {
      if (key.startsWith('txn_')) {
        const timestamp = parseInt(props.getProperty(key) || '0', 10);
        if (now - timestamp > CONFIG.RECENT_TRANSACTIONS_TTL * 2) {
          props.deleteProperty(key);
        }
      }
    });
  } catch (e) {}
}

function assertConfig_() {
  if (!CONFIG.SPREADSHEET_ID || CONFIG.SPREADSHEET_ID.indexOf('ใส่_') === 0) {
    throw new Error('ยังไม่ได้ตั้งค่า SPREADSHEET_ID ใน CONFIG');
  }
  if (!CONFIG.DRIVE_FOLDER_ID || CONFIG.DRIVE_FOLDER_ID.indexOf('ใส่_') === 0) {
    throw new Error('ยังไม่ได้ตั้งค่า DRIVE_FOLDER_ID ใน CONFIG');
  }
}

function getAppUrl_() {
  try {
    if (CONFIG.APP_URL && CONFIG.APP_URL.indexOf('ใส่_') !== 0) {
      return CONFIG.APP_URL;
    }
  } catch (e) {}
  try {
    return ScriptApp.getService().getUrl();
  } catch (e) {
    return '#';
  }
}

function getSS_() {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

function getSheet_(name) {
  const ss = getSS_();
  const sh = ss.getSheetByName(name);
  if (!sh) throw new Error('ไม่พบชีต: ' + name);
  return sh;
}

function sheetExists_(name) {
  try {
    return !!getSS_().getSheetByName(name);
  } catch (e) {
    return false;
  }
}

function normalizeEmpId_(val) {
  if (val === null || val === undefined || val === '') return '';
  const s = String(val).trim();
  if (s === '') return '';
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    if (!isNaN(n)) return String(Math.round(n));
  }
  return s;
}

function normalizeDept_(val) {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

function toBEDateString_(dateVal) {
  if (!dateVal) return '';
  const d = (dateVal instanceof Date) ? dateVal : new Date(dateVal);
  if (isNaN(d.getTime())) return String(dateVal);
  const day = d.getDate();
  const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const beYear = d.getFullYear() + 543;
  return day + ' ' + monthNames[d.getMonth()] + ' ' + beYear;
}

function getTargetForPosition_(position) {
  const pos = String(position || '').trim();
  const isZeroTarget = CONFIG.ZERO_TARGET_POSITIONS.some(p => pos === String(p).trim());
  if (isZeroTarget) return CONFIG.TARGET_ZERO;
  const isExempt = CONFIG.EXEMPT_POSITIONS.some(p => pos === String(p).trim());
  return isExempt ? CONFIG.TARGET_EXEMPT : CONFIG.TARGET_DEFAULT;
}

function resolveDoneCount_(doneCount, computedCount) {
  const computed = Number(computedCount) || 0;
  if (doneCount === null || doneCount === undefined || isNaN(doneCount)) {
    return computed;
  }
  return Math.max(Number(doneCount) || 0, computed);
}

function safeJSONParse_(str) {
  try {
    if (!str) return null;
    return typeof str === 'string' ? JSON.parse(str) : str;
  } catch (e) {
    return null;
  }
}

function escapeHtmlServer_(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function extractDriveFileIdFromUrl_(url) {
  if (!url) return '';
  const m = String(url).match(/[-\w]{25,}/);
  return m ? m[0] : '';
}

function clearKaizenCache_() {
  try {
    const cache = CacheService.getScriptCache();
    cache.remove('kaizen_records_all');
    cache.remove('employees_list');
    cache.remove('employees_all_list');
  } catch (e) {}
}

function getOrCreateDriveFolder_() {
  const props = PropertiesService.getScriptProperties();
  const folderKey = CONFIG.SCRIPT_PROP_FOLDER_ID_KEY || 'SCRIPT_PROP_FOLDER_ID_KEY';

  const savedId = props.getProperty(folderKey);
  if (savedId) {
    try {
      return DriveApp.getFolderById(savedId);
    } catch (e) {
      console.warn('Saved folder not found, creating new:', e.message);
    }
  }

  if (CONFIG.DRIVE_FOLDER_ID && CONFIG.DRIVE_FOLDER_ID.indexOf('ใส่_') !== 0) {
    try {
      const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
      props.setProperty(folderKey, folder.getId());
      return folder;
    } catch (e) {
      console.warn('Config folder not found, creating new:', e.message);
    }
  }

  const existing = DriveApp.getFoldersByName(AUTO_FOLDER_NAME);
  if (existing.hasNext()) {
    const folder = existing.next();
    props.setProperty(folderKey, folder.getId());
    return folder;
  }

  const newFolder = DriveApp.createFolder(AUTO_FOLDER_NAME);
  props.setProperty(folderKey, newFolder.getId());
  return newFolder;
}

function saveFileToDrive_(base64Data, fileName, mimeType, kaizenId) {
  const folder = getOrCreateDriveFolder_();

  let cleanBase64 = base64Data;
  if (base64Data.indexOf(',') > -1) {
    cleanBase64 = base64Data.split(',')[1];
  }

  const bytes = Utilities.base64Decode(cleanBase64);
  const blob = Utilities.newBlob(bytes, mimeType || 'application/octet-stream', kaizenId + '_' + fileName);

  const file = folder.createFile(blob);

  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (shareErr) {}

  return file.getUrl();
}

function saveMultipleFilesToDrive_(files, kaizenId, startCount) {
  const results = [];
  const folder = getOrCreateDriveFolder_();
  let totalSize = 0;
  const already = Number(startCount) || 0;
  const timestamp = new Date().getTime();

  for (let i = 0; i < files.length; i++) {
    const fileData = files[i];
    const fileIndex = already + i;
    if (fileIndex >= CONFIG.MAX_FILES_PER_KAIZEN) {
      results.push({
        name: fileData.name || 'unknown',
        error: 'แนบไฟล์ได้สูงสุด ' + CONFIG.MAX_FILES_PER_KAIZEN + ' ไฟล์ต่อ 1 Kaizen'
      });
      continue;
    }
    try {
      let fileSize = fileData.size || 0;
      if (!fileSize && fileData.base64) {
        fileSize = fileData.base64.length * 0.75;
      }
      
      if (fileSize > CONFIG.MAX_FILE_SIZE) {
        results.push({
          name: fileData.name,
          error: 'ไฟล์มีขนาดใหญ่เกินไป (' + (fileSize / 1024 / 1024).toFixed(2) + ' MB) จำกัดไม่เกิน 10 MB'
        });
        continue;
      }

      totalSize += fileSize;
      if (totalSize > CONFIG.MAX_TOTAL_UPLOAD_SIZE) {
        results.push({
          name: fileData.name,
          error: 'ขนาดไฟล์รวมเกิน 50 MB'
        });
        continue;
      }

      let cleanBase64 = fileData.base64;
      if (cleanBase64 && cleanBase64.indexOf(',') > -1) {
        cleanBase64 = cleanBase64.split(',')[1];
      }

      if (!cleanBase64) {
        results.push({
          name: fileData.name,
          error: 'ไม่พบข้อมูลไฟล์ (base64 ว่าง)'
        });
        continue;
      }

      const bytes = Utilities.base64Decode(cleanBase64);
      const fileName = kaizenId + '_file_' + (fileIndex + 1) + '_' + timestamp + '_' + (fileData.name || 'file');
      const blob = Utilities.newBlob(bytes, fileData.mimeType || 'application/octet-stream', fileName);

      const driveFile = folder.createFile(blob);

      try {
        driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (e) {}

      results.push({
        name: fileData.name || 'file',
        url: driveFile.getUrl(),
        type: fileData.mimeType || 'application/octet-stream',
        size: fileSize
      });
    } catch (e) {
      console.error('Error saving file:', e);
      results.push({
        name: fileData.name || 'unknown',
        error: 'ไม่สามารถบันทึกไฟล์ได้: ' + e.message
      });
    }
  }

  return results;
}

function deleteKaizenFilesFromDrive_(recordData) {
  const fileUrlsToDelete = [];
  let deletedCount = 0;

  try {
    if (recordData.beforeImageUrl) fileUrlsToDelete.push(recordData.beforeImageUrl);
    if (recordData.afterImageUrl) fileUrlsToDelete.push(recordData.afterImageUrl);
    if (recordData.formPdfUrl) fileUrlsToDelete.push(recordData.formPdfUrl);

    let multipleFiles = [];
    try {
      if (recordData.fileUrls) {
        multipleFiles = typeof recordData.fileUrls === 'string' ?
          JSON.parse(recordData.fileUrls) : recordData.fileUrls;
        if (!Array.isArray(multipleFiles)) multipleFiles = [];
      }
    } catch (e) {
      multipleFiles = [];
    }
    multipleFiles.forEach(url => {
      if (url) fileUrlsToDelete.push(url);
    });

    fileUrlsToDelete.forEach(url => {
      const fileId = extractDriveFileIdFromUrl_(url);
      if (fileId) {
        try {
          DriveApp.getFileById(fileId).setTrashed(true);
          deletedCount++;
        } catch (e) {}
      }
    });
  } catch (cleanupErr) {}

  return deletedCount;
}

function getEmployees() {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'employees_list';

  try {
    const cached = cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {}

  try {
    let sh = null;
    try {
      sh = getSheet_(CONFIG.EMPLOYEE_SHEET);
    } catch (e) {
      sh = getSheet_('Employees');
    }
    
    const lastRow = sh.getLastRow();
    if (lastRow < 2) return [];

    const headerRow = sh.getRange(1, 1, 1, 11).getValues()[0];
    const isHeaderRow = headerRow.some(h => String(h).trim() === 'EmpID' || String(h).trim() === 'Name');
    
    let startRow = isHeaderRow ? 2 : 1;
    const values = sh.getRange(startRow, 1, lastRow - startRow + 1, 11).getValues();

    const employees = [];
    values.forEach(function (row) {
      const empId = normalizeEmpId_(row[0]);
      if (!empId) return;
      
      let name = row[1] || '';
      if (typeof name === 'string' && name.indexOf('=') === 0) {
        const prefix = String(row[5] || '').trim();
        const firstName = String(row[6] || '').trim();
        const lastName = String(row[7] || '').trim();
        name = [prefix, firstName, lastName].filter(Boolean).join(' ');
      }
      
      const tasksRaw = row[9];
      const doneRaw = row[10];
      const tasksNum = (tasksRaw !== null && tasksRaw !== undefined && String(tasksRaw).trim() !== '') ? Number(tasksRaw) : NaN;
      const doneNum = (doneRaw !== null && doneRaw !== undefined && String(doneRaw).trim() !== '') ? Number(doneRaw) : NaN;

      employees.push({
        empId: empId,
        name: name,
        department: normalizeDept_(row[2] || ''),
        position: row[3] || '',
        plant: row[4] || '',
        prefix: row[5] || '',
        firstName: row[6] || '',
        lastName: row[7] || '',
        email: String(row[8] || '').trim(),
        target: (!isNaN(tasksNum)) ? tasksNum : getTargetForPosition_(row[3]),
        doneCount: (!isNaN(doneNum)) ? doneNum : null
      });
    });

    try {
      cache.put(cacheKey, JSON.stringify(employees), CONFIG.CACHE_DURATION_SECONDS);
    } catch (e) {}

    return employees;
  } catch (e) {
    console.error('getEmployees error:', e);
    return [];
  }
}

// ใช้งาน HR_Employees แทน Employees_All ตามความต้องการของผู้ใช้
function getEmployeesAllList_() {
  return getEmployees();
}

function getManagers() {
  try {
    let managers = [];
    try {
      const sh = getSheet_(CONFIG.MANAGERS_SHEET);
      const lastRow = sh.getLastRow();
      
      if (lastRow >= 2) {
        const values = sh.getRange(2, 1, lastRow - 1, 10).getValues();
        managers = values
          .filter(row => {
            const id = String(row[0] || '').trim();
            const name = String(row[1] || '').trim();
            const approverType = String(row[4] || '').trim();
            return id && name && approverType;
          })
          .map(row => {
            const approverTypeRaw = String(row[4] || '').trim();
            const approverTypes = approverTypeRaw
              .split(',')
              .map(s => s.trim())
              .filter(Boolean);
            const dept = normalizeDept_(String(row[3] || '').trim());
            
            return {
              id: normalizeEmpId_(row[0]),
              name: String(row[1] || '').trim(),
              position: String(row[2] || '').trim(),
              department: dept,
              approverType: approverTypes,
              email: String(row[9] || '').trim(),
              plant: String(row[5] || '').trim(),
              prefix: String(row[6] || '').trim(),
              firstName: String(row[7] || '').trim(),
              lastName: String(row[8] || '').trim()
            };
          });
      }
    } catch (e) {
      console.warn('Error reading Managers sheet:', e.message);
    }

    const uniqueManagers = {};
    managers.forEach(m => {
      const key = String(m.id || '').trim();
      if (key && !uniqueManagers[key]) {
        uniqueManagers[key] = m;
      }
    });

    return { success: true, managers: Object.values(uniqueManagers) };
  } catch (err) {
    console.error('getManagers error:', err);
    return { success: false, message: err.message, managers: [] };
  }
}

function getKaizenRecords() {
  const cache = CacheService.getScriptCache();
  try {
    const cached = cache.get('kaizen_records_all');
    if (cached) return JSON.parse(cached);
  } catch (e) {}

  const sh = getSheet_(CONFIG.DATA_SHEET);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];

  const lastCol = sh.getLastColumn();
  const values = sh.getRange(2, 1, lastRow - 1, Math.max(lastCol, 35)).getValues();

  const records = [];
  values.forEach(function (row, idx) {
    if (!row[0]) return;
    const dateObj = row[1] ? new Date(row[1]) : null;

    let categories = {};
    if (row[11]) {
      try {
        categories = JSON.parse(row[11]);
      } catch (e) {
        categories = {
          P: !!row[15],
          D: !!row[16],
          E: !!row[17],
          S: !!row[18],
          Q: !!row[19],
          E2: !!row[20],
          C: !!row[21],
          M: !!row[22]
        };
      }
    }

    let status = row[14] ? String(row[14]).trim() : CONFIG.STATUS_PENDING_HEAD;
    if (status === 'รอตรวจ') status = CONFIG.STATUS_PENDING_HEAD;

    let kaizenType = row[32] ? String(row[32]).trim() : '';

    let fileUrls = [];
    if (row[31]) {
      try {
        fileUrls = JSON.parse(row[31]);
        if (!Array.isArray(fileUrls)) fileUrls = [];
      } catch (e) {
        fileUrls = [];
      }
    }

    records.push({
      rowIndex: idx + 2,
      id: String(row[0] || '').trim(),
      date: dateObj ? Utilities.formatDate(dateObj, Session.getScriptTimeZone(), 'yyyy-MM-dd') : '',
      dateDisplay: toBEDateString_(row[1]),
      beYear: dateObj ? (dateObj.getFullYear() + 543) : null,
      empId: normalizeEmpId_(row[2]),
      name: row[3] || '',
      department: normalizeDept_(row[4] || ''),
      title: row[5] || '',
      detail: row[6] || '',
      result: row[7] || '',
      pdfUrl: String(row[8] || '').trim(),
      excelUrl: String(row[9] || '').trim(),
      timestamp: row[10] ? Utilities.formatDate(new Date(row[10]), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm') : '',
      categories: categories,
      status: status,
      rejectReason: row[23] || '',
      reviewedBy: row[24] || '',
      reviewedDate: row[25] ? toBEDateString_(row[25]) : '',
      formPdfUrl: String(row[26] || '').trim(),
      beforeImageUrl: String(row[27] || '').trim(),
      afterImageUrl: String(row[28] || '').trim(),
      beforeProblem: row[29] || '',
      afterSolution: row[30] || '',
      fileUrls: fileUrls,
      kaizenType: kaizenType,
      headApprover: row[33] || '',
      headApprovedDate: row[34] ? toBEDateString_(row[34]) : ''
    });
  });

  records.sort(function (a, b) {
    return b.id.localeCompare(a.id, undefined, { numeric: true });
  });

  try {
    cache.put('kaizen_records_all', JSON.stringify(records), 60);
  } catch (e) {}

  return records;
}

function findRowByKaizenId_(sh, kaizenId, fallbackRowIndex) {
  if (!kaizenId) return fallbackRowIndex;
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return -1;
  const idColValues = sh.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < idColValues.length; i++) {
    if (String(idColValues[i][0]).trim() === String(kaizenId).trim()) {
      return i + 2;
    }
  }
  return fallbackRowIndex || -1;
}

function getKaizenRecordById_(kaizenId) {
  try {
    const records = getKaizenRecords();
    return records.find(r => String(r.id) === String(kaizenId));
  } catch (e) {
    return null;
  }
}

function generateNextId_(sh, beYear) {
  const lastRow = sh.getLastRow();
  let maxRunning = 0;
  const prefix = 'KZ-' + beYear + '-';

  if (lastRow >= 2) {
    try {
      const ids = sh.getRange(2, 1, lastRow - 1, 1).getValues();
      ids.forEach(function (r) {
        const id = String(r[0] || '');
        if (id.indexOf(prefix) === 0) {
          const mainPart = id.split('_')[0];
          const running = parseInt(mainPart.substring(prefix.length), 10);
          if (!isNaN(running) && running > maxRunning) maxRunning = running;
        }
      });
    } catch (e) {
      console.warn('Error reading IDs for generateNextId_:', e);
    }
  }

  const next = maxRunning + 1;
  const timestamp = new Date().getTime().toString().slice(-6);
  const random = Math.random().toString(36).substring(2, 6);
  return prefix + ('0000' + next).slice(-4) + '_' + timestamp + random;
}

function saveVersionHistory_(kaizenId, rowIndex, action, oldData, newData, userId, userName) {
  try {
    const ss = getSS_();
    let historySheet = ss.getSheetByName(CONFIG.HISTORY_SHEET);
    if (!historySheet) {
      historySheet = ss.insertSheet(CONFIG.HISTORY_SHEET);
    }

    if (historySheet.getLastRow() === 0) {
      historySheet.appendRow([
        'ID', 'KaizenID', 'RowIndex', 'Action', 'OldData', 'NewData',
        'UserId', 'UserName', 'Timestamp', 'Version'
      ]);
    }

    const allData = historySheet.getDataRange().getValues();
    let version = 1;
    for (let i = 1; i < allData.length; i++) {
      if (String(allData[i][1]) === String(kaizenId)) {
        const v = parseInt(allData[i][9], 10);
        if (!isNaN(v) && v >= version) version = v + 1;
      }
    }

    historySheet.appendRow([
      Utilities.getUuid(),
      kaizenId,
      rowIndex,
      action,
      oldData ? JSON.stringify(oldData) : '',
      newData ? JSON.stringify(newData) : '',
      userId || '',
      userName || 'System',
      new Date(),
      version
    ]);

    return version;
  } catch (e) {
    console.error('saveVersionHistory_ error:', e);
    return null;
  }
}

function getKaizenHistory(payload) {
  try {
    const kaizenId = payload && payload.kaizenId;
    if (!kaizenId) throw new Error('กรุณาระบุรหัส Kaizen');

    const ss = getSS_();
    const historySheet = ss.getSheetByName(CONFIG.HISTORY_SHEET);
    if (!historySheet) return { success: true, history: [] };

    const data = historySheet.getDataRange().getValues();
    const history = [];

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][1]) === String(kaizenId)) {
        history.push({
          version: parseInt(data[i][9], 10) || 0,
          action: data[i][3] || '',
          oldData: data[i][4] ? safeJSONParse_(data[i][4]) : null,
          newData: data[i][5] ? safeJSONParse_(data[i][5]) : null,
          userId: data[i][6] || '',
          userName: data[i][7] || 'System',
          timestamp: data[i][8] ? new Date(data[i][8]) : null,
          rowIndex: parseInt(data[i][2], 10) || 0
        });
      }
    }

    history.sort((a, b) => b.version - a.version);
    return { success: true, history: history };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function getEmployeeKaizenHistory(payload) {
  try {
    const empId = payload && payload.empId;
    const beYear = payload && payload.beYear;
    
    if (!empId) throw new Error('กรุณาระบุรหัสพนักงาน');

    const allRecords = getKaizenRecords();
    let filtered = allRecords.filter(r => r.empId === normalizeEmpId_(empId));

    if (beYear) {
      filtered = filtered.filter(r => r.beYear === Number(beYear));
    }

    filtered.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    const statusCount = { pending: 0, approved: 0, rejected: 0 };
    filtered.forEach(r => {
      if (r.status === CONFIG.STATUS_APPROVED) {
        statusCount.approved++;
      } else if (r.status === CONFIG.STATUS_REJECTED) {
        statusCount.rejected++;
      } else {
        statusCount.pending++;
      }
    });

    return {
      success: true,
      records: filtered,
      summary: {
        total: filtered.length,
        pending: statusCount.pending,
        approved: statusCount.approved,
        rejected: statusCount.rejected
      }
    };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function deleteKaizenRecord(payload) {
  try {
    assertConfig_();
    payload = payload || {};
    let idx = Number(payload.rowIndex);
    const kaizenId = payload.id || payload.kaizenId;

    let recordDataForDrive = null;
    let idCell = '';
    let deletedFileCount = 0;

    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      const sh = getSheet_(CONFIG.DATA_SHEET);
      if (kaizenId) {
        const resolvedIdx = findRowByKaizenId_(sh, kaizenId, idx);
        if (resolvedIdx > 1) idx = resolvedIdx;
      }

      if (!idx || isNaN(idx) || idx < 2 || idx > sh.getLastRow()) {
        throw new Error('ไม่พบรายการที่ต้องการลบในระบบ');
      }

      const rowData = sh.getRange(idx, 1, 1, 35).getValues()[0];
      idCell = String(rowData[0] || '');
      const ownerEmpId = normalizeEmpId_(rowData[2]);
      const recordStatus = String(rowData[14] || '').trim();

      let authorized = false;
      let actorId = 'System';
      let actorName = 'System';

      if (payload.empId && normalizeEmpId_(payload.empId) === ownerEmpId) {
        if (recordStatus === CONFIG.STATUS_APPROVED) {
          throw new Error('ไม่สามารถลบรายการที่ผ่านการอนุมัติแล้วได้');
        }
        authorized = true;
        actorId = payload.empId;
        actorName = 'พนักงานเจ้าของรายการ';
      } else if (payload.reviewerId) {
        const managerResult = getManagers();
        const managers = managerResult.success ? managerResult.managers : [];
        const reviewer = managers.find(m =>
          String(m.id || '').trim() === String(payload.reviewerId || '').trim()
        );
        if (reviewer) {
          const isDirectorReviewer = (reviewer.approverType || []).indexOf('ผู้จัดการ') > -1;
          if (recordStatus === CONFIG.STATUS_APPROVED && !isDirectorReviewer) {
            throw new Error('ไม่สามารถลบรายการที่ผ่านการอนุมัติแล้วได้ (เฉพาะผู้จัดการเท่านั้นที่มีสิทธิ์)');
          }
          authorized = true;
          actorId = reviewer.id;
          actorName = reviewer.name;
        }
      }

      if (!authorized) {
        throw new Error('ไม่มีสิทธิ์ลบรายการนี้');
      }

      recordDataForDrive = {
        beforeImageUrl: String(rowData[27] || ''),
        afterImageUrl: String(rowData[28] || ''),
        formPdfUrl: String(rowData[26] || ''),
        fileUrls: rowData[31] || '[]'
      };

      saveVersionHistory_(idCell, idx, 'DELETE', null, null, actorId, actorName);
      sh.deleteRow(idx);
      clearKaizenCache_();
    } finally {
      lock.releaseLock();
    }

    if (recordDataForDrive) {
      deletedFileCount = deleteKaizenFilesFromDrive_(recordDataForDrive);
    }

    return {
      success: true,
      message: 'ลบข้อมูลเรียบร้อยแล้ว' + (deletedFileCount > 0 ? ' (ลบไฟล์ ' + deletedFileCount + ' รายการ)' : '')
    };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

function addKaizenRecordWithMultipleFiles(payload) {
  try {
    assertConfig_();

    if (!payload.empId || !payload.title) {
      throw new Error('กรุณากรอกข้อมูลพนักงานและหัวข้อ Kaizen ให้ครบถ้วน');
    }

    if (!payload.kaizenType) {
      throw new Error('กรุณาเลือกประเภท Kaizen');
    }

    if (payload.files && payload.files.length > 0) {
      let totalSize = 0;
      for (let i = 0; i < payload.files.length; i++) {
        const fileData = payload.files[i];
        const fileSize = fileData.size || (fileData.base64 ? (fileData.base64.length * 3 / 4) : 0);
        if (fileSize > CONFIG.MAX_FILE_SIZE) {
          throw new Error('ไฟล์ "' + fileData.name + '" มีขนาดใหญ่เกินไป (' + (fileSize / 1024 / 1024).toFixed(2) + ' MB) จำกัดไม่เกิน 10 MB');
        }
        totalSize += fileSize;
      }
      if (totalSize > CONFIG.MAX_TOTAL_UPLOAD_SIZE) {
        throw new Error('ขนาดไฟล์รวมเกิน 50 MB กรุณาลดขนาดหรือจำนวนไฟล์');
      }
    }

    let dateObj;
    if (payload.date) {
      const parts = String(payload.date).split('-');
      if (parts.length === 3) {
        dateObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      } else {
        dateObj = new Date(payload.date);
      }
    } else {
      dateObj = new Date();
    }

    if (isNaN(dateObj.getTime())) {
      throw new Error('รูปแบบวันที่ไม่ถูกต้อง');
    }

    const beYear = dateObj.getFullYear() + 543;
    const categories = payload.categories || {};
    const categoriesJson = JSON.stringify(categories);

    let newId, newRowIndex, sh, fileUrls = [], beforeImageUrl = '', afterImageUrl = '', fileErrors = [];

    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      sh = getSheet_(CONFIG.DATA_SHEET);
      newId = generateNextId_(sh, beYear);

      if (payload.files && payload.files.length > 0) {
        const fileResults = saveMultipleFilesToDrive_(payload.files, newId);
        const failedFiles = fileResults.filter(f => f.error);
        if (failedFiles.length > 0) {
          fileErrors = failedFiles.map(f => ({ name: f.name, error: f.error }));
        }
        fileUrls = fileResults.filter(f => f.url).map(f => f.url);
      }

      if (payload.beforeImageBase64 && payload.beforeImageFileName) {
        try {
          beforeImageUrl = saveFileToDrive_(
            payload.beforeImageBase64,
            payload.beforeImageFileName,
            payload.beforeImageMimeType,
            newId + '_before'
          );
        } catch (imgErr) {}
      }

      if (payload.afterImageBase64 && payload.afterImageFileName) {
        try {
          afterImageUrl = saveFileToDrive_(
            payload.afterImageBase64,
            payload.afterImageFileName,
            payload.afterImageMimeType,
            newId + '_after'
          );
        } catch (imgErr) {}
      }

      const lastCol = sh.getLastColumn();
      if (lastCol < 35) {
        sh.insertColumns(lastCol + 1, 35 - lastCol);
      }

      const rowData = [
        newId, dateObj, normalizeEmpId_(payload.empId), payload.name || '', normalizeDept_(payload.department || ''),
        payload.title || '',
        payload.detail || '',
        '', '', '', new Date(), categoriesJson,
        '', '',
        CONFIG.STATUS_PENDING_HEAD,
        !!categories.P, !!categories.D, !!categories.E, !!categories.S,
        !!categories.Q, !!categories.E2, !!categories.C, !!categories.M,
        '', '', '', '', beforeImageUrl, afterImageUrl,
        payload.beforeProblem || '', payload.afterSolution || '', JSON.stringify(fileUrls),
        payload.kaizenType || '',
        '', ''
      ];

      sh.appendRow(rowData);
      newRowIndex = sh.getLastRow();

      const historyData = {
        id: newId, title: payload.title, detail: payload.detail || '',
        categories: categories, beforeProblem: payload.beforeProblem, afterSolution: payload.afterSolution,
        files: fileUrls, kaizenType: payload.kaizenType
      };
      saveVersionHistory_(newId, newRowIndex, 'CREATE', null, historyData, payload.empId, payload.name);

      clearKaizenCache_();
    } finally {
      lock.releaseLock();
    }

    const recordForPdf = {
      id: newId,
      dateDisplay: toBEDateString_(dateObj),
      empId: normalizeEmpId_(payload.empId),
      name: payload.name || '',
      department: normalizeDept_(payload.department || ''),
      title: payload.title || '',
      detail: payload.detail || '',
      result: '',
      categories: categories,
      status: CONFIG.STATUS_PENDING_HEAD,
      rejectReason: '',
      reviewedBy: '',
      reviewedDate: '',
      beforeImageUrl: beforeImageUrl,
      afterImageUrl: afterImageUrl,
      beforeProblem: payload.beforeProblem || '',
      afterSolution: payload.afterSolution || '',
      fileUrls: fileUrls,
      kaizenType: payload.kaizenType || ''
    };

    let formPdfUrl = '';
    try {
      formPdfUrl = generateAndSaveKaizenPdf_(recordForPdf);
      if (formPdfUrl) {
        sh.getRange(newRowIndex, 27).setValue(formPdfUrl);
        recordForPdf.formPdfUrl = formPdfUrl;
        clearKaizenCache_();
      }
    } catch (pdfErr) {}

    try {
      sendKaizenEmail_('submitted', recordForPdf);
    } catch (mailErr) {}

    return {
      success: true,
      id: newId,
      message: 'ส่ง Kaizen เรียบร้อยแล้ว รหัส ' + newId,
      formPdfUrl: formPdfUrl || null,
      fileUrls: fileUrls,
      fileErrors: fileErrors
    };
  } catch (err) {
    return {
      success: false,
      message: 'ไม่สามารถบันทึกข้อมูลได้: ' + err.message
    };
  }
}

function generateAndSaveKaizenPdf_(record) {
  try {
    const pdfBlob = renderKaizenFormPdfBlob_(record);
    if (!pdfBlob) return '';

    const folder = getOrCreateDriveFolder_();
    const file = folder.createFile(pdfBlob);

    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (e) {}

    return file.getUrl();
  } catch (err) {
    return '';
  }
}

function renderKaizenFormPdfBlob_(record) {
  let doc = null;
  let docId = null;
  try {
    doc = DocumentApp.create('KAIZEN_' + record.id + '_' + new Date().getTime());
    docId = doc.getId();
    const body = doc.getBody();
    body.setPageWidth(841.9).setPageHeight(595.3);
    body.setMarginTop(24).setMarginBottom(24).setMarginLeft(24).setMarginRight(24);

    const title = body.appendParagraph(CONFIG.COMPANY_NAME + '   |   ฟอร์ม KAIZEN');
    title.setHeading(DocumentApp.ParagraphHeading.HEADING2).setAlignment(DocumentApp.HorizontalAlignment.CENTER);

    const catLabels = CONFIG.CATEGORIES;
    const checkedCats = Object.keys(record.categories || {})
      .filter(k => record.categories[k])
      .map(k => catLabels[k] || k);

    const kaizenTypeLabels = CONFIG.KAIZEN_TYPES;
    const kaizenTypeDisplay = record.kaizenType ? (kaizenTypeLabels[record.kaizenType] || record.kaizenType) : '-';

    const infoTable = body.appendTable([
      ['รหัส Kaizen', record.id || '-', 'วันที่ทำ', record.dateDisplay || '-'],
      ['ชื่อ-สกุล', record.name || '-', 'แผนก', record.department || '-'],
      ['หัวข้อ', record.title || '-', 'ประเภท Kaizen', kaizenTypeDisplay],
      ['หมวดหมู่', checkedCats.join(', ') || '-', '', '']
    ]);
    for (let r = 0; r < infoTable.getNumRows(); r++) {
      const row = infoTable.getRow(r);
      if (row.getNumCells() > 0) row.getCell(0).setBackgroundColor('#eff6ff');
      if (row.getNumCells() > 2) row.getCell(2).setBackgroundColor('#eff6ff');
    }

    body.appendParagraph('📈 ผลลัพธ์การปรับปรุง').setHeading(DocumentApp.ParagraphHeading.HEADING3);
    body.appendParagraph('ทำแล้วดีขึ้นอย่างไร:').setBold(true);
    body.appendParagraph(record.detail || '-');

    const imgTable = body.appendTable([['Before (ก่อนปรับปรุง)', 'After (หลังปรับปรุง)']]);
    if (imgTable.getNumRows() > 0) {
      const headerRow = imgTable.getRow(0);
      if (headerRow.getNumCells() > 0) headerRow.getCell(0).setBackgroundColor('#fef2f2');
      if (headerRow.getNumCells() > 1) headerRow.getCell(1).setBackgroundColor('#ecfdf5');
    }
    const imgRow = imgTable.appendTableRow();
    const beforeCell = imgRow.appendTableCell();
    const afterCell = imgRow.appendTableCell();

    appendImageToCell_(beforeCell, record.beforeImageUrl, 'Before');
    appendImageToCell_(afterCell, record.afterImageUrl, 'After');

    const textRow = imgTable.appendTableRow();
    const beforeTextCell = textRow.appendTableCell();
    const afterTextCell = textRow.appendTableCell();
    beforeTextCell.getChild(0).asParagraph().setText('1. Before ปัญหาที่พบ').setBold(true);
    beforeTextCell.appendParagraph(record.beforeProblem || '-');
    afterTextCell.getChild(0).asParagraph().setText('2. After แก้ไขด้วยวิธีใด').setBold(true);
    afterTextCell.appendParagraph(record.afterSolution || '-');

    if (record.fileUrls && record.fileUrls.length > 0) {
      body.appendParagraph('📎 เอกสารแนบ').setBold(true);
      record.fileUrls.forEach(function (url, idx) {
        const fileName = url.split('/').pop().split('?')[0] || 'ไฟล์แนบ_' + (idx + 1);
        body.appendParagraph((idx + 1) + '. ' + fileName);
      });
    }

    const isApproved = record.status === CONFIG.STATUS_APPROVED;
    const isRejected = record.status === CONFIG.STATUS_REJECTED;
    const isPendingHead = record.status === CONFIG.STATUS_PENDING_HEAD;
    const isPendingDirector = record.status === CONFIG.STATUS_PENDING_DIRECTOR;
    let statusText = '⏳ รอตรวจสอบ';
    if (isApproved) statusText = '✅ อนุมัติ';
    else if (isRejected) statusText = '❌ ไม่อนุมัติ (ตีกลับ)';
    else if (isPendingHead) statusText = '⏳ รอหัวหน้าแผนกตรวจ';
    else if (isPendingDirector) statusText = '⏳ รอผู้จัดการตรวจ';

    const reviewTable = body.appendTable([
      ['สถานะ', statusText, 'ผู้ตรวจสอบ', record.reviewedBy || '-'],
      ['วันที่ตรวจ', record.reviewedDate || '-', 'เหตุผล (ถ้ามี)', record.rejectReason || '-']
    ]);
    for (let r = 0; r < reviewTable.getNumRows(); r++) {
      const row = reviewTable.getRow(r);
      if (row.getNumCells() > 0) row.getCell(0).setBackgroundColor('#f8fafc');
      if (row.getNumCells() > 2) row.getCell(2).setBackgroundColor('#f8fafc');
    }

    const footer = body.appendParagraph(CONFIG.FORM_CODE);
    footer.setFontSize(8).editAsText().setForegroundColor('#94a3b8');

    doc.saveAndClose();
    const pdfBlob = DriveApp.getFileById(docId).getAs(MimeType.PDF).setName('Kaizen_' + record.id + '.pdf');
    
    try {
      DriveApp.getFileById(docId).setTrashed(true);
    } catch (e) {}
    
    return pdfBlob;
  } catch (err) {
    console.error('renderKaizenFormPdfBlob_ error:', err);
    try {
      if (docId) DriveApp.getFileById(docId).setTrashed(true);
    } catch (e2) {}
    return null;
  }
}

function appendImageToCell_(cell, imageUrl, label) {
  while (cell.getNumChildren() > 0) {
    cell.removeChild(cell.getChild(0));
  }

  if (!imageUrl) {
    cell.editAsText().setText('(ไม่มีรูปภาพแนบ)');
    return;
  }

  try {
    const fileId = extractDriveFileIdFromUrl_(imageUrl);
    if (!fileId) {
      cell.editAsText().setText('(ไม่พบ ID รูปภาพ)');
      return;
    }

    const file = DriveApp.getFileById(fileId);
    const blob = file.getBlob();

    const mimeType = blob.getContentType();
    if (!mimeType || !mimeType.startsWith('image/')) {
      cell.editAsText().setText('(ไฟล์ไม่ใช่รูปภาพ: ' + mimeType + ')');
      return;
    }

    const img = cell.appendImage(blob);
    const maxWidth = 340;
    const maxHeight = 200;

    let width = img.getWidth();
    let height = img.getHeight();

    if (width > maxWidth) {
      const ratio = maxWidth / width;
      width = maxWidth;
      height = height * ratio;
    }
    if (height > maxHeight) {
      const ratio = maxHeight / height;
      height = maxHeight;
      width = width * ratio;
    }

    img.setWidth(width);
    img.setHeight(height);
  } catch (e) {
    cell.editAsText().setText('(ไม่สามารถโหลดรูปภาพได้)');
  }
}

function getEmployeeEmailById_(empId) {
  try {
    const employees = getEmployees();
    const emp = employees.find(e => e.empId === normalizeEmpId_(empId));
    return emp ? (emp.email || '') : '';
  } catch (e) {
    return '';
  }
}

function getPersonEmailById_(id) {
  try {
    const idStr = String(id || '').trim();
    if (!idStr) return '';

    const empEmail = getEmployeeEmailById_(idStr);
    if (empEmail) return empEmail;

    const managerResult = getManagers();
    const managers = managerResult.success ? managerResult.managers : [];
    const mgr = managers.find(m => String(m.id || '').trim() === idStr);
    return mgr ? (mgr.email || '') : '';
  } catch (e) {
    return '';
  }
}

function getReviewerEmailsForDepartment_(department) {
  try {
    const managerResult = getManagers();
    const managers = managerResult.success ? managerResult.managers : [];
    const emails = [];
    const targetDept = normalizeDept_(department);

    managers.forEach(function (m) {
      const isDirector = (m.approverType || []).indexOf('ผู้จัดการ') > -1;
      const isDeptHead = (m.approverType || []).indexOf('หัวหน้าแผนก') > -1 &&
        normalizeDept_(m.department) === targetDept;

      if ((isDirector || isDeptHead) && m.email) {
        emails.push(m.email);
      }
    });

    return emails.filter((e, idx) => emails.indexOf(e) === idx);
  } catch (e) {
    return [];
  }
}

function isValidEmail_(email) {
  if (!email) return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).trim());
}

function ensureEmailLogSheet_() {
  const ss = getSS_();
  let sh = ss.getSheetByName('EmailLog');
  if (!sh) {
    sh = ss.insertSheet('EmailLog');
  }
  if (sh.getLastRow() === 0) {
    sh.appendRow(['Timestamp', 'Type', 'KaizenID', 'Recipients', 'Status', 'ErrorMessage']);
  }
  return sh;
}

function logEmailAttempt_(type, kaizenId, recipients, status, errorMessage) {
  try {
    const sh = ensureEmailLogSheet_();
    sh.appendRow([
      new Date(),
      type || '',
      kaizenId || '',
      (recipients || []).join(', '),
      status || '',
      errorMessage || ''
    ]);
    const lastRow = sh.getLastRow();
    if (lastRow > 2000) {
      sh.deleteRows(2, lastRow - 2000);
    }
  } catch (e) {
    Logger.log('logEmailAttempt_ error: ' + e.message);
  }
}

function getEmployeeEmailWithFallback_(empId) {
  const id = normalizeEmpId_(empId);
  if (!id) return '';

  const email = getEmployeeEmailById_(id);
  if (isValidEmail_(email)) return email.trim();

  try {
    const managerResult = getManagers();
    const managers = managerResult.success ? managerResult.managers : [];
    const mgr = managers.find(m => String(m.id || '').trim() === id);
    if (mgr && isValidEmail_(mgr.email)) return mgr.email.trim();
  } catch (e) {}

  return '';
}

function sendKaizenEmail_(type, record) {
  if (!CONFIG.EMAIL_ENABLED) return;

  let toList = [];
  let subject = '';
  let htmlBody = '';
  let noRecipientReason = '';

  if (type === 'submitted' || type === 'resubmitted') {
    const managerResult = getManagers();
    const managers = managerResult.success ? managerResult.managers : [];

    const headManagers = managers.filter(m => {
      const approverTypes = m.approverType || [];
      return approverTypes.indexOf('หัวหน้าแผนก') > -1;
    });
    
    toList = headManagers.map(m => m.email).filter(isValidEmail_).filter((e, idx, arr) => arr.indexOf(e) === idx);
    subject = (type === 'submitted' ? '[Kaizen ใหม่] ' : '[Kaizen ส่งใหม่] ') + record.id + ' - ' + record.title;
    htmlBody = buildKaizenEmailHtml_(type, record);
    noRecipientReason = 'ไม่พบอีเมลของ "หัวหน้าแผนก" ในชีต Managers';
    
  } else if (type === 'head_approved') {
    const managerResult = getManagers();
    const managers = managerResult.success ? managerResult.managers : [];
    
    const directorManagers = managers.filter(m => {
      const approverTypes = m.approverType || [];
      return approverTypes.indexOf('ผู้จัดการ') > -1;
    });
    
    toList = directorManagers.map(m => m.email).filter(isValidEmail_).filter((e, idx, arr) => arr.indexOf(e) === idx);
    subject = '[Kaizen รอผู้จัดการตรวจ] ' + record.id + ' - ' + record.title;
    htmlBody = buildKaizenEmailHtml_('head_approved', record);
    noRecipientReason = 'ไม่พบอีเมลของ "ผู้จัดการ" ในชีต Managers';
    
  } else if (type === 'approved' || type === 'rejected') {
    const empEmail = getEmployeeEmailWithFallback_(record.empId);
    if (isValidEmail_(empEmail)) toList = [empEmail];
    subject = (type === 'approved' ? '[Kaizen ผ่านการอนุมัติ] ' : '[Kaizen ถูกตีกลับ] ') + record.id + ' - ' + record.title;
    htmlBody = buildKaizenEmailHtml_(type, record);
    noRecipientReason = 'ไม่พบอีเมลของพนักงาน (EmpID: ' + record.empId + ')';
  }

  if (!toList || toList.length === 0) {
    Logger.log('sendKaizenEmail_: No recipients for type ' + type + ', record ' + record.id + ' -> ' + noRecipientReason);
    logEmailAttempt_(type, record.id, [], 'NO_RECIPIENTS', noRecipientReason);
    return;
  }

  const options = {
    htmlBody: htmlBody,
    name: CONFIG.EMAIL_SENDER_NAME
  };

  if (CONFIG.EMAIL_CC) options.cc = CONFIG.EMAIL_CC;

  if (record.formPdfUrl) {
    try {
      const fileId = extractDriveFileIdFromUrl_(record.formPdfUrl);
      if (fileId) {
        const file = DriveApp.getFileById(fileId);
        options.attachments = [file.getBlob()];
      }
    } catch (e) {}
  }

  try {
    MailApp.sendEmail(toList.join(','), subject, 'กรุณาเปิดอีเมลนี้ด้วยโปรแกรมที่รองรับ HTML', options);
    logEmailAttempt_(type, record.id, toList, 'SENT', '');
  } catch (mailErr) {
    Logger.log('sendKaizenEmail_ error: ' + mailErr.message);
    logEmailAttempt_(type, record.id, toList, 'FAILED', mailErr.message);
  }
}

function buildKaizenEmailHtml_(type, record) {
  const appUrl = getAppUrl_();
  const catLabels = CONFIG.CATEGORIES;
  const cats = Object.keys(record.categories || {}).filter(k => record.categories[k]).map(k => catLabels[k] || k).join(', ') || '-';

  const kaizenTypeLabels = CONFIG.KAIZEN_TYPES;
  const kaizenTypeDisplay = record.kaizenType ? (kaizenTypeLabels[record.kaizenType] || record.kaizenType) : '-';

  let headline = '', color = '#3b82f6', intro = '';
  if (type === 'submitted') { headline = '📝 มี Kaizen ใหม่รอตรวจสอบ'; color = '#3b82f6'; intro = 'พนักงาน ' + record.name + ' ได้ส่ง Kaizen ใหม่ กรุณาเข้าสู่ระบบเพื่อตรวจสอบ'; }
  else if (type === 'resubmitted') { headline = '🔄 มี Kaizen ที่ถูกแก้ไขและส่งใหม่'; color = '#8b5cf6'; intro = 'พนักงาน ' + record.name + ' ได้แก้ไขและส่ง Kaizen นี้ใหม่อีกครั้ง'; }
  else if (type === 'head_approved') { headline = '👔 หัวหน้าแผนกอนุมัติแล้ว รอผู้จัดการตรวจสอบ'; color = '#f59e0b'; intro = 'หัวหน้าแผนก ' + record.reviewedBy + ' ได้อนุมัติ Kaizen นี้แล้ว กรุณาตรวจสอบและอนุมัติขั้นสุดท้าย'; }
  else if (type === 'approved') { headline = '✅ Kaizen ของคุณได้รับการอนุมัติแล้ว'; color = '#10b981'; intro = 'ยินดีด้วย! Kaizen ของคุณผ่านการตรวจสอบและอนุมัติเรียบร้อยแล้ว โดย ' + record.reviewedBy; }
  else if (type === 'rejected') { headline = '❌ Kaizen ของคุณถูกตีกลับ'; color = '#ef4444'; intro = 'Kaizen ของคุณถูกตีกลับโดย ' + record.reviewedBy + ' กรุณาแก้ไขและส่งใหม่อีกครั้งในระบบ'; }

  let html = '';
  html += '<div style="font-family:Sarabun,Tahoma,sans-serif;max-width:560px;margin:0 auto;background:#f0f7ff;padding:24px;">';
  html += '<div style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(59,130,246,0.1);">';
  html += '<div style="background:linear-gradient(135deg,' + color + ',' + color + 'cc);padding:20px 24px;color:#fff;">';
  html += '<p style="margin:0;font-size:13px;opacity:0.85;">ระบบบันทึก Kaizen · ' + escapeHtmlServer_(CONFIG.COMPANY_NAME) + '</p>';
  html += '<h2 style="margin:6px 0 0;font-size:19px;">' + headline + '</h2>';
  html += '</div>';
  html += '<div style="padding:20px 24px;color:#334155;font-size:14px;line-height:1.7;">';
  html += '<p>' + escapeHtmlServer_(intro) + '</p>';
  html += '<div style="background:#f8faff;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;margin:16px 0;">';
  html += '<p style="margin:4px 0;"><b>รหัส:</b> ' + escapeHtmlServer_(record.id) + '</p>';
  html += '<p style="margin:4px 0;"><b>หัวข้อ:</b> ' + escapeHtmlServer_(record.title) + '</p>';
  html += '<p style="margin:4px 0;"><b>ประเภท:</b> ' + escapeHtmlServer_(kaizenTypeDisplay) + '</p>';
  html += '<p style="margin:4px 0;"><b>พนักงาน:</b> ' + escapeHtmlServer_(record.name) + ' (' + escapeHtmlServer_(record.department) + ')</p>';
  html += '<p style="margin:4px 0;"><b>วันที่:</b> ' + escapeHtmlServer_(record.dateDisplay) + '</p>';
  html += '<p style="margin:4px 0;"><b>หมวดหมู่:</b> ' + escapeHtmlServer_(cats) + '</p>';
  if (type === 'rejected' && record.rejectReason) html += '<p style="margin:4px 0;color:#ef4444;"><b>เหตุผลที่ตีกลับ:</b> ' + escapeHtmlServer_(record.rejectReason) + '</p>';
  html += '</div>';
  if (appUrl && appUrl !== '#') {
    html += '<a href="' + appUrl + '" style="display:inline-block;background:' + color + ';color:#fff;text-decoration:none;padding:10px 22px;border-radius:10px;font-weight:600;">เปิดระบบ Kaizen</a>';
  }
  html += '<p style="margin-top:20px;font-size:12px;color:#94a3b8;">อีเมลนี้ส่งโดยอัตโนมัติจากระบบบันทึก Kaizen</p>';
  html += '</div></div></div>';
  return html;
}

function sendCommentEmail_(record, comment, userName, authorId) {
  if (!CONFIG.EMAIL_ENABLED) return;
  const authorEmail = authorId ? getPersonEmailById_(authorId) : '';

  const toList = [];
  const empEmail = getEmployeeEmailById_(record.empId);
  if (empEmail && empEmail !== authorEmail) toList.push(empEmail);

  const reviewerEmails = getReviewerEmailsForDepartment_(record.department);
  reviewerEmails.forEach(function (email) {
    if (email && email !== authorEmail && toList.indexOf(email) === -1) toList.push(email);
  });

  if (toList.length === 0) return;

  const appUrl = getAppUrl_();
  const htmlBody = `
    <div style="font-family:Sarabun,Tahoma,sans-serif;max-width:560px;margin:0 auto;background:#f0f7ff;padding:24px;">
      <div style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(59,130,246,0.1);">
        <div style="background:linear-gradient(135deg,#1a56db,#1e40af);padding:20px 24px;color:#fff;">
          <h2 style="margin:0;font-size:18px;">💬 มีความคิดเห็นใหม่ใน Kaizen</h2>
        </div>
        <div style="padding:20px 24px;color:#334155;font-size:14px;line-height:1.7;">
          <p><b>${escapeHtmlServer_(userName)}</b> ได้แสดงความคิดเห็น:</p>
          <div style="background:#f8faff;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;margin:12px 0;">
            <p style="margin:0;">${escapeHtmlServer_(comment)}</p>
          </div>
          <div style="background:#f1f5f9;border-radius:12px;padding:12px 16px;margin:12px 0;">
            <p style="margin:2px 0;"><b>รหัส:</b> ${escapeHtmlServer_(record.id)}</p>
            <p style="margin:2px 0;"><b>หัวข้อ:</b> ${escapeHtmlServer_(record.title)}</p>
            <p style="margin:2px 0;"><b>พนักงาน:</b> ${escapeHtmlServer_(record.name)}</p>
          </div>
          ${appUrl && appUrl !== '#' ? `<a href="${appUrl}" style="display:inline-block;background:#1a56db;color:#fff;text-decoration:none;padding:10px 22px;border-radius:10px;font-weight:600;">เข้าสู่ระบบ</a>` : ''}
          <p style="margin-top:20px;font-size:12px;color:#94a3b8;">อีเมลนี้ส่งโดยอัตโนมัติจากระบบบันทึก Kaizen</p>
        </div>
      </div>
    </div>
  `;

  const options = { htmlBody: htmlBody, name: CONFIG.EMAIL_SENDER_NAME };
  if (CONFIG.EMAIL_CC) options.cc = CONFIG.EMAIL_CC;

  try {
    MailApp.sendEmail(toList.join(','), '[ความคิดเห็น] ' + record.id + ' - ' + record.title,
      'มีความคิดเห็นใหม่ใน Kaizen นี้', options);
  } catch (e) {}
}

function addComment(payload) {
  try {
    const { kaizenId, comment, userId, userName } = payload;
    if (!kaizenId) throw new Error('กรุณาระบุ Kaizen ID');
    if (!comment || !comment.trim()) throw new Error('กรุณากรอกความคิดเห็น');

    const ss = getSS_();
    let commentSheet = ss.getSheetByName(CONFIG.COMMENT_SHEET);
    if (!commentSheet) {
      commentSheet = ss.insertSheet(CONFIG.COMMENT_SHEET);
    }

    if (commentSheet.getLastRow() === 0) {
      commentSheet.appendRow([
        'ID', 'KaizenID', 'Comment', 'UserId', 'UserName', 'Timestamp'
      ]);
    }

    const commentId = 'C' + Utilities.getUuid().substring(0, 8);
    commentSheet.appendRow([
      commentId,
      kaizenId,
      comment.trim(),
      userId || '',
      userName || 'Anonymous',
      new Date()
    ]);

    try {
      const record = getKaizenRecordById_(kaizenId);
      if (record) {
        sendCommentEmail_(record, comment.trim(), userName, userId);
      }
    } catch (e) {}

    return { success: true, commentId: commentId, message: 'เพิ่มความคิดเห็นสำเร็จ' };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function getComments(kaizenId) {
  try {
    if (!kaizenId) return { success: true, comments: [] };

    const ss = getSS_();
    const commentSheet = ss.getSheetByName(CONFIG.COMMENT_SHEET);
    if (!commentSheet) return { success: true, comments: [] };

    const data = commentSheet.getDataRange().getValues();
    const comments = [];

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][1]) === String(kaizenId)) {
        comments.push({
          id: data[i][0] || '',
          comment: data[i][2] || '',
          userId: data[i][3] || '',
          userName: data[i][4] || 'Anonymous',
          timestamp: data[i][5] ? new Date(data[i][5]) : null
        });
      }
    }

    comments.sort((a, b) => {
      const ta = a.timestamp ? a.timestamp.getTime() : 0;
      const tb = b.timestamp ? b.timestamp.getTime() : 0;
      return tb - ta;
    });

    return { success: true, comments: comments };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function deleteComment(payload) {
  try {
    const { commentId, userId } = payload;
    if (!commentId) throw new Error('กรุณาระบุ ID ความคิดเห็น');

    const ss = getSS_();
    const commentSheet = ss.getSheetByName(CONFIG.COMMENT_SHEET);
    if (!commentSheet) throw new Error('ไม่พบชีต Comments');

    const data = commentSheet.getDataRange().getValues();
    let rowToDelete = -1;

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === commentId) {
        if (userId && data[i][3] !== userId) {
          throw new Error('ไม่มีสิทธิ์ลบความคิดเห็นนี้');
        }
        rowToDelete = i + 1;
        break;
      }
    }

    if (rowToDelete === -1) throw new Error('ไม่พบความคิดเห็นนี้');
    commentSheet.deleteRow(rowToDelete);

    return { success: true, message: 'ลบความคิดเห็นสำเร็จ' };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function identifyUser(role, id) {
  try {
    const idStr = String(id || '').trim();
    if (!idStr) throw new Error('กรุณากรอกรหัสของคุณ');

    const roleStr = String(role || '').trim().toLowerCase();
    if (roleStr !== 'employee' && roleStr !== 'manager') {
      throw new Error('กรุณาเลือกประเภทผู้ใช้งาน');
    }

    let profile;
    if (roleStr === 'employee') {
      const employees = getEmployees();
      profile = employees.find(e => e.empId === normalizeEmpId_(idStr));
      if (!profile) throw new Error('ไม่พบรหัสพนักงาน ' + idStr + ' ในระบบ');
      if (profile.department) profile.department = normalizeDept_(profile.department);
    } else {
      const managerResult = getManagers();
      const managers = managerResult.success ? managerResult.managers : [];
      
      profile = managers.find(m =>
        String(m.id || '').trim() === idStr || 
        String(m.email || '').trim() === idStr
      );
      
      if (!profile) {
        throw new Error('ไม่พบรหัสหัวหน้างาน ' + idStr + ' ในระบบ กรุณาตรวจสอบข้อมูลในชีต Managers');
      }
    }

    return { success: true, role: roleStr, profile: profile };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

function getMyRecords(empId) {
  try {
    assertConfig_();
    const id = normalizeEmpId_(empId);
    if (!id) throw new Error('ไม่พบรหัสพนักงาน');
    const allRecords = getKaizenRecords();
    const records = allRecords.filter(r => r.empId === id);
    return { success: true, records: records };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

function getReviewQueue(reviewerId, options) {
  try {
    assertConfig_();
    const reviewerIdStr = String(reviewerId || '').trim();
    if (!reviewerIdStr) throw new Error('ไม่พบสิทธิ์ผู้ตรวจสอบ');

    const managerResult = getManagers();
    let reviewer = null;
    
    if (managerResult.success) {
      reviewer = managerResult.managers.find(m => 
        String(m.id || '').trim() === reviewerIdStr || 
        String(m.email || '').trim() === reviewerIdStr
      );
    }
    
    if (!reviewer) {
      throw new Error('ไม่พบสิทธิ์ผู้ตรวจสอบ กรุณาตรวจสอบข้อมูลในชีต Managers');
    }

    const allRecords = getKaizenRecords();
    const isDirector = (reviewer.approverType || []).indexOf('ผู้จัดการ') > -1;
    const isHead = (reviewer.approverType || []).indexOf('หัวหน้าแผนก') > -1;

    options = options || {};
    const keyword = String(options.keyword || '').trim().toLowerCase();

    let scope = String(options.scope || '').trim().toLowerCase();
    if (scope !== 'mine' && scope !== 'all') {
      scope = isDirector ? 'all' : 'mine';
    }

    let records = allRecords.slice();

    if (keyword) {
      records = records.filter(function (r) {
        return (r.empId || '').toLowerCase().indexOf(keyword) > -1 ||
          (r.name || '').toLowerCase().indexOf(keyword) > -1 ||
          (r.id || '').toLowerCase().indexOf(keyword) > -1 ||
          (r.title || '').toLowerCase().indexOf(keyword) > -1;
      });
    } else if (scope !== 'all') {
      const reviewerDept = normalizeDept_(reviewer.department);
      records = records.filter(function (r) {
        return normalizeDept_(r.department) === reviewerDept;
      });
    }

    records.sort((a, b) => {
      const aActionable = (isHead && a.status === CONFIG.STATUS_PENDING_HEAD) || (isDirector && a.status === CONFIG.STATUS_PENDING_DIRECTOR);
      const bActionable = (isHead && b.status === CONFIG.STATUS_PENDING_HEAD) || (isDirector && b.status === CONFIG.STATUS_PENDING_DIRECTOR);
      if (aActionable !== bActionable) return aActionable ? -1 : 1;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return b.date.localeCompare(a.date);
    });

    return { success: true, reviewer: reviewer, scope: scope, keyword: keyword, records: records };
  } catch (err) {
    console.error('getReviewQueue error:', err);
    return { success: false, message: err.message };
  }
}

function addKaizenRecord(payload) {
  payload.files = payload.files || [];
  return addKaizenRecordWithMultipleFiles(payload);
}

function resubmitKaizenRecord(payload) {
  try {
    assertConfig_();
    let rowIndex = Number(payload.rowIndex);
    const kaizenId = payload.id || payload.kaizenId;

    if (!payload.title) throw new Error('กรุณากรอกหัวข้อ Kaizen');
    if (!payload.kaizenType) throw new Error('กรุณาเลือกประเภท Kaizen');

    const categories = payload.categories || {};
    const categoriesJson = JSON.stringify(categories);

    let sh, idCell, fileUrls = [], beforeImageUrl = '', afterImageUrl = '', fileErrors = [];

    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      sh = getSheet_(CONFIG.DATA_SHEET);
      if (kaizenId) {
        const resolved = findRowByKaizenId_(sh, kaizenId, rowIndex);
        if (resolved > 1) rowIndex = resolved;
      }

      if (!rowIndex || rowIndex < 2 || rowIndex > sh.getLastRow()) {
        throw new Error('ไม่พบรายการที่ต้องการแก้ไข');
      }

      const ownerEmpId = normalizeEmpId_(sh.getRange(rowIndex, 3).getValue());
      if (payload.empId && ownerEmpId !== normalizeEmpId_(payload.empId)) {
        throw new Error('ไม่มีสิทธิ์แก้ไขรายการนี้');
      }

      idCell = sh.getRange(rowIndex, 1).getValue();
      const oldData = getKaizenRecordById_(idCell);

      sh.getRange(rowIndex, 6).setValue(payload.title || '');
      sh.getRange(rowIndex, 7).setValue(payload.detail || '');
      sh.getRange(rowIndex, 30, 1, 2).setValues([[payload.beforeProblem || '', payload.afterSolution || '']]);
      sh.getRange(rowIndex, 12).setValue(categoriesJson);
      sh.getRange(rowIndex, 15).setValue(CONFIG.STATUS_PENDING_HEAD);
      sh.getRange(rowIndex, 16, 1, 8).setValues([[
        !!categories.P, !!categories.D, !!categories.E, !!categories.S,
        !!categories.Q, !!categories.E2, !!categories.C, !!categories.M
      ]]);
      sh.getRange(rowIndex, 24, 1, 3).setValues([['', '', '']]);
      sh.getRange(rowIndex, 34, 1, 2).setValues([['', '']]);
      sh.getRange(rowIndex, 33).setValue(payload.kaizenType || '');

      if (Array.isArray(payload.existingFileUrls)) {
        fileUrls = payload.existingFileUrls.filter(Boolean);
      } else {
        try {
          const existingFileUrlsRaw = sh.getRange(rowIndex, 32).getValue();
          if (existingFileUrlsRaw) {
            const parsed = JSON.parse(existingFileUrlsRaw);
            if (Array.isArray(parsed)) fileUrls = parsed;
          }
        } catch (e) {
          fileUrls = [];
        }
      }

      if (payload.files && payload.files.length > 0) {
        const fileResults = saveMultipleFilesToDrive_(payload.files, idCell, fileUrls.length);
        const failedFiles = fileResults.filter(f => f.error);
        if (failedFiles.length > 0) {
          fileErrors = failedFiles.map(f => ({ name: f.name, error: f.error }));
        }
        const newFileUrls = fileResults.filter(f => f.url).map(f => f.url);
        fileUrls = fileUrls.concat(newFileUrls);
      }

      sh.getRange(rowIndex, 32).setValue(JSON.stringify(fileUrls));

      beforeImageUrl = sh.getRange(rowIndex, 28).getValue() || '';
      if (payload.beforeImageBase64 && payload.beforeImageFileName) {
        try {
          beforeImageUrl = saveFileToDrive_(payload.beforeImageBase64, payload.beforeImageFileName, payload.beforeImageMimeType, idCell + '_before');
          sh.getRange(rowIndex, 28).setValue(beforeImageUrl);
        } catch (imgErr) {}
      }

      afterImageUrl = sh.getRange(rowIndex, 29).getValue() || '';
      if (payload.afterImageBase64 && payload.afterImageFileName) {
        try {
          afterImageUrl = saveFileToDrive_(payload.afterImageBase64, payload.afterImageFileName, payload.afterImageMimeType, idCell + '_after');
          sh.getRange(rowIndex, 29).setValue(afterImageUrl);
        } catch (imgErr) {}
      }

      const newData = {
        id: idCell, title: payload.title, detail: payload.detail || '',
        categories: categories, beforeProblem: payload.beforeProblem, afterSolution: payload.afterSolution,
        files: fileUrls, kaizenType: payload.kaizenType
      };
      saveVersionHistory_(idCell, rowIndex, 'RESUBMIT', oldData, newData, payload.empId, payload.name);

      clearKaizenCache_();
    } finally {
      lock.releaseLock();
    }

    const recordForPdf = {
      id: idCell,
      dateDisplay: toBEDateString_(sh.getRange(rowIndex, 2).getValue()),
      empId: normalizeEmpId_(payload.empId),
      name: sh.getRange(rowIndex, 4).getValue() || '',
      department: normalizeDept_(sh.getRange(rowIndex, 5).getValue() || ''),
      title: payload.title || '',
      detail: payload.detail || '',
      result: '',
      categories: categories,
      status: CONFIG.STATUS_PENDING_HEAD,
      rejectReason: '',
      reviewedBy: '',
      reviewedDate: '',
      beforeImageUrl: beforeImageUrl,
      afterImageUrl: afterImageUrl,
      beforeProblem: payload.beforeProblem || '',
      afterSolution: payload.afterSolution || '',
      fileUrls: fileUrls,
      kaizenType: payload.kaizenType || ''
    };

    let formPdfUrl = '';
    try {
      formPdfUrl = generateAndSaveKaizenPdf_(recordForPdf);
      if (formPdfUrl) {
        sh.getRange(rowIndex, 27).setValue(formPdfUrl);
        recordForPdf.formPdfUrl = formPdfUrl;
        clearKaizenCache_();
      }
    } catch (pdfErr) {}

    try {
      sendKaizenEmail_('resubmitted', recordForPdf);
    } catch (mailErr) {}

    return {
      success: true,
      message: 'ส่งข้อมูลใหม่เรียบร้อยแล้ว รอหัวหน้าตรวจสอบอีกครั้ง',
      formPdfUrl: formPdfUrl || null,
      fileUrls: fileUrls,
      fileErrors: fileErrors
    };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

function reviewKaizenRecord(payload) {
  try {
    assertConfig_();
    let rowIndex = Number(payload.rowIndex);
    const kaizenId = payload.id || payload.kaizenId;

    const decision = payload.decision;
    if (decision !== 'approve' && decision !== 'reject') throw new Error('decision ไม่ถูกต้อง');
    if (decision === 'reject' && !String(payload.reason || '').trim()) {
      throw new Error('กรุณาระบุเหตุผลในการตีกลับ');
    }

    let sh, reviewer, status, reason, reviewedDate, rowVals, categories, fileUrls, currentStatus;

    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      const managerResult = getManagers();
      let reviewerFound = null;
      
      if (managerResult.success) {
        reviewerFound = managerResult.managers.find(m => 
          String(m.id || '').trim() === String(payload.reviewerId || '').trim()
        );
      }
      
      if (!reviewerFound) {
        throw new Error('ไม่พบสิทธิ์ผู้ตรวจสอบ กรุณาตรวจสอบข้อมูลในชีต Managers');
      }
      reviewer = reviewerFound;

      sh = getSheet_(CONFIG.DATA_SHEET);
      if (kaizenId) {
        const resolved = findRowByKaizenId_(sh, kaizenId, rowIndex);
        if (resolved > 1) rowIndex = resolved;
      }

      if (!rowIndex || rowIndex < 2 || rowIndex > sh.getLastRow()) {
        throw new Error('ไม่พบแถวที่ต้องการตรวจ');
      }

      const reviewerApproverTypes = reviewer.approverType || [];
      const isDirector = reviewerApproverTypes.indexOf('ผู้จัดการ') > -1;
      const isHead = reviewerApproverTypes.indexOf('หัวหน้าแผนก') > -1;

      rowVals = sh.getRange(rowIndex, 1, 1, 35).getValues()[0];
      currentStatus = String(rowVals[14] || '').trim();

      const canActAsHead = isHead && currentStatus === CONFIG.STATUS_PENDING_HEAD;
      const canActAsDirector = isDirector && currentStatus === CONFIG.STATUS_PENDING_DIRECTOR;

      if (!canActAsHead && !canActAsDirector) {
        if (currentStatus === CONFIG.STATUS_PENDING_DIRECTOR) {
          throw new Error('รายการนี้รอผู้จัดการตรวจ ต้องเป็นผู้จัดการจึงจะตรวจได้');
        } else if (currentStatus === CONFIG.STATUS_PENDING_HEAD) {
          throw new Error('รายการนี้รอหัวหน้าแผนกตรวจ ต้องผ่านการตรวจจากหัวหน้าแผนกก่อน');
        } else {
          throw new Error('รายการนี้อยู่ในสถานะ "' + currentStatus + '" ไม่สามารถตรวจซ้ำได้');
        }
      }

      const oldData = getKaizenRecordById_(rowVals[0]);
      
      if (decision === 'reject') {
        status = CONFIG.STATUS_REJECTED;
        reason = String(payload.reason || '').trim();
        reviewedDate = new Date();
        sh.getRange(rowIndex, 15).setValue(status);
        sh.getRange(rowIndex, 24, 1, 3).setValues([[reason, reviewer.name, reviewedDate]]);
        
        const newData = {
          id: rowVals[0], 
          status: status, 
          rejectReason: reason,
          reviewedBy: reviewer.name, 
          reviewedDate: reviewedDate
        };
        saveVersionHistory_(rowVals[0], rowIndex, 'REJECT', oldData, newData, reviewer.id, reviewer.name);
        
      } else {
        reviewedDate = new Date();
        
        if (canActAsHead) {
          status = CONFIG.STATUS_PENDING_DIRECTOR;
          reason = '';
          sh.getRange(rowIndex, 15).setValue(status);
          sh.getRange(rowIndex, 34, 1, 2).setValues([[reviewer.name, reviewedDate]]);
          
          const newData = {
            id: rowVals[0], 
            status: status,
            reviewedBy: reviewer.name, 
            reviewedDate: reviewedDate,
            headApprover: reviewer.name,
            headApprovedDate: reviewedDate
          };
          saveVersionHistory_(rowVals[0], rowIndex, 'HEAD_APPROVE', oldData, newData, reviewer.id, reviewer.name);
          
        } else if (canActAsDirector) {
          status = CONFIG.STATUS_APPROVED;
          reason = '';
          sh.getRange(rowIndex, 15).setValue(status);
          sh.getRange(rowIndex, 24, 1, 3).setValues([[reason, reviewer.name, reviewedDate]]);
          
          const newData = {
            id: rowVals[0], 
            status: status,
            reviewedBy: reviewer.name, 
            reviewedDate: reviewedDate
          };
          saveVersionHistory_(rowVals[0], rowIndex, 'DIRECTOR_APPROVE', oldData, newData, reviewer.id, reviewer.name);
        }
      }

      rowVals = sh.getRange(rowIndex, 1, 1, 35).getValues()[0];
      
      categories = {};
      try { categories = rowVals[11] ? JSON.parse(rowVals[11]) : {}; } catch (e) { categories = {}; }
      fileUrls = [];
      if (rowVals[31]) {
        try { fileUrls = JSON.parse(rowVals[31]); if (!Array.isArray(fileUrls)) fileUrls = []; } catch (e) { fileUrls = []; }
      }

      clearKaizenCache_();
    } finally {
      lock.releaseLock();
    }

    const recordForPdf = {
      id: rowVals[0],
      dateDisplay: toBEDateString_(rowVals[1]),
      empId: normalizeEmpId_(rowVals[2]),
      name: rowVals[3] || '',
      department: normalizeDept_(rowVals[4] || ''),
      title: rowVals[5] || '',
      detail: rowVals[6] || '',
      result: rowVals[7] || '',
      categories: categories,
      status: status,
      rejectReason: reason || '',
      reviewedBy: reviewer.name,
      reviewedDate: toBEDateString_(reviewedDate),
      beforeImageUrl: rowVals[27] || '',
      afterImageUrl: rowVals[28] || '',
      beforeProblem: rowVals[29] || '',
      afterSolution: rowVals[30] || '',
      fileUrls: fileUrls,
      kaizenType: rowVals[32] || ''
    };

    let formPdfUrl = '';
    try {
      formPdfUrl = generateAndSaveKaizenPdf_(recordForPdf);
      if (formPdfUrl) {
        sh.getRange(rowIndex, 27).setValue(formPdfUrl);
        recordForPdf.formPdfUrl = formPdfUrl;
        clearKaizenCache_();
      }
    } catch (pdfErr) {}

    if (decision === 'reject') {
      try { sendKaizenEmail_('rejected', recordForPdf); } catch (mailErr) {}
    } else {
      if (status === CONFIG.STATUS_APPROVED) {
        try { sendKaizenEmail_('approved', recordForPdf); } catch (mailErr) {}
      } else if (status === CONFIG.STATUS_PENDING_DIRECTOR) {
        try { sendKaizenEmail_('head_approved', recordForPdf); } catch (mailErr) {}
      }
    }

    let message = '';
    if (decision === 'reject') {
      message = 'ตีกลับรายการเรียบร้อยแล้ว';
    } else {
      if (status === CONFIG.STATUS_APPROVED) {
        message = 'อนุมัติรายการเรียบร้อยแล้ว';
      } else if (status === CONFIG.STATUS_PENDING_DIRECTOR) {
        message = 'ส่งต่อให้ผู้จัดการตรวจสอบเรียบร้อยแล้ว';
      }
    }

    return {
      success: true,
      message: message,
      status: status
    };
  } catch (err) {
    console.error('reviewKaizenRecord error:', err);
    return { success: false, message: err.message };
  }
}

function addKaizenRecordByManager(payload) {
  try {
    assertConfig_();
    payload = payload || {};

    if (!payload.reviewerId) throw new Error('ไม่พบสิทธิ์ผู้บันทึกแทนพนักงาน');
    if (!payload.empId || !payload.title) {
      throw new Error('กรุณาเลือกพนักงานและกรอกหัวข้อ Kaizen ให้ครบถ้วน');
    }
    if (!payload.kaizenType) {
      throw new Error('กรุณาเลือกประเภท Kaizen');
    }

    const managerResult = getManagers();
    const managers = managerResult.success ? managerResult.managers : [];
    const reviewer = managers.find(m => String(m.id || '').trim() === String(payload.reviewerId || '').trim());
    if (!reviewer) throw new Error('ไม่พบสิทธิ์ผู้บันทึกแทนพนักงาน');

    const isDirector = (reviewer.approverType || []).indexOf('ผู้จัดการ') > -1;

    const allEmployees = getEmployees();
    const targetEmp = allEmployees.find(e => e.empId === normalizeEmpId_(payload.empId));
    if (!targetEmp) throw new Error('ไม่พบข้อมูลพนักงานที่เลือก');

    if (!isDirector && normalizeDept_(targetEmp.department) !== normalizeDept_(reviewer.department)) {
      throw new Error('ไม่มีสิทธิ์บันทึกข้อมูลแทนพนักงานแผนกอื่น');
    }

    let dateObj;
    if (payload.date) {
      const parts = String(payload.date).split('-');
      if (parts.length === 3) {
        dateObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      } else {
        dateObj = new Date(payload.date);
      }
    } else {
      dateObj = new Date();
    }

    if (isNaN(dateObj.getTime())) {
      throw new Error('รูปแบบวันที่ไม่ถูกต้อง');
    }

    const beYear = dateObj.getFullYear() + 543;
    const categories = payload.categories || {};
    const categoriesJson = JSON.stringify(categories);

    let newId, newRowIndex, sh, fileUrls = [], beforeImageUrl = '', afterImageUrl = '';

    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      sh = getSheet_(CONFIG.DATA_SHEET);
      newId = generateNextId_(sh, beYear);

      if (payload.files && payload.files.length > 0) {
        const fileResults = saveMultipleFilesToDrive_(payload.files, newId);
        fileUrls = fileResults.filter(f => f.url).map(f => f.url);
      }

      if (payload.beforeImageBase64 && payload.beforeImageFileName) {
        try {
          beforeImageUrl = saveFileToDrive_(payload.beforeImageBase64, payload.beforeImageFileName, payload.beforeImageMimeType, newId + '_before');
        } catch (imgErr) {}
      }

      if (payload.afterImageBase64 && payload.afterImageFileName) {
        try {
          afterImageUrl = saveFileToDrive_(payload.afterImageBase64, payload.afterImageFileName, payload.afterImageMimeType, newId + '_after');
        } catch (imgErr) {}
      }

      const lastCol = sh.getLastColumn();
      if (lastCol < 35) {
        sh.insertColumns(lastCol + 1, 35 - lastCol);
      }

      const rowData = [
        newId, dateObj, targetEmp.empId, targetEmp.name || '', normalizeDept_(targetEmp.department || ''),
        payload.title || '',
        payload.detail || '',
        '', '', '', new Date(), categoriesJson,
        '', '',
        CONFIG.STATUS_PENDING_HEAD,
        !!categories.P, !!categories.D, !!categories.E, !!categories.S,
        !!categories.Q, !!categories.E2, !!categories.C, !!categories.M,
        '', '', '', '', beforeImageUrl, afterImageUrl,
        payload.beforeProblem || '', payload.afterSolution || '', JSON.stringify(fileUrls),
        payload.kaizenType || '',
        '', ''
      ];

      sh.appendRow(rowData);
      newRowIndex = sh.getLastRow();

      const historyData = {
        id: newId, title: payload.title, detail: payload.detail || '',
        categories: categories, beforeProblem: payload.beforeProblem, afterSolution: payload.afterSolution,
        files: fileUrls, enteredByManagerId: reviewer.id, enteredByManagerName: reviewer.name,
        kaizenType: payload.kaizenType
      };
      saveVersionHistory_(newId, newRowIndex, 'CREATE_BY_MANAGER', null, historyData, reviewer.id, reviewer.name + ' (บันทึกแทน ' + targetEmp.name + ')');

      clearKaizenCache_();
    } finally {
      lock.releaseLock();
    }

    const recordForPdf = {
      id: newId,
      dateDisplay: toBEDateString_(dateObj),
      empId: targetEmp.empId,
      name: targetEmp.name || '',
      department: normalizeDept_(targetEmp.department || ''),
      title: payload.title || '',
      detail: payload.detail || '',
      result: '',
      categories: categories,
      status: CONFIG.STATUS_PENDING_HEAD,
      rejectReason: '',
      reviewedBy: '',
      reviewedDate: '',
      beforeImageUrl: beforeImageUrl,
      afterImageUrl: afterImageUrl,
      beforeProblem: payload.beforeProblem || '',
      afterSolution: payload.afterSolution || '',
      fileUrls: fileUrls,
      kaizenType: payload.kaizenType || ''
    };

    let formPdfUrl = '';
    try {
      formPdfUrl = generateAndSaveKaizenPdf_(recordForPdf);
      if (formPdfUrl) {
        sh.getRange(newRowIndex, 27).setValue(formPdfUrl);
        recordForPdf.formPdfUrl = formPdfUrl;
        clearKaizenCache_();
      }
    } catch (pdfErr) {}

    try {
      sendKaizenEmail_('submitted', recordForPdf);
    } catch (mailErr) {}

    return {
      success: true,
      id: newId,
      message: 'บันทึก Kaizen แทน ' + targetEmp.name + ' เรียบร้อยแล้ว รหัส ' + newId,
      formPdfUrl: formPdfUrl || null,
      fileUrls: fileUrls
    };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

function getOrCreateProgressSheet_() {
  const ss = getSS_();
  let sh = ss.getSheetByName(CONFIG.PROGRESS_SHEET);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.PROGRESS_SHEET);
  }
  if (sh.getLastRow() === 0) {
    sh.appendRow(['ID', 'EmpID', 'BEYear', 'Month', 'Count', 'UpdatedBy', 'UpdatedByName', 'UpdatedDate']);
  }
  return sh;
}

function getProgressMap_(beYear) {
  const sh = getOrCreateProgressSheet_();
  const lastRow = sh.getLastRow();
  const map = {};
  if (lastRow < 2) return map;

  const values = sh.getRange(2, 1, lastRow - 1, 8).getValues();
  values.forEach(function (row) {
    const empId = normalizeEmpId_(row[1]);
    const year = Number(row[2]);
    const month = Number(row[3]);
    const count = Number(row[4]) || 0;
    if (!empId || isNaN(year) || year !== Number(beYear)) return;
    if (!map[empId]) map[empId] = { monthly: {}, total: 0 };
    map[empId].monthly[month] = count;
    map[empId].total += count;
  });
  return map;
}

function getEmployeesForManager(reviewerId, beYear) {
  try {
    assertConfig_();
    const idStr = String(reviewerId || '').trim();
    if (!idStr) throw new Error('กรุณาระบุรหัสผู้ใช้งาน');

    let reviewer = null;
    const managerResult = getManagers();
    const managers = managerResult.success ? managerResult.managers : [];
    reviewer = managers.find(m => String(m.id || '').trim() === idStr);
    
    if (!reviewer) {
      throw new Error('ไม่พบสิทธิ์ผู้ตรวจสอบ');
    }

    const isDirector = (reviewer.approverType || []).indexOf('ผู้จัดการ') > -1;

    let employees = getEmployees();
    if (!isDirector) {
      const dept = normalizeDept_(reviewer.department);
      employees = employees.filter(e => normalizeDept_(e.department) === dept);
    }

    const allRecords = getKaizenRecords();
    const nowBEYear = new Date().getFullYear() + 543;

    const yearsSet = {};
    allRecords.forEach(r => { if (r.beYear) yearsSet[r.beYear] = true; });
    yearsSet[nowBEYear] = true;
    const availableYears = Object.keys(yearsSet).map(Number).sort((a, b) => b - a);

    const targetYear = beYear ? Number(beYear) : nowBEYear;

    const countByEmp = {};
    const submittedByEmp = {};
    const pendingByEmp = {};
    const rejectedByEmp = {};
    allRecords.forEach(function (r) {
      if (r.beYear !== targetYear) return;
      submittedByEmp[r.empId] = (submittedByEmp[r.empId] || 0) + 1;
      if (r.status === CONFIG.STATUS_APPROVED) {
        countByEmp[r.empId] = (countByEmp[r.empId] || 0) + 1;
      } else if (r.status === CONFIG.STATUS_REJECTED) {
        rejectedByEmp[r.empId] = (rejectedByEmp[r.empId] || 0) + 1;
      } else {
        pendingByEmp[r.empId] = (pendingByEmp[r.empId] || 0) + 1;
      }
    });

    let achievedCount = 0;
    employees = employees.map(function (e) {
      const computedCount = countByEmp[e.empId] || 0;
      const count = resolveDoneCount_(e.doneCount, computedCount);
      const submitted = submittedByEmp[e.empId] || 0;
      const pending = pendingByEmp[e.empId] || 0;
      const rejected = rejectedByEmp[e.empId] || 0;
      const target = (typeof e.target === 'number') ? e.target : getTargetForPosition_(e.position);
      const achieved = count >= target;
      const percent = target > 0 ? Math.min(100, Math.round((count / target) * 100)) : 100;
      if (achieved) achievedCount++;
      return {
        empId: e.empId,
        name: e.name,
        department: e.department,
        position: e.position,
        plant: e.plant,
        email: e.email,
        target: target,
        submitted: submitted,
        pending: pending,
        rejected: rejected,
        count: count,
        achieved: achieved,
        percent: percent
      };
    });

    employees.sort(function (a, b) {
      if (a.achieved !== b.achieved) return a.achieved ? 1 : -1;
      return a.percent - b.percent;
    });

    const totalEmployees = employees.length;
    const notAchievedCount = totalEmployees - achievedCount;
    const achievedPercent = totalEmployees > 0 ? Math.round((achievedCount / totalEmployees) * 100) : 0;

    return {
      success: true,
      employees: employees,
      isDirector: isDirector,
      department: reviewer.department || '',
      beYear: targetYear,
      availableYears: availableYears.length > 0 ? availableYears : [nowBEYear],
      summary: {
        totalEmployees: totalEmployees,
        achievedCount: achievedCount,
        notAchievedCount: notAchievedCount,
        achievedPercent: achievedPercent
      }
    };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

function getMonthlyProgressForManager(reviewerId, beYear) {
  try {
    assertConfig_();
    const idStr = String(reviewerId || '').trim();
    if (!idStr) throw new Error('กรุณาระบุรหัสผู้ใช้งาน');

    let reviewer = null;
    const managerResult = getManagers();
    const managers = managerResult.success ? managerResult.managers : [];
    reviewer = managers.find(m => String(m.id || '').trim() === idStr);
    
    if (!reviewer) {
      throw new Error('ไม่พบสิทธิ์ผู้ตรวจสอบ');
    }

    const isDirector = (reviewer.approverType || []).indexOf('ผู้จัดการ') > -1;
    // ดึงรายชื่อพนักงานจาก HR_Employees ตามที่ระบุ
    let employees = getEmployees();

    const nowBEYear = new Date().getFullYear() + 543;
    const targetYear = beYear ? Number(beYear) : nowBEYear;
    const currentMonth = new Date().getMonth() + 1;

    const progressMap = getProgressMap_(targetYear);

    const yearsSet = {};
    yearsSet[nowBEYear] = true;
    try {
      const sh = getOrCreateProgressSheet_();
      const lastRow = sh.getLastRow();
      if (lastRow >= 2) {
        const yrs = sh.getRange(2, 3, lastRow - 1, 1).getValues();
        yrs.forEach(r => { if (r[0]) yearsSet[Number(r[0])] = true; });
      }
    } catch (e) {}

    const availableYears = Object.keys(yearsSet).map(Number).sort((a, b) => b - a);

    const plantsSet = {};
    const deptsSet = {};

    let achievedCount = 0;
    employees = employees.map(function (e) {
      const target = (typeof e.target === 'number' && e.target !== null) ? e.target : getTargetForPosition_(e.position);
      const prog = progressMap[e.empId] || { monthly: {}, total: 0 };
      const total = prog.total || 0;
      const achieved = total >= target;
      const percent = target > 0 ? Math.min(100, Math.round((total / target) * 100)) : 100;
      const thisMonthCount = (prog.monthly && prog.monthly[currentMonth]) ? prog.monthly[currentMonth] : 0;
      const remaining = Math.max(0, target - total);
      if (achieved) achievedCount++;

      if (e.plant) plantsSet[e.plant] = true;
      if (e.department) deptsSet[e.department] = true;

      return {
        empId: e.empId,
        name: e.name,
        department: e.department,
        position: e.position,
        plant: e.plant || '',
        target: target,
        total: total,
        monthly: prog.monthly || {},
        thisMonthCount: thisMonthCount,
        remaining: remaining,
        achieved: achieved,
        percent: percent
      };
    });

    employees.sort(function (a, b) {
      if (a.achieved !== b.achieved) return a.achieved ? 1 : -1;
      return a.percent - b.percent;
    });

    const totalEmployees = employees.length;
    const notAchievedCount = totalEmployees - achievedCount;
    const achievedPercent = totalEmployees > 0 ? Math.round((achievedCount / totalEmployees) * 100) : 0;

    return {
      success: true,
      employees: employees,
      isDirector: isDirector,
      department: reviewer.department || '',
      beYear: targetYear,
      currentMonth: currentMonth,
      availableYears: availableYears.length > 0 ? availableYears : [nowBEYear],
      availablePlants: Object.keys(plantsSet).sort(),
      availableDepartments: Object.keys(deptsSet).sort(),
      summary: {
        totalEmployees: totalEmployees,
        achievedCount: achievedCount,
        notAchievedCount: notAchievedCount,
        achievedPercent: achievedPercent
      }
    };
  } catch (err) {
    console.error('getMonthlyProgressForManager error:', err);
    return { success: false, message: err.message };
  }
}

function saveMonthlyProgressCount(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    assertConfig_();
    payload = payload || {};

    const reviewerId = String(payload.reviewerId || '').trim();
    if (!reviewerId) throw new Error('ไม่พบสิทธิ์ผู้บันทึก');

    const empId = normalizeEmpId_(payload.empId);
    if (!empId) throw new Error('กรุณาระบุรหัสพนักงาน');

    const beYear = Number(payload.beYear);
    const month = Number(payload.month);
    if (!beYear || !month || month < 1 || month > 12) {
      throw new Error('ข้อมูลปี/เดือนไม่ถูกต้อง');
    }

    let count = Number(payload.count);
    if (isNaN(count) || count < 0) count = 0;
    count = Math.round(count);

    const managerResult = getManagers();
    const managers = managerResult.success ? managerResult.managers : [];
    const reviewer = managers.find(m => String(m.id || '').trim() === reviewerId);
    if (!reviewer) throw new Error('ไม่พบสิทธิ์ผู้บันทึก');

    const allEmployees = getEmployees();
    const targetEmp = allEmployees.find(e => e.empId === empId);
    if (!targetEmp) throw new Error('ไม่พบข้อมูลพนักงานรหัส ' + empId + ' ในชีต ' + CONFIG.EMPLOYEE_SHEET);

    const sh = getOrCreateProgressSheet_();
    const lastRow = sh.getLastRow();
    let foundRow = -1;

    if (lastRow >= 2) {
      const values = sh.getRange(2, 1, lastRow - 1, 4).getValues();
      for (let i = 0; i < values.length; i++) {
        const rEmp = normalizeEmpId_(values[i][1]);
        const rYear = Number(values[i][2]);
        const rMonth = Number(values[i][3]);
        if (rEmp === empId && rYear === beYear && rMonth === month) {
          foundRow = i + 2;
          break;
        }
      }
    }

    const now = new Date();
    if (foundRow > -1) {
      sh.getRange(foundRow, 5, 1, 4).setValues([[count, reviewer.id, reviewer.name, now]]);
    } else {
      const newId = 'MP-' + Utilities.getUuid().substring(0, 8);
      sh.appendRow([newId, empId, beYear, month, count, reviewer.id, reviewer.name, now]);
    }

    return { success: true, message: 'บันทึกจำนวน Kaizen สำเร็จ', count: count };
  } catch (err) {
    return { success: false, message: err.message };
  } finally {
    lock.releaseLock();
  }
}

function getDashboardData(beYear, department) {
  try {
    assertConfig_();
    let employees = getEmployees();
    const allRecords = getKaizenRecords();

    if (department) {
      const targetDept = normalizeDept_(department);
      employees = employees.filter(e => normalizeDept_(e.department) === targetDept);
    }

    const yearsSet = {};
    allRecords.forEach(r => { if (r.beYear) yearsSet[r.beYear] = true; });
    const nowBEYear = new Date().getFullYear() + 543;
    yearsSet[nowBEYear] = true;
    const availableYears = Object.keys(yearsSet).map(Number).sort((a, b) => b - a);

    const targetYear = beYear ? Number(beYear) : nowBEYear;

    const countByEmp = {};
    allRecords.forEach(function (r) {
      if (r.beYear !== targetYear) return;
      if (r.status !== CONFIG.STATUS_APPROVED) return;
      countByEmp[r.empId] = (countByEmp[r.empId] || 0) + 1;
    });

    let achievedCount = 0;
    let submittedApprovedCount = 0;
    let totalKaizenThisYear = 0;
    let totalTargetSum = 0;
    let totalDoneSum = 0;
    const deptMap = {};

    const employeeRows = employees.map(function (emp) {
      const computedCount = countByEmp[emp.empId] || 0;
      const count = resolveDoneCount_(emp.doneCount, computedCount);
      const target = (typeof emp.target === 'number') ? emp.target : getTargetForPosition_(emp.position);
      const achieved = count >= target;
      const percent = target > 0 ? Math.min(100, Math.round((count / target) * 100)) : 100;

      totalKaizenThisYear += count;
      totalTargetSum += target;
      totalDoneSum += count;
      if (achieved) achievedCount++;
      submittedApprovedCount += count;

      const deptKey = emp.department || 'ไม่ระบุแผนก';
      if (!deptMap[deptKey]) {
        deptMap[deptKey] = { department: deptKey, totalEmployees: 0, achievedCount: 0, totalKaizen: 0, totalTarget: 0 };
      }
      deptMap[deptKey].totalEmployees++;
      deptMap[deptKey].totalKaizen += count;
      deptMap[deptKey].totalTarget += target;
      if (achieved) deptMap[deptKey].achievedCount++;

      return {
        empId: emp.empId,
        name: emp.name,
        department: emp.department,
        position: emp.position,
        target: target,
        count: count,
        achieved: achieved,
        percent: percent
      };
    });

    employeeRows.sort(function (a, b) {
      if (a.achieved !== b.achieved) return a.achieved ? 1 : -1;
      return a.percent - b.percent;
    });

    const totalEmployees = employees.length;
    const notAchievedSum = Math.max(0, totalTargetSum - totalDoneSum);
    const achievedPercent = totalTargetSum > 0 ? Math.round((totalDoneSum / totalTargetSum) * 100) : 0;
    const avgPerEmployee = totalEmployees > 0 ? Math.round((totalKaizenThisYear / totalEmployees) * 10) / 10 : 0;

    const byDepartment = Object.keys(deptMap).sort().map(k => deptMap[k]);

    return {
      success: true,
      beYear: targetYear,
      availableYears: availableYears.length > 0 ? availableYears : [nowBEYear],
      summary: {
        totalEmployees: totalEmployees,
        achievedCount: achievedCount,
        notAchievedCount: notAchievedSum,
        totalTargetSum: totalTargetSum,
        totalDoneSum: totalDoneSum,
        achievedPercent: achievedPercent,
        totalKaizen: totalKaizenThisYear,
        avgPerEmployee: avgPerEmployee,
        submittedApprovedCount: submittedApprovedCount
      },
      byDepartment: byDepartment,
      employees: employeeRows
    };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

function advancedSearch(payload) {
  try {
    const allRecords = getKaizenRecords();
    let filtered = allRecords;

    if (payload.keyword) {
      const keyword = String(payload.keyword).toLowerCase().trim();
      filtered = filtered.filter(function (r) {
        return (r.id || '').toLowerCase().includes(keyword) ||
          (r.title || '').toLowerCase().includes(keyword) ||
          (r.name || '').toLowerCase().includes(keyword) ||
          (r.department || '').toLowerCase().includes(keyword) ||
          (r.detail || '').toLowerCase().includes(keyword) ||
          (r.result || '').toLowerCase().includes(keyword);
      });
    }

    if (payload.status) {
      filtered = filtered.filter(r => r.status === payload.status);
    }

    if (payload.department) {
      filtered = filtered.filter(r => r.department === payload.department);
    }

    if (payload.category) {
      filtered = filtered.filter(r => r.categories && r.categories[payload.category] === true);
    }

    if (payload.dateFrom) {
      const fromDateStr = String(payload.dateFrom).trim();
      filtered = filtered.filter(r => !!r.date && r.date >= fromDateStr);
    }

    if (payload.dateTo) {
      const toDateStr = String(payload.dateTo).trim();
      filtered = filtered.filter(r => !!r.date && r.date <= toDateStr);
    }

    if (payload.reviewedBy) {
      const keyword = String(payload.reviewedBy).toLowerCase().trim();
      filtered = filtered.filter(r => (r.reviewedBy || '').toLowerCase().includes(keyword));
    }

    const sortBy = payload.sortBy || 'date';
    const sortOrder = payload.sortOrder || 'desc';

    filtered.sort(function (a, b) {
      let valA, valB;
      switch (sortBy) {
        case 'id': valA = a.id || ''; valB = b.id || ''; break;
        case 'title': valA = (a.title || '').toLowerCase(); valB = (b.title || '').toLowerCase(); break;
        case 'name': valA = (a.name || '').toLowerCase(); valB = (b.name || '').toLowerCase(); break;
        case 'department': valA = (a.department || '').toLowerCase(); valB = (b.department || '').toLowerCase(); break;
        case 'status': valA = a.status || ''; valB = b.status || ''; break;
        default: valA = a.date || ''; valB = b.date || ''; break;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return { success: true, records: filtered, total: filtered.length };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function getDepartments() {
  try {
    const employees = getEmployees();
    const depts = {};
    employees.forEach(function (e) {
      if (e.department) depts[e.department] = true;
    });
    return { success: true, departments: Object.keys(depts).sort() };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function setupDriveFolder() {
  const folder = getOrCreateDriveFolder_();
  return folder.getUrl();
}

function setupDatabase() {
  try {
    const ss = getSS_();
    const requiredSheets = [
      CONFIG.DATA_SHEET,
      CONFIG.EMPLOYEE_SHEET,
      CONFIG.MANAGERS_SHEET,
      CONFIG.HISTORY_SHEET,
      CONFIG.COMMENT_SHEET,
      CONFIG.PROGRESS_SHEET,
      'EmailLog'
    ];

    requiredSheets.forEach(function (name) {
      let sheet = ss.getSheetByName(name);
      if (!sheet) {
        sheet = ss.insertSheet(name);
      }
    });

    try { ensureEmailLogSheet_(); } catch (e) {}

    const dataSheet = ss.getSheetByName(CONFIG.DATA_SHEET);
    const lastCol = dataSheet.getLastColumn();
    const targetCols = 35;
    
    if (lastCol < targetCols) {
      dataSheet.insertColumns(lastCol + 1, targetCols - lastCol);
    } else if (lastCol > targetCols) {
      dataSheet.deleteColumns(targetCols + 1, lastCol - targetCols);
    }

    const headers = [
      'ID', 'Date', 'EmpID', 'Name', 'Department', 'Title', 'Detail', 'Result',
      'PDF', 'Excel', 'Timestamp', 'Categories', 'Manager Approver', 'Director Approver',
      'Status', 'P', 'D', 'E', 'S', 'Q', 'E2', 'C', 'M',
      'RejectReason', 'ReviewedBy', 'ReviewedDate',
      'FormPdfUrl', 'BeforeImageUrl', 'AfterImageUrl', 'BeforeProblem', 'AfterSolution',
      'MultipleFiles', 'KaizenType', 'HeadApprover', 'HeadApprovedDate'
    ];
    
    if (dataSheet.getLastRow() === 0) {
      dataSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    } else {
      const existingHeaders = dataSheet.getRange(1, 1, 1, Math.min(dataSheet.getLastColumn(), headers.length)).getValues()[0];
      let needsUpdate = false;
      for (let i = 0; i < Math.min(existingHeaders.length, headers.length); i++) {
        if (String(existingHeaders[i] || '').trim() !== headers[i]) {
          needsUpdate = true;
          break;
        }
      }
      if (needsUpdate) {
        dataSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      }
    }

    const progressSheet = ss.getSheetByName(CONFIG.PROGRESS_SHEET);
    if (progressSheet && progressSheet.getLastRow() < 1) {
      progressSheet.getRange(1, 1, 1, 8).setValues([[
        'ID', 'EmpID', 'BEYear', 'Month', 'Count', 'UpdatedBy', 'UpdatedByName', 'UpdatedDate'
      ]]);
    }

    clearKaizenCache_();
    return { success: true, message: 'ตั้งค่าระบบสำเร็จ' };
  } catch (e) {
    console.error('setupDatabase error:', e);
    return { success: false, message: e.message };
  }
}

function autoRepairAllSheets() {
  try {
    const ss = getSS_();
    const messages = [];

    try {
      const dataSheet = ss.getSheetByName(CONFIG.DATA_SHEET);
      if (dataSheet) {
        const headers = dataSheet.getRange(1, 1, 1, dataSheet.getLastColumn()).getValues()[0];
        const hasStatus = headers.some(h => String(h).trim() === 'Status');
        
        if (!hasStatus) {
          dataSheet.insertColumnAfter(14);
          dataSheet.getRange(1, 15).setValue('Status');
          messages.push('✅ เพิ่มคอลัมน์ Status ในชีต Data');
        }

        const newHeaders = [
          'ID', 'Date', 'EmpID', 'Name', 'Department', 'Title', 'Detail', 'Result',
          'PDF', 'Excel', 'Timestamp', 'Categories', 'Manager Approver', 'Director Approver',
          'Status', 'P', 'D', 'E', 'S', 'Q', 'E2', 'C', 'M',
          'RejectReason', 'ReviewedBy', 'ReviewedDate',
          'FormPdfUrl', 'BeforeImageUrl', 'AfterImageUrl', 'BeforeProblem', 'AfterSolution',
          'MultipleFiles', 'KaizenType', 'HeadApprover', 'HeadApprovedDate'
        ];
        dataSheet.getRange(1, 1, 1, newHeaders.length).setValues([newHeaders]);
        messages.push('✅ ตั้งหัวตาราง Data เรียบร้อย');
      }
    } catch (e) {
      messages.push('❌ Error Data: ' + e.message);
    }

    try {
      const historySheet = ss.getSheetByName(CONFIG.HISTORY_SHEET);
      if (historySheet) {
        const newHeaders = ['ID', 'KaizenID', 'RowIndex', 'Action', 'OldData', 'NewData', 'UserId', 'UserName', 'Timestamp', 'Version'];
        historySheet.getRange(1, 1, 1, newHeaders.length).setValues([newHeaders]);
        messages.push('✅ ตั้งหัวตาราง History เรียบร้อย');
      }
    } catch (e) {
      messages.push('❌ Error History: ' + e.message);
    }

    try {
      const commentSheet = ss.getSheetByName(CONFIG.COMMENT_SHEET);
      if (commentSheet) {
        const newHeaders = ['ID', 'KaizenID', 'Comment', 'UserId', 'UserName', 'Timestamp'];
        commentSheet.getRange(1, 1, 1, newHeaders.length).setValues([newHeaders]);
        messages.push('✅ ตั้งหัวตาราง Comments เรียบร้อย');
      }
    } catch (e) {
      messages.push('❌ Error Comments: ' + e.message);
    }

    try {
      const hrSheet = ss.getSheetByName(CONFIG.EMPLOYEE_SHEET);
      if (hrSheet) {
        const lastRow = hrSheet.getLastRow();
        let fixed = 0;
        if (lastRow >= 1) {
          const headerRow = hrSheet.getRange(1, 1, 1, 9).getValues()[0];
          const isHeader = headerRow.some(h => String(h).trim() === 'EmpID' || String(h).trim() === 'Name');
          const startRow = isHeader ? 2 : 1;
          
          if (lastRow >= startRow) {
            const values = hrSheet.getRange(startRow, 1, lastRow - startRow + 1, 9).getValues();
            for (let i = 0; i < values.length; i++) {
              const row = values[i];
              const nameVal = String(row[1] || '');
              if (nameVal.indexOf('=') === 0) {
                const prefix = String(row[5] || '').trim();
                const firstName = String(row[6] || '').trim();
                const lastName = String(row[7] || '').trim();
                const newName = [prefix, firstName, lastName].filter(Boolean).join(' ');
                if (newName) {
                  hrSheet.getRange(startRow + i, 2).setValue(newName);
                  fixed++;
                }
              }
            }
          }
        }
        if (fixed > 0) messages.push('✅ แก้ไขสูตรใน HR_Employees ' + fixed + ' รายการ');
      }
    } catch (e) {
      messages.push('❌ Error HR_Employees: ' + e.message);
    }

    clearKaizenCache_();
    return { success: true, message: messages.join('\n') };
  } catch (e) {
    console.error('autoRepairAllSheets error:', e);
    return { success: false, message: e.message };
  }
}

function repairDepartmentNames() {
  try {
    const sh = getSheet_(CONFIG.DATA_SHEET);
    const lastRow = sh.getLastRow();
    if (lastRow < 2) return { success: true, message: 'ไม่มีข้อมูลใน Data sheet' };
    
    let fixedCount = 0;
    const deptColumn = 5;
    
    for (let i = 2; i <= lastRow; i++) {
      const oldValue = sh.getRange(i, deptColumn).getValue();
      if (oldValue) {
        const newValue = normalizeDept_(oldValue);
        if (newValue !== String(oldValue).trim()) {
          sh.getRange(i, deptColumn).setValue(newValue);
          fixedCount++;
        }
      }
    }
    
    clearKaizenCache_();
    return { success: true, message: 'แก้ไขชื่อแผนก ' + fixedCount + ' รายการ' };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function repairDataColumnAlignment() {
  try {
    const sh = getSheet_(CONFIG.DATA_SHEET);
    const lastRow = sh.getLastRow();
    if (lastRow < 2) return { success: true, message: 'ไม่มีข้อมูลใน Data sheet' };

    const validStatuses = [
      CONFIG.STATUS_PENDING_HEAD,
      CONFIG.STATUS_PENDING_DIRECTOR,
      CONFIG.STATUS_APPROVED,
      CONFIG.STATUS_REJECTED,
      'รอตรวจ'
    ];
    const isValidStatus = v => validStatuses.indexOf(String(v || '').trim()) > -1;

    const range = sh.getRange(2, 1, lastRow - 1, 35);
    const values = range.getValues();

    let fixedCount = 0;
    const skippedList = [];

    for (let i = 0; i < values.length; i++) {
      const row = values[i];
      if (!row[0]) continue;

      const statusSlot = row[DATA_COL.STATUS - 1];
      if (isValidStatus(statusSlot)) continue;

      const directorApproverSlot = row[DATA_COL.DIRECTOR_APPROVER - 1];
      const mSlot = row[DATA_COL.M - 1];

      let realStatus = null;
      if (isValidStatus(directorApproverSlot)) {
        realStatus = String(directorApproverSlot).trim();
      } else if (isValidStatus(mSlot)) {
        realStatus = String(mSlot).trim();
      }

      if (!realStatus) {
        skippedList.push(String(row[0] || '').trim());
        continue;
      }

      const categories8 = [row[14], row[15], row[16], row[17], row[18], row[19], row[20], row[21]];
      sh.getRange(i + 2, DATA_COL.STATUS, 1, 9).setValues([[realStatus].concat(categories8)]);

      if (isValidStatus(directorApproverSlot)) {
        sh.getRange(i + 2, DATA_COL.DIRECTOR_APPROVER).setValue('');
      }

      fixedCount++;
    }

    clearKaizenCache_();

    let message = 'ซ่อมแซมตำแหน่งคอลัมน์ Status/หมวดหมู่ที่คลาดเคลื่อน ' + fixedCount + ' แถว';
    if (skippedList.length > 0) {
      message += '\nไม่สามารถระบุสถานะที่แท้จริงได้ ' + skippedList.length + ' แถว: ' + skippedList.join(', ');
    }

    return { success: true, message: message, fixedCount: fixedCount, skipped: skippedList };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function syncManagerDepartments() {
  try {
    const ss = getSS_();
    const mgrSheet = ss.getSheetByName(CONFIG.MANAGERS_SHEET);
    if (!mgrSheet) {
      return { success: false, message: 'ไม่พบชีต Managers' };
    }
    
    const employees = getEmployees();
    const empMap = {};
    employees.forEach(e => {
      if (e.empId) empMap[normalizeEmpId_(e.empId)] = e;
    });
    
    const lastRow = mgrSheet.getLastRow();
    if (lastRow < 2) {
      return { success: false, message: 'ไม่มีข้อมูลในชีต Managers' };
    }
    
    let updatedCount = 0;
    const deptColumn = 4;
    
    for (let i = 2; i <= lastRow; i++) {
      const empId = normalizeEmpId_(mgrSheet.getRange(i, 1).getValue());
      const currentDept = normalizeDept_(mgrSheet.getRange(i, deptColumn).getValue());
      
      if (empId && empMap[empId]) {
        const correctDept = normalizeDept_(empMap[empId].department || '');
        if (correctDept && currentDept !== correctDept) {
          mgrSheet.getRange(i, deptColumn).setValue(correctDept);
          updatedCount++;
        }
      }
    }
    
    clearKaizenCache_();
    return { success: true, message: 'ซิงค์แผนก ' + updatedCount + ' รายการ' };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function debugReviewQueue(reviewerId) {
  try {
    const result = getReviewQueue(reviewerId);
    if (!result.success) {
      return { success: false, message: result.message };
    }

    const reviewer = result.reviewer;
    const allRecords = getKaizenRecords();
    const pendingHeadRecords = allRecords.filter(r => r.status === CONFIG.STATUS_PENDING_HEAD);
    const pendingDirectorRecords = allRecords.filter(r => r.status === CONFIG.STATUS_PENDING_DIRECTOR);

    const isDirector = (reviewer.approverType || []).indexOf('ผู้จัดการ') > -1;
    const isHead = (reviewer.approverType || []).indexOf('หัวหน้าแผนก') > -1;

    const actionableRecords = allRecords.filter(function (r) {
      if (isHead && r.status === CONFIG.STATUS_PENDING_HEAD) return true;
      if (isDirector && r.status === CONFIG.STATUS_PENDING_DIRECTOR) return true;
      return false;
    });

    const log = {
      reviewerId: reviewerId,
      reviewerName: reviewer.name,
      reviewerDepartment: reviewer.department || '',
      reviewerApproverTypes: reviewer.approverType || [],
      totalPendingHead: pendingHeadRecords.length,
      totalPendingDirector: pendingDirectorRecords.length,
      recordsVisibleToReviewer: actionableRecords.length,
      recordsVisibleList: actionableRecords.map(r => ({
        id: r.id,
        department: r.department,
        title: r.title,
        status: r.status
      }))
    };

    return { success: true, debug: log };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

function getEmailLogs(payload) {
  try {
    payload = payload || {};
    const limit = Number(payload.limit) || 200;
    const ss = getSS_();
    const sh = ss.getSheetByName('EmailLog');
    if (!sh || sh.getLastRow() < 2) {
      return { success: true, logs: [] };
    }
    const lastRow = sh.getLastRow();
    const startRow = Math.max(2, lastRow - limit + 1);
    const numRows = lastRow - startRow + 1;
    const values = sh.getRange(startRow, 1, numRows, 6).getValues();
    const logs = values.map(function (row) {
      return {
        timestamp: row[0] ? Utilities.formatDate(new Date(row[0]), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss') : '',
        type: row[1] || '',
        kaizenId: row[2] || '',
        recipients: row[3] || '',
        status: row[4] || '',
        errorMessage: row[5] || ''
      };
    });
    logs.reverse();
    return { success: true, logs: logs };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function isAuthorizedManager_(reviewerId) {
  const idStr = String(reviewerId || '').trim();
  if (!idStr) return null;
  const managerResult = getManagers();
  if (!managerResult.success) return null;
  return managerResult.managers.find(m => String(m.id || '').trim() === idStr) || null;
}

function getHrEmployeeSheet_() {
  try {
    return getSheet_(CONFIG.EMPLOYEE_SHEET);
  } catch (e) {
    return getSheet_('Employees');
  }
}

function getAllEmployeesRaw(reviewerId) {
  try {
    const reviewer = isAuthorizedManager_(reviewerId);
    if (!reviewer) throw new Error('ไม่มีสิทธิ์เข้าถึงข้อมูลนี้ กรุณาเข้าสู่ระบบในฐานะหัวหน้างาน');

    const sh = getHrEmployeeSheet_();
    const lastRow = sh.getLastRow();
    if (lastRow < 1) return { success: true, employees: [] };

    const headerRow = sh.getRange(1, 1, 1, 11).getValues()[0];
    const isHeaderRow = headerRow.some(h => String(h).trim() === 'EmpID' || String(h).trim() === 'Name');
    const startRow = isHeaderRow ? 2 : 1;
    if (lastRow < startRow) return { success: true, employees: [] };

    const values = sh.getRange(startRow, 1, lastRow - startRow + 1, 11).getValues();
    const employees = [];

    values.forEach(function (row, idx) {
      const empId = normalizeEmpId_(row[0]);
      if (!empId) return;

      const tasksRaw = row[9];
      const doneRaw = row[10];

      employees.push({
        rowIndex: startRow + idx,
        empId: empId,
        prefix: row[5] || '',
        firstName: row[6] || '',
        lastName: row[7] || '',
        department: normalizeDept_(row[2] || ''),
        position: row[3] || '',
        plant: row[4] || '',
        email: String(row[8] || '').trim(),
        tasks: (tasksRaw !== null && tasksRaw !== undefined && String(tasksRaw).trim() !== '') ? Number(tasksRaw) : '',
        done: (doneRaw !== null && doneRaw !== undefined && String(doneRaw).trim() !== '') ? Number(doneRaw) : ''
      });
    });

    employees.sort((a, b) => a.empId.localeCompare(b.empId, undefined, { numeric: true }));
    return { success: true, employees: employees };
  } catch (err) {
    console.error('getAllEmployeesRaw error:', err);
    return { success: false, message: err.message };
  }
}

function updateEmployeeRecord(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    payload = payload || {};
    const reviewer = isAuthorizedManager_(payload.reviewerId);
    if (!reviewer) throw new Error('ไม่มีสิทธิ์แก้ไขข้อมูลนี้');

    const rowIndex = Number(payload.rowIndex);
    if (!rowIndex || rowIndex < 1) throw new Error('ข้อมูลแถวไม่ถูกต้อง');

    const sh = getHrEmployeeSheet_();
    if (rowIndex > sh.getLastRow()) throw new Error('ไม่พบแถวข้อมูลพนักงานนี้');

    const existingEmpId = normalizeEmpId_(sh.getRange(rowIndex, HR_EMP_COL.EMPID).getValue());
    if (!existingEmpId) throw new Error('ไม่พบรหัสพนักงานเดิมของแถวนี้');

    const prefix = String(payload.prefix || '').trim();
    const firstName = String(payload.firstName || '').trim();
    const lastName = String(payload.lastName || '').trim();
    const fullName = [prefix, firstName, lastName].filter(Boolean).join(' ');

    const department = normalizeDept_(payload.department || '');
    const position = String(payload.position || '').trim();
    const plant = String(payload.plant || '').trim();
    const email = String(payload.email || '').trim();

    const tasksVal = (payload.tasks === '' || payload.tasks === null || payload.tasks === undefined || isNaN(Number(payload.tasks)))
      ? '' : Number(payload.tasks);
    const doneVal = (payload.done === '' || payload.done === null || payload.done === undefined || isNaN(Number(payload.done)))
      ? '' : Number(payload.done);

    sh.getRange(rowIndex, HR_EMP_COL.NAME).setValue(fullName);
    sh.getRange(rowIndex, HR_EMP_COL.DEPARTMENT).setValue(department);
    sh.getRange(rowIndex, HR_EMP_COL.POSITION).setValue(position);
    sh.getRange(rowIndex, HR_EMP_COL.PLANT).setValue(plant);
    sh.getRange(rowIndex, HR_EMP_COL.PREFIX).setValue(prefix);
    sh.getRange(rowIndex, HR_EMP_COL.FIRSTNAME).setValue(firstName);
    sh.getRange(rowIndex, HR_EMP_COL.LASTNAME).setValue(lastName);
    sh.getRange(rowIndex, HR_EMP_COL.EMAIL).setValue(email);
    sh.getRange(rowIndex, HR_EMP_COL.TASKS).setValue(tasksVal);
    sh.getRange(rowIndex, HR_EMP_COL.DONE).setValue(doneVal);

    clearKaizenCache_();
    return { success: true, message: 'บันทึกข้อมูลพนักงาน ' + existingEmpId + ' เรียบร้อยแล้ว' };
  } catch (err) {
    return { success: false, message: err.message };
  } finally {
    lock.releaseLock();
  }
}

function addEmployeeRecord(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    payload = payload || {};
    const reviewer = isAuthorizedManager_(payload.reviewerId);
    if (!reviewer) throw new Error('ไม่มีสิทธิ์เพิ่มข้อมูลนี้');

    const newEmpId = normalizeEmpId_(payload.empId);
    if (!newEmpId) throw new Error('กรุณาระบุรหัสพนักงาน');

    const sh = getHrEmployeeSheet_();

    const all = getAllEmployeesRaw(payload.reviewerId);
    if (all.success) {
      const dup = all.employees.find(e => e.empId === newEmpId);
      if (dup) throw new Error('รหัสพนักงาน ' + newEmpId + ' มีอยู่แล้วในระบบ');
    }

    const prefix = String(payload.prefix || '').trim();
    const firstName = String(payload.firstName || '').trim();
    const lastName = String(payload.lastName || '').trim();
    const fullName = [prefix, firstName, lastName].filter(Boolean).join(' ');
    const department = normalizeDept_(payload.department || '');
    const position = String(payload.position || '').trim();
    const plant = String(payload.plant || '').trim();
    const email = String(payload.email || '').trim();

    const tasksVal = (payload.tasks === '' || payload.tasks === null || payload.tasks === undefined || isNaN(Number(payload.tasks)))
      ? '' : Number(payload.tasks);
    const doneVal = (payload.done === '' || payload.done === null || payload.done === undefined || isNaN(Number(payload.done)))
      ? '' : Number(payload.done);

    const newRow = [];
    newRow[HR_EMP_COL.EMPID - 1] = newEmpId;
    newRow[HR_EMP_COL.NAME - 1] = fullName;
    newRow[HR_EMP_COL.DEPARTMENT - 1] = department;
    newRow[HR_EMP_COL.POSITION - 1] = position;
    newRow[HR_EMP_COL.PLANT - 1] = plant;
    newRow[HR_EMP_COL.PREFIX - 1] = prefix;
    newRow[HR_EMP_COL.FIRSTNAME - 1] = firstName;
    newRow[HR_EMP_COL.LASTNAME - 1] = lastName;
    newRow[HR_EMP_COL.EMAIL - 1] = email;
    newRow[HR_EMP_COL.TASKS - 1] = tasksVal;
    newRow[HR_EMP_COL.DONE - 1] = doneVal;

    sh.appendRow(newRow);
    clearKaizenCache_();

    return { success: true, message: 'เพิ่มพนักงาน ' + newEmpId + ' เรียบร้อยแล้ว', rowIndex: sh.getLastRow() };
  } catch (err) {
    return { success: false, message: err.message };
  } finally {
    lock.releaseLock();
  }
}

function deleteEmployeeRecord(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    payload = payload || {};
    const reviewer = isAuthorizedManager_(payload.reviewerId);
    if (!reviewer) throw new Error('ไม่มีสิทธิ์ลบข้อมูลนี้');

    const isDirector = (reviewer.approverType || []).indexOf('ผู้จัดการ') > -1;
    if (!isDirector) throw new Error('เฉพาะผู้จัดการเท่านั้นที่มีสิทธิ์ลบข้อมูลพนักงาน');

    const rowIndex = Number(payload.rowIndex);
    if (!rowIndex || rowIndex < 1) throw new Error('ข้อมูลแถวไม่ถูกต้อง');

    const sh = getHrEmployeeSheet_();
    if (rowIndex > sh.getLastRow()) throw new Error('ไม่พบแถวข้อมูลพนักงานนี้');

    const empId = normalizeEmpId_(sh.getRange(rowIndex, HR_EMP_COL.EMPID).getValue());
    sh.deleteRow(rowIndex);
    clearKaizenCache_();

    return { success: true, message: 'ลบข้อมูลพนักงาน ' + empId + ' เรียบร้อยแล้ว' };
  } catch (err) {
    return { success: false, message: err.message };
  } finally {
    lock.releaseLock();
  }
}