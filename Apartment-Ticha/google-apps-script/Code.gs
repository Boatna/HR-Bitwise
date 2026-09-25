/**
 * ระบบบริหารหอพักพนักงาน - Backend Web API (Google Apps Script)
 * ต้องอยู่ในโปรเจกต์ Apps Script เดียวกันกับ setup_sheets.gs (ผูกกับ Spreadsheet เดียวกัน)
 * รองรับทุก action ที่เรียกจาก js/api.js ฝั่ง Frontend
 */

const SHEETS = {
  EMPLOYEES: 'Employees',
  BUILDINGS: 'Buildings',
  FLOORS: 'Floors',
  ROOMS: 'Rooms',
  BEDS: 'Beds',
  OCCUPANCY: 'Occupancy',
  ROOM_REQUESTS: 'RoomRequests',
  ROOM_TRANSFERS: 'RoomTransfers',
  CHECKOUT: 'CheckOut',
  MAINTENANCE: 'Maintenance',
  REPAIR_REQUESTS: 'RepairRequests',
  ROOM_ASSETS: 'RoomAssets',
  KEYS: 'Keys',
  DORM_CHARGES: 'DormCharges',
  ADMIN_USERS: 'AdminUsers',
  NOTIFICATIONS: 'Notifications',
  AUDIT_LOG: 'AuditLog',
  SETTINGS: 'Settings'
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
  const userEmail = body.userEmail || 'system@unknown';

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
  return jsonResponse_({ success: true, message: 'Dormitory API is running. กรุณาเรียกผ่าน POST เท่านั้น', version: '1.0' });
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ===================== GENERIC SHEET HELPERS =====================

function getSheet_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('ไม่พบแผ่นงาน "' + name + '" กรุณารันฟังก์ชัน setupDormitoryDatabase ก่อนใช้งาน');
  return sheet;
}

function sheetToObjects_(name) {
  const sheet = getSheet_(name);
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
    headers.forEach(function (h, idx) { obj[h] = row[idx]; });
    rows.push(obj);
  }
  return rows;
}

function appendRow_(name, obj) {
  const sheet = getSheet_(name);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = headers.map(function (h) { return obj[h] !== undefined ? obj[h] : ''; });
  sheet.appendRow(row);
  return obj;
}

function updateRowById_(name, idField, idValue, patch) {
  const sheet = getSheet_(name);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;
  const values = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
  const headers = values[0];
  const idCol = headers.indexOf(idField);
  if (idCol === -1) throw new Error('ไม่พบคอลัมน์ ' + idField + ' ในแผ่นงาน ' + name);
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idCol]) === String(idValue)) {
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
  return rows.find(function (r) { return String(r[idField]) === String(idValue); }) || null;
}

function generateId_(prefix) {
  return prefix + '-' + Utilities.getUuid().split('-')[0].toUpperCase();
}

function nowStr_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
}

function logAudit_(userEmail, action, module, recordId, remark) {
  appendRow_(SHEETS.AUDIT_LOG, {
    LogID: generateId_('LOG'),
    Timestamp: nowStr_(),
    UserEmail: userEmail,
    Action: action,
    Module: module,
    RecordID: recordId,
    Remark: remark || ''
  });
}

// ===================== CORE BUSINESS LOGIC (Business Rule 27) =====================
// สถานะห้องคำนวณจาก Maintenance + Occupancy + Beds เสมอ ห้ามเก็บสถานะตรง ๆ ในตาราง Rooms

