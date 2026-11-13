const SHEETS = {
  ROOMS: 'Rooms',
  EMPLOYEES: 'Employees',
  OCCUPANCY: 'Occupancy',
  BUILDINGS: 'Buildings',
  PARKING: 'Parking',
  ASSETS: 'Assets',
  SETTINGS: 'Settings',
  AUDIT_LOG: 'AuditLog',
  METER_READINGS: 'MeterReadings',
  BILLS: 'Bills'
};

const TZ = 'Asia/Bangkok';

// หัวคอลัมน์มาตรฐานของทุกตาราง (ใช้สร้างแผ่นงานที่ขาดหายอัตโนมัติ ไม่ให้ได้แผ่นงานหัวผิด)
const SHEET_HEADERS = {
  Rooms: ['RoomID', 'BuildingID', 'Floor', 'RoomNumber', 'RoomType', 'Capacity', 'Gender', 'MonthlyRate', 'HasAirConditioner', 'Status', 'Remark', 'CreatedAt', 'UpdatedAt'],
  Employees: ['EmployeeID', 'Prefix', 'FirstName', 'LastName', 'FullName', 'Department', 'Position', 'Plant', 'Phone', 'Email', 'Status', 'CreatedAt', 'UpdatedAt'],
  Occupancy: ['OccupancyID', 'EmployeeID', 'RoomID', 'BedID', 'BedNumber', 'CheckInDate', 'ExpectedCheckOutDate', 'ActualCheckOutDate', 'Status', 'Remark', 'CreatedAt', 'UpdatedAt'],
  Buildings: ['BuildingID', 'BuildingCode', 'BuildingName', 'Location', 'NumberOfFloors', 'Status', 'Remark', 'CreatedAt', 'UpdatedAt'],
  Parking: ['SlotID', 'SlotNumber', 'Zone', 'VehicleType', 'Status', 'EmployeeID', 'RoomID', 'LicensePlate', 'VehicleModel', 'AssignedDate', 'Remark', 'CreatedAt', 'UpdatedAt'],
  Assets: ['AssetID', 'RoomID', 'AssetName', 'AssetCode', 'Category', 'Quantity', 'Status', 'Condition', 'Remark', 'CreatedAt', 'UpdatedAt'],
  Settings: ['Key', 'Value'],
  AuditLog: ['LogID', 'Timestamp', 'UserEmail', 'Action', 'Module', 'RecordID', 'Remark'],
  MeterReadings: ['ReadingID', 'RoomID', 'Period', 'ElecPrev', 'ElecCurr', 'ElecUnits', 'ElecRollover', 'WaterPrev', 'WaterCurr', 'WaterUnits', 'WaterRollover', 'ReadDate', 'Remark', 'Status', 'ReadBy', 'CreatedAt', 'UpdatedAt'],
  Bills: ['BillID', 'BillNo', 'ReceiptNo', 'Period', 'RoomID', 'RoomNumber', 'BuildingName', 'TenantNames', 'TenantCount',
    'ElecPrev', 'ElecCurr', 'ElecUnits', 'ElecRate', 'ElecAmount', 'WaterPrev', 'WaterCurr', 'WaterUnits', 'WaterRate', 'WaterAmount',
    'RoomRent', 'OtherFee', 'OtherFeeNote', 'Discount', 'VatRate', 'VatAmount', 'TotalAmount',
    'IssueDate', 'DueDate', 'Status', 'PaidDate', 'PayMethod', 'PayerName', 'VoidedReceipts', 'Remark', 'CreatedAt', 'UpdatedAt']
};

// คอลัมน์ที่ต้องเก็บเป็นข้อความเสมอ (กันเบอร์โทร/รหัสที่ขึ้นต้นด้วย 0 ถูกแปลงเป็นตัวเลข)
const TEXT_COLUMNS_ = ['EmployeeID', 'Phone', 'LicensePlate', 'RoomNumber', 'SlotNumber', 'BuildingCode', 'AssetID', 'AssetCode',
  'CheckInDate', 'ExpectedCheckOutDate', 'ActualCheckOutDate', 'AssignedDate', 'CreatedAt', 'UpdatedAt', 'Timestamp',
  // v2.4.1: งวดบิล (เช่น 2026-11) ถ้าไม่เป็นข้อความ Sheets จะแปลงเป็นวันที่ / เลขที่เอกสาร / ค่า Settings (เช่น เลขผู้เสียภาษีขึ้นต้น 0)
  'Period', 'BillID', 'BillNo', 'ReceiptNo', 'ReadingID', 'IssueDate', 'DueDate', 'PaidDate', 'VoidedReceipts', 'Key', 'Value'];

// คอลัมน์ที่ต้องแปลงเป็น String เสมอตอนอ่านจาก Sheets
const STRING_ON_READ_ = ['EmployeeID', 'Phone', 'LicensePlate', 'RoomNumber', 'SlotNumber', 'BuildingCode',
  'RoomID', 'BuildingID', 'SlotID', 'OccupancyID', 'BedID', 'Floor', 'FloorID', 'AssetID', 'AssetCode',
  'Period', 'BillID', 'BillNo', 'ReceiptNo', 'ReadingID', 'Key', 'Value'];

/** รันฟังก์ชันนี้ 1 ครั้งหลังอัปเดตโค้ด เพื่อสร้างแผ่นงานที่ยังไม่มี (เช่น Parking, Assets) โดยไม่ลบข้อมูลเดิม */
function ensureAllSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEET_HEADERS).forEach(function (name) {
    let sh = ss.getSheetByName(name);
    if (!sh) {
      sh = ss.insertSheet(name);
      const h = SHEET_HEADERS[name];
      sh.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold').setBackground('#1e3a8a').setFontColor('#ffffff');
      sh.setFrozenRows(1);
      h.forEach(function (colName, colIdx) {
        if (TEXT_COLUMNS_.indexOf(colName) !== -1) {
          sh.getRange(2, colIdx + 1, Math.max(sh.getMaxRows() - 1, 1), 1).setNumberFormat('@');
        }
      });
    } else {
      // ตรวจสอบคอลัมน์ที่อาจขาดหายในแผ่นงานเดิม (เช่น เพิ่ม HasAirConditioner ใน Rooms)
      const lastCol = sh.getLastColumn();
      if (lastCol > 0) {
        const curHeaders = sh.getRange(1, 1, 1, lastCol).getValues()[0];
        const targetHeaders = SHEET_HEADERS[name];
        targetHeaders.forEach(function (colName) {
          if (curHeaders.indexOf(colName) === -1) {
            const newColIdx = sh.getLastColumn() + 1;
            sh.getRange(1, newColIdx).setValue(colName).setFontWeight('bold').setBackground('#1e3a8a').setFontColor('#ffffff');
            if (TEXT_COLUMNS_.indexOf(colName) !== -1) {
              sh.getRange(2, newColIdx, Math.max(sh.getMaxRows() - 1, 1), 1).setNumberFormat('@');
            }
          }
        });
      }
    }
  });
}

/**
 * (เลือกรันครั้งเดียว) ตั้งรูปแบบคอลัมน์รหัส/เบอร์โทร/วันที่ ในชีตเดิมให้เป็นข้อความ (@)
 * และแปลงรหัสพนักงานที่ถูกเก็บเป็นตัวเลขให้เป็นข้อความ โดยไม่เปลี่ยนค่าที่แสดง
 */
function fixTextFormats() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let n = 0;
  Object.keys(SHEET_HEADERS).forEach(function (name) {
    const sh = ss.getSheetByName(name);
    if (!sh || sh.getLastRow() < 1) return;
    const lastCol = sh.getLastColumn();
    const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
    headers.forEach(function (h, i) {
      if (TEXT_COLUMNS_.indexOf(h) === -1) return;
      const rows = Math.max(sh.getMaxRows() - 1, 1);
      const rng = sh.getRange(2, i + 1, rows, 1);
      const lastData = sh.getLastRow() - 1;
      if (lastData >= 1) {
        const dataRng = sh.getRange(2, i + 1, lastData, 1);
        const vals = dataRng.getValues();
        const out = vals.map(function (r) {
          const v = r[0];
          if (typeof v === 'number') { n++; return [String(v)]; }
          return [v];
        });
        rng.setNumberFormat('@');
        dataRng.setValues(out);
      } else {
        rng.setNumberFormat('@');
      }
    });
  });
  Logger.log('fixTextFormats: แปลงตัวเลขเป็นข้อความ ' + n + ' เซลล์');
  return n;
}

// ===================== ENTRY POINTS =====================

const READ_ACTIONS_ = ['getDashboardData', 'getRooms', 'getEmployees', 'getBuildings', 'getOccupancy', 'getParking',
  'getSettings', 'getRoomAssets', 'getMeterSheet', 'getBills'];

function doPost(e) {
  let body = {};
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse_({ success: false, message: 'ไม่พบข้อมูล payload ที่ส่งมา (Empty Request)' });
    }
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse_({ success: false, message: 'รูปแบบข้อมูลที่ส่งมาไม่ถูกต้อง (Invalid JSON)' });
  }

  const action = body.action;
  const userEmail = body.userEmail || 'admin@dormitory.com';

  const requiredToken = PropertiesService.getScriptProperties().getProperty('API_TOKEN');
  if (requiredToken && String(body.token || '') !== requiredToken) {
    return jsonResponse_({ success: false, message: 'รหัสเชื่อมต่อ (API Token) ไม่ถูกต้อง กรุณาตั้งค่าที่หน้า Admin > การตั้งค่า' });
  }

  const handler = getActionHandler_(action);
  if (!handler) {
    return jsonResponse_({ success: false, message: 'ไม่พบคำสั่ง action "' + action + '" ในระบบ (ถ้าเพิ่งอัปเดตโค้ด ให้ Deploy เวอร์ชันใหม่ และตรวจสอบว่าไม่มีไฟล์ Meters.gs ซ้ำอยู่ในโปรเจกต์)' });
  }

  const isRead = READ_ACTIONS_.indexOf(action) !== -1;
  const lock = LockService.getScriptLock();
  if (!isRead) {
    try {
      lock.waitLock(15000);
    } catch (lockErr) {
      return jsonResponse_({ success: false, message: 'ระบบกำลังประมวลผลรายการอื่นอยู่ กรุณาลองใหม่อีกครั้ง' });
    }
  }

  try {
    const result = handler(body, userEmail);
    return jsonResponse_({ success: true, data: result });
  } catch (err) {
    return jsonResponse_({ success: false, message: err && err.message ? err.message : String(err) });
  } finally {
    if (!isRead) lock.releaseLock();
  }
}

/** หา handler จาก Actions แล้วค่อย MeterActions (อยู่ท้ายไฟล์นี้) */
function getActionHandler_(action) {
  if (!action || typeof action !== 'string') return null;
  if (Object.prototype.hasOwnProperty.call(Actions, action) && typeof Actions[action] === 'function') return Actions[action];
  if (typeof MeterActions !== 'undefined' && Object.prototype.hasOwnProperty.call(MeterActions, action) && typeof MeterActions[action] === 'function') return MeterActions[action];
  return null;
}

function doGet(e) {
  return jsonResponse_({
    success: true,
    message: 'Dormitory API is running. (ระบบบริหารหอพักพนักงาน พร้อมระบบจองที่จอดรถ)',
    version: '2.5.0'
  });
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ===================== SHEET HELPER FUNCTIONS =====================

function getSheet_(name, autoCreate) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    if (autoCreate) {
      sheet = ss.insertSheet(name);
      sheet.appendRow(SHEET_HEADERS[name] || ['ID', 'CreatedAt']);
    } else {
      throw new Error('ไม่พบแผ่นงาน "' + name + '" กรุณารัน setupDormitoryDatabase ก่อนใช้งาน');
    }
  }
  return sheet;
}

