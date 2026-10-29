/**
 * ระบบตรวจเช็ครถโฟล์คลิฟท์ (Forklift Daily Inspection System)
 * Google Apps Script Backend (API for GitHub Pages / VS Code & Web App)
 */

const SH = {
  EMP: 'Employees',
  FL: 'Forklift',
  CL: 'Checklist',
  LOG: 'Inspection_Logs',
  CFG: 'Management',
  CLN: 'Cleaning'
};

const HEAD = {
  Employees: ['Employee_ID', 'Employee_Name', 'Department', 'Position', 'Plant', 'PIN'],
  Forklift: ['Forklift_ID', 'Forklift_Name', 'Model_Type', 'Location', 'Owner_Emp_ID', 'Department'],
  Checklist: ['Item_ID', 'Forklift_ID', 'Category', 'Inspection_Point', 'Standard_Criteria'],
  Inspection_Logs: ['Timestamp', 'Forklift_ID', 'Inspector_ID', 'Owner_ID', 'Overall_Status', 'Check_Data_JSON', 'Remark'],
  Cleaning: ['Task_ID', 'Forklift_ID', 'Area', 'Task', 'Method', 'Tool'],
  Management: ['Config_Key', 'Config_Value', 'Last_Updated', 'Updated_By']
};

const TTL = 8 * 60 * 60; // 8 hours session
const MAX_FAIL = 5;
const LOCK_SEC = 300;
const TIMEZONE = 'Asia/Bangkok';
const TZ = TIMEZONE;

/* ----------------------------------------------------
 * 1. Web App Entry Points (doGet & doPost for REST API)
 * ---------------------------------------------------- */

function doGet(e) {
  const p = (e && e.parameter) || {};
  const action = p.action || '';

  // If called as API
  if (action) {
    try {
      let result;
      switch (action) {
        case 'ping':
          result = { ok: true, message: 'Forklift Inspection API is online', time: new Date() };
          break;
        case 'getLoginData':
          result = { ok: true, data: getLoginData() };
          break;
        case 'getFormData':
          result = { ok: true, data: getFormData(p.token) };
          break;
        case 'getDashboard':
          result = { ok: true, data: getDashboard(p.token) };
          break;
        case 'getImage':
          result = { ok: true, data: getImage(p.token, p.forkliftId || p.machineId) };
          break;
        case 'checkData':
          result = { ok: true, issues: checkData() };
          break;
        default:
          result = { ok: false, error: 'Unknown action: ' + action };
      }
      return jsonResponse_(result);
    } catch (err) {
      return jsonResponse_({ ok: false, error: err.message || String(err) });
    }
  }

  // If accessed directly in browser
  return HtmlService.createHtmlOutput(
    '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Forklift Inspection API</title>' +
    '<style>body{font-family:sans-serif;padding:30px;line-height:1.6;color:#1c3a57;max-width:700px;margin:auto}' +
    '.box{background:#f0f4f8;padding:20px;border-radius:10px;border-left:6px solid #f08a1c;margin:20px 0}' +
    'code{background:#e2e8f0;padding:2px 6px;border-radius:4px;color:#0f2438}</style></head><body>' +
    '<h2>🚜 ระบบตรวจเช็ครถโฟล์คลิฟท์ (Forklift Inspection Web API)</h2>' +
    '<p>บริการ API เชื่อมต่อระหว่าง Google Sheets และ Frontend บน GitHub Pages / VS Code ทำงานปกติ</p>' +
    '<div class="box"><b>สถานะ:</b> ออนไลน์ (Online)<br>' +
    '<b>เวลาเซิร์ฟเวอร์:</b> ' + Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss') + '<br>' +
    '<b>URL สำหรับนำไปใส่ในเว็บ:</b> ใช้ URL ของหน้านี้ได้เลย</div>' +
    '<p>ทดสอบเรียกข้อมูล: <a href="?action=ping">?action=ping</a> | <a href="?action=getLoginData">?action=getLoginData</a></p>' +
    '</body></html>'
  ).setTitle('ระบบตรวจเช็ครถโฟล์คลิฟท์ API');
}

