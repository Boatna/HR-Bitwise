const SPREADSHEET_ID = '';

// Action ที่เป็นการ "อ่านข้อมูล" อย่างเดียว ไม่จำเป็นต้องรอคิวล็อกสคริปต์
// (เพิ่มความเร็วในการโหลดหน้าจอเมื่อมีผู้ใช้งานพร้อมกันหลายคน)
const READ_ONLY_ACTIONS = new Set([
  'ping',
  'getDashboardData',
  'getRooms',
  'getRoomById',
  'getEmployees',
  'getBuildings',
  'getFloors',
  'getBeds',
  'getOccupancy',
  'getRoomRequests',
  'getMaintenance',
  'getRepairRequests',
  'getRoomAssets',
  'getKeys',
  'getAdminUsers',
  'getAuditLogs',
  'getSettings'
]);

// ป้ายกำกับเดือนภาษาไทยแบบย่อ สำหรับกราฟแนวโน้มรายเดือน
const THAI_MONTH_ABBR = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

// แปลประเภทงานซ่อม (IssueType) เป็นภาษาไทยสำหรับกราฟ (Chart 7)
const ISSUE_TYPE_LABELS = {
  'Air Conditioner': 'แอร์',
  'Electricity': 'ไฟฟ้า/ไฟดับ',
  'Plumbing': 'ประปา/น้ำรั่ว',
  'Furniture': 'เฟอร์นิเจอร์',
  'Door & Lock': 'ประตู/กุญแจ',
  'Other': 'อื่นๆ'
};

function getSpreadsheet() {
  if (SPREADSHEET_ID && SPREADSHEET_ID.trim() !== '') {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * จัดการ HTTP GET Requests
 */
function doGet(e) {
  return handleRequest(e, 'GET');
}

/**
 * จัดการ HTTP POST Requests
 */
function doPost(e) {
  return handleRequest(e, 'POST');
}

/**
 * รวมศูนย์การประมวลผลคำขอ (Routing Controller)
 *
 * แก้ไข Race Condition:
 * - เดิม: เรียก tryLock() แต่ไม่เช็คผลลัพธ์ (hasLock) ก่อนทำงานต่อ
 *         ทำให้ถ้าแย่งล็อกไม่สำเร็จ (มีคนใช้พร้อมกันเยอะ) โค้ดยังคง
 *         อ่าน/เขียนข้อมูลต่อไปโดยไม่มีการป้องกัน เกิดข้อมูลชนกันได้
 * - ใหม่: แยก action ที่เป็น "อ่านอย่างเดียว" ไม่ต้องรอคิวล็อก (เร็วขึ้น)
 *         ส่วน action ที่ "เขียนข้อมูล" ต้องแย่งล็อกให้ได้ก่อนเท่านั้น
 *         ถึงจะทำงานต่อ ถ้าแย่งไม่ได้ภายในเวลาที่กำหนด จะตอบ error
 *         กลับไปทันที ไม่ทำงานต่อแบบไม่มีการป้องกันเด็ดขาด
 */
function handleRequest(e, method) {
  let params = {};
  if (method === 'GET') {
    params = e.parameter || {};
  } else {
    if (e.postData && e.postData.contents) {
      try {
        params = JSON.parse(e.postData.contents);
      } catch (err) {
        params = e.parameter || {};
      }
    } else {
      params = e.parameter || {};
    }
  }

  const action = params.action || 'ping';
  const userEmail = params.userEmail || 'guest@company.com';
  const isReadOnly = READ_ONLY_ACTIONS.has(action);

  let lock = null;
  let hasLock = true;

  if (!isReadOnly) {
    lock = LockService.getScriptLock();
    // รอได้สูงสุด 15 วินาทีเพื่อป้องกัน race condition ในการแก้ไขข้อมูล
    hasLock = lock.tryLock(15000);

    if (!hasLock) {
      // สำคัญ: ถ้าแย่งล็อกไม่สำเร็จ ต้องหยุดทันที ห้ามทำงานต่อโดยไม่มีล็อก
      return createJsonResponse({
        success: false,
        errorType: 'LOCK_TIMEOUT',
        message: 'ระบบมีผู้ใช้งานทำรายการพร้อมกันอยู่ กรุณาลองใหม่อีกครั้งในอีกสักครู่'
      });
    }
  }

  let responseData = { success: false, message: 'Invalid Request' };

  try {
    // ตรวจสอบสิทธิ์ (Security / RBAC check)
    const permission = checkPermission(userEmail, action);
    if (!permission.allowed) {
      responseData = {
        success: false,
        errorType: 'PERMISSION_DENIED',
        message: 'คุณไม่มีสิทธิ์ในการดำเนินการนี้ (' + permission.role + ')'
      };
    } else {
      // ประมวลผลตาม Action
      switch (action) {
        case 'ping':
          responseData = { success: true, message: 'Dormitory API is online', timestamp: new Date().toISOString() };
          break;

        case 'getDashboardData':
          responseData = { success: true, data: getDashboardData() };
          break;

        case 'getRooms':
          responseData = { success: true, data: getRoomsWithStatus() };
          break;

        case 'getRoomById':
          responseData = { success: true, data: getRoomDetail(params.roomId) };
          break;

        case 'saveRoom':
          responseData = saveRoom(params.data, userEmail);
          break;

        case 'deleteRoom':
          responseData = deleteRoom(params.roomId, userEmail);
          break;

        case 'getEmployees':
          responseData = { success: true, data: getEmployeesList() };
          break;

        case 'saveEmployee':
          responseData = saveEmployee(params.data, userEmail);
          break;

        case 'deleteEmployee':
          responseData = deleteEmployee(params.employeeId, userEmail);
          break;

        case 'getBuildings':
          responseData = { success: true, data: getSheetDataAsObjects('Buildings') };
          break;

        case 'saveBuilding':
          responseData = saveBuilding(params.data, userEmail);
          break;

        case 'getFloors':
          responseData = { success: true, data: getSheetDataAsObjects('Floors') };
          break;

        case 'getBeds':
          responseData = { success: true, data: getSheetDataAsObjects('Beds') };
          break;

        case 'saveBed':
          responseData = saveBed(params.data, userEmail);
          break;

        case 'getOccupancy':
          responseData = { success: true, data: getSheetDataAsObjects('Occupancy') };
          break;

        case 'checkIn':
          responseData = checkInOccupant(params.data, userEmail);
          break;

        case 'checkOut':
          responseData = checkOutOccupant(params.data, userEmail);
          break;

        case 'transferRoom':
          responseData = transferOccupant(params.data, userEmail);
          break;

        case 'getRoomRequests':
          responseData = { success: true, data: getSheetDataAsObjects('RoomRequests') };
          break;

        case 'createRoomRequest':
          responseData = createRoomRequest(params.data, userEmail);
          break;

        case 'updateRequestStatus':
          responseData = updateRequestStatus(params.data, userEmail);
          break;

        case 'getMaintenance':
          responseData = { success: true, data: getSheetDataAsObjects('Maintenance') };
          break;

        case 'saveMaintenance':
          responseData = saveMaintenance(params.data, userEmail);
          break;

        case 'getRepairRequests':
          responseData = { success: true, data: getSheetDataAsObjects('RepairRequests') };
          break;

        case 'saveRepairRequest':
          responseData = saveRepairRequest(params.data, userEmail);
          break;

        case 'updateRepairStatus':
          responseData = updateRepairStatus(params.data, userEmail);
          break;

        case 'getRoomAssets':
          responseData = { success: true, data: getSheetDataAsObjects('RoomAssets') };
          break;

        case 'saveAsset':
          responseData = saveAsset(params.data, userEmail);
          break;

        case 'deleteAsset':
          responseData = deleteAsset(params.assetId, userEmail);
          break;

        case 'getKeys':
          responseData = { success: true, data: getSheetDataAsObjects('Keys') };
          break;

        case 'saveKey':
          responseData = saveKey(params.data, userEmail);
          break;

        case 'getAdminUsers':
          responseData = { success: true, data: getSheetDataAsObjects('AdminUsers') };
          break;

        case 'saveAdminUser':
          responseData = saveAdminUser(params.data, userEmail);
          break;

        case 'getAuditLogs':
          responseData = { success: true, data: getSheetDataAsObjects('AuditLog') };
          break;

        case 'getSettings':
          responseData = { success: true, data: getSettingsData() };
          break;

        case 'saveSettings':
          responseData = saveSettings(params.data, userEmail);
          break;

        default:
          responseData = { success: false, message: 'Unknown action: ' + action };
      }
    }
  } catch (error) {
    responseData = { success: false, message: error.toString(), stack: error.stack };
  } finally {
    if (lock && hasLock) {
      lock.releaseLock();
    }
  }

  return createJsonResponse(responseData);
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * ============================================================
 * ROLE-BASED ACCESS CONTROL (RBAC) & PERMISSIONS
 * ============================================================
 */
function checkPermission(email, action) {
  // ระบบนี้ใช้งานสำหรับ Admin คนเดียว อนุญาตการทำรายการทั้งหมดเสมอ
  return { allowed: true, role: 'SuperAdmin' };
}

/**
 * ============================================================
 * DATABASE UTILITIES
 * ============================================================
 */
function getSheetDataAsObjects(sheetName) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const headers = data[0];
  const rows = data.slice(1);

  return rows.map((row, rowIndex) => {
    const obj = { _rowIndex: rowIndex + 2 };
    headers.forEach((header, colIndex) => {
      let val = row[colIndex];
      if (val instanceof Date) {
        val = Utilities.formatDate(val, 'Asia/Bangkok', 'yyyy-MM-dd');
      }
      obj[header] = val;
    });
    return obj;
  });
}

function writeAuditLog(userEmail, action, moduleName, recordId, oldValue, newValue, remark) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('AuditLog');
    if (!sheet) return;

    const logId = 'LOG' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMddHHmmss') + '_' + Math.floor(Math.random() * 1000);
    const timestamp = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');

    sheet.appendRow([
      logId,
      timestamp,
      userEmail || 'System',
      action,
      moduleName,
      recordId || '',
      typeof oldValue === 'object' ? JSON.stringify(oldValue) : String(oldValue || ''),
      typeof newValue === 'object' ? JSON.stringify(newValue) : String(newValue || ''),
      remark || ''
    ]);
  } catch (err) {
    console.error('AuditLog error: ' + err.message);
  }
}

