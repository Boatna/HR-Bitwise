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
  Forklift: ['Forklift_ID', 'Forklift_Name', 'Model_Type', 'Location', 'Owner_Emp_ID', 'Department', 'Load_Capacity', 'Vehicle_Type'],
  Checklist: ['Item_ID', 'Forklift_ID', 'Category', 'Inspection_Point', 'Standard_Criteria', 'Image_File'],
  Inspection_Logs: ['Timestamp', 'Forklift_ID', 'Inspector_ID', 'Owner_ID', 'Overall_Status', 'Check_Data_JSON', 'Remark'],
  Cleaning: ['Task_ID', 'Forklift_ID', 'Area', 'Task', 'Method', 'Tool'],
  Management: ['Config_Key', 'Config_Value', 'Last_Updated', 'Updated_By']
};

const TTL = 6 * 60 * 60;
const MAX_FAIL = 5;
const LOCK_SEC = 300;
const TZ = 'Asia/Bangkok';
const DASH_MAX_ROWS = 1500;
const ERR_AUTH = 'SESSION_EXPIRED';
const DEFAULT_NOTIFICATION_EMAIL = 'nattapong.p@bitwise.co.th, phattama.p@bitwise.co.th';

function doGet(e) {
  const p = (e && e.parameter) || {};
  const action = p.action || '';
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
        case 'getDashboard':
          // ข้อมูลที่ต้องใช้ token ต้องเรียกผ่าน POST เท่านั้น (ไม่ส่ง token ใน URL เพราะจะติด log/ประวัติเบราว์เซอร์)
          result = { ok: false, error: 'กรุณาเรียก ' + action + ' ผ่าน POST' };
          break;
        default:
          result = { ok: false, error: 'Unknown action: ' + action };
      }
      return jsonResponse_(result);
    } catch (err) {
      return jsonResponse_(errorResult_(err));
    }
  }

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
    '<p>ทดสอบเรียกข้อมูล: <a href="?action=ping">?action=ping</a></p>' +
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

    let result;
    switch (body.action || '') {
      case 'login':
        result = login(body.empId, body.pin);
        break;
      case 'logout':
        logout(body.token);
        result = { ok: true };
        break;
      case 'submitCheck':
        result = submitCheck(body.token, body.data || {});
        break;
      case 'getFormData':
        result = { ok: true, data: getFormData(body.token) };
        break;
      case 'getDashboard':
        result = { ok: true, data: getDashboard(body.token) };
        break;
      default:
        result = { ok: false, error: 'Unknown POST action: ' + (body.action || '') };
    }
    return jsonResponse_(result);
  } catch (err) {
    return jsonResponse_(errorResult_(err));
  }
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function errorResult_(err) {
  const msg = (err && err.message) || String(err);
  return msg === ERR_AUTH ? { ok: false, error: msg, code: 'AUTH' } : { ok: false, error: msg };
}

const sheet_ = n => SpreadsheetApp.getActiveSpreadsheet().getSheetByName(n);
const s_ = v => (v == null ? '' : String(v).trim().replace(/\.0+$/, ''));

function rows_(name) {
  const sh = sheet_(name);
  if (!sh) throw new Error('ไม่พบชีต ' + name + ' (กรุณารัน setup() ก่อน)');
  const v = sh.getDataRange().getValues();
  if (v.length < 2) return [];
  const expected = HEAD[name] || [];
  let headerIdx = -1;
  for (let i = 0; i < v.length; i++) {
    const rowStr = v[i].map(s_);
    if (expected.length && expected.some(k => rowStr.indexOf(k) !== -1)) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) {
    for (let i = 0; i < v.length; i++) {
      if (s_(v[i][0]) !== '') {
        headerIdx = i;
        break;
      }
    }
  }
  if (headerIdx === -1 || headerIdx === v.length - 1) return [];

  const h = v[headerIdx].map(s_);
  return v.slice(headerIdx + 1).filter(r => s_(r[0]) !== '').map(r => {
    const o = {};
    h.forEach((k, i) => {
      if (k) o[k] = r[i] instanceof Date ? r[i] : s_(r[i]);
    });
    return o;
  });
}

const safeRows_ = n => (sheet_(n) ? rows_(n) : []);
const pin_ = v => { const s = s_(v); return /^\d{1,3}$/.test(s) ? s.padStart(4, '0') : s; };

function parseDate_(val) {
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return val.getFullYear() > 2400
      ? new Date(val.getFullYear() - 543, val.getMonth(), val.getDate(), val.getHours(), val.getMinutes(), val.getSeconds())
      : val;
  }
  if (!val) return null;
  if (typeof val === 'string') {
    const s = val.trim();
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (m) {
      let yr = Number(m[3]);
      if (yr > 2400) yr -= 543;
      return new Date(yr, Number(m[2]) - 1, Number(m[1]), Number(m[4] || 0), Number(m[5] || 0), Number(m[6] || 0));
    }
  }
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  return d.getFullYear() > 2400
    ? new Date(d.getFullYear() - 543, d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds())
    : d;
}

const safeCell_ = v => { const t = s_(v); return /^[=+\-@]/.test(t) ? "'" + t : t; };
const h_ = v => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const nameMap_ = () => {
  const m = {};
  rows_(SH.EMP).forEach(e => { m[e.Employee_ID] = e.Employee_Name; });
  return m;
};

const cleanDept_ = d => {
  const t = String(d == null ? '' : d)
    .replace(/[\u00A0\u200B]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/([\u0E31\u0E34-\u0E3A\u0E47-\u0E4E])\1+/g, '$1')
    .trim()
    .replace(/^หน่วยโลหะแผ่น\//, '');
  return t || 'ทั่วไป';
};

function requireAuth_(token) {
  if (!token) throw new Error(ERR_AUTH);
  const j = CacheService.getScriptCache().get('t_' + token);
  if (!j) throw new Error(ERR_AUTH);
  return JSON.parse(j);
}

function getLoginData() {
  return rows_(SH.EMP).map(e => ({
    id: e.Employee_ID,
    name: e.Employee_Name,
    dept: cleanDept_(e.Department)
  }));
}

function login(empId, pin) {
  const id = s_(empId);
  const inPin = pin_(pin);
  if (!id || !inPin) return { ok: false, msg: 'PIN ไม่ถูกต้อง' };
  const cache = CacheService.getScriptCache(), fk = 'f_' + id;
  if (Number(cache.get(fk) || 0) >= MAX_FAIL) {
    return { ok: false, msg: 'กรอก PIN ผิดหลายครั้ง กรุณารอ 5 นาที' };
  }
  const e = rows_(SH.EMP).find(r => r.Employee_ID === id);
  // ต้องมี PIN ในชีตเท่านั้น (กันกรณีช่อง PIN ว่างแล้วเข้าสู่ระบบด้วย PIN ว่างได้)
  if (!e || !pin_(e.PIN) || pin_(e.PIN) !== inPin) {
    cache.put(fk, String(Number(cache.get(fk) || 0) + 1), LOCK_SEC);
    return { ok: false, msg: 'PIN ไม่ถูกต้อง' };
  }
  cache.remove(fk);
  const token = Utilities.getUuid();
  cache.put('t_' + token, JSON.stringify({ id: e.Employee_ID, name: e.Employee_Name }), TTL);
  return { ok: true, token, name: e.Employee_Name, id: e.Employee_ID, dept: cleanDept_(e.Department) };
}

function logout(token) {
  if (token) CacheService.getScriptCache().remove('t_' + token);
}

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
    } else {
      let col = sh.getLastColumn();
      const cur = sh.getRange(1, 1, 1, Math.max(col, 1)).getValues()[0].map(s_);
      HEAD[n].forEach(k => {
        if (cur.indexOf(k) === -1) {
          sh.getRange(1, ++col).setValue(k)
            .setFontWeight('bold').setBackground('#1c3a57').setFontColor('#ffffff');
        }
      });
    }
  });

  const cfg = sheet_(SH.CFG);
  if (cfg && !rows_(SH.CFG).some(r => r.Config_Key === 'NOTIFICATION_EMAIL')) {
    cfg.appendRow(['NOTIFICATION_EMAIL', DEFAULT_NOTIFICATION_EMAIL, new Date(), 'อีเมล์สำหรับรับแจ้งเตือนผลการตรวจเช็ค (คั่นหลายอีเมล์ด้วย , )']);
  }

  const empSh = sheet_(SH.EMP);
  if (empSh && empSh.getMaxRows() > 1) {
    const hdr = empSh.getRange(1, 1, 1, Math.max(empSh.getLastColumn(), 1)).getValues()[0].map(s_);
    const pinCol = hdr.indexOf('PIN') + 1 || 6; // หาคอลัมน์ PIN จากหัวตาราง (ไม่ผูกกับคอลัมน์ที่ 6)
    empSh.getRange(2, pinCol, empSh.getMaxRows() - 1, 1).setNumberFormat('@'); // PIN เป็น Text
  }
}

const FORKLIFT_TYPES = [
  // Specific vehicle types must be checked before generic fuel/electric keywords.
  { key: 'walkie_stacker', match: /walkie|stacker|สแต็กเกอร์|วอล์คกี้/i, group: 'electric', subtype: 'walkie_stacker', model3d: 'walkie_stacker', icon: '⚡', badge: 'badge-walkie', label: 'Walkie Stacker (ไฟฟ้า)' },
  { key: 'reach_truck', match: /reach|รีช/i, group: 'electric', subtype: 'reach_truck', model3d: 'reach_truck', icon: '⚡', badge: 'badge-reach', label: 'Reach Truck (ไฟฟ้า)' },
  { key: 'dual', match: /(น้ำมัน|ดีเซล|เบนซิน|petrol|gasoline).*(แก๊ส|แก๊ซ|lpg|cng)|(แก๊ส|แก๊ซ|lpg|cng).*(น้ำมัน|ดีเซล|เบนซิน|petrol|gasoline)|dual|bi-?fuel/i, group: 'engine', subtype: 'petrol+LPG', model3d: 'petrol+LPG', icon: '⛽', badge: 'badge-gas', label: 'เบนซิน+LPG' },
  { key: 'lpg', match: /lpg|cng|ngv|แก๊ส|แก๊ซ|gas/i, group: 'engine', subtype: 'petrol+LPG', model3d: 'petrol+LPG', icon: '🔥', badge: 'badge-lpg', label: 'แก๊ส LPG' },
  { key: 'diesel', match: /ดีเซล|diesel|น้ำมัน/i, group: 'engine', subtype: 'diesel', model3d: 'diesel', icon: '⛽', badge: 'badge-gas', label: 'ดีเซล' },
  { key: 'electric', match: /ไฟฟ้า|electric|แบตเตอรี่/i, group: 'electric', subtype: 'reach_truck', model3d: 'electric_cb', icon: '⚡', badge: 'badge-elec', label: 'โฟล์คลิฟท์ไฟฟ้าแบบนั่งขับ' }
];

const DEFAULT_TYPE = { key: 'other', group: 'engine', subtype: 'diesel', icon: '🚜', badge: 'badge-other', label: 'ทั่วไป' };

const TYPE_MEMO_ = new WeakMap();
function typeOf_(m) {
  if (!m) return DEFAULT_TYPE;
  let t = TYPE_MEMO_.get(m);
  if (!t) { t = computeType_(m); TYPE_MEMO_.set(m, t); }
  return t;
}

function computeType_(m) {
  const vt = s_(m.Vehicle_Type);
  const fn = s_(m.Forklift_Name);
  const mt = s_(m.Model_Type);

  // 1. ตรวจสอบ Walkie stacker เป็นลำดับแรก
  if (/walkie|stacker|สแต็กเกอร์|วอล์คกี้/i.test(vt + ' ' + fn)) {
    return FORKLIFT_TYPES.find(x => x.key === 'walkie_stacker') || DEFAULT_TYPE;
  }
  // 2. ตรวจสอบ Reach truck
  if (/reach|รีช/i.test(vt + ' ' + fn)) {
    return FORKLIFT_TYPES.find(x => x.key === 'reach_truck') || DEFAULT_TYPE;
  }
  // 3. ตรวจจาก Vehicle_Type + Model_Type ก่อน (ชื่อรถมักมีชื่อแผนกต่อท้าย อาจทำให้จับคู่ผิด) แล้วค่อยใช้ชื่อรถเป็นตัวสำรอง
  const primary = (vt + ' ' + mt).trim();
  return FORKLIFT_TYPES.find(x => x.match.test(primary)) ||
    FORKLIFT_TYPES.find(x => x.match.test(fn)) ||
    DEFAULT_TYPE;
}

