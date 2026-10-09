const SHEETS = {
  ROOMS: 'Rooms',
  EMPLOYEES: 'Employees',
  OCCUPANCY: 'Occupancy',
  BUILDINGS: 'Buildings',
  PARKING: 'Parking',
  SETTINGS: 'Settings',
  AUDIT_LOG: 'AuditLog'
};

const TZ = 'Asia/Bangkok';

// หัวคอลัมน์มาตรฐานของทุกตาราง (ใช้สร้างแผ่นงานที่ขาดหายอัตโนมัติ ไม่ให้ได้แผ่นงานหัวผิด)
const SHEET_HEADERS = {
  Rooms: ['RoomID', 'BuildingID', 'Floor', 'RoomNumber', 'RoomType', 'Capacity', 'Gender', 'MonthlyRate', 'Status', 'Remark', 'CreatedAt', 'UpdatedAt'],
  Employees: ['EmployeeID', 'Prefix', 'FirstName', 'LastName', 'FullName', 'Department', 'Position', 'Plant', 'Phone', 'Email', 'Status', 'CreatedAt', 'UpdatedAt'],
  Occupancy: ['OccupancyID', 'EmployeeID', 'RoomID', 'BedID', 'BedNumber', 'CheckInDate', 'ExpectedCheckOutDate', 'ActualCheckOutDate', 'Status', 'Remark', 'CreatedAt', 'UpdatedAt'],
  Buildings: ['BuildingID', 'BuildingCode', 'BuildingName', 'Location', 'NumberOfFloors', 'Status', 'Remark', 'CreatedAt', 'UpdatedAt'],
  Parking: ['SlotID', 'SlotNumber', 'Zone', 'VehicleType', 'Status', 'EmployeeID', 'RoomID', 'LicensePlate', 'VehicleModel', 'AssignedDate', 'Remark', 'CreatedAt', 'UpdatedAt'],
  Settings: ['Key', 'Value'],
  AuditLog: ['LogID', 'Timestamp', 'UserEmail', 'Action', 'Module', 'RecordID', 'Remark']
};

// คอลัมน์ที่ต้องเก็บเป็นข้อความเสมอ (กันเบอร์โทร/รหัสที่ขึ้นต้นด้วย 0 ถูกแปลงเป็นตัวเลข)
const TEXT_COLUMNS_ = ['EmployeeID', 'Phone', 'LicensePlate', 'RoomNumber', 'SlotNumber', 'BuildingCode',
  // คอลัมน์วันที่เก็บเป็นข้อความ yyyy-MM-dd เสมอ (กัน Sheets แปลงเป็น Date แล้ววันเพี้ยนตาม timezone)
  'CheckInDate', 'ExpectedCheckOutDate', 'ActualCheckOutDate', 'AssignedDate', 'CreatedAt', 'UpdatedAt', 'Timestamp'];

// คอลัมน์ที่ต้องแปลงเป็น String เสมอตอนอ่านจาก Sheets
// (ข้อมูลเก่า/ข้อมูลตัวอย่างอาจเป็นตัวเลข ทำให้ฝั่งหน้าเว็บเรียก .toLowerCase() แล้วพัง)
const STRING_ON_READ_ = ['EmployeeID', 'Phone', 'LicensePlate', 'RoomNumber', 'SlotNumber', 'BuildingCode',
  'RoomID', 'BuildingID', 'SlotID', 'OccupancyID', 'BedID', 'Floor', 'FloorID'];

/** รันฟังก์ชันนี้ 1 ครั้งหลังอัปเดตโค้ด เพื่อสร้างแผ่นงานที่ยังไม่มี (เช่น Parking) โดยไม่ลบข้อมูลเดิม */
function ensureAllSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEET_HEADERS).forEach(function (name) {
    if (!ss.getSheetByName(name)) {
      const sh = ss.insertSheet(name);
      const h = SHEET_HEADERS[name];
      sh.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold').setBackground('#1e3a8a').setFontColor('#ffffff');
      sh.setFrozenRows(1);
    }
  });
}

// ===================== ENTRY POINTS =====================

