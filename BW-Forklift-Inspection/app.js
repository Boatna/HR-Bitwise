const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwITy08kM9M91rBfHGDpmloomOnEmg4vp1VrTnsQJ4_kAhswRKPdPwyUnNIePeDmncD/exec';
const MOCK_PEOPLE = [
  { id: 'EMP-001', name: 'สมชาย ใจดี', dept: 'คลังสินค้าวัตถุดิบ', pin: '1234' },
  { id: 'EMP-002', name: 'วิชัย มั่นคง', dept: 'คลังสินค้าวัตถุดิบ', pin: '1234' },
  { id: 'EMP-003', name: 'มานพ สุขเกษม', dept: 'คลังสินค้าสำเร็จรูป', pin: '1234' },
  { id: 'EMP-004', name: 'เกรียงไกร ชาญชัย', dept: 'คลังสินค้าสำเร็จรูป', pin: '1234' },
  { id: 'EMP-005', name: 'ชวลิต เจริญผล', dept: 'แผนกจัดส่งและโลจิสติกส์', pin: '1234' },
  { id: 'EMP-006', name: 'ธนกร รัตนวงศ์', dept: 'แผนกจัดส่งและโลจิสติกส์', pin: '1234' },
  { id: 'EMP-007', name: 'ประดิษฐ์ ทรัพย์มาก', dept: 'แผนกผลิตและแปรรูป', pin: '1234' },
  { id: 'EMP-008', name: 'ประสิทธิ์ รักงาน', dept: 'แผนกซ่อมบำรุง', pin: '9999' },
  { id: 'EMP-009', name: 'อนุชา สว่างสุข', dept: 'แผนกซ่อมบำรุง', pin: '0000' }
];

const MOCK_FORKLIFTS = [
  { id: 'FL-01', name: 'โฟล์คลิฟท์เครื่องยนต์ #1', model: 'แบบน้ำมัน+แก๊ส', loc: 'คลังวัตถุดิบ อาคาร A', owner: 'สมชาย ใจดี', dept: 'คลังสินค้าวัตถุดิบ' },
  { id: 'FL-02', name: 'โฟล์คลิฟท์เครื่องยนต์ #2', model: 'แบบน้ำมัน+แก๊ส', loc: 'ลานกองวัตถุดิบกลางแจ้ง', owner: 'วิชัย มั่นคง', dept: 'คลังสินค้าวัตถุดิบ' },
  { id: 'FL-03', name: 'โฟล์คลิฟท์ไฟฟ้า #1', model: 'แบบไฟฟ้า', loc: 'คลังสินค้าสำเร็จรูป ชั้น 1', owner: 'มานพ สุขเกษม', dept: 'คลังสินค้าสำเร็จรูป' },
  { id: 'FL-04', name: 'โฟล์คลิฟท์ไฟฟ้า #2', model: 'แบบไฟฟ้า', loc: 'พื้นที่แพ็คเกจจิ้งและจัดเก็บ', owner: 'เกรียงไกร ชาญชัย', dept: 'คลังสินค้าสำเร็จรูป' },
  { id: 'FL-05', name: 'โฟล์คลิฟท์เครื่องยนต์ #3', model: 'แบบน้ำมัน+แก๊ส', loc: 'ลานโหลดสินค้าและตู้คอนเทนเนอร์', owner: 'ชวลิต เจริญผล', dept: 'แผนกจัดส่งและโลจิสติกส์' },
  { id: 'FL-06', name: 'โฟล์คลิฟท์ไฟฟ้า #3', model: 'แบบไฟฟ้า', loc: 'อาคารพักสินค้าเตรียมส่งมอบ', owner: 'ธนกร รัตนวงศ์', dept: 'แผนกจัดส่งและโลจิสติกส์' },
  { id: 'FL-07', name: 'โฟล์คลิฟท์เครื่องยนต์ #4', model: 'แบบน้ำมัน+แก๊ส', loc: 'พื้นที่ลำเลียงและป้อนวัตถุดิบไลน์ผลิต', owner: 'ประดิษฐ์ ทรัพย์มาก', dept: 'แผนกผลิตและแปรรูป' },
  { id: 'FL-08', name: 'โฟล์คลิฟท์ไฟฟ้า #4', model: 'แบบไฟฟ้า', loc: 'โรงจอดซ่อมบำรุงและรถสำรอง', owner: 'ประสิทธิ์ รักงาน', dept: 'แผนกซ่อมบำรุง' }
];

const ITEMS_GAS = [
  { no: 1, point: 'ระดับน้ำมันเครื่อง', cat: 'ห้องเครื่องยนต์', std: 'ดึงก้านวัดขณะดับเครื่อง ระดับอยู่ระหว่างขีด Min-Max น้ำมันไม่ดำข้นเหนียวหรือมีตะกอน' },
  { no: 2, point: 'ระดับน้ำหม้อพักน้ำ', cat: 'ระบบระบายความร้อน', std: 'ระดับน้ำยาหล่อเย็นอยู่ในระดับ Full/Max ฝาปิดแน่นสนิท ครีบหม้อน้ำไม่อุดตัน ไม่มีรอยรั่ว' },
  { no: 3, point: 'ระดับน้ำมันเบรค + ครัช', cat: 'ระบบเบรคและควบคุม', std: 'ระดับน้ำมันในกระปุกอยู่ในเกณฑ์ที่กำหนด กระปุกไม่แตกร้าว ไม่มีคราบน้ำมันรั่วซึม' },
  { no: 4, point: 'ระดับน้ำกลั่น', cat: 'ระบบไฟฟ้าและแบตเตอรี่', std: 'น้ำกลั่นท่วมแผ่นธาตุทุกช่อง ฝาจุกปิดสนิท ขั้วแน่น ไม่มีคราบขี้เกลือเกาะหนา' },
  { no: 5, point: 'ระดับน้ำมันไฮดรอลิค', cat: 'ระบบไฮดรอลิค', std: 'ตรวจเช็คขณะวางงาแนบพื้นราบ ระดับน้ำมันอยู่ในเกณฑ์ตาแมว/ก้านวัด สีน้ำมันใสไม่ขุ่น' },
  { no: 6, point: 'เสาและงา', cat: 'เสาและชุดยก', std: 'งาทั้งสองข้างไม่คดงอหรือแตกร้าว ปลายงาเสมอกัน สลักล็อกงาอยู่ครบ เสาเลื่อนขึ้น-ลงราบเรียบ' },
  { no: 7, point: 'สภาพล้อ + ยาง', cat: 'ช่วงล่างและล้อ', std: 'หน้ายางไม่ฉีกขาด ไม่มีเศษหิน/โลหะฝัง น็อตล้อขันแน่นครบทุกตัว กระทะล้อไม่บิดเบี้ยว' },
  { no: 8, point: 'สภาพสายไฮดรอลิค', cat: 'ระบบไฮดรอลิค', std: 'สายไฮดรอลิคไม่บวม ไม่แตกลายงา ไม่มีรอยเสียดสี ข้อต่อท่อไม่มีน้ำมันซึมออกมา' },
  { no: 9, point: 'ระบบไฟสัญญาณ + แตร', cat: 'ระบบความปลอดภัย', std: 'ไฟหน้า ไฟท้าย ไฟถอย ไฟฉุกเฉิน และแตรทำงานติดครบทุกฟังก์ชัน เสียงดังชัดเจน' },
  { no: 10, point: 'ระบบเบรค', cat: 'ระบบเบรคและควบคุม', std: 'เบรคเท้ากดแล้วหน่วงหยุดได้ดี ไม่จมมิด เบรคมือ/เบรกล็อกล้อทำงานสมบูรณ์ ล็อกรถอยู่สนิท' },
  { no: 11, point: 'กระจกมองข้าง', cat: 'ทัศนวิสัย', std: 'กระจกซ้าย-ขวาไม่แตกหรือมัว ปรับมุมมองเห็นด้านหลังได้ชัดเจน ขาจับแน่นไม่สั่นคลอน' },
  { no: 12, point: 'พวงมาลัย', cat: 'ระบบเบรคและควบคุม', std: 'บังคับเลี้ยวได้ราบเรียบ ระยะฟรีพวงมาลัยเหมาะสม ลูกบิดพวงมาลัยแน่นหนา ไม่มีเสียงดัง' },
  { no: 13, point: 'เข็มขัดนิรภัย', cat: 'ระบบความปลอดภัย', std: 'สายเข็มขัดไม่ฉีกขาด กลไกดึงล็อกกระตุกทำงานดี หัวล็อกแน่นไม่หลุดเอง' },
  { no: 14, point: 'สภาพโซ่', cat: 'เสาและชุดยก', std: 'โซ่ยกตึงเท่ากันทั้งสองข้าง ไม่หย่อน ข้อต่อโซ่ไม่บิดเบี้ยวหรือตาย มีการหล่อลื่นเหมาะสม' }
];