/**
 * ============================================================
 * ROOM STATUS CALCULATION ENGINE (Section 27)
 * ============================================================
 */
function getRoomsWithStatus() {
  const rooms = getSheetDataAsObjects('Rooms').filter(r => r.Status !== 'Deleted');
  const beds = getSheetDataAsObjects('Beds').filter(b => b.Status !== 'Deleted');
  const occupancies = getSheetDataAsObjects('Occupancy').filter(o => o.OccupancyStatus === 'Active');
  const employees = getSheetDataAsObjects('Employees');
  const buildings = getSheetDataAsObjects('Buildings');
  const maintenanceList = getSheetDataAsObjects('Maintenance').filter(m => m.Status === 'In Progress');

  const empMap = {};
  employees.forEach(emp => { empMap[emp.EmployeeID] = emp; });

  const bldMap = {};
  buildings.forEach(bld => { bldMap[bld.BuildingID] = bld; });

  return rooms.map(room => {
    const building = bldMap[room.BuildingID] || {};
    const roomBeds = beds.filter(b => b.RoomID === room.RoomID);
    const activeBeds = roomBeds.filter(b => b.Status === 'Active');
    const roomOccupancies = occupancies.filter(o => o.RoomID === room.RoomID);

    // ดึงรายชื่อผู้พักปัจจุบัน
    const currentOccupants = roomOccupancies.map(occ => {
      const emp = empMap[occ.EmployeeID] || {};
      const bed = roomBeds.find(b => b.BedID === occ.BedID) || {};
      return {
        occupancyId: occ.OccupancyID,
        employeeId: occ.EmployeeID,
        fullName: emp.FullName || (emp.FirstName + ' ' + emp.LastName),
        department: emp.Department || '',
        phone: emp.Phone || '',
        plant: emp.Plant || '',
        bedId: occ.BedID,
        bedNumber: bed.BedNumber || '',
        checkInDate: occ.CheckInDate,
        expectedCheckOutDate: occ.ExpectedCheckOutDate
      };
    });

    const isUnderMaintenance = maintenanceList.some(m => m.RoomID === room.RoomID) || room.MaintenanceStatus === 'In Progress';
    const activeBedsCount = activeBeds.length;
    const occupiedBedsCount = roomOccupancies.length;
    const availableBedsCount = Math.max(0, activeBedsCount - occupiedBedsCount);

    // คำนวณสถานะห้องตาม Master Spec Section 27
    let computedStatus = 'Available';
    if (room.Status === 'Inactive') {
      computedStatus = 'Inactive';
    } else if (isUnderMaintenance) {
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

    return {
      roomId: room.RoomID,
      buildingId: room.BuildingID,
      buildingCode: building.BuildingCode || '',
      buildingName: building.BuildingName || '',
      floorId: room.FloorID,
      roomNumber: room.RoomNumber,
      roomType: room.RoomType,
      capacity: Number(room.Capacity) || activeBedsCount,
      activeBedsCount: activeBedsCount,
      occupiedBedsCount: occupiedBedsCount,
      availableBedsCount: availableBedsCount,
      gender: room.Gender,
      monthlyRate: room.MonthlyRate,
      rawStatus: room.Status,
      maintenanceStatus: room.MaintenanceStatus,
      computedStatus: computedStatus,
      hasAirConditioner: room.HasAirConditioner,
      hasFurniture: room.HasFurniture,
      remark: room.Remark,
      occupants: currentOccupants,
      beds: roomBeds.map(b => {
        const occ = roomOccupancies.find(o => o.BedID === b.BedID);
        return {
          bedId: b.BedID,
          bedNumber: b.BedNumber,
          bedType: b.BedType,
          status: b.Status,
          isOccupied: !!occ,
          occupantName: occ ? (empMap[occ.EmployeeID] ? empMap[occ.EmployeeID].FullName : occ.EmployeeID) : null
        };
      })
    };
  });
}

function getRoomDetail(roomId) {
  const rooms = getRoomsWithStatus();
  return rooms.find(r => r.roomId === roomId) || null;
}

/**
 * ============================================================
 * DASHBOARD CONSOLIDATED DATA (Section 6, 7 & Performance Rule 54)
 * แก้ไข: Chart "แนวโน้มเข้าพัก/ย้ายออก" และ "สถิติงานแจ้งซ่อม"
 * เดิมฝั่ง Frontend (dashboard.js) ใช้ข้อมูลตายตัว (hardcode) เสมอ
 * ตอนนี้คำนวณจากข้อมูลจริงใน Occupancy / CheckOut / RepairRequests
 * แล้วส่งผ่าน key "monthlyTrends" และ "repairStats" แทน
 * ============================================================
 */
function getDashboardData() {
  const rooms = getRoomsWithStatus();
  const buildings = getSheetDataAsObjects('Buildings').filter(b => b.Status === 'Active');
  const employees = getSheetDataAsObjects('Employees').filter(e => e.EmploymentStatus === 'Active');
  const occupancies = getSheetDataAsObjects('Occupancy');
  const checkOuts = getSheetDataAsObjects('CheckOut');
  const requests = getSheetDataAsObjects('RoomRequests');
  const repairs = getSheetDataAsObjects('RepairRequests');

  // KPI Calculations
  const totalRooms = rooms.length;
  const availableRooms = rooms.filter(r => r.computedStatus === 'Available').length;
  const partiallyOccupiedRooms = rooms.filter(r => r.computedStatus === 'Partially Occupied').length;
  const fullRooms = rooms.filter(r => r.computedStatus === 'Full').length;
  const maintenanceRooms = rooms.filter(r => r.computedStatus === 'Maintenance').length;
  const inactiveRooms = rooms.filter(r => r.computedStatus === 'Inactive').length;

  let totalBeds = 0;
  let occupiedBeds = 0;
  let availableBeds = 0;

  rooms.forEach(r => {
    totalBeds += r.activeBedsCount;
    occupiedBeds += r.occupiedBedsCount;
    availableBeds += r.availableBedsCount;
  });

  const totalOccupants = occupiedBeds;
  const overallOccupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  // New check-ins this month
  const now = new Date();
  const currentMonthStr = Utilities.formatDate(now, 'Asia/Bangkok', 'yyyy-MM');

  const newThisMonth = occupancies.filter(o => o.CheckInDate && String(o.CheckInDate).startsWith(currentMonthStr)).length;
  const checkOutThisMonth = checkOuts.filter(c => c.CheckOutDate && String(c.CheckOutDate).startsWith(currentMonthStr)).length;
  const pendingRequestsCount = requests.filter(r => r.RequestStatus === 'Pending').length;

  // Building Stats
  const buildingStats = buildings.map(bld => {
    const bldRooms = rooms.filter(r => r.buildingId === bld.BuildingID);
    let bldTotalBeds = 0;
    let bldOccupiedBeds = 0;
    bldRooms.forEach(r => {
      bldTotalBeds += r.activeBedsCount;
      bldOccupiedBeds += r.occupiedBedsCount;
    });
    return {
      buildingId: bld.BuildingID,
      buildingCode: bld.BuildingCode,
      buildingName: bld.BuildingName,
      totalRooms: bldRooms.length,
      totalBeds: bldTotalBeds,
      occupiedBeds: bldOccupiedBeds,
      occupancyRate: bldTotalBeds > 0 ? Math.round((bldOccupiedBeds / bldTotalBeds) * 100) : 0
    };
  });

  // Department Distribution
  const deptCounts = {};
  rooms.forEach(r => {
    r.occupants.forEach(occ => {
      const dept = occ.department || 'ไม่ระบุ';
      deptCounts[dept] = (deptCounts[dept] || 0) + 1;
    });
  });

  // Rooms with only 1 bed left
  const almostFullRooms = rooms.filter(r => r.availableBedsCount === 1 && r.activeBedsCount > 1);

  return {
    kpi: {
      totalRooms,
      availableRooms,
      partiallyOccupiedRooms,
      fullRooms,
      maintenanceRooms,
      inactiveRooms,
      totalBeds,
      availableBeds,
      occupiedBeds,
      totalOccupants,
      overallOccupancyRate,
      newThisMonth,
      checkOutThisMonth,
      pendingRequestsCount,
      totalEmployees: employees.length
    },
    charts: {
      roomStatus: {
        labels: ['ว่าง', 'ว่างบางส่วน', 'เต็ม', 'ปิดปรับปรุง', 'ไม่เปิดใช้งาน'],
        counts: [availableRooms, partiallyOccupiedRooms, fullRooms, maintenanceRooms, inactiveRooms]
      },
      buildingOccupancy: {
        labels: buildingStats.map(b => b.buildingName),
        counts: buildingStats.map(b => b.occupiedBeds),
        rates: buildingStats.map(b => b.occupancyRate)
      },
      departmentDistribution: {
        labels: Object.keys(deptCounts),
        counts: Object.values(deptCounts)
      },
      roomTypes: getRoomTypeCounts(rooms),
      // ข้อมูลจริงของแนวโน้มเข้าพัก/ย้ายออกย้อนหลัง 6 เดือน (แทนของปลอมเดิม)
      monthlyTrends: getMonthlyTrends(occupancies, checkOuts),
      // ข้อมูลจริงของสถิติงานแจ้งซ่อมแยกตามประเภท (แทนของปลอมเดิม)
      repairStats: getRepairStats(repairs)
    },
    buildingStats,
    almostFullRooms: almostFullRooms.map(r => ({
      roomNumber: r.roomNumber,
      buildingName: r.buildingName,
      capacity: r.capacity,
      occupied: r.occupiedBedsCount,
      available: r.availableBedsCount
    })),
    recentRequests: requests.slice(-5).reverse(),
    activeRepairs: repairs.filter(rep => rep.Status === 'Pending' || rep.Status === 'In Progress').slice(-5).reverse()
  };
}

function getRoomTypeCounts(rooms) {
  const counts = {};
  rooms.forEach(r => {
    const type = r.roomType || 'Standard';
    counts[type] = (counts[type] || 0) + 1;
  });
  return {
    labels: Object.keys(counts),
    counts: Object.values(counts)
  };
}

/**
 * คำนวณแนวโน้มผู้เข้าพักใหม่ / ผู้ย้ายออก ย้อนหลัง 6 เดือน (รวมเดือนปัจจุบัน)
 * จากข้อมูลจริงในตาราง Occupancy (CheckInDate) และ CheckOut (CheckOutDate)
 */
function getMonthlyTrends(occupancies, checkOuts) {
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: Utilities.formatDate(d, 'Asia/Bangkok', 'yyyy-MM'),
      label: THAI_MONTH_ABBR[d.getMonth()]
    });
  }

  const checkInCounts = months.map(m =>
    occupancies.filter(o => o.CheckInDate && String(o.CheckInDate).startsWith(m.key)).length
  );
  const checkOutCounts = months.map(m =>
    checkOuts.filter(c => c.CheckOutDate && String(c.CheckOutDate).startsWith(m.key)).length
  );

  return {
    labels: months.map(m => m.label),
    checkIns: checkInCounts,
    checkOuts: checkOutCounts
  };
}