const kindOf_ = m => typeOf_(m).group;
const subtypeOf_ = m => typeOf_(m).subtype || typeOf_(m).key;
const typeFields_ = m => {
  const t = typeOf_(m);
  return { group: t.group, subtype: t.subtype || t.key, model3d: t.model3d || t.subtype || t.key, icon: t.icon, badge: t.badge, label: t.label };
};

function itemsMatchKind_(items, kind) {
  const hasElec = items.some(x => /ปลั๊กชาร์จ|ขั้วแบต|charge|charging/i.test(s_(x.Inspection_Point)));
  return kind === 'electric' ? hasElec : !hasElec;
}

function itemsMatchSubtype_(items, sub) {
  if (sub === 'walkie_stacker') {
    return items.some(x => /belly|ป้องกันการชน|ฉุกเฉินกันชน|กันชน|แฮนด์บังคับ|คันบังคับ|ปุ่มควบคุมทิศทาง|dead-?man|สแต็กเกอร์|tiller/i.test(s_(x.Inspection_Point)));
  }
  if (sub === 'reach_truck' || sub === 'electric') {
    return items.some(x => /ปลั๊กชาร์จ|ขั้วแบต|charge/i.test(s_(x.Inspection_Point))) &&
      !items.some(x => /belly|ป้องกันการชน|ฉุกเฉินกันชน|กันชน|แฮนด์บังคับ|คันบังคับ|ปุ่มควบคุมทิศทาง|dead-?man/i.test(s_(x.Inspection_Point)));
  }
  if (sub === 'petrol+LPG') {
    return items.some(x => /lpg|ก๊าซ|แก๊ส/i.test(s_(x.Inspection_Point)));
  }
  return !items.some(x => /ปลั๊กชาร์จ|ขั้วแบต|lpg|ก๊าซ|แก๊ส/i.test(s_(x.Inspection_Point)));
}

function resolveItemImage_(sub, point) {
  const p = s_(point).toLowerCase();
  if (sub === 'reach_truck' || sub === 'electric') {
    if (/น้ำกลั่น|battery/i.test(p)) return 'Electric-Reach-Truck/electric-battery-water.jpg';
    if (/ขั้วแบต/i.test(p)) return 'Electric-Reach-Truck/electric-battery-terminal.jpg';
    if (/ปลั๊ก|ชาร์จ/i.test(p)) return 'Electric-Reach-Truck/electric-charge-plug.jpg';
    if (/เสา|งา/i.test(p)) return 'Electric-Reach-Truck/electric-mast-forks.jpg';
    if (/โซ่/i.test(p)) return 'Electric-Reach-Truck/electric-chain.jpg';
    if (/ล้อ|ยาง/i.test(p)) return 'Electric-Reach-Truck/electric-wheel-tire.jpg';
    if (/สายไฮ/i.test(p)) return 'Electric-Reach-Truck/electric-hydraulic-hose.jpg';
    if (/ไฮดรอลิ/i.test(p)) return 'Electric-Reach-Truck/electric-hydraulic-oil.jpg';
    if (/ไฟ|แตร/i.test(p)) return 'Electric-Reach-Truck/electric-lights-horn.jpg';
    if (/เบรค|เบรก/i.test(p)) return 'Electric-Reach-Truck/electric-brake.jpg';
  } else if (sub === 'walkie_stacker') {
    if (/น้ำกลั่น/i.test(p)) return 'Electric-Walkie-stacker/Electric-Walkie-stacker-v.1/Distilled-water-level-battery.jpg';
    if (/ขั้วแบต/i.test(p)) return 'Electric-Walkie-stacker/Electric-Walkie-stacker-v.1/Battery-terminal.jpg';
    if (/ปลั๊ก|ชาร์จ/i.test(p)) return 'Electric-Walkie-stacker/Electric-Walkie-stacker-v.1/Charging-plug.jpg';
    if (/โซ่/i.test(p)) return 'Electric-Walkie-stacker/Electric-Walkie-stacker-v.2/chain.jpg';
    if (/เสา|งา/i.test(p)) return 'Electric-Walkie-stacker/Electric-Walkie-stacker-v.1/Forks.jpg';
    if (/ล้อ|ยาง/i.test(p)) return 'Electric-Walkie-stacker/Electric-Walkie-stacker-v.1/Wheels+Tires.jpg';
    if (/ไฟ|แตร/i.test(p)) return 'Electric-Walkie-stacker/Electric-Walkie-stacker-v.1/Signal lights+horn.jpg';
    if (/เบรค|เบรก/i.test(p)) return 'Electric-Walkie-stacker/Electric-Walkie-stacker-v.1/Brake-system.jpg';
    if (/แฮนด์|คันบังคับ|ทิศทาง|เดินหน้า/i.test(p)) return 'Electric-Walkie-stacker/Electric-Walkie-stacker-v.1/Forward–reverse-control-button.jpg';
    if (/ป้องกันการชน|กันชน|belly/i.test(p)) return 'Electric-Walkie-stacker/Electric-Walkie-stacker-v.1/Anti-collision-button.jpg';
    if (/สายไฮ/i.test(p)) return 'Electric-Walkie-stacker/Electric-Walkie-stacker-v.2/hydraulic-hose.jpg';
    if (/ไฮดรอลิ/i.test(p)) return 'Electric-Walkie-stacker/Electric-Walkie-stacker-v.2/hydraulic-oil.jpg';
  } else if (sub === 'petrol+LPG') {
    if (/น้ำมันเครื่อง/i.test(p)) return 'Forklift-petrol+LPG/Forklift-petrol+LPG-Engine-oil-level.jpg';
    if (/หม้อพักน้ำ|หล่อเย็น|หม้อน้ำ/i.test(p)) return 'Forklift-petrol+LPG/Forklift-petrol+LPG-Coolant-reservoir-level.jpg';
    if (/แบตเตอรี่|น้ำกลั่น/i.test(p)) return 'Forklift-petrol+LPG/Forklift-petrol+LPG-battery.jpg';
    if (/สายไฮ/i.test(p)) return 'Forklift-petrol+LPG/Forklift-petrol+LPG-Condition-of-the-hydraulic-hose.jpg';
    if (/ไฮดรอลิ/i.test(p)) return 'Forklift-petrol+LPG/Forklift-petrol+LPG-Hydraulic-oil-level.jpg';
    if (/เสา|งา/i.test(p)) return 'Forklift-petrol+LPG/Forklift-petrol+LPG-Mast-and-forks.jpg';
    if (/โซ่/i.test(p)) return 'Forklift-petrol+LPG/Forklift-petrol+LPG-Chain-condition.jpg';
    if (/คลัตช์|คลัช|ครัช/i.test(p)) return 'Forklift-petrol+LPG/Forklift-petrol+LPG-Brake-and-clutch-fluid-level.jpg';
    if (/เบรค|เบรก/i.test(p)) return 'Forklift-petrol+LPG/Forklift-petrol+LPG-Brake-system.jpg';
    if (/ล้อ|ยาง/i.test(p)) return 'Forklift-petrol+LPG/Forklift-petrol+LPG-Wheels-and-tires.jpg';
    if (/พวงมาลัย/i.test(p)) return 'Forklift-petrol+LPG/Forklift-petrol+LPG-steering-wheel.jpg';
    if (/ไฟ|แตร/i.test(p)) return 'Forklift-petrol+LPG/Forklift-petrol+LPG-Signal-and-horn.jpg';
    if (/กระจก/i.test(p)) return 'Forklift-petrol+LPG/Forklift-petrol+LPG-Side-view-mirror.jpg';
    if (/เข็มขัด|เบาะ/i.test(p)) return 'Forklift-petrol+LPG/Forklift-petrol+LPG-Seat-belt.jpg';
    if (/สภาพถังก๊าซ|ถังแก๊ส/i.test(p)) return 'Forklift-petrol+LPG/Forklift-petrol+LPG-Gas.jpg';
    if (/ยึดถัง/i.test(p)) return 'Forklift-petrol+LPG/Forklift-petrol+LPG-Securing-gas.jpg';
    if (/สายส่ง/i.test(p)) return 'Forklift-petrol+LPG/Forklift-petrol+LPG-Gas-pipeline.jpg';
    if (/ข้อต่อ|เชื่อมต่อ/i.test(p)) return 'Forklift-petrol+LPG/Gas-fittings-and-connection.jpg';
    if (/รั่วซึม/i.test(p)) return 'Forklift-petrol+LPG/Forklift-petrol+LPG-Gas-leakage.jpg';
    if (/มาตรวัด|ระดับก๊าซ|เกจ/i.test(p)) return 'Forklift-petrol+LPG/Forklift-petrol+LPG-Gas-level-gauge.jpg';
  } else {
    if (/น้ำมันเครื่อง/i.test(p)) return 'Forklift-diesel/Forklift-diesel-Engine-oil-level.jpg';
    if (/หม้อพักน้ำ|หล่อเย็น|หม้อน้ำ/i.test(p)) return 'Forklift-diesel/Forklift-diesel-Coolant-reservoir-level.jpg';
    if (/แบตเตอรี่|น้ำกลั่น/i.test(p)) return 'Forklift-diesel/Forklift-diesel-battery.jpg';
    if (/สายไฮ/i.test(p)) return 'Forklift-diesel/Forklift-diesel-Condition-of-the-hydraulic-hose.jpg';
    if (/ไฮดรอลิ/i.test(p)) return 'Forklift-diesel/Forklift-diesel-Hydraulic-oil-level.jpg';
    if (/เสา|งา/i.test(p)) return 'Forklift-diesel/Forklift-diesel-Mast-and-forks.jpg';
    if (/โซ่/i.test(p)) return 'Forklift-diesel/Forklift-diesel-Chain-condition.jpg';
    if (/คลัตช์|คลัช|ครัช/i.test(p)) return 'Forklift-diesel/Forklift-diesel-Brake-and-clutch-fluid-level.jpg';
    if (/เบรค|เบรก/i.test(p)) return 'Forklift-diesel/Forklift-diesel-Brake-system.jpg';
    if (/ล้อ|ยาง/i.test(p)) return 'Forklift-diesel/Forklift-diesel-Condition-of-wheels-and-tires.jpg';
    if (/พวงมาลัย/i.test(p)) return 'Forklift-diesel/Forklift-diesel-steering-wheel.jpg';
    if (/ไฟ|แตร/i.test(p)) return 'Forklift-diesel/Forklift-diesel-Signal-lights-and-horn.jpg';
    if (/กระจก/i.test(p)) return 'Forklift-diesel/Forklift-diesel-Side-view-mirror.jpg';
    if (/เข็มขัด|เบาะ/i.test(p)) return 'Forklift-diesel/Forklift-diesel-Seat-belt.jpg';
  }
  return '';
}

const BY_FL_ = new WeakMap();
function byForklift_(arr) {
  let idx = BY_FL_.get(arr);
  if (!idx) {
    idx = {};
    arr.forEach(r => { (idx[r.Forklift_ID] = idx[r.Forklift_ID] || []).push(r); });
    BY_FL_.set(arr, idx);
  }
  return idx;
}

function checklistFor_(m, cls, fls) {
  const sub = subtypeOf_(m);
  const kind = kindOf_(m);
  const by = byForklift_(cls);
  const own = by[m.Forklift_ID] || [];

  let items = own;
  if (!items.length) {
    // 1. ค้นหา template ตาม subtype เดียวกัน
    let tpl = null;
    for (let i = 0; i < fls.length && !tpl; i++) {
      const f = fls[i];
      if (f.Forklift_ID === m.Forklift_ID || subtypeOf_(f) !== sub) continue;
      const rows = by[f.Forklift_ID] || [];
      if (rows.length && itemsMatchSubtype_(rows, sub)) tpl = rows;
    }

    // 2. ถ้าไม่พบ template subtype เดียวกัน ให้ค้นหาตาม group (kind)
    if (!tpl) {
      for (let i = 0; i < fls.length && !tpl; i++) {
        const f = fls[i];
        if (f.Forklift_ID === m.Forklift_ID || kindOf_(f) !== kind) continue;
        const rows = by[f.Forklift_ID] || [];
        if (rows.length && itemsMatchKind_(rows, kind)) tpl = rows;
      }
    }

    const id = n => m.Forklift_ID + '-CHK-' + String(n + 1).padStart(2, '0');
    if (tpl) {
      items = tpl.map((c, i) => Object.assign({}, c, { Item_ID: id(i), Forklift_ID: m.Forklift_ID }));
    } else {
      // 3. ใช้รายการมาตรฐานตาม subtype
      const inspectList = SEED_INSPECT_FORKLIFT[sub] || SEED_INSPECT_FORKLIFT[kind] || SEED_INSPECT_FORKLIFT.engine;
      const imgList = SEED_IMG_FORKLIFT[sub] || SEED_IMG_FORKLIFT[m.Model_Type] || SEED_IMG_FORKLIFT[kind] || SEED_IMG_FORKLIFT.engine;
      items = inspectList.map((it, i) => ({
        Item_ID: id(i),
        Forklift_ID: m.Forklift_ID,
        Category: it[0],
        Inspection_Point: it[1],
        Standard_Criteria: it[2],
        Image_File: imgList[i] || ''
      }));
    }
  }

  // เติมรูปภาพให้อัตโนมัติถ้าในชีตยังว่างอยู่
  return items.map((c, i) => {
    const img = s_(c.Image_File) || resolveItemImage_(sub, c.Inspection_Point);
    return Object.assign({}, c, { Image_File: img });
  });
}

