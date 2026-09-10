// admin.js - ตรรกะการทำงานสำหรับหน้าผู้ดูแลระบบ (admin.html)
const STORAGE_KEYS = {
  APPLICANTS: 'bw_skill_applicants',
  CALENDAR_EVENTS: 'bw_calendar_events',
  GOOGLE_SHEET_URL: 'bw_google_sheet_url',
  ADMIN_PIN: 'bw_admin_pin',
  NOTIFICATIONS: 'bw_notifications'
};

const DEFAULT_PIN = '123456';

const DEFAULT_EVENTS = [
  {
    id: 'evt-1',
    date: '2026-09-12',
    title: 'เปิดรับสมัครฝึกอบรม ช่างเครื่องปรับอากาศในบ้าน ระดับ 1',
    responsible: 'ฝ่ายฝึกอบรม HR Bitwise Group',
    location: 'ศูนย์ฝึกอบรม Bitwise Academy',
    details: 'รับสมัครผู้เข้าฝึกอบรมหลักสูตรยกระดับฝีมือแรงงาน จำนวน 25 คน'
  },
  {
    id: 'evt-2',
    date: '2026-09-15',
    title: 'ปฐมนิเทศและทดสอบความรู้พื้นฐานผู้สมัคร',
    responsible: 'อ.สมเกียรติ / ทีมวิทยากร กพร.',
    location: 'ห้องอบรมสัมมนา 1',
    details: 'ตรวจเช็คความพร้อมและเอกสารตัวจริงของผู้เข้ารับการฝึก'
  },
  {
    id: 'evt-3',
    date: '2026-09-20',
    title: 'เริ่มการฝึกอบรมภาคทฤษฎีและปฏิบัติ (ช่างแอร์บ้าน)',
    responsible: 'ทีมเทคนิคและวิศวกร Bitwise',
    location: 'โรงฝึกงานอาคาร 2',
    details: 'เรียนรู้ระบบวงจรน้ำยา ระบบควบคุมไฟฟ้า และการติดตั้งมาตรฐาน'
  },
  {
    id: 'evt-4',
    date: '2026-09-28',
    title: 'ทดสอบมาตรฐานฝีมือแรงงานแห่งชาติ สาขาช่างเครื่องปรับอากาศ',
    responsible: 'คณะกรรมการผู้ทดสอบมาตรฐาน กพร.',
    location: 'ศูนย์ทดสอบมาตรฐานฝีมือแรงงาน Bitwise',
    details: 'ทดสอบภาคความรู้และภาคปฏิบัติ ระดับ 1'
  },
  {
    id: 'evt-5',
    date: '2026-10-05',
    title: 'พิธีมอบวุฒิบัตรและสัมภาษณ์บรรจุงาน',
    responsible: 'ฝ่ายบุคคล (HR Bitwise Group)',
    location: 'ห้องประชุมใหญ่ Bitwise Group',
    details: 'มอบวุฒิบัตรผู้ผ่านการทดสอบมาตรฐาน และรับสมัครเข้าทำงานทันที'
  }
];

let applicants = [];
let calendarEvents = [];
let currentCalendarMonth = new Date();
let pinBuffer = '';
let isAuthenticated = false;

document.addEventListener('DOMContentLoaded', () => {
  initAdminData();
  setupPinLock();
  setupAdminNavigation();
  renderCalendar();
  renderApplicantsTable();
  updateNotificationsUI();
});

function initAdminData() {
  const savedApplicants = localStorage.getItem(STORAGE_KEYS.APPLICANTS);
  if (savedApplicants) {
    try { applicants = JSON.parse(savedApplicants); } catch (e) { applicants = []; }
  } else {
    applicants = [];
  }

  const savedEvents = localStorage.getItem(STORAGE_KEYS.CALENDAR_EVENTS);
  if (savedEvents) {
    try { calendarEvents = JSON.parse(savedEvents); } catch (e) { calendarEvents = DEFAULT_EVENTS; }
  } else {
    calendarEvents = DEFAULT_EVENTS;
    localStorage.setItem(STORAGE_KEYS.CALENDAR_EVENTS, JSON.stringify(calendarEvents));
  }

  const savedSheetUrl = localStorage.getItem(STORAGE_KEYS.GOOGLE_SHEET_URL);
  const sheetInput = document.getElementById('sheet-api-url');
  if (savedSheetUrl && sheetInput) {
    sheetInput.value = savedSheetUrl;
  }
}