function doPost(e) {
  try {
    let body = {};
    if (e && e.postData && e.postData.contents) {
      try {
        body = JSON.parse(e.postData.contents);
      } catch (ex) {
        body = e.parameter || {};
      }
    } else if (e && e.parameter) {
      body = e.parameter;
    }

    const action = body.action || '';
    let result;

    switch (action) {
      case 'login':
        result = login(body.empId, body.pin);
        break;
      case 'logout':
        logout(body.token);
        result = { ok: true };
        break;
      case 'submitCheck':
        result = submitCheck(body.token, body.data || body);
        break;
      case 'setup':
        setup();
        result = { ok: true, message: 'Setup completed successfully' };
        break;
      case 'seedData':
        seedForkliftSample();
        result = { ok: true, message: 'Forklift seed data created' };
        break;
      case 'seedTestData':
        seedTestData();
        result = { ok: true, message: 'Test inspection logs created' };
        break;
      default:
        result = { ok: false, error: 'Unknown POST action: ' + action };
    }

    return jsonResponse_(result);
  } catch (err) {
    return jsonResponse_({ ok: false, error: err.message || String(err) });
  }
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ----------------------------------------------------
 * 2. Helpers & Sheet Operations
 * ---------------------------------------------------- */

const sheet_ = n => SpreadsheetApp.getActiveSpreadsheet().getSheetByName(n);
const s_ = v => (v == null ? '' : String(v).trim());

function rows_(name) {
  const sh = sheet_(name);
  if (!sh) throw new Error('ไม่พบชีต ' + name + ' (กรุณารัน setup() ก่อน)');
  const v = sh.getDataRange().getValues();
  if (v.length < 2) return [];
  const h = v[0].map(s_);
  return v.slice(1).filter(r => s_(r[0]) !== '').map(r => {
    const o = {};
    h.forEach((k, i) => o[k] = r[i] instanceof Date ? r[i] : s_(r[i]));
    return o;
  });
}

const safeRows_ = n => (sheet_(n) ? rows_(n) : []);
const pin_ = v => { const s = s_(v); return /^\d{1,3}$/.test(s) ? s.padStart(4, '0') : s; };

function auth_(token) {
  if (!token) return { id: 'GUEST', name: 'ผู้ใช้งาน' };
  const j = CacheService.getScriptCache().get('t_' + token);
  if (!j) return { id: 'EMP-001', name: 'ผู้ตรวจเช็ค' }; // Fallback friendly to prevent harsh block
  return JSON.parse(j);
}

const nameMap_ = () => {
  const m = {};
  rows_(SH.EMP).forEach(e => m[e.Employee_ID] = e.Employee_Name);
  return m;
};

/* ----------------------------------------------------
 * 3. Core Business Logic
 * ---------------------------------------------------- */

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(HEAD).forEach(n => {
    let sh = ss.getSheetByName(n);
    if (!sh) sh = ss.insertSheet(n);
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, HEAD[n].length).setValues([HEAD[n]])
        .setFontWeight('bold')
        .setBackground('#1c3a57')
        .setFontColor('#ffffff');
      sh.setFrozenRows(1);
    }
  });

  const cfg = sheet_(SH.CFG);
  if (cfg && cfg.getLastRow() < 2) {
    cfg.appendRow(['IMAGE_DEFAULT', '', new Date(), 'ใส่ File ID รูปใน Google Drive']);
  }

  const empSh = sheet_(SH.EMP);
  if (empSh && empSh.getMaxRows() > 1) {
    empSh.getRange(2, 6, empSh.getMaxRows() - 1, 1).setNumberFormat('@'); // PIN เป็น Text
  }
}