function cleanFor_(m, cns) {
  const by = byForklift_(cns);
  const own = by[m.Forklift_ID] || [];
  if (own.length) return own;
  const id = n => m.Forklift_ID + '-CLN-' + String(n + 1).padStart(2, '0');
  const tpl = by['DEFAULT'] || by['ALL'] || (cns.length ? (by[cns[0].Forklift_ID] || []) : []);
  if (tpl.length) {
    return tpl.map((c, i) => Object.assign({}, c, { Task_ID: id(i), Forklift_ID: m.Forklift_ID }));
  }
  return SEED_CLEAN_FORKLIFT.map((c, i) => ({
    Task_ID: id(i), Forklift_ID: m.Forklift_ID, Area: c[0], Task: c[1], Method: c[2], Tool: c[3]
  }));
}

function getFormData(token) {
  requireAuth_(token);
  const emps = rows_(SH.EMP);
  const names = {}, empDepts = {};
  emps.forEach(e => {
    names[e.Employee_ID] = e.Employee_Name;
    empDepts[e.Employee_ID] = e.Department;
  });

  const fls = rows_(SH.FL), cls = rows_(SH.CL), cns = safeRows_(SH.CLN);
  const allItems = [], allClean = [];
  fls.forEach(m => {
    checklistFor_(m, cls, fls).forEach(x => allItems.push(x));
    cleanFor_(m, cns).forEach(x => allClean.push(x));
  });

  return {
    forklifts: fls.map(m => ({
      ...typeFields_(m),
      id: m.Forklift_ID,
      name: m.Forklift_Name,
      model: m.Model_Type,
      vehicleType: m.Vehicle_Type || (typeOf_(m).label || ''),
      loc: m.Location,
      capacity: m.Load_Capacity || '',
      owner: names[m.Owner_Emp_ID] || m.Owner_Emp_ID,
      dept: cleanDept_(m.Department || empDepts[m.Owner_Emp_ID])
    })),
    items: allItems.map(c => ({
      id: c.Item_ID,
      forkliftId: c.Forklift_ID,
      cat: c.Category || 'ทั่วไป',
      point: c.Inspection_Point,
      std: c.Standard_Criteria,
      img: c.Image_File || ''
    })),
    clean: allClean.map(c => ({
      id: c.Task_ID,
      forkliftId: c.Forklift_ID,
      area: c.Area,
      task: c.Task,
      method: c.Method,
      tool: c.Tool
    }))
  };
}

function submitCheck(token, d) {
  const u = requireAuth_(token);
  d = d || {};
  const flId = s_(d.forkliftId);
  const fls = rows_(SH.FL);
  const m = fls.find(r => r.Forklift_ID === flId);
  if (!m) throw new Error('ไม่พบข้อมูลรถโฟล์คลิฟท์ ' + flId);

  const items = checklistFor_(m, rows_(SH.CL), fls);
  if (!items.length) throw new Error('รถโฟล์คลิฟท์นี้ยังไม่มีรายการตรวจใน Checklist');

  const resMap = d.results || {};
  const left = items.filter(c => resMap[c.Item_ID] !== 'OK' && resMap[c.Item_ID] !== 'NG').length;
  if (left) throw new Error('ยังไม่ได้เลือกผลตรวจ ' + left + ' จุด');

  const ngDetails = (d.ngDetails && typeof d.ngDetails === 'object') ? d.ngDetails : null;

  const data = items.map(c => {
    const isNg = resMap[c.Item_ID] === 'NG';
    const row = {
      id: c.Item_ID,
      cat: c.Category || 'ทั่วไป',
      point: c.Inspection_Point,
      std: c.Standard_Criteria || '',
      result: isNg ? 'NG' : 'OK'
    };
    if (isNg) row.detail = s_(ngDetails && ngDetails[c.Item_ID]).slice(0, 500);
    return row;
  });

  const status = data.some(x => x.result === 'NG') ? 'NG' : 'OK';
  if (status === 'NG') {
    if (ngDetails) {
      const noDetail = data.filter(x => x.result === 'NG' && !x.detail);
      if (noDetail.length) {
        throw new Error('กรุณาระบุรายละเอียดความผิดปกติ: ' + noDetail.map(x => x.point).join(', '));
      }
    } else if (!s_(d.note)) {
      throw new Error('กรุณาระบุหมายเหตุเมื่อพบจุดผิดปกติ (NG)');
    }
  }

  const note = s_(d.note);
  const remarkText = note || data.filter(x => x.result === 'NG' && x.detail)
    .map(x => x.point + ': ' + x.detail).join(' | ');

  const tasks = d.cleaningRequired !== false ? cleanFor_(m, safeRows_(SH.CLN)) : [];
  const doneMap = d.cleaning || {};
  const cleaning = tasks.map(t => ({ id: t.Task_ID, area: t.Area, task: t.Task, done: !!doneMap[t.Task_ID] }));

  const emps = rows_(SH.EMP);
  const inspectorEmp = emps.find(e => e.Employee_ID === u.id);
  const inspectorName = (inspectorEmp && inspectorEmp.Employee_Name) || u.name;
  const inspectorDept = inspectorEmp ? cleanDept_(inspectorEmp.Department) : '-';
  const ownerEmp = emps.find(e => e.Employee_ID === m.Owner_Emp_ID);
  const ownerName = ownerEmp ? ownerEmp.Employee_Name : m.Owner_Emp_ID;

  const logSh = sheet_(SH.LOG);
  if (!logSh) throw new Error('ไม่พบชีต ' + SH.LOG + ' (กรุณารัน setup() ก่อน)');

  const cache = CacheService.getScriptCache();
  const dupKey = d.submitId ? 's_' + s_(d.submitId).slice(0, 64) : '';
  const receivedAt = new Date();
  let now = receivedAt;
  // ข้อมูลที่เก็บไว้ในเครื่องตอนออฟไลน์ จะใช้เวลาที่ตรวจจริง (ย้อนหลังได้ไม่เกิน 3 วัน และต้องไม่เป็นเวลาในอนาคต)
  const offTs = Number(d.offlineTs);
  if (offTs && isFinite(offTs)) {
    const age = receivedAt.getTime() - offTs;
    if (age >= 0 && age <= 3 * 864e5) now = new Date(offTs);
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (dupKey && cache.get(dupKey)) {
      return { ok: true, duplicate: true, status: status, emailSent: true, message: 'ระบบบันทึกรายการนี้ไปแล้ว' };
    }
    logSh.appendRow([
      now,
      flId,
      u.id,
      m.Owner_Emp_ID,
      status,
      JSON.stringify({ items: data, cleaning: cleaning }),
      safeCell_(remarkText)
    ]);
    logSh.getRange(logSh.getLastRow(), 1).setNumberFormat('dd/MM/yyyy HH:mm');
    if (dupKey) cache.put(dupKey, '1', TTL);
  } finally {
    lock.releaseLock();
  }

  let emailSent = false, emailError = '';
  try {
    emailSent = sendInspectionEmail_({
      inspector: { id: u.id, name: inspectorName },
      inspectorDept: inspectorDept,
      forklift: m,
      ownerName: ownerName,
      status: status,
      items: data,
      cleaning: cleaning,
      note: note,
      timestamp: now,
      receivedAt: receivedAt
    });
  } catch (mailErr) {
    emailError = mailErr.message || String(mailErr);
    Logger.log('Mail send error: ' + emailError);
  }

  return {
    ok: true,
    status: status,
    message: 'บันทึกข้อมูลเรียบร้อยแล้ว' + (emailSent ? ' และส่งอีเมล์รายงานแล้ว' : ' แต่ส่งอีเมล์ไม่สำเร็จ'),
    emailSent: emailSent,
    emailError: emailError
  };
}

function getRecipients_() {
  const cfg = safeRows_(SH.CFG);
  const emailCfg = (cfg.find(r => r.Config_Key === 'NOTIFICATION_EMAIL') || {}).Config_Value;
  const list = (s_(emailCfg) || DEFAULT_NOTIFICATION_EMAIL)
    .split(/[,;\s]+/).map(x => x.trim()).filter(x => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x));
  return list.length ? list.join(',') : DEFAULT_NOTIFICATION_EMAIL;
}

