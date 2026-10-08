/**
 * ระบบบริหารหอพักพนักงาน - Backend Web API (Google Apps Script)
 * ออกแบบให้เข้าใจง่าย เรียบง่าย และมีประสิทธิภาพสูง
 * ตอบโจทย์หลัก:
 * 1. เก็บข้อมูลพนักงานพักห้องไหน (Occupancy)
 * 2. ตรวจสอบว่าห้องว่างหรือไม่ว่างแบบ Real-time (ว่าง / ว่างบางส่วน / เต็ม / ปิดปรับปรุง)
 * 3. ห้องพักทุกห้องมีเฟอร์นิเจอร์มาตรฐานครบชุดเหมือนกันหมด
 */

const SHEETS = {
  ROOMS: 'Rooms',
  EMPLOYEES: 'Employees',
  OCCUPANCY: 'Occupancy',
  BUILDINGS: 'Buildings',
  SETTINGS: 'Settings',
  AUDIT_LOG: 'AuditLog'
};

// ===================== ENTRY POINTS =====================

function doPost(e) {
  let body = {};
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse_({ success: false, message: 'รูปแบบข้อมูลที่ส่งมาไม่ถูกต้อง (Invalid JSON)' });
  }

  const action = body.action;
  const userEmail = body.userEmail || 'admin@dormitory.com';

  if (!action || typeof Actions[action] !== 'function') {
    return jsonResponse_({ success: false, message: 'ไม่พบคำสั่ง action "' + action + '" ในระบบ' });
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (lockErr) {
    return jsonResponse_({ success: false, message: 'ระบบกำลังประมวลผลรายการอื่นอยู่ กรุณาลองใหม่อีกครั้ง' });
  }

  try {
    const result = Actions[action](body, userEmail);
    return jsonResponse_({ success: true, data: result });
  } catch (err) {
    return jsonResponse_({ success: false, message: err && err.message ? err.message : String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  return jsonResponse_({
    success: true,
    message: 'Dormitory API is running. (ระบบบริหารหอพักพนักงาน)',
    version: '2.0-simplified'
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
      sheet.appendRow(['ID', 'CreatedAt']);
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
      obj[h] = row[idx];
    });
    rows.push(obj);
  }
  return rows;
}

function appendRow_(name, obj) {
  const sheet = getSheet_(name, true);
  const headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  const row = headers.map(function (h) { return obj[h] !== undefined ? obj[h] : ''; });
  sheet.appendRow(row);
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
      headers.forEach(function (h, idx) {
        if (patch[h] !== undefined) {
          sheet.getRange(i + 1, idx + 1).setValue(patch[h]);
        }
      });
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
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
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

// ===================== CORE LOGIC: คำนวณสถานะห้องพัก =====================
/**
 * คำนวณสถานะห้องพักแบบ Real-time:
 * 1. ว่าง (Available): 0 คนเข้าพัก
 * 2. ว่างบางส่วน (Partially Occupied): มีคนพักแต่ยังไม่เต็มความจุ
 * 3. เต็ม (Full): มีคนพักครบตามความจุห้อง
 * 4. ปิดปรับปรุง (Maintenance): ห้องถูกตั้งสถานะปิดซ่อมบำรุง
 */
function computeRoomsData_() {
  const rooms = sheetToObjects_(SHEETS.ROOMS).filter(function (r) { return r.Status !== 'Deleted'; });
  const buildings = sheetToObjects_(SHEETS.BUILDINGS).filter(function (b) { return b.Status !== 'Deleted'; });
  const occupancyActive = sheetToObjects_(SHEETS.OCCUPANCY).filter(function (o) { return o.Status === 'Active'; });
  const employees = sheetToObjects_(SHEETS.EMPLOYEES).filter(function (e) { return e.Status !== 'Deleted'; });

  const buildingMap = {};
  buildings.forEach(function (b) { buildingMap[String(b.BuildingID)] = b; });

  const empMap = {};
  employees.forEach(function (e) { empMap[String(e.EmployeeID)] = e; });

  return rooms.map(function (r) {
    const roomId = String(r.RoomID);
    const capacity = Math.max(Number(r.Capacity) || 1, 1);
    const roomOccupants = occupancyActive.filter(function (o) { return String(o.RoomID) === roomId; });
    const occupiedCount = roomOccupants.length;
    const availableCount = Math.max(capacity - occupiedCount, 0);

    let computedStatus = 'Available';
    if (r.Status === 'Maintenance') {
      computedStatus = 'Maintenance';
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
        bedId: 'BED-' + (o.BedID ? o.BedID : (roomId + '-' + bedNum)),
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
      gender: r.Gender || 'Any',
      monthlyRate: Number(r.MonthlyRate) || 0,
      hasAirConditioner: true, // ทุกห้องมีเครื่องปรับอากาศเป็นมาตรฐาน
      hasFurniture: true,      // ทุกห้องมีเฟอร์นิเจอร์มาตรฐานเหมือนกันหมด
      remark: r.Remark || 'เฟอร์นิเจอร์มาตรฐานครบชุด',
      computedStatus: computedStatus,
      status: r.Status || 'Active',
      activeBedsCount: capacity,
      occupiedBedsCount: occupiedCount,
      availableBedsCount: availableCount,
      beds: bedsOut,
      occupants: occupantsOut
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

    const totalRooms = rooms.length;
    const availableRooms = rooms.filter(function (r) { return r.computedStatus === 'Available'; }).length;
    const partiallyOccupiedRooms = rooms.filter(function (r) { return r.computedStatus === 'Partially Occupied'; }).length;
    const fullRooms = rooms.filter(function (r) { return r.computedStatus === 'Full'; }).length;
    const maintenanceRooms = rooms.filter(function (r) { return r.computedStatus === 'Maintenance'; }).length;

    const totalBeds = rooms.reduce(function (s, r) { return s + r.activeBedsCount; }, 0);
    const availableBeds = rooms.reduce(function (s, r) { return s + r.availableBedsCount; }, 0);
    const totalOccupants = rooms.reduce(function (s, r) { return s + r.occupiedBedsCount; }, 0);
    const overallOccupancyRate = totalBeds > 0 ? Math.round((totalOccupants / totalBeds) * 1000) / 10 : 0;

    const now = new Date();
    const curMonth = now.getMonth();
    const curYear = now.getFullYear();
    function isSameMonth(dateVal, m, y) {
      if (!dateVal) return false;
      const d = new Date(dateVal);
      return !isNaN(d) && d.getMonth() === m && d.getFullYear() === y;
    }

    const newThisMonth = occupancyAll.filter(function (o) { return isSameMonth(o.CheckInDate, curMonth, curYear); }).length;
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
      monthLabels.push(Utilities.formatDate(d, Session.getScriptTimeZone() || 'Asia/Bangkok', 'MM/yyyy'));
      checkInsByMonth.push(occupancyAll.filter(function (o) { return isSameMonth(o.CheckInDate, d.getMonth(), d.getFullYear()); }).length);
      checkOutsByMonth.push(occupancyAll.filter(function (o) { return o.Status === 'CheckedOut' && isSameMonth(o.ActualCheckOutDate, d.getMonth(), d.getFullYear()); }).length);
    }

    const roomTypeCounts = {};
    rooms.forEach(function (r) {
      const t = r.roomType || 'Standard';
      roomTypeCounts[t] = (roomTypeCounts[t] || 0) + 1;
    });

    return {
      kpi: {
        totalRooms: totalRooms,
        availableRooms: availableRooms,
        partiallyOccupiedRooms: partiallyOccupiedRooms,
        fullRooms: fullRooms,
        maintenanceRooms: maintenanceRooms,
        totalBeds: totalBeds,
        availableBeds: availableBeds,
        totalOccupants: totalOccupants,
        overallOccupancyRate: overallOccupancyRate,
        newThisMonth: newThisMonth,
        checkOutThisMonth: checkOutThisMonth,
        pendingRequestsCount: 0
      },
      buildingStats: buildingStats,
      almostFullRooms: almostFullRooms,
      recentRequests: [],
      activeRepairs: [],
      charts: {
        roomStatus: {
          labels: ['ว่าง', 'ว่างบางส่วน', 'เต็ม', 'ปิดปรับปรุง'],
          counts: [availableRooms, partiallyOccupiedRooms, fullRooms, maintenanceRooms]
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
    return computeRoomsData_().find(function (r) { return r.roomId === body.roomId; }) || null;
  },

  saveRoom: function (body, userEmail) {
    const d = body.data;
    if (!d.buildingId || !d.roomNumber || !d.capacity) {
      throw new Error('กรุณากรอกอาคาร เลขห้อง และความจุผู้พักให้ครบถ้วน');
    }

    if (d.roomId) {
      updateRowById_(SHEETS.ROOMS, 'RoomID', d.roomId, {
        BuildingID: d.buildingId,
        Floor: d.floor || d.floorId || '1',
        FloorID: d.floor || d.floorId || '1',
        RoomNumber: d.roomNumber,
        RoomType: d.roomType || 'Double',
        Capacity: Number(d.capacity),
        Gender: d.gender || 'Any',
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
        Capacity: Number(d.capacity),
        Gender: d.gender || 'Any',
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

    const roomMap = {};
    rooms.forEach(function (r) { roomMap[String(r.RoomID)] = r; });

    const occByEmp = {};
    activeOcc.forEach(function (o) { occByEmp[String(o.EmployeeID)] = o; });

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
      return Object.assign({}, e, {
        FullName: fullName,
        currentRoomNumber: currentRoomNumber,
        currentRoomId: currentRoomId,
        isAccommodated: !!occ
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
      const employeeId = d.customEmployeeId || generateId_('EMP');
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
    return Object.keys(floorSet).sort().map(function (f) {
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
    if (!room) throw new Error('ไม่พบห้องพักที่เลือก');
    if (room.Status === 'Maintenance') throw new Error('ห้องนี้อยู่ระหว่างปิดปรับปรุง ไม่สามารถเช็คอินได้');

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
    updateRowById_(SHEETS.OCCUPANCY, 'OccupancyID', d.occupancyId, {
      Status: 'CheckedOut',
      ActualCheckOutDate: checkOutDate,
      Remark: (occ.Remark ? occ.Remark + ' | ' : '') + (d.remark || 'เช็คเอาท์'),
      UpdatedAt: nowStr_()
    });

    logAudit_(userEmail, 'CHECK-OUT', 'Occupancy', d.occupancyId, 'เช็คเอาท์พนักงาน ' + occ.EmployeeID + ' ออกจากห้อง ' + occ.RoomID);
    return { occupancyId: d.occupancyId };
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

    const newRoom = findRowObject_(SHEETS.ROOMS, 'RoomID', d.newRoomId);
    if (!newRoom) throw new Error('ไม่พบห้องพักใหม่ที่เลือก');
    if (newRoom.Status === 'Maintenance') throw new Error('ห้องใหม่ที่เลือกอยู่ระหว่างปิดปรับปรุง');

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

    logAudit_(userEmail, 'TRANSFER', 'Occupancy', newOccupancyId, 'ย้ายพนักงาน ' + oldOcc.EmployeeID + ' จากห้อง ' + oldOcc.RoomID + ' ไปห้อง ' + newRoom.RoomNumber);
    return { newOccupancyId: newOccupancyId };
  },

  // ---------- 6. การตั้งค่าและ Audit Log ----------
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
