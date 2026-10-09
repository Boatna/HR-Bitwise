// ตั้งเป็น true เฉพาะเมื่อต้องการ "ลบข้อมูลเดิมทั้งหมด" และ getUi() ใช้ไม่ได้ในบริบทที่รันอยู่
const FORCE_RESET = false;

function getUiSafe_() {
  try { return SpreadsheetApp.getUi(); } catch (e) { return null; }
}

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
      'OccupancyID', 'EmployeeID', 'RoomID', 'BedID', 'BedNumber', 'CheckInDate',
      'ExpectedCheckOutDate', 'ActualCheckOutDate', 'Status', 'Remark', 'CreatedAt', 'UpdatedAt'
    ],
    'Buildings': [
      'BuildingID', 'BuildingCode', 'BuildingName', 'Location', 'NumberOfFloors',
      'Status', 'Remark', 'CreatedAt', 'UpdatedAt'
    ],
    'Parking': [
      'SlotID', 'SlotNumber', 'Zone', 'VehicleType', 'Status', 'EmployeeID',
      'RoomID', 'LicensePlate', 'VehicleModel', 'AssignedDate', 'Remark', 'CreatedAt', 'UpdatedAt'
    ],
    'Settings': [
      'Key', 'Value'
    ],
    'AuditLog': [
      'LogID', 'Timestamp', 'UserEmail', 'Action', 'Module', 'RecordID', 'Remark'
    ]
  };

  // ป้องกันการรันซ้ำแล้วข้อมูลจริงหายโดยไม่รู้ตัว
  const hasData = Object.keys(sheetDefs).some(function (n) {
    const sh = ss.getSheetByName(n);
    return sh && sh.getLastRow() > 1;
  });
  if (hasData) {
    // getUi() ใช้ไม่ได้ในบางบริบท (เช่น สคริปต์ไม่ได้ผูกกับ Spreadsheet หรือรันจากตัวทริกเกอร์)
    // กรณีนั้นจะไม่ลบข้อมูลเด็ดขาด เว้นแต่ตั้ง FORCE_RESET = true ด้วยตัวเอง
    const ui = getUiSafe_();
    if (ui) {
      const answer = ui.alert(
        '⚠️ พบข้อมูลเดิมในฐานข้อมูล',
        'การรันสคริปต์นี้จะ "ลบข้อมูลทั้งหมด" ในทุกตาราง แล้วสร้างข้อมูลตัวอย่างใหม่\n\n' +
        'หากต้องการเพียงเพิ่มตารางที่ขาด (เช่น Parking) โดยไม่ลบข้อมูล ให้รันฟังก์ชัน ensureAllSheets ใน Code.gs แทน\n\nต้องการลบและสร้างใหม่ทั้งหมดใช่หรือไม่?',
        ui.ButtonSet.YES_NO
      );
      if (answer !== ui.Button.YES) return;
    } else if (!FORCE_RESET) {
      Logger.log('พบข้อมูลเดิมและไม่สามารถแสดงหน้าต่างยืนยันได้ จึงยกเลิกเพื่อป้องกันข้อมูลหาย (หากต้องการลบจริง ให้ตั้ง FORCE_RESET = true ที่ด้านบนไฟล์)');
      return;
    }
  }

  try { ss.setSpreadsheetTimeZone('Asia/Bangkok'); } catch (e) {}

  // คอลัมน์ที่ต้องเก็บเป็นข้อความ (กันเลข 0 นำหน้าของเบอร์โทร/รหัสหาย)
  const textColumns = ['EmployeeID', 'Phone', 'LicensePlate', 'RoomNumber', 'SlotNumber', 'BuildingCode'];

  const tabColors = {
    'Rooms': '#2563eb',
    'Employees': '#0891b2',
    'Occupancy': '#16a34a',
    'Buildings': '#4f46e5',
    'Parking': '#d97706',
    'Settings': '#475569',
    'AuditLog': '#64748b'
  };

  Object.keys(sheetDefs).forEach(function (name) {
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
    }
    sheet.clear();

    const headers = sheetDefs[name];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    headers.forEach(function (h, i) {
      if (textColumns.indexOf(h) !== -1) {
        sheet.getRange(2, i + 1, Math.max(sheet.getMaxRows() - 1, 1), 1).setNumberFormat('@');
      }
    });
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#1e3a8a')
      .setFontColor('#ffffff')
      .setHorizontalAlignment('center');

    if (tabColors[name]) {
      try { sheet.setTabColor(tabColors[name]); } catch (e) {}
    }
  });

  const defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) {
    try { ss.deleteSheet(defaultSheet); } catch (e) {}
  }

  seedSampleData_(ss);

  Object.keys(sheetDefs).forEach(function (name) {
    const sheet = ss.getSheetByName(name);
    try { sheet.autoResizeColumns(1, sheetDefs[name].length); } catch (e) {}
  });

  const doneMsg = 'สร้างฐานข้อมูลหอพักพนักงานสำเร็จ 100%!\n\n' +
    'สร้างแผ่นงานครบทั้ง 7 ตาราง (ตั้งเขตเวลา Asia/Bangkok ให้แล้ว):\n' +
    '• Rooms (8 ห้อง ตัวอย่างครบ 4 สถานะ: ว่าง / ว่างบางส่วน / เต็ม / ปิดซ่อม)\n' +
    '• Employees (8 คน ทั้งที่มีห้องและยังไม่มีห้องพัก)\n' +
    '• Occupancy (รายการเข้าพักจริง เชื่อมต่อห้องและเตียง)\n' +
    '• Parking (9 ช่องจอด ทั้งรถยนต์และมอเตอร์ไซค์ พร้อมผู้จอง/ทะเบียน/ห้องพัก)\n' +
    '• Buildings (อาคารหอพัก)\n' +
    '• Settings (การตั้งค่าระบบ)\n' +
    '• AuditLog (บันทึกประวัติการทำงาน)\n\n' +
    'ขั้นตอนถัดไป: นำโค้ดจาก Code.gs ไปวางใน Apps Script แล้วกด Deploy เป็น Web App';
  const doneUi = getUiSafe_();
  if (doneUi) doneUi.alert(doneMsg); else Logger.log(doneMsg);
}