/**
 * นับจำนวนงานแจ้งซ่อมจริงแยกตามประเภท (IssueType) จากตาราง RepairRequests
 */
function getRepairStats(repairs) {
  const counts = {};
  // ตั้งค่าเริ่มต้นเป็น 0 ตามลำดับที่ต้องการแสดงผล เผื่อบางประเภทไม่มีข้อมูลเลย
  Object.keys(ISSUE_TYPE_LABELS).forEach(key => {
    counts[ISSUE_TYPE_LABELS[key]] = 0;
  });

  (repairs || []).forEach(rep => {
    const label = ISSUE_TYPE_LABELS[rep.IssueType] || 'อื่นๆ';
    counts[label] = (counts[label] || 0) + 1;
  });

  return {
    labels: Object.keys(counts),
    counts: Object.values(counts)
  };
}

/**
 * ============================================================
 * WORKFLOW: CHECK-IN (Section 29)
 * ============================================================
 */
function checkInOccupant(data, userEmail) {
  const ss = getSpreadsheet();
  const occSheet = ss.getSheetByName('Occupancy');
  const beds = getSheetDataAsObjects('Beds');
  const activeOccupancies = getSheetDataAsObjects('Occupancy').filter(o => o.OccupancyStatus === 'Active');
  const rooms = getRoomsWithStatus();

  const targetRoom = rooms.find(r => r.roomId === data.roomId);
  if (!targetRoom) {
    return { success: false, message: 'ไม่พบข้อมูลห้องพักที่เลือก' };
  }
  if (targetRoom.computedStatus === 'Maintenance') {
    return { success: false, message: 'ไม่สามารถเช็คอินได้ เนื่องจากห้องพักอยู่ระหว่างปิดปรับปรุง' };
  }

  // ตรวจสอบว่าเตียงว่างหรือไม่ (Rule 08)
  const isBedOccupied = activeOccupancies.some(o => o.BedID === data.bedId);
  if (isBedOccupied) {
    return { success: false, message: 'เตียงนี้มีผู้เข้าพักอยู่แล้ว กรุณาเลือกเตียงอื่น' };
  }

  // ตรวจสอบว่าพนักงานมี Active Occupancy อื่นอยู่หรือไม่ (Rule 49)
  const empAlreadyStay = activeOccupancies.find(o => o.EmployeeID === data.employeeId);
  if (empAlreadyStay) {
    return { success: false, message: 'พนักงานท่านนี้มีห้องพักปัจจุบันอยู่แล้วในห้อง ' + empAlreadyStay.RoomID };
  }

  const occupancyId = 'OCC' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMddHHmmss');
  const createdAt = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');

  occSheet.appendRow([
    occupancyId,
    data.employeeId,
    data.roomId,
    data.bedId,
    data.checkInDate || Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd'),
    data.expectedCheckOutDate || '',
    '',
    'Active',
    data.reason || 'Check-in ปกติ',
    createdAt,
    userEmail,
    data.remark || ''
  ]);

  writeAuditLog(userEmail, 'CHECKIN', 'Occupancy', occupancyId, null, {
    employeeId: data.employeeId,
    roomId: data.roomId,
    bedId: data.bedId
  }, 'Check-in เข้าห้องพัก');

  return { success: true, message: 'บันทึกการเช็คอินสำเร็จ', occupancyId };
}

