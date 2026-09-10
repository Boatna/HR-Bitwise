const HEADERS_APPLICANTS = [
  'วันที่สมัคร (Timestamp)',
  'รหัสผู้สมัคร (Applicant ID)',
  'สถานะการเข้าเรียน (Attendance)',
  'คำนำหน้า',
  'ชื่อ',
  'นามสกุล',
  'เพศ',
  'ชื่อ-สกุล ภาษาอังกฤษ',
  'เลขประจำตัวประชาชน',
  'สัญชาติ',
  'วัน/เดือน/ปีเกิด',
  'เบอร์โทรศัพท์',
  'อีเมล',
  'ที่อยู่ เลขที่',
  'หมู่',
  'ถนน',
  'ซอย',
  'แขวง/ตำบล',
  'เขต/อำเภอ',
  'จังหวัด',
  'รหัสไปรษณีย์',
  'วุฒิการศึกษาสูงสุด',
  'สาขาที่เรียน',
  'สภาพร่างกาย',
  'ประเภทความพิการ',
  'หน่วยงานที่รับสมัคร',
  'วัตถุประสงค์',
  'การทดสอบ',
  'หลักสูตร',
  'จำนวนชั่วโมงฝึก',
  'สาขา',
  'ระดับ',
  'ประเภทผู้สมัคร',
  'วันที่เริ่มการฝึกอบรม',
  'สถานภาพแรงงาน',
  'สังกัดการทำงาน',
  'ประเภทย่อยภาครัฐ',
  'ประเภทย่อยธุรกิจส่วนตัว',
  'รายได้เฉลี่ยต่อเดือน',
  'อาชีพ',
  'ตำแหน่ง',
  'อายุงาน (ปี)',
  'ชื่อสถานที่ทำงาน',
  'จังหวัดที่ทำงาน',
  'โทรศัพท์ที่ทำงาน',
  'กลุ่มอุตสาหกรรม',
  'เหตุผลผู้ไม่มีงานทำ',
  'แหล่งที่ทราบการฝึก',
  'ความยินยอม PDPA',
  'ความประสงค์จัดหางาน',
  'ข้อมูลดิบ JSON (Raw Data)'
];

const HEADERS_CALENDAR = [
  'รหัสกิจกรรม (Event ID)',
  'วันที่ (YYYY-MM-DD)',
  'การดำเนินงาน / กิจกรรม / หลักสูตร',
  'ผู้รับผิดชอบ',
  'สถานที่จัดกิจกรรม',
  'รายละเอียดเพิ่มเติม'
];

function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. ชีต Applicants (ผู้สมัคร)
  let sheetApp = ss.getSheetByName('Applicants');
  if (!sheetApp) {
    sheetApp = ss.insertSheet('Applicants');
  }
  sheetApp.getRange(1, 1, 1, HEADERS_APPLICANTS.length).setValues([HEADERS_APPLICANTS]);
  sheetApp.getRange(1, 1, 1, HEADERS_APPLICANTS.length)
    .setFontWeight('bold')
    .setBackground('#0284c7')
    .setFontColor('#ffffff');
  sheetApp.setFrozenRows(1);

  // 2. ชีต CalendarEvents (ปฏิทินการสอน)
  let sheetCal = ss.getSheetByName('CalendarEvents');
  if (!sheetCal) {
    sheetCal = ss.insertSheet('CalendarEvents');
  }
  sheetCal.getRange(1, 1, 1, HEADERS_CALENDAR.length).setValues([HEADERS_CALENDAR]);
  sheetCal.getRange(1, 1, 1, HEADERS_CALENDAR.length)
    .setFontWeight('bold')
    .setBackground('#0f172a')
    .setFontColor('#ffffff');
  sheetCal.setFrozenRows(1);

  // ข้อมูลตัวอย่างปฏิทิน
  if (sheetCal.getLastRow() <= 1) {
    sheetCal.appendRow(['evt-1', '2026-09-12', 'เปิดรับสมัครฝึกอบรม ช่างเครื่องปรับอากาศในบ้าน ระดับ 1', 'ฝ่ายฝึกอบรม HR Bitwise Group', 'ศูนย์ฝึกอบรม Bitwise Academy', 'รับสมัคร 25 คน']);
    sheetCal.appendRow(['evt-2', '2026-09-15', 'ปฐมนิเทศและทดสอบความรู้พื้นฐานผู้สมัคร', 'อ.สมเกียรติ / ทีมวิทยากร กพร.', 'ห้องอบรมสัมมนา 1', 'ตรวจเช็คเอกสารตัวจริง']);
    sheetCal.appendRow(['evt-3', '2026-09-20', 'เริ่มการฝึกอบรมภาคทฤษฎีและปฏิบัติ (ช่างแอร์บ้าน)', 'ทีมเทคนิคและวิศวกร Bitwise', 'โรงฝึกงานอาคาร 2', 'เรียนรู้วงจรน้ำยาและระบบไฟฟ้า']);
    sheetCal.appendRow(['evt-4', '2026-09-28', 'ทดสอบมาตรฐานฝีมือแรงงานแห่งชาติ สาขาช่างเครื่องปรับอากาศ', 'คณะกรรมการผู้ทดสอบมาตรฐาน กพร.', 'ศูนย์ทดสอบ Bitwise', 'ทดสอบภาคทฤษฎีและปฏิบัติ']);
    sheetCal.appendRow(['evt-5', '2026-10-05', 'พิธีมอบวุฒิบัตรและสัมภาษณ์บรรจุงาน', 'ฝ่ายบุคคล (HR Bitwise Group)', 'ห้องประชุมใหญ่ Bitwise', 'มอบวุฒิบัตรและรับเข้าทำงาน']);
  }
}