// action ที่อ่านข้อมูลอย่างเดียว ไม่ต้องใช้ Lock
// (ไม่งั้นหน้าเว็บที่เรียกหลาย API พร้อมกันจะต้องต่อคิวรอกัน และอาจ timeout 15 วินาที)
const READ_ACTIONS_ = ['getDashboardData', 'getRooms', 'getRoomById', 'getEmployees', 'getBuildings', 'getFloors',
  'getOccupancy', 'getParking', 'getSettings', 'getAuditLogs', 'getBeds', 'getRoomRequests', 'getRepairRequests',
  'getMaintenance', 'getRoomAssets', 'getKeys'];

function doPost(e) {
  let body = {};
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse_({ success: false, message: 'รูปแบบข้อมูลที่ส่งมาไม่ถูกต้อง (Invalid JSON)' });
  }

  const action = body.action;
  const userEmail = body.userEmail || 'admin@dormitory.com';

  // (ไม่บังคับ) ถ้าตั้ง Script Property ชื่อ API_TOKEN ไว้ ทุกคำขอต้องส่ง token ให้ตรงกัน
  const requiredToken = PropertiesService.getScriptProperties().getProperty('API_TOKEN');
  if (requiredToken && String(body.token || '') !== requiredToken) {
    return jsonResponse_({ success: false, message: 'รหัสเชื่อมต่อ (API Token) ไม่ถูกต้อง กรุณาตั้งค่าที่หน้า Admin > การตั้งค่า' });
  }

  // hasOwnProperty กัน action แปลก ๆ เช่น "constructor" / "toString" ที่ไปชี้ฟังก์ชันของ Object
  if (!action || !Object.prototype.hasOwnProperty.call(Actions, action) || typeof Actions[action] !== 'function') {
    return jsonResponse_({ success: false, message: 'ไม่พบคำสั่ง action "' + action + '" ในระบบ' });
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
    const result = Actions[action](body, userEmail);
    return jsonResponse_({ success: true, data: result });
  } catch (err) {
    return jsonResponse_({ success: false, message: err && err.message ? err.message : String(err) });
  } finally {
    if (!isRead) lock.releaseLock();
  }
}