/**
 * ============================================================
 * WORKFLOW: CHECK-OUT (Section 30)
 * ============================================================
 */
function checkOutOccupant(data, userEmail) {
  const ss = getSpreadsheet();
  const occSheet = ss.getSheetByName('Occupancy');
  const checkOutSheet = ss.getSheetByName('CheckOut');
  const occupancies = getSheetDataAsObjects('Occupancy');

  const targetOcc = occupancies.find(o => o.OccupancyID === data.occupancyId && o.OccupancyStatus === 'Active');
  if (!targetOcc) {
    return { success: false, message: 'ไม่พบรายการเข้าพักที่ระบุ หรือได้ทำการเช็คเอาท์ไปแล้ว' };
  }

  const checkOutDate = data.checkOutDate || Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');
  const checkOutId = 'OUT' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMddHHmmss');

  // อัปเดต Occupancy เป็น CheckedOut
  const occRowIndex = targetOcc._rowIndex;
  const occHeaders = occSheet.getRange(1, 1, 1, occSheet.getLastColumn()).getValues()[0];
  const statusCol = occHeaders.indexOf('OccupancyStatus') + 1;
  const actualOutCol = occHeaders.indexOf('ActualCheckOutDate') + 1;

  if (statusCol > 0) occSheet.getRange(occRowIndex, statusCol).setValue('CheckedOut');
  if (actualOutCol > 0) occSheet.getRange(occRowIndex, actualOutCol).setValue(checkOutDate);

  // บันทึก CheckOut Sheet
  checkOutSheet.appendRow([
    checkOutId,
    data.occupancyId,
    targetOcc.EmployeeID,
    targetOcc.RoomID,
    targetOcc.BedID,
    checkOutDate,
    data.reason || 'หมดสัญญา/ย้ายออก',
    data.keyReturned !== false ? 'TRUE' : 'FALSE',
    data.propertyReturned !== false ? 'TRUE' : 'FALSE',
    data.roomCondition || 'Normal',
    Number(data.damageAmount) || 0,
    userEmail,
    data.remark || ''
  ]);

  writeAuditLog(userEmail, 'CHECKOUT', 'Occupancy', data.occupancyId, 'Active', 'CheckedOut', 'Check-out ย้ายออกจากห้อง');

  return { success: true, message: 'บันทึกการเช็คเอาท์สำเร็จ คืนสถานะเตียงว่างเรียบร้อยแล้ว' };
}

/**
 * ============================================================
 * WORKFLOW: ROOM TRANSFER (Section 31 & Rule 06)
 * ============================================================
 */
function transferOccupant(data, userEmail) {
  const ss = getSpreadsheet();
  const occSheet = ss.getSheetByName('Occupancy');
  const transferSheet = ss.getSheetByName('RoomTransfers');
  const occupancies = getSheetDataAsObjects('Occupancy');
  const activeOccupancies = occupancies.filter(o => o.OccupancyStatus === 'Active');

  const currentOcc = activeOccupancies.find(o => o.OccupancyID === data.occupancyId);
  if (!currentOcc) {
    return { success: false, message: 'ไม่พบรายการเข้าพักปัจจุบันที่ต้องการย้าย' };
  }

  // ตรวจสอบว่าเตียงใหม่ว่างหรือไม่
  const isTargetBedOccupied = activeOccupancies.some(o => o.BedID === data.newBedId && o.OccupancyID !== data.occupancyId);
  if (isTargetBedOccupied) {
    return { success: false, message: 'เตียงใหม่ที่เลือกมีผู้พักอยู่แล้ว ไม่สามารถย้ายได้' };
  }

  const transferDate = data.transferDate || Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');
  const transferId = 'TRF' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMddHHmmss');
  const newOccupancyId = 'OCC' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMddHHmmss');
  const timestamp = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');

  // 1. ปิด Occupancy เดิมเป็น Transferred
  const occHeaders = occSheet.getRange(1, 1, 1, occSheet.getLastColumn()).getValues()[0];
  const statusCol = occHeaders.indexOf('OccupancyStatus') + 1;
  const actualOutCol = occHeaders.indexOf('ActualCheckOutDate') + 1;
  if (statusCol > 0) occSheet.getRange(currentOcc._rowIndex, statusCol).setValue('Transferred');
  if (actualOutCol > 0) occSheet.getRange(currentOcc._rowIndex, actualOutCol).setValue(transferDate);

  // 2. สร้าง Occupancy ใหม่
  occSheet.appendRow([
    newOccupancyId,
    currentOcc.EmployeeID,
    data.newRoomId,
    data.newBedId,
    transferDate,
    currentOcc.ExpectedCheckOutDate || '',
    '',
    'Active',
    'ย้ายห้องจาก ' + currentOcc.RoomID,
    timestamp,
    userEmail,
    data.remark || ''
  ]);

  // 3. บันทึก RoomTransfers
  transferSheet.appendRow([
    transferId,
    currentOcc.EmployeeID,
    currentOcc.RoomID,
    currentOcc.BedID,
    data.newRoomId,
    data.newBedId,
    transferDate,
    data.reason || 'ขอย้ายห้อง',
    userEmail,
    transferDate,
    data.remark || ''
  ]);

  writeAuditLog(userEmail, 'TRANSFER', 'Occupancy', currentOcc.OccupancyID, {
    roomId: currentOcc.RoomID,
    bedId: currentOcc.BedID
  }, {
    newRoomId: data.newRoomId,
    newBedId: data.newBedId
  }, 'ย้ายห้องพัก');

  return { success: true, message: 'บันทึกการย้ายห้องสำเร็จ', newOccupancyId };
}