function sheetToObjects_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(name);
  if (!sheet) return [];
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2) return [];

  const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = values[0];
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (row.every(function (c) { return c === '' || c === null; })) continue;
    const obj = {};
    headers.forEach(function (h, idx) {
      let cv = normalizeCell_(row[idx]);
      if (cv !== '' && cv !== null && STRING_ON_READ_.indexOf(h) !== -1) cv = String(cv).trim();
      // งวดบิลที่ Sheets แปลงเป็นวันที่ (เช่น 2026-10-01) ให้กลับเป็น yyyy-MM
      if (h === 'Period' && typeof cv === 'string' && /^\d{4}-\d{2}-\d{2}/.test(cv)) cv = cv.substring(0, 7);
      obj[h] = cv;
    });
    rows.push(obj);
  }
  return rows;
}

function normalizeCell_(v) {
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return '';
    const hasTime = Utilities.formatDate(v, TZ, 'HH:mm:ss') !== '00:00:00';
    return Utilities.formatDate(v, TZ, hasTime ? 'yyyy-MM-dd HH:mm:ss' : 'yyyy-MM-dd');
  }
  return v;
}

function textFormats_(headers) {
  return [headers.map(function (h) { return TEXT_COLUMNS_.indexOf(h) !== -1 ? '@' : 'General'; })];
}

function appendRow_(name, obj) {
  const sheet = getSheet_(name, true);
  const headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  const row = headers.map(function (h) {
    let val = obj[h] !== undefined ? obj[h] : '';
    if (val !== null && val !== undefined && val !== '' && TEXT_COLUMNS_.indexOf(h) !== -1) {
      val = String(val);
    }
    return val;
  });
  const range = sheet.getRange(sheet.getLastRow() + 1, 1, 1, headers.length);
  range.setNumberFormats(textFormats_(headers));
  range.setValues([row]);
  return obj;
}

function updateRowById_(name, idField, idValue, patch) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(name);
  if (!sheet) return false;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;

  const values = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
  const headers = values[0];
  const idCol = headers.indexOf(idField);
  if (idCol === -1) return false;

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idCol]).trim() === String(idValue).trim()) {
      const newRow = values[i].map(function (c) { return normalizeCell_(c); });
      headers.forEach(function (h, idx) {
        if (patch[h] !== undefined) {
          let val = patch[h];
          if (val !== null && val !== undefined && val !== '' && TEXT_COLUMNS_.indexOf(h) !== -1) {
            val = String(val);
          }
          newRow[idx] = val;
        }
      });
      const range = sheet.getRange(i + 1, 1, 1, headers.length);
      range.setNumberFormats(textFormats_(headers));
      range.setValues([newRow]);
      return true;
    }
  }
  return false;
}

function findRowObject_(name, idField, idValue) {
  const rows = sheetToObjects_(name);
  return rows.find(function (r) { return String(r[idField]).trim() === String(idValue).trim(); }) || null;
}

function generateId_(prefix) {
  return prefix + '-' + Utilities.getUuid().split('-')[0].toUpperCase();
}

function nowStr_() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss');
}

function logAudit_(userEmail, action, module, recordId, remark) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEETS.AUDIT_LOG);
    if (!sheet) {
      sheet = ss.insertSheet(SHEETS.AUDIT_LOG);
      sheet.appendRow(['LogID', 'Timestamp', 'UserEmail', 'Action', 'Module', 'RecordID', 'Remark']);
    }
    appendRow_(SHEETS.AUDIT_LOG, {
      LogID: generateId_('LOG'),
      Timestamp: nowStr_(),
      UserEmail: userEmail,
      Action: action,
      Module: module,
      RecordID: recordId,
      Remark: remark || ''
    });
  } catch (e) {
    console.warn('Audit log failed:', e);
  }
}

// ===================== HELPERS =====================

function assertRoomUsable_(room) {
  if (!room || room.Status === 'Deleted') throw new Error('ไม่พบห้องพักที่เลือก');
  if (room.Status === 'Maintenance') throw new Error('ห้อง ' + room.RoomNumber + ' อยู่ระหว่างปิดปรับปรุง ไม่สามารถใช้งานได้');
  if (room.Status === 'Inactive') throw new Error('ห้อง ' + room.RoomNumber + ' ไม่เปิดใช้งาน');
}

function releaseParkingForEmployee_(employeeId, userEmail, reason) {
  const slots = sheetToObjects_(SHEETS.PARKING).filter(function (p) {
    // ปลดเฉพาะช่องจอดที่ผูกกับการเข้าพักหอพัก (ไม่ใช่ช่องที่จองในฐานะพนักงานทั่วไป NON_RESIDENT)
    return p.Status === 'Occupied' && String(p.EmployeeID) === String(employeeId) && String(p.RoomID).toUpperCase() !== 'NON_RESIDENT';
  });
  slots.forEach(function (p) {
    updateRowById_(SHEETS.PARKING, 'SlotID', p.SlotID, {
      Status: 'Available', EmployeeID: '', RoomID: '', LicensePlate: '', VehicleModel: '', AssignedDate: '',
      Remark: reason || 'คืนช่องจอดอัตโนมัติ', UpdatedAt: nowStr_()
    });
    logAudit_(userEmail, 'RELEASE', 'Parking', p.SlotID, (reason || 'คืนช่องจอดอัตโนมัติ') + ' (' + p.SlotNumber + ' / ' + employeeId + ')');
  });
  return slots.length;
}

function releaseAllParkingForEmployee_(employeeId, userEmail, reason) {
  const slots = sheetToObjects_(SHEETS.PARKING).filter(function (p) {
    return p.Status === 'Occupied' && String(p.EmployeeID) === String(employeeId);
  });
  slots.forEach(function (p) {
    updateRowById_(SHEETS.PARKING, 'SlotID', p.SlotID, {
      Status: 'Available', EmployeeID: '', RoomID: '', LicensePlate: '', VehicleModel: '', AssignedDate: '',
      Remark: reason || 'คืนช่องจอดอัตโนมัติ', UpdatedAt: nowStr_()
    });
    logAudit_(userEmail, 'RELEASE', 'Parking', p.SlotID, (reason || 'คืนช่องจอดอัตโนมัติ') + ' (' + p.SlotNumber + ' / ' + employeeId + ')');
  });
  return slots.length;
}

// ===================== CORE LOGIC: คำนวณสถานะห้องพัก =====================
function computeRoomsData_() {
  const rooms = sheetToObjects_(SHEETS.ROOMS).filter(function (r) { return r.Status !== 'Deleted'; });
  const buildings = sheetToObjects_(SHEETS.BUILDINGS).filter(function (b) { return b.Status !== 'Deleted'; });
  const occupancyActive = sheetToObjects_(SHEETS.OCCUPANCY).filter(function (o) { return o.Status === 'Active'; });
  const employees = sheetToObjects_(SHEETS.EMPLOYEES).filter(function (e) { return e.Status !== 'Deleted'; });
  const parkingList = sheetToObjects_(SHEETS.PARKING).filter(function (p) { return p.Status !== 'Deleted'; });

  const buildingMap = {};
  buildings.forEach(function (b) { buildingMap[String(b.BuildingID)] = b; });

  const empMap = {};
  employees.forEach(function (e) { empMap[String(e.EmployeeID)] = e; });

  const activeRoomByEmp = {};
  occupancyActive.forEach(function (o) { activeRoomByEmp[String(o.EmployeeID)] = String(o.RoomID); });

  return rooms.map(function (r) {
    const roomId = String(r.RoomID);
    const capacity = Math.max(Number(r.Capacity) || 1, 1);
    const roomOccupants = occupancyActive.filter(function (o) { return String(o.RoomID) === roomId; });
    const occupiedCount = roomOccupants.length;
    const availableCount = Math.max(capacity - occupiedCount, 0);

    let computedStatus = 'Available';
    if (r.Status === 'Maintenance') {
      computedStatus = 'Maintenance';
    } else if (r.Status === 'Inactive') {
      computedStatus = 'Inactive';
    } else if (occupiedCount === 0) {
      computedStatus = 'Available';
    } else if (occupiedCount >= capacity) {
      computedStatus = 'Full';
    } else {
      computedStatus = 'Partially Occupied';
    }

    const bld = buildingMap[String(r.BuildingID)] || {};

    const occupantsOut = roomOccupants.map(function (o) {
      const emp = empMap[String(o.EmployeeID)] || {};
      const fullName = emp.FullName || ((emp.FirstName || '') + ' ' + (emp.LastName || '')).trim() || o.EmployeeID;
      let bedNum = Number(o.BedNumber);
      if (!bedNum && o.BedID) {
        const parts = String(o.BedID).split('-');
        bedNum = Number(parts[parts.length - 1]) || 1;
      }
      bedNum = bedNum || 1;
      return {
        occupancyId: o.OccupancyID,
        employeeId: o.EmployeeID,
        fullName: fullName,
        department: emp.Department || '',
        position: emp.Position || '',
        phone: emp.Phone || '',
        bedId: o.BedID ? String(o.BedID) : ('BED-' + roomId + '-' + bedNum),
        bedNumber: bedNum,
        checkInDate: o.CheckInDate,
        expectedCheckOutDate: o.ExpectedCheckOutDate || ''
      };
    });

    const bedsOut = [];
    for (let bedNum = 1; bedNum <= capacity; bedNum++) {
      const occ = occupantsOut.find(function (occ) { return occ.bedNumber === bedNum; });
      bedsOut.push({
        bedId: 'BED-' + roomId + '-' + bedNum,
        bedNumber: bedNum,
        bedType: 'Standard',
        status: 'Active',
        isOccupied: !!occ,
        occupantName: occ ? occ.fullName : '',
        occupantEmployeeId: occ ? occ.employeeId : ''
      });
    }

    const roomParking = parkingList
      .filter(function (p) {
        if (p.Status !== 'Occupied') return false;
        const ownerRoom = activeRoomByEmp[String(p.EmployeeID)];
        return (ownerRoom !== undefined ? ownerRoom : String(p.RoomID)) === roomId;
      })
      .map(function (p) {
        const pEmp = empMap[String(p.EmployeeID)] || {};
        return {
          slotId: p.SlotID,
          slotNumber: p.SlotNumber,
          zone: p.Zone,
          vehicleType: p.VehicleType,
          licensePlate: p.LicensePlate,
          vehicleModel: p.VehicleModel,
          ownerName: pEmp.FullName || ((pEmp.FirstName || '') + ' ' + (pEmp.LastName || '')).trim() || p.EmployeeID,
          ownerEmployeeId: p.EmployeeID
        };
      });

    const floorVal = (r.Floor !== undefined && r.Floor !== '') ? r.Floor : ((r.FloorID !== undefined && r.FloorID !== '') ? r.FloorID : '1');

    const rawHasAc = (r.HasAirConditioner !== undefined && r.HasAirConditioner !== null) ? String(r.HasAirConditioner).trim().toLowerCase() : '';
    let hasAirConditioner = true;
    if (rawHasAc === 'no' || rawHasAc === 'false' || rawHasAc === 'ไม่มี' || rawHasAc === '0') {
      hasAirConditioner = false;
    } else if (rawHasAc === 'yes' || rawHasAc === 'true' || rawHasAc === 'มี' || rawHasAc === '1') {
      hasAirConditioner = true;
    } else {
      const remarkLower = String(r.Remark || '').toLowerCase();
      if (remarkLower.indexOf('ไม่มีแอร์') !== -1 || remarkLower.indexOf('ห้องพัดลม') !== -1 || (remarkLower.indexOf('พัดลม') !== -1 && remarkLower.indexOf('แอร์') === -1)) {
        hasAirConditioner = false;
      }
    }

    return {
      roomId: r.RoomID,
      roomNumber: r.RoomNumber,
      buildingId: r.BuildingID,
      buildingName: bld.BuildingName || ('อาคาร ' + (r.BuildingID || '')),
      buildingCode: bld.BuildingCode || '',
      floorId: floorVal,
      floorName: 'ชั้น ' + floorVal,
      roomType: r.RoomType || (capacity === 1 ? 'Single' : (capacity === 2 ? 'Double' : 'Standard')),
      capacity: capacity,
      monthlyRate: Number(r.MonthlyRate) || 0,
      hasAirConditioner: hasAirConditioner,
      remark: r.Remark || (hasAirConditioner ? 'เฟอร์นิเจอร์มาตรฐานครบชุด (ห้องแอร์)' : 'เฟอร์นิเจอร์มาตรฐาน (ห้องพัดลม)'),
      computedStatus: computedStatus,
      canCheckIn: (computedStatus === 'Available' || computedStatus === 'Partially Occupied'),
      status: r.Status || 'Active',
      activeBedsCount: capacity,
      occupiedBedsCount: occupiedCount,
      availableBedsCount: availableCount,
      beds: bedsOut,
      occupants: occupantsOut,
      parkingSlots: roomParking
    };
  });
}