function doGet(e) {
  return jsonResponse_({
    success: true,
    message: 'Dormitory API is running. (ระบบบริหารหอพักพนักงาน พร้อมระบบจองที่จอดรถ)',
    version: '2.2-parking'
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
  const row = headers.map(function (h) { return obj[h] !== undefined ? obj[h] : ''; });
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
      // แปลง Date เดิมเป็นข้อความก่อนเขียนกลับ (กันค่าวันที่ในเซลล์รูปแบบ Text เพี้ยน)
      const newRow = values[i].map(function (c) { return normalizeCell_(c); });
      headers.forEach(function (h, idx) {
        if (patch[h] !== undefined) newRow[idx] = patch[h];
      });
      // เขียนทั้งแถวในครั้งเดียว (เร็วกว่าเขียนทีละเซลล์มาก)
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

// ===================== HELPERS: กติกาธุรกิจ =====================

function assertRoomUsable_(room) {
  if (!room || room.Status === 'Deleted') throw new Error('ไม่พบห้องพักที่เลือก');
  if (room.Status === 'Maintenance') throw new Error('ห้อง ' + room.RoomNumber + ' อยู่ระหว่างปิดปรับปรุง ไม่สามารถใช้งานได้');
  if (room.Status === 'Inactive') throw new Error('ห้อง ' + room.RoomNumber + ' ไม่เปิดใช้งาน');
}

/** คืนช่องจอดทั้งหมดของพนักงาน (ใช้ตอนเช็คเอาท์/ลบพนักงาน) คืนค่าจำนวนช่องที่คืน */
function releaseParkingForEmployee_(employeeId, userEmail, reason) {
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
/**
 * คำนวณสถานะห้องพักแบบ Real-time:
 * 1. ว่าง (Available): 0 คนเข้าพัก
 * 2. ว่างบางส่วน (Partially Occupied): มีคนพักแต่ยังไม่เต็มความจุ
 * 3. เต็ม (Full): มีคนพักครบตามความจุห้อง
 * 4. ปิดปรับปรุง (Maintenance): ห้องถูกตั้งสถานะปิดซ่อมบำรุง
 * พร้อมเชื่อมโยงข้อมูลที่จอดรถ (Parking) ที่ผูกกับห้องพัก
 */
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

  // ห้องปัจจุบันของผู้พักแต่ละคน (ใช้จับคู่ช่องจอดรถกับห้อง)
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

    // แปลงข้อมูลผู้พักอาศัยในห้อง
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

    // สร้างข้อมูลเตียง/ที่พัก 1..capacity
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

    // ข้อมูลที่จอดรถที่ผูกกับห้องนี้
    const roomParking = parkingList
      .filter(function (p) {
        if (p.Status !== 'Occupied') return false;
        // ใช้ห้องปัจจุบันของผู้จองเป็นหลัก ถ้าผู้จองไม่ได้พักอยู่แล้วค่อยใช้ RoomID ที่บันทึกไว้
        // (ของเดิมเทียบ "เลขห้อง" ด้วย ทำให้ห้องเลขเดียวกันคนละอาคารเห็นที่จอดรถของกันและกัน)
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
      gender: 'Any', // หอพักไม่แบ่งแยกชาย-หญิง (คงคอลัมน์ Gender ไว้เพื่อความเข้ากันได้กับ Sheets เดิม)
      monthlyRate: Number(r.MonthlyRate) || 0,
      hasAirConditioner: true, // ทุกห้องมีเครื่องปรับอากาศเป็นมาตรฐาน
      hasFurniture: true,      // ทุกห้องมีเฟอร์นิเจอร์มาตรฐานเหมือนกันหมด
      remark: r.Remark || 'เฟอร์นิเจอร์มาตรฐานครบชุด',
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

  // ---------- 1. แดชบอร์ดภาพรวม ----------
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

    // ใช้เดือน/ปีตามเขตเวลา TZ (Asia/Bangkok) ที่กำหนดในโค้ดนี้เอง ไม่พึ่งค่า timeZone ใน appsscript.json
    const todayBkk = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
    const curYear = Number(todayBkk.substring(0, 4));
    const curMonth = Number(todayBkk.substring(5, 7)) - 1;
    // เทียบเดือนจากข้อความ yyyy-MM (ไม่ผูกกับ timezone) และไม่นับรายการ "ย้ายห้อง" เป็นผู้เข้าพักใหม่
    function isSameMonth(dateVal, m, y) {
      return String(dateVal || '').substring(0, 7) === (y + '-' + ('0' + (m + 1)).slice(-2));
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

    // สถิติผู้พักตามแผนก
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

    // แนวโน้ม 6 เดือนย้อนหลัง
    const monthLabels = [], checkInsByMonth = [], checkOutsByMonth = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(curYear, curMonth - i, 1);
      monthLabels.push(('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear());
      checkInsByMonth.push(occupancyAll.filter(function (o) { return isRealCheckIn(o) && isSameMonth(o.CheckInDate, d.getMonth(), d.getFullYear()); }).length);
      checkOutsByMonth.push(occupancyAll.filter(function (o) { return o.Status === 'CheckedOut' && isSameMonth(o.ActualCheckOutDate, d.getMonth(), d.getFullYear()); }).length);
    }

    const roomTypeCounts = {};
    rooms.forEach(function (r) {
      const t = r.roomType || 'Standard';
      roomTypeCounts[t] = (roomTypeCounts[t] || 0) + 1;
    });

    // สถิติที่จอดรถ (Parking Stats)
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
        checkOutThisMonth: checkOutThisMonth,
        pendingRequestsCount: 0
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
      recentRequests: [],
      activeRepairs: [],
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
        },
        roomTypes: {
          labels: Object.keys(roomTypeCounts),
          counts: Object.values(roomTypeCounts)
        }
      }
    };
  },

  // ---------- 2. ข้อมูลห้องพัก (Rooms) ----------
  getRooms: function () {
    return computeRoomsData_();
  },

  getRoomById: function (body) {
    return computeRoomsData_().find(function (r) { return String(r.roomId) === String(body.roomId); }) || null;
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
      return r.Status !== 'Deleted' && String(r.BuildingID) === String(d.buildingId) &&
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

    if (d.roomId) {
      updateRowById_(SHEETS.ROOMS, 'RoomID', d.roomId, {
        BuildingID: d.buildingId,
        Floor: d.floor || d.floorId || '1',
        FloorID: d.floor || d.floorId || '1',
        RoomNumber: d.roomNumber,
        RoomType: d.roomType || 'Double',
        Capacity: Math.max(Number(d.capacity) || 1, 1),
        Gender: 'Any',
        MonthlyRate: Number(d.monthlyRate) || 0,
        Remark: d.remark || '',
        UpdatedAt: nowStr_()
      });
      logAudit_(userEmail, 'UPDATE', 'Rooms', d.roomId, 'แก้ไขห้อง ' + d.roomNumber);
      return { roomId: d.roomId };
    } else {
      const roomId = generateId_('ROOM');
      appendRow_(SHEETS.ROOMS, {
        RoomID: roomId,
        BuildingID: d.buildingId,
        Floor: d.floor || d.floorId || '1',
        FloorID: d.floor || d.floorId || '1',
        RoomNumber: d.roomNumber,
        RoomType: d.roomType || 'Double',
        Capacity: Math.max(Number(d.capacity) || 1, 1),
        Gender: 'Any',
        MonthlyRate: Number(d.monthlyRate) || 0,
        Status: 'Active',
        Remark: d.remark || 'เฟอร์นิเจอร์มาตรฐานครบชุด',
        CreatedAt: nowStr_(),
        UpdatedAt: nowStr_()
      });
      logAudit_(userEmail, 'CREATE', 'Rooms', roomId, 'เพิ่มห้องใหม่ ' + d.roomNumber);
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
      // ห้ามปิดปรับปรุงห้องที่ยังมีผู้พักอยู่ (ไม่งั้นสถานะห้อง/KPI จะบอกว่าปิดซ่อม ทั้งที่มีคนอาศัยอยู่)
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

  // ---------- 3. ข้อมูลพนักงาน (Employees) ----------
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
        // รหัสนี้เคยถูกลบ (Status = Deleted) → กู้คืนแถวเดิม
        // ของเดิม: ใช้รหัสซ้ำไม่ได้ และถ้าเพิ่มแถวใหม่จะมี EmployeeID ซ้ำ 2 แถว ทำให้ระบบหาเจอแต่แถวที่ถูกลบ
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
    releaseParkingForEmployee_(employeeId, userEmail, 'คืนช่องจอดเพราะลบพนักงาน');
    updateRowById_(SHEETS.EMPLOYEES, 'EmployeeID', employeeId, { Status: 'Deleted', UpdatedAt: nowStr_() });
    logAudit_(userEmail, 'DELETE', 'Employees', employeeId, 'ลบพนักงาน');
    return { employeeId: employeeId };
  },

  // ---------- 4. ข้อมูลอาคาร (Buildings) ----------
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

  getFloors: function () {
    const rooms = sheetToObjects_(SHEETS.ROOMS).filter(function (r) { return r.Status !== 'Deleted'; });
    const floorSet = {};
    rooms.forEach(function (r) {
      const f = r.Floor || '1';
      floorSet[f] = true;
    });
    return Object.keys(floorSet).sort(function (a, b) { return Number(a) - Number(b) || String(a).localeCompare(String(b)); }).map(function (f) {
      return { FloorID: f, FloorNumber: f, FloorName: 'ชั้น ' + f };
    });
  },

  // ---------- 5. การเข้าพัก (Occupancy - ใครพักห้องไหน) ----------
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

    // 1. ตรวจสอบว่าพนักงานคนนี้มีห้องพักอยู่แล้วหรือไม่
    const existing = activeOcc.find(function (o) { return String(o.EmployeeID) === String(d.employeeId); });
    if (existing) {
      throw new Error('พนักงานคนนี้มีห้องพักที่กำลังเข้าพักอยู่แล้ว หากต้องการเปลี่ยนห้องกรุณาใช้เมนู "ย้ายห้อง"');
    }

    // 2. ตรวจสอบความจุห้องพัก
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

    // 3. กำหนดหมายเลขเตียง/ที่พัก (1..capacity) ที่ยังว่างอยู่
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
    // พนักงานย้ายออกจากหอพัก = คืนช่องจอดรถให้อัตโนมัติ
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

    // กำหนดเตียงว่างในห้องใหม่
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

    // ปิดสถานะรายการเดิม
    updateRowById_(SHEETS.OCCUPANCY, 'OccupancyID', d.occupancyId, {
      Status: 'Transferred',
      ActualCheckOutDate: transferDate,
      Remark: (oldOcc.Remark ? oldOcc.Remark + ' | ' : '') + 'ย้ายไปห้อง ' + (newRoom.RoomNumber || d.newRoomId),
      UpdatedAt: nowStr_()
    });

    // สร้างรายการเข้าพักใหม่
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

    // อัปเดตข้อมูลที่จอดรถของพนักงานให้ชี้ไปยังห้องใหม่โดยอัตโนมัติ
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

  // ---------- 6. ระบบการจองที่จอดรถ (Parking System): ช่องนี้ของใคร / พักห้องไหน ----------
  getParking: function () {
    const slots = sheetToObjects_(SHEETS.PARKING).filter(function (s) { return s.Status !== 'Deleted'; });
    const empMap = {}, roomMap = {}, bldMap = {}, occByEmp = {};
    sheetToObjects_(SHEETS.EMPLOYEES).forEach(function (e) { empMap[String(e.EmployeeID)] = e; });
    sheetToObjects_(SHEETS.ROOMS).forEach(function (r) { roomMap[String(r.RoomID)] = r; });
    sheetToObjects_(SHEETS.BUILDINGS).forEach(function (b) { bldMap[String(b.BuildingID)] = b; });
    sheetToObjects_(SHEETS.OCCUPANCY).filter(function (o) { return o.Status === 'Active'; })
      .forEach(function (o) { occByEmp[String(o.EmployeeID)] = o; });

    return slots.map(function (s) {
      const isOcc = s.Status === 'Occupied';
      const emp = empMap[String(s.EmployeeID)] || {};
      const curOcc = isOcc ? occByEmp[String(s.EmployeeID)] : null;
      // ใช้ห้องปัจจุบันของผู้จองเป็นหลัก (ถ้าไม่มีให้ใช้ค่าที่บันทึกไว้)
      const room = roomMap[String(curOcc ? curOcc.RoomID : s.RoomID)] || {};
      const bld = bldMap[String(room.BuildingID)] || {};
      const fullName = emp.FullName || ((emp.FirstName || '') + ' ' + (emp.LastName || '')).trim() || (s.EmployeeID ? s.EmployeeID : '');
      return Object.assign({}, s, {
        ownerName: isOcc ? fullName : '',
        ownerDepartment: emp.Department || '',
        ownerPhone: emp.Phone || '',
        roomNumber: isOcc ? (room.RoomNumber || s.RoomID || '') : '',
        buildingName: isOcc ? (bld.BuildingName || '') : '',
        needsReview: isOcc && !curOcc   // ผู้จองไม่ได้พักอยู่แล้ว ควรตรวจสอบ/คืนช่อง
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
        // ช่องที่มีผู้จองอยู่ ห้ามเปลี่ยนสถานะ/ประเภทรถ (ต้องคืนช่องก่อน)
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

    // ที่จอดรถสำหรับผู้พักอาศัยเท่านั้น: ห้องพักดึงจากการเข้าพักจริงของพนักงานเสมอ
    const activeOcc = sheetToObjects_(SHEETS.OCCUPANCY).find(function (o) {
      return o.Status === 'Active' && String(o.EmployeeID) === String(d.employeeId);
    });
    if (!activeOcc) throw new Error('พนักงานคนนี้ยังไม่มีห้องพัก กรุณาเช็คอินเข้าห้องพักก่อนจองที่จอดรถ');

    const taken = sheetToObjects_(SHEETS.PARKING).filter(function (p) { return p.Status === 'Occupied'; });
    const normPlate_ = function (s) { return String(s || '').replace(/[\s\-]+/g, '').toLowerCase(); };
    if (taken.some(function (p) { return normPlate_(p.LicensePlate) === normPlate_(plate); })) {
      throw new Error('ทะเบียน ' + plate + ' ถูกจองช่องจอดอื่นอยู่แล้ว');
    }
    if (taken.some(function (p) { return String(p.EmployeeID) === String(d.employeeId) && p.VehicleType === slot.VehicleType; })) {
      throw new Error('พนักงานคนนี้มีช่องจอด' + (slot.VehicleType === 'Car' ? 'รถยนต์' : 'มอเตอร์ไซค์') + 'อยู่แล้ว (1 คน / 1 ช่องต่อประเภท) หากต้องการเปลี่ยนให้คืนช่องเดิมก่อน');
    }

    updateRowById_(SHEETS.PARKING, 'SlotID', d.slotId, {
      Status: 'Occupied',
      EmployeeID: d.employeeId,
      RoomID: activeOcc.RoomID,
      LicensePlate: plate,
      VehicleModel: d.vehicleModel || '',
      AssignedDate: d.assignedDate || nowStr_().split(' ')[0],
      Remark: d.remark || '',
      UpdatedAt: nowStr_()
    });

    logAudit_(userEmail, 'ASSIGN', 'Parking', d.slotId, 'จองช่องจอด ' + slot.SlotNumber + ' ให้พนักงาน ' + d.employeeId + ' ห้อง ' + activeOcc.RoomID + ' (ทะเบียน: ' + plate + ')');
    return { slotId: d.slotId, roomId: activeOcc.RoomID };
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

  // ---------- 7. การตั้งค่าและ Audit Log ----------
  getSettings: function () {
    const rows = sheetToObjects_(SHEETS.SETTINGS);
    const out = {};
    rows.forEach(function (r) { out[r.Key] = r.Value; });
    return out;
  },

  saveSettings: function (body, userEmail) {
    const d = body.data;
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

  getAuditLogs: function () {
    return sheetToObjects_(SHEETS.AUDIT_LOG);
  },

  // Backward compatibility placeholders
  getBeds: function () {
    const rooms = computeRoomsData_();
    const allBeds = [];
    rooms.forEach(function (r) {
      (r.beds || []).forEach(function (b) {
        allBeds.push(Object.assign({}, b, { RoomID: r.roomId }));
      });
    });
    return allBeds;
  },

  saveBed: function () { return { success: true }; },
  getRoomRequests: function () { return []; },
  createRoomRequest: function () { return { success: true }; },
  updateRequestStatus: function () { return { success: true }; },
  getRepairRequests: function () { return []; },
  saveRepairRequest: function () { return { success: true }; },
  updateRepairStatus: function () { return { success: true }; },
  getMaintenance: function () {
    const rooms = computeRoomsData_().filter(function (r) { return r.computedStatus === 'Maintenance'; });
    return rooms.map(function (r) {
      return {
        MaintenanceID: 'MNT-' + r.roomId,
        RoomID: r.roomNumber,
        StartDate: '-',
        ExpectedEndDate: '-',
        Problem: 'ปิดปรับปรุงห้องพัก',
        Status: 'InProgress',
        Technician: '-'
      };
    });
  },
  saveMaintenance: function (body, userEmail) {
    return Actions.toggleRoomMaintenance(body, userEmail);
  },
  completeMaintenance: function (body, userEmail) {
    return Actions.toggleRoomMaintenance(body, userEmail);
  },
  getRoomAssets: function () { return []; },
  saveAsset: function () { return { success: true }; },
  deleteAsset: function () { return { success: true }; },
  getKeys: function () { return []; },
  saveKey: function () { return { success: true }; }
};