/**
 * ============================================================
 * EMPLOYEES CRUD
 * ============================================================
 */
function getEmployeesList() {
  return getSheetDataAsObjects('Employees').filter(e => e.EmploymentStatus !== 'Deleted');
}

function saveEmployee(data, userEmail) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('Employees');
  const employees = getSheetDataAsObjects('Employees');

  const isEdit = !!data.employeeId && employees.some(e => e.EmployeeID === data.employeeId);
  const fullName = (data.firstName || '') + ' ' + (data.lastName || '');

  if (isEdit) {
    const existing = employees.find(e => e.EmployeeID === data.employeeId);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const rowIdx = existing._rowIndex;

    const updateMap = {
      Prefix: data.prefix,
      FirstName: data.firstName,
      LastName: data.lastName,
      FullName: fullName.trim(),
      Department: data.department,
      Position: data.position,
      Plant: data.plant,
      Phone: data.phone,
      Email: data.email,
      EmploymentStatus: data.employmentStatus || 'Active',
      StartDate: data.startDate,
      Remark: data.remark
    };

    Object.keys(updateMap).forEach(key => {
      const colIdx = headers.indexOf(key) + 1;
      if (colIdx > 0 && updateMap[key] !== undefined) {
        sheet.getRange(rowIdx, colIdx).setValue(updateMap[key]);
      }
    });

    writeAuditLog(userEmail, 'UPDATE', 'Employees', data.employeeId, existing, updateMap, 'แก้ไขข้อมูลพนักงาน');
    return { success: true, message: 'อัปเดตข้อมูลพนักงานสำเร็จ', employeeId: data.employeeId };
  } else {
    // ตรวจสอบรหัสพนักงานซ้ำ
    const newId = data.employeeId || ('EMP' + String(employees.length + 1).padStart(3, '0'));
    if (employees.some(e => e.EmployeeID === newId)) {
      return { success: false, message: 'รหัสพนักงาน ' + newId + ' มีอยู่ในระบบแล้ว' };
    }

    sheet.appendRow([
      newId,
      data.prefix || '',
      data.firstName || '',
      data.lastName || '',
      fullName.trim(),
      data.department || '',
      data.position || '',
      data.plant || '',
      data.phone || '',
      data.email || '',
      data.employmentStatus || 'Active',
      data.startDate || Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd'),
      data.remark || ''
    ]);

    writeAuditLog(userEmail, 'CREATE', 'Employees', newId, null, data, 'เพิ่มพนักงานใหม่');
    return { success: true, message: 'เพิ่มพนักงานใหม่สำเร็จ', employeeId: newId };
  }
}

function deleteEmployee(employeeId, userEmail) {
  // Soft Delete (Rule 15, 70)
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('Employees');
  const employees = getSheetDataAsObjects('Employees');
  const emp = employees.find(e => e.EmployeeID === employeeId);

  if (!emp) return { success: false, message: 'ไม่พบพนักงาน' };

  // ตรวจสอบว่ามีห้องพักอยู่หรือไม่
  const occupancies = getSheetDataAsObjects('Occupancy').filter(o => o.OccupancyStatus === 'Active');
  if (occupancies.some(o => o.EmployeeID === employeeId)) {
    return { success: false, message: 'ไม่สามารถลบได้ เนื่องจากพนักงานมีรายการเข้าพักที่ยัง Active อยู่' };
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const colIdx = headers.indexOf('EmploymentStatus') + 1;
  sheet.getRange(emp._rowIndex, colIdx).setValue('Deleted');

  writeAuditLog(userEmail, 'DELETE', 'Employees', employeeId, emp.EmploymentStatus, 'Deleted', 'Soft delete พนักงาน');
  return { success: true, message: 'ลบข้อมูลพนักงานเรียบร้อยแล้ว' };
}

/**
 * ============================================================
 * ROOMS & BEDS CRUD
 * ============================================================
 */
function saveRoom(data, userEmail) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('Rooms');
  const rooms = getSheetDataAsObjects('Rooms');

  const isEdit = !!data.roomId && rooms.some(r => r.RoomID === data.roomId);

  if (isEdit) {
    const existing = rooms.find(r => r.RoomID === data.roomId);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const rowIdx = existing._rowIndex;
    const newCapacity = Number(data.capacity) || 2;

    // ------------------------------------------------------------------
    // แก้ไขปัญหา "ความจุห้องเปลี่ยนแต่จำนวนเตียงไม่เปลี่ยนตาม"
    // เช็คจำนวนเตียงจริงในตาราง Beds เทียบกับความจุใหม่ที่กรอกมาเสมอ
    // (ไม่ใช่แค่เทียบกับค่า Capacity เดิม เพื่อแก้ไขข้อมูลที่อาจเพี้ยนมาก่อนหน้านี้ด้วย)
    // - ถ้าความจุเพิ่มขึ้น -> สร้างเตียงใหม่ให้ครบอัตโนมัติ
    // - ถ้าความจุลดลง -> ปิดใช้งานเตียงว่างส่วนเกิน แต่ถ้าเตียงว่างไม่พอ
    //   (เพราะมีคนพักอยู่เกินความจุใหม่) จะปฏิเสธการบันทึกทั้งหมดทันที
    //   เพื่อป้องกันข้อมูลผู้พักอาศัยเสียหาย
    // ------------------------------------------------------------------
    const syncResult = syncRoomBeds(data.roomId, newCapacity, userEmail);
    if (!syncResult.success) {
      return syncResult;
    }

    const updateMap = {
      BuildingID: data.buildingId,
      FloorID: data.floorId,
      RoomNumber: data.roomNumber,
      RoomType: data.roomType,
      Capacity: newCapacity,
      Gender: data.gender,
      MonthlyRate: Number(data.monthlyRate) || 0,
      Status: data.status || 'Active',
      MaintenanceStatus: data.maintenanceStatus || 'Normal',
      HasAirConditioner: data.hasAirConditioner === true || data.hasAirConditioner === 'true',
      HasFurniture: data.hasFurniture === true || data.hasFurniture === 'true',
      Remark: data.remark
    };

    Object.keys(updateMap).forEach(key => {
      const colIdx = headers.indexOf(key) + 1;
      if (colIdx > 0 && updateMap[key] !== undefined) {
        sheet.getRange(rowIdx, colIdx).setValue(updateMap[key]);
      }
    });

    writeAuditLog(userEmail, 'UPDATE', 'Rooms', data.roomId, existing, updateMap, 'แก้ไขข้อมูลห้องพัก');
    return { success: true, message: 'อัปเดตห้องพักสำเร็จ (ปรับจำนวนเตียงให้ตรงกับความจุแล้ว)', roomId: data.roomId };
  } else {
    // ป้องกัน RoomNumber ซ้ำในตึกเดียวกัน
    if (rooms.some(r => r.BuildingID === data.buildingId && r.RoomNumber === data.roomNumber && r.Status !== 'Deleted')) {
      return { success: false, message: 'เลขห้อง ' + data.roomNumber + ' มีอยู่ในอาคารนี้แล้ว' };
    }

    const newId = data.roomId || ('R' + String(rooms.length + 1).padStart(3, '0'));
    sheet.appendRow([
      newId,
      data.buildingId,
      data.floorId || '',
      data.roomNumber,
      data.roomType || 'Double',
      Number(data.capacity) || 2,
      data.gender || 'Any',
      Number(data.monthlyRate) || 0,
      data.status || 'Active',
      'Normal',
      data.hasAirConditioner === true || data.hasAirConditioner === 'true',
      data.hasFurniture === true || data.hasFurniture === 'true',
      data.remark || ''
    ]);

    // สร้างเตียงอัตโนมัติตาม Capacity
    const capacity = Number(data.capacity) || 2;
    const bedsSheet = ss.getSheetByName('Beds');
    const existingBeds = getSheetDataAsObjects('Beds');
    for (let i = 1; i <= capacity; i++) {
      const bedId = 'BED' + String(existingBeds.length + i).padStart(3, '0');
      const bedNumber = String(i).padStart(2, '0');
      bedsSheet.appendRow([bedId, newId, bedNumber, 'Single', 'Active', 'เตียง ' + bedNumber]);
    }

    writeAuditLog(userEmail, 'CREATE', 'Rooms', newId, null, data, 'เพิ่มห้องพักใหม่พร้อมเตียง');
    return { success: true, message: 'เพิ่มห้องพักและเตียงสำเร็จ', roomId: newId };
  }
}

