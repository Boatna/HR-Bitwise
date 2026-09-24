/**
 * ============================================================
 * ระบบบริหารหอพักพนักงาน (Employee Dormitory Management System) v1.0
 * สคริปต์สร้างฐานข้อมูล Google Sheets อัตโนมัติ (18 ตาราง)
 * ============================================================
 * วิธีใช้:
 * 1. เปิด Google Spreadsheet ว่างขึ้นมา 1 ไฟล์
 * 2. ไปที่เมนู ส่วนขยาย (Extensions) > Apps Script
 * 3. วางโค้ดนี้ในไฟล์ setup_sheets.gs
 * 4. เลือกฟังก์ชัน "setupDormitoryDatabase" แล้วกด Run (เรียกใช้)
 * 5. อนุญาตสิทธิ์การเข้าถึง (Authorize permissions)
 * 6. ตารางทั้ง 18 แผ่นงานจะถูกสร้างขึ้นพร้อมจัดรูปแบบและข้อมูลเริ่มต้น
 * ============================================================
 */

function setupDormitoryDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // นิยามโครงสร้างทั้ง 18 Sheets ตาม Master Specification
  const schemas = {
    'Employees': [
      'EmployeeID', 'Prefix', 'FirstName', 'LastName', 'FullName', 'Department',
      'Position', 'Plant', 'Phone', 'Email', 'EmploymentStatus', 'StartDate', 'Remark'
    ],
    'Buildings': [
      'BuildingID', 'BuildingCode', 'BuildingName', 'Location', 'NumberOfFloors',
      'TotalRooms', 'Status', 'Remark'
    ],
    'Floors': [
      'FloorID', 'BuildingID', 'FloorNumber', 'FloorName', 'TotalRooms', 'Status', 'Remark'
    ],
    'Rooms': [
      'RoomID', 'BuildingID', 'FloorID', 'RoomNumber', 'RoomType', 'Capacity',
      'Gender', 'MonthlyRate', 'Status', 'MaintenanceStatus', 'HasAirConditioner', 'HasFurniture', 'Remark'
    ],
    'Beds': [
      'BedID', 'RoomID', 'BedNumber', 'BedType', 'Status', 'Remark'
    ],
    'Occupancy': [
      'OccupancyID', 'EmployeeID', 'RoomID', 'BedID', 'CheckInDate', 'ExpectedCheckOutDate',
      'ActualCheckOutDate', 'OccupancyStatus', 'Reason', 'CreatedAt', 'CreatedBy', 'Remark'
    ],
    'RoomRequests': [
      'RequestID', 'EmployeeID', 'RequestDate', 'PreferredBuilding', 'PreferredRoomType',
      'PreferredGender', 'RequestedCheckInDate', 'RequestedCheckOutDate', 'Reason',
      'RequestStatus', 'ApprovedBy', 'ApprovedDate', 'Remark'
    ],
    'RoomTransfers': [
      'TransferID', 'EmployeeID', 'OldRoomID', 'OldBedID', 'NewRoomID', 'NewBedID',
      'TransferDate', 'Reason', 'ApprovedBy', 'ApprovedDate', 'Remark'
    ],
    'CheckOut': [
      'CheckOutID', 'OccupancyID', 'EmployeeID', 'RoomID', 'BedID', 'CheckOutDate',
      'Reason', 'KeyReturned', 'PropertyReturned', 'RoomCondition', 'DamageAmount', 'ApprovedBy', 'Remark'
    ],
    'Maintenance': [
      'MaintenanceID', 'RoomID', 'StartDate', 'ExpectedEndDate', 'ActualEndDate',
      'Problem', 'Status', 'Technician', 'Cost', 'Remark'
    ],
    'RepairRequests': [
      'RepairID', 'RoomID', 'EmployeeID', 'RequestDate', 'IssueType', 'Description',
      'Priority', 'Status', 'AssignedTo', 'StartDate', 'CompletedDate', 'Cost', 'Remark'
    ],
    'RoomAssets': [
      'AssetID', 'RoomID', 'AssetType', 'AssetName', 'AssetCode', 'Condition',
      'PurchaseDate', 'Status', 'Remark'
    ],
    'Keys': [
      'KeyID', 'RoomID', 'KeyNumber', 'EmployeeID', 'IssueDate', 'ReturnDate', 'Status', 'Remark'
    ],
    'DormCharges': [
      'ChargeID', 'EmployeeID', 'RoomID', 'BillingMonth', 'Rent', 'Water', 'Electricity',
      'OtherCharge', 'Penalty', 'Total', 'PaymentStatus', 'PaymentDate', 'Remark'
    ],
    'AdminUsers': [
      'UserID', 'EmployeeID', 'Name', 'Email', 'Role', 'Status', 'CreatedAt', 'CreatedBy'
    ],
    'Notifications': [
      'NotificationID', 'UserID', 'Type', 'Title', 'Message', 'ReferenceID', 'IsRead', 'CreatedAt', 'ReadAt'
    ],
    'AuditLog': [
      'LogID', 'Timestamp', 'UserEmail', 'Action', 'Module', 'RecordID', 'OldValue', 'NewValue', 'Remark'
    ],
    'Settings': [
      'SettingKey', 'SettingValue', 'Description'
    ]
  };

  // สร้างหรือจัดรูปแบบ Sheet แต่ละแผ่น
  for (const [sheetName, headers] of Object.entries(schemas)) {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    
    // ตั้งค่าหัวตาราง
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setValues([headers]);
    headerRange.setBackground('#1e293b'); // Dark Slate/Navy
    headerRange.setFontColor('#ffffff');
    headerRange.setFontWeight('bold');
    headerRange.setHorizontalAlignment('center');
    headerRange.setVerticalAlignment('middle');
    sheet.setRowHeight(1, 35);
    sheet.setFrozenRows(1);
  }

  // ลบ Sheet1 หรือ แผ่นงาน1 เริ่มต้นถ้ามี
  const defaultSheet = ss.getSheetByName('Sheet1') || ss.getSheetByName('แผ่นงาน1');
  if (defaultSheet && ss.getSheets().length > 1) {
    try {
      ss.deleteSheet(defaultSheet);
    } catch (e) {
      console.log('Cannot delete default sheet: ' + e.message);
    }
  }

  // เติมข้อมูลตั้งต้น (Default Seed Data)
  seedInitialData(ss);

  Logger.log('Setup Dormitory Database Completed Successfully!');
}