function doGet(e) {
  const action = e && e.parameter && e.parameter.action ? e.parameter.action : 'ping';
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (action === 'ping') {
    return createJsonResponse({ status: 'success', message: 'HR Bitwise Google Sheet API พร้อมใช้งาน', timestamp: new Date().toISOString() });
  }

  if (action === 'getApplicants') {
    setupSheets();
    const sheet = ss.getSheetByName('Applicants');
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return createJsonResponse({ status: 'success', data: [] });
    }
    const rows = data.slice(1);
    const applicants = rows.map(r => {
      let rawObj = {};
      try {
        const jsonStr = r[HEADERS_APPLICANTS.length - 1];
        if (jsonStr) rawObj = JSON.parse(jsonStr);
      } catch (err) {}
      return {
        id: r[1],
        submittedAt: r[0],
        attended: r[2] === 'ได้เข้ามาเรียนแล้ว' || r[2] === true,
        title: r[3],
        firstName: r[4],
        lastName: r[5],
        gender: r[6],
        fullNameEn: r[7],
        idCard: r[8],
        phone: r[11],
        course: r[28],
        ...rawObj
      };
    });
    return createJsonResponse({ status: 'success', data: applicants });
  }

  if (action === 'getCalendarEvents') {
    setupSheets();
    const sheet = ss.getSheetByName('CalendarEvents');
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return createJsonResponse({ status: 'success', data: [] });
    }
    const rows = data.slice(1);
    const events = rows.map(r => ({
      id: r[0],
      date: r[1],
      title: r[2],
      responsible: r[3],
      location: r[4],
      details: r[5]
    }));
    return createJsonResponse({ status: 'success', data: events });
  }

  return createJsonResponse({ status: 'unknown_action' });
}

function doPost(e) {
  setupSheets();
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  try {
    const postData = JSON.parse(e.postData.contents);
    const action = postData.action;

    // 1. เพิ่มผู้สมัครใหม่
    if (action === 'addApplicant') {
      const d = postData.data || {};
      const sheet = ss.getSheetByName('Applicants');
      
      const row = [
        d.submittedAt || new Date().toISOString(),
        d.id || '',
        d.attended ? 'ได้เข้ามาเรียนแล้ว' : 'ยังไม่มา',
        d.title || '',
        d.firstName || '',
        d.lastName || '',
        d.gender || '',
        d.fullNameEn || '',
        d.idCard || '',
        d.nationality || 'ไทย',
        d.birthDate || '',
        d.phone || '',
        d.email || '',
        d.addressNo || '',
        d.moo || '',
        d.street || '',
        d.soi || '',
        d.subdistrict || '',
        d.district || '',
        d.province || '',
        d.zipcode || '',
        d.education || '',
        d.educationMajor || '',
        d.bodyCondition || 'ปกติ',
        Array.isArray(d.disabilities) ? d.disabilities.join(', ') : '',
        d.agency || '',
        Array.isArray(d.objectives) ? d.objectives.join(', ') : '',
        Array.isArray(d.tests) ? d.tests.join(', ') : '',
        d.course || '',
        d.trainingHours || '',
        d.branch || '',
        d.level || '',
        Array.isArray(d.applicantTypes) ? d.applicantTypes.join(', ') : '',
        d.startDate || '',
        d.employmentStatus === 'employed' ? 'ทำงาน' : 'ไม่ทำงาน/ว่างงาน',
        d.workSector || '',
        d.govtType || '',
        d.freelanceType || '',
        d.monthlyIncome || '',
        d.occupation || '',
        d.position || '',
        d.workExperienceYears || '',
        d.workplaceName || '',
        d.workplaceProvince || '',
        d.workplacePhone || '',
        d.industryGroup || '',
        d.unemployedReason || '',
        d.infoSource || '',
        d.pdpaConsent ? 'ยินยอม' : 'ไม่ยินยอม',
        d.jobAssist || '',
        JSON.stringify(d)
      ];

      sheet.appendRow(row);
      return createJsonResponse({ status: 'success', message: 'บันทึกผู้สมัครสำเร็จ' });
    }

    // 2. อัปเดตสถานะการเข้าเรียน
    if (action === 'updateAttendance') {
      const applicantId = postData.applicantId;
      const attended = postData.attended;
      const sheet = ss.getSheetByName('Applicants');
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][1] === applicantId) {
          sheet.getRange(i + 1, 3).setValue(attended ? 'ได้เข้ามาเรียนแล้ว' : 'ยังไม่มา');
          return createJsonResponse({ status: 'success', message: 'อัปเดตสถานะสำเร็จ' });
        }
      }
      return createJsonResponse({ status: 'not_found' });
    }

    // 3. เพิ่มกิจกรรมปฏิทิน
    if (action === 'addEvent') {
      const evt = postData.event || {};
      const sheet = ss.getSheetByName('CalendarEvents');
      sheet.appendRow([
        evt.id || 'evt-' + Date.now(),
        evt.date || '',
        evt.title || '',
        evt.responsible || '',
        evt.location || '',
        evt.details || ''
      ]);
      return createJsonResponse({ status: 'success', message: 'บันทึกกิจกรรมสำเร็จ' });
    }

    return createJsonResponse({ status: 'invalid_action' });
  } catch (error) {
    return createJsonResponse({ status: 'error', message: error.toString() });
  }
}

function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}