/**
 * ปรับจำนวนเตียง (Beds) ของห้องให้ตรงกับความจุ (Capacity) ที่ต้องการ
 * - เพิ่มความจุ: สร้างเตียง Active ใหม่ให้ครบ
 * - ลดความจุ: ปิดใช้งาน (Inactive) เตียงที่ "ว่าง" อยู่ก่อน โดยไม่แตะเตียงที่มีคนพัก
 *   ถ้าจำนวนเตียงว่างไม่พอที่จะลดได้ตามที่ขอ จะคืนค่า success:false พร้อมข้อความแจ้งเหตุผล
 *   และจะไม่มีการแก้ไขข้อมูลใดๆ ทั้งสิ้น (all-or-nothing)
 */
function syncRoomBeds(roomId, newCapacity, userEmail) {
  const ss = getSpreadsheet();
  const bedsSheet = ss.getSheetByName('Beds');
  const allBeds = getSheetDataAsObjects('Beds');
  const roomBeds = allBeds.filter(b => b.RoomID === roomId && b.Status !== 'Deleted');
  const activeBeds = roomBeds.filter(b => b.Status === 'Active');
  const currentCount = activeBeds.length;

  if (newCapacity === currentCount) {
    return { success: true };
  }

  if (newCapacity > currentCount) {
    // ------------------ เพิ่มเตียงให้ครบตามความจุใหม่ ------------------
    const bedsToAdd = newCapacity - currentCount;

    let maxBedNum = 0;
    roomBeds.forEach(b => {
      const n = parseInt(b.BedNumber, 10);
      if (!isNaN(n) && n > maxBedNum) maxBedNum = n;
    });

    const globalBedCount = allBeds.length;
    for (let i = 1; i <= bedsToAdd; i++) {
      const bedNumber = String(maxBedNum + i).padStart(2, '0');
      const bedId = 'BED' + String(globalBedCount + i).padStart(3, '0');
      bedsSheet.appendRow([bedId, roomId, bedNumber, 'Single', 'Active', 'เตียงเพิ่มจากการปรับความจุห้อง']);
    }

    writeAuditLog(userEmail, 'UPDATE', 'Beds', roomId, currentCount, newCapacity, 'เพิ่มเตียงอัตโนมัติจากการแก้ไขความจุห้อง (+' + bedsToAdd + ')');
    return { success: true };
  }

  // ------------------ ลดจำนวนเตียงลงตามความจุใหม่ ------------------
  const bedsToRemove = currentCount - newCapacity;
  const activeOccupancies = getSheetDataAsObjects('Occupancy').filter(o => o.OccupancyStatus === 'Active');
  const occupiedBedIds = new Set(
    activeOccupancies.filter(o => o.RoomID === roomId).map(o => o.BedID)
  );

  const vacantBeds = activeBeds.filter(b => !occupiedBedIds.has(b.BedID));

  if (vacantBeds.length < bedsToRemove) {
    return {
      success: false,
      message: 'ไม่สามารถลดความจุห้องได้ เนื่องจากมีผู้พักอาศัยอยู่ ' + occupiedBedIds.size +
        ' คน (เตียงว่างเหลือ ' + vacantBeds.length + ' เตียง แต่ต้องการลดจำนวนเตียงลง ' + bedsToRemove +
        ' เตียง) กรุณาย้ายห้องหรือเช็คเอาท์ผู้พักบางส่วนออกก่อน แล้วจึงลดความจุห้องอีกครั้ง'
    };
  }

  const bedsHeaders = bedsSheet.getRange(1, 1, 1, bedsSheet.getLastColumn()).getValues()[0];
  const statusCol = bedsHeaders.indexOf('Status') + 1;
  const remarkCol = bedsHeaders.indexOf('Remark') + 1;

  for (let i = 0; i < bedsToRemove; i++) {
    const bed = vacantBeds[i];
    if (statusCol > 0) bedsSheet.getRange(bed._rowIndex, statusCol).setValue('Inactive');
    if (remarkCol > 0) bedsSheet.getRange(bed._rowIndex, remarkCol).setValue('ปิดใช้งานจากการลดความจุห้อง');
  }

  writeAuditLog(userEmail, 'UPDATE', 'Beds', roomId, currentCount, newCapacity, 'ปิดใช้งานเตียงส่วนเกินจากการลดความจุห้อง (-' + bedsToRemove + ')');
  return { success: true };
}

function deleteRoom(roomId, userEmail) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('Rooms');
  const rooms = getSheetDataAsObjects('Rooms');
  const room = rooms.find(r => r.RoomID === roomId);

  if (!room) return { success: false, message: 'ไม่พบห้องพัก' };

  // ตรวจสอบว่ามีผู้พักอยู่หรือไม่
  const occupancies = getSheetDataAsObjects('Occupancy').filter(o => o.OccupancyStatus === 'Active');
  if (occupancies.some(o => o.RoomID === roomId)) {
    return { success: false, message: 'ไม่สามารถลบห้องได้ เนื่องจากยังมีผู้พักอาศัยอยู่ในห้องนี้' };
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const colIdx = headers.indexOf('Status') + 1;
  sheet.getRange(room._rowIndex, colIdx).setValue('Deleted');

  writeAuditLog(userEmail, 'DELETE', 'Rooms', roomId, room.Status, 'Deleted', 'Soft delete ห้องพัก');
  return { success: true, message: 'ลบห้องพักเรียบร้อยแล้ว' };
}

function saveBed(data, userEmail) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('Beds');
  const beds = getSheetDataAsObjects('Beds');

  if (data.bedId && beds.some(b => b.BedID === data.bedId)) {
    const existing = beds.find(b => b.BedID === data.bedId);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const statusCol = headers.indexOf('Status') + 1;
    const typeCol = headers.indexOf('BedType') + 1;
    const remarkCol = headers.indexOf('Remark') + 1;

    if (statusCol > 0 && data.status) sheet.getRange(existing._rowIndex, statusCol).setValue(data.status);
    if (typeCol > 0 && data.bedType) sheet.getRange(existing._rowIndex, typeCol).setValue(data.bedType);
    if (remarkCol > 0 && data.remark) sheet.getRange(existing._rowIndex, remarkCol).setValue(data.remark);

    writeAuditLog(userEmail, 'UPDATE', 'Beds', data.bedId, existing, data, 'แก้ไขข้อมูลเตียง');
    return { success: true, message: 'อัปเดตเตียงสำเร็จ' };
  } else {
    const newId = data.bedId || ('BED' + String(beds.length + 1).padStart(3, '0'));
    sheet.appendRow([
      newId,
      data.roomId,
      data.bedNumber || '01',
      data.bedType || 'Single',
      data.status || 'Active',
      data.remark || ''
    ]);
    writeAuditLog(userEmail, 'CREATE', 'Beds', newId, null, data, 'เพิ่มเตียงใหม่');
    return { success: true, message: 'เพิ่มเตียงสำเร็จ', bedId: newId };
  }
}