// 10 ข้อ สำหรับ แบบไฟฟ้า
const ITEMS_ELEC = [
  { no: 1, point: 'ระดับน้ำกลั่นแบตเตอร์รี่', cat: 'แบตเตอรี่และระบบชาร์จ', std: 'ลูกลอยวัดระดับน้ำกลั่นลอยปกติ น้ำกลั่นท่วมแผ่นธาตุทุกเซลล์ ไม่มีสภาพแห้ง' },
  { no: 2, point: 'ขั้วแบตเตอร์รี่', cat: 'แบตเตอรี่และระบบชาร์จ', std: 'ขั้วต่อแน่น สะอาด ปราศจากคราบขี้เกลือสะสม ฝาครอบขั้วปิดเรียบร้อย สายไฟไม่ไหม้' },
  { no: 3, point: 'ปลั๊กชาร์จไฟ', cat: 'แบตเตอรี่และระบบชาร์จ', std: 'หัวปลั๊ก (Connector) ไม่แตกร้าว ขั้วทองแดงด้านในไม่ไหม้เกรียม เสียบต่อแน่นหนา' },
  { no: 4, point: 'เสาและงา', cat: 'เสาและชุดยก', std: 'งาไม่คดงอหรือแตกร้าว ปลายงาได้ระดับระนาบเดียวกัน สลักล็อกงาล็อกแน่น เสายกไม่ติดขัด' },
  { no: 5, point: 'สภาพล้อ + ยาง', cat: 'ช่วงล่างและล้อ', std: 'ยางตัน/ยางโพลียูรีเทนไม่บิ่นแหว่ง ไม่แตกลายงา น็อตขันแน่นครบทุกตัว' },
  { no: 6, point: 'ระดับน้ำมันไฮดรอลิค', cat: 'ระบบไฮดรอลิค', std: 'วางงาลงต่ำสุด เช็คระดับน้ำมันในถังไฮดรอลิคให้อยู่ในขีดปกติ ไม่มีคราบรั่วซึม' },
  { no: 7, point: 'ระบบไฟสัญญาณ + แตร', cat: 'ระบบความปลอดภัย', std: 'ไฟส่องสว่างหน้า ไฟถอย ไฟกะพริบเตือน และแตรทำงานปกติทุกฟังก์ชัน เสียงชัดเจน' },
  { no: 8, point: 'สภาพสายไฮดรอลิค', cat: 'ระบบไฮดรอลิค', std: 'สายไฮดรอลิคไม่ปริแตก ไม่บวม ข้อต่อท่อไม่มีน้ำมันหยดหรือซึม' },
  { no: 9, point: 'สภาพโซ่', cat: 'เสาและชุดยก', std: 'โซ่ยกตึงเท่ากันทั้งสองข้าง ไม่หย่อน ข้อต่อไม่ตาย มีการหล่อลื่นด้วยจาระบี/น้ำมันเหมาะสม' },
  { no: 10, point: 'ระบบเบรค', cat: 'ระบบเบรคและควบคุม', std: 'แป้นเบรคทำงานปกติ ระบบเบรคไฟฟ้า/เบรคมือล็อกอยู่สนิทเมื่อจอดหรือปล่อยคันเร่ง' }
];

const MOCK_CLEAN = [
  { id: 'C1', area: 'ความปลอดภัยก่อนเริ่ม', task: 'ดับเครื่องยนต์/ปิดสวิตช์กุญแจ และดึงเบรคมือ (ถอดปลั๊กแบตเตอรี่กรณีรถไฟฟ้า)', method: 'ปิดกุญแจ ดึงเบรคมือ ติดป้ายเตือน', tool: 'กุญแจรถ / ป้ายเตือน' },
  { id: 'C2', area: 'ห้องคนขับและเบาะนั่ง', task: 'เช็ดทำความสะอาดพวงมาลัย เบาะนั่ง คอนโซล และเข็มขัดนิรภัย', method: 'ใช้ผ้าชุบน้ำหมาดหรือน้ำยาทำความสะอาด เช็ดคราบเหงื่อและฝุ่น', tool: 'ผ้าสะอาด / น้ำยาทำความสะอาด' },
  { id: 'C3', area: 'ระบบระบายความร้อน', task: 'เป่าฝุ่นและสิ่งสกปรกที่แผงรังผึ้งหม้อน้ำหรือช่องระบายอากาศแบตเตอรี่', method: 'ใช้ปืนลมแรงดันต่ำเป่าฝุ่นย้อนทาง สวมแว่นตานิรภัย', tool: 'ปืนลม / แว่นตานิรภัย' },
  { id: 'C4', area: 'เสาและชุดยก', task: 'เช็ดคราบน้ำมันและสิ่งสกปรกที่เสายกและบริเวณงา', method: 'ใช้ผ้าแห้งเช็ดคราบน้ำมันส่วนเกินและฝุ่นทราย ห้ามใช้มือเปล่าจับร่องเสา', tool: 'ผ้าเช็ด / ถุงมือกันบาด' },
  { id: 'C5', area: 'ล้อและเพลาขับ', task: 'ตรวจและดึงเศษเชือก เศษพลาสติก หรือลวดที่พันรอบแกนล้อออก', method: 'ใช้คีมหรือกรรไกรตัดเศษที่พันรอบแกนล้อเพื่อป้องกันซีลล้อชำรุด', tool: 'คีม / ถุงมือ' }
];

// ----------------------------------------------------
// 2. Global State & Config
// ----------------------------------------------------
const TIMEZONE = 'Asia/Bangkok';

function getBangkokWeekday(date = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: TIMEZONE, weekday: 'short' }).format(date);
  } catch (e) {
    const day = new Date(date.toLocaleString('en-US', { timeZone: TIMEZONE })).getDay();
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day];
  }
}

function isMondayCleaningDay() {
  if (window._simMonday === true) return true;
  return getBangkokWeekday() === 'Mon';
}

function toggleSimMonday() {
  window._simMonday = !window._simMonday;
  const currentDay = getBangkokWeekday();
  toast(window._simMonday 
    ? 'เปิดโหมดจำลอง: แสดงการทำความสะอาด (เสมือนเป็นวันจันทร์)' 
    : `ปิดโหมดจำลอง: กลับสู่วันปัจจุบัน (${currentDay})`
  );
  if (checkMode === 'focus') renderFocusView();
  else drawClean();
}

let API_URL = (GOOGLE_APPS_SCRIPT_URL && !GOOGLE_APPS_SCRIPT_URL.includes('REPLACE_WITH_YOUR_ID')) 
  ? GOOGLE_APPS_SCRIPT_URL 
  : (localStorage.getItem('fl_gas_url') || '');
let TOKEN = sessionStorage.getItem('fl_token') || '';
let USER_NAME = sessionStorage.getItem('fl_user_name') || '';
let USER_ID = sessionStorage.getItem('fl_user_id') || '';
let USER_DEPT = sessionStorage.getItem('fl_user_dept') || '';
let FORM = null;
let res = {};
let cres = {};
let pin = '';
let PEOPLE = [];

const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const stripNo = t => String(t == null ? '' : t).replace(/^\s*\d+\s*[.)]\s*/, '');
const pad2 = n => String(n).padStart(2, '0');
const isoDay = d => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());

function toast(m) {
  const t = $('toast');
  if (!t) return;
  t.textContent = m;
  t.classList.remove('hide');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.add('hide'), 2800);
}

function updateApiStatus(isOnline, note) {
  const dot = $('apiDot');
  const txt = $('apiStatusText');
  if (dot && txt) {
    dot.className = 'status-dot ' + (isOnline ? '' : 'offline');
    txt.textContent = note || (isOnline ? 'Google Sheet ออนไลน์' : 'โหมดจำลอง (Offline)');
  }
}

