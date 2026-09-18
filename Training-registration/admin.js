const STORAGE_KEYS = {
  APPLICANTS: 'bw_skill_applicants',
  CALENDAR_EVENTS: 'bw_calendar_events',
  NOTIFICATIONS: 'bw_notifications',
  NOTIF_SEEN: 'bw_admin_notif_seen_ids'
};

let applicants = [];
let calendarEvents = [];
let currentCalendarMonth = new Date();
let pinBuffer = '';
let isAuthenticated = false;
let currentManagerName = '';
let pinVerifying = false;
let pinFailCount = 0;
let pinLockedUntil = 0;

function parseSubmittedAtDate(value) {
  if (!value) return new Date(0);
  const isoLike = String(value).trim().replace(' ', 'T');
  const d = new Date(isoLike);
  return isNaN(d.getTime()) ? new Date(0) : d;
}

document.addEventListener('DOMContentLoaded', () => {
  applicants = loadLocalApplicants();
  calendarEvents = loadLocalEvents();
  if (!localStorage.getItem(STORAGE_KEYS.CALENDAR_EVENTS)) {
    localStorage.setItem(STORAGE_KEYS.CALENDAR_EVENTS, JSON.stringify(calendarEvents));
  }

  setupPinLock();
  setupAdminNavigation();
  setupNotifDropdownAutoClose();
  renderCalendar();
  renderApplicantsTable();
  updateNotificationsUI();
  
});

function loadLocalApplicants() {
  const saved = localStorage.getItem(STORAGE_KEYS.APPLICANTS);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        parsed.forEach(a => {
          if (a.phone) a.phone = formatPhoneNumber(a.phone);
          if (a.workplacePhone) a.workplacePhone = formatPhoneNumber(a.workplacePhone);
          if (a.addressNo) a.addressNo = cleanAddressNo(a.addressNo);
        });
      }
      return parsed;
    } catch (e) { return []; }
  }
  return [];
}

function loadLocalEvents() {
  const saved = localStorage.getItem(STORAGE_KEYS.CALENDAR_EVENTS);
  if (saved) {
    try { return JSON.parse(saved); } catch (e) { return []; }
  }
  return [];
}

async function syncFromGoogleSheet(sheetUrl, opts) {
  const options = opts || {};
  let ok = true;

  try {
    const applicantsResult = await fetchGasApi(withAuthToken(sheetUrl + '?action=getApplicants'));
    if (applicantsResult && applicantsResult.status === 'unauthorized') {
      if (isAuthenticated) {
        forceAdminLogout('เซสชันผู้ดูแลระบบหมดอายุหรือไม่ถูกต้อง กรุณาเข้าสู่ระบบด้วยรหัส PIN อีกครั้ง');
      }
      return false;
    }
    if (applicantsResult && applicantsResult.status === 'success' && Array.isArray(applicantsResult.data)) {
      const localById = new Map();
      applicants.forEach(a => localById.set(a.id, a));

      applicants = applicantsResult.data
        .map(a => {
          if (a.phone) a.phone = formatPhoneNumber(a.phone);
          if (a.workplacePhone) a.workplacePhone = formatPhoneNumber(a.workplacePhone);
          if (a.addressNo) a.addressNo = cleanAddressNo(a.addressNo);
          const localMatch = localById.get(a.id);
          if (localMatch && localMatch.photoDataUrl && !a.photoDataUrl) {
            a.photoDataUrl = localMatch.photoDataUrl;
          }
          return a;
        })
        .sort((a, b) => parseSubmittedAtDate(b.submittedAt) - parseSubmittedAtDate(a.submittedAt));
      localStorage.setItem(STORAGE_KEYS.APPLICANTS, JSON.stringify(applicants));
      pruneStaleNotificationData(applicants);
    } else {
      ok = false;
      if (!options.silent) console.warn('ดึงข้อมูลผู้สมัครจาก Google Sheet ไม่สำเร็จ:', applicantsResult && applicantsResult.message);
    }
  } catch (err) {
    ok = false;
    if (!options.silent) console.warn('ดึงข้อมูลผู้สมัครจาก Google Sheet ไม่สำเร็จ:', err);
  }

  try {
    const eventsResult = await fetchGasApi(withAuthToken(sheetUrl + '?action=getCalendarEvents'));
    if (eventsResult && eventsResult.status === 'unauthorized') {
      if (isAuthenticated) {
        forceAdminLogout('เซสชันผู้ดูแลระบบหมดอายุหรือไม่ถูกต้อง กรุณาเข้าสู่ระบบด้วยรหัส PIN อีกครั้ง');
      }
      return false;
    }
    if (eventsResult && eventsResult.status === 'success' && Array.isArray(eventsResult.data)) {
      calendarEvents = eventsResult.data;
      localStorage.setItem(STORAGE_KEYS.CALENDAR_EVENTS, JSON.stringify(calendarEvents));
    } else {
      ok = false;
      if (!options.silent) console.warn('ดึงข้อมูลปฏิทินจาก Google Sheet ไม่สำเร็จ:', eventsResult && eventsResult.message);
    }
  } catch (err) {
    ok = false;
    if (!options.silent) console.warn('ดึงข้อมูลปฏิทินจาก Google Sheet ไม่สำเร็จ:', err);
  }

  return ok;
}