/**
 * ============================================================
 * BUILDINGS CRUD
 * ============================================================
 */
function saveBuilding(data, userEmail) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('Buildings');
  const buildings = getSheetDataAsObjects('Buildings');

  if (data.buildingId && buildings.some(b => b.BuildingID === data.buildingId)) {
    const existing = buildings.find(b => b.BuildingID === data.buildingId);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const rowIdx = existing._rowIndex;

    const updateMap = {
      BuildingCode: data.buildingCode,
      BuildingName: data.buildingName,
      Location: data.location,
      NumberOfFloors: Number(data.numberOfFloors) || 1,
      Status: data.status || 'Active',
      Remark: data.remark
    };

    Object.keys(updateMap).forEach(key => {
      const colIdx = headers.indexOf(key) + 1;
      if (colIdx > 0 && updateMap[key] !== undefined) {
        sheet.getRange(rowIdx, colIdx).setValue(updateMap[key]);
      }
    });

    writeAuditLog(userEmail, 'UPDATE', 'Buildings', data.buildingId, existing, updateMap, 'แก้ไขอาคาร');
    return { success: true, message: 'อัปเดตอาคารสำเร็จ' };
  } else {
    const newId = data.buildingId || ('B' + String(buildings.length + 1).padStart(3, '0'));
    sheet.appendRow([
      newId,
      data.buildingCode || '',
      data.buildingName || '',
      data.location || '',
      Number(data.numberOfFloors) || 1,
      Number(data.totalRooms) || 0,
      data.status || 'Active',
      data.remark || ''
    ]);
    writeAuditLog(userEmail, 'CREATE', 'Buildings', newId, null, data, 'เพิ่มอาคารใหม่');
    return { success: true, message: 'เพิ่มอาคารสำเร็จ', buildingId: newId };
  }
}

/**
 * ============================================================
 * MAINTENANCE & REPAIRS
 * ============================================================
 */
function saveMaintenance(data, userEmail) {
  const ss = getSpreadsheet();
  const maintSheet = ss.getSheetByName('Maintenance');
  const roomSheet = ss.getSheetByName('Rooms');
  const rooms = getSheetDataAsObjects('Rooms');

  const maintId = data.maintenanceId || ('MNT' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMddHHmmss'));
  const startDate = data.startDate || Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');
  const status = data.status || 'In Progress';

  maintSheet.appendRow([
    maintId,
    data.roomId,
    startDate,
    data.expectedEndDate || '',
    status === 'Completed' ? Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd') : '',
    data.problem || '',
    status,
    data.technician || '',
    Number(data.cost) || 0,
    data.remark || ''
  ]);

  // อัปเดตสถานะ Maintenance ในตาราง Rooms (Rule 07)
  const room = rooms.find(r => r.RoomID === data.roomId);
  if (room) {
    const rHeaders = roomSheet.getRange(1, 1, 1, roomSheet.getLastColumn()).getValues()[0];
    const maintCol = rHeaders.indexOf('MaintenanceStatus') + 1;
    if (maintCol > 0) {
      roomSheet.getRange(room._rowIndex, maintCol).setValue(status === 'Completed' ? 'Normal' : 'In Progress');
    }
  }

  writeAuditLog(userEmail, 'MAINTENANCE', 'Maintenance', maintId, null, data, 'บันทึกการซ่อมบำรุงปิดห้อง');
  return { success: true, message: 'บันทึกงานซ่อมบำรุงห้องสำเร็จ' };
}

function saveRepairRequest(data, userEmail) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('RepairRequests');
  const repairs = getSheetDataAsObjects('RepairRequests');

  const repairId = data.repairId || ('REP' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMddHHmmss'));
  const reqDate = data.requestDate || Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');

  sheet.appendRow([
    repairId,
    data.roomId,
    data.employeeId || '',
    reqDate,
    data.issueType || 'General',
    data.description || '',
    data.priority || 'Medium',
    'Pending',
    data.assignedTo || '',
    '',
    '',
    Number(data.cost) || 0,
    data.remark || ''
  ]);

  writeAuditLog(userEmail, 'CREATE', 'RepairRequests', repairId, null, data, 'แจ้งซ่อมอุปกรณ์');
  return { success: true, message: 'ส่งคำขอแจ้งซ่อมสำเร็จ', repairId };
}

function updateRepairStatus(data, userEmail) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('RepairRequests');
  const repairs = getSheetDataAsObjects('RepairRequests');
  const target = repairs.find(r => r.RepairID === data.repairId);

  if (!target) return { success: false, message: 'ไม่พบรายการแจ้งซ่อม' };

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const statusCol = headers.indexOf('Status') + 1;
  const techCol = headers.indexOf('AssignedTo') + 1;
  const costCol = headers.indexOf('Cost') + 1;
  const compCol = headers.indexOf('CompletedDate') + 1;

  if (statusCol > 0) sheet.getRange(target._rowIndex, statusCol).setValue(data.status);
  if (techCol > 0 && data.assignedTo) sheet.getRange(target._rowIndex, techCol).setValue(data.assignedTo);
  if (costCol > 0 && data.cost) sheet.getRange(target._rowIndex, costCol).setValue(Number(data.cost));
  if (compCol > 0 && data.status === 'Completed') {
    sheet.getRange(target._rowIndex, compCol).setValue(Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd'));
  }

  writeAuditLog(userEmail, 'UPDATE', 'RepairRequests', data.repairId, target.Status, data.status, 'อัปเดตสถานะงานซ่อม');
  return { success: true, message: 'อัปเดตสถานะงานซ่อมสำเร็จ' };
}

/**
 * ============================================================
 * ROOM REQUESTS WORKFLOW (Section 15)
 * ============================================================
 */
function createRoomRequest(data, userEmail) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('RoomRequests');
  const reqId = 'REQ' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMddHHmmss');
  const reqDate = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');

  sheet.appendRow([
    reqId,
    data.employeeId,
    reqDate,
    data.preferredBuilding || '',
    data.preferredRoomType || 'Double',
    data.preferredGender || 'Any',
    data.requestedCheckInDate || '',
    data.requestedCheckOutDate || '',
    data.reason || '',
    'Pending',
    '',
    '',
    data.remark || ''
  ]);

  writeAuditLog(userEmail, 'CREATE', 'RoomRequests', reqId, null, data, 'ยื่นคำขอเข้าพักใหม่');
  return { success: true, message: 'ส่งคำขอเข้าพักสำเร็จ รอการอนุมัติ', requestId: reqId };
}