// ===================== API ACTIONS =====================

const Actions = {

  getDashboardData: function () {
    const rooms = computeRoomsData_();
    const buildings = sheetToObjects_(SHEETS.BUILDINGS).filter(function (b) { return b.Status !== 'Deleted'; });
    const occupancyAll = sheetToObjects_(SHEETS.OCCUPANCY);
    const employees = sheetToObjects_(SHEETS.EMPLOYEES).filter(function (e) { return e.Status !== 'Deleted'; });
    const parkingList = sheetToObjects_(SHEETS.PARKING).filter(function (p) { return p.Status !== 'Deleted'; });

    const totalRooms = rooms.length;
    const availableRooms = rooms.filter(function (r) { return r.computedStatus === 'Available'; }).length;
    const partiallyOccupiedRooms = rooms.filter(function (r) { return r.computedStatus === 'Partially Occupied'; }).length;
    const fullRooms = rooms.filter(function (r) { return r.computedStatus === 'Full'; }).length;
    const maintenanceRooms = rooms.filter(function (r) { return r.computedStatus === 'Maintenance'; }).length;
    const inactiveRooms = rooms.filter(function (r) { return r.computedStatus === 'Inactive'; }).length;

    const totalBeds = rooms.reduce(function (s, r) { return s + r.activeBedsCount; }, 0);
    const availableBeds = rooms.reduce(function (s, r) { return s + (r.canCheckIn ? r.availableBedsCount : 0); }, 0);
    const totalOccupants = rooms.reduce(function (s, r) { return s + r.occupiedBedsCount; }, 0);
    const overallOccupancyRate = totalBeds > 0 ? Math.round((totalOccupants / totalBeds) * 1000) / 10 : 0;

    const todayBkk = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
    const curYear = Number(todayBkk.substring(0, 4));
    const curMonth = Number(todayBkk.substring(5, 7)) - 1;

    function isSameMonth(dateVal, m, y) {
      if (!dateVal) return false;
      const s = String(dateVal).trim();
      const targetYearMonth = y + '-' + ('0' + (m + 1)).slice(-2);
      if (s.indexOf(targetYearMonth) === 0) return true;
      const mDmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
      if (mDmy) {
        return Number(mDmy[3]) === y && (Number(mDmy[2]) - 1) === m;
      }
      return false;
    }
    function isRealCheckIn(o) { return String(o.Remark || '').indexOf('ย้ายมาจากห้องเดิม') !== 0; }

    const newThisMonth = occupancyAll.filter(function (o) { return isRealCheckIn(o) && isSameMonth(o.CheckInDate, curMonth, curYear); }).length;
    const checkOutThisMonth = occupancyAll.filter(function (o) { return o.Status === 'CheckedOut' && isSameMonth(o.ActualCheckOutDate, curMonth, curYear); }).length;

    const buildingStats = buildings.map(function (b) {
      const bRooms = rooms.filter(function (r) { return String(r.buildingId) === String(b.BuildingID); });
      const bTotalBeds = bRooms.reduce(function (s, r) { return s + r.activeBedsCount; }, 0);
      const bOccupiedBeds = bRooms.reduce(function (s, r) { return s + r.occupiedBedsCount; }, 0);
      return {
        buildingId: b.BuildingID,
        buildingName: b.BuildingName,
        buildingCode: b.BuildingCode,
        totalBeds: bTotalBeds,
        occupiedBeds: bOccupiedBeds,
        occupancyRate: bTotalBeds > 0 ? Math.round((bOccupiedBeds / bTotalBeds) * 1000) / 10 : 0
      };
    });

    const almostFullRooms = rooms
      .filter(function (r) { return r.computedStatus === 'Partially Occupied' && r.availableBedsCount === 1; })
      .map(function (r) { return { roomNumber: r.roomNumber, buildingName: r.buildingName, available: r.availableBedsCount }; });

    const activeOccEmps = {};
    occupancyAll.filter(function (o) { return o.Status === 'Active'; }).forEach(function (o) {
      activeOccEmps[String(o.EmployeeID)] = true;
    });
    const deptCounts = {};
    employees.forEach(function (e) {
      if (activeOccEmps[String(e.EmployeeID)]) {
        const dept = e.Department || 'ไม่ระบุแผนก';
        deptCounts[dept] = (deptCounts[dept] || 0) + 1;
      }
    });

    const monthLabels = [], checkInsByMonth = [], checkOutsByMonth = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(curYear, curMonth - i, 1);
      monthLabels.push(('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear());
      checkInsByMonth.push(occupancyAll.filter(function (o) { return isRealCheckIn(o) && isSameMonth(o.CheckInDate, d.getMonth(), d.getFullYear()); }).length);
      checkOutsByMonth.push(occupancyAll.filter(function (o) { return o.Status === 'CheckedOut' && isSameMonth(o.ActualCheckOutDate, d.getMonth(), d.getFullYear()); }).length);
    }

    const totalParking = parkingList.length;
    const occupiedParking = parkingList.filter(function (p) { return p.Status === 'Occupied'; }).length;
    const availableParking = parkingList.filter(function (p) { return p.Status === 'Available'; }).length;
    const maintenanceParking = parkingList.filter(function (p) { return p.Status === 'Maintenance'; }).length;
    const parkingOccupancyRate = totalParking > 0 ? Math.round((occupiedParking / totalParking) * 1000) / 10 : 0;

    const carTotal = parkingList.filter(function (p) { return p.VehicleType === 'Car'; }).length;
    const carOccupied = parkingList.filter(function (p) { return p.VehicleType === 'Car' && p.Status === 'Occupied'; }).length;
    const carAvailable = parkingList.filter(function (p) { return p.VehicleType === 'Car' && p.Status === 'Available'; }).length;

    const motoTotal = parkingList.filter(function (p) { return p.VehicleType === 'Motorcycle'; }).length;
    const motoOccupied = parkingList.filter(function (p) { return p.VehicleType === 'Motorcycle' && p.Status === 'Occupied'; }).length;
    const motoAvailable = parkingList.filter(function (p) { return p.VehicleType === 'Motorcycle' && p.Status === 'Available'; }).length;

    return {
      kpi: {
        totalRooms: totalRooms,
        availableRooms: availableRooms,
        partiallyOccupiedRooms: partiallyOccupiedRooms,
        fullRooms: fullRooms,
        maintenanceRooms: maintenanceRooms,
        inactiveRooms: inactiveRooms,
        totalBeds: totalBeds,
        availableBeds: availableBeds,
        totalOccupants: totalOccupants,
        overallOccupancyRate: overallOccupancyRate,
        newThisMonth: newThisMonth,
        checkOutThisMonth: checkOutThisMonth
      },
      parkingStats: {
        total: totalParking,
        occupied: occupiedParking,
        available: availableParking,
        maintenance: maintenanceParking,
        rate: parkingOccupancyRate,
        car: { total: carTotal, occupied: carOccupied, available: carAvailable },
        motorcycle: { total: motoTotal, occupied: motoOccupied, available: motoAvailable }
      },
      buildingStats: buildingStats,
      almostFullRooms: almostFullRooms,
      charts: {
        roomStatus: {
          labels: ['ว่าง', 'ว่างบางส่วน', 'เต็ม', 'ปิดปรับปรุง', 'ไม่เปิดใช้งาน'],
          counts: [availableRooms, partiallyOccupiedRooms, fullRooms, maintenanceRooms, inactiveRooms]
        },
        buildingOccupancy: {
          labels: buildingStats.map(function (b) { return b.buildingName; }),
          counts: buildingStats.map(function (b) { return b.occupiedBeds; }),
          rates: buildingStats.map(function (b) { return b.occupancyRate; })
        },
        departmentDistribution: {
          labels: Object.keys(deptCounts),
          counts: Object.values(deptCounts)
        },
        monthlyTrends: {
          labels: monthLabels,
          checkIns: checkInsByMonth,
          checkOuts: checkOutsByMonth
        }
      }
    };
  },

  getRooms: function () {
    return computeRoomsData_();
  },

  saveRoom: function (body, userEmail) {
    const d = body.data;
    if (!d.buildingId || !d.roomNumber || !d.capacity) {
      throw new Error('กรุณากรอกอาคาร เลขห้อง และความจุผู้พักให้ครบถ้วน');
    }
    d.roomNumber = String(d.roomNumber).trim();
    d.capacity = Number(d.capacity);
    if (!(d.capacity >= 1 && d.capacity <= 20)) throw new Error('ความจุต้องอยู่ระหว่าง 1 - 20 คน');
    if (!findRowObject_(SHEETS.BUILDINGS, 'BuildingID', d.buildingId)) throw new Error('ไม่พบอาคารที่เลือก');
    if (d.roomId && !findRowObject_(SHEETS.ROOMS, 'RoomID', d.roomId)) throw new Error('ไม่พบห้องพักที่ต้องการแก้ไข');

    const dupRoom = sheetToObjects_(SHEETS.ROOMS).find(function (r) {
      return r.Status !== 'Deleted' && String(r.BuildingID).trim() === String(d.buildingId).trim() &&
        String(r.RoomNumber).trim().toLowerCase() === d.roomNumber.toLowerCase() &&
        String(r.RoomID) !== String(d.roomId || '');
    });
    if (dupRoom) throw new Error('มีห้อง ' + d.roomNumber + ' ในอาคารนี้อยู่แล้ว');

    if (d.roomId) {
      const curOcc = sheetToObjects_(SHEETS.OCCUPANCY).filter(function (o) {
        return o.Status === 'Active' && String(o.RoomID) === String(d.roomId);
      });
      const maxBed = curOcc.reduce(function (m, o) { return Math.max(m, Number(o.BedNumber) || 0); }, 0);
      if (d.capacity < curOcc.length || d.capacity < maxBed) {
        throw new Error('ไม่สามารถลดความจุเหลือ ' + d.capacity + ' คนได้ เพราะมีผู้พักอยู่ ' + curOcc.length + ' คน (ใช้ที่พักสูงสุดหมายเลข ' + maxBed + ')');
      }
    }

    const hasAcVal = (d.hasAirConditioner === false || d.hasAirConditioner === 'No' || d.hasAirConditioner === 'ไม่มี') ? 'No' : 'Yes';

    if (d.roomId) {
      updateRowById_(SHEETS.ROOMS, 'RoomID', d.roomId, {
        BuildingID: d.buildingId,
        Floor: d.floor || d.floorId || '1',
        RoomNumber: d.roomNumber,
        RoomType: d.roomType || 'Double',
        Capacity: Math.max(Number(d.capacity) || 1, 1),
        Gender: 'Any',
        MonthlyRate: Number(d.monthlyRate) || 0,
        HasAirConditioner: hasAcVal,
        Remark: d.remark || '',
        UpdatedAt: nowStr_()
      });
      logAudit_(userEmail, 'UPDATE', 'Rooms', d.roomId, 'แก้ไขห้อง ' + d.roomNumber + ' (แอร์: ' + hasAcVal + ')');
      return { roomId: d.roomId };
    } else {
      const roomId = generateId_('ROOM');
      appendRow_(SHEETS.ROOMS, {
        RoomID: roomId,
        BuildingID: d.buildingId,
        Floor: d.floor || d.floorId || '1',
        RoomNumber: d.roomNumber,
        RoomType: d.roomType || 'Double',
        Capacity: Math.max(Number(d.capacity) || 1, 1),
        Gender: 'Any',
        MonthlyRate: Number(d.monthlyRate) || 0,
        HasAirConditioner: hasAcVal,
        Status: 'Active',
        Remark: d.remark || (hasAcVal === 'Yes' ? 'เฟอร์นิเจอร์มาตรฐานครบชุด (ห้องแอร์)' : 'เฟอร์นิเจอร์มาตรฐาน (ห้องพัดลม)'),
        CreatedAt: nowStr_(),
        UpdatedAt: nowStr_()
      });
      logAudit_(userEmail, 'CREATE', 'Rooms', roomId, 'เพิ่มห้องใหม่ ' + d.roomNumber + ' (แอร์: ' + hasAcVal + ')');
      return { roomId: roomId };
    }
  },

  deleteRoom: function (body, userEmail) {
    const roomId = body.roomId;
    const activeOcc = sheetToObjects_(SHEETS.OCCUPANCY).filter(function (o) {
      return o.Status === 'Active' && String(o.RoomID) === String(roomId);
    });
    if (activeOcc.length > 0) {
      throw new Error('ไม่สามารถลบห้องนี้ได้ เนื่องจากยังมีพนักงานพักอาศัยอยู่ กรุณาย้ายออกก่อนลบห้อง');
    }
    updateRowById_(SHEETS.ROOMS, 'RoomID', roomId, { Status: 'Deleted', UpdatedAt: nowStr_() });
    logAudit_(userEmail, 'DELETE', 'Rooms', roomId, 'ลบห้องพัก');
    return { roomId: roomId };
  },

  toggleRoomMaintenance: function (body, userEmail) {
    const roomId = body.roomId;
    const room = findRowObject_(SHEETS.ROOMS, 'RoomID', roomId);
    if (!room) throw new Error('ไม่พบห้องพักที่ต้องการ');

    if (room.Status === 'Deleted') throw new Error('ห้องนี้ถูกลบแล้ว');
    if (room.Status !== 'Maintenance') {
      const stillIn = sheetToObjects_(SHEETS.OCCUPANCY).filter(function (o) {
        return o.Status === 'Active' && String(o.RoomID) === String(roomId);
      }).length;
      if (stillIn > 0) {
        throw new Error('ไม่สามารถปิดปรับปรุงห้อง ' + room.RoomNumber + ' ได้ เพราะยังมีผู้พักอยู่ ' + stillIn + ' คน กรุณาย้ายออก/ย้ายห้องก่อน');
      }
    }
    const newStatus = (room.Status === 'Maintenance') ? 'Active' : 'Maintenance';
    updateRowById_(SHEETS.ROOMS, 'RoomID', roomId, { Status: newStatus, UpdatedAt: nowStr_() });
    logAudit_(userEmail, 'UPDATE', 'Rooms', roomId, 'เปลี่ยนสถานะห้องเป็น ' + newStatus);
    return { roomId: roomId, status: newStatus };
  },

  getEmployees: function () {
    const employees = sheetToObjects_(SHEETS.EMPLOYEES).filter(function (e) { return e.Status !== 'Deleted'; });
    const activeOcc = sheetToObjects_(SHEETS.OCCUPANCY).filter(function (o) { return o.Status === 'Active'; });
    const rooms = sheetToObjects_(SHEETS.ROOMS);
    const parkingList = sheetToObjects_(SHEETS.PARKING).filter(function (p) { return p.Status === 'Occupied'; });

    const roomMap = {};
    rooms.forEach(function (r) { roomMap[String(r.RoomID)] = r; });

    const occByEmp = {};
    activeOcc.forEach(function (o) { occByEmp[String(o.EmployeeID)] = o; });

    const parkingByEmp = {};
    parkingList.forEach(function (p) {
      const k = String(p.EmployeeID);
      (parkingByEmp[k] = parkingByEmp[k] || []).push({ slotId: p.SlotID, slotNumber: p.SlotNumber, vehicleType: p.VehicleType, licensePlate: p.LicensePlate });
    });

    return employees.map(function (e) {
      const fullName = e.FullName || ((e.FirstName || '') + ' ' + (e.LastName || '')).trim();
      const occ = occByEmp[String(e.EmployeeID)];
      let currentRoomNumber = '';
      let currentRoomId = '';
      if (occ) {
        const r = roomMap[String(occ.RoomID)];
        currentRoomNumber = r ? r.RoomNumber : occ.RoomID;
        currentRoomId = occ.RoomID;
      }
      const pks = parkingByEmp[String(e.EmployeeID)] || [];
      return Object.assign({}, e, {
        FullName: fullName,
        currentRoomNumber: currentRoomNumber,
        currentRoomId: currentRoomId,
        isAccommodated: !!occ,
        parkingSlots: pks,
        parkingSlotNumber: pks.map(function (x) { return x.slotNumber; }).join(', '),
        parkingLicensePlate: pks.map(function (x) { return x.licensePlate; }).join(', '),
        hasParking: pks.length > 0
      });
    });
  },

  saveEmployee: function (body, userEmail) {
    const d = body.data;
    if (!d.firstName || !d.lastName) {
      throw new Error('กรุณากรอกชื่อและนามสกุลพนักงาน');
    }
    const fullName = ((d.firstName || '') + ' ' + (d.lastName || '')).trim();

    if (d.employeeId) {
      if (!findRowObject_(SHEETS.EMPLOYEES, 'EmployeeID', d.employeeId)) throw new Error('ไม่พบพนักงานที่ต้องการแก้ไข');
      updateRowById_(SHEETS.EMPLOYEES, 'EmployeeID', d.employeeId, {
        Prefix: d.prefix || 'นาย',
        FirstName: d.firstName,
        LastName: d.lastName,
        FullName: fullName,
        Department: d.department || '',
        Position: d.position || '',
        Plant: d.plant || 'Plant 1',
        Phone: d.phone || '',
        Email: d.email || '',
        UpdatedAt: nowStr_()
      });
      logAudit_(userEmail, 'UPDATE', 'Employees', d.employeeId, 'แก้ไขพนักงาน ' + fullName);
      return { employeeId: d.employeeId };
    } else {
      const employeeId = String(d.customEmployeeId || '').trim() || generateId_('EMP');
      const existingEmp = findRowObject_(SHEETS.EMPLOYEES, 'EmployeeID', employeeId);
      if (existingEmp && existingEmp.Status !== 'Deleted') {
        throw new Error('รหัสพนักงาน ' + employeeId + ' มีอยู่ในระบบแล้ว');
      }
      if (existingEmp) {
        updateRowById_(SHEETS.EMPLOYEES, 'EmployeeID', employeeId, {
          Prefix: d.prefix || 'นาย',
          FirstName: d.firstName,
          LastName: d.lastName,
          FullName: fullName,
          Department: d.department || '',
          Position: d.position || '',
          Plant: d.plant || 'Plant 1',
          Phone: d.phone || '',
          Email: d.email || '',
          Status: 'Active',
          UpdatedAt: nowStr_()
        });
        logAudit_(userEmail, 'RESTORE', 'Employees', employeeId, 'กู้คืนพนักงาน ' + fullName);
        return { employeeId: employeeId, restored: true };
      }
      appendRow_(SHEETS.EMPLOYEES, {
        EmployeeID: employeeId,
        Prefix: d.prefix || 'นาย',
        FirstName: d.firstName,
        LastName: d.lastName,
        FullName: fullName,
        Department: d.department || '',
        Position: d.position || '',
        Plant: d.plant || 'Plant 1',
        Phone: d.phone || '',
        Email: d.email || '',
        Status: 'Active',
        CreatedAt: nowStr_(),
        UpdatedAt: nowStr_()
      });
      logAudit_(userEmail, 'CREATE', 'Employees', employeeId, 'เพิ่มพนักงานใหม่ ' + fullName);
      return { employeeId: employeeId };
    }
  },

  deleteEmployee: function (body, userEmail) {
    const employeeId = body.employeeId;
    const activeOcc = sheetToObjects_(SHEETS.OCCUPANCY).filter(function (o) {
      return o.Status === 'Active' && String(o.EmployeeID) === String(employeeId);
    });
    if (activeOcc.length > 0) {
      throw new Error('ไม่สามารถลบพนักงานคนนี้ได้ เนื่องจากยังมีห้องพักที่ใช้งานอยู่ กรุณาทำรายการเช็คเอาท์ก่อน');
    }
    releaseAllParkingForEmployee_(employeeId, userEmail, 'คืนช่องจอดเพราะลบพนักงาน');
    updateRowById_(SHEETS.EMPLOYEES, 'EmployeeID', employeeId, { Status: 'Deleted', UpdatedAt: nowStr_() });
    logAudit_(userEmail, 'DELETE', 'Employees', employeeId, 'ลบพนักงาน');
    return { employeeId: employeeId };
  },

  getBuildings: function () {
    const buildings = sheetToObjects_(SHEETS.BUILDINGS).filter(function (b) { return b.Status !== 'Deleted'; });
    const rooms = sheetToObjects_(SHEETS.ROOMS).filter(function (r) { return r.Status !== 'Deleted'; });
    return buildings.map(function (b) {
      const bRooms = rooms.filter(function (r) { return String(r.BuildingID) === String(b.BuildingID); });
      return Object.assign({}, b, {
        TotalRooms: bRooms.length
      });
    });
  },

  saveBuilding: function (body, userEmail) {
    const d = body.data;
    if (!d.buildingCode || !d.buildingName) {
      throw new Error('กรุณากรอกรหัสอาคารและชื่ออาคาร');
    }
    const dupBld = sheetToObjects_(SHEETS.BUILDINGS).find(function (b) {
      return b.Status !== 'Deleted' &&
        String(b.BuildingCode).trim().toLowerCase() === String(d.buildingCode).trim().toLowerCase() &&
        String(b.BuildingID) !== String(d.buildingId || '');
    });
    if (dupBld) {
      throw new Error('รหัสอาคาร ' + d.buildingCode + ' มีอยู่ในระบบแล้ว');
    }
    if (d.buildingId) {
      updateRowById_(SHEETS.BUILDINGS, 'BuildingID', d.buildingId, {
        BuildingCode: d.buildingCode,
        BuildingName: d.buildingName,
        Location: d.location || '',
        NumberOfFloors: Number(d.numberOfFloors) || 2,
        Remark: d.remark || '',
        UpdatedAt: nowStr_()
      });
      logAudit_(userEmail, 'UPDATE', 'Buildings', d.buildingId, 'แก้ไขอาคาร ' + d.buildingName);
      return { buildingId: d.buildingId };
    } else {
      const buildingId = generateId_('BLD');
      appendRow_(SHEETS.BUILDINGS, {
        BuildingID: buildingId,
        BuildingCode: d.buildingCode,
        BuildingName: d.buildingName,
        Location: d.location || '',
        NumberOfFloors: Number(d.numberOfFloors) || 2,
        Status: 'Active',
        Remark: d.remark || '',
        CreatedAt: nowStr_(),
        UpdatedAt: nowStr_()
      });
      logAudit_(userEmail, 'CREATE', 'Buildings', buildingId, 'เพิ่มอาคารใหม่ ' + d.buildingName);
      return { buildingId: buildingId };
    }
  },

  getOccupancy: function () {
    const occ = sheetToObjects_(SHEETS.OCCUPANCY);
    const emps = sheetToObjects_(SHEETS.EMPLOYEES);
    const rooms = sheetToObjects_(SHEETS.ROOMS);
    const blds = sheetToObjects_(SHEETS.BUILDINGS);

    const empMap = {};
    emps.forEach(function (e) { empMap[String(e.EmployeeID)] = e; });
    const roomMap = {};
    rooms.forEach(function (r) { roomMap[String(r.RoomID)] = r; });
    const bldMap = {};
    blds.forEach(function (b) { bldMap[String(b.BuildingID)] = b; });

    return occ.map(function (o) {
      const emp = empMap[String(o.EmployeeID)] || {};
      const room = roomMap[String(o.RoomID)] || {};
      const bld = bldMap[String(room.BuildingID)] || {};
      return Object.assign({}, o, {
        EmployeeName: emp.FullName || ((emp.FirstName || '') + ' ' + (emp.LastName || '')).trim() || o.EmployeeID,
        Department: emp.Department || '',
        Phone: emp.Phone || '',
        RoomNumber: room.RoomNumber || o.RoomID,
        BuildingName: bld.BuildingName || ''
      });
    });
  },

  checkIn: function (body, userEmail) {
    const d = body.data;
    if (!d.employeeId || !d.roomId || !d.checkInDate) {
      throw new Error('กรุณาเลือกพนักงาน ห้องพัก และวันที่เข้าพัก');
    }

    const activeOcc = sheetToObjects_(SHEETS.OCCUPANCY).filter(function (o) { return o.Status === 'Active'; });

    const existing = activeOcc.find(function (o) { return String(o.EmployeeID) === String(d.employeeId); });
    if (existing) {
      throw new Error('พนักงานคนนี้มีห้องพักที่กำลังเข้าพักอยู่แล้ว หากต้องการเปลี่ยนห้องกรุณาใช้เมนู "ย้ายห้อง"');
    }

    const room = findRowObject_(SHEETS.ROOMS, 'RoomID', d.roomId);
    assertRoomUsable_(room);

    const emp = findRowObject_(SHEETS.EMPLOYEES, 'EmployeeID', d.employeeId);
    if (!emp || emp.Status === 'Deleted') throw new Error('ไม่พบพนักงานรหัส ' + d.employeeId + ' ในระบบ');

    if (d.expectedCheckOutDate && String(d.expectedCheckOutDate) < String(d.checkInDate)) {
      throw new Error('วันที่คาดว่าจะย้ายออกต้องไม่ก่อนวันที่เข้าพัก');
    }

    const capacity = Math.max(Number(room.Capacity) || 1, 1);
    const currentOccupants = activeOcc.filter(function (o) { return String(o.RoomID) === String(d.roomId); });

    if (currentOccupants.length >= capacity) {
      throw new Error('ห้องพักนี้เต็มแล้ว (ความจุ ' + capacity + ' คน) ไม่สามารถเข้าพักเพิ่มได้');
    }

    let bedNumber = Number(d.bedNumber) || 0;
    const occupiedBedNums = currentOccupants.map(function (o) { return Number(o.BedNumber) || 0; });
    if (!bedNumber || occupiedBedNums.indexOf(bedNumber) !== -1) {
      for (let i = 1; i <= capacity; i++) {
        if (occupiedBedNums.indexOf(i) === -1) {
          bedNumber = i;
          break;
        }
      }
    }

    const occupancyId = generateId_('OCC');
    appendRow_(SHEETS.OCCUPANCY, {
      OccupancyID: occupancyId,
      EmployeeID: d.employeeId,
      RoomID: d.roomId,
      BedID: 'BED-' + d.roomId + '-' + bedNumber,
      BedNumber: bedNumber,
      CheckInDate: d.checkInDate,
      ExpectedCheckOutDate: d.expectedCheckOutDate || '',
      ActualCheckOutDate: '',
      Status: 'Active',
      Remark: d.remark || '',
      CreatedAt: nowStr_(),
      UpdatedAt: nowStr_()
    });

    logAudit_(userEmail, 'CHECK-IN', 'Occupancy', occupancyId, 'เช็คอินพนักงาน ' + d.employeeId + ' เข้าห้อง ' + room.RoomNumber + ' (ที่พัก ' + bedNumber + ')');
    return { occupancyId: occupancyId, bedNumber: bedNumber };
  },

  checkOut: function (body, userEmail) {
    const d = body.data;
    const occ = findRowObject_(SHEETS.OCCUPANCY, 'OccupancyID', d.occupancyId);
    if (!occ || occ.Status !== 'Active') {
      throw new Error('ไม่พบข้อมูลการเข้าพักที่ Active สำหรับรายการนี้');
    }

    const checkOutDate = d.checkOutDate || nowStr_().split(' ')[0];
    if (String(checkOutDate) < String(occ.CheckInDate).substring(0, 10)) {
      throw new Error('วันที่ย้ายออกต้องไม่ก่อนวันที่เข้าพัก (' + String(occ.CheckInDate).substring(0, 10) + ')');
    }
    updateRowById_(SHEETS.OCCUPANCY, 'OccupancyID', d.occupancyId, {
      Status: 'CheckedOut',
      ActualCheckOutDate: checkOutDate,
      Remark: (occ.Remark ? occ.Remark + ' | ' : '') + (d.remark || 'เช็คเอาท์'),
      UpdatedAt: nowStr_()
    });

    logAudit_(userEmail, 'CHECK-OUT', 'Occupancy', d.occupancyId, 'เช็คเอาท์พนักงาน ' + occ.EmployeeID + ' ออกจากห้อง ' + occ.RoomID);
    const releasedParking = releaseParkingForEmployee_(occ.EmployeeID, userEmail, 'คืนช่องจอดอัตโนมัติเมื่อเช็คเอาท์');
    return { occupancyId: d.occupancyId, releasedParking: releasedParking };
  },

  transferRoom: function (body, userEmail) {
    const d = body.data;
    const oldOcc = findRowObject_(SHEETS.OCCUPANCY, 'OccupancyID', d.occupancyId);
    if (!oldOcc || oldOcc.Status !== 'Active') {
      throw new Error('ไม่พบข้อมูลการเข้าพักเดิมที่ Active');
    }
    if (!d.newRoomId) {
      throw new Error('กรุณาเลือกห้องพักใหม่ที่ต้องการย้ายไป');
    }
    if (String(d.newRoomId) === String(oldOcc.RoomID)) {
      throw new Error('ห้องใหม่ต้องไม่ใช่ห้องเดิม');
    }

    const newRoom = findRowObject_(SHEETS.ROOMS, 'RoomID', d.newRoomId);
    assertRoomUsable_(newRoom);

    const activeOcc = sheetToObjects_(SHEETS.OCCUPANCY).filter(function (o) { return o.Status === 'Active'; });
    const capacity = Math.max(Number(newRoom.Capacity) || 1, 1);
    const newRoomOccupants = activeOcc.filter(function (o) { return String(o.RoomID) === String(d.newRoomId); });

    if (newRoomOccupants.length >= capacity) {
      throw new Error('ห้องใหม่ที่เลือกเต็มแล้ว (ความจุ ' + capacity + ' คน)');
    }

    let bedNumber = Number(d.newBedNumber) || 0;
    const occupiedBedNums = newRoomOccupants.map(function (o) { return Number(o.BedNumber) || 0; });
    if (!bedNumber || occupiedBedNums.indexOf(bedNumber) !== -1) {
      for (let i = 1; i <= capacity; i++) {
        if (occupiedBedNums.indexOf(i) === -1) {
          bedNumber = i;
          break;
        }
      }
    }

    const transferDate = d.transferDate || nowStr_().split(' ')[0];
    if (transferDate < String(oldOcc.CheckInDate).substring(0, 10)) {
      throw new Error('วันที่ย้ายห้องต้องไม่ก่อนวันที่เข้าพักเดิม (' + String(oldOcc.CheckInDate).substring(0, 10) + ')');
    }

    updateRowById_(SHEETS.OCCUPANCY, 'OccupancyID', d.occupancyId, {
      Status: 'Transferred',
      ActualCheckOutDate: transferDate,
      Remark: (oldOcc.Remark ? oldOcc.Remark + ' | ' : '') + 'ย้ายไปห้อง ' + (newRoom.RoomNumber || d.newRoomId) + (d.reason ? ' (' + d.reason + ')' : '') + (d.remark ? ' | ' + d.remark : ''),
      UpdatedAt: nowStr_()
    });

    const newOccupancyId = generateId_('OCC');
    appendRow_(SHEETS.OCCUPANCY, {
      OccupancyID: newOccupancyId,
      EmployeeID: oldOcc.EmployeeID,
      RoomID: d.newRoomId,
      BedID: 'BED-' + d.newRoomId + '-' + bedNumber,
      BedNumber: bedNumber,
      CheckInDate: transferDate,
      ExpectedCheckOutDate: oldOcc.ExpectedCheckOutDate || '',
      ActualCheckOutDate: '',
      Status: 'Active',
      Remark: 'ย้ายมาจากห้องเดิม (OCC: ' + d.occupancyId + ')',
      CreatedAt: nowStr_(),
      UpdatedAt: nowStr_()
    });

    try {
      const parkings = sheetToObjects_(SHEETS.PARKING).filter(function (p) {
        return p.Status === 'Occupied' && String(p.EmployeeID) === String(oldOcc.EmployeeID);
      });
      parkings.forEach(function (p) {
        updateRowById_(SHEETS.PARKING, 'SlotID', p.SlotID, {
          RoomID: d.newRoomId,
          UpdatedAt: nowStr_()
        });
      });
    } catch (e) {
      console.warn('Update parking room on transfer failed:', e);
    }

    logAudit_(userEmail, 'TRANSFER', 'Occupancy', newOccupancyId, 'ย้ายพนักงาน ' + oldOcc.EmployeeID + ' จากห้อง ' + oldOcc.RoomID + ' ไปห้อง ' + newRoom.RoomNumber);
    return { newOccupancyId: newOccupancyId };
  },

  getParking: function () {
    const slots = sheetToObjects_(SHEETS.PARKING).filter(function (s) { return s.Status !== 'Deleted'; });
    const empMap = {}, roomMap = {}, roomNumMap = {}, bldMap = {}, occByEmp = {};
    sheetToObjects_(SHEETS.EMPLOYEES).forEach(function (e) { empMap[String(e.EmployeeID)] = e; });
    sheetToObjects_(SHEETS.ROOMS).forEach(function (r) {
      roomMap[String(r.RoomID)] = r;
      if (r.RoomNumber) roomNumMap[String(r.RoomNumber).trim()] = r;
    });
    sheetToObjects_(SHEETS.BUILDINGS).forEach(function (b) { bldMap[String(b.BuildingID)] = b; });
    sheetToObjects_(SHEETS.OCCUPANCY).filter(function (o) { return o.Status === 'Active'; })
      .forEach(function (o) { occByEmp[String(o.EmployeeID)] = o; });

    return slots.map(function (s) {
      const isOcc = s.Status === 'Occupied';
      const emp = empMap[String(s.EmployeeID)] || {};
      const curOcc = isOcc ? occByEmp[String(s.EmployeeID)] : null;
      const targetRoomKey = String(curOcc ? curOcc.RoomID : s.RoomID).trim();
      const room = roomMap[targetRoomKey] || roomNumMap[targetRoomKey] || {};
      const bld = bldMap[String(room.BuildingID)] || {};
      const fullName = emp.FullName || ((emp.FirstName || '') + ' ' + (emp.LastName || '')).trim() || (s.EmployeeID ? s.EmployeeID : '');
      const isResident = !!curOcc;
      const isNonResident = isOcc && !curOcc && (String(s.RoomID).toUpperCase() === 'NON_RESIDENT' || !s.RoomID);
      let roomDisplay = '';
      let bldDisplay = '';
      if (isOcc) {
        if (isResident) {
          roomDisplay = room.RoomNumber || s.RoomID || '-';
          bldDisplay = bld.BuildingName || ('อาคาร ' + (room.BuildingID || '-'));
        } else if (isNonResident) {
          roomDisplay = 'พนักงานทั่วไป';
          bldDisplay = 'ไม่ได้พักหอพัก';
        } else {
          roomDisplay = room.RoomNumber || s.RoomID || 'พนักงานทั่วไป';
          bldDisplay = bld.BuildingName || '-';
        }
      }
      return Object.assign({}, s, {
        ownerName: isOcc ? fullName : '',
        ownerDepartment: emp.Department || '',
        ownerPhone: emp.Phone || '',
        isResident: isResident,
        isNonResident: isNonResident,
        roomNumber: roomDisplay,
        buildingName: bldDisplay,
        needsReview: isOcc && !curOcc && !isNonResident
      });
    });
  },

  saveParkingSlot: function (body, userEmail) {
    const d = body.data;
    const slotNumber = String(d.slotNumber || '').trim();
    if (!slotNumber) {
      throw new Error('กรุณาระบุเลขช่องจอดรถ (เช่น P-01 หรือ M-01)');
    }
    if (['Car', 'Motorcycle'].indexOf(d.vehicleType || 'Car') === -1) throw new Error('ประเภทยานพาหนะไม่ถูกต้อง');

    const dup = sheetToObjects_(SHEETS.PARKING).find(function (p) {
      return p.Status !== 'Deleted' && String(p.SlotNumber).trim().toLowerCase() === slotNumber.toLowerCase() && String(p.SlotID) !== String(d.slotId || '');
    });
    if (dup) throw new Error('เลขช่องจอด ' + slotNumber + ' มีอยู่ในระบบแล้ว');

    if (d.slotId) {
      const cur = findRowObject_(SHEETS.PARKING, 'SlotID', d.slotId);
      if (!cur) throw new Error('ไม่พบช่องจอดรถที่ต้องการแก้ไข');
      const patch = {
        SlotNumber: slotNumber,
        Zone: d.zone || 'ทั่วไป',
        Remark: d.remark || '',
        UpdatedAt: nowStr_()
      };
      if (cur.Status === 'Occupied') {
        if (d.vehicleType && d.vehicleType !== cur.VehicleType) throw new Error('ไม่สามารถเปลี่ยนประเภทช่องที่มีผู้จองอยู่ได้ กรุณาคืนช่องก่อน');
      } else {
        patch.VehicleType = d.vehicleType || 'Car';
        patch.Status = (d.status === 'Maintenance') ? 'Maintenance' : 'Available';
      }
      updateRowById_(SHEETS.PARKING, 'SlotID', d.slotId, patch);
      logAudit_(userEmail, 'UPDATE', 'Parking', d.slotId, 'แก้ไขช่องจอด ' + slotNumber);
      return { slotId: d.slotId };
    } else {
      const slotId = generateId_('PARK');
      appendRow_(SHEETS.PARKING, {
        SlotID: slotId,
        SlotNumber: slotNumber,
        Zone: d.zone || 'ทั่วไป',
        VehicleType: d.vehicleType || 'Car',
        Status: (d.status === 'Maintenance') ? 'Maintenance' : 'Available',
        EmployeeID: '',
        RoomID: '',
        LicensePlate: '',
        VehicleModel: '',
        AssignedDate: '',
        Remark: d.remark || '',
        CreatedAt: nowStr_(),
        UpdatedAt: nowStr_()
      });
      logAudit_(userEmail, 'CREATE', 'Parking', slotId, 'เพิ่มช่องจอดใหม่ ' + slotNumber);
      return { slotId: slotId };
    }
  },

  assignParking: function (body, userEmail) {
    const d = body.data;
    const plate = String(d.licensePlate || '').trim();
    if (!d.slotId || !d.employeeId || !plate) {
      throw new Error('กรุณาระบุช่องจอดรถ พนักงานผู้จอง และทะเบียนรถ');
    }

    const slot = findRowObject_(SHEETS.PARKING, 'SlotID', d.slotId);
    if (!slot || slot.Status === 'Deleted') throw new Error('ไม่พบช่องจอดรถที่เลือก');
    if (slot.Status === 'Occupied') throw new Error('ช่องจอดนี้มีผู้ใช้งานอยู่แล้ว');
    if (slot.Status === 'Maintenance') throw new Error('ช่องจอดนี้อยู่ระหว่างปิดปรับปรุง');

    const emp = findRowObject_(SHEETS.EMPLOYEES, 'EmployeeID', d.employeeId);
    if (!emp || emp.Status === 'Deleted') throw new Error('ไม่พบพนักงานรหัส ' + d.employeeId);

    const activeOcc = sheetToObjects_(SHEETS.OCCUPANCY).find(function (o) {
      return o.Status === 'Active' && String(o.EmployeeID) === String(d.employeeId);
    });
    // พนักงานพักหอ -> ดึง RoomID อัตโนมัติ, พนักงานทั่วไป (ไม่ได้พักหอ) -> ระบุเป็น NON_RESIDENT
    const assignedRoomId = activeOcc ? activeOcc.RoomID : 'NON_RESIDENT';

    const taken = sheetToObjects_(SHEETS.PARKING).filter(function (p) { return p.Status === 'Occupied'; });
    const normPlate_ = function (s) { return String(s || '').replace(/[\s\-]+/g, '').toLowerCase(); };
    if (taken.some(function (p) { return normPlate_(p.LicensePlate) === normPlate_(plate) && String(p.SlotID) !== String(d.slotId); })) {
      throw new Error('ทะเบียน ' + plate + ' ถูกจองช่องจอดอื่นอยู่แล้ว');
    }
    if (taken.some(function (p) { return String(p.EmployeeID) === String(d.employeeId) && p.VehicleType === slot.VehicleType && String(p.SlotID) !== String(d.slotId); })) {
      throw new Error('พนักงานคนนี้มีช่องจอด' + (slot.VehicleType === 'Car' ? 'รถยนต์' : 'มอเตอร์ไซค์') + 'อยู่แล้ว (1 คน / 1 ช่องต่อประเภท) หากต้องการเปลี่ยนให้คืนช่องเดิมก่อน');
    }

    updateRowById_(SHEETS.PARKING, 'SlotID', d.slotId, {
      Status: 'Occupied',
      EmployeeID: d.employeeId,
      RoomID: assignedRoomId,
      LicensePlate: plate,
      VehicleModel: d.vehicleModel || '',
      AssignedDate: d.assignedDate || nowStr_().split(' ')[0],
      Remark: d.remark || '',
      UpdatedAt: nowStr_()
    });

    const roomDesc = activeOcc ? ('ห้อง ' + assignedRoomId) : 'พนักงานทั่วไป (ไม่ได้พักหอ)';
    logAudit_(userEmail, 'ASSIGN', 'Parking', d.slotId, 'จองช่องจอด ' + slot.SlotNumber + ' ให้พนักงาน ' + d.employeeId + ' [' + roomDesc + '] (ทะเบียน: ' + plate + ')');
    return { slotId: d.slotId, roomId: assignedRoomId, isResident: !!activeOcc };
  },

  releaseParking: function (body, userEmail) {
    const d = body.data;
    const slot = findRowObject_(SHEETS.PARKING, 'SlotID', d.slotId);
    if (!slot || slot.Status === 'Deleted') throw new Error('ไม่พบช่องจอดรถที่ต้องการยกเลิก');
    if (slot.Status !== 'Occupied') throw new Error('ช่องจอดนี้ไม่มีผู้จองอยู่');

    updateRowById_(SHEETS.PARKING, 'SlotID', d.slotId, {
      Status: 'Available',
      EmployeeID: '',
      RoomID: '',
      LicensePlate: '',
      VehicleModel: '',
      AssignedDate: '',
      Remark: d.remark || 'ยกเลิกการจอง/คืนช่องจอด',
      UpdatedAt: nowStr_()
    });

    logAudit_(userEmail, 'RELEASE', 'Parking', d.slotId, 'ยกเลิกการจองช่องจอด ' + slot.SlotNumber + ' (เดิม: ' + slot.EmployeeID + ' / ' + slot.LicensePlate + ')');
    return { slotId: d.slotId };
  },

  deleteParkingSlot: function (body, userEmail) {
    const slotId = body.slotId;
    const slot = findRowObject_(SHEETS.PARKING, 'SlotID', slotId);
    if (!slot) throw new Error('ไม่พบช่องจอดรถที่ต้องการลบ');
    if (slot.Status === 'Occupied') {
      throw new Error('ไม่สามารถลบช่องจอดที่มีผู้ใช้งานอยู่ได้ กรุณายกเลิกการจองก่อนลบ');
    }

    updateRowById_(SHEETS.PARKING, 'SlotID', slotId, { Status: 'Deleted', UpdatedAt: nowStr_() });
    logAudit_(userEmail, 'DELETE', 'Parking', slotId, 'ลบช่องจอดรถ ' + slot.SlotNumber);
    return { slotId: slotId };
  },

  getSettings: function () {
    const rows = sheetToObjects_(SHEETS.SETTINGS);
    const out = {};
    rows.forEach(function (r) { out[r.Key] = r.Value; });
    return out;
  },

  saveSettings: function (body, userEmail) {
    const d = body.data || {};
    // ตรวจค่าตั้งค่ามิเตอร์/บิลก่อนบันทึก (กันค่าเพี้ยนทำให้บิลผิด)
    ['ELEC_RATE', 'WATER_RATE', 'ELEC_MIN_CHARGE', 'WATER_MIN_CHARGE', 'VAT_RATE', 'METER_MAX_ELEC', 'METER_MAX_WATER'].forEach(function (k) {
      if (d[k] !== undefined && d[k] !== '' && !(isFinite(Number(d[k])) && Number(d[k]) >= 0)) {
        throw new Error('ค่าตั้งค่า ' + k + ' ต้องเป็นตัวเลขที่ไม่ติดลบ');
      }
    });
    if (d.BILL_DUE_DAY !== undefined && d.BILL_DUE_DAY !== '' && !(Number(d.BILL_DUE_DAY) >= 1 && Number(d.BILL_DUE_DAY) <= 28)) {
      throw new Error('วันครบกำหนดชำระต้องอยู่ระหว่าง 1 - 28');
    }
    if (d.BILL_INCLUDE_RENT !== undefined && ['Yes', 'No'].indexOf(String(d.BILL_INCLUDE_RENT)) === -1) {
      throw new Error('ค่า BILL_INCLUDE_RENT ต้องเป็น Yes หรือ No');
    }
    Object.keys(d).forEach(function (key) {
      const existing = findRowObject_(SHEETS.SETTINGS, 'Key', key);
      if (existing) {
        updateRowById_(SHEETS.SETTINGS, 'Key', key, { Value: d[key] });
      } else {
        appendRow_(SHEETS.SETTINGS, { Key: key, Value: d[key] });
      }
    });
    logAudit_(userEmail, 'UPDATE', 'Settings', '-', 'ปรับปรุงการตั้งค่าระบบ');
    return d;
  },

  getRoomAssets: function (body) {
    const assets = sheetToObjects_(SHEETS.ASSETS).filter(function (a) { return a.Status !== 'Deleted'; });
    const rooms = sheetToObjects_(SHEETS.ROOMS).filter(function (r) { return r.Status !== 'Deleted'; });
    const blds = sheetToObjects_(SHEETS.BUILDINGS).filter(function (b) { return b.Status !== 'Deleted'; });
    const roomMap = {}, bldMap = {};
    rooms.forEach(function (r) { roomMap[String(r.RoomID)] = r; });
    blds.forEach(function (b) { bldMap[String(b.BuildingID)] = b; });

    const targetRoomId = (body && body.roomId) ? String(body.roomId).trim() : null;
    const list = targetRoomId ? assets.filter(function (a) { return String(a.RoomID).trim() === targetRoomId; }) : assets;

    return list.map(function (a) {
      const room = roomMap[String(a.RoomID)] || {};
      const bld = bldMap[String(room.BuildingID)] || {};
      return Object.assign({}, a, {
        RoomNumber: room.RoomNumber || a.RoomID || '-',
        BuildingID: room.BuildingID || '',
        BuildingName: bld.BuildingName || ('อาคาร ' + (room.BuildingID || '-')),
        Floor: room.Floor || '1'
      });
    });
  },

  saveAsset: function (body, userEmail) {
    const d = body.data;
    if (!d || !d.roomId || !d.assetName) {
      throw new Error('กรุณาระบุห้องพัก และชื่อทรัพย์สิน/ครุภัณฑ์');
    }
    const room = findRowObject_(SHEETS.ROOMS, 'RoomID', d.roomId);
    if (!room || room.Status === 'Deleted') {
      throw new Error('ไม่พบห้องพักที่ระบุ');
    }

    const assetName = String(d.assetName).trim();
    const assetCode = String(d.assetCode || '').trim();
    const category = d.category || 'เฟอร์นิเจอร์';
    const quantity = Math.max(Number(d.quantity) || 1, 1);
    const status = d.status || 'Normal';
    const condition = d.condition || 'ปกติ';
    const remark = d.remark || '';

    if (d.assetId) {
      const cur = findRowObject_(SHEETS.ASSETS, 'AssetID', d.assetId);
      if (!cur || cur.Status === 'Deleted') throw new Error('ไม่พบครุภัณฑ์ที่ต้องการแก้ไข');
      updateRowById_(SHEETS.ASSETS, 'AssetID', d.assetId, {
        RoomID: d.roomId,
        AssetName: assetName,
        AssetCode: assetCode || cur.AssetCode || d.assetId,
        Category: category,
        Quantity: quantity,
        Status: status,
        Condition: condition,
        Remark: remark,
        UpdatedAt: nowStr_()
      });
      logAudit_(userEmail, 'UPDATE', 'Assets', d.assetId, 'แก้ไขครุภัณฑ์ ' + assetName + ' ห้อง ' + room.RoomNumber);
      return { assetId: d.assetId };
    } else {
      const assetId = generateId_('AST');
      appendRow_(SHEETS.ASSETS, {
        AssetID: assetId,
        RoomID: d.roomId,
        AssetName: assetName,
        AssetCode: assetCode || assetId,
        Category: category,
        Quantity: quantity,
        Status: status,
        Condition: condition,
        Remark: remark,
        CreatedAt: nowStr_(),
        UpdatedAt: nowStr_()
      });
      logAudit_(userEmail, 'CREATE', 'Assets', assetId, 'เพิ่มครุภัณฑ์ใหม่ ' + assetName + ' ห้อง ' + room.RoomNumber);
      return { assetId: assetId };
    }
  },

  deleteAsset: function (body, userEmail) {
    const assetId = body.assetId;
    if (!assetId) throw new Error('กรุณาระบุรหัสครุภัณฑ์ที่ต้องการลบ');
    const cur = findRowObject_(SHEETS.ASSETS, 'AssetID', assetId);
    if (!cur || cur.Status === 'Deleted') throw new Error('ไม่พบครุภัณฑ์ที่ต้องการลบ');
    updateRowById_(SHEETS.ASSETS, 'AssetID', assetId, { Status: 'Deleted', UpdatedAt: nowStr_() });
    logAudit_(userEmail, 'DELETE', 'Assets', assetId, 'ลบครุภัณฑ์ ' + cur.AssetName + ' (' + assetId + ')');
    return { assetId: assetId };
  },

  addDefaultAssetsForRoom: function (body, userEmail) {
    const roomId = body.roomId;
    if (!roomId) throw new Error('กรุณาระบุรหัสห้องพัก');
    const room = findRowObject_(SHEETS.ROOMS, 'RoomID', roomId);
    if (!room || room.Status === 'Deleted') throw new Error('ไม่พบห้องพัก');
    const dupDefault = sheetToObjects_(SHEETS.ASSETS).some(function (a) {
      return a.Status !== 'Deleted' && String(a.RoomID) === String(roomId) && String(a.Remark || '').indexOf('ชุดมาตรฐานประจำห้อง') === 0;
    });
    if (dupDefault) throw new Error('ห้อง ' + room.RoomNumber + ' มีชุดครุภัณฑ์มาตรฐานอยู่แล้ว (กันสร้างซ้ำ) หากต้องการสร้างใหม่ให้ลบรายการเดิมก่อน');
    const cap = Math.max(Number(room.Capacity) || 1, 1);
    const rawHasAc = String(room.HasAirConditioner || '').trim().toLowerCase();
    const hasAc = (rawHasAc !== 'no' && rawHasAc !== 'false' && rawHasAc !== 'ไม่มี');

    const defaultItems = [
      { name: hasAc ? 'เครื่องปรับอากาศ' : 'พัดลมติดผนัง / ตั้งพื้น', cat: 'เครื่องใช้ไฟฟ้า', qty: 1, cond: 'สภาพดี' },
      { name: 'เตียงนอนเดี่ยว 3.5 ฟุต', cat: 'เฟอร์นิเจอร์', qty: cap, cond: 'สภาพดี' },
      { name: 'ฟูกที่นอน 3.5 ฟุต', cat: 'เครื่องนอน', qty: cap, cond: 'สภาพดี' },
      { name: 'ตู้เสื้อผ้า', cat: 'เฟอร์นิเจอร์', qty: cap, cond: 'สภาพดี' },
      { name: 'โต๊ะทำงานพร้อมเก้าอี้', cat: 'เฟอร์นิเจอร์', qty: cap, cond: 'สภาพดี' },
      { name: 'กุญแจห้องพัก / คีย์การ์ด', cat: 'ความปลอดภัย', qty: cap, cond: 'สภาพดี' }
    ];

    const now = nowStr_();
    defaultItems.forEach(function (item) {
      const astId = generateId_('AST');
      appendRow_(SHEETS.ASSETS, {
        AssetID: astId,
        RoomID: roomId,
        AssetName: item.name,
        AssetCode: astId,
        Category: item.cat,
        Quantity: item.qty,
        Status: 'Normal',
        Condition: item.cond,
        Remark: 'ชุดมาตรฐานประจำห้อง (' + room.RoomNumber + ')',
        CreatedAt: now,
        UpdatedAt: now
      });
    });
    logAudit_(userEmail, 'CREATE', 'Assets', roomId, 'เพิ่มชุดครุภัณฑ์มาตรฐาน ' + defaultItems.length + ' รายการให้ห้อง ' + room.RoomNumber);
    return { count: defaultItems.length };
  }
};


// =====================================================================
//  โมดูลมิเตอร์น้ำ-ไฟ / บิล / ใบเสร็จ (รวมจาก Meters.gs เดิม — ไม่ต้องมีไฟล์ Meters.gs แยกอีกแล้ว)
// =====================================================================

// ---------- helper (ตั้งชื่อขึ้นต้น m... กันชนกับ Code.gs) ----------
function mNum_(v) { const x = Number(v); return isFinite(x) ? x : 0; }
function mBlank_(v) { return v === '' || v === null || v === undefined; }
function mRound2_(v) { return Math.round((Number(v) || 0) * 100) / 100; }
function mPeriodOk_(p) { return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(p || '')); }
function mDateOk_(d) { return /^\d{4}-\d{2}-\d{2}$/.test(String(d || '')); }
function mTodayStr_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }

