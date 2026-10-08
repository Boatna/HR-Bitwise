/**
 * ระบบบริหารหอพักพนักงาน - Database Setup Script (Simplified & Easy to Understand)
 * รันฟังก์ชัน setupDormitoryDatabase() หนึ่งครั้งเพื่อสร้างฐานข้อมูล Google Sheets
 * ออกแบบให้เข้าใจง่าย ไม่ซับซ้อน:
 * 1. Rooms: ข้อมูลห้องพัก อาคาร ชั้น ความจุ และสถานะ (เฟอร์นิเจอร์มาตรฐานเหมือนกันทุกห้อง)
 * 2. Employees: ข้อมูลพนักงาน รหัส ชื่อ แผนก เบอร์โทร
 * 3. Occupancy: ข้อมูลการเข้าพัก (ใครพักห้องไหน วันที่เข้าพัก/ย้ายออก)
 * 4. Buildings: ข้อมูลอาคารหอพัก
 * 5. Settings: การตั้งค่าระบบ
 */
function setupDormitoryDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const sheetDefs = {
    'Rooms': [
      'RoomID', 'BuildingID', 'Floor', 'RoomNumber', 'RoomType', 'Capacity',
      'Gender', 'MonthlyRate', 'Status', 'Remark', 'CreatedAt', 'UpdatedAt'
    ],
    'Employees': [
      'EmployeeID', 'Prefix', 'FirstName', 'LastName', 'FullName', 'Department',
      'Position', 'Plant', 'Phone', 'Email', 'Status', 'CreatedAt', 'UpdatedAt'
    ],
    'Occupancy': [
      'OccupancyID', 'EmployeeID', 'RoomID', 'BedNumber', 'CheckInDate',
      'ExpectedCheckOutDate', 'ActualCheckOutDate', 'Status', 'Remark', 'CreatedAt', 'UpdatedAt'
    ],
    'Buildings': [
      'BuildingID', 'BuildingCode', 'BuildingName', 'Location', 'NumberOfFloors',
      'Status', 'Remark', 'CreatedAt', 'UpdatedAt'
    ],
    'Settings': [
      'Key', 'Value'
    ]
  };

  // สร้างแผ่นงานหลักที่จำเป็น
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

  // ลบ Sheet1 เริ่มต้นของ Google Sheets ถ้ามี
  const defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) {
    try { ss.deleteSheet(defaultSheet); } catch (e) {}
  }

  // เติมข้อมูลตัวอย่างเริ่มต้น
  seedSampleData_(ss);

  // ปรับความกว้างคอลัมน์อัตโนมัติ
  Object.keys(sheetDefs).forEach(function (name) {
    const sheet = ss.getSheetByName(name);
    try { sheet.autoResizeColumns(1, sheetDefs[name].length); } catch (e) {}
  });

  SpreadsheetApp.getUi().alert(
    'สร้างฐานข้อมูลหอพักพนักงานสำเร็จ!\n\n' +
    'สร้างตารางหลักครบถ้วน (Rooms, Employees, Occupancy, Buildings, Settings)\n' +
    'พร้อมข้อมูลตัวอย่างเริ่มต้นให้ทดสอบใช้งานได้ทันที\n\n' +
    'ขั้นตอนถัดไป: นำโค้ดจาก Code.gs ไปวางใน Apps Script แล้วกด Deploy เป็น Web App'
  );
}