function sendInspectionEmail_(info) {
  const recipient = getRecipients_();
  if (MailApp.getRemainingDailyQuota() < 1) throw new Error('โควต้าส่งอีเมล์ของวันนี้เต็มแล้ว');

  const u = info.inspector;
  const m = info.forklift;
  const status = info.status;
  const items = info.items || [];
  const cleaning = info.cleaning || [];
  const note = info.note || '';
  const nowStr = Utilities.formatDate(info.timestamp || new Date(), TZ, 'dd/MM/yyyy HH:mm:ss');
  const recvStr = Utilities.formatDate(info.receivedAt || info.timestamp || new Date(), TZ, 'dd/MM/yyyy HH:mm:ss');
  const offlineLate = !!(info.receivedAt && info.timestamp && info.receivedAt.getTime() - info.timestamp.getTime() > 2 * 60 * 1000);

  const isNg = status === 'NG';
  const ngList = items.filter(x => x.result === 'NG');
  const okList = items.filter(x => x.result !== 'NG');
  const statusText = isNg ? 'พบจุดผิดปกติ (NG)' : 'ผ่านเกณฑ์ปกติ (OK)';
  const statusColor = isNg ? '#e53e3e' : '#38a169';
  const statusBg = isNg ? '#fff5f5' : '#f0fff4';
  const statusBadge = isNg ? '⚠️ ไม่ผ่าน (NG) ' + ngList.length + ' ข้อ' : '✓ ผ่านทุกข้อ (OK)';

  const ownerName = info.ownerName || m.Owner_Emp_ID || '-';

  const subject = (isNg ? '⚠️ [ไม่ผ่าน NG ' + ngList.length + ' ข้อ]' : '✓ [ผ่านการตรวจ - OK]') +
    ' ผลตรวจโฟล์คลิฟท์ ' + m.Forklift_ID + ' (' + m.Forklift_Name + (m.Vehicle_Type ? ' ' + m.Vehicle_Type : '') + ' - ' + cleanDept_(m.Department) + ') โดย ' + u.name;
  let itemRowsHtml = '';
  let itemRowsText = '';
  items.forEach((it, idx) => {
    const itNg = it.result === 'NG';
    const rowBg = itNg ? '#fff5f5' : (idx % 2 === 0 ? '#ffffff' : '#f8fafc');
    const resBadge = itNg
      ? '<span style="color:#c53030;font-weight:bold;background:#fed7d7;padding:4px 10px;border-radius:4px;display:inline-block;">✕ ไม่ผ่าน (NG)</span>'
      : '<span style="color:#22543d;font-weight:bold;background:#c6f6d5;padding:4px 10px;border-radius:4px;display:inline-block;">✓ ผ่าน (OK)</span>';

    itemRowsHtml += '<tr style="background:' + rowBg + ';border-bottom:1px solid #e2e8f0;">' +
      '<td style="padding:10px 8px;text-align:center;font-size:13px;color:#718096;">' + (idx + 1) + '</td>' +
      '<td style="padding:10px 8px;font-size:13px;color:#4a5568;">' + h_(it.cat || 'ทั่วไป') + '</td>' +
      '<td style="padding:10px 8px;font-size:13px;font-weight:600;color:#2d3748;">' + h_(it.point) +
        (itNg && it.detail ? '<div style="margin-top:6px;padding:6px 10px;background:#fed7d7;border-left:3px solid #e53e3e;border-radius:4px;font-size:12px;font-weight:normal;color:#742a2a;"><b>รายละเอียดความผิดปกติ:</b> ' + h_(it.detail) + '</div>' : '') +
        '</td>' +
      '<td style="padding:10px 8px;font-size:12px;color:#718096;">' + h_(it.std || '-') + '</td>' +
      '<td style="padding:10px 8px;text-align:center;font-size:13px;">' + resBadge + '</td>' +
      '</tr>';

    itemRowsText += (idx + 1) + '. [' + (it.cat || 'ทั่วไป') + '] ' + it.point + ' : ' + (itNg ? '✕ ไม่ผ่าน (NG)' : '✓ ผ่าน (OK)') + '\n' +
      (itNg && it.detail ? '     รายละเอียดความผิดปกติ: ' + it.detail + '\n' : '');
  });

  let cleanSectionHtml = '';
  let cleanSectionText = '';
  if (cleaning.length > 0) {
    let cleanRows = '';
    cleaning.forEach((c, idx) => {
      const isDone = c.done;
      cleanRows += '<tr style="border-bottom:1px solid #e2e8f0;background:' + (idx % 2 === 0 ? '#fff' : '#f8fafc') + ';">' +
        '<td style="padding:8px 10px;font-size:13px;color:#4a5568;">' + h_(c.area || '-') + '</td>' +
        '<td style="padding:8px 10px;font-size:13px;color:#2d3748;">' + h_(c.task || '-') + '</td>' +
        '<td style="padding:8px 10px;text-align:center;font-size:13px;">' +
        (isDone ? '<span style="color:#22543d;font-weight:600;">✓ เรียบร้อย</span>' : '<span style="color:#a0aec0;">-</span>') +
        '</td></tr>';
      cleanSectionText += '- ' + (c.area || '') + ' (' + (c.task || '') + '): ' + (isDone ? 'เรียบร้อย' : 'ยังไม่ทำ') + '\n';
    });

    cleanSectionHtml = '<div style="margin-top:22px;">' +
      '<h4 style="margin:0 0 8px 0;color:#1c3a57;font-size:14px;border-bottom:2px solid #e2e8f0;padding-bottom:6px;">🧹 บันทึกการทำความสะอาด</h4>' +
      '<table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;">' +
      '<thead><tr style="background:#edf2f7;color:#4a5568;font-size:12px;text-align:left;">' +
      '<th style="padding:8px 10px;">จุดทำความสะอาด</th><th style="padding:8px 10px;">รายการงาน</th><th style="padding:8px 10px;text-align:center;">สถานะ</th></tr></thead>' +
      '<tbody>' + cleanRows + '</tbody></table></div>';
  }

  let ngAlertHtml = '';
  if (isNg) {
    const ngItemsList = ngList
      .map(x => '<li style="margin-bottom:6px;"><b>' + h_(x.point) + '</b> (' + h_(x.cat || 'ทั่วไป') + ') - เกณฑ์: ' + h_(x.std || '-') +
        (x.detail ? '<br><span style="color:#742a2a;">➜ <b>รายละเอียด:</b> ' + h_(x.detail) + '</span>' : '') + '</li>')
      .join('');
    ngAlertHtml = '<div style="background:#fff5f5;border-left:5px solid #e53e3e;padding:14px 18px;margin:0 0 20px 0;border-radius:6px;">' +
      '<div style="color:#c53030;font-weight:bold;font-size:15px;margin-bottom:8px;">⚠️ รายการที่ไม่ผ่านเกณฑ์มาตรฐาน (NG) ' + ngList.length + ' ข้อ:</div>' +
      '<ul style="margin:0 0 10px 0;padding-left:22px;color:#9b2c2c;font-size:13px;line-height:1.6;">' + ngItemsList + '</ul>' +
      (note ? '<div style="color:#742a2a;font-size:13px;background:#fed7d7;padding:10px 14px;border-radius:4px;border-left:3px solid #e53e3e;"><b>หมายเหตุจากผู้ตรวจ:</b> ' + h_(note) + '</div>' : '') +
      '</div>';
  }

  const summaryHtml = '<table role="presentation" style="width:100%;border-collapse:separate;border-spacing:8px 0;margin:0 0 18px 0;"><tr>' +
    '<td style="background:#f0fff4;border:1px solid #c6f6d5;border-radius:8px;padding:12px;text-align:center;width:33%;"><div style="font-size:24px;font-weight:bold;color:#22543d;">' + okList.length + '</div><div style="font-size:12px;color:#276749;">ผ่าน (OK)</div></td>' +
    '<td style="background:#fff5f5;border:1px solid #fed7d7;border-radius:8px;padding:12px;text-align:center;width:33%;"><div style="font-size:24px;font-weight:bold;color:#c53030;">' + ngList.length + '</div><div style="font-size:12px;color:#9b2c2c;">ไม่ผ่าน (NG)</div></td>' +
    '<td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;text-align:center;width:33%;"><div style="font-size:24px;font-weight:bold;color:#1c3a57;">' + items.length + '</div><div style="font-size:12px;color:#4a5568;">ทั้งหมด</div></td>' +
    '</tr></table>';

  const htmlBody = '<!DOCTYPE html><html><head><meta charset="utf-8"></head>' +
    '<body style="margin:0;padding:24px 10px;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;">' +
    '<div style="max-width:680px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">' +

    '<div style="background:#1c3a57;padding:24px 20px;text-align:center;color:#ffffff;">' +
    '<div style="font-size:12px;letter-spacing:1.5px;color:#f08a1c;font-weight:bold;margin-bottom:6px;">ระบบตรวจเช็ครถโฟล์คลิฟท์ประจำวัน (Bitwise)</div>' +
    '<h2 style="margin:0;font-size:20px;color:#ffffff;">รายงานผลการตรวจเช็ครถโฟล์คลิฟท์</h2>' +
    '</div>' +

    '<table role="presentation" style="width:100%;border-collapse:collapse;background:' + statusBg + ';border-bottom:2px solid ' + statusColor + ';"><tr>' +
    '<td style="padding:14px 20px;font-size:14px;color:#4a5568;font-weight:500;">ผลการตรวจภาพรวม:</td>' +
    '<td style="padding:14px 20px;text-align:right;font-size:16px;font-weight:bold;color:' + statusColor + ';">' + statusBadge + '</td>' +
    '</tr></table>' +

    '<div style="padding:22px 20px;">' +
    ngAlertHtml +
    summaryHtml +

    '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 18px;margin-bottom:20px;">' +
    '<table style="width:100%;font-size:13px;border-collapse:collapse;color:#2d3748;line-height:1.7;">' +
    '<tr>' +
    '<td style="padding:4px 0;width:50%;"><b>👤 ผู้ตรวจเช็ค:</b> ' + h_(u.name) + ' (' + h_(u.id) + ')</td>' +
    '<td style="padding:4px 0;width:50%;"><b>🏢 แผนกผู้ตรวจ:</b> ' + h_(info.inspectorDept || '-') + '</td>' +
    '</tr>' +
    '<tr>' +
    '<td style="padding:4px 0;"><b>🚜 รถโฟล์คลิฟท์:</b> ' + h_(m.Forklift_Name) + ' (' + h_(m.Forklift_ID) + ')</td>' +
    '<td style="padding:4px 0;"><b>⚙️ ประเภท:</b> ' + h_(m.Vehicle_Type ? (m.Vehicle_Type + ' [' + (m.Model_Type || '-') + ']') : (m.Model_Type || '-')) + '<br><b>⚖️ พิกัด:</b> ' + h_(m.Load_Capacity || '-') + '</td>' +
    '</tr>' +
    '<tr>' +
    '<td style="padding:4px 0;"><b>📍 ประจำแผนก/ที่ตั้ง:</b> ' + h_(cleanDept_(m.Department)) + ' / ' + h_(m.Location || '-') + '</td>' +
    '<td style="padding:4px 0;"><b>📅 วันที่-เวลา:</b> ' + nowStr + ' น.</td>' +
    '</tr>' +
    '<tr>' +
    '<td style="padding:4px 0;" colspan="2"><b>👷 ผู้รับผิดชอบรถ:</b> ' + h_(ownerName) + '</td>' +
    '</tr>' +
    (note && !isNg ? '<tr><td colspan="2" style="padding:6px 0;color:#4a5568;"><b>📝 หมายเหตุ:</b> ' + h_(note) + '</td></tr>' : '') +
    '</table>' +
    '</div>' +

    '<h4 style="margin:0 0 10px 0;color:#1c3a57;font-size:14px;border-bottom:2px solid #e2e8f0;padding-bottom:6px;">📋 รายละเอียดการตรวจเช็ครายข้อ (' + items.length + ' รายการ)</h4>' +
    '<table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;">' +
    '<thead><tr style="background:#edf2f7;color:#4a5568;font-size:12px;text-align:left;">' +
    '<th style="padding:10px 8px;text-align:center;width:35px;">#</th>' +
    '<th style="padding:10px 8px;width:90px;">หมวดหมู่</th>' +
    '<th style="padding:10px 8px;">จุดตรวจเช็ค</th>' +
    '<th style="padding:10px 8px;width:140px;">เกณฑ์มาตรฐาน</th>' +
    '<th style="padding:10px 8px;text-align:center;width:115px;">ผลการตรวจ</th>' +
    '</tr></thead>' +
    '<tbody>' + itemRowsHtml + '</tbody></table>' +

    cleanSectionHtml +
    '</div>' +

    '<div style="background:#f7fafc;border-top:1px solid #e2e8f0;padding:16px 20px;text-align:center;font-size:12px;color:#a0aec0;line-height:1.6;">' +
    'อีเมล์นี้ถูกส่งโดยอัตโนมัติจากระบบตรวจเช็ครถโฟล์คลิฟท์ Bitwise<br>' +
    'บันทึกข้อมูลเมื่อ ' + nowStr + ' น.' +
    (offlineLate ? '<br>ส่งเข้าระบบเมื่อ ' + recvStr + ' น. (บันทึกขณะออฟไลน์)' : '') +
    '</div>' +
    '</div></body></html>';

  const textBody = 'รายงานผลการตรวจเช็ครถโฟล์คลิฟท์ Bitwise\n' +
    '====================================\n' +
    'สถานะ: ' + statusText + ' | ผ่าน ' + okList.length + ' / ไม่ผ่าน ' + ngList.length + ' / ทั้งหมด ' + items.length + '\n' +
    'ผู้ตรวจเช็ค: ' + u.name + ' (' + u.id + ') แผนก: ' + (info.inspectorDept || '-') + '\n' +
    'รถโฟล์คลิฟท์: ' + m.Forklift_Name + ' (' + m.Forklift_ID + ')\n' +
    'ประเภท: ' + (m.Model_Type || '-') + '\n' +
    'พิกัด: ' + (m.Load_Capacity || '-') + '\n' +
    'ประจำแผนก/ที่ตั้ง: ' + cleanDept_(m.Department) + ' / ' + (m.Location || '-') + '\n' +
    'วัน-เวลา: ' + nowStr + ' น.\n' +
    (offlineLate ? 'ส่งเข้าระบบเมื่อ: ' + recvStr + ' น. (บันทึกขณะออฟไลน์)\n' : '') +
    (note ? 'หมายเหตุ: ' + note + '\n' : '') + '\n' +
    'รายการตรวจเช็ค (' + items.length + ' รายการ):\n' +
    itemRowsText + '\n' +
    (cleanSectionText ? 'การทำความสะอาด:\n' + cleanSectionText + '\n' : '') +
    '====================================\n';

  MailApp.sendEmail({
    to: recipient,
    subject: subject,
    htmlBody: htmlBody,
    body: textBody,
    name: 'ระบบตรวจเช็คโฟล์คลิฟท์ Bitwise'
  });

  return true;
}

