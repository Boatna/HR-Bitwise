/**
 * ระบบบริหารหอพักพนักงาน - Database Setup Script
 * รันฟังก์ชัน setupDormitoryDatabase() หนึ่งครั้งเพื่อสร้างฐานข้อมูลทั้ง 18 ตาราง
 * พร้อมข้อมูลตัวอย่างเริ่มต้น (สามารถรันซ้ำได้ - จะล้างและสร้างใหม่ทุกครั้ง)
 */
function setupDormitoryDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const sheetDefs = {
    'Employees': ['EmployeeID','Prefix','FirstName','LastName','FullName','Department','Position','Plant','Phone','Email','Status','CreatedAt','UpdatedAt'],
    'Buildings': ['BuildingID','BuildingCode','BuildingName','Location','NumberOfFloors','Status','Remark','CreatedAt','UpdatedAt'],
    'Floors': ['FloorID','BuildingID','FloorNumber','FloorName','Status'],
    'Rooms': ['RoomID','BuildingID','RoomNumber','FloorID','RoomType','Capacity','Gender','MonthlyRate','HasAirConditioner','HasFurniture','Remark','Status','CreatedAt','UpdatedAt'],
    'Beds': ['BedID','RoomID','BedNumber','BedType','Status','CreatedAt'],
    'Occupancy': ['OccupancyID','EmployeeID','RoomID','BedID','CheckInDate','ExpectedCheckOutDate','ActualCheckOutDate','Status','Reason','Remark','CreatedAt','UpdatedAt'],
    'RoomRequests': ['RequestID','EmployeeID','RequestDate','PreferredBuilding','PreferredRoomType','Reason','RequestStatus','ApprovedBy','ApprovedDate'],
    'RoomTransfers': ['TransferID','OccupancyIDOld','OccupancyIDNew','EmployeeID','FromRoomID','FromBedID','ToRoomID','ToBedID','TransferDate','Reason','Remark','CreatedAt'],
    'CheckOut': ['CheckOutID','OccupancyID','EmployeeID','RoomID','BedID','CheckOutDate','Reason','KeyReturned','PropertyReturned','RoomCondition','DamageAmount','Remark','CreatedAt'],
    'Maintenance': ['MaintenanceID','RoomID','StartDate','ExpectedEndDate','ActualEndDate','Problem','Status','Technician','CreatedAt'],
    'RepairRequests': ['RepairID','RoomID','IssueType','Description','Priority','AssignedTo','Status','RequestDate','CompletedDate'],
    'RoomAssets': ['AssetID','AssetCode','RoomID','AssetType','AssetName','Condition','Status'],
    'Keys': ['KeyID','KeyNumber','RoomID','EmployeeID','IssueDate','ReturnDate','Status','Remark'],
    'DormCharges': ['ChargeID','EmployeeID','RoomID','ChargeType','Amount','ChargeMonth','Status','CreatedAt'],
    'AdminUsers': ['AdminID','Email','Name','Role','Status','CreatedAt'],
    'Notifications': ['NotificationID','Type','Message','RelatedID','IsRead','CreatedAt'],
    'AuditLog': ['LogID','Timestamp','UserEmail','Action','Module','RecordID','Remark'],
    'Settings': ['Key','Value']
  };

  Object.keys(sheetDefs).forEach(function (name) {
    let sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    sheet.clear();
    const headers = sheetDefs[name];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#1e3a8a')
      .setFontColor('#ffffff');
  });

  // ลบ Sheet1 เริ่มต้นของ Google Sheets ถ้ายังไม่ได้ใช้งาน
  const defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) {
    ss.deleteSheet(defaultSheet);
  }

  seedSampleData_(ss);

  Object.keys(sheetDefs).forEach(function (name) {
    const sheet = ss.getSheetByName(name);
    try { sheet.autoResizeColumns(1, sheetDefs[name].length); } catch (e) {}
  });

  SpreadsheetApp.getUi().alert(
    'สร้างฐานข้อมูลหอพักพนักงานสำเร็จ!\n\n' +
    'สร้างครบทั้ง 18 ตาราง พร้อมข้อมูลตัวอย่างเริ่มต้น (2 อาคาร, 4 ห้อง, 3 พนักงาน, 1 รายการเข้าพัก)\n\n' +
    'ขั้นตอนถัดไป: วางโค้ดจากไฟล์ Code.gs ทับในไฟล์นี้ แล้วทำการ Deploy เป็น Web App'
  );
}