function seedSampleData_(ss) {
  const tz = 'Asia/Bangkok';
  const now = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm:ss');
  const today = now.split(' ')[0];
  const lastMonth = Utilities.formatDate(new Date(Date.now() - 30 * 86400000), tz, 'yyyy-MM-dd');

  ss.getSheetByName('Buildings').getRange(2, 1, 2, 9).setValues([
    ['BLD-A', 'A', 'หอพักพนักงานชาย (อาคาร A)', 'โซนโรงงาน 1', 2, 'Active', 'หอพักชาย 2 ชั้น', now, now],
    ['BLD-B', 'B', 'หอพักพนักงานหญิง (อาคาร B)', 'โซนโรงงาน 1', 2, 'Active', 'หอพักหญิง 2 ชั้น', now, now]
  ]);

  ss.getSheetByName('Rooms').getRange(2, 1, 8, 12).setValues([
    ['ROOM-A101', 'BLD-A', '1', 'A-101', 'Double', 2, 'Male', 1500, 'Active', 'เฟอร์นิเจอร์มาตรฐานครบชุด', now, now],
    ['ROOM-A102', 'BLD-A', '1', 'A-102', 'Double', 2, 'Male', 1500, 'Active', 'เฟอร์นิเจอร์มาตรฐานครบชุด', now, now],
    ['ROOM-A201', 'BLD-A', '2', 'A-201', 'Double', 2, 'Male', 1500, 'Active', 'เฟอร์นิเจอร์มาตรฐานครบชุด', now, now],
    ['ROOM-A202', 'BLD-A', '2', 'A-202', 'Double', 2, 'Male', 1500, 'Maintenance', 'ห้องอยู่ระหว่างทาสีและปรับปรุงแอร์', now, now],
    // อาคาร B (หญิง)
    ['ROOM-B101', 'BLD-B', '1', 'B-101', 'Double', 2, 'Female', 1500, 'Active', 'เฟอร์นิเจอร์มาตรฐานครบชุด', now, now],
    ['ROOM-B102', 'BLD-B', '1', 'B-102', 'Single', 1, 'Female', 2000, 'Active', 'เฟอร์นิเจอร์มาตรฐานครบชุด', now, now],
    ['ROOM-B201', 'BLD-B', '2', 'B-201', 'Double', 2, 'Female', 1500, 'Active', 'เฟอร์นิเจอร์มาตรฐานครบชุด', now, now],
    ['ROOM-B202', 'BLD-B', '2', 'B-202', 'Double', 2, 'Female', 1500, 'Active', 'เฟอร์นิเจอร์มาตรฐานครบชุด', now, now]
  ]);

  ss.getSheetByName('Employees').getRange(2, 1, 8, 13).setValues([
    ['EMP-0001', 'นาย', 'สมชาย', 'ใจดี', 'นายสมชาย ใจดี', 'Production', 'Operator', 'Plant 1', '081-234-5678', 'somchai@bitwise.co.th', 'Active', now, now],
    ['EMP-0002', 'นาย', 'วิชัย', 'มั่งมี', 'นายวิชัย มั่งมี', 'IT Support', 'Technician', 'Plant 1', '085-555-1234', 'wichai@bitwise.co.th', 'Active', now, now],
    ['EMP-0003', 'นางสาว', 'สมหญิง', 'สายใจ', 'นางสาวสมหญิง สายใจ', 'QC', 'Inspector', 'Plant 1', '089-876-5432', 'somying@bitwise.co.th', 'Active', now, now],
    ['EMP-0004', 'นางสาว', 'อารียา', 'รักสงบ', 'นางสาวอารียา รักสงบ', 'HR', 'Officer', 'Plant 1', '086-111-2233', 'areeya@bitwise.co.th', 'Active', now, now],
    ['EMP-0005', 'นาย', 'ธนากร', 'สุขเกษม', 'นายธนากร สุขเกษม', 'Engineering', 'Engineer', 'Plant 1', '082-333-4455', 'thanakorn@bitwise.co.th', 'Active', now, now],
    ['EMP-0006', 'นางสาว', 'กานดา', 'เด่นดวง', 'นางสาวกานดา เด่นดวง', 'Accounting', 'Senior Officer', 'Plant 1', '087-666-7788', 'kanda@bitwise.co.th', 'Active', now, now],
    ['EMP-0007', 'นาย', 'ณัฐพล', 'บุญชู', 'นายณัฐพล บุญชู', 'Logistics', 'Driver', 'Plant 1', '083-777-8899', 'nattapol@bitwise.co.th', 'Active', now, now],
    ['EMP-0008', 'นางสาว', 'ปิยะดา', 'สดใส', 'นางสาวปิยะดา สดใส', 'Marketing', 'Executive', 'Plant 1', '084-999-0011', 'piyada@bitwise.co.th', 'Active', now, now]
  ]);

  ss.getSheetByName('Occupancy').getRange(2, 1, 7, 12).setValues([
    ['OCC-0001', 'EMP-0001', 'ROOM-A101', 'BED-ROOM-A101-1', 1, today, '', '', 'Active', 'เข้าพักตามสัญญา', now, now],

    ['OCC-0002', 'EMP-0002', 'ROOM-A201', 'BED-ROOM-A201-1', 1, today, '', '', 'Active', 'เข้าพักตามสัญญา', now, now],

    ['OCC-0003', 'EMP-0005', 'ROOM-A201', 'BED-ROOM-A201-2', 2, today, '', '', 'Active', 'เข้าพักตามสัญญา', now, now],

    ['OCC-0004', 'EMP-0003', 'ROOM-B101', 'BED-ROOM-B101-1', 1, today, '', '', 'Active', 'เข้าพักตามสัญญา', now, now],

    ['OCC-0005', 'EMP-0004', 'ROOM-B201', 'BED-ROOM-B201-1', 1, today, '', '', 'Active', 'เข้าพักตามสัญญา', now, now],
    ['OCC-0006', 'EMP-0006', 'ROOM-B201', 'BED-ROOM-B201-2', 2, today, '', '', 'Active', 'เข้าพักตามสัญญา', now, now],

    ['OCC-0007', 'EMP-0007', 'ROOM-A101', 'BED-ROOM-A101-2', 2, lastMonth, '', today, 'CheckedOut', 'ย้ายออก / หมดสัญญา', now, now]
  ]);

  ss.getSheetByName('Parking').getRange(2, 1, 9, 13).setValues([
    ['PARK-001', 'P-01', 'โซนอาคาร A', 'Car', 'Occupied', 'EMP-0001', 'ROOM-A101', '1กข-5678 กทม.', 'Toyota Yaris (สีขาว)', today, 'จองพร้อมเข้าพัก', now, now],
    ['PARK-002', 'P-02', 'โซนอาคาร B', 'Car', 'Occupied', 'EMP-0004', 'ROOM-B201', '2ขค-9988 กทม.', 'Honda City (สีดำ)', today, 'จองพร้อมเข้าพัก', now, now],
    ['PARK-003', 'P-03', 'โซนอาคาร A', 'Car', 'Available', '', '', '', '', '', 'ช่องจอดรถยนต์ว่าง', now, now],
    ['PARK-004', 'P-04', 'โซนอาคาร A', 'Car', 'Available', '', '', '', '', '', 'ช่องจอดรถยนต์ว่าง', now, now],
    ['PARK-005', 'P-05', 'โซนลานจอดกลาง', 'Car', 'Maintenance', '', '', '', '', '', 'ปิดปรับปรุงตีเส้นช่องจอด', now, now],
    ['PARK-006', 'M-01', 'โซนอาคาร A', 'Motorcycle', 'Occupied', 'EMP-0002', 'ROOM-A201', '3กง-4455 นนทบุรี', 'Yamaha Grand Filano (สีฟ้า)', today, 'จองพร้อมเข้าพัก', now, now],
    ['PARK-007', 'M-02', 'โซนอาคาร B', 'Motorcycle', 'Occupied', 'EMP-0003', 'ROOM-B101', '9กง-1234 กทม.', 'Honda Wave 110i (สีแดง)', today, 'จองพร้อมเข้าพัก', now, now],
    ['PARK-008', 'M-03', 'โซนอาคาร B', 'Motorcycle', 'Available', '', '', '', '', '', 'ช่องจอดมอเตอร์ไซค์ว่าง', now, now],
    ['PARK-009', 'M-04', 'โซนอาคาร B', 'Motorcycle', 'Available', '', '', '', '', '', 'ช่องจอดมอเตอร์ไซค์ว่าง', now, now]
  ]);

  ss.getSheetByName('Settings').getRange(2, 1, 5, 2).setValues([
    ['SYSTEM_NAME', 'ระบบบริหารหอพักพนักงาน'],
    ['COMPANY_NAME', 'Bitwise Group'],
    ['STANDARD_FURNITURE', 'เตียงนอน, ที่นอน, ตู้เสื้อผ้า, โต๊ะทำงาน, เก้าอี้, เครื่องปรับอากาศ'],
    ['SYSTEM_EMAIL', 'admin@bitwise.co.th'],
    ['CHECKOUT_REMINDER_DAYS', 7]
  ]);

  ss.getSheetByName('AuditLog').getRange(2, 1, 1, 7).setValues([
    ['LOG-0001', now, 'admin@bitwise.co.th', 'SETUP', 'Database', 'SYSTEM', 'สร้างฐานข้อมูลและเติมข้อมูลตัวอย่างเริ่มต้นสำเร็จ']
  ]);
}