function computeRoomsData_() {
  const buildings = sheetToObjects_(SHEETS.BUILDINGS);
  const floors = sheetToObjects_(SHEETS.FLOORS);
  const rooms = sheetToObjects_(SHEETS.ROOMS).filter(function (r) { return r.Status !== 'Deleted'; });
  const beds = sheetToObjects_(SHEETS.BEDS);
  const occupancyActive = sheetToObjects_(SHEETS.OCCUPANCY).filter(function (o) { return o.Status === 'Active'; });
  const employees = sheetToObjects_(SHEETS.EMPLOYEES);
  const maintenanceOpen = sheetToObjects_(SHEETS.MAINTENANCE).filter(function (m) { return m.Status !== 'Completed'; });

  const buildingMap = {};
  buildings.forEach(function (b) { buildingMap[b.BuildingID] = b; });
  const floorMap = {};
  floors.forEach(function (f) { floorMap[f.FloorID] = f; });
  const empMap = {};
  employees.forEach(function (e) { empMap[e.EmployeeID] = e; });
  const maintByRoom = {};
  maintenanceOpen.forEach(function (m) { maintByRoom[m.RoomID] = m; });

  return rooms.map(function (r) {
    const roomBeds = beds.filter(function (b) { return String(b.RoomID) === String(r.RoomID); });
    const activeBeds = roomBeds.filter(function (b) { return b.Status === 'Active'; });
    const roomOccupancy = occupancyActive.filter(function (o) { return String(o.RoomID) === String(r.RoomID); });

    const occByBedId = {};
    roomOccupancy.forEach(function (o) { occByBedId[o.BedID] = o; });

    const bedsOut = roomBeds.map(function (b) {
      const occ = occByBedId[b.BedID];
      const emp = occ ? empMap[occ.EmployeeID] : null;
      return {
        bedId: b.BedID,
        bedNumber: b.BedNumber,
        bedType: b.BedType,
        status: b.Status,
        isOccupied: !!occ,
        occupantName: emp ? (emp.FullName || ((emp.FirstName || '') + ' ' + (emp.LastName || ''))) : ''
      };
    });

    const occupantsOut = roomOccupancy.map(function (o) {
      const emp = empMap[o.EmployeeID] || {};
      const bed = roomBeds.find(function (b) { return String(b.BedID) === String(o.BedID); });
      return {
        occupancyId: o.OccupancyID,
        employeeId: o.EmployeeID,
        fullName: emp.FullName || ((emp.FirstName || '') + ' ' + (emp.LastName || '')),
        department: emp.Department || '',
        phone: emp.Phone || '',
        checkInDate: o.CheckInDate,
        expectedCheckOutDate: o.ExpectedCheckOutDate,
        bedId: o.BedID,
        bedNumber: bed ? bed.BedNumber : ''
      };
    });

    const activeBedsCount = activeBeds.length;
    const occupiedBedsCount = roomOccupancy.length;
    const availableBedsCount = Math.max(activeBedsCount - occupiedBedsCount, 0);

    let computedStatus;
    if (maintByRoom[r.RoomID]) {
      computedStatus = 'Maintenance';
    } else if (activeBedsCount === 0) {
      computedStatus = 'Inactive';
    } else if (occupiedBedsCount === 0) {
      computedStatus = 'Available';
    } else if (occupiedBedsCount < activeBedsCount) {
      computedStatus = 'Partially Occupied';
    } else {
      computedStatus = 'Full';
    }

    const bld = buildingMap[r.BuildingID] || {};
    const flr = floorMap[r.FloorID] || {};

    return {
      roomId: r.RoomID,
      roomNumber: r.RoomNumber,
      buildingId: r.BuildingID,
      buildingName: bld.BuildingName || '',
      buildingCode: bld.BuildingCode || '',
      floorId: r.FloorID || '',
      floorName: flr.FloorName || '',
      roomType: r.RoomType,
      capacity: r.Capacity,
      gender: r.Gender,
      monthlyRate: r.MonthlyRate,
      hasAirConditioner: !!r.HasAirConditioner,
      hasFurniture: !!r.HasFurniture,
      remark: r.Remark || '',
      computedStatus: computedStatus,
      activeBedsCount: activeBedsCount,
      occupiedBedsCount: occupiedBedsCount,
      availableBedsCount: availableBedsCount,
      beds: bedsOut,
      occupants: occupantsOut
    };
  });
}

function syncBedsForRoom_(roomId, capacity) {
  const beds = sheetToObjects_(SHEETS.BEDS).filter(function (b) { return String(b.RoomID) === String(roomId); });
  const currentCount = beds.length;

  if (capacity > currentCount) {
    for (let i = currentCount + 1; i <= capacity; i++) {
      appendRow_(SHEETS.BEDS, {
        BedID: generateId_('BED'), RoomID: roomId, BedNumber: i, BedType: 'Standard',
        Status: 'Active', CreatedAt: nowStr_()
      });
    }
  } else if (capacity < currentCount) {
    const activeOcc = sheetToObjects_(SHEETS.OCCUPANCY).filter(function (o) { return o.Status === 'Active'; });
    const occupiedBedIds = {};
    activeOcc.forEach(function (o) { occupiedBedIds[String(o.BedID)] = true; });

    const sorted = beds.slice().sort(function (a, b) { return Number(b.BedNumber) - Number(a.BedNumber); });
    let toDeactivate = currentCount - capacity;
    for (let i = 0; i < sorted.length && toDeactivate > 0; i++) {
      const b = sorted[i];
      if (occupiedBedIds[String(b.BedID)]) continue; // ห้ามปิดเตียงที่มีผู้พักอยู่
      updateRowById_(SHEETS.BEDS, 'BedID', b.BedID, { Status: 'Inactive' });
      toDeactivate--;
    }
  }
}

// ===================== ACTIONS (เรียกตรงจาก js/api.js) =====================

