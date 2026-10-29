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
  showPartViewer(idx);

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
  if (idx >= 0) {
    curFocusIdx = idx;
    sel3DPart(idx);
    showPartViewer(idx);
  }

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

// ============================================================
// 3D ENGINE v2 — โมเดลรถโฟล์คลิฟท์สมจริง + ตัวดูชิ้นส่วนแยก (Part Viewer)
// ============================================================
const PI = Math.PI;
let BODY_C = 0xf08a1c;

const V3 = {
  inited: false, st: null, root: null, drag: null,
  theta: 0.75, phi: 1.15, dist: 13, autoRotate: true,
  parts: [], selectedPart: -1, target: null, tgoal: null, showLabels: true
};

const PV = {
  inited: false, st: null, pivot: null, drag: null,
  rotY: 0.7, rotX: 0.35, zoom: 5.2, auto: true, hidden: false
};

/* ---------------- Materials & geometry helpers ---------------- */
function M(c, o) {
  const m = new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.55, metalness: 0.25 }, o || {}));
  m.userData.e0 = m.emissive.getHex();
  m.userData.i0 = m.emissiveIntensity;
  return m;
}
const GL = (c, op) => M(c, { transparent: true, opacity: op, roughness: 0.08, metalness: 0, depthWrite: false });
const steel = () => M(0x9aa5b1, { metalness: 0.85, roughness: 0.35 });
const chrome = () => M(0xdfe6ed, { metalness: 1, roughness: 0.12 });
const dark = () => M(0x1f2630, { roughness: 0.6, metalness: 0.3 });
const rubber = () => M(0x14171c, { roughness: 0.95, metalness: 0 });
const bodyMat = () => M(BODY_C, { roughness: 0.32, metalness: 0.4 });

function rbox(w, h, d, r) {
  r = r == null ? Math.min(w, h, d) * 0.18 : r;
  const b = Math.max(0.002, Math.min(r * 0.6, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
  const rr = Math.max(0.001, Math.min(r - b, w / 2 - b - 0.001, h / 2 - b - 0.001));
  const W = w - 2 * b, H = h - 2 * b, x = -W / 2, y = -H / 2;
  const s = new THREE.Shape();
  s.moveTo(x + rr, y); s.lineTo(x + W - rr, y); s.quadraticCurveTo(x + W, y, x + W, y + rr);
  s.lineTo(x + W, y + H - rr); s.quadraticCurveTo(x + W, y + H, x + W - rr, y + H);
  s.lineTo(x + rr, y + H); s.quadraticCurveTo(x, y + H, x, y + H - rr);
  s.lineTo(x, y + rr); s.quadraticCurveTo(x, y, x + rr, y);
  const depth = Math.max(0.002, d - 2 * b);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 4 });
  g.translate(0, 0, -depth / 2);
  return g;
}

function put(g, geo, mat, x, y, z, rx, ry, rz) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x || 0, y || 0, z || 0);
  if (rx) m.rotation.x = rx;
  if (ry) m.rotation.y = ry;
  if (rz) m.rotation.z = rz;
  g.add(m);
  return m;
}
const RB = (g, w, h, d, mat, x, y, z, r, rx, ry, rz) => put(g, rbox(w, h, d, r), mat, x, y, z, rx, ry, rz);
const BX = (g, w, h, d, mat, x, y, z, rx, ry, rz) => put(g, new THREE.BoxGeometry(w, h, d), mat, x, y, z, rx, ry, rz);
const CY = (g, r, h, mat, x, y, z, ax, seg) => {
  const m = put(g, new THREE.CylinderGeometry(r, r, h, seg || 28), mat, x, y, z);
  if (ax === 'x') m.rotation.z = PI / 2;
  if (ax === 'z') m.rotation.x = PI / 2;
  return m;
};
const HX = (g, r, h, mat, x, y, z, ax) => CY(g, r, h, mat, x, y, z, ax, 6);
const CN = (g, rt, rb, h, mat, x, y, z, ax) => {
  const m = put(g, new THREE.CylinderGeometry(rt, rb, h, 28), mat, x, y, z);
  if (ax === 'x') m.rotation.z = -PI / 2;
  if (ax === 'z') m.rotation.x = PI / 2;
  return m;
};
const SP = (g, r, mat, x, y, z) => put(g, new THREE.SphereGeometry(r, 20, 14), mat, x, y, z);
const TR = (g, R, t, mat, x, y, z, rx, ry, rz) => put(g, new THREE.TorusGeometry(R, t, 10, 40), mat, x, y, z, rx, ry, rz);
function TB(g, pts, r, mat) {
  const c = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2])));
  return put(g, new THREE.TubeGeometry(c, Math.max(14, pts.length * 12), r, 10, false), mat);
}
function strap(g, a, b, w, t, mat) {
  const A = new THREE.Vector3(a[0], a[1], a[2]), B = new THREE.Vector3(b[0], b[1], b[2]);
  const d = B.clone().sub(A), len = d.length();
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, t, len), mat);
  m.position.copy(A.clone().add(B).multiplyScalar(0.5));
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d.normalize());
  g.add(m);
  return m;
}
function disposeObj(o) {
  if (!o) return;
  o.traverse(n => {
    if (n.geometry) n.geometry.dispose();
    if (n.material) {
      (Array.isArray(n.material) ? n.material : [n.material]).forEach(m => {
        if (m.map) m.map.dispose();
        m.dispose();
      });
    }
  });
}

/* ---------------- Wheel (pneumatic / solid) ---------------- */
function wheelAt(g, R, W, solid, side, x, y, z) {
  const w = new THREE.Group();
  w.position.set(x, y, z);
  const ri = R * 0.58, h = W / 2, c = solid ? R * 0.03 : R * 0.07;
  const prof = [[ri, -h], [R - c, -h], [R - 0.01, -h + c * 0.9], [R, -h + c * 2], [R, h - c * 2], [R - 0.01, h - c * 0.9], [R - c, h], [ri, h]]
    .map(p => new THREE.Vector2(p[0], p[1]));
  put(w, new THREE.LatheGeometry(prof, 44), M(solid ? 0x2b2f36 : 0x15181d, { roughness: 0.9, metalness: 0, side: THREE.DoubleSide }), 0, 0, 0, 0, 0, PI / 2);
  if (!solid) {
    const lug = M(0x0d0f12, { roughness: 0.95, metalness: 0 });
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * PI * 2;
      put(w, new THREE.BoxGeometry(W * 0.82, 0.045, R * 0.2), lug, 0, Math.cos(a) * R, Math.sin(a) * R, a);
    }
  } else {
    CY(w, ri + 0.02, W * 0.9, M(0x9ca3af, { metalness: 0.8, roughness: 0.4 }), 0, 0, 0, 'x');
    [-1, 1].forEach(k => TR(w, R - 0.02, 0.012, M(0x0d0f12), k * W * 0.2, 0, 0, 0, PI / 2));
  }
  CY(w, ri * 0.98, W * 0.62, M(0xc9d1d9, { metalness: 0.8, roughness: 0.35 }), 0, 0, 0, 'x');
  [-1, 1].forEach(k => TR(w, ri * 0.98, 0.02, steel(), k * W * 0.31, 0, 0, 0, PI / 2));
  CY(w, ri * 0.72, 0.05, M(0x7b8794, { metalness: 0.7, roughness: 0.45 }), side * W * 0.3, 0, 0, 'x');
  CY(w, ri * 0.3, 0.1, steel(), side * W * 0.34, 0, 0, 'x');
  CY(w, ri * 0.14, 0.12, M(BODY_C, { metalness: 0.5, roughness: 0.4 }), side * W * 0.38, 0, 0, 'x');
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * PI * 2;
    HX(w, 0.03, 0.06, chrome(), side * W * 0.34, Math.cos(a) * ri * 0.55, Math.sin(a) * ri * 0.55, 'x');
  }
  g.add(w);
  return w;
}