/** รหัสงวดสำหรับเลขที่เอกสาร ใช้ปี พ.ศ. เช่น 2026-11 -> 256911 */
function mDocPrefix_(period) {
  return String(Number(period.substring(0, 4)) + 543) + period.substring(5, 7);
}

/** หาลำดับถัดไปของเลขที่เอกสารที่ขึ้นต้นด้วย prefix (เช่น "INV-256911-") */
function mNextSeq_(prefix, docNos) {
  let max = 0;
  docNos.forEach(function (no) {
    const s = String(no || '').trim();
    if (s.indexOf(prefix) === 0) {
      const n = parseInt(s.substring(prefix.length), 10);
      if (isFinite(n) && n > max) max = n;
    }
  });
  const n = max + 1;
  return n < 1000 ? ('00' + n).slice(-3) : String(n);
}

function mSettings_() {
  const out = {};
  sheetToObjects_(SHEETS.SETTINGS).forEach(function (r) { out[r.Key] = r.Value; });
  return out;
}

function mEmployeeName_(e, fallback) {
  if (!e) return fallback || '';
  return e.FullName || ((e.FirstName || '') + ' ' + (e.LastName || '')).trim() || fallback || '';
}

/** วันครบกำหนด = วันที่ BILL_DUE_DAY ของเดือนถัดจากงวดบิล */
function mDueDate_(period, dueDay) {
  let y = Number(period.substring(0, 4));
  let m = Number(period.substring(5, 7)) + 1;
  if (m > 12) { m = 1; y += 1; }
  let day = Math.floor(mNum_(dueDay));
  if (day < 1) day = 5;
  if (day > 28) day = 28;
  return y + '-' + ('0' + m).slice(-2) + '-' + ('0' + day).slice(-2);
}