async function apiGet(action, params = {}) {
  if (!API_URL) return null;
  const q = new URLSearchParams({ action, ...params }).toString();
  try {
    const res = await fetch(`${API_URL}?${q}`, { method: 'GET', redirect: 'follow' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    return json;
  } catch (err) {
    console.warn('API GET Failed:', action, err);
    return null;
  }
}

async function apiPost(action, payload = {}) {
  if (!API_URL) return null;
  try {
    const body = JSON.stringify({ action, ...payload });
    const res = await fetch(API_URL, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      redirect: 'follow'
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    return json;
  } catch (err) {
    console.warn('API POST Failed:', action, err);
    return null;
  }
}

function drawDots() {
  $('dots').innerHTML = [0, 1, 2, 3].map(i => `<i class="${i < pin.length ? 'on' : ''}"></i>`).join('');
}

function buildKeys() {
  $('keys').innerHTML = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✓']
    .map(k => `<button type="button" data-k="${k}" class="${k === '✓' ? 'go' : ''}">${k}</button>`)
    .join('');

  $('keys').onclick = e => {
    const k = e.target.dataset.k;
    if (!k) return;
    if (k === '⌫') {
      pin = pin.slice(0, -1);
    } else if (k === '✓') {
      return doLogin();
    } else if (pin.length < 4) {
      pin += k;
    }
    drawDots();
    if (pin.length === 4 && k !== '⌫') {
      doLogin();
    }
  };
}

async function loadNames() {
  $('selName').innerHTML = '<option value="">กำลังโหลดรายชื่อ...</option>';
  let emps = null;
  if (API_URL) {
    const res = await apiGet('getLoginData');
    if (res && res.ok && res.data && res.data.length) {
      emps = res.data;
      updateApiStatus(true, 'Google Sheet ออนไลน์');
    }
  }

  if (!emps) {
    emps = MOCK_PEOPLE;
    if (!API_URL) updateApiStatus(false, 'โหมดจำลอง (Offline)');
  }

  PEOPLE = emps;
  const ds = [...new Set(PEOPLE.map(p => p.dept).filter(Boolean))];
  $('selDept').innerHTML = '<option value="">ทุกหน่วยงาน</option>' + ds.map(d => `<option value="${esc(d)}">${esc(d)}</option>`).join('');
  $('selDept').onchange = fillNames;
  fillNames();
}

function fillNames() {
  const d = $('selDept').value;
  $('selName').innerHTML = '<option value="">-- เลือกชื่อผู้ตรวจ --</option>' +
    PEOPLE.filter(p => !d || p.dept === d).map(p => `<option value="${esc(p.id)}">${esc(p.name)} (${esc(p.id)})</option>`).join('');
}

async function doLogin() {
  const empId = $('selName').value;
  if (!empId) {
    $('loginErr').textContent = 'กรุณาเลือกชื่อผู้ตรวจเช็ค';
    return;
  }
  if (pin.length < 4) {
    $('loginErr').textContent = 'กรุณากรอก PIN 4 หลัก';
    return;
  }

  $('loginErr').textContent = '';

  if (API_URL) {
    // โหมดเชื่อมต่อ Google Sheet: ตรวจ PIN จากชีตเท่านั้น (ไม่มี PIN สำรอง)
    const r = await apiPost('login', { empId, pin });
    if (r && r.ok) {
      TOKEN = r.token;
      USER_NAME = r.name;
      USER_ID = r.id || empId;
      finishLogin(r.dept || $('selDept').value);
      return;
    }
    $('loginErr').textContent = !r
      ? 'เชื่อมต่อ Google Sheet ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ต หรือ Web App URL'
      : (r.msg || r.error || 'เข้าสู่ระบบไม่สำเร็จ');
    pin = '';
    drawDots();
    return;
  }

  // โหมดจำลอง (Offline): ใช้ PIN ตามรายชื่อทดสอบ
  const mockEmp = MOCK_PEOPLE.find(p => p.id === empId);
  if (mockEmp && pin === mockEmp.pin) {
    TOKEN = 'MOCK-TOKEN-' + Date.now();
    USER_NAME = mockEmp.name;
    USER_ID = empId;
    finishLogin(mockEmp.dept || '');
  } else {
    $('loginErr').textContent = 'PIN ไม่ถูกต้อง';
    pin = '';
    drawDots();
  }
}

function finishLogin(dept = '') {
  sessionStorage.setItem('fl_token', TOKEN);
  sessionStorage.setItem('fl_user_name', USER_NAME);
  sessionStorage.setItem('fl_user_id', USER_ID);
  if (dept) {
    USER_DEPT = dept;
    sessionStorage.setItem('fl_user_dept', USER_DEPT);
  }
  pin = '';
  drawDots();
  enter();
}

function doLogout() {
  if (TOKEN && API_URL) apiPost('logout', { token: TOKEN }).catch(() => {});
  TOKEN = '';
  USER_NAME = '';
  USER_ID = '';
  USER_DEPT = '';
  FORM = null;
  sessionStorage.clear();
  pin = '';
  drawDots();
  show('login');
}

function enter() {
  $('whoName').textContent = USER_NAME;
  $('av').textContent = USER_NAME.charAt(0);
  show('form');
}

function show(v) {
  ['Login', 'Form', 'Dash'].forEach(x => {
    const el = $('v' + x);
    if (el) el.classList.toggle('hide', x.toLowerCase() !== v);
  });
  $('top').classList.toggle('hide', v === 'login');
  $('nForm').classList.toggle('on', v === 'form');
  $('nDash').classList.toggle('on', v === 'dash');

  if (v === 'login') loadNames();
  if (v === 'form') loadForm();
  if (v === 'dash') loadDash();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ----------------------------------------------------
// 6. Inspection Form Logic (Focus & All Views)
// ----------------------------------------------------
let checkMode = 'focus'; // 'focus' or 'all'
let curFocusIdx = 0;

const isCurElectric = () => {
  const m = curForklift();
  return m && /ไฟฟ้า|electric/i.test(m.model + ' ' + m.name);
};

const getCurItems = () => {
  const m = curForklift();
  if (!m) return [];
  const isElec = isCurElectric();

  if (FORM && FORM.items && FORM.items.length) {
    const specific = FORM.items.filter(i => (i.forkliftId || i.machine) === m.id)
      .map(i => ({ ...i, point: stripNo(i.point) }));
    if (specific.length) return specific;
  }

  const base = isElec ? ITEMS_ELEC : ITEMS_GAS;
  return base.map(b => ({
    id: `${m.id}-CHK-${String(b.no).padStart(2, '0')}`,
    no: b.no,
    forkliftId: m.id,
    cat: b.cat,
    point: b.point,
    std: b.std
  }));
};

const getCurClean = () => {
  const m = curForklift();
  if (!m) return MOCK_CLEAN;
  if (FORM && FORM.clean && FORM.clean.length) {
    const specific = FORM.clean.filter(c => (c.forkliftId || c.machine) === m.id);
    if (specific.length) return specific;
  }
  return MOCK_CLEAN;
};

// Map each inspection point to its relevant cleaning task
function getCleaningForPoint(item) {
  const cleanList = getCurClean();
  const point = (item.point || '').toLowerCase();
  const cat = (item.cat || '').toLowerCase();

  const matched = cleanList.filter(c => {
    const text = (c.area + ' ' + c.task).toLowerCase();
    if (/ล้อ|ยาง/.test(point) && /ล้อ|เพลา/.test(text)) return true;
    if (/เสา|งา|โซ่|ไฮดรอลิค/.test(point) && /เสา|ชุดยก/.test(text)) return true;
    if (/หม้อพักน้ำ|น้ำมันเครื่อง|เครื่องยนต์/.test(point) && /ระบายความร้อน|เครื่องยนต์/.test(text)) return true;
    if (/แบตเตอร์รี่|ปลั๊กชาร์จ|น้ำกลั่น/.test(point) && /แบตเตอรี่|ความปลอดภัยก่อนเริ่ม/.test(text)) return true;
    if (/พวงมาลัย|เบรค|กระจก|เข็มขัด|ไฟ|แตร/.test(point) && /ห้องคนขับ|เบาะนั่ง/.test(text)) return true;
    return false;
  });

  return matched.length ? matched : [cleanList[0]];
}

const curForklift = () => {
  if (!FORM || !FORM.forklifts || !FORM.forklifts.length) return null;
  const sel = $('selForklift');
  if (!sel) return FORM.forklifts[0];
  return FORM.forklifts.find(m => m.id === sel.value) || null;
};

function populateForkliftSelect() {
  const selectedDept = $('selFormDept') ? $('selFormDept').value : '';
  let filtered = FORM.forklifts || [];
  if (selectedDept) {
    filtered = filtered.filter(m => m.dept === selectedDept);
  }

  if (!filtered.length) {
    $('selForklift').innerHTML = '<option value="">-- ไม่พบรถในแผนกนี้ --</option>';
    $('minfo').innerHTML = '<span style="color:var(--mute); font-size:13.5px;">ไม่พบรถโฟล์คลิฟท์ที่ลงทะเบียนในแผนกนี้</span>';
    ['boxFocusView', 'plist', 'tiles', 'clean'].forEach(id => { $(id).innerHTML = ''; });
    $('cnt').textContent = '0/0 ข้อ';
    $('pg').style.width = '0%';
    $('btnSave').disabled = true;
    return;
  }
  $('btnSave').disabled = false;

  $('selForklift').innerHTML = filtered.map(m => {
    const isElec = /ไฟฟ้า|electric/i.test(m.model + ' ' + m.name);
    return `<option value="${esc(m.id)}">${esc(m.id)} - ${esc(m.name)} [${isElec ? '⚡ ไฟฟ้า' : '⛽ น้ำมัน+แก๊ส'}]</option>`;
  }).join('');

  pickForklift();
}

async function loadForm() {
  try {
    if (!FORM) {
      if (API_URL) {
        const res = await apiGet('getFormData', { token: TOKEN });
        if (res && res.ok && res.data) {
          FORM = res.data;
          updateApiStatus(true, 'Google Sheet ออนไลน์');
        }
      }
      if (!FORM) {
        FORM = { forklifts: MOCK_FORKLIFTS, items: [], clean: MOCK_CLEAN };
      }

      // Populate Department Filter dropdown in Form
      const depts = [...new Set((FORM.forklifts || []).map(m => m.dept).filter(Boolean))];
      if ($('selFormDept')) {
        $('selFormDept').innerHTML = '<option value="">ทุกหน่วยงาน (แสดงทั้งหมด)</option>' +
          depts.map(d => `<option value="${esc(d)}">${esc(d)}</option>`).join('');

        if (USER_DEPT && depts.includes(USER_DEPT)) {
          $('selFormDept').value = USER_DEPT;
        }

        $('selFormDept').onchange = () => {
          populateForkliftSelect();
        };
      }

      $('selForklift').onchange = pickForklift;
      $('clean').onchange = e => {
        const c = e.target.dataset.c;
        if (c) {
          cres[c] = e.target.checked;
          updateCleanStats();
          if (checkMode === 'focus') renderFocusView();
        }
      };
      $('tiles').onclick = e => {
        const b = e.target.closest('.tile');
        if (b) tap(b.dataset.i);
      };
      $('tiles').onkeydown = e => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const b = e.target.closest('.tile');
        if (b) { e.preventDefault(); tap(b.dataset.i); }
      };
      $('boxFocusView').onclick = e => {
        const b = e.target.closest('[data-act="res"]');
        if (b) setFocusResult(b.dataset.id, b.dataset.val);
      };
      $('boxFocusView').onchange = e => {
        const c = e.target.dataset.fc;
        if (c) toggleFocusClean(c, e.target.checked);
      };
    }
    populateForkliftSelect();
  } catch (err) {
    console.error(err);
    toast('เกิดข้อผิดพลาดในการโหลดข้อมูลแบบฟอร์ม');
  }
}

function pickForklift() {
  const m = curForklift();
  if (!m) return;
  res = {};
  cres = {};
  curFocusIdx = 0;
  $('note').value = '';

  const isElec = isCurElectric();
  const badgeClass = isElec ? 'badge-elec' : 'badge-gas';
  const badgeText = isElec ? '⚡ แบบไฟฟ้า (10 รายการ)' : '⛽ แบบน้ำมัน+แก๊ส (14 รายการ)';

  $('minfo').innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
      <b>🚜 ${esc(m.name)} (${esc(m.id)})</b>
      <span class="badge-tag ${badgeClass}">${badgeText}</span>
    </div>
    <div style="font-size:13px; color:var(--mute); line-height:1.6;">
      <span>🏢 <b>แผนก:</b> ${esc(m.dept || '-')}</span> &nbsp;·&nbsp;
      <span>📍 <b>ที่ตั้ง:</b> ${esc(m.loc)}</span><br>
      <span>👤 <b>ผู้รับผิดชอบ:</b> ${esc(m.owner)}</span>
    </div>
  `;

  renderForklift3D(m, isElec);
  updateProgress();
  drawPlist();
  renderFocusView();
  drawTiles();
  drawClean();
}

function switchCheckMode(mode) {
  checkMode = mode;
  $('btnModeFocus').classList.toggle('active', mode === 'focus');
  $('btnModeAll').classList.toggle('active', mode === 'all');
  $('boxFocusView').classList.toggle('hide', mode !== 'focus');
  $('boxAllView').classList.toggle('hide', mode === 'focus');

  if (mode === 'focus') {
    renderFocusView();
  } else {
    drawTiles();
    drawClean();
  }
}

function updateProgress() {
  const its = getCurItems();
  const total = its.length;
  const checked = Object.keys(res).length;
  $('cnt').textContent = `${checked}/${total} ข้อ`;
  $('pg').style.width = (total ? (checked / total) * 100 : 0) + '%';
}

function updateCleanStats() {
  if (!isMondayCleaningDay()) {
    $('cc').textContent = 'เฉพาะวันจันทร์';
    return;
  }
  const tasks = getCurClean();
  const total = tasks.length;
  const done = tasks.filter(c => cres[c.id]).length;
  $('cc').textContent = `${done}/${total} ข้อ`;
}

// Focused View: Displays Inspection Point + Matching Cleaning Task
function renderFocusView() {
  const its = getCurItems();
  if (!its.length) return;
  if (curFocusIdx < 0) curFocusIdx = 0;
  if (curFocusIdx >= its.length) curFocusIdx = its.length - 1;

  const item = its[curFocusIdx];
  const curStatus = res[item.id] || '';
  const relCleans = getCleaningForPoint(item);

  const statusBadge = curStatus === 'OK'
    ? '<span class="plist-status OK">✓ ตรวจแล้ว: ปกติ</span>'
    : curStatus === 'NG'
    ? '<span class="plist-status NG">✕ ตรวจแล้ว: ผิดปกติ</span>'
    : '<span class="plist-status pend">⏳ ยังไม่ตรวจ</span>';

  let cleanHtml = '';
  relCleans.forEach(c => {
    const isDone = !!cres[c.id];
    cleanHtml += `
      <label style="display:flex; align-items:flex-start; gap:10px; margin-top:8px; cursor:pointer;">
        <input type="checkbox" data-fc="${esc(c.id)}" ${isDone ? 'checked' : ''} style="width:19px; height:19px; accent-color:var(--orange); margin-top:3px; flex:none;">
        <span style="font-size:13.5px;">
          <b>${esc(c.area)}: ${esc(c.task)}</b>
          ${c.method ? `<span class="t" style="display:block; font-size:12px; color:var(--mute); margin-top:2px;">วิธีทำ: ${esc(c.method)}${c.tool ? ' · อุปกรณ์: ' + esc(c.tool) : ''}</span>` : ''}
        </span>
      </label>
    `;
  });

  $('boxFocusView').innerHTML = `
    <div class="focus-card">
      <div class="focus-header">
        <span class="badge-tag" style="background:#f1f5f9; color:var(--navy2); border:1px solid var(--line);">
          📂 ${esc(item.cat)}
        </span>
        ${statusBadge}
      </div>

      <div class="focus-title">
        <span class="mark" style="width:30px; height:30px; font-size:15px; font-weight:700;">${curFocusIdx + 1}</span>
        <span>${esc(item.point)}</span>
      </div>

      <div class="focus-std-box">
        <b style="color:var(--navy2); display:block; margin-bottom:4px;">📋 เกณฑ์และวิธีตรวจสอบ:</b>
        ${esc(item.std)}
      </div>

      <div class="focus-actions">
        <button type="button" class="btn-choice btn-ok ${curStatus === 'OK' ? 'active' : ''}" data-act="res" data-id="${esc(item.id)}" data-val="OK">
          ✓ ปกติ (OK)
        </button>
        <button type="button" class="btn-choice btn-ng ${curStatus === 'NG' ? 'active' : ''}" data-act="res" data-id="${esc(item.id)}" data-val="NG">
          ✕ ผิดปกติ (NG)
        </button>
        <button type="button" class="btn-choice btn-clear" data-act="res" data-id="${esc(item.id)}" data-val="">
          ล้างค่า
        </button>
      </div>

      <!-- Matching Cleaning Task for this Point (แสดงเฉพาะวันจันทร์) -->
      ${isMondayCleaningDay() ? `
        <div class="focus-clean-card">
          <div class="focus-clean-title">
            <span>🧹 การทำความสะอาดประจำจุดนี้</span>
            <span style="font-size:12px; font-weight:normal; color:#ea580c; margin-left:auto;">📅 ประจำวันจันทร์</span>
          </div>
          ${cleanHtml}
        </div>
      ` : `
        <div style="background:#f8fafc; border:1.5px dashed var(--line); border-radius:10px; padding:10px 14px; margin-top:14px; font-size:13px; color:var(--mute); display:flex; justify-content:space-between; align-items:center;">
          <span>🗓️ <b>การทำความสะอาดประจำจุด:</b> กำหนดทำทุกวันจันทร์ (วันนี้ไม่ต้องทำความสะอาด)</span>
          <button type="button" class="btn alt" style="padding:3px 9px; font-size:11.5px;" onclick="toggleSimMonday()" title="คลิกเพื่อจำลองโหมดวันจันทร์">${window._simMonday ? 'ปิดจำลอง' : 'ทดสอบโหมดวันจันทร์'}</button>
        </div>
      `}

      <!-- Step Navigator -->
      <div class="step-nav">
        <button type="button" class="btn alt" style="padding:6px 14px; font-size:13px;" onclick="prevFocusPoint()" ${curFocusIdx === 0 ? 'disabled' : ''}>
          🠔 จุดก่อนหน้า
        </button>
        <span style="font-family:'Kanit',sans-serif; font-weight:600; font-size:14px; color:var(--navy2);">
          จุดตรวจที่ ${curFocusIdx + 1} / ${its.length}
        </span>
        <button type="button" class="btn alt" style="padding:6px 14px; font-size:13px;" onclick="nextFocusPoint()" ${curFocusIdx === its.length - 1 ? 'disabled' : ''}>
          จุดถัดไป ➔
        </button>
      </div>
    </div>
  `;

  drawPlist();
}

function setFocusResult(itemId, val) {
  if (val) res[itemId] = val;
  else delete res[itemId];

  updateProgress();
  renderFocusView();
  drawTiles();

  if (val === 'OK' && curFocusIdx < getCurItems().length - 1) {
    setTimeout(() => {
      nextFocusPoint();
    }, 280);
  }
}

function toggleFocusClean(cleanId, isChecked) {
  cres[cleanId] = isChecked;
  updateCleanStats();
  drawClean();
}

function prevFocusPoint() {
  if (curFocusIdx > 0) selectInspectionPoint(curFocusIdx - 1);
}

function nextFocusPoint() {
  const its = getCurItems();
  if (curFocusIdx < its.length - 1) selectInspectionPoint(curFocusIdx + 1);
}

function selectInspectionPoint(idx) {
  curFocusIdx = idx;
  sel3DPart(idx);

  if (checkMode === 'focus') {
    renderFocusView();
  } else {
    const its = getCurItems();
    if (its[idx]) {
      const tileEl = document.querySelector(`.tile[data-i="${its[idx].id}"]`);
      if (tileEl) {
        tileEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        tileEl.style.outline = '3px solid var(--orange)';
        setTimeout(() => tileEl.style.outline = '', 1600);
      }
    }
  }
  drawPlist();
}

function drawPlist() {
  const its = getCurItems();
  $('plist').innerHTML = its.map((item, idx) => {
    const isSelected = (idx === curFocusIdx);
    const state = res[item.id] || '';
    const stLabel = state === 'OK' ? '✓ ปกติ' : state === 'NG' ? '✕ ผิดปกติ' : 'รอตรวจ';
    const stClass = state === 'OK' ? 'OK' : state === 'NG' ? 'NG' : 'pend';

    return `
      <li>
        <button type="button" class="${isSelected ? 'on' : ''}" data-p="${idx}">
          <span class="no">${idx + 1}</span>
          <span style="flex:1; min-width:0;">
            <b style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(item.point)}</b>
            <span class="t">${esc(item.cat)}</span>
          </span>
          <span class="plist-status ${stClass}">${stLabel}</span>
        </button>
      </li>
    `;
  }).join('');

  $('plist').onclick = e => {
    const btn = e.target.closest('button');
    if (btn) selectInspectionPoint(+btn.dataset.p);
  };
}

function drawTiles() {
  const its = getCurItems();
  let h = '', lastCat = null;

  its.forEach((item, idx) => {
    if (item.cat !== lastCat) {
      if (lastCat !== null) h += `</div>`;
      h += `
        <div class="cat-header">
          <span>📂 หมวด: ${esc(item.cat)}</span>
        </div>
        <div class="tiles">
      `;
      lastCat = item.cat;
    }

    const state = res[item.id] || '';
    const stateLabel = state === 'OK' ? '✓ ปกติ' : state === 'NG' ? '✕ ผิดปกติ' : 'แตะเพื่อตรวจ';
    const displayNo = item.no || (idx + 1);

    h += `
      <div class="tile ${state}" data-i="${esc(item.id)}" role="button" tabindex="0">
        <div class="tile-top">
          <div class="tile-no">
            <span class="mark" style="width:26px; height:26px; font-size:13px; font-weight:700;">${displayNo}</span>
            <span>${esc(item.point)}</span>
          </div>
          <span class="tile-state">${stateLabel}</span>
        </div>
        <div class="tile-std">${esc(item.std)}</div>
      </div>
    `;
  });

  if (lastCat !== null) h += `</div>`;
  $('tiles').innerHTML = h;
  updateProgress();
}

function tap(id) {
  const cur = res[id];
  if (!cur) res[id] = 'OK';
  else if (cur === 'OK') res[id] = 'NG';
  else delete res[id];

  const its = getCurItems();
  const idx = its.findIndex(i => i.id === id);
  if (idx >= 0) curFocusIdx = idx;

  updateProgress();
  drawTiles();
  drawPlist();
  if (checkMode === 'focus') renderFocusView();
}

function allOk() {
  getCurItems().forEach(i => res[i.id] = 'OK');
  updateProgress();
  drawTiles();
  drawPlist();
  if (checkMode === 'focus') renderFocusView();
  toast('เลือกผล "ปกติ" ครบทุกข้อแล้ว');
}

function clearAll() {
  res = {};
  updateProgress();
  drawTiles();
  drawPlist();
  if (checkMode === 'focus') renderFocusView();
}

function drawClean() {
  const isMon = isMondayCleaningDay();
  const tasks = getCurClean();

  if (isMon) {
    $('clean').innerHTML = tasks.map(c => `
      <label>
        <input type="checkbox" data-c="${esc(c.id)}"${cres[c.id] ? ' checked' : ''}>
        <span>
          <b>${esc(c.area)}: ${esc(c.task)}</b>
          ${c.method ? `<span class="t">วิธีทำ: ${esc(c.method)}${c.tool ? ' · อุปกรณ์: ' + esc(c.tool) : ''}</span>` : ''}
        </span>
      </label>
    `).join('');
    updateCleanStats();
  } else {
    $('clean').innerHTML = `
      <div style="background:#f8fafc; border:1.5px dashed var(--line); border-radius:10px; padding:14px; font-size:13px; color:var(--mute); text-align:center;">
        🗓️ การทำความสะอาดและบำรุงรักษาประจำสัปดาห์ <b>กำหนดทำเฉพาะทุกวันจันทร์</b> (วันนี้ไม่ต้องทำความสะอาด)
        <div style="margin-top:8px;">
          <button type="button" class="btn alt" style="padding:4px 12px; font-size:12px;" onclick="toggleSimMonday()">
            ${window._simMonday ? 'ปิดจำลอง' : 'ทดสอบโหมดวันจันทร์'}
          </button>
        </div>
      </div>
    `;
    $('cc').textContent = 'เฉพาะวันจันทร์';
  }
}

function cleanAll() {
  getCurClean().forEach(c => cres[c.id] = true);
  updateCleanStats();
  drawClean();
  if (checkMode === 'focus') renderFocusView();
  toast('ทำความสะอาดครบทุกข้อแล้ว');
}

async function saveInspection() {
  const its = getCurItems();
  const left = its.filter(i => !res[i.id]).length;
  if (!its.length) {
    toast('ไม่พบรายการตรวจ');
    return;
  }
  if (left > 0) {
    toast(`ยังตรวจเช็คไม่ครบ (เหลืออีก ${left} ข้อ)`);
    return;
  }

  const hasNg = its.some(i => res[i.id] === 'NG');
  const note = $('note').value.trim();
  if (hasNg && !note) {
    toast('พบจุดผิดปกติ (NG) กรุณาระบุรายละเอียดในหมายเหตุ');
    $('note').focus();
    return;
  }

  const m = curForklift();
  if (!m) {
    toast('กรุณาเลือกรถโฟล์คลิฟท์');
    return;
  }
  const btn = $('btnSave');
  btn.disabled = true;
  btn.textContent = 'กำลังบันทึกข้อมูล...';
  $('vForm').classList.add('busy');

  const payload = {
    forkliftId: m.id,
    results: res,
    cleaning: cres,
    note: note
  };

  try {
    if (API_URL) {
      const r = await apiPost('submitCheck', { token: TOKEN, data: payload });
      if (!r) {
        toast('เชื่อมต่อ Google Sheet ไม่ได้ ข้อมูลยังไม่ถูกบันทึก กรุณาลองใหม่');
        return;
      }
      if (!r.ok) {
        toast(r.error || r.msg || 'บันทึกไม่สำเร็จ');
        return;
      }
      toast('บันทึกผลการตรวจเช็คลง Google Sheet สำเร็จ!');
    } else {
      saveLocalLog(m, payload, hasNg ? 'NG' : 'OK');
      toast('บันทึกผลการตรวจเช็คแล้ว (โหมดจำลอง)');
    }

    res = {};
    cres = {};
    curFocusIdx = 0;
    $('note').value = '';
    updateProgress();
    drawPlist();
    renderFocusView();
    drawTiles();
    drawClean();
  } catch (err) {
    console.error(err);
    toast('เกิดข้อผิดพลาดในการบันทึก กรุณาลองใหม่อีกครั้ง');
  } finally {
    btn.disabled = false;
    btn.textContent = 'บันทึกผลการตรวจเช็ค';
    $('vForm').classList.remove('busy');
  }
}

function saveLocalLog(m, payload, status) {
  const logs = JSON.parse(localStorage.getItem('fl_local_logs') || '[]');
  const now = new Date();
  const timeStr = `${pad2(now.getDate())}/${pad2(now.getMonth() + 1)} ${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
  const ngItems = getCurItems().filter(i => payload.results[i.id] === 'NG').map(i => i.point).join(', ');

  logs.unshift({
    t: timeStr,
    iso: isoDay(now),
    by: USER_NAME || 'ผู้ตรวจ',
    forklift: m.name,
    forkliftId: m.id,
    status: status,
    ng: ngItems,
    note: payload.note || ''
  });

  if (logs.length > 50) logs.pop();
  localStorage.setItem('fl_local_logs', JSON.stringify(logs));
}

const V3 = {
  inited: false,
  renderer: null,
  scene: null,
  camera: null,
  root: null,
  drag: null,
  theta: 0.75,
  phi: 1.15,
  dist: 13,
  autoRotate: true,
  parts: [],
  selectedPart: -1
};

function createNumberBadgeCanvas(num, isSelected) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.beginPath();
  ctx.arc(32, 32, 28, 0, Math.PI * 2);
  ctx.fillStyle = isSelected ? '#f08a1c' : '#0f2438';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  ctx.fillStyle = isSelected ? '#0f2438' : '#ffffff';
  ctx.font = 'bold 32px Kanit, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(num, 32, 34);
  return new THREE.CanvasTexture(c);
}

function init3D() {
  if (V3.inited) return true;
  try {
    if (!window.THREE) return false;
    const canvas = $('cv');
    if (!canvas) return false;

    V3.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    V3.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    V3.scene = new THREE.Scene();
    V3.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    V3.scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 0.95));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
    dirLight.position.set(6, 12, 8);
    V3.scene.add(dirLight);
    const grid = new THREE.GridHelper(16, 16, 0x9fb0c0, 0xd3dce4);
    grid.position.y = 0;
    V3.scene.add(grid);

    canvas.addEventListener('pointerdown', e => {
      V3.drag = { x: e.clientX, y: e.clientY, moved: 0 };
      V3.autoRotate = false;
      canvas.setPointerCapture(e.pointerId);
    });

    canvas.addEventListener('pointermove', e => {
      if (!V3.drag) return;
      const dx = e.clientX - V3.drag.x;
      const dy = e.clientY - V3.drag.y;
      V3.drag.x = e.clientX;
      V3.drag.y = e.clientY;
      V3.drag.moved += Math.abs(dx) + Math.abs(dy);
      V3.theta -= dx * 0.01;
      V3.phi = Math.max(0.2, Math.min(1.5, V3.phi - dy * 0.01));
    });

    canvas.addEventListener('pointerup', e => {
      if (V3.drag && V3.drag.moved < 6) pick3DPart(e);
      V3.drag = null;
    });

    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      v3zoom(e.deltaY > 0 ? 1.2 : -1.2);
    }, { passive: false });

    function animate() {
      requestAnimationFrame(animate);
      if (!canvas.offsetParent) return;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * V3.renderer.getPixelRatio())) {
        V3.renderer.setSize(w, h, false);
        V3.camera.aspect = w / h;
        V3.camera.updateProjectionMatrix();
      }

      if (V3.autoRotate) V3.theta += 0.004;

      const target = new THREE.Vector3(0, 1.8, 0);
      V3.camera.position.set(
        target.x + V3.dist * Math.sin(V3.phi) * Math.sin(V3.theta),
        target.y + V3.dist * Math.cos(V3.phi),
        target.z + V3.dist * Math.sin(V3.phi) * Math.cos(V3.theta)
      );
      V3.camera.lookAt(target);
      V3.renderer.render(V3.scene, V3.camera);
    }
    animate();

    V3.inited = true;
    return true;
  } catch (err) {
    console.warn('3D initialization skipped:', err);
    return false;
  }
}