/* ---------------- Part builders (ชิ้นส่วนแต่ละจุดตรวจ) ---------------- */
function pEngine() {
  const g = new THREE.Group();
  RB(g, 0.9, 0.62, 0.95, M(0x5b6672, { metalness: 0.7, roughness: 0.42 }), 0, 0, 0, 0.07);
  RB(g, 0.84, 0.14, 0.9, M(0x2b3138, { metalness: 0.5, roughness: 0.5 }), 0, 0.38, 0, 0.04);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) CY(g, 0.028, 0.04, steel(), (i - 1) * 0.28, 0.46, j ? 0.3 : -0.3);
  RB(g, 0.72, 0.18, 0.82, dark(), 0, -0.4, 0, 0.05);
  CY(g, 0.02, 0.5, steel(), 0.5, 0.12, 0.2);
  TR(g, 0.045, 0.012, M(0xfacc15, { roughness: 0.4 }), 0.5, 0.4, 0.2, 0, PI / 2);
  CY(g, 0.09, 0.07, M(0xdc2626, { roughness: 0.5 }), -0.38, 0.47, -0.2);
  CY(g, 0.1, 0.02, dark(), -0.38, 0.43, -0.2);
  TB(g, [[-0.46, 0.2, 0.3], [-0.62, 0.2, 0.12], [-0.62, 0.1, -0.28], [-0.46, 0, -0.46]], 0.05, M(0x7c5a47, { metalness: 0.8, roughness: 0.65 }));
  CY(g, 0.2, 0.07, steel(), 0, -0.05, 0.52, 'z');
  TR(g, 0.2, 0.02, rubber(), 0, -0.05, 0.52);
  CY(g, 0.1, 0.28, M(0xea580c, { metalness: 0.4, roughness: 0.5 }), -0.52, -0.12, 0.2, 'x');
  return g;
}

function pCoolant() {
  const g = new THREE.Group();
  BX(g, 1.3, 0.85, 0.16, M(0x2a2f36, { metalness: 0.6 }), 0, 0, 0);
  const fin = M(0xaeb7c2, { metalness: 0.9, roughness: 0.4 });
  for (let i = -30; i <= 30; i++) BX(g, 0.012, 0.8, 0.17, fin, i * 0.0205, 0, 0);
  RB(g, 1.4, 0.14, 0.24, M(0x3a424c, { metalness: 0.6 }), 0, 0.5, 0, 0.05);
  RB(g, 1.4, 0.14, 0.24, M(0x3a424c, { metalness: 0.6 }), 0, -0.5, 0, 0.05);
  TR(g, 0.4, 0.035, dark(), 0, 0, 0.18);
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * PI * 2 + 0.3;
    BX(g, 0.34, 0.09, 0.015, dark(), Math.cos(a) * 0.19, Math.sin(a) * 0.19, 0.18, 0, 0, a);
  }
  CY(g, 0.07, 0.06, steel(), 0, 0, 0.18, 'z');
  RB(g, 0.26, 0.5, 0.2, GL(0xe8f1f8, 0.35), 0.5, 0.85, 0, 0.04);
  RB(g, 0.23, 0.28, 0.17, M(0x4ade80, { transparent: true, opacity: 0.85, emissive: 0x0f5132, emissiveIntensity: 0.4, roughness: 0.2 }), 0.5, 0.74, 0, 0.03);
  BX(g, 0.27, 0.014, 0.205, dark(), 0.5, 0.96, 0);
  BX(g, 0.27, 0.014, 0.205, dark(), 0.5, 0.72, 0);
  CY(g, 0.07, 0.07, M(0xdc2626, { roughness: 0.5 }), 0.5, 1.13, 0);
  TB(g, [[0.5, 0.6, 0], [0.55, 0.52, 0.04], [0.6, 0.45, 0.08]], 0.025, rubber());
  return g;
}

function pBrakeFluid() {
  const g = new THREE.Group();
  RB(g, 0.7, 0.06, 0.3, dark(), 0, -0.18, 0, 0.02);
  CY(g, 0.07, 0.5, M(0x7b8794, { metalness: 0.8, roughness: 0.4 }), 0, -0.06, 0, 'x');
  CY(g, 0.02, 0.35, chrome(), 0.42, -0.06, 0, 'x');
  [-0.18, 0.18].forEach((x, i) => {
    RB(g, 0.2, 0.3, 0.16, GL(0xf1f5f9, 0.4), x, 0.12, 0, 0.03);
    RB(g, 0.17, 0.17, 0.13, M(i ? 0xfbbf24 : 0xf59e0b, { transparent: true, opacity: 0.85, emissive: 0x7c4a03, emissiveIntensity: 0.3, roughness: 0.2 }), x, 0.05, 0, 0.02);
    CY(g, 0.075, 0.06, rubber(), x, 0.3, 0);
    BX(g, 0.2, 0.01, 0.165, dark(), x, 0.2, 0);
  });
  TB(g, [[-0.3, -0.06, 0], [-0.45, -0.2, 0.1], [-0.5, -0.4, 0.3]], 0.02, steel());
  TB(g, [[-0.25, -0.1, 0.05], [-0.4, -0.3, -0.05], [-0.48, -0.5, 0.1]], 0.02, steel());
  return g;
}