function sendTestEmail() {
  const recipient = getRecipients_();

  const subject = '✓ [ทดสอบระบบ] ทดสอบการส่งอีเมล์แจ้งเตือนระบบตรวจเช็ครถโฟล์คลิฟท์ Bitwise';
  const htmlBody = '<div style="font-family:Arial,sans-serif;padding:24px;border:1px solid #e2e8f0;border-radius:10px;max-width:600px;background:#ffffff;">' +
    '<h3 style="color:#1c3a57;margin-top:0;">🚜 ทดสอบระบบส่งอีเมล์แจ้งเตือน (Forklift Inspection)</h3>' +
    '<p>อีเมล์นี้เป็นการทดสอบการส่งอีเมล์อัตโนมัติจาก Google Apps Script ไปยัง <b>' + h_(recipient) + '</b></p>' +
    '<p><b>เวลาทดสอบ:</b> ' + Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy HH:mm:ss') + ' น.</p>' +
    '<div style="background:#f0fff4;border:1px solid #c6f6d5;color:#22543d;padding:12px;border-radius:6px;font-weight:bold;">' +
    '✓ ระบบส่งอีเมล์ทำงานปกติพร้อมรับรายงานการตรวจเช็ค' +
    '</div>' +
    '</div>';

  MailApp.sendEmail({
    to: recipient,
    subject: subject,
    htmlBody: htmlBody,
    body: 'ทดสอบการส่งอีเมล์แจ้งเตือนระบบตรวจเช็ครถโฟล์คลิฟท์ Bitwise ไปยัง ' + recipient + ' สำเร็จ'
  });

  return { ok: true, recipient: recipient, message: 'ส่งอีเมล์ทดสอบไปยัง ' + recipient + ' สำเร็จแล้ว' };
}

function ngText_(json) {
  try {
    const p = JSON.parse(json);
    const its = (p && p.items && Array.isArray(p.items)) ? p.items : [];
    return its.filter(x => x && x.result === 'NG')
      .map(x => (x.point || '') + (x.detail ? ' (' + x.detail + ')' : '')).filter(Boolean).join(', ');
  } catch (e) {
    return '';
  }
}

function cleanText_(json) {
  try {
    const p = JSON.parse(json);
    const c = (p && p.cleaning && Array.isArray(p.cleaning)) ? p.cleaning : [];
    return c.length ? c.filter(x => x && x.done).length + '/' + c.length : '';
  } catch (e) {
    return '';
  }
}

function recentLogs_(maxRows) {
  const sh = sheet_(SH.LOG);
  if (!sh) throw new Error('ไม่พบชีต ' + SH.LOG + ' (กรุณารัน setup() ก่อน)');
  const last = sh.getLastRow();
  if (last < 2) return [];
  const colCount = Math.max(sh.getLastColumn(), HEAD.Inspection_Logs.length);
  let headerRow = 1;
  const topRows = sh.getRange(1, 1, Math.min(last, 5), colCount).getValues();
  for (let i = 0; i < topRows.length; i++) {
    const r = topRows[i].map(s_);
    if (HEAD.Inspection_Logs.some(k => r.indexOf(k) !== -1)) {
      headerRow = i + 1;
      break;
    }
  }
  const headers = topRows[headerRow - 1].map(s_);
  const n = Math.min(maxRows, Math.max(0, last - headerRow));
  if (n <= 0) return [];
  return sh.getRange(last - n + 1, 1, n, colCount).getValues()
    .map(r => {
      const o = {};
      headers.forEach((k, i) => { if (k) o[k] = r[i] instanceof Date ? r[i] : s_(r[i]); });
      o.Timestamp = parseDate_(o.Timestamp);
      return o;
    })
    .filter(r => r.Timestamp)
    .sort((a, b) => a.Timestamp - b.Timestamp);
}

function getDashboard(token) {
  requireAuth_(token);
  const day = d => Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
  const names = nameMap_();
  const fls = rows_(SH.FL);
  const known = {};
  fls.forEach(m => { known[m.Forklift_ID] = true; });
  // นับเฉพาะรถที่ยังมีอยู่ในชีต Forklift (ตัดประวัติของรถที่ถูกลบ/ข้อมูลทดสอบเก่าที่ Forklift_ID ไม่ตรงออก)
  const logs = recentLogs_(DASH_MAX_ROWS).filter(r => known[r.Forklift_ID]);
  const today = day(new Date());
  const days = [];
  for (let i = 6; i >= 0; i--) days.push(day(new Date(Date.now() - i * 864e5)));

  const series = days.map(d => ({ d: d.slice(5), ok: 0, ng: 0 }));
  const latest = {};
  logs.forEach(r => {
    const i = days.indexOf(day(r.Timestamp));
    if (i >= 0) { if (r.Overall_Status === 'NG') series[i].ng++; else series[i].ok++; }
    latest[r.Forklift_ID] = r;
  });

  const forklifts = fls.map(m => {
    const r = latest[m.Forklift_ID];
    return {
      ...typeFields_(m),
      id: m.Forklift_ID,
      name: m.Forklift_Name,
      model: m.Model_Type,
      vehicleType: m.Vehicle_Type || (typeOf_(m).label || ''),
      loc: m.Location,
      capacity: m.Load_Capacity || '',
      owner: names[m.Owner_Emp_ID] || m.Owner_Emp_ID || '',
      last: r ? Utilities.formatDate(r.Timestamp, TZ, 'dd/MM/yy HH:mm') : '-',
      status: r ? r.Overall_Status : '-',
      by: r ? (names[r.Inspector_ID] || r.Inspector_ID) : '',
      ng: r ? ngText_(r.Check_Data_JSON) : '',
      clean: r ? cleanText_(r.Check_Data_JSON) : '',
      checkedToday: r ? day(r.Timestamp) === today : false
    };
  });

  const flname = {};
  forklifts.forEach(m => { flname[m.id] = m.name; });
  const doneToday = forklifts.filter(m => m.checkedToday);

  return {
    total: doneToday.length,
    ngToday: doneToday.filter(m => m.status === 'NG').length,
    pending: forklifts.length - doneToday.length,
    series: series,
    forklifts: forklifts,
    recent: logs.slice(-15).reverse().map(r => ({
      t: Utilities.formatDate(r.Timestamp, TZ, 'dd/MM HH:mm'),
      by: names[r.Inspector_ID] || r.Inspector_ID,
      forkliftId: r.Forklift_ID,
      forklift: flname[r.Forklift_ID] || r.Forklift_ID,
      status: r.Overall_Status,
      ng: ngText_(r.Check_Data_JSON),
      note: r.Remark
    }))
  };
}