function seedSampleData_(ss) {
  const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
  const today = now.split(' ')[0];

  ss.getSheetByName('Buildings').getRange(2, 1, 2, 9).setValues([
    ['BLD-A', 'A', 'หอพักพนักงานชาย อาคาร A', 'โซนโรงงาน 1', 2, 'Active', '', now, now],
    ['BLD-B', 'B', 'หอพักพนักงานหญิง อาคาร B', 'โซนโรงงาน 1', 2, 'Active', '', now, now]
  ]);

  ss.getSheetByName('Floors').getRange(2, 1, 4, 5).setValues([
    ['FLR-A1', 'BLD-A', 1, 'ชั้น 1', 'Active'],
    ['FLR-A2', 'BLD-A', 2, 'ชั้น 2', 'Active'],
    ['FLR-B1', 'BLD-B', 1, 'ชั้น 1', 'Active'],
    ['FLR-B2', 'BLD-B', 2, 'ชั้น 2', 'Active']
  ]);

  ss.getSheetByName('Rooms').getRange(2, 1, 4, 14).setValues([
    ['ROOM-A101', 'BLD-A', 'A-101', 'FLR-A1', 'Double', 2, 'Male', 1500, true, true, '', 'Active', now, now],
    ['ROOM-A102', 'BLD-A', 'A-102', 'FLR-A1', 'Triple', 3, 'Male', 1200, true, true, '', 'Active', now, now],
    ['ROOM-B101', 'BLD-B', 'B-101', 'FLR-B1', 'Double', 2, 'Female', 1500, true, true, '', 'Active', now, now],
    ['ROOM-B102', 'BLD-B', 'B-102', 'FLR-B1', 'Single', 1, 'Female', 2000, true, true, '', 'Active', now, now]
  ]);

  ss.getSheetByName('Beds').getRange(2, 1, 8, 6).setValues([
    ['BED-A101-1', 'ROOM-A101', 1, 'Standard', 'Active', now],
    ['BED-A101-2', 'ROOM-A101', 2, 'Standard', 'Active', now],
    ['BED-A102-1', 'ROOM-A102', 1, 'Standard', 'Active', now],
    ['BED-A102-2', 'ROOM-A102', 2, 'Standard', 'Active', now],
    ['BED-A102-3', 'ROOM-A102', 3, 'Standard', 'Active', now],
    ['BED-B101-1', 'ROOM-B101', 1, 'Standard', 'Active', now],
    ['BED-B101-2', 'ROOM-B101', 2, 'Standard', 'Active', now],
    ['BED-B102-1', 'ROOM-B102', 1, 'Standard', 'Active', now]
  ]);

  ss.getSheetByName('Employees').getRange(2, 1, 3, 13).setValues([
    ['EMP-0001', 'นาย', 'สมชาย', 'ใจดี', 'นายสมชาย ใจดี', 'Production', 'Operator', 'Plant 1', '0812345678', 'somchai@company.com', 'Active', now, now],
    ['EMP-0002', 'นางสาว', 'สมหญิง', 'สายใจ', 'นางสาวสมหญิง สายใจ', 'QC', 'Inspector', 'Plant 1', '0898765432', 'somying@company.com', 'Active', now, now],
    ['EMP-0003', 'นาย', 'วิชัย', 'มั่งมี', 'นายวิชัย มั่งมี', 'IT', 'Support', 'Plant 1', '0855551234', 'wichai@company.com', 'Active', now, now]
  ]);

  ss.getSheetByName('Occupancy').getRange(2, 1, 1, 12).setValues([
    ['OCC-0001', 'EMP-0001', 'ROOM-A101', 'BED-A101-1', today, '', '', 'Active', 'ย้ายเข้าตามสัญญา', '', now, now]
  ]);

  ss.getSheetByName('AdminUsers').getRange(2, 1, 1, 5).setValues([
    ['ADM-0001', 'admin@company.com', 'ผู้ดูแลระบบ', 'SuperAdmin', 'Active']
  ]);

  ss.getSheetByName('Settings').getRange(2, 1, 4, 2).setValues([
    ['SYSTEM_NAME', 'ระบบบริหารหอพักพนักงาน'],
    ['COMPANY_NAME', 'Bitwise Group'],
    ['SYSTEM_EMAIL', 'admin@company.com'],
    ['CHECKOUT_REMINDER_DAYS', 7]
  ]);
}