function pBattery(solo) {
  const g = new THREE.Group();
  RB(g, 0.62, 0.4, 0.34, M(0x1e3a5f, { roughness: 0.7, metalness: 0.1 }), 0, 0, 0, 0.03);
  RB(g, 0.64, 0.06, 0.36, M(0x0f2742, { roughness: 0.7, metalness: 0.1 }), 0, 0.2, 0, 0.02);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) CY(g, 0.032, 0.045, M(0xf1f5f9, { roughness: 0.6 }), (i - 1) * 0.18, 0.25, (j - 0.5) * 0.16);
  CY(g, 0.028, 0.09, M(0x9ca3af, { metalness: 0.9 }), -0.26, 0.26, -0.1);
  CY(g, 0.028, 0.09, M(0x9ca3af, { metalness: 0.9 }), 0.26, 0.26, -0.1);
  RB(g, 0.08, 0.05, 0.08, M(0xdc2626), -0.26, 0.3, -0.1, 0.01);
  RB(g, 0.08, 0.05, 0.08, M(0x111827), 0.26, 0.3, -0.1, 0.01);
  BX(g, 0.3, 0.12, 0.006, M(0xfacc15), 0, 0, 0.172);
  TR(g, 0.08, 0.012, dark(), 0, 0.24, 0.14, PI / 2);
  if (solo) {
    CY(g, 0.1, 0.3, GL(0xffffff, 0.55), 0.7, -0.05, 0);
    CY(g, 0.088, 0.2, M(0x7dd3fc, { transparent: true, opacity: 0.75, roughness: 0.1 }), 0.7, -0.1, 0);
    CY(g, 0.045, 0.05, M(0x2563eb), 0.7, 0.13, 0);
  }
  return g;
}

function pBatteryElec() {
  const g = new THREE.Group();
  RB(g, 1.6, 0.82, 1.4, M(0x3b4a5a, { metalness: 0.6, roughness: 0.5 }), 0, 0, 0, 0.06);
  RB(g, 1.64, 0.08, 1.44, M(0x1b222b, { metalness: 0.4, roughness: 0.6 }), 0, 0.45, 0, 0.03);
  for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) {
    const x = (i - 2.5) * 0.26, z = (j - 0.5) * 0.5;
    CY(g, 0.06, 0.07, M(0xf1f5f9, { roughness: 0.6 }), x, 0.52, z);
    CY(g, 0.018, 0.05, M(0x22c55e, { emissive: 0x16a34a, emissiveIntensity: 0.5 }), x, 0.58, z);
  }
  [-0.5, 0.5].forEach(z => BX(g, 1.7, 0.05, 0.08, M(0xfacc15, { roughness: 0.5 }), 0, 0.5, z * 1.2));
  TB(g, [[0.55, 0.5, -0.6], [0.7, 0.7, -0.55], [0.9, 0.65, -0.3], [0.95, 0.3, -0.1]], 0.05, M(0xdc2626, { roughness: 0.6 }));
  RB(g, 0.12, 0.2, 0.2, M(0xdc2626), 0.95, 0.1, -0.1, 0.03);
  return g;
}

function pTerminals() {
  const g = new THREE.Group();
  RB(g, 0.7, 0.1, 0.35, dark(), 0, -0.15, 0, 0.03);
  [[-0.2, 0xdc2626], [0.2, 0x111827]].forEach(([x, col]) => {
    CY(g, 0.05, 0.22, M(0x9ca3af, { metalness: 0.9, roughness: 0.3 }), x, 0, 0);
    RB(g, 0.16, 0.1, 0.14, M(col, { roughness: 0.5 }), x, 0.1, 0, 0.03);
    HX(g, 0.025, 0.06, chrome(), x, 0.1, 0.09, 'z');
    CY(g, 0.07, 0.1, M(col, { roughness: 0.6 }), x, 0.2, 0);
    TB(g, [[x, 0.1, -0.08], [x, 0.0, -0.3], [x * 1.4, -0.1, -0.6]], 0.035, M(col, { roughness: 0.6 }));
  });
  return g;
}

function pChargePlug() {
  const g = new THREE.Group();
  RB(g, 0.34, 0.24, 0.42, M(0xdc2626, { roughness: 0.5, metalness: 0.1 }), 0, 0, 0, 0.05);
  RB(g, 0.2, 0.14, 0.3, M(0x374151, { roughness: 0.7 }), 0, 0.17, -0.05, 0.04);
  [-0.07, 0.07].forEach(x => CY(g, 0.045, 0.22, M(0xb87333, { metalness: 1, roughness: 0.25 }), x, 0, 0.3, 'z'));
  CY(g, 0.1, 0.12, dark(), 0, 0, -0.26, 'z');
  TB(g, [[0, 0, -0.3], [0, -0.1, -0.55], [0.2, -0.3, -0.8], [0.4, -0.4, -1.0]], 0.07, rubber());
  RB(g, 0.5, 0.4, 0.12, dark(), 0, 0, 0.62, 0.04);
  [-0.07, 0.07].forEach(x => CY(g, 0.05, 0.04, M(0x0b0e12), x, 0, 0.56, 'z'));
  return g;
}

function pHydTank() {
  const g = new THREE.Group();
  RB(g, 0.38, 0.8, 0.9, M(0x0d5c82, { metalness: 0.5, roughness: 0.45 }), 0, 0, 0, 0.05);
  [-0.2, 0.15].forEach(y => BX(g, 0.4, 0.035, 0.92, M(0x0a4a69, { metalness: 0.5 }), 0, y, 0));
  CY(g, 0.1, 0.04, chrome(), 0.2, 0.1, 0.2, 'x');
  CY(g, 0.08, 0.05, GL(0xf59e0b, 0.8), 0.215, 0.1, 0.2, 'x');
  BX(g, 0.02, 0.2, 0.05, dark(), 0.22, 0.1, 0.34);
  CY(g, 0.09, 0.1, dark(), 0, 0.45, -0.2);
  CY(g, 0.05, 0.12, steel(), 0, 0.55, -0.2);
  HX(g, 0.04, 0.06, steel(), 0.2, -0.36, 0.3, 'x');
  TB(g, [[0, 0.3, 0.45], [0.05, 0.5, 0.5], [-0.1, 0.65, 0.65]], 0.04, M(0x16191f));
  return g;
}