const SEED_INSPECT_FORKLIFT = {
  diesel: [
    ['ระบบเครื่องยนต์และระบายความร้อน', '1. ระดับน้ำมันเครื่อง', 'ดึงก้านวัดขณะดับเครื่อง ระดับอยู่ระหว่างขีด Min-Max น้ำมันไม่ดำข้นเหนียวหรือมีตะกอน'],
    ['ระบบเครื่องยนต์และระบายความร้อน', '2. ระดับน้ำหม้อพักน้ำ', 'ระดับน้ำยาหล่อเย็นอยู่ในระดับ Full/Max ฝาปิดแน่นสนิท ครีบหม้อน้ำไม่อุดตัน ไม่มีรอยรั่ว'],
    ['ระบบแบตเตอรี่', '3. แบตเตอรี่', 'ไม่มีรอยแตกร้าว บวม หรือความเสียหายของตัวแบตเตอรี่ ไม่มีคราบขี้เกลือ'],
    ['ระบบไฮดรอลิก', '4. ระดับน้ำมันไฮดรอลิก', 'ตรวจเช็คขณะวางงาแนบพื้นราบ ระดับน้ำมันอยู่ในเกณฑ์ตาแมว/ก้านวัด สีน้ำมันใสไม่ขุ่น'],
    ['ระบบไฮดรอลิก', '5. สภาพสายไฮดรอลิก', 'สายไฮดรอลิคไม่บวม ไม่แตกลายงา ไม่มีรอยเสียดสี ข้อต่อท่อไม่มีน้ำมันซึมออกมา'],
    ['ระบบเสาและอุปกรณ์ยก', '6. เสาและงา', 'งาทั้งสองข้างไม่คดงอหรือแตกร้าว ปลายงาเสมอกัน สลักล็อกงาอยู่ครบ เสาเลื่อนขึ้น-ลงราบเรียบ'],
    ['ระบบเสาและอุปกรณ์ยก', '7. สภาพโซ่', 'โซ่ยกตึงเท่ากันทั้งสองข้าง ไม่หย่อน ข้อต่อโซ่ไม่บิดเบี้ยวหรือตาย มีการหล่อลื่นเหมาะสม'],
    ['ระบบเบรค', '8. ระดับน้ำมันเบรคและคลัตช์', 'ระดับน้ำมันในกระปุกอยู่ในเกณฑ์ที่กำหนด กระปุกไม่แตกร้าว ไม่มีคราบน้ำมันรั่วซึม'],
    ['ระบบเบรค', '9. ระบบเบรค', 'เบรคเท้ากดแล้วหน่วงหยุดได้ดี ไม่จมมิด เบรคมือ/เบรกล็อกล้อทำงานสมบูรณ์ ล็อกรถอยู่สนิท'],
    ['ระบบบังคับเลี้ยวและล้อ', '10. สภาพล้อและยาง', 'หน้ายางไม่ฉีกขาด ไม่มีเศษหิน/โลหะฝัง น็อตล้อขันแน่นครบทุกตัว กระทะล้อไม่บิดเบี้ยว'],
    ['ระบบบังคับเลี้ยวและล้อ', '11. พวงมาลัย', 'บังคับเลี้ยวได้ราบเรียบ ระยะฟรีพวงมาลัยเหมาะสม ลูกบิดพวงมาลัยแน่นหนา ไม่มีเสียงดัง'],
    ['ระบบไฟสัญญาณและอุปกรณ์ความปลอดภัย', '12. ระบบไฟสัญญาณและแตร', 'ไฟหน้า ไฟท้าย ไฟถอย ไฟฉุกเฉิน และแตรทำงานติดครบทุกฟังก์ชัน เสียงดังชัดเจน'],
    ['ระบบไฟสัญญาณและอุปกรณ์ความปลอดภัย', '13. กระจกมองข้าง', 'กระจกซ้าย-ขวาไม่แตกหรือมัว ปรับมุมมองเห็นด้านหลังได้ชัดเจน ขาจับแน่นไม่สั่นคลอน'],
    ['ระบบไฟสัญญาณและอุปกรณ์ความปลอดภัย', '14. เข็มขัดนิรภัย', 'สายเข็มขัดไม่ฉีกขาด กลไกดึงล็อกกระตุกทำงานดี หัวล็อกแน่นไม่หลุดเอง']
  ],

  'petrol+LPG': [
    ['ระบบเครื่องยนต์และระบายความร้อน', '1. ระดับน้ำมันเครื่อง', 'ดึงก้านวัดขณะดับเครื่อง ระดับอยู่ระหว่างขีด Min-Max น้ำมันไม่ดำข้นเหนียวหรือมีตะกอน'],
    ['ระบบเครื่องยนต์และระบายความร้อน', '2. ระดับน้ำหม้อพักน้ำ', 'ระดับน้ำยาหล่อเย็นอยู่ในระดับ Full/Max ฝาปิดแน่นสนิท ครีบหม้อน้ำไม่อุดตัน ไม่มีรอยรั่ว'],
    ['ระบบแบตเตอรี่', '3. แบตเตอรี่', 'ไม่มีรอยแตกร้าว บวม หรือความเสียหายของตัวแบตเตอรี่ ไม่มีคราบขี้เกลือ'],
    ['ระบบไฮดรอลิก', '4. ระดับน้ำมันไฮดรอลิก', 'ตรวจเช็คขณะวางงาแนบพื้นราบ ระดับน้ำมันอยู่ในเกณฑ์ตาแมว/ก้านวัด สีน้ำมันใสไม่ขุ่น'],
    ['ระบบไฮดรอลิก', '5. สภาพสายไฮดรอลิก', 'สายไฮดรอลิคไม่บวม ไม่แตกลายงา ไม่มีรอยเสียดสี ข้อต่อท่อไม่มีน้ำมันซึมออกมา'],
    ['ระบบเสาและอุปกรณ์ยก', '6. เสาและงา', 'งาทั้งสองข้างไม่คดงอหรือแตกร้าว ปลายงาเสมอกัน สลักล็อกงาอยู่ครบ เสาเลื่อนขึ้น-ลงราบเรียบ'],
    ['ระบบเสาและอุปกรณ์ยก', '7. สภาพโซ่', 'โซ่ยกตึงเท่ากันทั้งสองข้าง ไม่หย่อน ข้อต่อโซ่ไม่บิดเบี้ยวหรือตาย มีการหล่อลื่นเหมาะสม'],
    ['ระบบเบรค', '8. ระดับน้ำมันเบรคและคลัตช์', 'ระดับน้ำมันในกระปุกอยู่ในเกณฑ์ที่กำหนด กระปุกไม่แตกร้าว ไม่มีคราบน้ำมันรั่วซึม'],
    ['ระบบเบรค', '9. ระบบเบรค', 'เบรคเท้ากดแล้วหน่วงหยุดได้ดี ไม่จมมิด เบรคมือ/เบรกล็อกล้อทำงานสมบูรณ์ ล็อกรถอยู่สนิท'],
    ['ระบบบังคับเลี้ยวและล้อ', '10. สภาพล้อและยาง', 'หน้ายางไม่ฉีกขาด ไม่มีเศษหิน/โลหะฝัง น็อตล้อขันแน่นครบทุกตัว กระทะล้อไม่บิดเบี้ยว'],
    ['ระบบบังคับเลี้ยวและล้อ', '11. พวงมาลัย', 'บังคับเลี้ยวได้ราบเรียบ ระยะฟรีพวงมาลัยเหมาะสม ลูกบิดพวงมาลัยแน่นหนา ไม่มีเสียงดัง'],
    ['ระบบไฟสัญญาณและอุปกรณ์ความปลอดภัย', '12. ระบบไฟสัญญาณและแตร', 'ไฟหน้า ไฟท้าย ไฟถอย ไฟฉุกเฉิน และแตรทำงานติดครบทุกฟังก์ชัน เสียงดังชัดเจน'],
    ['ระบบไฟสัญญาณและอุปกรณ์ความปลอดภัย', '13. กระจกมองข้าง', 'กระจกซ้าย-ขวาไม่แตกหรือมัว ปรับมุมมองเห็นด้านหลังได้ชัดเจน ขาจับแน่นไม่สั่นคลอน'],
    ['ระบบไฟสัญญาณและอุปกรณ์ความปลอดภัย', '14. เข็มขัดนิรภัย', 'สายเข็มขัดไม่ฉีกขาด กลไกดึงล็อกกระตุกทำงานดี หัวล็อกแน่นไม่หลุดเอง'],
    ['ระบบเชื้อเพลิง LPG', '15. สภาพถังก๊าซ', 'ต้องไม่มีร่องรอยบุบ แตก สนิม หรือความเสียหายของถังก๊าซ'],
    ['ระบบเชื้อเพลิง LPG', '16. การยึดถังก๊าซ', 'ถังอยู่ในตำแหน่งที่ถูกต้องและอุปกรณ์ยึดถังอยู่ในสภาพสมบูรณ์'],
    ['ระบบเชื้อเพลิง LPG', '17. สภาพสายส่งก๊าซ', 'ต้องไม่มีรอยแตกร้าว ฉีกขาด บิดงอ หรือเสื่อมสภาพของสาย'],
    ['ระบบเชื้อเพลิง LPG', '18. ข้อต่อและอุปกรณ์เชื่อมต่อก๊าซ', 'ต้องไม่มีรอยแตกร้าว บิดเบี้ยว ไม่หลวม อยู่ในสภาพสมบูรณ์ ซีลไม่ฉีกขาดหรือเสื่อมสภาพ'],
    ['ระบบเชื้อเพลิง LPG', '19. การรั่วซึมของก๊าซ', 'ต้องไม่มีกลิ่นก๊าซหรือสัญญาณผิดปกติที่อาจบ่งชี้ว่ามีก๊าซรั่ว'],
    ['ระบบเชื้อเพลิง LPG', '20. มาตรวัดระดับก๊าซ', 'หน้าปัดไม่แตกร้าว ขุ่นมัว เข็มไม่หัก หรือค้างผิดปกติ ระดับก๊าซเพียงพอต่อการใช้งาน']
  ],

  engine: [
    ['ระบบเครื่องยนต์และระบายความร้อน', '1. ระดับน้ำมันเครื่อง', 'ดึงก้านวัดขณะดับเครื่อง ระดับอยู่ระหว่างขีด Min-Max น้ำมันไม่ดำข้นเหนียวหรือมีตะกอน'],
    ['ระบบเครื่องยนต์และระบายความร้อน', '2. ระดับน้ำหม้อพักน้ำ', 'ระดับน้ำยาหล่อเย็นอยู่ในระดับ Full/Max ฝาปิดแน่นสนิท ครีบหม้อน้ำไม่อุดตัน ไม่มีรอยรั่ว'],
    ['ระบบแบตเตอรี่', '3. แบตเตอรี่', 'ไม่มีรอยแตกร้าว บวม หรือความเสียหายของตัวแบตเตอรี่ ไม่มีคราบขี้เกลือ'],
    ['ระบบไฮดรอลิก', '4. ระดับน้ำมันไฮดรอลิก', 'ตรวจเช็คขณะวางงาแนบพื้นราบ ระดับน้ำมันอยู่ในเกณฑ์ตาแมว/ก้านวัด สีน้ำมันใสไม่ขุ่น'],
    ['ระบบไฮดรอลิก', '5. สภาพสายไฮดรอลิก', 'สายไฮดรอลิคไม่บวม ไม่แตกลายงา ไม่มีรอยเสียดสี ข้อต่อท่อไม่มีน้ำมันซึมออกมา'],
    ['ระบบเสาและอุปกรณ์ยก', '6. เสาและงา', 'งาทั้งสองข้างไม่คดงอหรือแตกร้าว ปลายงาเสมอกัน สลักล็อกงาอยู่ครบ เสาเลื่อนขึ้น-ลงราบเรียบ'],
    ['ระบบเสาและอุปกรณ์ยก', '7. สภาพโซ่', 'โซ่ยกตึงเท่ากันทั้งสองข้าง ไม่หย่อน ข้อต่อโซ่ไม่บิดเบี้ยวหรือตาย มีการหล่อลื่นเหมาะสม'],
    ['ระบบเบรค', '8. ระดับน้ำมันเบรคและคลัตช์', 'ระดับน้ำมันในกระปุกอยู่ในเกณฑ์ที่กำหนด กระปุกไม่แตกร้าว ไม่มีคราบน้ำมันรั่วซึม'],
    ['ระบบเบรค', '9. ระบบเบรค', 'เบรคเท้ากดแล้วหน่วงหยุดได้ดี ไม่จมมิด เบรคมือ/เบรกล็อกล้อทำงานสมบูรณ์ ล็อกรถอยู่สนิท'],
    ['ระบบบังคับเลี้ยวและล้อ', '10. สภาพล้อและยาง', 'หน้ายางไม่ฉีกขาด ไม่มีเศษหิน/โลหะฝัง น็อตล้อขันแน่นครบทุกตัว กระทะล้อไม่บิดเบี้ยว'],
    ['ระบบบังคับเลี้ยวและล้อ', '11. พวงมาลัย', 'บังคับเลี้ยวได้ราบเรียบ ระยะฟรีพวงมาลัยเหมาะสม ลูกบิดพวงมาลัยแน่นหนา ไม่มีเสียงดัง'],
    ['ระบบไฟสัญญาณและอุปกรณ์ความปลอดภัย', '12. ระบบไฟสัญญาณและแตร', 'ไฟหน้า ไฟท้าย ไฟถอย ไฟฉุกเฉิน และแตรทำงานติดครบทุกฟังก์ชัน เสียงดังชัดเจน'],
    ['ระบบไฟสัญญาณและอุปกรณ์ความปลอดภัย', '13. กระจกมองข้าง', 'กระจกซ้าย-ขวาไม่แตกหรือมัว ปรับมุมมองเห็นด้านหลังได้ชัดเจน ขาจับแน่นไม่สั่นคลอน'],
    ['ระบบไฟสัญญาณและอุปกรณ์ความปลอดภัย', '14. เข็มขัดนิรภัย', 'สายเข็มขัดไม่ฉีกขาด กลไกดึงล็อกกระตุกทำงานดี หัวล็อกแน่นไม่หลุดเอง']
  ],

  reach_truck: [
    ['ระบบแบตเตอรี่และการชาร์จไฟ', '1. ระดับน้ำกลั่นแบตเตอร์รี่', 'ลูกลอยวัดระดับน้ำกลั่นลอยปกติ อยู่ระหว่างค่า Max-Min'],
    ['ระบบแบตเตอรี่และการชาร์จไฟ', '2. ขั้วแบตเตอร์รี่', 'ขั้วต่อแน่น สะอาด ปราศจากคราบขี้เกลือสะสม ฝาครอบขั้วปิดเรียบร้อย'],
    ['ระบบแบตเตอรี่และการชาร์จไฟ', '3. ปลั๊กชาร์จไฟ', 'หัวปลั๊ก (Connector) ไม่แตกร้าว ขั้วทองแดงด้านในไม่ไหม้เกรียม เสียบต่อแน่นหนา'],
    ['ระบบเสาและอุปกรณ์ยก', '4. เสาและงา', 'งาไม่คดงอหรือแตกร้าว ปลายงาได้ระดับระนาบเดียวกัน สลักล็อกงาล็อกแน่น เสายกไม่ติดขัด'],
    ['ระบบเสาและอุปกรณ์ยก', '5. สภาพโซ่', 'ความตึงโซ่ยกต้องเท่ากันทั้ง 2 ข้าง ไม่หย่อน มีการหล่อลื่นเหมาะสม'],
    ['ระบบล้อและยาง', '6. สภาพล้อ + ยาง', 'ยางตัน/ยางโพลียูรีเทนไม่แตกบิ่น ไม่แตกลายงา น็อตขันแน่นครบทุกตัว'],
    ['ระบบไฮดรอลิก', '7. ระดับน้ำมันไฮดรอลิค', 'วางงาลงต่ำสุด เช็คระดับน้ำมันในถังไฮดรอลิคให้อยู่ในขีดปกติ Max-Min ไม่มีคราบรั่วซึม'],
    ['ระบบไฮดรอลิก', '8. สภาพสายไฮดรอลิค', 'สายไฮดรอลิคไม่ปริแตก ไม่บวม ข้อต่อท่อไม่มีน้ำมันหยดหรือซึม'],
    ['ระบบไฟสัญญาณและอุปกรณ์เตือน', '9. ระบบไฟสัญญาณ + แตร', 'ไฟส่องสว่างหน้า ไฟถอย ไฟกะพริบเตือน และแตรทำงานปกติทุกฟังก์ชัน เสียงชัดเจน'],
    ['ระบบเบรค', '10. ระบบเบรค', 'แป้นเบรคทำงานปกติ ระบบเบรคไฟฟ้า/เบรคมือล็อกอยู่สนิทเมื่อจอดหรือปล่อยคันเร่ง']
  ],

  walkie_stacker: [
    ['ระบบแบตเตอรี่และการชาร์จไฟ', '1. ระดับน้ำกลั่นแบตเตอรี่', 'ลูกลอยวัดระดับน้ำกลั่นลอยปกติ อยู่ระหว่างค่า Max-Min (เฉพาะแบตเตอรี่ชนิดที่ต้องเติมน้ำกลั่น)'],
    ['ระบบแบตเตอรี่และการชาร์จไฟ', '2. ขั้วแบตเตอรี่', 'ต้องสะอาดยึดแน่น ไม่มีร่องรอยการไหม้'],
    ['ระบบแบตเตอรี่และการชาร์จไฟ', '3. ปลั๊กชาร์จไฟ', 'ต้องอยู่ในสภาพเรียบร้อยไม่แตก'],
    ['ระบบเสาและอุปกรณ์ยก', '4. เสาและงา', 'ต้องอยู่ในสภาพที่มั่นคงและแข็งแรง'],
    ['ระบบเสาและอุปกรณ์ยก', '5. สภาพโซ่', 'ความตึงโซ่ต้องเท่ากันทั้ง 2 ข้าง'],
    ['ระบบล้อและยาง', '6. สภาพล้อ + ยาง', 'ต้องไม่แตกและอยู่ในสภาพที่ใช้งานได้'],
    ['ระบบไฟสัญญาณและอุปกรณ์เตือน', '7. ระบบไฟสัญญาณ + แตร', 'ไฟต้องติดทุกดวง สัญญาณแตรต้องดัง'],
    ['ระบบเบรค', '8. ระบบเบรค', 'ต้องใช้งานได้ดีและเบรคต้องอยู่'],
    ['ระบบควบคุมการขับเคลื่อน', '9. แฮนด์บังคับและปุ่มควบคุมทิศทาง', 'ต้องอยู่ในสภาพสมบูรณ์ ไม่แตกหักหรือหลวม ทำงานได้ตามปกติ'],
    ['ระบบความปลอดภัย', '10. ปุ่มป้องกันการชน', 'สามารถสั่งให้รถหยุดหรือเคลื่อนที่ออกจากผู้ใช้งานได้ตามปกติ']
  ],

  electric: [
    ['ระบบแบตเตอรี่และการชาร์จไฟ', '1. ระดับน้ำกลั่นแบตเตอร์รี่', 'ลูกลอยวัดระดับน้ำกลั่นลอยปกติ อยู่ระหว่างค่า Max-Min'],
    ['ระบบแบตเตอรี่และการชาร์จไฟ', '2. ขั้วแบตเตอร์รี่', 'ขั้วต่อแน่น สะอาด ปราศจากคราบขี้เกลือสะสม ฝาครอบขั้วปิดเรียบร้อย'],
    ['ระบบแบตเตอรี่และการชาร์จไฟ', '3. ปลั๊กชาร์จไฟ', 'หัวปลั๊ก (Connector) ไม่แตกร้าว ขั้วทองแดงด้านในไม่ไหม้เกรียม เสียบต่อแน่นหนา'],
    ['ระบบเสาและอุปกรณ์ยก', '4. เสาและงา', 'งาไม่คดงอหรือแตกร้าว ปลายงาได้ระดับระนาบเดียวกัน สลักล็อกงาล็อกแน่น เสายกไม่ติดขัด'],
    ['ระบบเสาและอุปกรณ์ยก', '5. สภาพโซ่', 'ความตึงโซ่ยกต้องเท่ากันทั้ง 2 ข้าง ไม่หย่อน มีการหล่อลื่นเหมาะสม'],
    ['ระบบล้อและยาง', '6. สภาพล้อ + ยาง', 'ยางตัน/ยางโพลียูรีเทนไม่แตกบิ่น ไม่แตกลายงา น็อตขันแน่นครบทุกตัว'],
    ['ระบบไฮดรอลิก', '7. ระดับน้ำมันไฮดรอลิค', 'วางงาลงต่ำสุด เช็คระดับน้ำมันในถังไฮดรอลิคให้อยู่ในขีดปกติ Max-Min ไม่มีคราบรั่วซึม'],
    ['ระบบไฮดรอลิก', '8. สภาพสายไฮดรอลิค', 'สายไฮดรอลิคไม่ปริแตก ไม่บวม ข้อต่อท่อไม่มีน้ำมันหยดหรือซึม'],
    ['ระบบไฟสัญญาณและอุปกรณ์เตือน', '9. ระบบไฟสัญญาณ + แตร', 'ไฟส่องสว่างหน้า ไฟถอย ไฟกะพริบเตือน และแตรทำงานปกติทุกฟังก์ชัน เสียงชัดเจน'],
    ['ระบบเบรค', '10. ระบบเบรค', 'แป้นเบรคทำงานปกติ ระบบเบรคไฟฟ้า/เบรคมือล็อกอยู่สนิทเมื่อจอดหรือปล่อยคันเร่ง']
  ]
};