function updateRequestStatus(data, userEmail) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('RoomRequests');
  const requests = getSheetDataAsObjects('RoomRequests');
  const target = requests.find(r => r.RequestID === data.requestId);

  if (!target) return { success: false, message: 'ไม่พบคำขอ' };

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const statusCol = headers.indexOf('RequestStatus') + 1;
  const appByCol = headers.indexOf('ApprovedBy') + 1;
  const appDateCol = headers.indexOf('ApprovedDate') + 1;

  if (statusCol > 0) sheet.getRange(target._rowIndex, statusCol).setValue(data.status);
  if (appByCol > 0) sheet.getRange(target._rowIndex, appByCol).setValue(userEmail);
  if (appDateCol > 0) sheet.getRange(target._rowIndex, appDateCol).setValue(Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd'));

  writeAuditLog(userEmail, data.status.toUpperCase(), 'RoomRequests', data.requestId, target.RequestStatus, data.status, 'ปรับสถานะคำขอ');
  return { success: true, message: 'ปรับปรุงสถานะคำขอสำเร็จ' };
}

/**
 * ============================================================
 * ASSETS & KEYS
 * ============================================================
 */
function saveAsset(data, userEmail) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('RoomAssets');
  const assets = getSheetDataAsObjects('RoomAssets');

  if (data.assetId && assets.some(a => a.AssetID === data.assetId)) {
    const existing = assets.find(a => a.AssetID === data.assetId);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const rowIdx = existing._rowIndex;

    const updateMap = {
      RoomID: data.roomId,
      AssetType: data.assetType,
      AssetName: data.assetName,
      AssetCode: data.assetCode,
      Condition: data.condition || 'Good',
      Status: data.status || 'Active',
      Remark: data.remark
    };

    Object.keys(updateMap).forEach(key => {
      const colIdx = headers.indexOf(key) + 1;
      if (colIdx > 0 && updateMap[key] !== undefined) {
        sheet.getRange(rowIdx, colIdx).setValue(updateMap[key]);
      }
    });

    writeAuditLog(userEmail, 'UPDATE', 'RoomAssets', data.assetId, existing, updateMap, 'แก้ไขทรัพย์สิน');
    return { success: true, message: 'อัปเดตทรัพย์สินสำเร็จ' };
  } else {
    const newId = data.assetId || ('AST' + String(assets.length + 1).padStart(3, '0'));
    sheet.appendRow([
      newId,
      data.roomId,
      data.assetType || 'Furniture',
      data.assetName || '',
      data.assetCode || '',
      data.condition || 'Good',
      data.purchaseDate || Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd'),
      data.status || 'Active',
      data.remark || ''
    ]);
    writeAuditLog(userEmail, 'CREATE', 'RoomAssets', newId, null, data, 'เพิ่มทรัพย์สินห้องพัก');
    return { success: true, message: 'เพิ่มทรัพย์สินสำเร็จ', assetId: newId };
  }
}

function deleteAsset(assetId, userEmail) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('RoomAssets');
  const assets = getSheetDataAsObjects('RoomAssets');
  const item = assets.find(a => a.AssetID === assetId);

  if (!item) return { success: false, message: 'ไม่พบข้อมูลทรัพย์สิน' };

  sheet.deleteRow(item._rowIndex);
  writeAuditLog(userEmail, 'DELETE', 'RoomAssets', assetId, item, null, 'ลบทรัพย์สิน');
  return { success: true, message: 'ลบทรัพย์สินเรียบร้อยแล้ว' };
}

function saveKey(data, userEmail) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('Keys');
  const keys = getSheetDataAsObjects('Keys');

  if (data.keyId && keys.some(k => k.KeyID === data.keyId)) {
    const existing = keys.find(k => k.KeyID === data.keyId);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const rowIdx = existing._rowIndex;

    const updateMap = {
      RoomID: data.roomId,
      KeyNumber: data.keyNumber,
      EmployeeID: data.employeeId || '',
      IssueDate: data.issueDate || '',
      ReturnDate: data.returnDate || '',
      Status: data.status || 'Available',
      Remark: data.remark
    };

    Object.keys(updateMap).forEach(key => {
      const colIdx = headers.indexOf(key) + 1;
      if (colIdx > 0 && updateMap[key] !== undefined) {
        sheet.getRange(rowIdx, colIdx).setValue(updateMap[key]);
      }
    });

    writeAuditLog(userEmail, 'UPDATE', 'Keys', data.keyId, existing, updateMap, 'แก้ไขข้อมูลกุญแจ');
    return { success: true, message: 'อัปเดตข้อมูลกุญแจสำเร็จ' };
  } else {
    const newId = data.keyId || ('KEY' + String(keys.length + 1).padStart(3, '0'));
    sheet.appendRow([
      newId,
      data.roomId,
      data.keyNumber,
      data.employeeId || '',
      data.issueDate || '',
      data.returnDate || '',
      data.status || 'Available',
      data.remark || ''
    ]);
    writeAuditLog(userEmail, 'CREATE', 'Keys', newId, null, data, 'เพิ่มกุญแจใหม่');
    return { success: true, message: 'เพิ่มกุญแจสำเร็จ', keyId: newId };
  }
}

/**
 * ============================================================
 * ADMIN USERS & SETTINGS
 * ============================================================
 */
function saveAdminUser(data, userEmail) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('AdminUsers');
  const users = getSheetDataAsObjects('AdminUsers');

  if (data.userId && users.some(u => u.UserID === data.userId)) {
    const existing = users.find(u => u.UserID === data.userId);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const rowIdx = existing._rowIndex;

    const updateMap = {
      EmployeeID: data.employeeId || '',
      Name: data.name,
      Email: data.email,
      Role: data.role || 'Staff',
      Status: data.status || 'Active'
    };

    Object.keys(updateMap).forEach(key => {
      const colIdx = headers.indexOf(key) + 1;
      if (colIdx > 0 && updateMap[key] !== undefined) {
        sheet.getRange(rowIdx, colIdx).setValue(updateMap[key]);
      }
    });

    writeAuditLog(userEmail, 'UPDATE', 'AdminUsers', data.userId, existing, updateMap, 'แก้ไขผู้ดูแลระบบ');
    return { success: true, message: 'อัปเดตผู้ดูแลระบบสำเร็จ' };
  } else {
    // ป้องกันอีเมลซ้ำ
    if (users.some(u => u.Email.toLowerCase() === (data.email || '').toLowerCase())) {
      return { success: false, message: 'อีเมลนี้ถูกใช้งานเป็นผู้ดูแลระบบแล้ว' };
    }

    const newId = data.userId || ('USR' + String(users.length + 1).padStart(3, '0'));
    sheet.appendRow([
      newId,
      data.employeeId || '',
      data.name || '',
      data.email || '',
      data.role || 'Staff',
      data.status || 'Active',
      Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss'),
      userEmail
    ]);

    writeAuditLog(userEmail, 'CREATE', 'AdminUsers', newId, null, data, 'เพิ่มผู้ดูแลระบบ');
    return { success: true, message: 'เพิ่มผู้ดูแลระบบสำเร็จ', userId: newId };
  }
}

function getSettingsData() {
  const settings = getSheetDataAsObjects('Settings');
  const result = {};
  settings.forEach(s => {
    result[s.SettingKey] = s.SettingValue;
  });
  return result;
}

function saveSettings(data, userEmail) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('Settings');
  const settings = getSheetDataAsObjects('Settings');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const keyCol = headers.indexOf('SettingKey') + 1;
  const valCol = headers.indexOf('SettingValue') + 1;

  Object.keys(data).forEach(key => {
    const existing = settings.find(s => s.SettingKey === key);
    if (existing) {
      sheet.getRange(existing._rowIndex, valCol).setValue(data[key]);
    } else {
      sheet.appendRow([key, data[key], '']);
    }
  });

  writeAuditLog(userEmail, 'UPDATE', 'Settings', 'ALL', null, data, 'แก้ไขการตั้งค่าระบบ');
  return { success: true, message: 'บันทึกการตั้งค่าสำเร็จ' };
}