function pMast() {
  const g = new THREE.Group();
  const st = () => M(0x2f3944, { metalness: 0.7, roughness: 0.45 });
  const lt = () => M(0x7b8794, { metalness: 0.8, roughness: 0.38 });
  const cm = () => M(0x1f2630, { metalness: 0.6, roughness: 0.5 });
  [-1, 1].forEach(s => {
    RB(g, 0.2, 3.3, 0.26, st(), s * 0.7, 1.65, 0, 0.03);
    RB(g, 0.15, 3.1, 0.18, lt(), s * 0.5, 1.7, 0.1, 0.02);
    CY(g, 0.07, 0.75, st(), s * 0.84, 0.95, -0.6, 'z');
    CY(g, 0.035, 0.6, chrome(), s * 0.84, 0.95, -0.15, 'z');
  });
  BX(g, 1.6, 0.1, 0.14, st(), 0, 3.3, 0);
  BX(g, 1.5, 0.12, 0.2, st(), 0, 0.2, 0);
  CY(g, 0.11, 1.5, st(), 0, 0.95, -0.2);
  CY(g, 0.075, 1.8, chrome(), 0, 1.7, -0.2);
  RB(g, 1.52, 0.12, 0.12, cm(), 0, 0.42, 0.2, 0.02);
  RB(g, 1.52, 0.12, 0.12, cm(), 0, 1.05, 0.2, 0.02);
  for (let i = -3; i <= 3; i++) RB(g, 0.06, 1.3, 0.06, cm(), i * 0.2, 1.1, 0.22, 0.02);
  RB(g, 1.4, 0.07, 0.07, cm(), 0, 1.75, 0.22, 0.02);
  RB(g, 1.4, 0.06, 0.06, cm(), 0, 1.4, 0.22, 0.02);
  [-0.45, 0.45].forEach(x => {
    const f = new THREE.Group();
    f.position.set(x, 0.06, 0.27);
    const fm = () => M(0x8b95a1, { metalness: 0.85, roughness: 0.38 });
    RB(f, 0.17, 0.85, 0.07, fm(), 0, 0.43, 0, 0.02);
    const sh = new THREE.Shape();
    sh.moveTo(0, 0); sh.lineTo(1.5, 0); sh.lineTo(1.5, 0.03); sh.lineTo(0.3, 0.075); sh.lineTo(0, 0.075); sh.lineTo(0, 0);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.17, bevelEnabled: false });
    geo.translate(0, 0, -0.085);
    const b = new THREE.Mesh(geo, fm());
    b.rotation.y = -PI / 2;
    b.position.z = -0.035;
    f.add(b);
    BX(f, 0.12, 0.03, 0.12, M(0xfacc15), 0, 0.88, 0);
    g.add(f);
  });
  return g;
}

function pWheel(solo, ctx) {
  const g = new THREE.Group(), el = ctx && ctx.elec;
  if (solo) {
    wheelAt(g, el ? 0.42 : 0.5, el ? 0.34 : 0.38, el, 1, 0, 0, 0);
    CY(g, 0.07, 0.5, steel(), -0.35, 0, 0, 'x');
    return g;
  }
  [-1, 1].forEach(s => {
    wheelAt(g, 0.5, 0.38, el, s, s * 1.0, 0.5, 0.9);
    wheelAt(g, 0.42, 0.32, el, s, s * 0.82, 0.42, -1.3);
  });
  return g;
}

function pHoses() {
  const g = new THREE.Group();
  const hose = () => M(0x16191f, { roughness: 0.7, metalness: 0.1 });
  RB(g, 0.9, 0.28, 0.22, M(0xd9a406, { metalness: 0.6, roughness: 0.4 }), 0, 1.3, -0.8, 0.03);
  [-0.2, 0.2].forEach(x => {
    CY(g, 0.015, 0.3, steel(), x, 1.5, -0.8);
    SP(g, 0.04, M(0xdc2626, { roughness: 0.4 }), x, 1.66, -0.8);
  });
  [-1, 1].forEach(s => {
    const a = [[s * 0.4, 1.3, -0.72], [s * 0.46, 1.2, -0.4], [s * 0.42, 1.6, -0.26], [s * 0.4, 2.3, -0.25], [s * 0.38, 3.05, -0.25]];
    const b = [[s * 0.28, 1.3, -0.72], [s * 0.3, 1.1, -0.45], [s * 0.3, 1.5, -0.3], [s * 0.3, 2.3, -0.3], [s * 0.3, 3.0, -0.3]];
    TB(g, a, 0.034, hose());
    TB(g, b, 0.028, hose());
    [a, b].forEach((p, i) => {
      HX(g, 0.055, 0.1, chrome(), p[0][0], p[0][1], p[0][2] - 0.03, 'z');
      HX(g, 0.055, 0.1, chrome(), p[4][0], p[4][1] + 0.02, p[4][2]);
      CY(g, 0.04, 0.08, M(i ? 0x2563eb : 0xdc2626, { roughness: 0.5 }), p[3][0], p[3][1], p[3][2]);
    });
  });
  return g;
}

function headlight(g, x, y, z, s) {
  const h = new THREE.Group();
  h.position.set(x, y, z);
  if (s) h.scale.setScalar(s);
  RB(h, 0.3, 0.24, 0.16, dark(), 0, 0, -0.02, 0.04);
  CY(h, 0.1, 0.04, chrome(), 0, 0, 0.07, 'z');
  CY(h, 0.085, 0.03, M(0xfff4c2, { emissive: 0xffe9a0, emissiveIntensity: 0.8, roughness: 0.1 }), 0, 0, 0.09, 'z');
  g.add(h);
}
function taillight(g, x, y, z, s) {
  const h = new THREE.Group();
  h.position.set(x, y, z);
  if (s) h.scale.setScalar(s);
  RB(h, 0.3, 0.14, 0.08, M(0xb91c1c, { emissive: 0xff2020, emissiveIntensity: 0.35, roughness: 0.2 }), 0, 0, 0, 0.03);
  RB(h, 0.1, 0.1, 0.085, M(0xf8fafc, { emissive: 0xffffff, emissiveIntensity: 0.3 }), 0.1, 0, 0, 0.02);
  g.add(h);
}
function beacon(g, x, y, z, s) {
  const h = new THREE.Group();
  h.position.set(x, y, z);
  if (s) h.scale.setScalar(s);
  CY(h, 0.1, 0.06, dark(), 0, 0, 0);
  put(h, new THREE.SphereGeometry(0.15, 24, 14, 0, PI * 2, 0, PI / 2), M(0xf59e0b, { emissive: 0xf59e0b, emissiveIntensity: 0.7, transparent: true, opacity: 0.9, side: THREE.DoubleSide }), 0, 0.03, 0);
  g.add(h);
}
function horn(g, x, y, z, s) {
  const h = new THREE.Group();
  h.position.set(x, y, z);
  if (s) h.scale.setScalar(s);
  CY(h, 0.07, 0.1, M(0x374151, { metalness: 0.7 }), 0, 0, -0.1, 'z');
  CN(h, 0.15, 0.05, 0.22, M(0x6b7280, { metalness: 0.9, roughness: 0.3 }), 0, 0, 0.05, 'z');
  g.add(h);
}
function pLights(solo) {
  const g = new THREE.Group();
  if (solo) {
    headlight(g, -0.55, 0, 0, 1.4);
    taillight(g, -0.05, 0, 0, 1.4);
    beacon(g, 0.45, -0.05, 0, 1.2);
    horn(g, 0.95, 0, 0, 1.2);
    return g;
  }
  [-1, 1].forEach(s => { headlight(g, s * 0.8, 3.05, 0.68); taillight(g, s * 0.8, 1.3, -2.24); });
  beacon(g, 0, 3.55, -0.3);
  horn(g, 0.45, 1.0, 1.0);
  return g;
}