function seedSampleData_(ss) {
  const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
  const today = now.split(' ')[0];

  // 1. Buildings (อาคาร)
  ss.getSheetByName('Buildings').getRange(2, 1, 2, 9).setValues([
    ['BLD-A', 'A', 'หอพักพนักงานชาย (อาคาร A)', 'โซนโรงงาน 1', 2, 'Active', 'หอพักชาย 2 ชั้น', now, now],
    ['BLD-B', 'B', 'หอพักพนักงานหญิง (อาคาร B)', 'โซนโรงงาน 1', 2, 'Active', 'หอพักหญิง 2 ชั้น', now, now]
  ]);

  // 2. Rooms (ห้องพัก - ทุกห้องมีเฟอร์นิเจอร์มาตรฐานเหมือนกันหมด: เตียง, ตู้, โต๊ะ, แอร์)
  ss.getSheetByName('Rooms').getRange(2, 1, 6, 12).setValues([
    ['ROOM-A101', 'BLD-A', '1', 'A-101', 'Double', 2, 'Male', 1500, 'Active', 'เฟอร์นิเจอร์มาตรฐานครบชุด', now, now],
    ['ROOM-A102', 'BLD-A', '1', 'A-102', 'Double', 2, 'Male', 1500, 'Active', 'เฟอร์นิเจอร์มาตรฐานครบชุด', now, now],
    ['ROOM-A201', 'BLD-A', '2', 'A-201', 'Double', 2, 'Male', 1500, 'Active', 'เฟอร์นิเจอร์มาตรฐานครบชุด', now, now],
    ['ROOM-B101', 'BLD-B', '1', 'B-101', 'Double', 2, 'Female', 1500, 'Active', 'เฟอร์นิเจอร์มาตรฐานครบชุด', now, now],
    ['ROOM-B102', 'BLD-B', '1', 'B-102', 'Single', 1, 'Female', 2000, 'Active', 'เฟอร์นิเจอร์มาตรฐานครบชุด', now, now],
    ['ROOM-B201', 'BLD-B', '2', 'B-201', 'Double', 2, 'Female', 1500, 'Active', 'เฟอร์นิเจอร์มาตรฐานครบชุด', now, now]
  ]);

  // 3. Employees (พนักงาน)
  ss.getSheetByName('Employees').getRange(2, 1, 4, 13).setValues([
    ['EMP-0001', 'นาย', 'สมชาย', 'ใจดี', 'นายสมชาย ใจดี', 'Production', 'Operator', 'Plant 1', '081-234-5678', 'somchai@bitwise.co.th', 'Active', now, now],
    ['EMP-0002', 'นาย', 'วิชัย', 'มั่งมี', 'นายวิชัย มั่งมี', 'IT Support', 'Technician', 'Plant 1', '085-555-1234', 'wichai@bitwise.co.th', 'Active', now, now],
    ['EMP-0003', 'นางสาว', 'สมหญิง', 'สายใจ', 'นางสาวสมหญิง สายใจ', 'QC', 'Inspector', 'Plant 1', '089-876-5432', 'somying@bitwise.co.th', 'Active', now, now],
    ['EMP-0004', 'นางสาว', 'อารียา', 'รักสงบ', 'นางสาวอารียา รักสงบ', 'HR', 'Officer', 'Plant 1', '086-111-2233', 'areeya@bitwise.co.th', 'Active', now, now]
  ]);

  // 4. Occupancy (การเข้าพัก - ใครพักห้องไหน เตียงไหน วันที่เข้าพัก)
  ss.getSheetByName('Occupancy').getRange(2, 1, 2, 11).setValues([
    ['OCC-0001', 'EMP-0001', 'ROOM-A101', 1, today, '', '', 'Active', 'เข้าพักตามสัญญา', now, now],
    ['OCC-0002', 'EMP-0003', 'ROOM-B101', 1, today, '', '', 'Active', 'เข้าพักตามสัญญา', now, now]
  ]);

  // 5. Settings (การตั้งค่า)
  ss.getSheetByName('Settings').getRange(2, 1, 5, 2).setValues([
    ['SYSTEM_NAME', 'ระบบบริหารหอพักพนักงาน'],
    ['COMPANY_NAME', 'Bitwise Group'],
    ['STANDARD_FURNITURE', 'เตียงนอน, ที่นอน, ตู้เสื้อผ้า, โต๊ะทำงาน, เก้าอี้, เครื่องปรับอากาศ'],
    ['SYSTEM_EMAIL', 'admin@bitwise.co.th'],
    ['CHECKOUT_REMINDER_DAYS', 7]
  ]);
}