const SEED_IMG_FORKLIFT = {
  diesel: [
    'Forklift-diesel/Forklift-diesel-Engine-oil-level.jpg',
    'Forklift-diesel/Forklift-diesel-Coolant-reservoir-level.jpg',
    'Forklift-diesel/Forklift-diesel-battery.jpg',
    'Forklift-diesel/Forklift-diesel-Hydraulic-oil-level.jpg',
    'Forklift-diesel/Forklift-diesel-Condition-of-the-hydraulic-hose.jpg',
    'Forklift-diesel/Forklift-diesel-Mast-and-forks.jpg',
    'Forklift-diesel/Forklift-diesel-Chain-condition.jpg',
    'Forklift-diesel/Forklift-diesel-Brake-and-clutch-fluid-level.jpg',
    'Forklift-diesel/Forklift-diesel-Brake-system.jpg',
    'Forklift-diesel/Forklift-diesel-Condition-of-wheels-and-tires.jpg',
    'Forklift-diesel/Forklift-diesel-steering-wheel.jpg',
    'Forklift-diesel/Forklift-diesel-Signal-lights-and-horn.jpg',
    'Forklift-diesel/Forklift-diesel-Side-view-mirror.jpg',
    'Forklift-diesel/Forklift-diesel-Seat-belt.jpg'
  ],
  'petrol+LPG': [
    'Forklift-petrol+LPG/Forklift-petrol+LPG-Engine-oil-level.jpg',
    'Forklift-petrol+LPG/Forklift-petrol+LPG-Coolant-reservoir-level.jpg',
    'Forklift-petrol+LPG/Forklift-petrol+LPG-battery.jpg',
    'Forklift-petrol+LPG/Forklift-petrol+LPG-Hydraulic-oil-level.jpg',
    'Forklift-petrol+LPG/Forklift-petrol+LPG-Condition-of-the-hydraulic-hose.jpg',
    'Forklift-petrol+LPG/Forklift-petrol+LPG-Mast-and-forks.jpg',
    'Forklift-petrol+LPG/Forklift-petrol+LPG-Chain-condition.jpg',
    'Forklift-petrol+LPG/Forklift-petrol+LPG-Brake-and-clutch-fluid-level.jpg',
    'Forklift-petrol+LPG/Forklift-petrol+LPG-Brake-system.jpg',
    'Forklift-petrol+LPG/Forklift-petrol+LPG-Wheels-and-tires.jpg',
    'Forklift-petrol+LPG/Forklift-petrol+LPG-steering-wheel.jpg',
    'Forklift-petrol+LPG/Forklift-petrol+LPG-Signal-and-horn.jpg',
    'Forklift-petrol+LPG/Forklift-petrol+LPG-Side-view-mirror.jpg',
    'Forklift-petrol+LPG/Forklift-petrol+LPG-Seat-belt.jpg',
    'Forklift-petrol+LPG/Forklift-petrol+LPG-Gas.jpg',
    'Forklift-petrol+LPG/Forklift-petrol+LPG-Securing-gas.jpg',
    'Forklift-petrol+LPG/Forklift-petrol+LPG-Gas-pipeline.jpg',
    'Forklift-petrol+LPG/Gas-fittings-and-connection.jpg',
    'Forklift-petrol+LPG/Forklift-petrol+LPG-Gas-leakage.jpg',
    'Forklift-petrol+LPG/Forklift-petrol+LPG-Gas-level-gauge.jpg'
  ],
  engine: [
    'Forklift-diesel/Forklift-diesel-Engine-oil-level.jpg',
    'Forklift-diesel/Forklift-diesel-Coolant-reservoir-level.jpg',
    'Forklift-diesel/Forklift-diesel-battery.jpg',
    'Forklift-diesel/Forklift-diesel-Hydraulic-oil-level.jpg',
    'Forklift-diesel/Forklift-diesel-Condition-of-the-hydraulic-hose.jpg',
    'Forklift-diesel/Forklift-diesel-Mast-and-forks.jpg',
    'Forklift-diesel/Forklift-diesel-Chain-condition.jpg',
    'Forklift-diesel/Forklift-diesel-Brake-and-clutch-fluid-level.jpg',
    'Forklift-diesel/Forklift-diesel-Brake-system.jpg',
    'Forklift-diesel/Forklift-diesel-Condition-of-wheels-and-tires.jpg',
    'Forklift-diesel/Forklift-diesel-steering-wheel.jpg',
    'Forklift-diesel/Forklift-diesel-Signal-lights-and-horn.jpg',
    'Forklift-diesel/Forklift-diesel-Side-view-mirror.jpg',
    'Forklift-diesel/Forklift-diesel-Seat-belt.jpg'
  ],
  reach_truck: [
    'Electric-Reach-Truck/electric-battery-water.jpg',
    'Electric-Reach-Truck/electric-battery-terminal.jpg',
    'Electric-Reach-Truck/electric-charge-plug.jpg',
    'Electric-Reach-Truck/electric-mast-forks.jpg',
    'Electric-Reach-Truck/electric-chain.jpg',
    'Electric-Reach-Truck/electric-wheel-tire.jpg',
    'Electric-Reach-Truck/electric-hydraulic-oil.jpg',
    'Electric-Reach-Truck/electric-hydraulic-hose.jpg',
    'Electric-Reach-Truck/electric-lights-horn.jpg',
    'Electric-Reach-Truck/electric-brake.jpg'
  ],
  walkie_stacker: [
    'Electric-Walkie-stacker/Electric-Walkie-stacker-v.1/Distilled-water-level-battery.jpg',
    'Electric-Walkie-stacker/Electric-Walkie-stacker-v.1/Battery-terminal.jpg',
    'Electric-Walkie-stacker/Electric-Walkie-stacker-v.1/Charging-plug.jpg',
    'Electric-Walkie-stacker/Electric-Walkie-stacker-v.1/Forks.jpg',
    'Electric-Walkie-stacker/Electric-Walkie-stacker-v.2/chain.jpg',
    'Electric-Walkie-stacker/Electric-Walkie-stacker-v.1/Wheels+Tires.jpg',
    'Electric-Walkie-stacker/Electric-Walkie-stacker-v.1/Signal lights+horn.jpg',
    'Electric-Walkie-stacker/Electric-Walkie-stacker-v.1/Brake-system.jpg',
    'Electric-Walkie-stacker/Electric-Walkie-stacker-v.1/Forward–reverse-control-button.jpg',
    'Electric-Walkie-stacker/Electric-Walkie-stacker-v.1/Anti-collision-button.jpg'
  ],
  electric: [
    'Electric-Reach-Truck/electric-battery-water.jpg',
    'Electric-Reach-Truck/electric-battery-terminal.jpg',
    'Electric-Reach-Truck/electric-charge-plug.jpg',
    'Electric-Reach-Truck/electric-mast-forks.jpg',
    'Electric-Reach-Truck/electric-chain.jpg',
    'Electric-Reach-Truck/electric-wheel-tire.jpg',
    'Electric-Reach-Truck/electric-hydraulic-oil.jpg',
    'Electric-Reach-Truck/electric-hydraulic-hose.jpg',
    'Electric-Reach-Truck/electric-lights-horn.jpg',
    'Electric-Reach-Truck/electric-brake.jpg'
  ]
};

const SEED_CLEAN_FORKLIFT = [
  ['ความปลอดภัยก่อนเริ่ม', 'ดับเครื่องยนต์/ปิดสวิตช์กุญแจ และดึงเบรคมือ (ถอดปลั๊กแบตเตอรี่กรณีรถไฟฟ้า)', 'ปิดกุญแจ ดึงเบรคมือ และติดป้ายห้ามใช้งานขณะทำความสะอาด', 'กุญแจรถ / ป้ายเตือน'],
  ['ห้องคนขับและเบาะนั่ง', 'เช็ดทำความสะอาดพวงมาลัย เบาะนั่ง คอนโซล และเข็มขัดนิรภัย', 'ใช้ผ้าชุบน้ำหมาดหรือน้ำยาทำความสะอาด เช็ดคราบเหงื่อและฝุ่น', 'ผ้าสะอาด / น้ำยาทำความสะอาด'],
  ['ระบบระบายความร้อน', 'เป่าฝุ่นและสิ่งสกปรกที่แผงรังผึ้งหม้อน้ำหรือช่องระบายอากาศแบตเตอรี่', 'ใช้ปืนลมแรงดันต่ำเป่าฝุ่นย้อนทาง สวมแว่นตานิรภัย', 'ปืนลม / แว่นตานิรภัย'],
  ['เสาและชุดยก', 'เช็ดคราบน้ำมันและสิ่งสกปรกที่เสายกและบริเวณงา', 'ใช้ผ้าแห้งเช็ดคราบน้ำมันส่วนเกินและฝุ่นทราย ห้ามใช้มือเปล่าจับร่องเสา', 'ผ้าเช็ด / ถุงมือกันบาด'],
  ['ล้อและเพลาขับ', 'ตรวจและดึงเศษเชือก เศษพลาสติก หรือลวดที่พันรอบแกนล้อออก', 'ใช้คีมหรือกรรไกรตัดเศษที่พันรอบแกนล้อเพื่อป้องกันซีลล้อชำรุด', 'คีม / ถุงมือ']
];