function pBrake() {
  const g = new THREE.Group();
  CY(g, 0.025, 0.9, dark(), 0, 0.52, -0.1, 'x');
  [[-0.25, 0.14, 0.12], [0, 0.22, 0.14], [0.25, 0.14, 0.12]].forEach(([x, w, d], i) => {
    const arm = CY(g, 0.02, 0.5, steel(), x, 0.28, -0.04);
    arm.rotation.x = -0.35;
    const pad = RB(g, w, 0.04, d, rubber(), x, 0.0, 0.06, 0.01);
    pad.rotation.x = -0.4;
    if (i === 1) for (let k = -2; k <= 2; k++) BX(g, w * 0.9, 0.012, 0.012, M(0x3a424c), x, 0.025, 0.06 + k * 0.025).rotation.x = -0.4;
  });
  RB(g, 0.1, 0.16, 0.2, dark(), 0.6, 0.05, -0.1, 0.02);
  const lev = CY(g, 0.018, 0.5, steel(), 0.6, 0.3, -0.2);
  lev.rotation.x = -0.5;
  const grip = CY(g, 0.035, 0.18, M(0x111827, { roughness: 0.8 }), 0.6, 0.52, -0.3);
  grip.rotation.x = -0.5;
  CY(g, 0.018, 0.03, M(0xdc2626), 0.6, 0.6, -0.34);
  return g;
}

function mirrorUnit(g, s, x) {
  const u = new THREE.Group();
  u.position.set(x, 0, 0);
  TB(u, [[0, 0, 0], [s * 0.12, 0.04, -0.02], [s * 0.3, 0.1, -0.05]], 0.018, dark());
  RB(u, 0.3, 0.36, 0.06, dark(), s * 0.4, 0.14, -0.08, 0.04);
  BX(u, 0.25, 0.3, 0.012, M(0xd8ecf8, { metalness: 1, roughness: 0.04 }), s * 0.4, 0.14, -0.115);
  g.add(u);
}
function pMirror(solo) {
  const g = new THREE.Group();
  if (solo) { mirrorUnit(g, 1, 0); return g; }
  mirrorUnit(g, -1, -0.88);
  mirrorUnit(g, 1, 0.88);
  return g;
}

function pSteering() {
  const g = new THREE.Group();
  const tg = new THREE.Group();
  tg.rotation.x = -0.5;
  CY(tg, 0.045, 0.7, dark(), 0, 0.35, 0);
  const vin = M(0x20252c, { roughness: 0.85, metalness: 0 });
  TR(tg, 0.27, 0.03, vin, 0, 0.72, 0, -PI / 2);
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * PI * 2 + PI / 2;
    BX(tg, 0.27, 0.025, 0.04, vin, Math.cos(a) * 0.135, 0.72, Math.sin(a) * 0.135, 0, -a);
  }
  CY(tg, 0.07, 0.06, dark(), 0, 0.72, 0);
  CY(tg, 0.045, 0.03, M(0x7b8794, { metalness: 0.8 }), 0.27, 0.77, 0);
  CY(tg, 0.03, 0.14, M(0x111827, { roughness: 0.8 }), 0.27, 0.85, 0);
  g.add(tg);
  RB(g, 0.5, 0.18, 0.12, dark(), 0, 0.2, -0.12, 0.03);
  [-0.15, 0, 0.15].forEach(x => CY(g, 0.045, 0.012, M(0xe2e8f0, { emissive: 0x334155, emissiveIntensity: 0.4 }), x, 0.2, -0.185, 'z'));
  return g;
}

function pSeatbelt() {
  const g = new THREE.Group();
  const vin = M(0x20252c, { roughness: 0.9, metalness: 0 });
  RB(g, 0.62, 0.18, 0.56, dark(), 0, -0.28, 0, 0.04);
  RB(g, 0.8, 0.16, 0.74, vin, 0, 0, 0, 0.07);
  [-1, 1].forEach(s => RB(g, 0.1, 0.12, 0.6, vin, s * 0.4, 0.07, 0, 0.04));
  RB(g, 0.78, 0.9, 0.14, vin, 0, 0.5, -0.38, 0.07, -0.15);
  RB(g, 0.5, 0.28, 0.12, vin, 0, 1.08, -0.43, 0.05, -0.15);
  const belt = M(0xf97316, { roughness: 0.75, metalness: 0 });
  strap(g, [-0.3, 0.95, -0.31], [0.2, 0.12, 0.12], 0.07, 0.012, belt);
  strap(g, [-0.42, 0.08, -0.15], [0.2, 0.12, 0.12], 0.07, 0.012, belt);
  RB(g, 0.07, 0.14, 0.03, chrome(), 0.2, 0.13, 0.13, 0.01);
  BX(g, 0.04, 0.05, 0.012, M(0xdc2626), 0.2, 0.17, 0.15);
  RB(g, 0.1, 0.2, 0.1, dark(), -0.44, 0.55, -0.4, 0.02);
  return g;
}

function pChain() {
  const g = new THREE.Group();
  const mat = M(0x6b7280, { metalness: 0.9, roughness: 0.35 });
  [-0.28, 0.28].forEach(x => {
    for (let i = 0; i < 30; i++) {
      const t = put(g, new THREE.TorusGeometry(0.05, 0.013, 8, 14), mat, x, i * 0.072, 0, 0, (i % 2) * PI / 2, 0);
      t.scale.set(1, 1.55, 1);
    }
    CY(g, 0.2, 0.06, steel(), x, 2.22, -0.06, 'x');
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * PI * 2;
      BX(g, 0.06, 0.06, 0.05, steel(), x, 2.22 + Math.cos(a) * 0.21, -0.06 + Math.sin(a) * 0.21, a);
    }
    BX(g, 0.1, 0.12, 0.08, dark(), x, -0.08, 0);
    CY(g, 0.02, 0.14, chrome(), x, -0.08, 0, 'x');
  });
  BX(g, 0.8, 0.06, 0.1, steel(), 0, 2.22, -0.14);
  return g;
}

function pGeneric() {
  const g = new THREE.Group();
  RB(g, 0.6, 0.4, 0.4, dark(), 0, 0, 0, 0.05);
  CY(g, 0.08, 0.1, M(0xf08a1c), 0, 0.25, 0);
  return g;
}