function v3zoom(d) {
  V3.dist = Math.max(7, Math.min(22, V3.dist + d));
}

function v3reset() {
  V3.theta = 0.75;
  V3.phi = 1.15;
  V3.dist = 13;
  V3.autoRotate = true;
  V3.selectedPart = -1;
  sel3DPart(-1);
}

function pick3DPart(e) {
  if (!V3.renderer || !V3.root) return;
  const rect = $('cv').getBoundingClientRect();
  const mouse = new THREE.Vector2(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top) / rect.height) * 2 + 1
  );
  const ray = new THREE.Raycaster();
  ray.setFromCamera(mouse, V3.camera);
  const hits = ray.intersectObjects(V3.root.children, true);
  const hit = hits.find(x => x.object.userData && x.object.userData.partIdx != null);
  if (hit) {
    selectInspectionPoint(hit.object.userData.partIdx);
  }
}

function sel3DPart(idx) {
  V3.selectedPart = idx;
  V3.parts.forEach((p, k) => {
    const isSelected = (k === V3.selectedPart);
    p.group.traverse(o => {
      if (o.isMesh && o.material) {
        o.material.emissive.setHex(isSelected ? 0xf08a1c : 0x000000);
        o.material.emissiveIntensity = isSelected ? 0.75 : 1;
      }
    });
    if (p.sprite) {
      if (p.sprite.material.map) p.sprite.material.map.dispose();
      p.sprite.material.map = createNumberBadgeCanvas(k + 1, isSelected);
      p.sprite.material.needsUpdate = true;
    }
  });

  if (V3.selectedPart >= 0) V3.autoRotate = false;
}