/** คำนวณหน่วยที่ใช้ รองรับมิเตอร์วนครบรอบ (ต้องยืนยัน rollover จากผู้ใช้เท่านั้น) */
function mUnits_(label, prev, curr, rollover, max) {
  if (curr < prev) {
    if (!rollover) {
      throw new Error('เลขมิเตอร์' + label + 'ครั้งนี้ (' + curr + ') น้อยกว่าครั้งก่อน (' + prev + ') กรุณาตรวจสอบ หรือยืนยันว่ามิเตอร์ครบรอบ');
    }
    if (!(max > 0)) {
      throw new Error('ยังไม่ได้ตั้งค่า "เลขมิเตอร์' + label + 'สูงสุด" ในแท็บตั้งค่าอัตรา จึงคำนวณมิเตอร์ครบรอบไม่ได้');
    }
    if (prev > max || curr > max) {
      throw new Error('เลขมิเตอร์' + label + 'เกินค่าสูงสุดที่ตั้งไว้ (' + max + ')');
    }
    return mRound2_(max + 1 - prev + curr);
  }
  return mRound2_(curr - prev);
}

function mLoadBill_(billId) {
  const bill = findRowObject_(SHEETS.BILLS, 'BillID', billId);
  if (!bill) throw new Error('ไม่พบบิลที่ต้องการ');
  return bill;
}