const PART_DEFS = {
  engine:      { build: pEngine,      pos: () => [0, 1.1, -0.4] },
  coolant:     { build: pCoolant,     pos: () => [0, 1.3, -1.14] },
  brakeFluid:  { build: pBrakeFluid,  pos: () => [0.38, 1.22, 0.2] },
  battery:     { build: pBattery,     pos: () => [-1.2, 0.98, -0.45], rot: [0, PI / 2, 0] },
  batteryElec: { build: pBatteryElec, pos: () => [0, 1.1, -0.45] },
  terminals:   { build: pTerminals,   pos: () => [0.55, 1.62, -1.0] },
  chargePlug:  { build: pChargePlug,  pos: () => [1.2, 1.0, -1.1], rot: [0, PI / 2, 0] },
  hydTank:     { build: pHydTank,     pos: () => [1.2, 1.05, -0.15] },
  mast:        { build: pMast,        pos: () => [0, 0, 1.65] },
  wheel:       { build: pWheel,       pos: () => [0, 0, 0] },
  hoses:       { build: pHoses,       pos: () => [0, 0, 1.65] },
  lights:      { build: pLights,      pos: () => [0, 0, 0] },
  brake:       { build: pBrake,       pos: () => [0, 0.85, 0.22] },
  mirror:      { build: pMirror,      pos: () => [0, 2.6, 0.55] },
  steering:    { build: pSteering,    pos: () => [0, 1.55, 0.5] },
  seatbelt:    { build: pSeatbelt,    pos: e => [0, e ? 2.08 : 2.0, -0.4] },
  chain:       { build: pChain,       pos: () => [0, 1.1, 1.9] },
  generic:     { build: pGeneric,     pos: () => [0, 1.5, 0] }
};

// จับคู่ "จุดตรวจ" กับชิ้นส่วน 3D จากชื่อรายการ (ใช้ได้กับรายการที่แก้ไขใน Google Sheet)
function partKeyFor(it, elec) {
  const t = (it && it.point) || '';
  if (/น้ำมันเครื่อง/.test(t)) return 'engine';
  if (/หม้อพักน้ำ|หม้อน้ำ|น้ำยาหล่อเย็น/.test(t)) return 'coolant';
  if (/ครัช|คลัทช์|คลัช/.test(t)) return 'brakeFluid';
  if (/น้ำกลั่น/.test(t)) return elec ? 'batteryElec' : 'battery';
  if (/ขั้วแบต/.test(t)) return 'terminals';
  if (/ปลั๊ก|ชาร์จ/.test(t)) return 'chargePlug';
  if (/สายไฮ/.test(t)) return 'hoses';
  if (/ไฮดรอลิค|ไฮดรอลิก/.test(t)) return 'hydTank';
  if (/เสา|งา/.test(t)) return 'mast';
  if (/ล้อ|ยาง/.test(t)) return 'wheel';
  if (/ไฟ|แตร/.test(t)) return 'lights';
  if (/กระจก/.test(t)) return 'mirror';
  if (/พวงมาลัย/.test(t)) return 'steering';
  if (/เข็มขัด|เบาะ/.test(t)) return 'seatbelt';
  if (/โซ่/.test(t)) return 'chain';
  if (/เบรค|เบรก/.test(t)) return 'brake';
  return 'generic';
}

/* ---------------- ตัวรถ (Chassis) ---------------- */
function buildBase(g, elec) {
  const gm = () => M(0x20262d, { metalness: 0.6, roughness: 0.45 });
  RB(g, 1.85, 0.14, 2.2, M(0x3a4048, { roughness: 0.8, metalness: 0.5 }), 0, 0.72, 0.15, 0.03);
  for (let i = 0; i < 9; i++) BX(g, 1.7, 0.012, 0.04, M(0x555d66), 0, 0.8, -0.85 + i * 0.24);
  [-1, 1].forEach(s => RB(g, 0.26, 0.5, 3.2, bodyMat(), s * 0.97, 0.6, -0.4, 0.08));
  RB(g, 2.1, 1.35, 1.05, bodyMat(), 0, 1.02, -1.7, 0.28);
  RB(g, 2.05, 0.2, 0.08, rubber(), 0, 0.5, -2.25, 0.03);
  RB(g, 1.5, 0.95, 0.5, bodyMat(), 0, 1.05, 0.55, 0.12);
  RB(g, 1.3, 0.06, 0.46, dark(), 0, 1.55, 0.55, 0.02);
  [-1, 1].forEach(s => {
    RB(g, 0.62, 0.1, 1.15, bodyMat(), s * 1.02, 1.12, 0.9, 0.04);
    RB(g, 0.36, 0.06, 0.5, M(0x2a2f36, { roughness: 0.8 }), s * 1.2, 0.62, 0.05, 0.02);
  });
  CY(g, 0.09, 2.0, dark(), 0, 0.5, 0.9, 'x');
  CY(g, 0.07, 1.6, dark(), 0, 0.42, -1.3, 'x');
  [-1, 1].forEach(s => {
    CY(g, 0.04, 2.7, gm(), s * 0.86, 2.15, 0.55);
    CY(g, 0.04, 2.7, gm(), s * 0.86, 2.15, -1.15);
    CY(g, 0.035, 1.8, gm(), s * 0.86, 3.5, -0.3, 'z');
  });
  CY(g, 0.035, 1.76, gm(), 0, 3.5, 0.55, 'x');
  CY(g, 0.035, 1.76, gm(), 0, 3.5, -1.15, 'x');
  for (let i = 0; i < 9; i++) CY(g, 0.016, 1.7, gm(), -0.7 + i * 0.175, 3.5, -0.3, 'z');
  TB(g, [[-0.86, 1.6, 0.55], [-1.05, 1.9, 0.45], [-0.86, 2.5, 0.4]], 0.025, chrome());
  if (!elec) {
    CY(g, 0.27, 0.95, M(0xb8c0c8, { metalness: 0.8, roughness: 0.3 }), 0, 2.0, -1.75, 'x');
    SP(g, 0.27, M(0xb8c0c8, { metalness: 0.8, roughness: 0.3 }), -0.475, 2.0, -1.75);
    SP(g, 0.27, M(0xb8c0c8, { metalness: 0.8, roughness: 0.3 }), 0.475, 2.0, -1.75);
    [-0.25, 0.25].forEach(x => BX(g, 0.05, 0.6, 0.6, dark(), x, 1.85, -1.75));
    CY(g, 0.06, 0.35, M(0x4b3b32, { metalness: 0.6, roughness: 0.7 }), 0.6, 0.8, -2.4, 'z');
  } else {
    RB(g, 0.8, 0.12, 0.03, M(0x111827), 0, 1.2, -2.24, 0.01);
  }
}

/* ---------------- Stage (renderer + env + lights) ---------------- */
function makeEnvScene() {
  const s = new THREE.Scene();
  const geo = new THREE.SphereGeometry(40, 32, 16), pos = geo.attributes.position, col = [];
  const top = new THREE.Color(0xeaf2fa), mid = new THREE.Color(0xb7c3cf), bot = new THREE.Color(0x4a545e), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getY(i) / 40;
    if (t > 0) c.copy(mid).lerp(top, Math.pow(t, 0.6)); else c.copy(mid).lerp(bot, Math.min(1, -t * 1.6));
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  s.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const lamp = (w, h, x, y, z, k) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k, k), side: THREE.DoubleSide }));
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    s.add(m);
  };
  lamp(18, 8, 14, 22, 10, 5); lamp(10, 10, -22, 12, -6, 2.5); lamp(24, 4, 0, 10, -24, 2);
  return s;
}