function renderForklift3D(m, isElec) {
  const has3D = init3D();
  if (!has3D) return;

  if (V3.root) {
    V3.scene.remove(V3.root);
    V3.root.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
        else o.material.dispose();
      }
    });
  }

  V3.root = new THREE.Group();
  V3.scene.add(V3.root);
  V3.parts = [];

  const mat = (col, r = 0.5, met = 0.25) => new THREE.MeshStandardMaterial({ color: col, roughness: r, metalness: met });
  const bx = (g, w, h, d, c, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
    mesh.position.set(x, y, z);
    g.add(mesh);
    return mesh;
  };
  const cy = (g, r, h, c, x, y, z, rotX = 0, rotZ = 0) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 24), mat(c));
    mesh.position.set(x, y, z);
    if (rotX) mesh.rotation.x = rotX;
    if (rotZ) mesh.rotation.z = rotZ;
    g.add(mesh);
    return mesh;
  };

  const C_BODY = isElec ? 0x0284c7 : 0xf08a1c;
  const C_DARK = 0x1f2937;
  const C_STEEL = 0x94a3b8;
  const C_RUBBER = 0x111827;
  const C_RED = 0xdc2626;

  // Base Chassis & Overhead Guard (Common)
  const chassisGroup = new THREE.Group();
  bx(chassisGroup, 2.1, 1.1, 3.2, C_BODY, 0, 0.85, -0.2);
  bx(chassisGroup, 2.1, 1.2, 1.0, C_BODY, 0, 0.9, -1.5);
  // Roll cage pillars & roof
  cy(chassisGroup, 0.05, 1.8, C_DARK, -0.9, 2.6, 0.8);
  cy(chassisGroup, 0.05, 1.8, C_DARK, 0.9, 2.6, 0.8);
  cy(chassisGroup, 0.05, 1.8, C_DARK, -0.9, 2.6, -1.4);
  cy(chassisGroup, 0.05, 1.8, C_DARK, 0.9, 2.6, -1.4);
  bx(chassisGroup, 1.9, 0.08, 2.3, C_DARK, 0, 3.5, -0.3);
  for (let z = -1.2; z <= 0.7; z += 0.35) {
    bx(chassisGroup, 1.8, 0.05, 0.05, 0x111827, 0, 3.52, z);
  }

  // LPG tank if Combustion
  if (!isElec) {
    cy(chassisGroup, 0.24, 0.9, 0x475569, 0, 1.85, -1.55, 0, Math.PI / 2);
    cy(chassisGroup, 0.05, 1.8, C_DARK, -0.85, 2.6, -1.6);
  }
  V3.root.add(chassisGroup);

  // 3D Parts mapping 1:1 with Checklist Items
  let builders = [];

  if (!isElec) {
    // 14 items for Gas/Oil
    builders = [
      // 1. ระดับน้ำมันเครื่อง
      g => {
        bx(g, 1.3, 0.8, 1.2, 0x334155, 0, 1.1, -0.4);
        cy(g, 0.04, 0.45, 0xfacc15, 0.45, 1.6, -0.2);
      },
      // 2. ระดับน้ำหม้อพักน้ำ
      g => {
        bx(g, 1.4, 0.9, 0.25, 0x64748b, 0, 1.3, -1.35);
        cy(g, 0.16, 0.4, 0xffffff, 0.55, 1.4, -1.1);
      },
      // 3. ระดับน้ำมันเบรค + ครัช
      g => {
        cy(g, 0.12, 0.3, 0xffffff, 0.3, 1.7, 0.5);
      },
      // 4. ระดับน้ำกลั่น
      g => {
        bx(g, 0.6, 0.45, 0.5, 0x1e293b, -0.5, 1.2, -0.8);
        cy(g, 0.05, 0.15, C_RED, -0.5, 1.45, -0.8);
      },
      // 5. ระดับน้ำมันไฮดรอลิค
      g => {
        bx(g, 0.35, 0.8, 0.9, 0x0284c7, 1.05, 1.0, 0);
        cy(g, 0.07, 0.1, 0xffffff, 1.23, 1.0, 0, 0, Math.PI / 2);
      },
      // 6. เสาและงา
      g => {
        bx(g, 0.18, 3.8, 0.2, C_DARK, -0.65, 2.1, 1.5);
        bx(g, 0.18, 3.8, 0.2, C_DARK, 0.65, 2.1, 1.5);
        bx(g, 1.5, 0.6, 0.15, C_DARK, 0, 0.8, 1.6);
        bx(g, 0.16, 0.9, 0.1, C_DARK, -0.45, 0.7, 1.65);
        bx(g, 0.16, 0.08, 1.5, C_STEEL, -0.45, 0.28, 2.35);
        bx(g, 0.16, 0.9, 0.1, C_DARK, 0.45, 0.7, 1.65);
        bx(g, 0.16, 0.08, 1.5, C_STEEL, 0.45, 0.28, 2.35);
      },
      // 7. สภาพล้อ + ยาง
      g => {
        cy(g, 0.48, 0.35, C_RUBBER, -1.0, 0.48, 1.0, 0, Math.PI / 2);
        cy(g, 0.28, 0.38, C_DARK, -1.0, 0.48, 1.0, 0, Math.PI / 2);
        cy(g, 0.48, 0.35, C_RUBBER, 1.0, 0.48, 1.0, 0, Math.PI / 2);
        cy(g, 0.28, 0.38, C_DARK, 1.0, 0.48, 1.0, 0, Math.PI / 2);
        cy(g, 0.42, 0.3, C_RUBBER, -0.85, 0.42, -1.2, 0, Math.PI / 2);
        cy(g, 0.42, 0.3, C_RUBBER, 0.85, 0.42, -1.2, 0, Math.PI / 2);
      },
      // 8. สภาพสายไฮดรอลิค
      g => {
        cy(g, 0.16, 3.2, C_STEEL, 0, 1.8, 1.45);
        cy(g, 0.03, 3.2, 0x000000, 0.42, 1.9, 1.42);
        cy(g, 0.03, 3.2, 0x000000, -0.42, 1.9, 1.42);
      },
      // 9. ระบบไฟสัญญาณ + แตร
      g => {
        cy(g, 0.12, 0.12, 0xfef08a, -0.85, 2.7, 0.9, Math.PI / 2);
        cy(g, 0.12, 0.12, 0xfef08a, 0.85, 2.7, 0.9, Math.PI / 2);
        cy(g, 0.14, 0.25, 0xf59e0b, 0, 3.65, -0.8);
      },
      // 10. ระบบเบรค
      g => {
        bx(g, 0.18, 0.25, 0.06, C_DARK, 0.2, 1.1, 0.7);
        bx(g, 0.08, 0.4, 0.08, 0xdc2626, -0.4, 1.4, 0.3);
      },
      // 11. กระจกมองข้าง
      g => {
        bx(g, 0.05, 0.35, 0.18, C_STEEL, -1.0, 2.8, 0.9);
        bx(g, 0.05, 0.35, 0.18, C_STEEL, 1.0, 2.8, 0.9);
      },
      // 12. พวงมาลัย
      g => {
        cy(g, 0.06, 0.9, C_DARK, 0, 1.9, 0.4, -0.4);
        cy(g, 0.26, 0.06, 0x374151, 0, 2.3, 0.25, -0.4);
      },
      // 13. เข็มขัดนิรภัย
      g => {
        bx(g, 0.9, 0.15, 0.9, C_DARK, 0, 1.4, -0.3);
        bx(g, 0.85, 0.9, 0.15, C_DARK, 0, 1.9, -0.75);
        bx(g, 0.12, 0.35, 0.06, 0xf08a1c, 0.4, 1.5, -0.3);
      },
      // 14. สภาพโซ่
      g => {
        cy(g, 0.04, 3.0, 0x475569, -0.3, 2.0, 1.5);
        cy(g, 0.04, 3.0, 0x475569, 0.3, 2.0, 1.5);
        cy(g, 0.18, 0.08, C_STEEL, -0.3, 3.6, 1.5, 0, Math.PI / 2);
        cy(g, 0.18, 0.08, C_STEEL, 0.3, 3.6, 1.5, 0, Math.PI / 2);
      }
    ];
  } else {
    // 10 items for Electric
    builders = [
      // 1. ระดับน้ำกลั่นแบตเตอร์รี่
      g => {
        bx(g, 1.8, 0.9, 1.7, 0x334155, 0, 1.1, -0.3);
        for (let i = -0.6; i <= 0.6; i += 0.4) {
          cy(g, 0.07, 0.15, 0xffffff, i, 1.6, -0.1);
          cy(g, 0.07, 0.15, 0xffffff, i, 1.6, -0.5);
        }
      },
      // 2. ขั้วแบตเตอร์รี่
      g => {
        cy(g, 0.08, 0.2, C_RED, -0.5, 1.65, -0.3);
        cy(g, 0.08, 0.2, 0x1e293b, 0.5, 1.65, -0.3);
      },
      // 3. ปลั๊กชาร์จไฟ
      g => {
        bx(g, 0.35, 0.35, 0.45, C_RED, 0.9, 1.35, -0.7);
        cy(g, 0.07, 0.6, 0x0f172a, 0.9, 1.1, -0.7);
      },
      // 4. เสาและงา
      g => {
        bx(g, 0.18, 3.8, 0.2, C_DARK, -0.65, 2.1, 1.5);
        bx(g, 0.18, 3.8, 0.2, C_DARK, 0.65, 2.1, 1.5);
        bx(g, 1.5, 0.6, 0.15, C_DARK, 0, 0.8, 1.6);
        bx(g, 0.16, 0.9, 0.1, C_DARK, -0.45, 0.7, 1.65);
        bx(g, 0.16, 0.08, 1.5, C_STEEL, -0.45, 0.28, 2.35);
        bx(g, 0.16, 0.9, 0.1, C_DARK, 0.45, 0.7, 1.65);
        bx(g, 0.16, 0.08, 1.5, C_STEEL, 0.45, 0.28, 2.35);
      },
      // 5. สภาพล้อ + ยาง
      g => {
        cy(g, 0.46, 0.32, C_RUBBER, -1.0, 0.46, 0.9, 0, Math.PI / 2);
        cy(g, 0.46, 0.32, C_RUBBER, 1.0, 0.46, 0.9, 0, Math.PI / 2);
        cy(g, 0.4, 0.28, C_RUBBER, -0.8, 0.4, -1.2, 0, Math.PI / 2);
        cy(g, 0.4, 0.28, C_RUBBER, 0.8, 0.4, -1.2, 0, Math.PI / 2);
      },
      // 6. ระดับน้ำมันไฮดรอลิค
      g => {
        bx(g, 0.35, 0.8, 0.9, 0x0284c7, 1.05, 1.0, 0);
        cy(g, 0.07, 0.1, 0xffffff, 1.23, 1.0, 0, 0, Math.PI / 2);
      },
      // 7. ระบบไฟสัญญาณ + แตร
      g => {
        cy(g, 0.12, 0.12, 0xfef08a, -0.85, 2.7, 0.9, Math.PI / 2);
        cy(g, 0.12, 0.12, 0xfef08a, 0.85, 2.7, 0.9, Math.PI / 2);
        cy(g, 0.14, 0.25, 0x0284c7, 0, 3.65, -0.8);
      },
      // 8. สภาพสายไฮดรอลิค
      g => {
        cy(g, 0.16, 3.2, C_STEEL, 0, 1.8, 1.45);
        cy(g, 0.03, 3.2, 0x000000, 0.42, 1.9, 1.42);
      },
      // 9. สภาพโซ่
      g => {
        cy(g, 0.04, 3.0, 0x475569, -0.3, 2.0, 1.5);
        cy(g, 0.04, 3.0, 0x475569, 0.3, 2.0, 1.5);
        cy(g, 0.18, 0.08, C_STEEL, -0.3, 3.6, 1.5, 0, Math.PI / 2);
        cy(g, 0.18, 0.08, C_STEEL, 0.3, 3.6, 1.5, 0, Math.PI / 2);
      },
      // 10. ระบบเบรค
      g => {
        bx(g, 0.2, 0.25, 0.06, C_DARK, 0.15, 1.1, 0.7);
        bx(g, 0.3, 0.25, 0.3, 0x475569, 0, 0.8, 0.7);
      }
    ];
  }

  // Create 3D groups and hotspot badges
  builders.forEach((buildFn, idx) => {
    const partGroup = new THREE.Group();
    buildFn(partGroup);
    V3.root.add(partGroup);

    partGroup.traverse(obj => {
      if (obj.isMesh) obj.userData.partIdx = idx;
    });

    const box = new THREE.Box3().setFromObject(partGroup);
    const center = box.getCenter(new THREE.Vector3());

    const spriteMat = new THREE.SpriteMaterial({
      map: createNumberBadgeCanvas(idx + 1, idx === curFocusIdx),
      depthTest: false
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.set(center.x, center.y + 0.15, center.z);
    sprite.scale.set(0.7, 0.7, 0.7);
    sprite.renderOrder = 99;
    sprite.userData.partIdx = idx;
    V3.root.add(sprite);

    V3.parts.push({ group: partGroup, sprite: sprite });
  });

  sel3DPart(curFocusIdx);
}

// ----------------------------------------------------
// 8. Dashboard Statistics
// ----------------------------------------------------
async function loadDash() {
  try {
    let d = null;
    if (API_URL) {
      const res = await apiGet('getDashboard', { token: TOKEN });
      if (res && res.ok && res.data) d = res.data;
    }

    if (!d) {
      // Generate stats from local data
      d = generateLocalDashboard();
    }

    // KPIs
    $('kTotal').textContent = d.total || 0;
    $('kNg').textContent = d.ngToday || 0;
    $('kPend').textContent = d.pending || 0;

    const okCount = d.series.reduce((acc, s) => acc + (s.ok || 0), 0);
    const ngCount = d.series.reduce((acc, s) => acc + (s.ng || 0), 0);
    const totalAll = okCount + ngCount;
    const rate = totalAll ? Math.round((okCount / totalAll) * 100) : 0;

    $('kRate').textContent = totalAll ? rate + '%' : '-';
    $('ringTxt').textContent = totalAll ? rate + '%' : '-';
    $('ring').style.setProperty('--p', rate);
    $('ring').style.background = totalAll ? '' : '#cbd5e1';

    // Bars
    const maxVal = Math.max(1, ...d.series.map(s => (s.ok || 0) + (s.ng || 0)));
    $('bars').innerHTML = d.series.map(s => {
      const sum = (s.ok || 0) + (s.ng || 0);
      const okH = (s.ok || 0) / maxVal * 100;
      const ngH = (s.ng || 0) / maxVal * 100;
      return `
        <div class="bar">
          <span>${sum || ''}</span>
          <i class="n" style="height:${ngH}%" title="NG: ${s.ng}"></i>
          <i class="o" style="height:${okH}%" title="OK: ${s.ok}"></i>
          ${s.d}
        </div>
      `;
    }).join('');

    // Forklift Grid
    const tag = s => `<span class="tag ${s}">${s === 'OK' ? '✓ ปกติ' : s === 'NG' ? '✕ ผิดปกติ' : 'รอตรวจ'}</span>`;
    $('mgrid').innerHTML = d.forklifts.map(m => {
      const isElec = /ไฟฟ้า|electric/i.test(m.model + ' ' + m.name);
      return `
        <div class="mc ${m.status}">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <h3>🚜 ${esc(m.name)}</h3>
            <span class="badge-tag ${isElec ? 'badge-elec' : 'badge-gas'}">${isElec ? '⚡ ไฟฟ้า' : '⛽ น้ำมัน+แก๊ส'}</span>
          </div>
          <small>${esc(m.id)} · ${esc(m.loc)}</small>
          <small>ผู้รับผิดชอบ: ${esc(m.owner)}</small>
          <p>
            ${tag(m.status)}
            ${m.checkedToday ? '<span class="today">✓ ตรวจแล้ววันนี้</span>' : '<span class="today" style="color:var(--mute)">⏳ ยังไม่ตรวจวันนี้</span>'}
          </p>
          <p style="font-size:12px; color:var(--mute);">ล่าสุด: ${esc(m.last || '-')}${m.by ? ' โดย ' + esc(m.by) : ''}</p>
          ${m.ng ? `<p style="color:var(--ng); font-weight:600; font-size:12.5px;">จุดผิดปกติ: ${esc(m.ng)}</p>` : ''}
        </div>
      `;
    }).join('');

    // Recent Logs Table
    $('tRecent').innerHTML = `
      <tr>
        <th>วัน-เวลา</th>
        <th>ผู้ตรวจเช็ค</th>
        <th>รถโฟล์คลิฟท์</th>
        <th>ผลการตรวจ</th>
        <th>จุดผิดปกติ / หมายเหตุ</th>
      </tr>
    ` + (d.recent && d.recent.length ? d.recent.map(r => `
      <tr>
        <td>${esc(r.t)}</td>
        <td>${esc(r.by)}</td>
        <td><b>${esc(r.forklift)}</b></td>
        <td>${tag(r.status)}</td>
        <td>${r.ng ? `<b style="color:var(--ng)">[${esc(r.ng)}]</b> ` : ''}${esc(r.note || '-')}</td>
      </tr>
    `).join('') : `
      <tr><td colspan="5" style="text-align:center; padding:20px; color:var(--mute);">ยังไม่มีประวัติการตรวจเช็ค เริ่มตรวจที่หน้า "ตรวจเช็ค"</td></tr>
    `);

  } catch (err) {
    console.error(err);
    toast('ไม่สามารถโหลดข้อมูลสถิติได้');
  }
}

function generateLocalDashboard() {
  // โหมดจำลอง (Offline): รวมผลที่บันทึกในเครื่องนี้ + ตัวเลขตัวอย่างย้อนหลังสำหรับดูหน้าตา Dashboard
  const localLogs = JSON.parse(localStorage.getItem('fl_local_logs') || '[]');
  const fmtD = d => pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1);
  const fmtT = d => fmtD(d) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  const todayIso = isoDay(new Date());

  const demoOk = [7, 8, 8, 7, 6, 8, 0];
  const demoNg = [0, 0, 1, 0, 1, 0, 0];
  const series = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 864e5);
    const iso = isoDay(d);
    const k = 6 - i;
    const todays = localLogs.filter(l => l.iso === iso);
    series.push({
      d: fmtD(d),
      ok: demoOk[k] + todays.filter(l => l.status === 'OK').length,
      ng: demoNg[k] + todays.filter(l => l.status === 'NG').length
    });
  }

  const forklifts = MOCK_FORKLIFTS.map(m => {
    const lg = localLogs.find(l => l.forkliftId === m.id);
    const today = !!lg && lg.iso === todayIso;
    return {
      id: m.id, name: m.name, model: m.model, loc: m.loc, owner: m.owner, dept: m.dept,
      status: lg ? lg.status : '-',
      checkedToday: today,
      last: lg ? lg.t : '-',
      by: lg ? lg.by : '',
      ng: lg ? lg.ng : ''
    };
  });

  const now = new Date();
  const ago = h => fmtT(new Date(now.getTime() - h * 3600e3));
  const demoRecent = [
    { t: ago(26), by: 'เกรียงไกร ชาญชัย', forklift: 'โฟล์คลิฟท์ไฟฟ้า #2', status: 'NG', ng: 'ระดับน้ำมันไฮดรอลิค', note: 'พบหยดน้ำมันใต้ท้องรถ แจ้งช่างแล้ว (ข้อมูลตัวอย่าง)' },
    { t: ago(27), by: 'มานพ สุขเกษม', forklift: 'โฟล์คลิฟท์ไฟฟ้า #1', status: 'OK', ng: '', note: 'พร้อมใช้งาน (ข้อมูลตัวอย่าง)' },
    { t: ago(28), by: 'สมชาย ใจดี', forklift: 'โฟล์คลิฟท์เครื่องยนต์ #1', status: 'OK', ng: '', note: 'พร้อมใช้งาน (ข้อมูลตัวอย่าง)' }
  ];

  return {
    total: forklifts.filter(m => m.checkedToday).length,
    ngToday: forklifts.filter(m => m.checkedToday && m.status === 'NG').length,
    pending: forklifts.filter(m => !m.checkedToday).length,
    series: series,
    forklifts: forklifts,
    recent: localLogs.length ? localLogs.slice(0, 15) : demoRecent
  };
}