const Actions = {

  // ---------- Dashboard ----------
  getDashboardData: function () {
    const rooms = computeRoomsData_();
    const employees = sheetToObjects_(SHEETS.EMPLOYEES).filter(function (e) { return e.Status !== 'Deleted'; });
    const requests = sheetToObjects_(SHEETS.ROOM_REQUESTS);
    const repairs = sheetToObjects_(SHEETS.REPAIR_REQUESTS);
    const occupancyAll = sheetToObjects_(SHEETS.OCCUPANCY);
    const checkouts = sheetToObjects_(SHEETS.CHECKOUT);
    const buildings = sheetToObjects_(SHEETS.BUILDINGS).filter(function (b) { return b.Status !== 'Deleted'; });

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
    const checkOutThisMonth = checkouts.filter(function (c) { return isSameMonth(c.CheckOutDate, curMonth, curYear); }).length;
    const pendingRequestsCount = requests.filter(function (r) { return r.RequestStatus === 'Pending'; }).length;

    const buildingStats = buildings.map(function (b) {
      const bRooms = rooms.filter(function (r) { return String(r.buildingId) === String(b.BuildingID); });
      const bTotalBeds = bRooms.reduce(function (s, r) { return s + r.activeBedsCount; }, 0);
      const bOccupiedBeds = bRooms.reduce(function (s, r) { return s + r.occupiedBedsCount; }, 0);
      return {
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

    const occEmployeeIds = {};
    occupancyAll.filter(function (o) { return o.Status === 'Active'; }).forEach(function (o) { occEmployeeIds[o.EmployeeID] = true; });
    const deptCounts = {};
    employees.forEach(function (e) {
      if (occEmployeeIds[e.EmployeeID]) {
        const dept = e.Department || 'ไม่ระบุแผนก';
        deptCounts[dept] = (deptCounts[dept] || 0) + 1;
      }
    });

    const monthLabels = [], checkInsByMonth = [], checkOutsByMonth = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(curYear, curMonth - i, 1);
      monthLabels.push(Utilities.formatDate(d, Session.getScriptTimeZone() || 'Asia/Bangkok', 'MM/yyyy'));
      checkInsByMonth.push(occupancyAll.filter(function (o) { return isSameMonth(o.CheckInDate, d.getMonth(), d.getFullYear()); }).length);
      checkOutsByMonth.push(checkouts.filter(function (c) { return isSameMonth(c.CheckOutDate, d.getMonth(), d.getFullYear()); }).length);
    }

    const repairTypeCounts = {};
    repairs.forEach(function (r) {
      const t = r.IssueType || 'อื่นๆ';
      repairTypeCounts[t] = (repairTypeCounts[t] || 0) + 1;
    });

    const roomTypeCounts = {};
    rooms.forEach(function (r) {
      const t = r.roomType || 'อื่นๆ';
      roomTypeCounts[t] = (roomTypeCounts[t] || 0) + 1;
    });

    return {
      kpi: {
        totalRooms: totalRooms, availableRooms: availableRooms, partiallyOccupiedRooms: partiallyOccupiedRooms,
        fullRooms: fullRooms, maintenanceRooms: maintenanceRooms, totalBeds: totalBeds, availableBeds: availableBeds,
        totalOccupants: totalOccupants, overallOccupancyRate: overallOccupancyRate, newThisMonth: newThisMonth,
        checkOutThisMonth: checkOutThisMonth, pendingRequestsCount: pendingRequestsCount
      },
      buildingStats: buildingStats,
      almostFullRooms: almostFullRooms,
      recentRequests: requests.slice().sort(function (a, b) { return new Date(b.RequestDate) - new Date(a.RequestDate); }).slice(0, 5),
      activeRepairs: repairs.filter(function (r) { return r.Status !== 'Completed'; }).slice(0, 5),
      charts: {
        roomStatus: { labels: ['ว่าง', 'ว่างบางส่วน', 'เต็ม', 'ปิดปรับปรุง'], counts: [availableRooms, partiallyOccupiedRooms, fullRooms, maintenanceRooms] },
        buildingOccupancy: {
          labels: buildingStats.map(function (b) { return b.buildingName; }),
          counts: buildingStats.map(function (b) { return b.occupiedBeds; }),
          rates: buildingStats.map(function (b) { return b.occupancyRate; })
        },
        departmentDistribution: { labels: Object.keys(deptCounts), counts: Object.values(deptCounts) },
        monthlyTrends: { labels: monthLabels, checkIns: checkInsByMonth, checkOuts: checkOutsByMonth },
        repairStats: { labels: Object.keys(repairTypeCounts), counts: Object.values(repairTypeCounts) },
        roomTypes: { labels: Object.keys(roomTypeCounts), counts: Object.values(roomTypeCounts) }
      }
    };
  },

  // ---------- Rooms ----------
  getRooms: function () {
    return computeRoomsData_();
  },

  getRoomById: function (body) {
    return computeRoomsData_().find(function (r) { return r.roomId === body.roomId; }) || null;
  },

  saveRoom: function (body, userEmail) {
    const d = body.data;
    if (!d.buildingId || !d.roomNumber || !d.capacity) {
      throw new Error('กรุณากรอกอาคาร เลขห้อง และความจุเตียงให้ครบถ้วน');
    }
    if (d.roomId) {
      updateRowById_(SHEETS.ROOMS, 'RoomID', d.roomId, {
        BuildingID: d.buildingId, RoomNumber: d.roomNumber, RoomType: d.roomType,
        Capacity: d.capacity, Gender: d.gender, MonthlyRate: d.monthlyRate,
        HasAirConditioner: !!d.hasAirConditioner, HasFurniture: !!d.hasFurniture,
        Remark: d.remark || '', UpdatedAt: nowStr_()
      });
      syncBedsForRoom_(d.roomId, Number(d.capacity));
      logAudit_(userEmail, 'UPDATE', 'Rooms', d.roomId, 'แก้ไขห้อง ' + d.roomNumber);
      return { roomId: d.roomId };
    } else {
      const roomId = generateId_('ROOM');
      const floors = sheetToObjects_(SHEETS.FLOORS).filter(function (f) { return String(f.BuildingID) === String(d.buildingId); });
      appendRow_(SHEETS.ROOMS, {
        RoomID: roomId, BuildingID: d.buildingId, RoomNumber: d.roomNumber,
        FloorID: floors.length ? floors[0].FloorID : '', RoomType: d.roomType,
        Capacity: d.capacity, Gender: d.gender, MonthlyRate: d.monthlyRate,
        HasAirConditioner: !!d.hasAirConditioner, HasFurniture: !!d.hasFurniture,
        Remark: d.remark || '', Status: 'Active', CreatedAt: nowStr_(), UpdatedAt: nowStr_()
      });
      syncBedsForRoom_(roomId, Number(d.capacity));
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
      throw new Error('ไม่สามารถลบห้องนี้ได้ เนื่องจากยังมีผู้พักอาศัยอยู่ กรุณาย้ายผู้พักออกก่อน');
    }
    updateRowById_(SHEETS.ROOMS, 'RoomID', roomId, { Status: 'Deleted', UpdatedAt: nowStr_() });
    logAudit_(userEmail, 'DELETE', 'Rooms', roomId, 'ลบห้องพัก (Soft Delete)');
    return { roomId: roomId };
  },

  // ---------- Employees ----------
  getEmployees: function () {
    return sheetToObjects_(SHEETS.EMPLOYEES)
      .filter(function (e) { return e.Status !== 'Deleted'; })
      .map(function (e) { return Object.assign({}, e, { FullName: e.FullName || ((e.FirstName || '') + ' ' + (e.LastName || '')).trim() }); });
  },

  saveEmployee: function (body, userEmail) {
    const d = body.data;
    if (!d.firstName || !d.lastName) {
      throw new Error('กรุณากรอกชื่อและนามสกุลพนักงาน');
    }
    const fullName = ((d.firstName || '') + ' ' + (d.lastName || '')).trim();
    if (d.employeeId) {
      updateRowById_(SHEETS.EMPLOYEES, 'EmployeeID', d.employeeId, {
        Prefix: d.prefix, FirstName: d.firstName, LastName: d.lastName, FullName: fullName,
        Department: d.department || '', Position: d.position || '', Plant: d.plant || '',
        Phone: d.phone || '', Email: d.email || '', UpdatedAt: nowStr_()
      });
      logAudit_(userEmail, 'UPDATE', 'Employees', d.employeeId, 'แก้ไขข้อมูลพนักงาน ' + fullName);
      return { employeeId: d.employeeId };
    } else {
      const employeeId = generateId_('EMP');
      appendRow_(SHEETS.EMPLOYEES, {
        EmployeeID: employeeId, Prefix: d.prefix || 'นาย', FirstName: d.firstName, LastName: d.lastName,
        FullName: fullName, Department: d.department || '', Position: d.position || '', Plant: d.plant || '',
        Phone: d.phone || '', Email: d.email || '', Status: 'Active', CreatedAt: nowStr_(), UpdatedAt: nowStr_()
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
      throw new Error('ไม่สามารถลบพนักงานคนนี้ได้ เนื่องจากยังมีห้องพักที่ Active อยู่ กรุณาเช็คเอาท์ก่อน');
    }
    updateRowById_(SHEETS.EMPLOYEES, 'EmployeeID', employeeId, { Status: 'Deleted', UpdatedAt: nowStr_() });
    logAudit_(userEmail, 'DELETE', 'Employees', employeeId, 'ลบข้อมูลพนักงาน (Soft Delete)');
    return { employeeId: employeeId };
  },

  // ---------- Buildings / Floors ----------
  getBuildings: function () {
    const buildings = sheetToObjects_(SHEETS.BUILDINGS).filter(function (b) { return b.Status !== 'Deleted'; });
    const rooms = sheetToObjects_(SHEETS.ROOMS).filter(function (r) { return r.Status !== 'Deleted'; });
    return buildings.map(function (b) {
      return Object.assign({}, b, {
        TotalRooms: rooms.filter(function (r) { return String(r.BuildingID) === String(b.BuildingID); }).length
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
        BuildingCode: d.buildingCode, BuildingName: d.buildingName, Location: d.location || '',
        NumberOfFloors: d.numberOfFloors, Remark: d.remark || '', UpdatedAt: nowStr_()
      });
      logAudit_(userEmail, 'UPDATE', 'Buildings', d.buildingId, 'แก้ไขอาคาร ' + d.buildingName);
      return { buildingId: d.buildingId };
    } else {
      const buildingId = generateId_('BLD');
      appendRow_(SHEETS.BUILDINGS, {
        BuildingID: buildingId, BuildingCode: d.buildingCode, BuildingName: d.buildingName,
        Location: d.location || '', NumberOfFloors: d.numberOfFloors, Status: 'Active',
        Remark: d.remark || '', CreatedAt: nowStr_(), UpdatedAt: nowStr_()
      });
      const numFloors = Number(d.numberOfFloors) || 1;
      for (let i = 1; i <= numFloors; i++) {
        appendRow_(SHEETS.FLOORS, {
          FloorID: generateId_('FLR'), BuildingID: buildingId, FloorNumber: i,
          FloorName: 'ชั้น ' + i, Status: 'Active'
        });
      }
      logAudit_(userEmail, 'CREATE', 'Buildings', buildingId, 'เพิ่มอาคารใหม่ ' + d.buildingName);
      return { buildingId: buildingId };
    }
  },

  getFloors: function () {
    return sheetToObjects_(SHEETS.FLOORS);
  },

  // ---------- Beds ----------
  getBeds: function () {
    return sheetToObjects_(SHEETS.BEDS);
  },

  saveBed: function (body, userEmail) {
    const d = body.data;
    if (d.bedId) {
      updateRowById_(SHEETS.BEDS, 'BedID', d.bedId, { BedNumber: d.bedNumber, BedType: d.bedType, Status: d.status });
      logAudit_(userEmail, 'UPDATE', 'Beds', d.bedId, 'แก้ไขข้อมูลเตียง');
      return { bedId: d.bedId };
    }
    const bedId = generateId_('BED');
    appendRow_(SHEETS.BEDS, {
      BedID: bedId, RoomID: d.roomId, BedNumber: d.bedNumber, BedType: d.bedType || 'Standard',
      Status: 'Active', CreatedAt: nowStr_()
    });
    logAudit_(userEmail, 'CREATE', 'Beds', bedId, 'เพิ่มเตียงใหม่');
    return { bedId: bedId };
  },

  // ---------- Occupancy Workflows ----------
  getOccupancy: function () {
    return sheetToObjects_(SHEETS.OCCUPANCY);
  },

  checkIn: function (body, userEmail) {
    const d = body.data;
    if (!d.employeeId || !d.roomId || !d.bedId || !d.checkInDate) {
      throw new Error('ข้อมูลไม่ครบถ้วนสำหรับการเช็คอิน (ต้องมีพนักงาน ห้อง เตียง และวันที่)');
    }
    const activeOccList = sheetToObjects_(SHEETS.OCCUPANCY).filter(function (o) { return o.Status === 'Active'; });

    // Business Rule 3: ห้ามพนักงานคนเดียวมีห้อง Active ซ้อนกัน
    const existing = activeOccList.find(function (o) { return String(o.EmployeeID) === String(d.employeeId); });
    if (existing) {
      throw new Error('พนักงานคนนี้มีห้องพักที่ Active อยู่แล้ว ไม่สามารถเช็คอินซ้อนได้ กรุณาทำรายการย้ายห้อง (Transfer) แทน');
    }

    const bed = findRowObject_(SHEETS.BEDS, 'BedID', d.bedId);
    if (!bed || bed.Status !== 'Active') {
      throw new Error('เตียงที่เลือกไม่พร้อมใช้งาน กรุณาเลือกเตียงอื่น');
    }
    const bedTaken = activeOccList.some(function (o) { return String(o.BedID) === String(d.bedId); });
    if (bedTaken) {
      throw new Error('เตียงนี้มีผู้พักอาศัยอยู่แล้ว กรุณาเลือกเตียงอื่น');
    }

    const occupancyId = generateId_('OCC');
    appendRow_(SHEETS.OCCUPANCY, {
      OccupancyID: occupancyId, EmployeeID: d.employeeId, RoomID: d.roomId, BedID: d.bedId,
      CheckInDate: d.checkInDate, ExpectedCheckOutDate: d.expectedCheckOutDate || '',
      ActualCheckOutDate: '', Status: 'Active', Reason: d.reason || '', Remark: d.remark || '',
      CreatedAt: nowStr_(), UpdatedAt: nowStr_()
    });
    logAudit_(userEmail, 'CHECK-IN', 'Occupancy', occupancyId, 'เช็คอินห้อง ' + d.roomId + ' เตียง ' + d.bedId);
    return { occupancyId: occupancyId };
  },

  checkOut: function (body, userEmail) {
    const d = body.data;
    const occ = findRowObject_(SHEETS.OCCUPANCY, 'OccupancyID', d.occupancyId);
    if (!occ || occ.Status !== 'Active') {
      throw new Error('ไม่พบข้อมูลการเข้าพักที่ Active สำหรับรายการนี้');
    }
    if (!d.checkOutDate) {
      throw new Error('กรุณาระบุวันที่เช็คเอาท์');
    }
    updateRowById_(SHEETS.OCCUPANCY, 'OccupancyID', d.occupancyId, {
      Status: 'CheckedOut', ActualCheckOutDate: d.checkOutDate, UpdatedAt: nowStr_()
    });
    appendRow_(SHEETS.CHECKOUT, {
      CheckOutID: generateId_('CKO'), OccupancyID: d.occupancyId, EmployeeID: occ.EmployeeID,
      RoomID: occ.RoomID, BedID: occ.BedID, CheckOutDate: d.checkOutDate, Reason: d.reason || '',
      KeyReturned: !!d.keyReturned, PropertyReturned: !!d.propertyReturned,
      RoomCondition: d.roomCondition || 'Normal', DamageAmount: d.damageAmount || 0,
      Remark: d.remark || '', CreatedAt: nowStr_()
    });
    logAudit_(userEmail, 'CHECK-OUT', 'Occupancy', d.occupancyId, 'เช็คเอาท์จากห้อง ' + occ.RoomID);
    return { occupancyId: d.occupancyId };
  },

  transferRoom: function (body, userEmail) {
    const d = body.data;
    const oldOcc = findRowObject_(SHEETS.OCCUPANCY, 'OccupancyID', d.occupancyId);
    if (!oldOcc || oldOcc.Status !== 'Active') {
      throw new Error('ไม่พบข้อมูลการเข้าพักเดิมที่ Active');
    }
    if (!d.newRoomId || !d.newBedId || !d.transferDate) {
      throw new Error('กรุณาเลือกห้องใหม่ เตียงใหม่ และวันที่ย้ายห้องให้ครบถ้วน');
    }
    const activeOccList = sheetToObjects_(SHEETS.OCCUPANCY).filter(function (o) { return o.Status === 'Active'; });
    const bed = findRowObject_(SHEETS.BEDS, 'BedID', d.newBedId);
    if (!bed || bed.Status !== 'Active') {
      throw new Error('เตียงใหม่ที่เลือกไม่พร้อมใช้งาน');
    }
    const bedTaken = activeOccList.some(function (o) { return String(o.BedID) === String(d.newBedId); });
    if (bedTaken) {
      throw new Error('เตียงใหม่ที่เลือกมีผู้พักอาศัยอยู่แล้ว');
    }

    // ปิดประวัติเดิม (Business Rule 2: ห้ามลบประวัติเดิม)
    updateRowById_(SHEETS.OCCUPANCY, 'OccupancyID', d.occupancyId, {
      Status: 'Transferred', ActualCheckOutDate: d.transferDate, UpdatedAt: nowStr_()
    });

    const newOccupancyId = generateId_('OCC');
    appendRow_(SHEETS.OCCUPANCY, {
      OccupancyID: newOccupancyId, EmployeeID: oldOcc.EmployeeID, RoomID: d.newRoomId, BedID: d.newBedId,
      CheckInDate: d.transferDate, ExpectedCheckOutDate: oldOcc.ExpectedCheckOutDate || '',
      ActualCheckOutDate: '', Status: 'Active', Reason: d.reason || 'ย้ายห้อง', Remark: d.remark || '',
      CreatedAt: nowStr_(), UpdatedAt: nowStr_()
    });

    appendRow_(SHEETS.ROOM_TRANSFERS, {
      TransferID: generateId_('TRF'), OccupancyIDOld: d.occupancyId, OccupancyIDNew: newOccupancyId,
      EmployeeID: oldOcc.EmployeeID, FromRoomID: oldOcc.RoomID, FromBedID: oldOcc.BedID,
      ToRoomID: d.newRoomId, ToBedID: d.newBedId, TransferDate: d.transferDate,
      Reason: d.reason || '', Remark: d.remark || '', CreatedAt: nowStr_()
    });

    logAudit_(userEmail, 'TRANSFER', 'Occupancy', newOccupancyId, 'ย้ายจากห้อง ' + oldOcc.RoomID + ' ไปห้อง ' + d.newRoomId);
    return { newOccupancyId: newOccupancyId };
  },

  // ---------- Room Requests ----------
  getRoomRequests: function () {
    return sheetToObjects_(SHEETS.ROOM_REQUESTS).sort(function (a, b) { return new Date(b.RequestDate) - new Date(a.RequestDate); });
  },

  createRoomRequest: function (body, userEmail) {
    const d = body.data;
    const requestId = generateId_('REQ');
    appendRow_(SHEETS.ROOM_REQUESTS, {
      RequestID: requestId, EmployeeID: d.employeeId, RequestDate: d.requestDate || nowStr_(),
      PreferredBuilding: d.preferredBuilding || '', PreferredRoomType: d.preferredRoomType || '',
      Reason: d.reason || '', RequestStatus: 'Pending', ApprovedBy: '', ApprovedDate: ''
    });
    logAudit_(userEmail, 'CREATE', 'RoomRequests', requestId, 'สร้างคำขอเข้าพักใหม่');
    return { requestId: requestId };
  },

  updateRequestStatus: function (body, userEmail) {
    const requestId = body.requestId, status = body.status;
    updateRowById_(SHEETS.ROOM_REQUESTS, 'RequestID', requestId, {
      RequestStatus: status, ApprovedBy: userEmail, ApprovedDate: nowStr_()
    });
    logAudit_(userEmail, status === 'Approved' ? 'APPROVE' : 'REJECT', 'RoomRequests', requestId, 'ปรับสถานะคำขอเป็น ' + status);
    return { requestId: requestId, status: status };
  },

  // ---------- Maintenance ----------
  getMaintenance: function () {
    return sheetToObjects_(SHEETS.MAINTENANCE);
  },

  saveMaintenance: function (body, userEmail) {
    const d = body.data;
    if (!d.roomId) throw new Error('กรุณาระบุห้องพักที่ต้องการปิดปรับปรุง');
    const maintenanceId = generateId_('MNT');
    appendRow_(SHEETS.MAINTENANCE, {
      MaintenanceID: maintenanceId, RoomID: d.roomId, StartDate: d.startDate || nowStr_(),
      ExpectedEndDate: d.expectedEndDate || '', ActualEndDate: '', Problem: d.problem || '',
      Status: 'InProgress', Technician: d.technician || '', CreatedAt: nowStr_()
    });
    logAudit_(userEmail, 'CREATE', 'Maintenance', maintenanceId, 'ปิดปรับปรุงห้อง ' + d.roomId);
    return { maintenanceId: maintenanceId };
  },

  completeMaintenance: function (body, userEmail) {
    const maintenanceId = body.maintenanceId;
    updateRowById_(SHEETS.MAINTENANCE, 'MaintenanceID', maintenanceId, { Status: 'Completed', ActualEndDate: nowStr_() });
    logAudit_(userEmail, 'UPDATE', 'Maintenance', maintenanceId, 'ปิดงานซ่อมบำรุง ห้องกลับมาใช้งานได้ตามปกติ');
    return { maintenanceId: maintenanceId };
  },

  // ---------- Repair Requests ----------
  getRepairRequests: function () {
    return sheetToObjects_(SHEETS.REPAIR_REQUESTS);
  },

  saveRepairRequest: function (body, userEmail) {
    const d = body.data;
    if (!d.roomId || !d.description) throw new Error('กรุณากรอกเลขห้องและรายละเอียดปัญหา');
    const repairId = generateId_('RPR');
    appendRow_(SHEETS.REPAIR_REQUESTS, {
      RepairID: repairId, RoomID: d.roomId, IssueType: d.issueType, Description: d.description,
      Priority: d.priority || 'Medium', AssignedTo: '', Status: 'Pending',
      RequestDate: nowStr_(), CompletedDate: ''
    });
    logAudit_(userEmail, 'CREATE', 'RepairRequests', repairId, 'แจ้งซ่อม ' + d.issueType + ' ห้อง ' + d.roomId);
    return { repairId: repairId };
  },

  updateRepairStatus: function (body, userEmail) {
    const repairId = body.repairId, status = body.status;
    const patch = { Status: status };
    if (body.assignedTo !== undefined) patch.AssignedTo = body.assignedTo;
    if (status === 'Completed') patch.CompletedDate = nowStr_();
    updateRowById_(SHEETS.REPAIR_REQUESTS, 'RepairID', repairId, patch);
    logAudit_(userEmail, 'UPDATE', 'RepairRequests', repairId, 'ปรับสถานะงานซ่อมเป็น ' + status);
    return { repairId: repairId, status: status };
  },

  // ---------- Room Assets ----------
  getRoomAssets: function () {
    return sheetToObjects_(SHEETS.ROOM_ASSETS);
  },

  saveAsset: function (body, userEmail) {
    const d = body.data;
    if (d.assetId) {
      updateRowById_(SHEETS.ROOM_ASSETS, 'AssetID', d.assetId, {
        RoomID: d.roomId, AssetType: d.assetType, AssetName: d.assetName,
        Condition: d.condition, Status: d.status
      });
      logAudit_(userEmail, 'UPDATE', 'RoomAssets', d.assetId, 'แก้ไขทรัพย์สิน');
      return { assetId: d.assetId };
    }
    const assetId = generateId_('AST');
    appendRow_(SHEETS.ROOM_ASSETS, {
      AssetID: assetId, AssetCode: d.assetCode || assetId, RoomID: d.roomId,
      AssetType: d.assetType, AssetName: d.assetName, Condition: d.condition || 'Good',
      Status: d.status || 'Active'
    });
    logAudit_(userEmail, 'CREATE', 'RoomAssets', assetId, 'เพิ่มทรัพย์สินใหม่');
    return { assetId: assetId };
  },

  deleteAsset: function (body, userEmail) {
    updateRowById_(SHEETS.ROOM_ASSETS, 'AssetID', body.assetId, { Status: 'Deleted' });
    logAudit_(userEmail, 'DELETE', 'RoomAssets', body.assetId, 'ลบทรัพย์สิน');
    return { assetId: body.assetId };
  },

  // ---------- Keys ----------
  getKeys: function () {
    return sheetToObjects_(SHEETS.KEYS);
  },

  saveKey: function (body, userEmail) {
    const d = body.data;
    if (d.keyId) {
      updateRowById_(SHEETS.KEYS, 'KeyID', d.keyId, {
        RoomID: d.roomId, EmployeeID: d.employeeId, Status: d.status, Remark: d.remark
      });
      logAudit_(userEmail, 'UPDATE', 'Keys', d.keyId, 'แก้ไขข้อมูลกุญแจ');
      return { keyId: d.keyId };
    }
    const keyId = generateId_('KEY');
    appendRow_(SHEETS.KEYS, {
      KeyID: keyId, KeyNumber: d.keyNumber || keyId, RoomID: d.roomId, EmployeeID: d.employeeId || '',
      IssueDate: d.issueDate || nowStr_(), ReturnDate: '', Status: d.status || 'Issued', Remark: d.remark || ''
    });
    logAudit_(userEmail, 'CREATE', 'Keys', keyId, 'เบิกกุญแจใหม่');
    return { keyId: keyId };
  },

  // ---------- Admin Users ----------
  getAdminUsers: function () {
    return sheetToObjects_(SHEETS.ADMIN_USERS);
  },

  saveAdminUser: function (body, userEmail) {
    const d = body.data;
    if (d.adminId) {
      updateRowById_(SHEETS.ADMIN_USERS, 'AdminID', d.adminId, { Email: d.email, Name: d.name, Role: d.role, Status: d.status });
      logAudit_(userEmail, 'UPDATE', 'AdminUsers', d.adminId, 'แก้ไขบัญชีผู้ดูแลระบบ');
      return { adminId: d.adminId };
    }
    const adminId = generateId_('ADM');
    appendRow_(SHEETS.ADMIN_USERS, {
      AdminID: adminId, Email: d.email, Name: d.name, Role: d.role || 'Admin',
      Status: 'Active', CreatedAt: nowStr_()
    });
    logAudit_(userEmail, 'CREATE', 'AdminUsers', adminId, 'เพิ่มบัญชีผู้ดูแลระบบใหม่');
    return { adminId: adminId };
  },

  // ---------- Audit Log ----------
  getAuditLogs: function () {
    return sheetToObjects_(SHEETS.AUDIT_LOG);
  },

  // ---------- Settings ----------
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
  }
};