function makeStage(canvas, shadowR) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  let hasEnv = false;
  try {
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(makeEnvScene(), 0.02).texture;
    pm.dispose();
    hasEnv = true;
  } catch (e) { console.warn('env map skipped', e); }
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8c98a4, hasEnv ? 0.28 : 0.9));
  const sun = new THREE.DirectionalLight(0xffffff, hasEnv ? 0.9 : 0.85);
  sun.position.set(6, 12, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -shadowR; sc.right = shadowR; sc.top = shadowR; sc.bottom = -shadowR; sc.near = 1; sc.far = 40;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
  return { renderer, scene, camera, sun };
}

function fitStage(st, canvas) {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return false;
  const pr = st.renderer.getPixelRatio();
  if (canvas.width !== Math.round(w * pr) || canvas.height !== Math.round(h * pr)) {
    st.renderer.setSize(w, h, false);
    st.camera.aspect = w / h;
    st.camera.updateProjectionMatrix();
  }
  return true;
}

function shadowize(root) {
  root.traverse(o => {
    if (o.isMesh) {
      o.castShadow = !(o.material && o.material.transparent);
      o.receiveShadow = true;
    }
  });
}

function setGlow(group, on) {
  group.traverse(o => {
    if (o.isMesh && o.material && o.material.emissive) {
      const m = o.material;
      if (on) { m.emissive.setHex(0xf08a1c); m.emissiveIntensity = 0.5; }
      else { m.emissive.setHex(m.userData.e0 || 0); m.emissiveIntensity = m.userData.i0 == null ? 1 : m.userData.i0; }
    }
  });
}

/* ---------------- Main 3D viewer ---------------- */
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
  const tex = new THREE.CanvasTexture(c);
  tex.encoding = THREE.sRGBEncoding;
  return tex;
}

function init3D() {
  if (V3.inited) return true;
  try {
    if (!window.THREE) return false;
    const canvas = $('cv');
    if (!canvas) return false;
    V3.st = makeStage(canvas, 9);
    const scene = V3.st.scene;

    const floor = new THREE.Mesh(new THREE.CircleGeometry(9, 64), new THREE.MeshStandardMaterial({ color: 0xdfe5ea, roughness: 0.92, metalness: 0 }));
    floor.rotation.x = -PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    const ring = new THREE.Mesh(new THREE.RingGeometry(8.4, 8.6, 64), new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
    ring.rotation.x = -PI / 2;
    ring.position.y = 0.01;
    scene.add(ring);
    const grid = new THREE.GridHelper(16, 16, 0xb5c1cc, 0xcdd6de);
    grid.position.y = 0.012;
    grid.material.transparent = true;
    grid.material.opacity = 0.5;
    scene.add(grid);

    V3.target = new THREE.Vector3(0, 1.8, 0);
    V3.tgoal = V3.target.clone();

    canvas.addEventListener('pointerdown', e => {
      V3.drag = { x: e.clientX, y: e.clientY, moved: 0 };
      V3.autoRotate = false;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', e => {
      if (!V3.drag) return;
      const dx = e.clientX - V3.drag.x, dy = e.clientY - V3.drag.y;
      V3.drag.x = e.clientX; V3.drag.y = e.clientY;
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

    V3.inited = true;
    requestAnimationFrame(loop3D);
    return true;
  } catch (err) {
    console.warn('3D initialization skipped:', err);
    return false;
  }
}

function loop3D() {
  requestAnimationFrame(loop3D);
  renderMain();
  renderPartStage();
}

function renderMain() {
  if (!V3.inited) return;
  const canvas = $('cv');
  if (!canvas || !canvas.offsetParent || !fitStage(V3.st, canvas)) return;
  if (V3.autoRotate) V3.theta += 0.004;
  V3.target.lerp(V3.tgoal, 0.08);
  const t = V3.target, cam = V3.st.camera;
  const D = V3.dist * Math.min(1.7, Math.max(1, 1.5 / cam.aspect)); // จอแคบ/แนวตั้ง: ถอยกล้องให้เห็นรถครบ
  cam.position.set(
    t.x + D * Math.sin(V3.phi) * Math.sin(V3.theta),
    t.y + D * Math.cos(V3.phi),
    t.z + D * Math.sin(V3.phi) * Math.cos(V3.theta)
  );
  cam.lookAt(t);
  V3.st.renderer.render(V3.st.scene, cam);
}

function toggleV3Labels() {
  V3.showLabels = !V3.showLabels;
  V3.parts.forEach(p => { if (p.sprite) p.sprite.visible = V3.showLabels; });
  const b = $('btnLabels');
  if (b) b.textContent = V3.showLabels ? '🔢 ซ่อนเลข' : '🔢 แสดงเลข';
}

function v3zoom(d) {
  V3.dist = Math.max(6, Math.min(22, V3.dist + d));
}

function v3reset() {
  V3.theta = 0.75;
  V3.phi = 1.15;
  V3.dist = 13;
  V3.autoRotate = true;
  sel3DPart(-1);
}

function pick3DPart(e) {
  if (!V3.inited || !V3.root) return;
  const rect = $('cv').getBoundingClientRect();
  const mouse = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  const ray = new THREE.Raycaster();
  ray.setFromCamera(mouse, V3.st.camera);
  const hits = ray.intersectObjects(V3.root.children, true).filter(x => x.object.userData && x.object.userData.partIdx != null && x.object.visible);
  const hit = hits.find(x => x.object.isSprite) || hits[0];
  if (hit) selectInspectionPoint(hit.object.userData.partIdx);
}

function sel3DPart(idx) {
  V3.selectedPart = idx;
  V3.parts.forEach((p, k) => {
    const on = k === idx;
    if (p.group) setGlow(p.group, on);
    if (p.sprite) {
      if (p.sprite.material.map) p.sprite.material.map.dispose();
      p.sprite.material.map = createNumberBadgeCanvas(k + 1, on);
      p.sprite.material.needsUpdate = true;
    }
  });
  if (V3.tgoal) {
    if (idx >= 0 && V3.parts[idx]) { V3.tgoal.copy(V3.parts[idx].center); V3.autoRotate = false; }
    else V3.tgoal.set(0, 1.8, 0);
  }
}

function renderForklift3D(m, isElec) {
  if (!init3D()) return;
  if (V3.root) { V3.st.scene.remove(V3.root); disposeObj(V3.root); }
  V3.root = new THREE.Group();
  V3.st.scene.add(V3.root);
  V3.parts = [];
  BODY_C = isElec ? 0x0a84c6 : 0xf08a1c;

  const base = new THREE.Group();
  buildBase(base, isElec);
  V3.root.add(base);

  const placed = {};
  getCurItems().forEach((it, idx) => {
    const key = partKeyFor(it, isElec);
    let g = placed[key];
    if (!g) {
      const def = PART_DEFS[key] || PART_DEFS.generic;
      g = def.build(false, { elec: isElec });
      const p = def.pos(isElec);
      g.position.set(p[0], p[1], p[2]);
      if (def.rot) g.rotation.set(def.rot[0], def.rot[1], def.rot[2]);
      V3.root.add(g);
      placed[key] = g;
    }
    V3.parts.push({ group: g, sprite: null, center: new THREE.Vector3(), idx });
  });

  shadowize(V3.root);
  V3.root.updateMatrixWorld(true);
  V3.root.traverse(o => { if (o.isMesh) o.userData.partIdx = null; });
  V3.parts.forEach((p, idx) => {
    p.group.traverse(o => { if (o.isMesh && o.userData.partIdx == null) o.userData.partIdx = idx; });
    const box = new THREE.Box3().setFromObject(p.group);
    box.getCenter(p.center);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: createNumberBadgeCanvas(idx + 1, idx === curFocusIdx), depthTest: false, toneMapped: false }));
    sprite.position.set(p.center.x, Math.min(box.max.y, p.center.y + 0.6) + 0.1, p.center.z);
    sprite.scale.set(0.38, 0.38, 0.38);
    sprite.visible = V3.showLabels;
    sprite.renderOrder = 99;
    sprite.userData.partIdx = idx;
    V3.root.add(sprite);
    p.sprite = sprite;
  });

  sel3DPart(curFocusIdx);
  showPartViewer(curFocusIdx);
}