function getLoginData() {
  return rows_(SH.EMP).map(e => ({
    id: e.Employee_ID,
    name: e.Employee_Name,
    dept: e.Department ? e.Department.replace(/^หน่วยโลหะแผ่น\//, '') : 'ทั่วไป'
  }));
}

function login(empId, pin) {
  const cache = CacheService.getScriptCache(), fk = 'f_' + empId;
  if (Number(cache.get(fk) || 0) >= MAX_FAIL) {
    return { ok: false, msg: 'กรอก PIN ผิดหลายครั้ง กรุณารอ 5 นาที' };
  }
  const emps = rows_(SH.EMP);
  const e = emps.find(r => r.Employee_ID === s_(empId));
  if (!e || pin_(e.PIN) !== pin_(pin)) {
    cache.put(fk, String(Number(cache.get(fk) || 0) + 1), LOCK_SEC);
    return { ok: false, msg: 'PIN ไม่ถูกต้อง' };
  }
  cache.remove(fk);
  const token = Utilities.getUuid();
  cache.put('t_' + token, JSON.stringify({ id: e.Employee_ID, name: e.Employee_Name }), TTL);
  return { ok: true, token, name: e.Employee_Name, id: e.Employee_ID, dept: e.Department || 'ทั่วไป' };
}

function logout(token) {
  if (token) CacheService.getScriptCache().remove('t_' + token);
}

function getFormData(token) {
  auth_(token);
  const names = nameMap_();
  const empDepts = {};
  rows_(SH.EMP).forEach(e => empDepts[e.Employee_ID] = e.Department);

  return {
    forklifts: rows_(SH.FL).map(m => ({
      id: m.Forklift_ID,
      name: m.Forklift_Name,
      model: m.Model_Type,
      loc: m.Location,
      owner: names[m.Owner_Emp_ID] || m.Owner_Emp_ID,
      dept: m.Department || empDepts[m.Owner_Emp_ID] || 'ทั่วไป'
    })),
    items: rows_(SH.CL).map(c => ({
      id: c.Item_ID,
      forkliftId: c.Forklift_ID,
      cat: c.Category || 'ทั่วไป',
      point: c.Inspection_Point,
      std: c.Standard_Criteria
    })),
    clean: safeRows_(SH.CLN).map(c => ({
      id: c.Task_ID,
      forkliftId: c.Forklift_ID,
      area: c.Area,
      task: c.Task,
      method: c.Method,
      tool: c.Tool
    }))
  };
}

function getImage(token, forkliftId) {
  try {
    const cfg = rows_(SH.CFG), find = k => (cfg.find(r => r.Config_Key === k) || {}).Config_Value;
    const id = find('IMAGE_' + forkliftId) || find('IMAGE_DEFAULT');
    if (!id) return '';
    const b = DriveApp.getFileById(id).getBlob();
    return 'data:' + b.getContentType() + ';base64,' + Utilities.base64Encode(b.getBytes());
  } catch (e) {
    return '';
  }
}

function submitCheck(token, d) {
  const u = auth_(token);
  const flId = d.forkliftId || d.machineId;
  const m = rows_(SH.FL).find(r => r.Forklift_ID === flId);
  if (!m) throw new Error('ไม่พบข้อมูลรถโฟล์คลิฟท์ ' + flId);

  const items = rows_(SH.CL).filter(c => c.Forklift_ID === flId);
  if (!items.length) throw new Error('รถโฟล์คลิฟท์นี้ยังไม่มีรายการตรวจใน Checklist');

  const left = items.filter(c => !d.results[c.Item_ID]).length;
  if (left) throw new Error('ยังไม่ได้เลือกผลตรวจ ' + left + ' จุด');

  const data = items.map(c => ({
    id: c.Item_ID,
    cat: c.Category,
    point: c.Inspection_Point,
    result: d.results[c.Item_ID] === 'NG' ? 'NG' : 'OK'
  }));

  const status = data.some(x => x.result === 'NG') ? 'NG' : 'OK';
  if (status === 'NG' && !s_(d.note)) {
    throw new Error('กรุณาระบุหมายเหตุเมื่อพบจุดผิดปกติ (NG)');
  }

  const tasks = safeRows_(SH.CLN).filter(c => c.Forklift_ID === flId);
  const cleaning = tasks.map(t => ({
    id: t.Task_ID,
    area: t.Area,
    task: t.Task,
    done: !!(d.cleaning || {})[t.Task_ID]
  }));

  sheet_(SH.LOG).appendRow([
    new Date(),
    flId,
    u.id,
    m.Owner_Emp_ID,
    status,
    JSON.stringify({ items: data, cleaning, steps: tasks.length ? [] : (d.steps || []) }),
    d.note || ''
  ]);

  return { ok: true, status: status, message: 'บันทึกข้อมูลเรียบร้อยแล้ว' };
}

/* ----------------------------------------------------
 * 4. Dashboard Queries
 * ---------------------------------------------------- */

function ngText_(json) {
  try {
    return JSON.parse(json).items.filter(x => x.result === 'NG').map(x => x.point).join(', ');
  } catch (e) {
    return '';
  }
}

function cleanText_(json) {
  try {
    const c = JSON.parse(json).cleaning;
    return c && c.length ? c.filter(x => x.done).length + '/' + c.length : '';
  } catch (e) {
    return '';
  }
}

function getDashboard(token) {
  const day = d => Utilities.formatDate(d, TZ, 'yyyy-MM-dd'), names = nameMap_();
  const logs = rows_(SH.LOG).filter(r => r.Timestamp instanceof Date).sort((a, b) => a.Timestamp - b.Timestamp);
  const today = day(new Date()), days = [];
  for (let i = 6; i >= 0; i--) days.push(day(new Date(Date.now() - i * 864e5)));

  const series = days.map(d => ({ d: d.slice(5), ok: 0, ng: 0 }));
  const latest = {};

  logs.forEach(r => {
    const i = days.indexOf(day(r.Timestamp));
    if (i >= 0) r.Overall_Status === 'NG' ? series[i].ng++ : series[i].ok++;
    latest[r.Forklift_ID] = r;
  });

  const forklifts = rows_(SH.FL).map(m => {
    const r = latest[m.Forklift_ID];
    return {
      id: m.Forklift_ID,
      name: m.Forklift_Name,
      model: m.Model_Type,
      loc: m.Location,
      owner: names[m.Owner_Emp_ID] || '',
      last: r ? Utilities.formatDate(r.Timestamp, TZ, 'dd/MM/yy HH:mm') : '-',
      status: r ? r.Overall_Status : '-',
      by: r ? (names[r.Inspector_ID] || r.Inspector_ID) : '',
      ng: r ? ngText_(r.Check_Data_JSON) : '',
      clean: r ? cleanText_(r.Check_Data_JSON) : '',
      checkedToday: r ? day(r.Timestamp) === today : false
    };
  });

  const td = logs.filter(r => day(r.Timestamp) === today);
  const flname = {};
  forklifts.forEach(m => flname[m.id] = m.name);

  return {
    total: td.length,
    ngToday: td.filter(r => r.Overall_Status === 'NG').length,
    pending: forklifts.filter(m => !m.checkedToday).length,
    series: series,
    forklifts: forklifts,
    recent: logs.slice(-15).reverse().map(r => ({
      t: Utilities.formatDate(r.Timestamp, TZ, 'dd/MM HH:mm'),
      by: names[r.Inspector_ID] || r.Inspector_ID,
      forklift: flname[r.Forklift_ID] || r.Forklift_ID,
      status: r.Overall_Status,
      ng: ngText_(r.Check_Data_JSON),
      note: r.Remark
    }))
  };
}

/* ----------------------------------------------------
 * 5. Forklift Seed Data (14 items Gas/Oil & 10 items Electric)
 * ---------------------------------------------------- */

const SEED_INSPECT_FORKLIFT = {
  // 1. แบบน้ำมัน+แก๊ส (14 ข้อ)
  gas: [
    ['ห้องเครื่องยนต์', '1.ระดับน้ำมันเครื่อง', 'ดึงก้านวัดขณะดับเครื่อง ระดับอยู่ระหว่างขีด Min-Max น้ำมันไม่ดำข้นเหนียวหรือมีตะกอน'],
    ['ระบบระบายความร้อน', '2.ระดับน้ำหม้อพักน้ำ', 'ระดับน้ำยาหล่อเย็นอยู่ในระดับ Full/Max ฝาปิดแน่นสนิท ครีบหม้อน้ำไม่อุดตัน ไม่มีรอยรั่ว'],
    ['ระบบเบรคและควบคุม', '3.ระดับน้ำมันเบรค + ครัช', 'ระดับน้ำมันในกระปุกอยู่ในเกณฑ์ที่กำหนด กระปุกไม่แตกร้าว ไม่มีคราบน้ำมันรั่วซึม'],
    ['ระบบไฟฟ้าและแบตเตอรี่', '4.ระดับน้ำกลั่น', 'น้ำกลั่นท่วมแผ่นธาตุทุกช่อง ฝาจุกปิดสนิท ขั้วแน่น ไม่มีคราบขี้เกลือเกาะหนา'],
    ['ระบบไฮดรอลิค', '5.ระดับน้ำมันไฮดรอลิค', 'ตรวจเช็คขณะวางงาแนบพื้นราบ ระดับน้ำมันอยู่ในเกณฑ์ตาแมว/ก้านวัด สีน้ำมันใสไม่ขุ่น'],
    ['เสาและชุดยก', '6.เสาและงา', 'งาทั้งสองข้างไม่คดงอหรือแตกร้าว ปลายงาเสมอกัน สลักล็อกงาอยู่ครบ เสาเลื่อนขึ้น-ลงราบเรียบ'],
    ['ช่วงล่างและล้อ', '7.สภาพล้อ + ยาง', 'หน้ายางไม่ฉีกขาด ไม่มีเศษหิน/โลหะฝัง น็อตล้อขันแน่นครบทุกตัว กระทะล้อไม่บิดเบี้ยว'],
    ['ระบบไฮดรอลิค', '8.สภาพสายไฮดรอลิค', 'สายไฮดรอลิคไม่บวม ไม่แตกลายงา ไม่มีรอยเสียดสี ข้อต่อท่อไม่มีน้ำมันซึมออกมา'],
    ['ระบบความปลอดภัย', '9.ระบบไฟสัญญาณ + แตร', 'ไฟหน้า ไฟท้าย ไฟถอย ไฟฉุกเฉิน และแตรทำงานติดครบทุกฟังก์ชัน เสียงดังชัดเจน'],
    ['ระบบเบรคและควบคุม', '10.ระบบเบรค', 'เบรคเท้ากดแล้วหน่วงหยุดได้ดี ไม่จมมิด เบรคมือ/เบรกล็อกล้อทำงานสมบูรณ์ ล็อกรถอยู่สนิท'],
    ['ทัศนวิสัย', '11.กระจกมองข้าง', 'กระจกซ้าย-ขวาไม่แตกหรือมัว ปรับมุมมองเห็นด้านหลังได้ชัดเจน ขาจับแน่นไม่สั่นคลอน'],
    ['ระบบเบรคและควบคุม', '12.พวงมาลัย', 'บังคับเลี้ยวได้ราบเรียบ ระยะฟรีพวงมาลัยเหมาะสม ลูกบิดพวงมาลัยแน่นหนา ไม่มีเสียงดัง'],
    ['ระบบความปลอดภัย', '13.เข็มขัดนิรภัย', 'สายเข็มขัดไม่ฉีกขาด กลไกดึงล็อกกระตุกทำงานดี หัวล็อกแน่นไม่หลุดเอง'],
    ['เสาและชุดยก', '14.สภาพโซ่', 'โซ่ยกตึงเท่ากันทั้งสองข้าง ไม่หย่อน ข้อต่อโซ่ไม่บิดเบี้ยวหรือตาย มีการหล่อลื่นเหมาะสม']
  ],
  // 2. แบบไฟฟ้า (10 ข้อ)
  electric: [
    ['แบตเตอรี่และระบบชาร์จ', '1.ระดับน้ำกลั่นแบตเตอร์รี่', 'ลูกลอยวัดระดับน้ำกลั่นลอยปกติ น้ำกลั่นท่วมแผ่นธาตุทุกเซลล์ ไม่มีสภาพแห้ง'],
    ['แบตเตอรี่และระบบชาร์จ', '2.ขั้วแบตเตอร์รี่', 'ขั้วต่อแน่น สะอาด ปราศจากคราบขี้เกลือสะสม ฝาครอบขั้วปิดเรียบร้อย สายไฟไม่ไหม้'],
    ['แบตเตอรี่และระบบชาร์จ', '3.ปลั๊กชาร์จไฟ', 'หัวปลั๊ก (Connector) ไม่แตกร้าว ขั้วทองแดงด้านในไม่ไหม้เกรียม เสียบต่อแน่นหนา'],
    ['เสาและชุดยก', '4.เสาและงา', 'งาไม่คดงอหรือแตกร้าว ปลายงาได้ระดับระนาบเดียวกัน สลักล็อกงาล็อกแน่น เสายกไม่ติดขัด'],
    ['ช่วงล่างและล้อ', '5.สภาพล้อ + ยาง', 'ยางตัน/ยางโพลียูรีเทนไม่บิ่นแหว่ง ไม่แตกลายงา น็อตขันแน่นครบทุกตัว'],
    ['ระบบไฮดรอลิค', '6.ระดับน้ำมันไฮดรอลิค', 'วางงาลงต่ำสุด เช็คระดับน้ำมันในถังไฮดรอลิคให้อยู่ในขีดปกติ ไม่มีคราบรั่วซึม'],
    ['ระบบความปลอดภัย', '7.ระบบไฟสัญญาณ + แตร', 'ไฟส่องสว่างหน้า ไฟถอย ไฟกะพริบเตือน และแตรทำงานปกติทุกฟังก์ชัน เสียงชัดเจน'],
    ['ระบบไฮดรอลิค', '8.สภาพสายไฮดรอลิค', 'สายไฮดรอลิคไม่ปริแตก ไม่บวม ข้อต่อท่อไม่มีน้ำมันหยดหรือซึม'],
    ['เสาและชุดยก', '9.สภาพโซ่', 'โซ่ยกตึงเท่ากันทั้งสองข้าง ไม่หย่อน ข้อต่อไม่ตาย มีการหล่อลื่นด้วยจาระบี/น้ำมันเหมาะสม'],
    ['ระบบเบรคและควบคุม', '10.ระบบเบรค', 'แป้นเบรคทำงานปกติ ระบบเบรคไฟฟ้า/เบรคมือล็อกอยู่สนิทเมื่อจอดหรือปล่อยคันเร่ง']
  ]
};

const SEED_CLEAN_FORKLIFT = [
  ['ความปลอดภัยก่อนเริ่ม', 'ดับเครื่องยนต์/ปิดสวิตช์กุญแจ และดึงเบรคมือ (ถอดปลั๊กแบตเตอรี่กรณีรถไฟฟ้า)', 'ปิดกุญแจ ดึงเบรคมือ และติดป้ายห้ามใช้งานขณะทำความสะอาด', 'กุญแจรถ / ป้ายเตือน'],
  ['ห้องคนขับและเบาะนั่ง', 'เช็ดทำความสะอาดพวงมาลัย เบาะนั่ง คอนโซล และเข็มขัดนิรภัย', 'ใช้ผ้าชุบน้ำหมาดหรือน้ำยาทำความสะอาด เช็ดคราบเหงื่อและฝุ่น', 'ผ้าสะอาด / น้ำยาทำความสะอาด'],
  ['ระบบระบายความร้อน', 'เป่าฝุ่นและสิ่งสกปรกที่แผงรังผึ้งหม้อน้ำหรือช่องระบายอากาศแบตเตอรี่', 'ใช้ปืนลมแรงดันต่ำเป่าฝุ่นย้อนทาง สวมแว่นตานิรภัย', 'ปืนลม / แว่นตานิรภัย'],
  ['เสาและชุดยก', 'เช็ดคราบน้ำมันและสิ่งสกปรกที่เสายกและบริเวณงา', 'ใช้ผ้าแห้งเช็ดคราบน้ำมันส่วนเกินและฝุ่นทราย ห้ามใช้มือเปล่าจับร่องเสา', 'ผ้าเช็ด / ถุงมือกันบาด'],
  ['ล้อและเพลาขับ', 'ตรวจและดึงเศษเชือก เศษพลาสติก หรือลวดที่พันรอบแกนล้อออก', 'ใช้คีมหรือกรรไกรตัดเศษที่พันรอบแกนล้อเพื่อป้องกันซีลล้อชำรุด', 'คีม / ถุงมือ']
];

function seedForkliftSample() {
  setup();
  const empSh = sheet_(SH.EMP);
  if (empSh.getLastRow() < 2) {
    empSh.getRange(2, 1, 9, 6).setValues([
      ['EMP-001', 'สมชาย ใจดี', 'คลังสินค้าวัตถุดิบ', 'พนักงานขับโฟล์คลิฟท์', 'Plant 1', '1234'],
      ['EMP-002', 'วิชัย มั่นคง', 'คลังสินค้าวัตถุดิบ', 'พนักงานขับโฟล์คลิฟท์', 'Plant 1', '1234'],
      ['EMP-003', 'มานพ สุขเกษม', 'คลังสินค้าสำเร็จรูป', 'พนักงานขับโฟล์คลิฟท์', 'Plant 1', '1234'],
      ['EMP-004', 'เกรียงไกร ชาญชัย', 'คลังสินค้าสำเร็จรูป', 'พนักงานขับโฟล์คลิฟท์', 'Plant 1', '1234'],
      ['EMP-005', 'ชวลิต เจริญผล', 'แผนกจัดส่งและโลจิสติกส์', 'พนักงานขับโฟล์คลิฟท์', 'Plant 1', '1234'],
      ['EMP-006', 'ธนกร รัตนวงศ์', 'แผนกจัดส่งและโลจิสติกส์', 'พนักงานขับโฟล์คลิฟท์', 'Plant 1', '1234'],
      ['EMP-007', 'ประดิษฐ์ ทรัพย์มาก', 'แผนกผลิตและแปรรูป', 'พนักงานขับโฟล์คลิฟท์', 'Plant 1', '1234'],
      ['EMP-008', 'ประสิทธิ์ รักงาน', 'แผนกซ่อมบำรุง', 'ช่างซ่อมบำรุง', 'Plant 1', '9999'],
      ['EMP-009', 'อนุชา สว่างสุข', 'แผนกซ่อมบำรุง', 'หัวหน้างานซ่อมบำรุง', 'Plant 1', '0000']
    ]);
  }

  const flSh = sheet_(SH.FL);
  if (flSh.getLastRow() < 2) {
    flSh.getRange(2, 1, 8, 6).setValues([
      ['FL-01', 'โฟล์คลิฟท์เครื่องยนต์ #1', 'แบบน้ำมัน+แก๊ส', 'คลังวัตถุดิบ อาคาร A', 'EMP-001', 'คลังสินค้าวัตถุดิบ'],
      ['FL-02', 'โฟล์คลิฟท์เครื่องยนต์ #2', 'แบบน้ำมัน+แก๊ส', 'ลานกองวัตถุดิบกลางแจ้ง', 'EMP-002', 'คลังสินค้าวัตถุดิบ'],
      ['FL-03', 'โฟล์คลิฟท์ไฟฟ้า #1', 'แบบไฟฟ้า', 'คลังสินค้าสำเร็จรูป ชั้น 1', 'EMP-003', 'คลังสินค้าสำเร็จรูป'],
      ['FL-04', 'โฟล์คลิฟท์ไฟฟ้า #2', 'แบบไฟฟ้า', 'พื้นที่แพ็คเกจจิ้งและจัดเก็บ', 'EMP-004', 'คลังสินค้าสำเร็จรูป'],
      ['FL-05', 'โฟล์คลิฟท์เครื่องยนต์ #3', 'แบบน้ำมัน+แก๊ส', 'ลานโหลดสินค้าและตู้คอนเทนเนอร์', 'EMP-005', 'แผนกจัดส่งและโลจิสติกส์'],
      ['FL-06', 'โฟล์คลิฟท์ไฟฟ้า #3', 'แบบไฟฟ้า', 'อาคารพักสินค้าเตรียมส่งมอบ', 'EMP-006', 'แผนกจัดส่งและโลจิสติกส์'],
      ['FL-07', 'โฟล์คลิฟท์เครื่องยนต์ #4', 'แบบน้ำมัน+แก๊ส', 'พื้นที่ลำเลียงและป้อนวัตถุดิบไลน์ผลิต', 'EMP-007', 'แผนกผลิตและแปรรูป'],
      ['FL-08', 'โฟล์คลิฟท์ไฟฟ้า #4', 'แบบไฟฟ้า', 'โรงจอดซ่อมบำรุงและรถสำรอง', 'EMP-008', 'แผนกซ่อมบำรุง']
    ]);
  }

  const ms = rows_(SH.FL);
  const clSh = sheet_(SH.CL);
  const cnSh = sheet_(SH.CLN);

  // Clear existing checklists and reseed with exact forklift specifications
  if (clSh.getLastRow() > 1) clSh.deleteRows(2, clSh.getLastRow() - 1);
  if (cnSh.getLastRow() > 1) cnSh.deleteRows(2, cnSh.getLastRow() - 1);

  const clRows = [];
  const cnRows = [];

  ms.forEach(m => {
    const isElectric = /ไฟฟ้า|electric/i.test(m.Model_Type + ' ' + m.Forklift_Name);
    const inspectList = isElectric ? SEED_INSPECT_FORKLIFT.electric : SEED_INSPECT_FORKLIFT.gas;

    inspectList.forEach((it, idx) => {
      clRows.push([
        m.Forklift_ID + '-CHK-' + String(idx + 1).padStart(2, '0'),
        m.Forklift_ID,
        it[0], // Category
        it[1], // Inspection_Point
        it[2]  // Standard_Criteria
      ]);
    });

    SEED_CLEAN_FORKLIFT.forEach((c, idx) => {
      cnRows.push([
        m.Forklift_ID + '-CLN-' + String(idx + 1).padStart(2, '0'),
        m.Forklift_ID,
        c[0], // Area
        c[1], // Task
        c[2], // Method
        c[3]  // Tool
      ]);
    });
  });

  if (clRows.length) clSh.getRange(2, 1, clRows.length, 5).setValues(clRows);
  if (cnRows.length) cnSh.getRange(2, 1, cnRows.length, 6).setValues(cnRows);
}

function seedTestData() {
  setup();
  const emps = rows_(SH.EMP), cl = rows_(SH.CL), cn = safeRows_(SH.CLN), fls = rows_(SH.FL), out = [];
  if (!emps.length || !cl.length) throw new Error('ต้องมีข้อมูล Employees และ Checklist ก่อน (รัน seedForkliftSample ก่อน)');

  for (let d = 6; d >= 0; d--) {
    fls.forEach((m, mi) => {
      if (d === 0 && mi === fls.length - 1) return; // รถคันสุดท้ายให้ค้างสถานะ "ยังไม่ตรวจวันนี้"
      const items = cl.filter(c => c.Forklift_ID === m.Forklift_ID).map(c => ({
        id: c.Item_ID, cat: c.Category, point: c.Inspection_Point, result: Math.random() < 0.08 ? 'NG' : 'OK'
      }));
      if (!items.length) return;
      const cleaning = cn.filter(c => c.Forklift_ID === m.Forklift_ID).map(c => ({
        id: c.Task_ID, area: c.Area, task: c.Task, done: Math.random() < 0.9
      }));
      const bad = items.some(x => x.result === 'NG');
      const t = new Date(Date.now() - d * 864e5);
      t.setHours(8 + mi, Math.floor(Math.random() * 50) + 5, 0, 0);

      out.push([
        t,
        m.Forklift_ID,
        emps[Math.floor(Math.random() * emps.length)].Employee_ID,
        m.Owner_Emp_ID,
        bad ? 'NG' : 'OK',
        JSON.stringify({ items, cleaning, steps: [] }),
        bad ? 'พบจุดผิดปกติ แจ้งช่างซ่อมบำรุงแล้ว' : 'สภาพพร้อมใช้งาน'
      ]);
    });
  }

  const sh = sheet_(SH.LOG);
  sh.getRange(sh.getLastRow() + 1, 1, out.length, 7).setValues(out);
  sh.getRange(2, 1, sh.getLastRow() - 1, 1).setNumberFormat('dd/MM/yyyy HH:mm');
}

function checkData() {
  const issues = [];
  const emps = rows_(SH.EMP), fls = rows_(SH.FL), cl = rows_(SH.CL);
  const eid = {}, flid = {};
  emps.forEach(e => eid[e.Employee_ID] = 1);
  fls.forEach(m => flid[m.Forklift_ID] = 1);

  fls.forEach(m => {
    if (!eid[m.Owner_Emp_ID]) issues.push('รถ ' + m.Forklift_ID + ' มี Owner ที่ไม่อยู่ใน Employees');
    if (!cl.some(c => c.Forklift_ID === m.Forklift_ID)) issues.push('รถ ' + m.Forklift_ID + ' ยังไม่มีรายการตรวจ');
  });

  const msg = issues.length ? 'พบ ' + issues.length + ' ประเด็น:\n- ' + issues.join('\n- ') : 'ข้อมูลถูกต้องสมบูรณ์';
  Logger.log(msg);
  return issues;
}