// ----------------------------------------------------
// 9. Settings Modal (Configure Google Apps Script URL)
// ----------------------------------------------------
function openSettings() {
  $('txtApiUrl').value = API_URL;
  $('settingsModal').classList.remove('hide');
}

function closeSettings() {
  $('settingsModal').classList.add('hide');
}

async function testAndSaveApi() {
  const url = $('txtApiUrl').value.trim();
  const testMsg = $('apiTestResult');
  testMsg.textContent = 'กำลังทดสอบเชื่อมต่อไปยัง Google Apps Script...';
  testMsg.style.color = 'var(--navy)';

  if (!url) {
    API_URL = '';
    localStorage.removeItem('fl_gas_url');
    updateApiStatus(false, 'โหมดจำลอง (Offline)');
    testMsg.textContent = 'ล้างการตั้งค่าแล้ว เปลี่ยนเป็นโหมดจำลอง';
    toast('บันทึกโหมดจำลองแล้ว');
    setTimeout(closeSettings, 1200);
    return;
  }

  try {
    const res = await fetch(`${url}?action=ping`, { method: 'GET', redirect: 'follow' });
    const json = await res.json();
    if (json && json.ok) {
      API_URL = url;
      localStorage.setItem('fl_gas_url', API_URL);
      updateApiStatus(true, 'Google Sheet ออนไลน์');
      testMsg.textContent = '✓ เชื่อมต่อ Google Sheet สำเร็จ!';
      testMsg.style.color = 'var(--ok)';
      toast('เชื่อมต่อ Google Sheet สำเร็จแล้ว!');
      FORM = null;
      setTimeout(() => {
        closeSettings();
        if ($('vForm') && !$('vForm').classList.contains('hide')) loadForm();
        else if ($('vDash') && !$('vDash').classList.contains('hide')) loadDash();
      }, 1200);
    } else {
      throw new Error((json && json.error) || 'Invalid response');
    }
  } catch (err) {
    testMsg.textContent = '✕ เชื่อมต่อไม่สำเร็จ กรุณาตรวจสอบว่า Deploy เป็น Web App (Anyone) แล้วหรือไม่';
    testMsg.style.color = 'var(--ng)';
  }
}

window.addEventListener('DOMContentLoaded', () => {
  buildKeys();
  drawDots();

  if (API_URL) {
    updateApiStatus(true, 'เชื่อมต่อ API');
  } else {
    updateApiStatus(false, 'โหมดจำลอง (คลิกเพื่อตั้งค่า)');
  }

  if ($('pinHint')) $('pinHint').classList.toggle('hide', !!API_URL);

  if (TOKEN) {
    enter();
  } else {
    show('login');
  }
});