function seedForkliftSample(force) {
  setup();
  const empSh = sheet_(SH.EMP);
  if (empSh.getLastRow() < 2) {
    if (empSh.getMaxRows() < 11) empSh.insertRowsAfter(empSh.getMaxRows(), 11 - empSh.getMaxRows());
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
    if (flSh.getMaxRows() < 11) flSh.insertRowsAfter(flSh.getMaxRows(), 11 - flSh.getMaxRows());
    flSh.getRange(2, 1, 9, 8).setValues([
      ['FL-01', 'โฟล์คลิฟท์เครื่องยนต์ #1', 'ดีเซล', 'คลังวัตถุดิบ อาคาร A', 'EMP-001', 'คลังสินค้าวัตถุดิบ', '3 ตัน', 'รถยกประเภท Counter balance'],
      ['FL-02', 'โฟล์คลิฟท์เครื่องยนต์ #2', 'ดีเซล', 'ลานกองวัตถุดิบกลางแจ้ง', 'EMP-002', 'คลังสินค้าวัตถุดิบ', '3 ตัน', 'รถยกประเภท Counter balance'],
      ['FL-03', 'โฟล์คลิฟท์ไฟฟ้า Reach Truck #1', 'ไฟฟ้า', 'คลังสินค้าสำเร็จรูป ชั้น 1', 'EMP-003', 'คลังสินค้าสำเร็จรูป', '2 ตัน', 'รถยกประเภท Reach truck'],
      ['FL-04', 'โฟล์คลิฟท์ไฟฟ้า Walkie Stacker #1', 'ไฟฟ้า', 'พื้นที่แพ็คเกจจิ้งและจัดเก็บ', 'EMP-004', 'คลังสินค้าสำเร็จรูป', '1.5 ตัน', 'รถยกประเภท Walkie stacker'],
      ['FL-05', 'โฟล์คลิฟท์เครื่องยนต์ #3', 'ดีเซล', 'ลานโหลดสินค้าและตู้คอนเทนเนอร์', 'EMP-005', 'แผนกจัดส่งและโลจิสติกส์', '3 ตัน', 'รถยกประเภท Counter balance'],
      ['FL-06', 'โฟล์คลิฟท์ไฟฟ้า Reach Truck #2', 'ไฟฟ้า', 'อาคารพักสินค้าเตรียมส่งมอบ', 'EMP-006', 'แผนกจัดส่งและโลจิสติกส์', '2 ตัน', 'รถยกประเภท Reach truck'],
      ['FL-07', 'โฟล์คลิฟท์เครื่องยนต์ #4', 'ดีเซล', 'พื้นที่ลำเลียงและป้อนวัตถุดิบไลน์ผลิต', 'EMP-007', 'แผนกผลิตและแปรรูป', '3 ตัน', 'รถยกประเภท Counter balance'],
      ['FL-08', 'โฟล์คลิฟท์ไฟฟ้า Walkie Stacker #2', 'ไฟฟ้า', 'โรงจอดซ่อมบำรุงและรถสำรอง', 'EMP-008', 'แผนกซ่อมบำรุง', '1 ตัน', 'รถยกประเภท Walkie stacker'],
      ['FL-09', 'โฟล์คลิฟท์แก๊ส #1', 'LPG', 'พื้นที่ลำเลียงวัตถุดิบไลน์ผลิต 2', 'EMP-007', 'แผนกผลิตและแปรรูป', '2.5 ตัน', 'รถยกประเภท Counter balance']
    ]);
  }

  const ms = rows_(SH.FL);
  const clSh = sheet_(SH.CL);
  const cnSh = sheet_(SH.CLN);

  if (s_(clSh.getRange(1, 6).getValue()) !== 'Image_File') {
    clSh.getRange(1, 6).setValue('Image_File')
      .setFontWeight('bold').setBackground('#1c3a57').setFontColor('#ffffff');
  }

  if (!force && (clSh.getLastRow() > 1 || cnSh.getLastRow() > 1)) {
    throw new Error('ชีต Checklist/Cleaning มีข้อมูลอยู่แล้ว ถ้าต้องการล้างและสร้างใหม่ให้รัน seedForkliftSampleForce');
  }
  if (clSh.getLastRow() > 1) clSh.deleteRows(2, clSh.getLastRow() - 1);
  if (cnSh.getLastRow() > 1) cnSh.deleteRows(2, cnSh.getLastRow() - 1);

  const clRows = [];
  const cnRows = [];

  ms.forEach(m => {
    const sub = subtypeOf_(m);
    const kind = kindOf_(m);
    const inspectList = SEED_INSPECT_FORKLIFT[sub] || (kind === 'electric' ? SEED_INSPECT_FORKLIFT.reach_truck : SEED_INSPECT_FORKLIFT.engine);
    const imgList = SEED_IMG_FORKLIFT[sub] || (kind === 'electric' ? SEED_IMG_FORKLIFT.reach_truck : SEED_IMG_FORKLIFT.engine);

    inspectList.forEach((it, idx) => {
      clRows.push([
        m.Forklift_ID + '-CHK-' + String(idx + 1).padStart(2, '0'),
        m.Forklift_ID,
        it[0],
        it[1],
        it[2],
        imgList[idx] || ''
      ]);
    });

    SEED_CLEAN_FORKLIFT.forEach((c, idx) => {
      cnRows.push([
        m.Forklift_ID + '-CLN-' + String(idx + 1).padStart(2, '0'),
        m.Forklift_ID,
        c[0],
        c[1],
        c[2],
        c[3]
      ]);
    });
  });

  if (clRows.length) {
    const reqCl = clRows.length + 1;
    if (clSh.getMaxRows() < reqCl) clSh.insertRowsAfter(clSh.getMaxRows(), reqCl - clSh.getMaxRows());
    clSh.getRange(2, 1, clRows.length, 6).setValues(clRows);
  }

  if (cnRows.length) {
    const reqCn = cnRows.length + 1;
    if (cnSh.getMaxRows() < reqCn) cnSh.insertRowsAfter(cnSh.getMaxRows(), reqCn - cnSh.getMaxRows());
    cnSh.getRange(2, 1, cnRows.length, 6).setValues(cnRows);
  }
}

function seedForkliftSampleForce() {
  seedForkliftSample(true);
}

function seedTestData() {
  setup();
  const fls = rows_(SH.FL), cls = rows_(SH.CL);
  if (!fls.length) throw new Error('ยังไม่มีรถในชีต Forklift (กรุณารัน seedForkliftSample ก่อน)');
  const out = [];
  for (let back = 6; back >= 0; back--) {
    fls.forEach((m, fi) => {
      if (back > 0 && (back + fi) % 5 === 4) return;
      const items = checklistFor_(m, cls, fls);
      if (!items.length) return;
      const ngIdx = ((back + fi) % 4 === 0) ? (fi + back) % items.length : -1;
      const data = items.map((c, i) => {
        const row = { id: c.Item_ID, cat: c.Category || 'ทั่วไป', point: c.Inspection_Point, std: c.Standard_Criteria || '', result: i === ngIdx ? 'NG' : 'OK' };
        if (i === ngIdx) row.detail = 'ข้อมูลทดสอบ: พบความผิดปกติ ต้องตรวจซ่อม';
        return row;
      });
      const ng = ngIdx >= 0 ? data[ngIdx] : null;
      out.push([
        new Date(Date.now() - back * 864e5 - (fi + 1) * 600000),
        m.Forklift_ID, m.Owner_Emp_ID, m.Owner_Emp_ID,
        ng ? 'NG' : 'OK',
        JSON.stringify({ items: data, cleaning: [] }),
        ng ? safeCell_(ng.point + ': ' + ng.detail) : ''
      ]);
    });
  }
  const sh = sheet_(SH.LOG);
  const start = sh.getLastRow() + 1;
  const needed = start + out.length - 1;
  if (sh.getMaxRows() < needed) sh.insertRowsAfter(sh.getMaxRows(), needed - sh.getMaxRows());
  sh.getRange(start, 1, out.length, 7).setValues(out);
  sh.getRange(start, 1, out.length, 1).setNumberFormat('dd/MM/yyyy HH:mm');
  Logger.log('เพิ่มข้อมูลทดสอบ ' + out.length + ' รายการ');
}

function checkData() {
  const issues = [];
  const emps = rows_(SH.EMP), fls = rows_(SH.FL), cl = rows_(SH.CL);
  const eid = {}, flid = {}, seen = {};
  emps.forEach(e => { eid[e.Employee_ID] = 1; });
  fls.forEach(m => { flid[m.Forklift_ID] = 1; });

  fls.forEach(m => {
    const dispType = m.Vehicle_Type || m.Model_Type;
    if (typeOf_(m).key === 'other') issues.push('รถ ' + m.Forklift_ID + ' มีประเภท "' + dispType + '" ที่ระบบยังไม่รู้จัก (ใช้ชุดเครื่องยนต์เป็นค่าเริ่มต้น — เพิ่มประเภทใหม่ในตาราง FORKLIFT_TYPES)');
    if (!eid[m.Owner_Emp_ID]) issues.push('รถ ' + m.Forklift_ID + ' มี Owner ที่ไม่อยู่ใน Employees');
    if (!cl.some(c => c.Forklift_ID === m.Forklift_ID)) issues.push('รถ ' + m.Forklift_ID + ' ยังไม่มีรายการตรวจของตัวเอง (ระบบจะใช้ชุดมาตรฐานตามประเภท ' + dispType + ' ให้อัตโนมัติ)');
    else if (!itemsMatchSubtype_(cl.filter(c => c.Forklift_ID === m.Forklift_ID), subtypeOf_(m))) issues.push('รถ ' + m.Forklift_ID + ' (' + dispType + ') มีรายการตรวจไม่ตรงประเภทย่อย (ระบบจะใช้ชุดมาตรฐานตามประเภทแทน)');
  });
  cl.forEach(c => {
    if (!flid[c.Forklift_ID]) issues.push('Checklist ' + c.Item_ID + ' อ้างอิงรถ ' + c.Forklift_ID + ' ที่ไม่มีในชีต Forklift');
    if (seen[c.Item_ID]) issues.push('Item_ID ซ้ำใน Checklist: ' + c.Item_ID + ' (ผลตรวจจะทับกัน)');
    seen[c.Item_ID] = 1;
  });

  const msg = issues.length ? 'พบ ' + issues.length + ' ประเด็น:\n- ' + issues.join('\n- ') : 'ข้อมูลถูกต้องสมบูรณ์';
  Logger.log(msg);
  return issues;
}

function populateChecklistImages() {
  const clSh = sheet_(SH.CL);
  if (!clSh) throw new Error('ไม่พบชีต ' + SH.CL);
  const fls = rows_(SH.FL);
  const flMap = {};
  fls.forEach(m => { flMap[m.Forklift_ID] = subtypeOf_(m); });

  const lastRow = clSh.getLastRow();
  if (lastRow < 2) return 'ไม่มีข้อมูลใน Checklist';
  const data = clSh.getRange(2, 1, lastRow - 1, 6).getValues();
  let updatedCount = 0;

  for (let i = 0; i < data.length; i++) {
    const flId = s_(data[i][1]);
    const point = s_(data[i][3]);
    const curImg = s_(data[i][5]);
    const sub = flMap[flId] || 'diesel';
    const newImg = resolveItemImage_(sub, point);

    if (newImg && (!curImg || curImg !== newImg)) {
      data[i][5] = newImg;
      updatedCount++;
    }
  }

  if (updatedCount > 0) {
    clSh.getRange(2, 6, data.length, 1).setValues(data.map(r => [r[5]]));
  }
  const msg = 'อัปเดตไฟล์รูปใน Checklist สำเร็จ: ' + updatedCount + ' รายการ';
  Logger.log(msg);
  return msg;
}

function syncCleaningTasks() {
  const cnSh = sheet_(SH.CLN);
  if (!cnSh) throw new Error('ไม่พบชีต ' + SH.CLN);
  const fls = rows_(SH.FL);
  const rows = [];
  fls.forEach(m => {
    SEED_CLEAN_FORKLIFT.forEach((c, idx) => {
      rows.push([
        m.Forklift_ID + '-CLN-' + String(idx + 1).padStart(2, '0'),
        m.Forklift_ID,
        c[0],
        c[1],
        c[2],
        c[3]
      ]);
    });
  });

  if (cnSh.getLastRow() > 1) {
    cnSh.deleteRows(2, cnSh.getLastRow() - 1);
  }
  if (rows.length) {
    if (cnSh.getMaxRows() < rows.length + 1) {
      cnSh.insertRowsAfter(cnSh.getMaxRows(), rows.length + 1 - cnSh.getMaxRows());
    }
    cnSh.getRange(2, 1, rows.length, 6).setValues(rows);
  }
  const msg = 'ซิงค์รายการทำความสะอาดสำหรับรถทั้งหมด ' + fls.length + ' คัน (' + rows.length + ' งาน) สำเร็จ';
  Logger.log(msg);
  return msg;
}