function seedInitialData(ss) {
  // 1. Settings
  const settingsSheet = ss.getSheetByName('Settings');
  if (settingsSheet.getLastRow() === 1) {
    const settingsData = [
      ['SYSTEM_NAME', 'ระบบบริหารหอพักพนักงาน (Employee Dormitory)', 'ชื่อระบบ'],
      ['ALLOW_REQUEST', 'TRUE', 'อนุญาตให้พนักงานยื่นคำขอพัก'],
      ['ALLOW_TRANSFER', 'TRUE', 'อนุญาตให้แจ้งขอย้ายห้อง'],
      ['CHECKOUT_REMINDER_DAYS', '7', 'แจ้งเตือนก่อนครบกำหนดเช็คเอาท์ (วัน)'],
      ['SYSTEM_EMAIL', 'admin@company.com', 'อีเมลสำหรับส่งการแจ้งเตือน'],
      ['COMPANY_NAME', 'Bitwise Group', 'ชื่อบริษัท/องค์กร']
    ];
    settingsSheet.getRange(2, 1, settingsData.length, settingsData[0].length).setValues(settingsData);
  }

  // 2. AdminUsers
  const adminSheet = ss.getSheetByName('AdminUsers');
  if (adminSheet.getLastRow() === 1) {
    const adminData = [
      ['USR001', 'EMP001', 'ผู้ดูแลระบบสูงสุด', 'admin@company.com', 'SuperAdmin', 'Active', '2026-01-01 09:00:00', 'SYSTEM'],
      ['USR002', 'EMP002', 'เจ้าหน้าที่ธุรการหอพัก', 'staff@company.com', 'Admin', 'Active', '2026-01-01 09:00:00', 'USR001'],
      ['USR003', 'EMP003', 'พนักงานทั่วไป (Viewer)', 'user@company.com', 'Viewer', 'Active', '2026-01-01 09:00:00', 'USR001']
    ];
    adminSheet.getRange(2, 1, adminData.length, adminData[0].length).setValues(adminData);
  }

  // 3. Buildings
  const buildingsSheet = ss.getSheetByName('Buildings');
  if (buildingsSheet.getLastRow() === 1) {
    const bldData = [
      ['B001', 'A', 'หอพักพนักงานชาย อาคาร A', 'โซนโรงงาน 1', 3, 12, 'Active', 'หอพักชายปรับปรุงใหม่'],
      ['B002', 'B', 'หอพักพนักงานหญิง อาคาร B', 'โซนโรงงาน 1', 2, 8, 'Active', 'หอพักหญิงระบบความปลอดภัยคีย์การ์ด']
    ];
    buildingsSheet.getRange(2, 1, bldData.length, bldData[0].length).setValues(bldData);
  }

  // 4. Floors
  const floorsSheet = ss.getSheetByName('Floors');
  if (floorsSheet.getLastRow() === 1) {
    const flrData = [
      ['F001', 'B001', 1, 'ชั้น 1 อาคาร A', 4, 'Active', ''],
      ['F002', 'B001', 2, 'ชั้น 2 อาคาร A', 4, 'Active', ''],
      ['F003', 'B001', 3, 'ชั้น 3 อาคาร A', 4, 'Active', ''],
      ['F004', 'B002', 1, 'ชั้น 1 อาคาร B', 4, 'Active', ''],
      ['F005', 'B002', 2, 'ชั้น 2 อาคาร B', 4, 'Active', '']
    ];
    floorsSheet.getRange(2, 1, flrData.length, flrData[0].length).setValues(flrData);
  }

  // 5. Rooms
  const roomsSheet = ss.getSheetByName('Rooms');
  if (roomsSheet.getLastRow() === 1) {
    const rmData = [
      // อาคาร A
      ['R001', 'B001', 'F001', 'A-101', 'Double', 2, 'Male', 1500, 'Active', 'Normal', true, true, 'ห้องติดแอร์'],
      ['R002', 'B001', 'F001', 'A-102', 'Double', 2, 'Male', 1500, 'Active', 'Normal', true, true, 'ห้องติดแอร์'],
      ['R003', 'B001', 'F001', 'A-103', 'Double', 2, 'Male', 1500, 'Active', 'Normal', true, true, 'ห้องติดแอร์'],
      ['R004', 'B001', 'F001', 'A-104', 'Double', 2, 'Male', 1500, 'Active', 'In Progress', true, true, 'ปิดซ่อมแอร์รั่ว'],
      ['R005', 'B001', 'F002', 'A-201', 'Double', 2, 'Male', 1500, 'Active', 'Normal', true, true, ''],
      ['R006', 'B001', 'F002', 'A-202', 'Double', 2, 'Male', 1500, 'Active', 'Normal', true, true, ''],
      // อาคาร B
      ['R007', 'B002', 'F004', 'B-101', 'Double', 2, 'Female', 1500, 'Active', 'Normal', true, true, ''],
      ['R008', 'B002', 'F004', 'B-102', 'Double', 2, 'Female', 1500, 'Active', 'Normal', true, true, '']
    ];
    roomsSheet.getRange(2, 1, rmData.length, rmData[0].length).setValues(rmData);
  }

  // 6. Beds
  const bedsSheet = ss.getSheetByName('Beds');
  if (bedsSheet.getLastRow() === 1) {
    const bedData = [
      ['BED001', 'R001', '01', 'Single', 'Active', 'เตียงล่าง'],
      ['BED002', 'R001', '02', 'Single', 'Active', 'เตียงบน'],
      ['BED003', 'R002', '01', 'Single', 'Active', 'เตียงล่าง'],
      ['BED004', 'R002', '02', 'Single', 'Active', 'เตียงบน'],
      ['BED005', 'R003', '01', 'Single', 'Active', 'เตียงล่าง'],
      ['BED006', 'R003', '02', 'Single', 'Active', 'เตียงบน'],
      ['BED007', 'R004', '01', 'Single', 'Active', 'เตียงล่าง'],
      ['BED008', 'R004', '02', 'Single', 'Active', 'เตียงบน'],
      ['BED009', 'R005', '01', 'Single', 'Active', 'เตียงล่าง'],
      ['BED010', 'R005', '02', 'Single', 'Active', 'เตียงบน'],
      ['BED011', 'R006', '01', 'Single', 'Active', 'เตียงล่าง'],
      ['BED012', 'R006', '02', 'Single', 'Active', 'เตียงบน'],
      ['BED013', 'R007', '01', 'Single', 'Active', 'เตียงล่าง'],
      ['BED014', 'R007', '02', 'Single', 'Active', 'เตียงบน'],
      ['BED015', 'R008', '01', 'Single', 'Active', 'เตียงล่าง'],
      ['BED016', 'R008', '02', 'Single', 'Active', 'เตียงบน']
    ];
    bedsSheet.getRange(2, 1, bedData.length, bedData[0].length).setValues(bedData);
  }

  // 7. Employees
  const empSheet = ss.getSheetByName('Employees');
  if (empSheet.getLastRow() === 1) {
    const empData = [
      ['EMP001', 'นาย', 'สมชาย', 'ใจดี', 'สมชาย ใจดี', 'IT', 'Software Engineer', 'Plant 1', '081-111-2233', 'somchai@company.com', 'Active', '2025-01-15', ''],
      ['EMP002', 'นาย', 'วิชัย', 'มั่นคง', 'วิชัย มั่นคง', 'Production', 'Technician', 'Plant 1', '082-222-3344', 'wichai@company.com', 'Active', '2025-02-01', ''],
      ['EMP003', 'นาย', 'อนุชา', 'รักสงบ', 'อนุชา รักสงบ', 'QC', 'Inspector', 'Plant 1', '083-333-4455', 'anucha@company.com', 'Active', '2025-03-10', ''],
      ['EMP004', 'นางสาว', 'พิมพา', 'สุขเกษม', 'พิมพา สุขเกษม', 'HR', 'HR Officer', 'Plant 1', '084-444-5566', 'pimpa@company.com', 'Active', '2025-04-01', ''],
      ['EMP005', 'นางสาว', 'สุนิสา', 'วรวงศ์', 'สุนิสา วรวงศ์', 'Accounting', 'Accountant', 'Plant 1', '085-555-6677', 'sunisa@company.com', 'Active', '2025-05-15', ''],
      ['EMP006', 'นาย', 'ธนากร', 'เจริญผล', 'ธนากร เจริญผล', 'Warehouse', 'Supervisor', 'Plant 2', '086-666-7788', 'thanakorn@company.com', 'Active', '2025-06-01', '']
    ];
    empSheet.getRange(2, 1, empData.length, empData[0].length).setValues(empData);
  }

  // 8. Occupancy (ตาม Business Rule ข้อ 27: R001 = Full 2/2, R002 = Partially Occupied 1/2, R003 = Available 0/2, R004 = Maintenance, R007 = Partially Occupied 1/2)
  const occSheet = ss.getSheetByName('Occupancy');
  if (occSheet.getLastRow() === 1) {
    const occData = [
      ['OCC001', 'EMP001', 'R001', 'BED001', '2026-01-01', '2026-12-31', '', 'Active', 'ย้ายเข้าตามสัญญา', '2026-01-01 10:00:00', 'admin@company.com', ''],
      ['OCC002', 'EMP002', 'R001', 'BED002', '2026-01-05', '2026-12-31', '', 'Active', 'ย้ายเข้าตามสัญญา', '2026-01-05 11:00:00', 'admin@company.com', ''],
      ['OCC003', 'EMP003', 'R002', 'BED003', '2026-02-01', '2026-10-31', '', 'Active', 'ย้ายเข้าตามสัญญา', '2026-02-01 09:30:00', 'admin@company.com', ''],
      ['OCC004', 'EMP004', 'R007', 'BED013', '2026-03-01', '2026-12-31', '', 'Active', 'ย้ายเข้าตามสัญญา', '2026-03-01 14:00:00', 'admin@company.com', '']
    ];
    occSheet.getRange(2, 1, occData.length, occData[0].length).setValues(occData);
  }

  // 9. Maintenance (R004 ซ่อมอยู่)
  const maintSheet = ss.getSheetByName('Maintenance');
  if (maintSheet.getLastRow() === 1) {
    const mData = [
      ['MNT001', 'R004', '2026-09-20', '2026-09-30', '', 'คอมเพรสเซอร์แอร์ไม่ทำงาน มีน้ำรั่วซึม', 'In Progress', 'ช่างสมศักดิ์', 2500, 'รออะไหล่']
    ];
    maintSheet.getRange(2, 1, mData.length, mData[0].length).setValues(mData);
  }

  // 10. RoomRequests
  const reqSheet = ss.getSheetByName('RoomRequests');
  if (reqSheet.getLastRow() === 1) {
    const reqData = [
      ['REQ001', 'EMP006', '2026-09-22', 'B001', 'Double', 'Male', '2026-10-01', '2027-03-31', 'บ้านอยู่ต่างจังหวัด เดินทางไกล', 'Pending', '', '', '']
    ];
    reqSheet.getRange(2, 1, reqData.length, reqData[0].length).setValues(reqData);
  }

  // 11. Keys
  const keysSheet = ss.getSheetByName('Keys');
  if (keysSheet.getLastRow() === 1) {
    const keyData = [
      ['KEY001', 'R001', 'KEY-A101-1', 'EMP001', '2026-01-01', '', 'Issued', 'มอบให้พนักงานตอนเช็คอิน'],
      ['KEY002', 'R001', 'KEY-A101-2', 'EMP002', '2026-01-05', '', 'Issued', 'มอบให้พนักงานตอนเช็คอิน'],
      ['KEY003', 'R002', 'KEY-A102-1', 'EMP003', '2026-02-01', '', 'Issued', 'มอบให้พนักงานตอนเช็คอิน'],
      ['KEY004', 'R002', 'KEY-A102-2', '', '', '', 'Available', 'กุญแจสำรองอยู่ในตู้เซฟธุรการ']
    ];
    keysSheet.getRange(2, 1, keyData.length, keyData[0].length).setValues(keyData);
  }

  // 12. RoomAssets
  const assetSheet = ss.getSheetByName('RoomAssets');
  if (assetSheet.getLastRow() === 1) {
    const assetData = [
      ['AST001', 'R001', 'Air Conditioner', 'เครื่องปรับอากาศ Daikin 12000 BTU', 'AC-A101', 'Good', '2024-01-10', 'Active', ''],
      ['AST002', 'R001', 'Wardrobe', 'ตู้เสื้อผ้าไม้ 2 บาน', 'WDR-A101-1', 'Good', '2024-01-10', 'Active', ''],
      ['AST003', 'R001', 'Table', 'โต๊ะเขียนหนังสือ', 'TBL-A101-1', 'Good', '2024-01-10', 'Active', '']
    ];
    assetSheet.getRange(2, 1, assetData.length, assetData[0].length).setValues(assetData);
  }

  // 13. AuditLog
  const auditSheet = ss.getSheetByName('AuditLog');
  if (auditSheet.getLastRow() === 1) {
    const auditData = [
      ['LOG001', '2026-01-01 09:00:00', 'SYSTEM', 'CREATE', 'System', 'SYSTEM', '', 'System Initialized', 'สร้างฐานข้อมูลเริ่มต้น']
    ];
    auditSheet.getRange(2, 1, auditData.length, auditData[0].length).setValues(auditData);
  }
}