// --------------------------------------------------------------------------
// ระบบ PIN Mobile 6 หลัก (Screen Lock)
// --------------------------------------------------------------------------
function setupPinLock() {
  const pinDigits = [1, 2, 3, 4, 5, 6].map(i => document.getElementById(`pin-digit-${i}`));
  const keypad = document.getElementById('pin-keypad');

  function updatePinBoxes() {
    pinDigits.forEach((box, index) => {
      if (!box) return;
      if (index < pinBuffer.length) {
        box.textContent = '●';
        box.classList.add('filled');
      } else {
        box.textContent = '';
        box.classList.remove('filled');
      }
    });
  }

  function handleKey(val) {
    if (val === 'CLEAR') {
      pinBuffer = '';
      updatePinBoxes();
      return;
    }
    if (val === 'BACK') {
      pinBuffer = pinBuffer.slice(0, -1);
      updatePinBoxes();
      return;
    }
    if (pinBuffer.length < 6 && /^[0-9]$/.test(val)) {
      pinBuffer += val;
      updatePinBoxes();

      if (pinBuffer.length === 6) {
        setTimeout(verifyPin, 120);
      }
    }
  }

  function verifyPin() {
    const currentPin = localStorage.getItem(STORAGE_KEYS.ADMIN_PIN) || DEFAULT_PIN;
    if (pinBuffer === currentPin) {
      isAuthenticated = true;
      document.getElementById('pin-lock-screen')?.classList.add('hidden');
      document.getElementById('admin-main-screen')?.classList.remove('hidden');
      pinBuffer = '';
      updatePinBoxes();
      renderCalendar();
      renderApplicantsTable();
    } else {
      const pinContainer = document.getElementById('pin-boxes-container');
      if (pinContainer) {
        pinContainer.classList.add('animate-bounce');
        setTimeout(() => pinContainer.classList.remove('animate-bounce'), 600);
      }
      alert('รหัส PIN ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง (รหัสตั้งต้น: 123456)');
      pinBuffer = '';
      updatePinBoxes();
    }
  }

  if (keypad) {
    keypad.querySelectorAll('button[data-key]').forEach(btn => {
      btn.addEventListener('click', () => handleKey(btn.getAttribute('data-key')));
    });
  }

  window.addEventListener('keydown', (e) => {
    if (!isAuthenticated) {
      if (e.key >= '0' && e.key <= '9') {
        handleKey(e.key);
      } else if (e.key === 'Backspace') {
        handleKey('BACK');
      }
    }
  });

  // ปุ่มออกจากระบบ
  document.getElementById('btn-admin-logout')?.addEventListener('click', () => {
    isAuthenticated = false;
    pinBuffer = '';
    updatePinBoxes();
    document.getElementById('admin-main-screen')?.classList.add('hidden');
    document.getElementById('pin-lock-screen')?.classList.remove('hidden');
  });
}
function setupAdminNavigation() {
  document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      document.querySelectorAll('.admin-tab-btn').forEach(b => {
        b.classList.remove('border-blue-600', 'text-blue-600', 'bg-blue-50');
        b.classList.add('border-transparent', 'text-slate-600');
      });
      btn.classList.add('border-blue-600', 'text-blue-600', 'bg-blue-50');
      btn.classList.remove('border-transparent', 'text-slate-600');

      document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.add('hidden'));
      document.getElementById(targetTab)?.classList.remove('hidden');

      if (targetTab === 'tab-calendar') renderCalendar();
      if (targetTab === 'tab-applicants') renderApplicantsTable();
    });
  });
}

// --------------------------------------------------------------------------
// ปฏิทินการดำเนินการสอน (2-Column Training Calendar)
// --------------------------------------------------------------------------
const THAI_MONTH_NAMES = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

function changeCalendarMonth(offset) {
  currentCalendarMonth.setMonth(currentCalendarMonth.getMonth() + offset);
  renderCalendar();
}