// ---------- API actions ----------
const MeterActions = {

  /** ตารางจดมิเตอร์ของรอบบิล: ทุกห้อง + เลขครั้งก่อน + มิเตอร์/บิลของรอบนี้ */
  getMeterSheet: function (body) {
    const period = String(body.period || '').trim();
    if (!mPeriodOk_(period)) throw new Error('รอบบิลไม่ถูกต้อง (ต้องเป็นรูปแบบ yyyy-MM)');

    const settings = mSettings_();
    const rooms = sheetToObjects_(SHEETS.ROOMS).filter(function (r) { return r.Status !== 'Deleted'; });
    const bldMap = {}, empMap = {}, tenantsByRoom = {};
    sheetToObjects_(SHEETS.BUILDINGS).forEach(function (b) { bldMap[String(b.BuildingID)] = b; });
    sheetToObjects_(SHEETS.EMPLOYEES).forEach(function (e) { empMap[String(e.EmployeeID)] = e; });
    sheetToObjects_(SHEETS.OCCUPANCY).filter(function (o) { return o.Status === 'Active'; }).forEach(function (o) {
      const k = String(o.RoomID);
      (tenantsByRoom[k] = tenantsByRoom[k] || []).push(mEmployeeName_(empMap[String(o.EmployeeID)], o.EmployeeID));
    });

    const readingsByRoom = {};
    sheetToObjects_(SHEETS.METER_READINGS).forEach(function (x) {
      const k = String(x.RoomID);
      (readingsByRoom[k] = readingsByRoom[k] || []).push(x);
    });
    const billsAll = sheetToObjects_(SHEETS.BILLS);

    const rows = rooms.map(function (r) {
      const roomId = String(r.RoomID);
      const list = readingsByRoom[roomId] || [];
      const reading = list.filter(function (x) { return String(x.Period) === period; })[0] || null;
      const prevList = list.filter(function (x) { return String(x.Period) < period; })
        .sort(function (a, b) { return String(b.Period).localeCompare(String(a.Period)); });
      const prev = prevList[0] || null;
      const bill = billsAll.filter(function (b) {
        return String(b.RoomID) === roomId && String(b.Period) === period && b.Status !== 'Cancelled';
      })[0] || null;
      const tenants = tenantsByRoom[roomId] || [];
      const bld = bldMap[String(r.BuildingID)] || {};
      return {
        roomId: r.RoomID,
        roomNumber: r.RoomNumber,
        buildingName: bld.BuildingName || ('อาคาร ' + (r.BuildingID || '')),
        monthlyRate: mNum_(r.MonthlyRate),
        roomStatus: r.Status || 'Active',
        tenants: tenants,
        occupiedCount: tenants.length,
        prevElec: prev ? prev.ElecCurr : '',
        prevWater: prev ? prev.WaterCurr : '',
        reading: reading,
        bill: bill
      };
    });

    return { period: period, settings: settings, rows: rows };
  },

  /** บันทึกเลขมิเตอร์ + ออก/อัปเดตใบแจ้งหนี้ของห้อง/รอบนั้น */
  saveMeterReading: function (body, userEmail) {
    const d = body.data || {};
    const period = String(d.period || '').trim();
    if (!d.roomId) throw new Error('ไม่พบรหัสห้อง');
    if (!mPeriodOk_(period)) throw new Error('รอบบิลไม่ถูกต้อง (ต้องเป็นรูปแบบ yyyy-MM)');

    const room = findRowObject_(SHEETS.ROOMS, 'RoomID', d.roomId);
    if (!room || room.Status === 'Deleted') throw new Error('ไม่พบห้องพักที่เลือก');

    const st = mSettings_();
    const elecRate = mNum_(st.ELEC_RATE), waterRate = mNum_(st.WATER_RATE);
    if (!(elecRate > 0) || !(waterRate > 0)) {
      throw new Error('ยังไม่ได้ตั้งอัตราค่าไฟ/ค่าน้ำ กรุณาตั้งค่าในแท็บ "ตั้งค่าอัตรา" ก่อนออกบิล');
    }

    ['elecPrev', 'elecCurr', 'waterPrev', 'waterCurr'].forEach(function (k) {
      if (mBlank_(d[k]) || !isFinite(Number(d[k])) || Number(d[k]) < 0) {
        throw new Error('เลขมิเตอร์ไม่ถูกต้อง (' + k + ') ต้องกรอกเป็นตัวเลขที่ไม่ติดลบ');
      }
    });
    const elecPrev = Number(d.elecPrev), elecCurr = Number(d.elecCurr);
    const waterPrev = Number(d.waterPrev), waterCurr = Number(d.waterCurr);

    const elecUnits = mUnits_('ไฟฟ้า', elecPrev, elecCurr, !!d.elecRollover, mNum_(st.METER_MAX_ELEC));
    const waterUnits = mUnits_('น้ำ', waterPrev, waterCurr, !!d.waterRollover, mNum_(st.METER_MAX_WATER));

    const otherFee = Math.max(mRound2_(d.otherFee), 0);
    const discount = Math.max(mRound2_(d.discount), 0);
    const otherFeeNote = String(d.otherFeeNote || '').trim().substring(0, 200);

    const elecAmount = mRound2_(Math.max(elecUnits * elecRate, mNum_(st.ELEC_MIN_CHARGE)));
    const waterAmount = mRound2_(Math.max(waterUnits * waterRate, mNum_(st.WATER_MIN_CHARGE)));
    const taxable = mRound2_(elecAmount + waterAmount + otherFee - discount);
    if (taxable < 0) throw new Error('ส่วนลดมากกว่ายอดค่าไฟ/ค่าน้ำ/ค่าอื่น ๆ รวมกัน');
    const roomRent = String(st.BILL_INCLUDE_RENT) === 'Yes' ? mRound2_(room.MonthlyRate) : 0;
    const vatRate = mNum_(st.VAT_RATE);
    const vatAmount = mRound2_(taxable * vatRate / 100);   // VAT คิดเฉพาะค่าไฟ/น้ำ/อื่น ๆ ไม่คิดกับค่าเช่า
    const total = mRound2_(roomRent + taxable + vatAmount);

    // ข้อมูลผู้พัก ณ เวลาออกบิล
    const empMap = {};
    sheetToObjects_(SHEETS.EMPLOYEES).forEach(function (e) { empMap[String(e.EmployeeID)] = e; });
    const tenants = sheetToObjects_(SHEETS.OCCUPANCY).filter(function (o) {
      return o.Status === 'Active' && String(o.RoomID) === String(d.roomId);
    }).map(function (o) { return mEmployeeName_(empMap[String(o.EmployeeID)], o.EmployeeID); });
    const bld = findRowObject_(SHEETS.BUILDINGS, 'BuildingID', room.BuildingID) || {};
    const now = nowStr_();

    // เลขมิเตอร์ของรอบนี้ (1 ห้อง / 1 รอบ)
    const existingReading = sheetToObjects_(SHEETS.METER_READINGS).filter(function (x) {
      return String(x.RoomID) === String(d.roomId) && String(x.Period) === period;
    })[0];

    // บิลเดิมของรอบนี้ (ที่ยังไม่ยกเลิก)
    const billsAll = sheetToObjects_(SHEETS.BILLS);
    const existingBill = billsAll.filter(function (b) {
      return String(b.RoomID) === String(d.roomId) && String(b.Period) === period && b.Status !== 'Cancelled';
    })[0];
    if (existingBill && existingBill.Status === 'Paid') {
      throw new Error('บิลของห้องนี้ในรอบนี้ชำระแล้ว แก้ไขไม่ได้ หากต้องแก้ไขให้ยกเลิกการรับชำระก่อน');
    }

    const readingPatch = {
      ElecPrev: elecPrev, ElecCurr: elecCurr, ElecRollover: elecCurr < elecPrev ? 'Yes' : 'No',
      WaterPrev: waterPrev, WaterCurr: waterCurr, WaterRollover: waterCurr < waterPrev ? 'Yes' : 'No',
      ElecUnits: elecUnits, WaterUnits: waterUnits, ReadDate: mTodayStr_(), Status: 'Recorded',   // คอลัมน์เสริมในชีต (ถ้ามี)
      ReadBy: userEmail, UpdatedAt: now
    };
    if (existingReading) {
      updateRowById_(SHEETS.METER_READINGS, 'ReadingID', existingReading.ReadingID, readingPatch);
    } else {
      appendRow_(SHEETS.METER_READINGS, Object.assign({
        ReadingID: generateId_('RD'), RoomID: d.roomId, Period: period, CreatedAt: now
      }, readingPatch));
    }

    const billFields = {
      RoomNumber: room.RoomNumber,
      BuildingName: bld.BuildingName || '',
      TenantNames: tenants.join(', '),
      TenantCount: tenants.length,
      ElecPrev: elecPrev, ElecCurr: elecCurr, ElecUnits: elecUnits, ElecRate: elecRate, ElecAmount: elecAmount,
      WaterPrev: waterPrev, WaterCurr: waterCurr, WaterUnits: waterUnits, WaterRate: waterRate, WaterAmount: waterAmount,
      RoomRent: roomRent, OtherFee: otherFee, OtherFeeNote: otherFeeNote, Discount: discount,
      VatRate: vatRate, VatAmount: vatAmount, TotalAmount: total,
      DueDate: mDueDate_(period, st.BILL_DUE_DAY),
      UpdatedAt: now
    };

    let billNo;
    if (existingBill) {
      billNo = existingBill.BillNo;
      updateRowById_(SHEETS.BILLS, 'BillID', existingBill.BillID, billFields);
      logAudit_(userEmail, 'UPDATE', 'Bills', existingBill.BillID, 'แก้ไขบิล ' + billNo + ' ห้อง ' + room.RoomNumber + ' ยอด ' + total);
    } else {
      const prefix = 'INV-' + mDocPrefix_(period) + '-';
      billNo = prefix + mNextSeq_(prefix, billsAll.map(function (b) { return b.BillNo; }));
      const billId = generateId_('BILL');
      appendRow_(SHEETS.BILLS, Object.assign({
        BillID: billId, BillNo: billNo, ReceiptNo: '', Period: period, RoomID: d.roomId,
        IssueDate: mTodayStr_(), Status: 'Unpaid', PaidDate: '', PayMethod: '', PayerName: '', VoidedReceipts: '',
        CreatedAt: now
      }, billFields));
      logAudit_(userEmail, 'CREATE', 'Bills', billId, 'ออกบิล ' + billNo + ' ห้อง ' + room.RoomNumber + ' ยอด ' + total);
    }

    return { billNo: billNo, totalAmount: total, elecUnits: elecUnits, waterUnits: waterUnits };
  },

  /** รายการบิล (กรองตามรอบ/สถานะได้) */
  getBills: function (body) {
    const period = String(body.period || '').trim();
    const status = String(body.status || '').trim();
    return sheetToObjects_(SHEETS.BILLS).filter(function (b) {
      if (period && String(b.Period) !== period) return false;
      if (status && b.Status !== status) return false;
      return true;
    }).sort(function (a, b) { return String(a.BillNo).localeCompare(String(b.BillNo), 'th', { numeric: true }); });
  },

  /** รับชำระ + ออกเลขที่ใบเสร็จ */
  payBill: function (body, userEmail) {
    const d = body.data || {};
    const bill = mLoadBill_(d.billId);
    if (bill.Status !== 'Unpaid') throw new Error('บิลนี้ไม่อยู่ในสถานะรอชำระ');
    const paidDate = String(d.paidDate || '').trim();
    if (!mDateOk_(paidDate)) throw new Error('กรุณาระบุวันที่รับชำระให้ถูกต้อง');
    const issue = String(bill.IssueDate || '').substring(0, 10);
    if (issue && paidDate < issue) throw new Error('วันที่รับชำระต้องไม่ก่อนวันที่ออกบิล (' + issue + ')');

    // เลขที่ใบเสร็จห้ามซ้ำ/ห้ามนำกลับมาใช้ แม้จะเคยถูกยกเลิก (เก็บไว้ใน VoidedReceipts)
    const used = [];
    sheetToObjects_(SHEETS.BILLS).forEach(function (b) {
      if (b.ReceiptNo) used.push(b.ReceiptNo);
      String(b.VoidedReceipts || '').split(',').forEach(function (x) { if (x.trim()) used.push(x.trim()); });
    });
    const prefix = 'RC-' + mDocPrefix_(String(bill.Period)) + '-';
    const receiptNo = prefix + mNextSeq_(prefix, used);

    updateRowById_(SHEETS.BILLS, 'BillID', bill.BillID, {
      Status: 'Paid',
      ReceiptNo: receiptNo,
      PaidDate: paidDate,
      PayMethod: String(d.payMethod || '').substring(0, 50),
      PayerName: String(d.payerName || '').substring(0, 200),
      UpdatedAt: nowStr_()
    });
    logAudit_(userEmail, 'PAY', 'Bills', bill.BillID, 'รับชำระบิล ' + bill.BillNo + ' ห้อง ' + bill.RoomNumber + ' ใบเสร็จ ' + receiptNo + ' ยอด ' + bill.TotalAmount);
    return { receiptNo: receiptNo };
  },

  /** ยกเลิกการรับชำระ: ใบเสร็จเดิมถูกยกเลิก บิลกลับเป็นรอชำระ */
  voidPayment: function (body, userEmail) {
    const bill = mLoadBill_(body.billId);
    if (bill.Status !== 'Paid') throw new Error('บิลนี้ยังไม่ได้ชำระ');
    const voided = String(bill.VoidedReceipts || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean);
    if (bill.ReceiptNo) voided.push(bill.ReceiptNo);
    updateRowById_(SHEETS.BILLS, 'BillID', bill.BillID, {
      Status: 'Unpaid', ReceiptNo: '', PaidDate: '', PayMethod: '', PayerName: '',
      VoidedReceipts: voided.join(','), UpdatedAt: nowStr_()
    });
    logAudit_(userEmail, 'VOID', 'Bills', bill.BillID, 'ยกเลิกการรับชำระ ใบเสร็จ ' + bill.ReceiptNo + ' (บิล ' + bill.BillNo + ')');
    return { billId: bill.BillID };
  },

  /** ยกเลิกบิล (เฉพาะที่ยังไม่ชำระ) */
  cancelBill: function (body, userEmail) {
    const bill = mLoadBill_(body.billId);
    if (bill.Status === 'Paid') throw new Error('บิลที่ชำระแล้วยกเลิกไม่ได้ กรุณายกเลิกการรับชำระก่อน');
    if (bill.Status === 'Cancelled') throw new Error('บิลนี้ถูกยกเลิกไปแล้ว');
    updateRowById_(SHEETS.BILLS, 'BillID', bill.BillID, { Status: 'Cancelled', UpdatedAt: nowStr_() });
    logAudit_(userEmail, 'CANCEL', 'Bills', bill.BillID, 'ยกเลิกบิล ' + bill.BillNo + ' ห้อง ' + bill.RoomNumber);
    return { billId: bill.BillID };
  }
};