/* ---------------- Part viewer (ชิ้นส่วนแยก 3 มิติ) ---------------- */
function initPV() {
  if (PV.inited) return true;
  try {
    if (!window.THREE) return false;
    const cv = $('cvPart');
    if (!cv) return false;
    PV.st = makeStage(cv, 3);
    PV.st.sun.position.set(3, 6, 4);
    PV.st.camera.fov = 34;
    PV.st.camera.updateProjectionMatrix();

    cv.addEventListener('pointerdown', e => {
      PV.drag = { x: e.clientX, y: e.clientY };
      PV.auto = false;
      cv.setPointerCapture(e.pointerId);
    });
    cv.addEventListener('pointermove', e => {
      if (!PV.drag) return;
      PV.rotY -= (e.clientX - PV.drag.x) * 0.012;
      PV.rotX = Math.max(-0.15, Math.min(1.25, PV.rotX + (e.clientY - PV.drag.y) * 0.01));
      PV.drag.x = e.clientX;
      PV.drag.y = e.clientY;
    });
    const end = () => { PV.drag = null; };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    cv.addEventListener('dblclick', () => { PV.auto = true; PV.zoom = 5.2; PV.rotX = 0.35; });
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      PV.zoom = Math.max(3, Math.min(8, PV.zoom + (e.deltaY > 0 ? 0.4 : -0.4)));
    }, { passive: false });

    PV.inited = true;
    return true;
  } catch (err) {
    console.warn('Part viewer skipped:', err);
    return false;
  }
}

function showPartViewer(idx) {
  const nameEl = $('partName');
  if (!nameEl) return;
  const it = getCurItems()[idx];
  if (!it) return;
  nameEl.textContent = (idx + 1) + '. ' + it.point;
  if ($('partCat')) $('partCat').textContent = it.cat || '';
  if (!initPV()) { $('partStage').classList.add('hide'); return; }

  const isElec = isCurElectric();
  BODY_C = isElec ? 0x0a84c6 : 0xf08a1c;
  const key = partKeyFor(it, isElec);
  const def = PART_DEFS[key] || PART_DEFS.generic;

  if (PV.pivot) { PV.st.scene.remove(PV.pivot); disposeObj(PV.pivot); }
  const part = def.build(true, { elec: isElec });
  const box = new THREE.Box3().setFromObject(part);
  const size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
  const s = 2.0 / Math.max(size.x, size.y, size.z, 0.001);
  part.scale.setScalar(s);
  part.position.set(-ctr.x * s, -ctr.y * s, -ctr.z * s);

  const pivot = new THREE.Group();
  pivot.add(part);
  const floorY = -(size.y * s) / 2 - 0.04;
  put(pivot, new THREE.CylinderGeometry(1.55, 1.6, 0.06, 56), M(0xdfe5eb, { roughness: 0.85, metalness: 0.05 }), 0, floorY - 0.03, 0);
  put(pivot, new THREE.TorusGeometry(1.5, 0.014, 8, 72), M(0xfacc15, { roughness: 0.5 }), 0, floorY + 0.002, 0, PI / 2);
  shadowize(pivot);
  PV.st.scene.add(pivot);
  PV.pivot = pivot;
  PV.auto = true;
  PV.st.sun.target = pivot;
}

function renderPartStage() {
  if (!PV.inited || !PV.pivot) return;
  const cv = $('cvPart');
  if (!cv || !cv.offsetParent || !fitStage(PV.st, cv)) return;
  if (PV.auto) PV.rotY += 0.009;
  const cam = PV.st.camera;
  const Z = PV.zoom * Math.min(1.6, Math.max(1, 1.25 / cam.aspect));
  cam.position.set(Math.sin(PV.rotY) * Math.cos(PV.rotX) * Z, Math.sin(PV.rotX) * Z, Math.cos(PV.rotY) * Math.cos(PV.rotX) * Z);
  cam.lookAt(0, 0, 0);
  PV.st.renderer.render(PV.st.scene, cam);
}

function togglePartBox() {
  PV.hidden = !PV.hidden;
  $('partStage').classList.toggle('hide', PV.hidden);
  $('btnPartToggle').textContent = PV.hidden ? 'แสดง' : 'ซ่อน';
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

// ย่อ Top Header เหลือแถบไอคอนเล็กๆ เมื่อเลื่อนลง (เฉพาะจอมือถือ)
function initCompactHeader() {
  const top = $('top');
  if (!top) return;
  const mq = window.matchMedia('(max-width: 820px)');
  let ticking = false;
  const update = () => {
    ticking = false;
    const y = window.scrollY || document.documentElement.scrollTop || 0;
    if (!mq.matches) { top.classList.remove('compact'); return; }
    if (y > 100) top.classList.add('compact');
    else if (y < 15) top.classList.remove('compact');
  };
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  window.addEventListener('resize', update);
  update();
}

window.addEventListener('DOMContentLoaded', () => {
  initCompactHeader();
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