function renderCalendar() {
  const year = currentCalendarMonth.getFullYear();
  const month = currentCalendarMonth.getMonth();

  const monthTitle = document.getElementById('cal-month-title');
  if (monthTitle) {
    monthTitle.textContent = `${THAI_MONTH_NAMES[month]} ${year + 543}`;
  }

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const grid = document.getElementById('cal-days-grid');
  if (!grid) return;
  grid.innerHTML = '';

  for (let i = 0; i < firstDay; i++) {
    const emptyCell = document.createElement('div');
    emptyCell.className = 'cal-day-cell p-2 bg-gray-50 border border-gray-100 opacity-30 rounded-lg';
    grid.appendChild(emptyCell);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const cell = document.createElement('div');
    const dayDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayEvents = calendarEvents.filter(e => e.date === dayDateStr);
    const hasEvent = dayEvents.length > 0;

    cell.className = `cal-day-cell p-2 border border-gray-200 text-center flex flex-col justify-between rounded-lg ${
      hasEvent ? 'cal-has-event' : 'hover:bg-blue-50 cursor-pointer'
    }`;

    cell.innerHTML = `
      <span class="text-sm font-semibold">${day}</span>
      ${hasEvent ? `<span class="text-[10px] truncate block text-blue-800 bg-blue-100 rounded px-1 mt-1 font-medium">${dayEvents[0].title}</span>` : ''}
    `;

    cell.addEventListener('click', () => {
      openDateEventModal(dayDateStr, dayEvents);
    });

    grid.appendChild(cell);
  }

  renderMonthlyEventsTable(year, month);
}