function setupPinLock() {
  const pinDigits = [1, 2, 3, 4, 5, 6].map(i => document.getElementById(`pin-digit-${i}`));
  const keypad = document.getElementById('pin-keypad');
  const pinStatusEl = document.getElementById('pin-status-text');

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

  function setPinStatus(text) {
    if (pinStatusEl) pinStatusEl.textContent = text || '';
  }

  function remainingLockSeconds() {
    return Math.max(0, Math.ceil((pinLockedUntil - Date.now()) / 1000));
  }

  function handleKey(val) {
    if (pinVerifying || remainingLockSeconds() > 0) return;

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

  async function verifyPin() {
    if (!GAS_WEB_APP_URL) {
      alert('ยังไม่ได้ตั้งค่า Google Apps Script Web App URL (GAS_WEB_APP_URL) ในไฟล์ gs-api.js จึงตรวจสอบรหัส PIN ไม่ได้');
      pinBuffer = '';
      updatePinBoxes();
      return;
    }

    pinVerifying = true;
    const pinToCheck = pinBuffer;
    setPinStatus('กำลังตรวจสอบรหัส PIN...');

    let result;
    try {
      result = await callGasApi(GAS_WEB_APP_URL, { action: 'verifyManagerPin', pin: pinToCheck }, 20000);
    } catch (err) {
      result = { status: 'error', message: String(err) };
    }

    pinVerifying = false;
    pinBuffer = '';
    updatePinBoxes();

    if (result && result.status === 'success') {
      pinFailCount = 0;
      pinLockedUntil = 0;
      isAuthenticated = true;
      currentManagerName = result.name || '';
      adminSessionToken = result.token || '';
      updateManagerNameDisplay();
      setPinStatus('');
      document.getElementById('pin-lock-screen')?.classList.add('hidden');
      document.getElementById('admin-main-screen')?.classList.remove('hidden');
      renderCalendar();
      renderApplicantsTable();
      updateNotificationsUI();
      showLoading(true);
      syncFromGoogleSheet(GAS_WEB_APP_URL, { silent: true })
        .then(() => {
          renderCalendar();
          renderApplicantsTable();
          updateNotificationsUI();
        })
        .finally(() => showLoading(false));
    } else {
      const pinContainer = document.getElementById('pin-boxes-container');
      if (pinContainer) {
        pinContainer.classList.add('animate-bounce');
        setTimeout(() => pinContainer.classList.remove('animate-bounce'), 600);
      }

      pinFailCount += 1;
      if (pinFailCount >= 5) {
        pinLockedUntil = Date.now() + 30000;
        pinFailCount = 0;
        const tick = () => {
          const secs = remainingLockSeconds();
          if (secs > 0) {
            setPinStatus(`กรอกผิดหลายครั้งเกินไป กรุณารออีก ${secs} วินาที`);
            setTimeout(tick, 1000);
          } else {
            setPinStatus('');
          }
        };
        tick();
      } else {
        setPinStatus('รหัส PIN ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
      }
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

  document.getElementById('btn-admin-logout')?.addEventListener('click', () => {
    isAuthenticated = false;
    currentManagerName = '';
    adminSessionToken = '';
    pinBuffer = '';
    updatePinBoxes();
    updateManagerNameDisplay();
    document.getElementById('admin-main-screen')?.classList.add('hidden');
    document.getElementById('pin-lock-screen')?.classList.remove('hidden');
    clearCachedAdminData_();
  });
}

function forceAdminLogout(message) {
  isAuthenticated = false;
  currentManagerName = '';
  adminSessionToken = '';
  updateManagerNameDisplay();
  document.getElementById('admin-main-screen')?.classList.add('hidden');
  document.getElementById('pin-lock-screen')?.classList.remove('hidden');
  clearCachedAdminData_();
  if (message) alert(message);
}

function clearCachedAdminData_() {
  applicants = [];
  calendarEvents = [];
  try { localStorage.removeItem(STORAGE_KEYS.APPLICANTS); } catch (e) { /* ignore */ }
  try { localStorage.removeItem(STORAGE_KEYS.CALENDAR_EVENTS); } catch (e) { /* ignore */ }
  renderApplicantsTable();
  renderCalendar();
  updateNotificationsUI();
}

function updateManagerNameDisplay() {
  const el = document.getElementById('current-manager-name');
  if (el) el.textContent = currentManagerName ? `👤 ${currentManagerName}` : '';
}

function escJsAttr(str) {
  return String(str === undefined || str === null ? '' : str)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'");
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

const THAI_MONTH_NAMES = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

function changeCalendarMonth(offset) {
  currentCalendarMonth.setDate(1);
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
  if (grid) {
    grid.innerHTML = '';

    for (let i = 0; i < firstDay; i++) {
      const emptyCell = document.createElement('div');
      emptyCell.className = 'cal-day-cell p-2 bg-gray-50 border border-gray-100 opacity-30 rounded-lg';
      grid.appendChild(emptyCell);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const cell = document.createElement('div');
      const dayDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayEvents = calendarEvents.filter(e => normalizeEventDateStr(e) === dayDateStr);
      const hasEvent = dayEvents.length > 0;

      cell.className = `cal-day-cell p-2 border border-gray-200 text-center flex flex-col justify-between rounded-lg ${
        hasEvent ? 'cal-has-event' : 'hover:bg-blue-50 cursor-pointer'
      }`;

      cell.innerHTML = `
        <span class="text-sm font-semibold">${day}</span>
        ${hasEvent ? `<span class="text-[10px] truncate block text-blue-800 bg-blue-100 rounded px-1 mt-1 font-medium">${escapeHtml(dayEvents[0].title)}</span>` : ''}
      `;

      cell.addEventListener('click', () => {
        openDateEventModal(dayDateStr, dayEvents);
      });

      grid.appendChild(cell);
    }
  }

  renderMonthlyEventsTable(year, month);
}

function normalizeEventDateStr(evt) {
  if (!evt || evt.date === undefined || evt.date === null) return '';
  if (evt.date instanceof Date) {
    const y = evt.date.getFullYear();
    const m = String(evt.date.getMonth() + 1).padStart(2, '0');
    const d = String(evt.date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const str = String(evt.date).trim();
  const match = str.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : str;
}

function renderMonthlyEventsTable(year, month) {
  const tbody = document.getElementById('cal-events-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const monthEvents = calendarEvents
    .map(e => Object.assign({}, e, { __dateStr: normalizeEventDateStr(e) }))
    .filter(e => e.__dateStr && e.__dateStr.startsWith(monthPrefix))
    .sort((a, b) => a.__dateStr.localeCompare(b.__dateStr));

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
    const [ey, em, ed] = evt.__dateStr.split('-').map(Number);
    const thaiDateText = `${ed} ${THAI_MONTH_NAMES[em - 1]} ${ey + 543}`;

    tr.innerHTML = `
      <td class="px-4 py-3 font-semibold text-blue-900 whitespace-nowrap text-xs sm:text-sm">
        ${thaiDateText}
      </td>
      <td class="px-4 py-3">
        <div class="font-medium text-gray-800 text-xs sm:text-sm">${escapeHtml(evt.title)}</div>
        ${evt.location ? `<div class="text-[11px] text-gray-500">📍 ${escapeHtml(evt.location)}</div>` : ''}
      </td>
      <td class="px-4 py-3 text-gray-700">
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          ${escapeHtml(evt.responsible)}
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

  const [dy, dm, dd] = dateStr.split('-').map(Number);
  const thaiDateText = `${dd} ${THAI_MONTH_NAMES[dm - 1]} ${dy + 543}`;

  let eventsHtml = '';
  if (events && events.length > 0) {
    eventsHtml = events.map(e => `
      <div class="bg-sky-50 border border-sky-200 rounded-xl p-3 mb-2">
        <div class="font-bold text-sm text-sky-900">${escapeHtml(e.title)}</div>
        <div class="text-xs text-gray-700 mt-1"><strong>ผู้รับผิดชอบ:</strong> ${escapeHtml(e.responsible)}</div>
        ${e.location ? `<div class="text-xs text-gray-700"><strong>สถานที่:</strong> ${escapeHtml(e.location)}</div>` : ''}
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
        <button onclick="addNewEvent('${escJsAttr(dateStr)}')" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg text-xs transition">
          บันทึกกิจกรรมลงปฏิทิน
        </button>
      </div>
    </div>
  `;

  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

async function addNewEvent(dateStr) {
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
  showLoading(true);
  try {
    const result = await callGasApi(GAS_WEB_APP_URL, { action: 'addEvent', event: newEvt, token: adminSessionToken });
    if (!result || result.status !== 'success') {
      calendarEvents = calendarEvents.filter(e => e.id !== newEvt.id);
      localStorage.setItem(STORAGE_KEYS.CALENDAR_EVENTS, JSON.stringify(calendarEvents));
      renderCalendar();
      // [เพิ่มใหม่] ถ้า session token หมดอายุ/ไม่ถูกต้อง ให้พากลับไปหน้า PIN แทนที่จะแค่ alert เฉยๆ
      if (result && result.status === 'unauthorized') {
        forceAdminLogout(result.message || 'เซสชันผู้ดูแลระบบหมดอายุ กรุณาเข้าสู่ระบบด้วยรหัส PIN อีกครั้ง');
      } else {
        alert('บันทึกกิจกรรมลง Google Sheet ไม่สำเร็จ: ' + (result && result.message ? result.message : 'ไม่ทราบสาเหตุ') + '\nกรุณาลองใหม่อีกครั้ง (กิจกรรมนี้ถูกยกเลิกจากปฏิทินแล้ว เนื่องจากบันทึกไม่สำเร็จจริง)');
      }
    }
  } catch (err) {
    calendarEvents = calendarEvents.filter(e => e.id !== newEvt.id);
    localStorage.setItem(STORAGE_KEYS.CALENDAR_EVENTS, JSON.stringify(calendarEvents));
    renderCalendar();
    alert('เกิดข้อผิดพลาดขณะบันทึกกิจกรรมลง Google Sheet กรุณาลองใหม่อีกครั้ง: ' + err);
  } finally {
    showLoading(false);
  }
}

function closeEventModal() {
  const modal = document.getElementById('event-detail-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

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
      ? `<button onclick="toggleAttendance('${escJsAttr(app.id)}')" title="คลิกเพื่อเปลี่ยนสถานะ" class="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full font-semibold text-xs inline-flex items-center gap-1 border border-emerald-300 hover:bg-emerald-200 transition">
          <span class="w-2 h-2 rounded-full bg-emerald-500"></span> ได้เข้ามาเรียนแล้ว
         </button>`
      : `<button onclick="toggleAttendance('${escJsAttr(app.id)}')" title="คลิกเพื่อเปลี่ยนสถานะ" class="px-3 py-1 bg-amber-100 text-amber-800 rounded-full font-semibold text-xs inline-flex items-center gap-1 border border-amber-300 hover:bg-amber-200 transition">
          <span class="w-2 h-2 rounded-full bg-amber-500"></span> ยังไม่มา
         </button>`;

    tr.innerHTML = `
      <td class="px-4 py-3 text-center text-gray-500 font-medium">${index + 1}</td>
      <td class="px-4 py-3 font-semibold text-gray-900">${escapeHtml(app.firstName)}</td>
      <td class="px-4 py-3 font-semibold text-gray-900">${escapeHtml(app.lastName)}</td>
      <td class="px-4 py-3 text-gray-600 max-w-[200px] truncate" title="${escapeHtml(app.course)}">${escapeHtml(app.course) || '-'}</td>
      <td class="px-4 py-3 text-gray-500">${escapeHtml(formatPhoneNumber(app.phone)) || '-'}</td>
      <td class="px-4 py-3 text-center">${statusBadge}</td>
      <td class="px-4 py-3 text-center">
        <div class="flex items-center justify-center gap-2">
          <button onclick="previewApplicantForm('${escJsAttr(app.id)}')" class="px-2.5 py-1 text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg transition font-medium flex items-center gap-1" title="ดูแบบฟอร์ม / พิมพ์ PDF">
            <span>📄</span> พิมพ์ PDF
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function toggleAttendance(applicantId) {
  const target = applicants.find(a => a.id === applicantId);
  if (!target) return;
  const previousAttended = target.attended;
  target.attended = !target.attended;
  localStorage.setItem(STORAGE_KEYS.APPLICANTS, JSON.stringify(applicants));
  renderApplicantsTable();
  try {
    const result = await callGasApi(GAS_WEB_APP_URL, {
      action: 'updateAttendance',
      applicantId: target.id,
      attended: target.attended,
      token: adminSessionToken
    });
    if (!result || result.status !== 'success') {
      target.attended = previousAttended;
      localStorage.setItem(STORAGE_KEYS.APPLICANTS, JSON.stringify(applicants));
      renderApplicantsTable();
      if (result && result.status === 'unauthorized') {
        forceAdminLogout(result.message || 'เซสชันผู้ดูแลระบบหมดอายุ กรุณาเข้าสู่ระบบด้วยรหัส PIN อีกครั้ง');
      } else {
        alert('อัปเดตสถานะเข้าเรียนลง Google Sheet ไม่สำเร็จ: ' + (result && result.message ? result.message : 'ไม่ทราบสาเหตุ') + '\nสถานะบนหน้าจอถูกย้อนกลับเป็นค่าเดิมแล้ว กรุณาลองใหม่อีกครั้ง');
      }
    }
  } catch (e) {
    target.attended = previousAttended;
    localStorage.setItem(STORAGE_KEYS.APPLICANTS, JSON.stringify(applicants));
    renderApplicantsTable();
    alert('เกิดข้อผิดพลาดขณะอัปเดตสถานะเข้าเรียนลง Google Sheet กรุณาลองใหม่อีกครั้ง: ' + e);
  }
}

async function previewApplicantForm(applicantId) {
  const app = applicants.find(a => a.id === applicantId);
  if (!app) return;

  const modal = document.getElementById('pdf-preview-modal');
  const container = document.getElementById('pdf-preview-container');
  if (!modal || !container) return;

  showLoading(true);
  let resolvedApp = app;
  try {
    resolvedApp = await resolveApplicantPhotoForRender(app);
  } catch (err) {
    console.warn('ไม่สามารถดึงรูปถ่ายผู้สมัครมาฝังในเอกสารได้ จะแสดงผลเท่าที่มีข้อมูล:', err);
  } finally {
    showLoading(false);
  }

  container.innerHTML = `<div class="a4-page-screen-wrapper">${renderOfficialFormHTML(resolvedApp)}</div>`;
  modal.classList.remove('hidden');
  modal.classList.add('flex');

  const previewFormEl = document.getElementById('official-form-printable');
  if (previewFormEl && typeof fitOfficialFormToA4 === 'function') {
    if (typeof waitForElementReady === 'function') {
      await waitForElementReady(previewFormEl);
    }
    fitOfficialFormToA4(previewFormEl);
  }

  document.getElementById('modal-print-btn').onclick = () => printApplicantForm(resolvedApp);
  document.getElementById('modal-download-btn').onclick = () => downloadApplicantPDF(resolvedApp);
  const saveDriveBtn = document.getElementById('modal-save-drive-btn');
  if (saveDriveBtn) saveDriveBtn.onclick = () => saveApplicantPdfToDrive(resolvedApp);
  markNotificationSeen(app.id);
}

function closePdfPreviewModal() {
  const modal = document.getElementById('pdf-preview-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

function getSeenNotificationIds() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.NOTIF_SEEN) || '[]'); }
  catch (e) { return []; }
}

function markNotificationSeen(applicantId) {
  const seen = getSeenNotificationIds();
  if (!seen.includes(applicantId)) {
    seen.push(applicantId);
    localStorage.setItem(STORAGE_KEYS.NOTIF_SEEN, JSON.stringify(seen));
  }
  updateNotificationsUI();
}

function computeSheetBasedNotifications() {
  const seen = getSeenNotificationIds();
  return [...applicants]
    .filter(a => !seen.includes(a.id))
    .sort((a, b) => parseSubmittedAtDate(b.submittedAt) - parseSubmittedAtDate(a.submittedAt))
    .slice(0, 20)
    .map(a => ({
      applicantId: a.id,
      title: 'มีผู้สมัครใหม่เข้ามา!',
      message: `${a.title || ''} ${a.firstName || ''} ${a.lastName || ''} สมัครหลักสูตร ${a.course || '-'}`,
      time: a.submittedAtDate || a.submittedAt || ''
    }));
}

function updateNotificationsUI() {
  let localList = [];
  try {
    localList = JSON.parse(localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS) || '[]');
  } catch (e) { localList = []; }
  const seen = getSeenNotificationIds();
  localList = localList.filter(n => !seen.includes(n.applicantId));

  const sheetList = computeSheetBasedNotifications();

  const byApplicant = new Map();
  sheetList.forEach(n => byApplicant.set(n.applicantId, n));
  localList.forEach(n => { if (!byApplicant.has(n.applicantId)) byApplicant.set(n.applicantId, n); });

  const list = Array.from(byApplicant.values());

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
        <div class="p-3 border-b hover:bg-blue-50 cursor-pointer transition text-left" onclick="previewApplicantForm('${escJsAttr(n.applicantId)}')">
          <div class="font-bold text-xs text-blue-900 flex justify-between">
            <span>${escapeHtml(n.title)}</span>
            <span class="text-[10px] text-gray-400">${escapeHtml(n.time)}</span>
          </div>
          <div class="text-xs text-gray-700 mt-1">${escapeHtml(n.message)}</div>
        </div>
      `).join('');
    }
  }
}

function pruneStaleNotificationData(currentApplicants) {
  const validIds = new Set((currentApplicants || []).map(a => a.id));

  try {
    const seen = getSeenNotificationIds().filter(id => validIds.has(id));
    localStorage.setItem(STORAGE_KEYS.NOTIF_SEEN, JSON.stringify(seen));
  } catch (e) { /* ignore */ }

  try {
    const localList = JSON.parse(localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS) || '[]');
    const filtered = Array.isArray(localList) ? localList.filter(n => validIds.has(n.applicantId)) : [];
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(filtered));
  } catch (e) { /* ignore */ }
}

function toggleNotifDropdown() {
  const dropdown = document.getElementById('notif-dropdown');
  if (dropdown) dropdown.classList.toggle('hidden');
}

function setupNotifDropdownAutoClose() {
  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('notif-dropdown');
    if (!dropdown || dropdown.classList.contains('hidden')) return;

    const clickedInsideDropdown = e.target.closest('#notif-dropdown');
    const clickedBellButton = e.target.closest('button[onclick="toggleNotifDropdown()"]');
    if (!clickedInsideDropdown && !clickedBellButton) {
      dropdown.classList.add('hidden');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const dropdown = document.getElementById('notif-dropdown');
      if (dropdown) dropdown.classList.add('hidden');
    }
  });
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

async function refreshFromSheetButton() {
  showLoading(true);
  const ok = await syncFromGoogleSheet(GAS_WEB_APP_URL, { silent: false });
  renderApplicantsTable();
  renderCalendar();
  updateNotificationsUI();
  showLoading(false);
  if (!ok) {
    alert('ไม่สามารถดึงข้อมูลล่าสุดจาก Google Sheet ได้ครบถ้วน กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต หรือค่า GAS_WEB_APP_URL ในไฟล์ gs-api.js');
  }
}