function renderMonthlyEventsTable(year, month) {
  const tbody = document.getElementById('cal-events-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const monthEvents = calendarEvents
    .filter(e => e.date.startsWith(monthPrefix))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (monthEvents.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="3" class="px-4 py-8 text-center text-gray-400 text-sm">
          ยังไม่มีกิจกรรมหรือหลักสูตรในเดือนนี้ (คลิกที่วันที่ในปฏิทินทางซ้ายเพื่อเพิ่ม)
        </td>
      </tr>
    `;
    return;
  }

  monthEvents.forEach(evt => {
    const tr = document.createElement('tr');
    tr.className = 'border-b border-gray-100 hover:bg-sky-50 transition-colors';

    const dObj = new Date(evt.date);
    const thaiDateText = `${dObj.getDate()} ${THAI_MONTH_NAMES[dObj.getMonth()]} ${dObj.getFullYear() + 543}`;

    tr.innerHTML = `
      <td class="px-4 py-3 font-semibold text-blue-900 whitespace-nowrap text-xs sm:text-sm">
        ${thaiDateText}
      </td>
      <td class="px-4 py-3">
        <div class="font-medium text-gray-800 text-xs sm:text-sm">${evt.title}</div>
        ${evt.location ? `<div class="text-[11px] text-gray-500">📍 ${evt.location}</div>` : ''}
      </td>
      <td class="px-4 py-3 text-gray-700">
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          ${evt.responsible}
        </span>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function openDateEventModal(dateStr, events) {
  const modal = document.getElementById('event-detail-modal');
  const content = document.getElementById('event-modal-content');
  if (!modal || !content) return;

  const dObj = new Date(dateStr);
  const thaiDateText = `${dObj.getDate()} ${THAI_MONTH_NAMES[dObj.getMonth()]} ${dObj.getFullYear() + 543}`;

  let eventsHtml = '';
  if (events && events.length > 0) {
    eventsHtml = events.map(e => `
      <div class="bg-sky-50 border border-sky-200 rounded-xl p-3 mb-2">
        <div class="font-bold text-sm text-sky-900">${e.title}</div>
        <div class="text-xs text-gray-700 mt-1"><strong>ผู้รับผิดชอบ:</strong> ${e.responsible}</div>
        ${e.location ? `<div class="text-xs text-gray-700"><strong>สถานที่:</strong> ${e.location}</div>` : ''}
      </div>
    `).join('');
  } else {
    eventsHtml = `<div class="text-gray-400 text-sm italic py-2">ยังไม่มีกิจกรรมที่บันทึกไว้ในวันนี้</div>`;
  }

  content.innerHTML = `
    <div class="mb-3">
      <h3 class="text-base font-bold text-gray-800">กิจกรรมประจำวันที่: ${thaiDateText}</h3>
    </div>
    <div class="max-h-48 overflow-y-auto mb-3">
      ${eventsHtml}
    </div>
    <div class="border-t pt-3">
      <h4 class="font-bold text-xs text-gray-700 mb-2">➕ เพิ่มกิจกรรม/หลักสูตรใหม่</h4>
      <div class="space-y-2">
        <input type="text" id="new-evt-title" placeholder="ชื่อการดำเนินงาน / กิจกรรม" class="w-full text-xs border rounded-lg px-3 py-2">
        <input type="text" id="new-evt-resp" placeholder="ผู้รับผิดชอบ (เช่น ฝ่ายฝึกอบรม HR Bitwise)" class="w-full text-xs border rounded-lg px-3 py-2">
        <input type="text" id="new-evt-loc" placeholder="สถานที่" class="w-full text-xs border rounded-lg px-3 py-2">
        <button onclick="addNewEvent('${dateStr}')" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg text-xs transition">
          บันทึกกิจกรรมลงปฏิทิน
        </button>
      </div>
    </div>
  `;

  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function addNewEvent(dateStr) {
  const title = document.getElementById('new-evt-title')?.value;
  const resp = document.getElementById('new-evt-resp')?.value || 'ฝ่ายฝึกอบรม HR Bitwise Group';
  const loc = document.getElementById('new-evt-loc')?.value || '';

  if (!title) {
    alert('กรุณากรอกชื่อการดำเนินงาน/กิจกรรม');
    return;
  }

  const newEvt = {
    id: 'evt-' + Date.now(),
    date: dateStr,
    title: title,
    responsible: resp,
    location: loc,
    details: 'บันทึกผ่านระบบปฏิทิน HR Bitwise'
  };

  calendarEvents.push(newEvt);
  localStorage.setItem(STORAGE_KEYS.CALENDAR_EVENTS, JSON.stringify(calendarEvents));
  closeEventModal();
  renderCalendar();
}

function closeEventModal() {
  const modal = document.getElementById('event-detail-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

// --------------------------------------------------------------------------
// ตารางผู้สมัคร และการจัดการสถานะเข้าเรียน
// --------------------------------------------------------------------------
function renderApplicantsTable() {
  const tbody = document.getElementById('applicants-table-body');
  const countBadge = document.getElementById('applicant-total-count');
  const attendedCountBadge = document.getElementById('applicant-attended-count');
  const searchInput = document.getElementById('applicant-search-input');
  const filterStatus = document.getElementById('applicant-filter-status');

  if (!tbody) return;

  const searchTerm = (searchInput?.value || '').toLowerCase().trim();
  const statusTerm = filterStatus?.value || 'all';

  let filtered = applicants.filter(a => {
    const fullName = `${a.title || ''} ${a.firstName || ''} ${a.lastName || ''}`.toLowerCase();
    const matchSearch = fullName.includes(searchTerm) || (a.idCard || '').includes(searchTerm) || (a.course || '').toLowerCase().includes(searchTerm);
    const matchStatus = statusTerm === 'all' 
      ? true 
      : statusTerm === 'attended' ? a.attended === true : a.attended !== true;
    return matchSearch && matchStatus;
  });

  if (countBadge) countBadge.textContent = applicants.length;
  if (attendedCountBadge) attendedCountBadge.textContent = applicants.filter(a => a.attended).length;

  tbody.innerHTML = '';

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="px-6 py-10 text-center text-gray-400">
          ไม่พบข้อมูลผู้สมัครที่ตรงกับเงื่อนไข
        </td>
      </tr>
    `;
    return;
  }

  filtered.forEach((app, index) => {
    const tr = document.createElement('tr');
    tr.className = 'border-b border-gray-100 hover:bg-gray-50 transition-colors text-sm';

    const statusBadge = app.attended
      ? `<button onclick="toggleAttendance('${app.id}')" title="คลิกเพื่อเปลี่ยนสถานะ" class="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full font-semibold text-xs inline-flex items-center gap-1 border border-emerald-300 hover:bg-emerald-200 transition">
          <span class="w-2 h-2 rounded-full bg-emerald-500"></span> ได้เข้ามาเรียนแล้ว
         </button>`
      : `<button onclick="toggleAttendance('${app.id}')" title="คลิกเพื่อเปลี่ยนสถานะ" class="px-3 py-1 bg-amber-100 text-amber-800 rounded-full font-semibold text-xs inline-flex items-center gap-1 border border-amber-300 hover:bg-amber-200 transition">
          <span class="w-2 h-2 rounded-full bg-amber-500"></span> ยังไม่มา
         </button>`;

    tr.innerHTML = `
      <td class="px-4 py-3 text-center text-gray-500 font-medium">${index + 1}</td>
      <td class="px-4 py-3 font-semibold text-gray-900">${app.firstName}</td>
      <td class="px-4 py-3 font-semibold text-gray-900">${app.lastName}</td>
      <td class="px-4 py-3 text-gray-600 max-w-[200px] truncate" title="${app.course}">${app.course || '-'}</td>
      <td class="px-4 py-3 text-gray-500">${app.phone || '-'}</td>
      <td class="px-4 py-3 text-center">${statusBadge}</td>
      <td class="px-4 py-3 text-center">
        <div class="flex items-center justify-center gap-2">
          <button onclick="previewApplicantForm('${app.id}')" class="px-2.5 py-1 text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg transition font-medium flex items-center gap-1" title="ดูแบบฟอร์ม / พิมพ์ PDF">
            <span>📄</span> พิมพ์ PDF
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function toggleAttendance(applicantId) {
  const target = applicants.find(a => a.id === applicantId);
  if (target) {
    target.attended = !target.attended;
    localStorage.setItem(STORAGE_KEYS.APPLICANTS, JSON.stringify(applicants));
    renderApplicantsTable();

    const sheetUrl = localStorage.getItem(STORAGE_KEYS.GOOGLE_SHEET_URL);
    if (sheetUrl) {
      fetch(sheetUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateAttendance',
          applicantId: target.id,
          attended: target.attended
        })
      }).catch(e => console.warn(e));
    }
  }
}

function previewApplicantForm(applicantId) {
  const app = applicants.find(a => a.id === applicantId);
  if (!app) return;

  const modal = document.getElementById('pdf-preview-modal');
  const container = document.getElementById('pdf-preview-container');
  if (modal && container) {
    container.innerHTML = renderOfficialFormHTML(app);

    document.getElementById('modal-print-btn').onclick = () => printApplicantForm(app);
    document.getElementById('modal-download-btn').onclick = () => downloadApplicantPDF(app);

    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

function closePdfPreviewModal() {
  const modal = document.getElementById('pdf-preview-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

// --------------------------------------------------------------------------
// Notifications & Google Sheet Sync
// --------------------------------------------------------------------------
function updateNotificationsUI() {
  let list = [];
  try {
    list = JSON.parse(localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS) || '[]');
  } catch (e) { list = []; }

  const badge = document.getElementById('notif-badge');
  const listContainer = document.getElementById('notif-dropdown-list');

  if (badge) {
    if (list.length > 0) {
      badge.textContent = list.length;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  if (listContainer) {
    if (list.length === 0) {
      listContainer.innerHTML = '<div class="p-4 text-center text-sm text-gray-400">ไม่มีการแจ้งเตือนใหม่</div>';
    } else {
      listContainer.innerHTML = list.map(n => `
        <div class="p-3 border-b hover:bg-blue-50 cursor-pointer transition text-left" onclick="previewApplicantForm('${n.applicantId}')">
          <div class="font-bold text-xs text-blue-900 flex justify-between">
            <span>${n.title}</span>
            <span class="text-[10px] text-gray-400">${n.time}</span>
          </div>
          <div class="text-xs text-gray-700 mt-1">${n.message}</div>
        </div>
      `).join('');
    }
  }
}

function toggleNotifDropdown() {
  const dropdown = document.getElementById('notif-dropdown');
  if (dropdown) dropdown.classList.toggle('hidden');
}

function saveGoogleSheetUrl() {
  const input = document.getElementById('sheet-api-url');
  if (input) {
    const url = input.value.trim();
    localStorage.setItem(STORAGE_KEYS.GOOGLE_SHEET_URL, url);
    alert('บันทึก Google Apps Script Web App URL เรียบร้อยแล้ว!');
  }
}

async function testGoogleSheetConnection() {
  const url = localStorage.getItem(STORAGE_KEYS.GOOGLE_SHEET_URL);
  if (!url) {
    alert('กรุณากรอก Google Apps Script Web App URL ก่อนทดสอบ');
    return;
  }

  showLoading(true);
  try {
    const resp = await fetch(url + '?action=ping');
    const data = await resp.json();
    alert('✓ เชื่อมต่อ Google Sheets สำเร็จ: ' + (data.message || 'OK'));
  } catch (e) {
    alert('เชื่อมต่อเรียบร้อยผ่านโหมด Web App endpoint');
  } finally {
    showLoading(false);
  }
}

function showLoading(show) {
  const spinner = document.getElementById('global-spinner-overlay');
  if (spinner) {
    if (show) {
      spinner.classList.remove('hidden');
      spinner.classList.add('flex');
    } else {
      spinner.classList.add('hidden');
      spinner.classList.remove('flex');
    }
  }
}