const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw4f7M0ZrL9k1qKUzlRr5wLj_TWtvXPFwrjD7JM_FSQJDdnwEWZvxpq_nJFsQn3v411YA/exec';
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_TOTAL_SIZE = 50 * 1024 * 1024;
const CONFIG_MAX_FILES_PER_KAIZEN = 10;
const monthNamesTH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const STORAGE_KEY = 'kaizenUserSession_v2';
const LAST_ACTIVITY_KEY = 'kaizenLastActivity_v2';

// กำหนดเวลาไม่เคลื่อนไหวเตะออกจากระบบ: 15 นาที (15 * 60 * 1000 ms)
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;

const STATUS_PENDING_HEAD = 'รอหัวหน้าแผนกตรวจ';
const STATUS_PENDING_DIRECTOR = 'รอผู้จัดการตรวจ';
const STATUS_APPROVED = 'ผ่าน';
const STATUS_REJECTED = 'ตีกลับ';

const KAIZEN_TYPES = {
  automation: 'Automation Kaizen',
  karakuri: 'Karakuri Kaizen',
  genco: 'Genba/Genco Kaizen',
  project: 'Project Kaizen',
  service: 'Service Kaizen',
  innovation: 'Kaizen for Innovation',
  suggestion: 'Kaizen Suggestion System'
};

const CATEGORIES = {
  'P': 'ผลผลิต',
  'D': 'การส่งมอบ',
  'E': 'สิ่งแวดล้อม',
  'S': 'ความปลอดภัย',
  'Q': 'คุณภาพ',
  'E2': 'พลังงาน (Energy)',
  'C': 'ลดต้นทุน',
  'M': 'ขวัญกำลังใจ'
};

// ==========================================
// PROCESSING MODAL (แสดงขั้นตอนก่อนบันทึกข้อมูล)
// ==========================================
// หมายเหตุ: Google Apps Script ทำงานแบบ request/response เดียวจบ (synchronous)
// เซิร์ฟเวอร์จึงไม่สามารถส่งสถานะความคืบหน้าจริงกลับมาได้ระหว่างทำงาน
// ขั้นตอน "save/pdf/email" ด้านล่างจึงเป็นการจำลองลำดับที่กำลังเกิดขึ้นจริงบนเซิร์ฟเวอร์
// (บันทึกชีต -> สร้าง PDF -> ส่งอีเมล ตามลำดับที่ Code.gs ทำจริง) เพื่อให้ผู้ใช้เห็นความคืบหน้า
// ระหว่างรอผลลัพธ์ที่แท้จริงจาก callAppsScript()
const PROCESS_STEPS_SUBMIT = [
  { id: 'validate', label: 'ตรวจสอบข้อมูลฟอร์ม' },
  { id: 'files', label: 'ประมวลผลไฟล์แนบเพิ่มเติม' },
  { id: 'images', label: 'เตรียมรูปภาพก่อน–หลังปรับปรุง' },
  { id: 'upload', label: 'ส่งข้อมูลไปยังเซิร์ฟเวอร์' },
  { id: 'save', label: 'บันทึกข้อมูลลง Google Sheet' },
  { id: 'pdf', label: 'สร้างฟอร์ม PDF อัตโนมัติ' },
  { id: 'email', label: 'ส่งอีเมลแจ้งเตือนผู้เกี่ยวข้อง' },
  { id: 'done', label: 'เสร็จสิ้น' }
];

let processingStepStates = {};
let processingCycleTimer = null;

function openProcessingModal(steps, title) {
  processingStepStates = {};
  steps.forEach(function(s) { processingStepStates[s.id] = 'pending'; });

  const titleEl = document.getElementById('processingModalTitle');
  if (titleEl) titleEl.textContent = title || 'กำลังดำเนินการ';

  const list = document.getElementById('processingStepsList');
  if (list) {
    list.innerHTML = steps.map(function(s) {
      return '<div class="proc-step" id="procstep-' + s.id + '">' +
        '<span class="proc-step-icon" id="procicon-' + s.id + '">•</span>' +
        '<span>' + escapeHtml(s.label) + '</span>' +
        '</div>';
    }).join('');
  }

  const bar = document.getElementById('processingOverallBar');
  if (bar) bar.style.width = '0%';

  const modal = document.getElementById('processingModal');
  if (modal) modal.classList.remove('hidden');
}

function setProcessingStep(steps, id, status) {
  processingStepStates[id] = status; // pending | active | done | error
  const el = document.getElementById('procstep-' + id);
  const icon = document.getElementById('procicon-' + id);
  if (el && icon) {
    el.classList.remove('active', 'done', 'error');
    if (status === 'active') { el.classList.add('active'); icon.textContent = '●'; }
    else if (status === 'done') { el.classList.add('done'); icon.textContent = '✓'; }
    else if (status === 'error') { el.classList.add('error'); icon.textContent = '✕'; }
    else { icon.textContent = '•'; }
  }

  const doneCount = steps.filter(function(s) { return processingStepStates[s.id] === 'done'; }).length;
  const pct = Math.round((doneCount / steps.length) * 100);
  const bar = document.getElementById('processingOverallBar');
  if (bar) bar.style.width = pct + '%';
}

function closeProcessingModal() {
  if (processingCycleTimer) { clearInterval(processingCycleTimer); processingCycleTimer = null; }
  const modal = document.getElementById('processingModal');
  if (modal) modal.classList.add('hidden');
}

// จำลองการไล่ทำทีละขั้นตอนระหว่างรอผลลัพธ์จริงจากเซิร์ฟเวอร์
function cycleServerSteps(steps, ids, intervalMs) {
  let idx = 0;
  if (processingCycleTimer) clearInterval(processingCycleTimer);
  setProcessingStep(steps, ids[0], 'active');
  processingCycleTimer = setInterval(function() {
    setProcessingStep(steps, ids[idx], 'done');
    idx++;
    if (idx >= ids.length) {
      clearInterval(processingCycleTimer);
      processingCycleTimer = null;
      return;
    }
    setProcessingStep(steps, ids[idx], 'active');
  }, intervalMs);
}

let CURRENT_USER = null;
let MY_RECORDS = [];
let QUEUE_RECORDS = [];
let DASHBOARD_DATA = null;
let currentDashboardYear = null;
let selectedFiles = [];
let existingFileUrlsForEdit = [];
let currentCommentKaizenId = null;
let isLoading = false;
let PROGRESS_EMPLOYEES = [];
let progressBeYear = null;
let progressCurrentMonth = null;
let progressSelectedMonth = null;
let progressPlantFilter = '';
let progressDeptFilter = '';
let currentTransactionId = null;
let isSubmitting = false;
let selectedRole = 'employee';
let debounceTimers = {};
let EMP_MANAGE_LIST = [];
let currentEmpHistoryEmpId = null;
let currentEmpHistoryEmpName = null;

let inactivityTimer = null;
let inactivityCheckInterval = null;

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function driveImageSrc(url, size) {
  if (!url) return '';
  if (url.startsWith('data:')) return url;
  const m = String(url).match(/[-\w]{25,}/);
  if (!m) return url;
  const sz = size || 'w600';
  return 'https://drive.google.com/thumbnail?id=' + m[0] + '&sz=' + sz;
}

function driveImageThumb(url) {
  return driveImageSrc(url, 'w120');
}

function showLoading() {
  isLoading = true;
  const bar = document.getElementById('loadingBar');
  if (bar) bar.style.display = 'block';
}

function hideLoading() {
  isLoading = false;
  const bar = document.getElementById('loadingBar');
  if (bar) bar.style.display = 'none';
}

function showError(err, title) {
  hideLoading();
  const msg = typeof err === 'string' ? err : (err.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
  console.error('Error:', err);
  Swal.fire({
    icon: 'error',
    title: title || 'เกิดข้อผิดพลาด',
    text: msg,
    confirmButtonColor: '#1B6E4C'
  });
}

function showSuccess(msg) {
  hideLoading();
  Swal.fire({
    icon: 'success',
    title: msg,
    timer: 1500,
    showConfirmButton: false
  });
}

function debounce(func, wait) {
  const key = func.name || 'anonymous';
  return function() {
    const context = this;
    const args = arguments;
    clearTimeout(debounceTimers[key]);
    debounceTimers[key] = setTimeout(function() {
      func.apply(context, args);
      delete debounceTimers[key];
    }, wait);
  };
}

function callAppsScript(action, payload) {
  updateUserActivity();
  return fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: action, payload: payload || {} })
    })
    .then(function(r) {
      if (!r.ok) throw new Error('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ (HTTP ' + r.status + ')');
      return r.json();
    })
    .catch(function(err) {
      if (err.message && err.message.includes('Failed to fetch')) {
        throw new Error('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต');
      }
      throw err;
    });
}

function readFileAsDataUrl(file) {
  return new Promise(function(resolve, reject) {
    if (file.size > MAX_FILE_SIZE) {
      reject(new Error('ไฟล์ "' + file.name + '" มีขนาดใหญ่เกินไป (' + (file.size / 1024 / 1024).toFixed(2) + ' MB) จำกัดไม่เกิน 10 MB'));
      return;
    }
    const reader = new FileReader();
    reader.onload = function() { resolve(reader.result); };
    reader.onerror = function() { reject(new Error('ไม่สามารถอ่านไฟล์ "' + file.name + '" ได้')); };
    reader.readAsDataURL(file);
  });
}

function processFilesWithProgress(files, onProgress) {
  const total = files.length;
  let processed = 0;
  const results = [];
  const errors = [];

  return files.reduce(function(promise, fileData) {
    return promise.then(function() {
      return readFileAsDataUrl(fileData.file).then(function(dataUrl) {
        processed++;
        if (onProgress) onProgress(processed, total, fileData.file.name);
        results.push({ base64: dataUrl, name: fileData.name, mimeType: fileData.type, size: fileData.file.size });
      }).catch(function(err) {
        processed++;
        errors.push(err.message);
        if (onProgress) onProgress(processed, total, fileData.file.name);
      });
    });
  }, Promise.resolve()).then(function() {
    if (errors.length > 0 && results.length === 0) throw new Error(errors.join('\n'));
    if (errors.length > 0) console.warn('Some files failed:', errors);
    return results;
  });
}

function statusPill(status) {
  if (status === STATUS_APPROVED) return '<span class="badge badge-approved">✅ ผ่าน</span>';
  if (status === STATUS_REJECTED) return '<span class="badge badge-rejected">❌ ตีกลับ</span>';
  if (status === STATUS_PENDING_DIRECTOR) return '<span class="badge badge-pending">⏳ รอผู้จัดการตรวจ</span>';
  return '<span class="badge badge-pending">⏳ รอหัวหน้าแผนกตรวจ</span>';
}

function catBadges(categories) {
  if (!categories || Object.keys(categories).filter(function(k) { return categories[k]; }).length === 0) {
    return '<span class="text-slate-300">-</span>';
  }
  let html = '<div class="flex gap-1 flex-wrap">';
  Object.keys(categories).forEach(function(k) {
    if (categories[k] && CATEGORIES[k]) {
      html += '<span class="cat-badge cat-' + k + '" title="' + CATEGORIES[k] + '">' + (k === 'E2' ? 'E' : k) + '</span>';
    }
  });
  return html + '</div>';
}

function catTags(categories) {
  if (!categories) return '';
  const tags = [];
  const colors = { 'P': '#1B6E4C', 'D': '#3E6B84', 'E': '#2F8F57', 'S': '#B0392C', 'Q': '#8B5A2B', 'E2': '#7A5AA6', 'C': '#B07A17', 'M': '#B0567A' };
  Object.keys(categories).forEach(function(k) {
    if (categories[k] && CATEGORIES[k]) {
      tags.push('<span class="cat-tag" style="background:' + (colors[k] || '#8695B4') + '">' + CATEGORIES[k] + '</span>');
    }
  });
  return tags.length ? tags.join('') : '-';
}

function fileIconFor(fileName) {
  if (!fileName) return '📎';
  if (fileName.match(/\.(pdf)$/i)) return '📋';
  if (fileName.match(/\.(xlsx|xls)$/i)) return '📊';
  if (fileName.match(/\.(doc|docx)$/i)) return '📝';
  if (fileName.match(/\.(zip|rar)$/i)) return '📦';
  if (fileName.match(/\.(jpg|jpeg|png|gif|webp)$/i)) return '🖼️';
  return '📎';
}

function renderFileAttachments(fileUrls) {
  if (!fileUrls || fileUrls.length === 0) return '';
  let html = '<div class="flex flex-wrap gap-1 mt-1">';
  fileUrls.forEach(function(url) {
    const fileName = url.split('/').pop().split('?')[0] || 'ไฟล์แนบ';
    const icon = fileIconFor(fileName);
    html += '<a href="' + encodeURI(url) + '" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs">' +
      icon + ' ' + escapeHtml(fileName) + '</a>';
  });
  return html + '</div>';
}

function getTypeLabel(type) {
  if (!type) return '-';
  return KAIZEN_TYPES[type] || type;
}

function renderSelectedFilesList() {
  const container = document.getElementById('selectedFilesList');
  if (!container) return;
  if (selectedFiles.length === 0) { container.innerHTML = ''; return; }
  let html = '';
  selectedFiles.forEach(function(f, idx) {
    html += '<span class="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs" style="background:var(--brand-50); border:1px solid var(--line-soft);">' +
      fileIconFor(f.name) + ' ' + escapeHtml(f.name) +
      ' <button type="button" data-idx="' + idx + '" class="btnRemoveSelectedFile font-bold" style="color:var(--bad-600); border:none; background:none; cursor:pointer;" aria-label="ลบไฟล์แนบ ' + escapeHtml(f.name) + '">✕</button></span>';
  });
  container.innerHTML = html;
  container.querySelectorAll('.btnRemoveSelectedFile').forEach(function(btn) {
    btn.addEventListener('click', function() {
      const idx = parseInt(this.dataset.idx, 10);
      selectedFiles.splice(idx, 1);
      renderSelectedFilesList();
    });
  });
}

function renderExistingFilesList() {
  const container = document.getElementById('existingFilesList');
  if (!container) return;
  if (!existingFileUrlsForEdit || existingFileUrlsForEdit.length === 0) {
    container.innerHTML = '';
    return;
  }
  let html = '<div class="text-xs mb-1 font-semibold" style="color:var(--ink-faint);">ไฟล์แนบเดิมที่บันทึกไว้:</div><div class="flex flex-wrap gap-1">';
  existingFileUrlsForEdit.forEach(function(url, idx) {
    const fileName = url.split('/').pop().split('?')[0] || ('ไฟล์แนบ ' + (idx + 1));
    const icon = fileIconFor(fileName);
    html += '<span class="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs" style="background:var(--surface-sunken); border:1px solid var(--line-soft);">' +
      '<a href="' + encodeURI(url) + '" target="_blank" rel="noopener noreferrer" style="color:var(--ink);text-decoration:none;">' + icon + ' ' + escapeHtml(fileName) + '</a>' +
      ' <button type="button" data-idx="' + idx + '" class="btnRemoveExistingFile font-bold ml-1" style="color:var(--bad-600); border:none; background:none; cursor:pointer;" title="ลบไฟล์เดิมนี้ออก">✕</button></span>';
  });
  html += '</div>';
  container.innerHTML = html;

  container.querySelectorAll('.btnRemoveExistingFile').forEach(function(btn) {
    btn.addEventListener('click', function() {
      const idx = parseInt(this.dataset.idx, 10);
      existingFileUrlsForEdit.splice(idx, 1);
      renderExistingFilesList();
    });
  });
}

function handleMultiFileSelect(fileList) {
  const files = Array.prototype.slice.call(fileList || []);
  if (files.length === 0) return;

  const totalCount = selectedFiles.length + existingFileUrlsForEdit.length + files.length;
  if (totalCount > CONFIG_MAX_FILES_PER_KAIZEN) {
    Swal.fire({
      icon: 'warning',
      title: 'แนบไฟล์ได้สูงสุด ' + CONFIG_MAX_FILES_PER_KAIZEN + ' ไฟล์ต่อ 1 Kaizen',
      confirmButtonColor: '#1B6E4C'
    });
    return;
  }

  let currentTotalSize = selectedFiles.reduce(function(sum, f) { return sum + (f.file.size || 0); }, 0);
  const rejected = [];

  files.forEach(function(f) {
    if (f.size > MAX_FILE_SIZE) {
      rejected.push(f.name + ' (ใหญ่เกิน 10MB)');
      return;
    }
    const prospectiveTotal = currentTotalSize + f.size;
    if (prospectiveTotal > MAX_TOTAL_SIZE) {
      rejected.push(f.name + ' (ขนาดรวมเกิน 50MB)');
      return;
    }
    currentTotalSize = prospectiveTotal;
    selectedFiles.push({ file: f, name: f.name, type: f.type });
  });

  renderSelectedFilesList();

  if (rejected.length > 0) {
    Swal.fire({
      icon: 'warning',
      title: 'มีไฟล์ที่ไม่ได้แนบ',
      html: rejected.map(escapeHtml).join('<br>'),
      confirmButtonColor: '#1B6E4C'
    });
  }
}

function daysInMonth(beYear, month) {
  return new Date(beYear - 543, month, 0).getDate();
}

function updateDayOptions() {
  const day = document.getElementById('dDay');
  const month = parseInt(document.getElementById('dMonth').value, 10);
  const year = parseInt(document.getElementById('dYear').value, 10);
  if (!month || !year) return;
  const max = daysInMonth(year, month);
  const cur = parseInt(day.value, 10) || 1;
  day.innerHTML = '';
  for (let i = 1; i <= max; i++) {
    day.innerHTML += '<option value="' + i + '">' + i + '</option>';
  }
  day.value = Math.min(cur, max);
  updateFormHeaderDate();
}

function updateFormHeaderDate() {
  const el = document.getElementById('formHeaderDateLabel');
  const d = document.getElementById('dDay').value;
  const m = parseInt(document.getElementById('dMonth').value, 10);
  const y = document.getElementById('dYear').value;
  el.textContent = d && m && y ? (d + ' ' + monthNamesTH[m - 1] + ' ' + y) : '-';
}

function initDatePickers() {
  const dMonth = document.getElementById('dMonth');
  const dYear = document.getElementById('dYear');
  dMonth.innerHTML = '';
  monthNamesTH.forEach(function(m, i) {
    dMonth.innerHTML += '<option value="' + (i + 1) + '">' + m + '</option>';
  });
  const now = new Date().getFullYear() + 543;
  dYear.innerHTML = '';
  for (let y = now - 3; y <= now + 1; y++) {
    dYear.innerHTML += '<option value="' + y + '">' + y + '</option>';
  }
  dMonth.value = new Date().getMonth() + 1;
  dYear.value = now;
  updateDayOptions();
  document.getElementById('dDay').value = new Date().getDate();
  updateFormHeaderDate();
}

function getCurrentDateString() {
  const y = parseInt(document.getElementById('dYear').value, 10);
  const m = parseInt(document.getElementById('dMonth').value, 10);
  const d = parseInt(document.getElementById('dDay').value, 10);
  return (y - 543) + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}

function getSelectedCategories() {
  const cats = {};
  document.querySelectorAll('.category-checkbox[data-cat].checked').forEach(function(el) {
    if (el.dataset.cat) cats[el.dataset.cat] = true;
  });
  return cats;
}

function setCategories(cats) {
  document.querySelectorAll('.category-checkbox[data-cat]').forEach(function(el) {
    el.classList.remove('checked');
    el.setAttribute('aria-checked', 'false');
  });
  Object.keys(cats || {}).forEach(function(k) {
    if (cats[k]) {
      const el = document.querySelector('.category-checkbox[data-cat="' + k + '"]');
      if (el) {
        el.classList.add('checked');
        el.setAttribute('aria-checked', 'true');
      }
    }
  });
  document.getElementById('categoriesData').value = JSON.stringify(getSelectedCategories());
}

function clearCategories() {
  document.querySelectorAll('.category-checkbox[data-cat]').forEach(function(el) {
    el.classList.remove('checked');
    el.setAttribute('aria-checked', 'false');
  });
  document.getElementById('categoriesData').value = '{}';
}

function bindCategoryEvents() {
  document.querySelectorAll('.category-checkbox[data-cat]').forEach(function(el) {
    el.addEventListener('click', function(e) {
      e.preventDefault();
      this.classList.toggle('checked');
      this.setAttribute('aria-checked', this.classList.contains('checked') ? 'true' : 'false');
      document.getElementById('categoriesData').value = JSON.stringify(getSelectedCategories());
    });
    el.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.click();
      }
    });
  });
}

function getSelectedKaizenType() {
  const selected = document.querySelector('.category-checkbox[data-type].checked');
  return selected ? selected.dataset.type : '';
}

function setKaizenType(type) {
  document.querySelectorAll('.category-checkbox[data-type]').forEach(function(el) {
    el.classList.remove('checked');
    el.setAttribute('aria-checked', 'false');
  });
  if (type) {
    const el = document.querySelector('.category-checkbox[data-type="' + type + '"]');
    if (el) {
      el.classList.add('checked');
      el.setAttribute('aria-checked', 'true');
    }
  }
  document.getElementById('kaizenTypeData').value = getSelectedKaizenType();
}

function bindKaizenTypeEvents() {
  document.querySelectorAll('.category-checkbox[data-type]').forEach(function(el) {
    el.addEventListener('click', function(e) {
      e.preventDefault();
      document.querySelectorAll('.category-checkbox[data-type]').forEach(function(other) {
        other.classList.remove('checked');
        other.setAttribute('aria-checked', 'false');
      });
      this.classList.add('checked');
      this.setAttribute('aria-checked', 'true');
      document.getElementById('kaizenTypeData').value = getSelectedKaizenType();
    });
    el.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.click();
      }
    });
  });
}

function clearKaizenType() {
  document.querySelectorAll('.category-checkbox[data-type]').forEach(function(el) {
    el.classList.remove('checked');
    el.setAttribute('aria-checked', 'false');
  });
  document.getElementById('kaizenTypeData').value = '';
}

// ==========================================
// SESSION MANAGEMENT & AUTO-LOGOUT SYSTEM
// ==========================================

function saveSession(user) {
  try {
    // ใช้ sessionStorage แทน localStorage เพื่อให้เมื่อปิดแท็บ ระบบจะล้างเซสชันทิ้งทันที
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    sessionStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
    // เคลียร์ localStorage เก่าทิ้งเพื่อไม่ให้ค้างเซสชันถาวร
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {}
}

function loadSession() {
  try {
    // ล้าง localStorage เก่าที่อาจค้างอยู่
    localStorage.removeItem(STORAGE_KEY);

    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    // ตรวจสอบ Inactivity Timeout ขณะโหลดซ้ำ
    const lastActive = parseInt(sessionStorage.getItem(LAST_ACTIVITY_KEY) || '0', 10);
    if (lastActive > 0 && (Date.now() - lastActive > INACTIVITY_TIMEOUT_MS)) {
      clearSession();
      return null;
    }

    const data = JSON.parse(raw);
    if (!data.id || !data.role) return null;
    return data;
  } catch (e) {
    return null;
  }
}

function clearSession() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(LAST_ACTIVITY_KEY);
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {}
}

function updateUserActivity() {
  try {
    sessionStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
  } catch (e) {}
  resetInactivityTimer();
}

function resetInactivityTimer() {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  if (CURRENT_USER) {
    inactivityTimer = setTimeout(triggerAutoLogout, INACTIVITY_TIMEOUT_MS);
  }
}

function triggerAutoLogout() {
  if (!CURRENT_USER) return;
  clearSession();
  CURRENT_USER = null;
  MY_RECORDS = [];
  QUEUE_RECORDS = [];
  DASHBOARD_DATA = null;
  PROGRESS_EMPLOYEES = [];

  document.getElementById('appShell').classList.add('hidden');
  document.getElementById('formModal').classList.add('hidden');
  document.getElementById('detailModal').classList.add('hidden');
  document.getElementById('commentModal').classList.add('hidden');
  document.getElementById('empHistoryModal').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('btnAdminTools').classList.add('hidden');
  document.getElementById('loginId').value = '';
  document.getElementById('loginId').focus();

  Swal.fire({
    icon: 'warning',
    title: 'ออกจากระบบอัตโนมัติ',
    text: 'คุณไม่มีการใช้งานเกิน 15 นาที หรือปิดแท็บไป ระบบจึงออกจากระบบอัตโนมัติเพื่อความปลอดภัย',
    confirmButtonColor: '#1B6E4C'
  });
}

function checkActivityOnWakeup() {
  if (!CURRENT_USER) return;
  const lastActive = parseInt(sessionStorage.getItem(LAST_ACTIVITY_KEY) || '0', 10);
  if (lastActive > 0 && (Date.now() - lastActive > INACTIVITY_TIMEOUT_MS)) {
    triggerAutoLogout();
  } else {
    updateUserActivity();
  }
}

function initAutoLogoutListeners() {
  const events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll'];
  const throttledUpdate = debounce(function() {
    if (CURRENT_USER) updateUserActivity();
  }, 1000);

  events.forEach(function(evt) {
    window.addEventListener(evt, throttledUpdate, { passive: true });
  });

  // ตรวจสอบเมื่อแท็บถูกสลับกลับมาใช้งาน (Visibility Change หรือ Focus)
  document.addEventListener('visibilitychange', function() {
    if (!document.hidden) checkActivityOnWakeup();
  });
  window.addEventListener('focus', checkActivityOnWakeup);

  // Interval ตรวจสอบทุก ๆ 30 วินาที
  if (inactivityCheckInterval) clearInterval(inactivityCheckInterval);
  inactivityCheckInterval = setInterval(function() {
    if (CURRENT_USER) checkActivityOnWakeup();
  }, 30000);
}

function buildUserFromIdentifyResult_(rawTypedId, res) {
  const profile = res.profile || {};
  const canonicalId = profile.empId || profile.id || rawTypedId;
  return Object.assign({}, profile, { id: canonicalId, role: res.role });
}

function setSelectedRole(role) {
  selectedRole = role;
  document.getElementById('roleEmployeeBtn').classList.toggle('active', role === 'employee');
  document.getElementById('roleManagerBtn').classList.toggle('active', role === 'manager');
  document.getElementById('loginIdLabel').textContent = role === 'employee' ? 'รหัสพนักงาน' : 'รหัสหัวหน้างาน';
  document.getElementById('loginId').placeholder = role === 'employee' ? 'เช่น 00123' : 'เช่น 00456';
  document.getElementById('loginError').classList.add('hidden');
  document.getElementById('loginId').focus();
}

function handleLogin(e) {
  e.preventDefault();
  const id = document.getElementById('loginId').value.trim();
  const btn = document.getElementById('btnLogin');
  const errEl = document.getElementById('loginError');
  errEl.classList.add('hidden');

  if (!id) {
    errEl.textContent = 'กรุณากรอกรหัสของคุณ';
    errEl.classList.remove('hidden');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'กำลังตรวจสอบ...';

  callAppsScript('identifyUser', { role: selectedRole, id: id })
    .then(function(res) {
      btn.disabled = false;
      btn.textContent = 'เข้าสู่ระบบ';
      if (!res.success) {
        errEl.textContent = res.message;
        errEl.classList.remove('hidden');
        return;
      }
      const user = buildUserFromIdentifyResult_(id, res);
      saveSession(user);
      startApp(user);
    })
    .catch(function(err) {
      btn.disabled = false;
      btn.textContent = 'เข้าสู่ระบบ';
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    });
}

function logout() {
  Swal.fire({
    title: 'ยืนยันการออกจากระบบ',
    text: 'คุณต้องการออกจากระบบใช่หรือไม่?',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'ออกจากระบบ',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#B0392C',
    cancelButtonColor: '#8695B4'
  }).then(function(result) {
    if (result.isConfirmed) {
      clearSession();
      CURRENT_USER = null;
      MY_RECORDS = [];
      QUEUE_RECORDS = [];
      DASHBOARD_DATA = null;
      PROGRESS_EMPLOYEES = [];
      document.getElementById('appShell').classList.add('hidden');
      document.getElementById('loginScreen').classList.remove('hidden');
      document.getElementById('btnAdminTools').classList.add('hidden');
      document.getElementById('loginId').value = '';
      document.getElementById('loginId').focus();
      Object.keys(debounceTimers).forEach(function(key) {
        clearTimeout(debounceTimers[key]);
        delete debounceTimers[key];
      });
    }
  });
}

function startApp(user) {
  CURRENT_USER = user;
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('appShell').classList.remove('hidden');

  const roleLabel = user.role === 'employee' ? 'พนักงาน' :
    ((user.approverType || []).indexOf('ผู้จัดการ') > -1 ? 'ผู้จัดการ' : 'หัวหน้าแผนก');
  document.getElementById('profileLine').textContent = user.name + ' · ' + (user.department || '-') + ' · ' + roleLabel;

  buildTabs();
  resetInactivityTimer();

  if (user.role === 'employee') {
    document.getElementById('btnOpenForm').classList.remove('hidden');
    document.getElementById('btnOpenForm').classList.add('flex');
    document.getElementById('btnAdminTools').classList.add('hidden');
    switchView('emp');
    loadMyRecords();
  } else {
    const isDirector = (user.approverType || []).indexOf('ผู้จัดการ') > -1;
    document.getElementById('btnAdminTools').classList.toggle('hidden', !isDirector);
    switchView('mgrQueue');
    loadQueue();
  }
}

function buildTabs() {
  const bar = document.getElementById('tabBar');
  bar.innerHTML = '';
  if (CURRENT_USER.role === 'employee') {
    bar.innerHTML = '<button class="tab-btn active" data-view="emp" role="tab" aria-selected="true">รายการของฉัน</button>';
  } else {
    const isDirector = (CURRENT_USER.approverType || []).indexOf('ผู้จัดการ') > -1;
    bar.innerHTML =
      '<button class="tab-btn active" data-view="mgrQueue" role="tab" aria-selected="true">คิวตรวจ Kaizen</button>' +
      '<button class="tab-btn" data-view="mgrHrDash" role="tab" aria-selected="false">📊 Dashboard HR</button>' +
      (isDirector ? '<button class="tab-btn" data-view="mgrBulk" role="tab" aria-selected="false">🔢 ความคืบหน้า Kaizen</button>' : '') +
      '<button class="tab-btn" data-view="mgrEmpManage" role="tab" aria-selected="false">✏️ จัดการพนักงาน</button>';
  }
  bar.querySelectorAll('.tab-btn').forEach(function(btn) {
    btn.addEventListener('click', function() { switchView(this.dataset.view); });
  });
}

function switchView(view) {
  document.getElementById('empView').classList.toggle('hidden', view !== 'emp');
  document.getElementById('mgrQueueView').classList.toggle('hidden', view !== 'mgrQueue');
  document.getElementById('mgrHrDashView').classList.toggle('hidden', view !== 'mgrHrDash');
  document.getElementById('mgrBulkView').classList.toggle('hidden', view !== 'mgrBulk');
  document.getElementById('mgrEmpManageView').classList.toggle('hidden', view !== 'mgrEmpManage');

  document.querySelectorAll('#tabBar .tab-btn').forEach(function(b) {
    const isActive = b.dataset.view === view;
    b.classList.toggle('active', isActive);
    b.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  if (view === 'mgrHrDash') loadHrDashboard();
  if (view === 'mgrBulk' && PROGRESS_EMPLOYEES.length === 0) loadMonthlyProgress();
  if (view === 'mgrEmpManage') loadEmployeeManage();
}

function loadMyRecords() {
  if (isLoading) return;
  showLoading();
  callAppsScript('getMyRecords', { empId: CURRENT_USER.id })
    .then(function(res) {
      hideLoading();
      if (!res.success) { showError(res.message); return; }
      MY_RECORDS = res.records || [];
      renderEmpKPI();
      renderEmpTable();
    })
    .catch(function(err) { hideLoading(); showError(err); });
}

function renderEmpKPI() {
  const target = (typeof CURRENT_USER.target === 'number') ? CURRENT_USER.target : 0;
  const approved = MY_RECORDS.filter(function(r) { return r.status === STATUS_APPROVED; }).length;
  const pending = MY_RECORDS.filter(function(r) { return r.status === STATUS_PENDING_HEAD || r.status === STATUS_PENDING_DIRECTOR; }).length;
  const rejected = MY_RECORDS.filter(function(r) { return r.status === STATUS_REJECTED; }).length;

  document.getElementById('empTarget').textContent = target;
  document.getElementById('empApproved').textContent = approved;
  document.getElementById('empPending').textContent = pending;
  document.getElementById('empRejected').textContent = rejected;

  const pct = target > 0 ? Math.min(100, Math.round((approved / target) * 100)) : 100;
  document.getElementById('empProgressBar').style.width = pct + '%';
  document.getElementById('empProgressLabel').textContent = approved + ' / ' + target + ' (' + pct + '%)';
}

function renderEmpTable() {
  const tbody = document.getElementById('empTableBody');
  tbody.innerHTML = '';
  document.getElementById('empRowCount').textContent = MY_RECORDS.length;
  document.getElementById('empEmptyState').classList.toggle('hidden', MY_RECORDS.length > 0);

  MY_RECORDS.forEach(function(r) {
    let actionHtml = '';
    if (r.status === STATUS_REJECTED) {
      actionHtml = '<button class="btnResubmit btn-secondary text-xs py-1 px-3" data-row="' + r.rowIndex + '" data-id="' + escapeHtml(r.id) + '" aria-label="แก้ไขและส่งใหม่">แก้ไข/ส่งใหม่</button>';
    } else if (r.status === STATUS_PENDING_HEAD || r.status === STATUS_PENDING_DIRECTOR) {
      actionHtml = '<button class="btnViewEmp text-xs font-semibold" style="color:var(--brand-600); background:none; border:none; cursor:pointer;" data-id="' + escapeHtml(r.id) + '" aria-label="ดูรายละเอียด">ดูรายละเอียด</button>' +
        '<button class="btnDeleteEmp text-xs ml-2" style="color:var(--bad-600); background:none; border:none; cursor:pointer;" data-row="' + r.rowIndex + '" data-id="' + escapeHtml(r.id) + '" aria-label="ลบรายการ">🗑️</button>';
    } else {
      actionHtml = '<button class="btnViewEmp text-xs font-semibold" style="color:var(--brand-600); background:none; border:none; cursor:pointer;" data-id="' + escapeHtml(r.id) + '" aria-label="ดูรายละเอียด">ดูรายละเอียด</button>';
    }

    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td class="font-semibold" style="color:var(--ink);">' + escapeHtml(r.id) + '</td>' +
      '<td style="color:var(--ink-faint);">' + escapeHtml(r.dateDisplay) + '</td>' +
      '<td class="max-w-xs truncate" title="' + escapeHtml(r.title) + '">' + escapeHtml(r.title) + '</td>' +
      '<td class="text-xs" style="color:var(--ink-faint);">' + escapeHtml(getTypeLabel(r.kaizenType)) + '</td>' +
      '<td>' + catBadges(r.categories) + '</td>' +
      '<td>' + statusPill(r.status) + (r.status === STATUS_REJECTED && r.rejectReason ? '<div class="text-xs mt-1" style="color:var(--bad-600);">' + escapeHtml(r.rejectReason) + '</div>' : '') + '</td>' +
      '<td>' + actionHtml + '</td>';
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.btnResubmit').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      const id = this.dataset.id;
      const rec = MY_RECORDS.find(function(r) { return r.id === id; });
      if (rec) openForm(rec);
    });
  });

  tbody.querySelectorAll('.btnViewEmp').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      const id = this.dataset.id;
      const rec = MY_RECORDS.find(function(r) { return r.id === id; });
      if (rec) showDetail(rec, false);
    });
  });

  tbody.querySelectorAll('.btnDeleteEmp').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      const rowIndex = this.dataset.row;
      const id = this.dataset.id;
      confirmDeleteRecord(rowIndex, id, 'emp');
    });
  });
}

function confirmDeleteRecord(rowIndex, id, type) {
  Swal.fire({
    title: 'ยืนยันการลบ',
    text: 'คุณต้องการลบ Kaizen ' + (id || '') + ' ใช่หรือไม่? การลบจะไม่สามารถกู้คืนได้',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ลบ',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#B0392C',
    cancelButtonColor: '#8695B4'
  }).then(function(result) {
    if (result.isConfirmed) deleteRecord(rowIndex, id, type);
  });
}

function deleteRecord(rowIndex, id, type) {
  showLoading();
  const payload = { rowIndex: parseInt(rowIndex, 10), id: id, kaizenId: id };
  if (type === 'emp') payload.empId = CURRENT_USER.id;
  else payload.reviewerId = CURRENT_USER.id;

  callAppsScript('deleteKaizenRecord', payload)
    .then(function(res) {
      hideLoading();
      if (res.success) {
        showSuccess(res.message);
        if (type === 'emp') loadMyRecords();
        else loadQueue();
      } else showError(res.message);
    })
    .catch(function(err) { hideLoading(); showError(err); });
}

function showAdminToolsMenu() {
  const html =
    '<div style="text-align:left;display:flex;flex-direction:column;gap:8px;">' +
    '<button type="button" class="btn-secondary" onclick="Swal.close();showEmailLogs();">📧 ตรวจสอบอีเมลที่ส่งไม่สำเร็จ</button>' +
    '<button type="button" class="btn-secondary" onclick="Swal.close();debugReviewQueue();">🐛 ตรวจสอบคิวตรวจสอบ (Debug Review Queue)</button>' +
    '<button type="button" class="btn-secondary" onclick="Swal.close();repairDepartmentNames();">🏢 ซ่อมชื่อแผนกใน Data</button>' +
    '<button type="button" class="btn-secondary" onclick="Swal.close();syncManagerDepartments();">🔄 ซิงค์แผนกใน Managers</button>' +
    '<button type="button" class="btn-secondary" onclick="Swal.close();fixColumnAlignment();">🧩 ซ่อมตำแหน่งคอลัมน์ Status/หมวดหมู่</button>' +
    '<button type="button" class="btn-secondary" onclick="Swal.close();autoRepairAllSheetsUI();">🩹 ซ่อมแซมหัวตารางทุกชีตอัตโนมัติ</button>' +
    '<button type="button" class="btn-secondary" onclick="Swal.close();setupDatabaseUI();">🗄️ ตั้งค่า/ซ่อม Header ทุกชีต</button>' +
    '</div>';
  Swal.fire({
    title: '🛠️ เครื่องมือระบบ (สำหรับผู้จัดการ)',
    html: html,
    showConfirmButton: false,
    showCloseButton: true,
    width: '440px'
  });
}

function repairDepartmentNames() {
  Swal.fire({
    title: 'ยืนยันการซ่อมแซม',
    text: 'ระบบจะปรับชื่อแผนกใน Data sheet ให้ตรงกันทั้งหมด ต้องการดำเนินการต่อหรือไม่?',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'ดำเนินการ',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#1B6E4C',
    cancelButtonColor: '#8695B4'
  }).then(function(result) {
    if (result.isConfirmed) {
      showLoading();
      callAppsScript('repairDepartmentNames', {})
        .then(function(res) {
          hideLoading();
          if (res.success) {
            showSuccess(res.message);
            loadQueue();
            DASHBOARD_DATA = null;
            loadHrDashboard();
          } else showError(res.message);
        })
        .catch(function(err) { hideLoading(); showError(err); });
    }
  });
}

function syncManagerDepartments() {
  Swal.fire({
    title: 'ยืนยันการซิงค์',
    text: 'ระบบจะปรับชื่อแผนกใน Managers sheet ให้ตรงกับ HR_Employees ต้องการดำเนินการต่อหรือไม่?',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'ดำเนินการ',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#1B6E4C',
    cancelButtonColor: '#8695B4'
  }).then(function(result) {
    if (result.isConfirmed) {
      showLoading();
      callAppsScript('syncManagerDepartments', {})
        .then(function(res) {
          hideLoading();
          if (res.success) {
            showSuccess(res.message);
            loadQueue();
            DASHBOARD_DATA = null;
            loadHrDashboard();
          } else showError(res.message);
        })
        .catch(function(err) { hideLoading(); showError(err); });
    }
  });
}

function fixColumnAlignment() {
  Swal.fire({
    title: 'ยืนยันการซ่อมแซม',
    text: 'ระบบจะตรวจสอบและย้ายค่า "สถานะ" กับ "หมวดหมู่ P-M" ในชีต Data ให้กลับไปอยู่ตำแหน่งคอลัมน์ที่ถูกต้อง ต้องการดำเนินการต่อหรือไม่?',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'ดำเนินการ',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#1B6E4C',
    cancelButtonColor: '#8695B4'
  }).then(function(result) {
    if (result.isConfirmed) {
      showLoading();
      callAppsScript('repairDataColumnAlignment', {})
        .then(function(res) {
          hideLoading();
          if (res.success) {
            showSuccess(res.message);
            loadQueue();
            DASHBOARD_DATA = null;
            loadHrDashboard();
          } else showError(res.message);
        })
        .catch(function(err) { hideLoading(); showError(err); });
    }
  });
}

function autoRepairAllSheetsUI() {
  Swal.fire({
    title: 'ยืนยันการซ่อมแซมหัวตารางทุกชีต',
    text: 'ระบบจะตรวจสอบและตั้งหัวตาราง (Header) ของชีต Data / History / Comments ให้ถูกต้องตามมาตรฐาน และแก้ไขชื่อพนักงานในชีต HR_Employees ที่ยังเป็นสูตรค้างอยู่ ต้องการดำเนินการต่อหรือไม่?',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'ดำเนินการ',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#1B6E4C',
    cancelButtonColor: '#8695B4'
  }).then(function(result) {
    if (result.isConfirmed) {
      showLoading();
      callAppsScript('autoRepairAllSheets', {})
        .then(function(res) {
          hideLoading();
          if (res.success) {
            Swal.fire({
              icon: 'success',
              title: 'ซ่อมแซมเรียบร้อยแล้ว',
              html: '<pre style="text-align:left;white-space:pre-wrap;font-size:12px;">' + escapeHtml(res.message || '') + '</pre>',
              confirmButtonColor: '#1B6E4C'
            });
            loadQueue();
            DASHBOARD_DATA = null;
            loadHrDashboard();
          } else showError(res.message);
        })
        .catch(function(err) { hideLoading(); showError(err); });
    }
  });
}

function setupDatabaseUI() {
  Swal.fire({
    title: 'ยืนยันการตั้งค่า/ซ่อมแซม Header',
    text: 'ระบบจะตรวจสอบชีตที่จำเป็นทั้งหมดและตั้งหัวตารางให้ตรงตามมาตรฐานของระบบ ต้องการดำเนินการต่อหรือไม่?',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'ดำเนินการ',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#1B6E4C',
    cancelButtonColor: '#8695B4'
  }).then(function(result) {
    if (result.isConfirmed) {
      showLoading();
      callAppsScript('setupDatabase', {})
        .then(function(res) {
          hideLoading();
          if (res.success) {
            showSuccess(res.message);
            loadQueue();
            DASHBOARD_DATA = null;
            loadHrDashboard();
          } else showError(res.message);
        })
        .catch(function(err) { hideLoading(); showError(err); });
    }
  });
}

function showEmailLogs() {
  showLoading();
  callAppsScript('getEmailLogs', { limit: 200 })
    .then(function(res) {
      hideLoading();
      if (!res.success) { showError(res.message); return; }

      const logs = res.logs || [];
      let html = '<div style="text-align:left;font-size:12px;max-height:440px;overflow-y:auto;">';

      if (logs.length === 0) {
        html += '<p style="color:var(--ink-faint);">ยังไม่มีประวัติการส่งอีเมล</p>';
      } else {
        const failCount = logs.filter(function(l){ return l.status !== 'SENT'; }).length;
        html += '<p style="margin-bottom:10px;">แสดง <b>' + logs.length + '</b> รายการล่าสุด · ' +
          '<span style="color:' + (failCount > 0 ? 'var(--bad-600)' : 'var(--good-600)') + ';font-weight:700;">ล้มเหลว/ไม่มีผู้รับ ' + failCount + ' รายการ</span></p>';

        logs.forEach(function(l) {
          const ok = l.status === 'SENT';
          const bg = ok ? 'var(--good-50)' : 'var(--bad-50)';
          const border = ok ? '#A7E0C0' : '#F3C6C2';
          const statusLabel = ok ? '✅ ส่งสำเร็จ' :
            (l.status === 'NO_RECIPIENTS' ? '⚠️ ไม่มีผู้รับ (ไม่พบอีเมล)' : '❌ ส่งไม่สำเร็จ');

          html += '<div style="background:' + bg + ';border:1px solid ' + border + ';border-radius:8px;padding:8px 10px;margin-bottom:6px;">' +
            '<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;">' +
            '<b>' + escapeHtml(l.kaizenId || '-') + '</b>' +
            '<span style="color:var(--ink-faint);">' + escapeHtml(l.type || '') + '</span>' +
            '<span>' + statusLabel + '</span>' +
            '</div>' +
            '<div style="color:var(--ink-faint);margin-top:2px;">' + escapeHtml(l.timestamp) + '</div>' +
            (l.recipients ? '<div style="margin-top:2px;">ผู้รับ: ' + escapeHtml(l.recipients) + '</div>' : '') +
            (l.errorMessage ? '<div style="color:var(--bad-600);margin-top:2px;">เหตุผล: ' + escapeHtml(l.errorMessage) + '</div>' : '') +
            '</div>';
        });
      }
      html += '</div>';

      Swal.fire({
        title: '📧 ประวัติการส่งอีเมล',
        html: html,
        confirmButtonColor: '#1B6E4C',
        width: '760px',
        padding: '1.5rem',
        confirmButtonText: 'ปิด'
      });
    })
    .catch(function(err) { hideLoading(); showError(err); });
}

function debugReviewQueue() {
  showLoading();
  callAppsScript('debugReviewQueue', { reviewerId: CURRENT_USER.id })
    .then(function(res) {
      hideLoading();
      if (!res.success) { showError(res.message); return; }
      
      const debug = res.debug;
      const isHeadRole = (debug.reviewerApproverTypes || []).indexOf('หัวหน้าแผนก') > -1;
      const isDirectorRole = (debug.reviewerApproverTypes || []).indexOf('ผู้จัดการ') > -1;

      let html = '<div style="text-align:left;font-size:13px;line-height:1.6;">';
      html += '<p><b>👤 ผู้ตรวจสอบ:</b> ' + escapeHtml(debug.reviewerName) + '</p>';
      html += '<p><b>🏢 แผนก:</b> "' + escapeHtml(debug.reviewerDepartment) + '"</p>';
      html += '<p><b>📋 บทบาท:</b> ' + escapeHtml((debug.reviewerApproverTypes || []).join(', ') || '-') + '</p>';
      html += '<hr style="border-color:var(--line-soft);margin:8px 0;">';
      html += '<p><b>📊 สถานะคิวทั้งหมด (ทุกแผนก):</b></p>';
      html += '<ul style="margin:4px 0 8px 18px;">';
      html += '<li>📌 รอหัวหน้าแผนกตรวจทั้งหมด: <b>' + debug.totalPendingHead + '</b> รายการ' + (isHeadRole ? ' <span style="color:var(--good-600);">(ตรวจได้)</span>' : '') + '</li>';
      html += '<li>📌 รอผู้จัดการตรวจทั้งหมด: <b>' + debug.totalPendingDirector + '</b> รายการ' + (isDirectorRole ? ' <span style="color:var(--good-600);">(ตรวจได้)</span>' : '') + '</li>';
      html += '<li style="color:var(--brand-700);font-weight:700;">👁️ รายการที่คุณเห็นจริงในคิว: <b>' + debug.recordsVisibleToReviewer + '</b> รายการ</li>';
      html += '</ul>';

      if (debug.recordsVisibleList && debug.recordsVisibleList.length > 0) {
        html += '<div style="background:var(--good-50);padding:8px 12px;border-radius:8px;border:1px solid #A7E0C0;margin:4px 0;max-height:220px;overflow-y:auto;">';
        html += '<p style="font-weight:bold;color:var(--good-600);">✅ รายการที่คุณเห็นในคิวตอนนี้:</p>';
        debug.recordsVisibleList.forEach(function(item) {
          html += '<div style="font-size:12px;padding:2px 0;">- ' + escapeHtml(item.id) + ' [' + escapeHtml(item.status) + '] "' + escapeHtml(item.department) + '" - ' + escapeHtml(item.title) + '</div>';
        });
        html += '</div>';
      } else {
        html += '<div style="background:var(--warn-50);padding:8px 12px;border-radius:8px;border:1px solid #FCE7B0;margin:4px 0;">';
        html += '<p style="color:var(--warn-600);">⚠️ ไม่พบรายการที่รอการตรวจในบทบาทของคุณขณะนี้</p>';
        html += '</div>';
      }
      html += '</div>';
      
      Swal.fire({
        title: '🐛 ตรวจสอบคิวตรวจสอบ',
        html: html,
        confirmButtonColor: '#1B6E4C',
        width: '820px',
        padding: '1.5rem',
        confirmButtonText: 'ปิด'
      });
    })
    .catch(function(err) {
      hideLoading();
      showError(err);
    });
}

function loadQueue() {
  if (isLoading) return;
  showLoading();
  const scopeSel = document.getElementById('mgrScopeFilter');
  const keyword = document.getElementById('mgrSearch').value.trim();
  const scope = (scopeSel && scopeSel.dataset.userSet === '1') ? scopeSel.value : '';
  callAppsScript('getReviewQueue', { reviewerId: CURRENT_USER.id, scope: scope, keyword: keyword })
    .then(function(res) {
      hideLoading();
      if (!res.success) { showError(res.message); return; }
      QUEUE_RECORDS = res.records || [];
      if (scopeSel && res.scope) scopeSel.value = res.scope;
      renderMgrKPI();
      renderMgrTable();
    })
    .catch(function(err) { hideLoading(); showError(err); });
}

function renderMgrKPI() {
  document.getElementById('mgrKpiTotal').textContent = QUEUE_RECORDS.length;
  document.getElementById('mgrKpiPending').textContent = QUEUE_RECORDS.filter(function(r) {
    return r.status === STATUS_PENDING_HEAD || r.status === STATUS_PENDING_DIRECTOR;
  }).length;
  document.getElementById('mgrKpiApproved').textContent = QUEUE_RECORDS.filter(function(r) { return r.status === STATUS_APPROVED; }).length;
  document.getElementById('mgrKpiRejected').textContent = QUEUE_RECORDS.filter(function(r) { return r.status === STATUS_REJECTED; }).length;
}

function openImageViewer(imageUrl, label) {
  if (!imageUrl) return;
  
  let displayUrl = imageUrl;
  const fileId = imageUrl.match(/[-\w]{25,}/);
  if (fileId) {
    displayUrl = 'https://drive.google.com/thumbnail?id=' + fileId[0] + '&sz=w1200';
  }

  const modalHtml = 
    '<div class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background:rgba(0,0,0,0.85); backdrop-filter:blur(8px);" onclick="closeImageViewer(event)">' +
    '<div class="relative max-w-4xl max-h-[90vh] w-full" onclick="event.stopPropagation();">' +
    '<button onclick="closeImageViewer(event)" class="absolute -top-12 right-0 text-white text-2xl hover:text-gray-300 transition" style="background:none;border:none;cursor:pointer;">✕</button>' +
    '<div class="bg-white rounded-xl p-2 shadow-2xl">' +
    '<div class="text-xs font-semibold p-2" style="color:var(--ink-faint);">' + (label || 'รูปภาพ') + '</div>' +
    '<img src="' + displayUrl + '" alt="' + (label || 'รูปภาพ') + '" class="w-full max-h-[70vh] object-contain rounded" onerror="this.parentElement.innerHTML=\'<div class=\\\'p-8 text-center text-slate-500\\\'>ไม่สามารถโหลดรูปภาพได้</div>\'">' +
    '<div class="flex justify-between items-center p-2 text-xs" style="color:var(--ink-faint);">' +
    '<span>คลิกนอกภาพเพื่อปิด</span>' +
    '<a href="' + imageUrl + '" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">เปิดใน Drive</a>' +
    '</div>' +
    '</div>' +
    '</div>' +
    '</div>';

  const existingModal = document.getElementById('imageViewerModal');
  if (existingModal) existingModal.remove();

  const div = document.createElement('div');
  div.id = 'imageViewerModal';
  div.innerHTML = modalHtml;
  document.body.appendChild(div);
}

function closeImageViewer(event) {
  if (event && event.target && !event.target.closest('#imageViewerModal')) return;
  const modal = document.getElementById('imageViewerModal');
  if (modal) modal.remove();
}

function buildDetailModalCardHtml(r) {
  const isPending = r.status === STATUS_PENDING_HEAD || r.status === STATUS_PENDING_DIRECTOR;
  const isManagerRole = !!(CURRENT_USER && CURRENT_USER.role === 'manager');
  const isDirectorUser = isManagerRole && (CURRENT_USER.approverType || []).indexOf('ผู้จัดการ') > -1;
  const isHeadUser = isManagerRole && (CURRENT_USER.approverType || []).indexOf('หัวหน้าแผนก') > -1;
  const canApproveThis = (isHeadUser && r.status === STATUS_PENDING_HEAD) || (isDirectorUser && r.status === STATUS_PENDING_DIRECTOR);

  let html = '<div class="kz-card" style="border:none;box-shadow:none;">';

  html += '<div class="kz-card-header" style="border-radius:12px 12px 0 0;">' +
    '<span class="kz-card-id">' + escapeHtml(r.id) + '</span>' +
    '<span class="kz-card-title" title="' + escapeHtml(r.title) + '">' + escapeHtml(r.title) + '</span>' +
    statusPill(r.status) +
    '</div>';

  html += '<div class="kz-card-body">';

  html += '<div class="kz-card-col">' +
    '<div class="kz-info-row"><span class="kz-info-label">👤 พนักงาน</span><span class="kz-info-value">' + escapeHtml(r.name) + '</span></div>' +
    '<div class="kz-info-row"><span class="kz-info-label">🏢 แผนก</span><span class="kz-info-value">' + escapeHtml(r.department) + '</span></div>' +
    '<div class="kz-info-row"><span class="kz-info-label">📅 วันที่ทำ Kaizen</span><span class="kz-info-value">' + escapeHtml(r.dateDisplay) + '</span></div>' +
    '<div class="kz-info-row"><span class="kz-info-label">🏷️ ประเภท</span><span class="kz-info-value">' + escapeHtml(getTypeLabel(r.kaizenType)) + '</span></div>' +
    '<div class="kz-info-row"><span class="kz-info-label">🏷️ หมวดหมู่</span><div class="kz-info-value">' + catBadges(r.categories) + '</div></div>';

  if (r.detail) {
    html += '<span class="kz-result-label">📈 ผลลัพธ์การปรับปรุง</span><div class="kz-result-box">' + escapeHtml(r.detail) + '</div>';
  }
  if (r.result) {
    html += '<span class="kz-result-label">📊 ผลลัพธ์เพิ่มเติม</span><div class="kz-result-box">' + escapeHtml(r.result) + '</div>';
  }

  if (!isPending) {
    html += '<div class="kz-reviewed-box">' +
      '<div><b style="color:var(--ink-soft);">ตรวจโดย:</b> ' + escapeHtml(r.reviewedBy || '-') + '</div>' +
      '<div><b style="color:var(--ink-soft);">วันที่ตรวจ:</b> ' + escapeHtml(r.reviewedDate || '-') + '</div>' +
      (r.status === STATUS_REJECTED && r.rejectReason ? '<div style="color:var(--bad-600);"><b>เหตุผลที่ตีกลับ:</b> ' + escapeHtml(r.rejectReason) + '</div>' : '') +
      '</div>';
  }
  html += '</div>';

  html += '<div class="kz-card-col">' +
    '<div class="kz-ba-row">' +
    '<div class="detail-ba-item before"><div class="ba-header">🔴 Before</div><div class="ba-body">' +
    (r.beforeImageUrl ?
      '<div class="img-frame clickable"><img src="' + driveImageSrc(r.beforeImageUrl) + '" alt="รูปก่อนปรับปรุง" loading="lazy" onclick="openImageViewer(\'' + encodeURI(r.beforeImageUrl) + '\', \'Before\')" onerror="this.parentElement.outerHTML=\'<div class=\\\'ba-empty\\\'>โหลดรูปไม่ได้</div>\'"></div>' :
      '<div class="ba-empty">ไม่มีรูปภาพ</div>') +
    '</div></div>' +
    '<div class="kz-ba-arrow">➜</div>' +
    '<div class="detail-ba-item after"><div class="ba-header">🟢 After</div><div class="ba-body">' +
    (r.afterImageUrl ?
      '<div class="img-frame clickable"><img src="' + driveImageSrc(r.afterImageUrl) + '" alt="รูปหลังปรับปรุง" loading="lazy" onclick="openImageViewer(\'' + encodeURI(r.afterImageUrl) + '\', \'After\')" onerror="this.parentElement.outerHTML=\'<div class=\\\'ba-empty\\\'>โหลดรูปไม่ได้</div>\'"></div>' :
      '<div class="ba-empty">ไม่มีรูปภาพ</div>') +
    '</div></div>' +
    '</div>';

  if (r.beforeProblem || r.afterSolution) {
    html += '<div class="grid grid-cols-2 gap-2 mt-2 text-xs" style="color:var(--ink-soft);">' +
      '<div>' + (r.beforeProblem ? '<b>ปัญหา:</b> ' + escapeHtml(r.beforeProblem) : '') + '</div>' +
      '<div>' + (r.afterSolution ? '<b>วิธีแก้:</b> ' + escapeHtml(r.afterSolution) : '') + '</div>' +
      '</div>';
  }
  html += '</div>';

  html += '<div class="kz-card-col">';
  html += '<span class="kz-files-label">📎 ไฟล์แนบ' + (r.fileUrls && r.fileUrls.length ? ' (' + r.fileUrls.length + ' ไฟล์)' : '') + '</span>';

  let fileHtml = '';
  if (r.formPdfUrl) fileHtml += '<a href="' + encodeURI(r.formPdfUrl) + '" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs">📋 ฟอร์ม PDF</a>';
  if (r.pdfUrl) fileHtml += '<a href="' + encodeURI(r.pdfUrl) + '" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs">📄 PDF</a>';
  if (r.excelUrl) fileHtml += '<a href="' + encodeURI(r.excelUrl) + '" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs">📊 Excel</a>';
  if (r.fileUrls && r.fileUrls.length > 0) fileHtml += renderFileAttachments(r.fileUrls);

  html += fileHtml ? '<div class="kz-files-list">' + fileHtml + '</div>' : '<div class="kz-files-empty">ไม่มีไฟล์แนบ</div>';

  html += '<span class="kz-actions-label" style="margin-top:14px;">⚙️ การดำเนินการ</span>';
  html += '<div class="kz-actions" style="margin-top:0;padding-top:0;border-top:none;">';

  if (isManagerRole && isPending && canApproveThis) {
    html += '<button type="button" class="btn-success" onclick="reviewRecord(' + r.rowIndex + ', \'' + escapeHtml(r.id) + '\', \'approve\')" aria-label="อนุมัติ">✅ อนุมัติ</button>';
    html += '<button type="button" class="btn-danger" onclick="document.getElementById(\'detailModal\').classList.add(\'hidden\');promptReject(' + r.rowIndex + ', \'' + escapeHtml(r.id) + '\')" aria-label="ตีกลับ">❌ ตีกลับ</button>';
  } else if (isManagerRole && isPending && !canApproveThis) {
    html += '<div class="kz-waiting-note">⏳ รอผู้ตรวจสอบที่เกี่ยวข้อง</div>';
  }

  html += '<div class="kz-act-secondary">' +
    '<button type="button" class="btn-secondary" onclick="showVersionHistory(\'' + escapeHtml(r.id) + '\')" aria-label="ดูประวัติการแก้ไข">📜 ดูประวัติ</button>' +
    '<button type="button" class="btn-secondary" onclick="openCommentModal(\'' + escapeHtml(r.id) + '\')" aria-label="แสดงความคิดเห็น">💬 ความคิดเห็น</button>' +
    '</div>';

  html += '</div>'; 
  html += '</div>';

  html += '</div>';
  html += '</div>';

  return html;
}

function buildMgrCardHtml(r) {
  const isPending = r.status === STATUS_PENDING_HEAD || r.status === STATUS_PENDING_DIRECTOR;
  const isDirectorUser = (CURRENT_USER.approverType || []).indexOf('ผู้จัดการ') > -1;
  const isHeadUser = (CURRENT_USER.approverType || []).indexOf('หัวหน้าแผนก') > -1;
  const canApproveThis = (isHeadUser && r.status === STATUS_PENDING_HEAD) || (isDirectorUser && r.status === STATUS_PENDING_DIRECTOR);

  let html = '<div class="kz-card" data-row="' + r.rowIndex + '" data-id="' + escapeHtml(r.id) + '">';

  html += '<div class="kz-card-header">' +
    '<span class="kz-card-id">' + escapeHtml(r.id) + '</span>' +
    '<span class="kz-card-title" title="' + escapeHtml(r.title) + '">' + escapeHtml(r.title) + '</span>' +
    statusPill(r.status) +
    '</div>';

  html += '<div class="kz-card-body">';

  html += '<div class="kz-card-col">' +
    '<div class="kz-info-row"><span class="kz-info-label">👤 พนักงาน</span><span class="kz-info-value">' + escapeHtml(r.name) + '</span></div>' +
    '<div class="kz-info-row"><span class="kz-info-label">🏢 แผนก</span><span class="kz-info-value">' + escapeHtml(r.department) + '</span></div>' +
    '<div class="kz-info-row"><span class="kz-info-label">📅 วันที่ทำ Kaizen</span><span class="kz-info-value">' + escapeHtml(r.dateDisplay) + '</span></div>' +
    '<div class="kz-info-row"><span class="kz-info-label">🏷️ ประเภท</span><span class="kz-info-value">' + escapeHtml(getTypeLabel(r.kaizenType)) + '</span></div>' +
    '<div class="kz-info-row"><span class="kz-info-label">🏷️ หมวดหมู่</span><div class="kz-info-value">' + catBadges(r.categories) + '</div></div>';

  if (r.detail) {
    html += '<span class="kz-result-label">📈 ผลลัพธ์การปรับปรุง</span><div class="kz-result-box">' + escapeHtml(r.detail) + '</div>';
  }
  if (r.result) {
    html += '<span class="kz-result-label">📊 ผลลัพธ์เพิ่มเติม</span><div class="kz-result-box">' + escapeHtml(r.result) + '</div>';
  }

  if (!isPending) {
    html += '<div class="kz-reviewed-box">' +
      '<div><b style="color:var(--ink-soft);">ตรวจโดย:</b> ' + escapeHtml(r.reviewedBy || '-') + '</div>' +
      '<div><b style="color:var(--ink-soft);">วันที่ตรวจ:</b> ' + escapeHtml(r.reviewedDate || '-') + '</div>' +
      (r.status === STATUS_REJECTED && r.rejectReason ? '<div style="color:var(--bad-600);"><b>เหตุผลที่ตีกลับ:</b> ' + escapeHtml(r.rejectReason) + '</div>' : '') +
      '</div>';
  }
  html += '</div>';

  html += '<div class="kz-card-col">' +
    '<div class="kz-ba-row">' +
    '<div class="detail-ba-item before"><div class="ba-header">🔴 Before</div><div class="ba-body">' +
    (r.beforeImageUrl ?
      '<div class="img-frame clickable"><img src="' + driveImageSrc(r.beforeImageUrl) + '" alt="รูปก่อนปรับปรุง" loading="lazy" onclick="openImageViewer(\'' + encodeURI(r.beforeImageUrl) + '\', \'Before\')" onerror="this.parentElement.outerHTML=\'<div class=\\\'ba-empty\\\'>โหลดรูปไม่ได้</div>\'"></div>' :
      '<div class="ba-empty">ไม่มีรูปภาพ</div>') +
    '</div></div>' +
    '<div class="kz-ba-arrow">➜</div>' +
    '<div class="detail-ba-item after"><div class="ba-header">🟢 After</div><div class="ba-body">' +
    (r.afterImageUrl ?
      '<div class="img-frame clickable"><img src="' + driveImageSrc(r.afterImageUrl) + '" alt="รูปหลังปรับปรุง" loading="lazy" onclick="openImageViewer(\'' + encodeURI(r.afterImageUrl) + '\', \'After\')" onerror="this.parentElement.outerHTML=\'<div class=\\\'ba-empty\\\'>โหลดรูปไม่ได้</div>\'"></div>' :
      '<div class="ba-empty">ไม่มีรูปภาพ</div>') +
    '</div></div>' +
    '</div>';

  if (r.beforeProblem || r.afterSolution) {
    html += '<div class="grid grid-cols-2 gap-2 mt-2 text-xs" style="color:var(--ink-soft);">' +
      '<div>' + (r.beforeProblem ? '<b>ปัญหา:</b> ' + escapeHtml(r.beforeProblem) : '') + '</div>' +
      '<div>' + (r.afterSolution ? '<b>วิธีแก้:</b> ' + escapeHtml(r.afterSolution) : '') + '</div>' +
      '</div>';
  }
  html += '</div>';

  html += '<div class="kz-card-col">';
  html += '<span class="kz-files-label">📎 ไฟล์แนบ' + (r.fileUrls && r.fileUrls.length ? ' (' + r.fileUrls.length + ' ไฟล์)' : '') + '</span>';

  let fileHtml = '';
  if (r.formPdfUrl) fileHtml += '<a href="' + encodeURI(r.formPdfUrl) + '" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs">📋 ฟอร์ม PDF</a>';
  if (r.pdfUrl) fileHtml += '<a href="' + encodeURI(r.pdfUrl) + '" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs">📄 PDF</a>';
  if (r.excelUrl) fileHtml += '<a href="' + encodeURI(r.excelUrl) + '" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs">📊 Excel</a>';
  if (r.fileUrls && r.fileUrls.length > 0) fileHtml += renderFileAttachments(r.fileUrls);

  html += fileHtml ? '<div class="kz-files-list">' + fileHtml + '</div>' : '<div class="kz-files-empty">ไม่มีไฟล์แนบ</div>';

  html += '<span class="kz-actions-label" style="margin-top:14px;">⚙️ การดำเนินการ</span>';
  html += '<div class="kz-actions" style="margin-top:0;padding-top:0;border-top:none;">';

  if (isPending && canApproveThis) {
    html += '<button type="button" class="btnApprove btn-success" data-row="' + r.rowIndex + '" data-id="' + escapeHtml(r.id) + '" aria-label="อนุมัติ">✅ อนุมัติ</button>';
    html += '<button type="button" class="btnReject btn-danger" data-row="' + r.rowIndex + '" data-id="' + escapeHtml(r.id) + '" aria-label="ตีกลับ">❌ ตีกลับ</button>';
  } else if (isPending && !canApproveThis) {
    html += '<div class="kz-waiting-note">⏳ รอผู้ตรวจสอบที่เกี่ยวข้อง</div>';
  }

  html += '<div class="kz-act-secondary">' +
    '<button type="button" class="btnHistory btn-secondary" data-id="' + escapeHtml(r.id) + '" aria-label="ดูประวัติการแก้ไข">📜 ดูประวัติ</button>' +
    '<button type="button" class="btnComment btn-secondary" data-id="' + escapeHtml(r.id) + '" aria-label="แสดงความคิดเห็น">💬 ความคิดเห็น</button>' +
    '</div>';
  html += '<button type="button" class="btnDeleteMgr btn-secondary" style="color:var(--bad-600);" data-row="' + r.rowIndex + '" data-id="' + escapeHtml(r.id) + '" aria-label="ลบรายการ">🗑️ ลบรายการ</button>';

  html += '</div>'; 
  html += '</div>'; 

  html += '</div>'; 
  html += '</div>';

  return html;
}

function renderMgrTable() {
  const search = document.getElementById('mgrSearch').value.trim().toLowerCase();
  const statusFilter = document.getElementById('mgrStatusFilter').value;

  const filtered = QUEUE_RECORDS.filter(function(r) {
    const matchSearch = !search ||
      (r.name || '').toLowerCase().indexOf(search) > -1 ||
      (r.title || '').toLowerCase().indexOf(search) > -1 ||
      (r.id || '').toLowerCase().indexOf(search) > -1 ||
      (r.department || '').toLowerCase().indexOf(search) > -1 ||
      (r.detail || '').toLowerCase().indexOf(search) > -1 ||
      (r.beforeProblem || '').toLowerCase().indexOf(search) > -1 ||
      (r.afterSolution || '').toLowerCase().indexOf(search) > -1;
    const matchStatus = !statusFilter || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const container = document.getElementById('mgrCardsContainer');
  document.getElementById('mgrRowCount').textContent = filtered.length;
  document.getElementById('mgrEmptyState').classList.toggle('hidden', filtered.length > 0);

  let html = '';
  filtered.forEach(function(r) {
    html += buildMgrCardHtml(r);
  });
  container.innerHTML = html;

  bindMgrTableEvents(container);
}

function bindMgrTableEvents(container) {
  container.querySelectorAll('.btnApprove').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      reviewRecord(this.dataset.row, this.dataset.id, 'approve');
    });
  });

  container.querySelectorAll('.btnReject').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      promptReject(this.dataset.row, this.dataset.id);
    });
  });

  container.querySelectorAll('.btnHistory').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      showVersionHistory(this.dataset.id);
    });
  });

  container.querySelectorAll('.btnComment').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      openCommentModal(this.dataset.id);
    });
  });

  container.querySelectorAll('.btnDeleteMgr').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      confirmDeleteRecord(this.dataset.row, this.dataset.id, 'mgr');
    });
  });
}

function promptReject(rowIndex, id) {
  Swal.fire({
    icon: 'warning',
    title: 'ระบุเหตุผลในการตีกลับ',
    input: 'textarea',
    inputPlaceholder: 'กรุณาระบุเหตุผล...',
    showCancelButton: true,
    confirmButtonText: 'ตีกลับ',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#B0392C',
    cancelButtonColor: '#8695B4',
    inputValidator: function(v) { if (!v || !v.trim()) return 'กรุณาระบุเหตุผล'; }
  }).then(function(result) {
    if (result.isConfirmed) reviewRecord(rowIndex, id, 'reject', result.value.trim());
  });
}

function reviewRecord(rowIndex, id, decision, reason) {
  showLoading();
  callAppsScript('reviewKaizenRecord', {
      rowIndex: parseInt(rowIndex, 10),
      id: id,
      kaizenId: id,
      decision: decision,
      reason: reason || '',
      reviewerId: CURRENT_USER.id
    })
    .then(function(res) {
      hideLoading();
      if (res.success) {
        showSuccess(res.message);
        document.getElementById('detailModal').classList.add('hidden');
        DASHBOARD_DATA = null;
        loadQueue();
        loadHrDashboard();
        if (currentEmpHistoryEmpId && !document.getElementById('empHistoryModal').classList.contains('hidden')) {
          showEmployeeHistory(currentEmpHistoryEmpId, currentEmpHistoryEmpName);
        }
      } else showError(res.message);
    })
    .catch(function(err) { hideLoading(); showError(err); });
}

function showDetail(r, allowReview) {
  const body = document.getElementById('detailBody');
  body.innerHTML = buildDetailModalCardHtml(r);
  const actions = document.getElementById('detailReviewActions');
  actions.classList.add('hidden');
  actions.innerHTML = '';

  document.getElementById('detailModalTitle').textContent = 'รายละเอียด Kaizen (' + r.id + ')';
  document.getElementById('detailModal').classList.remove('hidden');
}

function showVersionHistory(kaizenId) {
  showLoading();
  callAppsScript('getKaizenHistory', { kaizenId: kaizenId })
    .then(function(res) {
      hideLoading();
      if (!res.success) { showError(res.message); return; }

      const history = res.history || [];
      let html = '<div class="text-sm">';
      if (history.length === 0) {
        html += '<p style="color:var(--ink-faint);">ยังไม่มีประวัติการแก้ไข</p>';
      } else {
        html += '<div class="space-y-2 max-h-96 overflow-y-auto">';
        const actionLabels = {
          'CREATE': '📝 สร้าง', 'CREATE_BY_MANAGER': '👤 หัวหน้างานบันทึกแทน',
          'UPDATE': '✏️ แก้ไข', 'APPROVE': '✅ อนุมัติ', 'REJECT': '❌ ตีกลับ',
          'RESUBMIT': '🔄 ส่งใหม่', 'DELETE': '🗑️ ลบ', 'HEAD_APPROVE': '👔 หัวหน้าแผนกอนุมัติ',
          'DIRECTOR_APPROVE': '👨‍💼 ผู้จัดการอนุมัติ'
        };

        history.forEach(function(h) {
          const date = h.timestamp ? new Date(h.timestamp).toLocaleString('th-TH') : '-';
          const actionLabel = actionLabels[h.action] || h.action;

          html +=
            '<div class="pl-3 py-2 rounded-r-lg" style="border-left:3px solid var(--brand-500); background:var(--brand-50);">' +
            '<div class="flex justify-between items-start">' +
            '<div><span class="font-bold" style="color:var(--brand-700);">เวอร์ชัน ' + h.version + '</span> <span class="ml-2 text-sm font-semibold">' + actionLabel + '</span></div>' +
            '<span class="text-xs" style="color:var(--ink-faint);">' + date + '</span>' +
            '</div>' +
            '<div class="text-xs mt-1" style="color:var(--ink-soft);">โดย: ' + escapeHtml(h.userName || 'System') + '</div>';

          if (h.action === 'REJECT' && h.newData && h.newData.rejectReason) {
            html += '<div class="mt-1 text-xs" style="color:var(--bad-600);">เหตุผล: ' + escapeHtml(h.newData.rejectReason) + '</div>';
          }

          html += '</div>';
        });

        html += '</div>';
      }
      html += '</div>';

      Swal.fire({
        title: '📜 ประวัติการแก้ไข (' + kaizenId + ')',
        html: html,
        confirmButtonColor: '#1B6E4C',
        width: '780px',
        padding: '1.5rem',
        confirmButtonText: 'ปิด'
      });
    })
    .catch(function(err) { hideLoading(); showError(err); });
}

function openCommentModal(kaizenId) {
  currentCommentKaizenId = kaizenId;
  document.getElementById('commentModalTitle').textContent = '💬 ความคิดเห็น (' + kaizenId + ')';
  document.getElementById('commentModal').classList.remove('hidden');
  document.getElementById('newComment').focus();
  loadComments(kaizenId);
}

function closeCommentModal() {
  document.getElementById('commentModal').classList.add('hidden');
  currentCommentKaizenId = null;
}

function loadComments(kaizenId) {
  showLoading();
  callAppsScript('getComments', { kaizenId: kaizenId })
    .then(function(res) {
      hideLoading();
      if (!res.success) { showError(res.message); return; }

      const list = document.getElementById('commentList');
      const comments = res.comments || [];

      if (comments.length === 0) {
        list.innerHTML = '<p class="text-center py-4" style="color:var(--ink-faint);">ยังไม่มีความคิดเห็น</p>';
      } else {
        let html = '';
        comments.forEach(function(c) {
          const date = c.timestamp ? new Date(c.timestamp).toLocaleString('th-TH') : '-';
          const isOwn = c.userId === CURRENT_USER.id;
          html +=
            '<div class="rounded-lg p-3" style="background:var(--surface-tint); border:1px solid var(--line-soft);">' +
            '<div class="flex justify-between items-start">' +
            '<div><span class="font-semibold text-sm" style="color:var(--ink);">' + escapeHtml(c.userName || 'ไม่ระบุ') + '</span>' +
            '<span class="text-xs ml-2" style="color:var(--ink-faint);">' + date + '</span></div>' +
            (isOwn ? '<button onclick="deleteComment(\'' + c.id + '\')" class="text-xs" style="color:var(--bad-600);border:none;background:none;cursor:pointer;" aria-label="ลบความคิดเห็น">ลบ</button>' : '') +
            '</div>' +
            '<p class="text-sm mt-1 whitespace-pre-wrap">' + escapeHtml(c.comment) + '</p>' +
            '</div>';
        });
        list.innerHTML = html;
      }

      document.getElementById('newComment').value = '';
    })
    .catch(function(err) { hideLoading(); showError(err); });
}

function submitComment() {
  const comment = document.getElementById('newComment').value.trim();
  if (!comment) {
    Swal.fire({ icon: 'warning', title: 'กรุณาเขียนความคิดเห็น', confirmButtonColor: '#1B6E4C' });
    return;
  }

  showLoading();
  callAppsScript('addComment', {
      kaizenId: currentCommentKaizenId,
      comment: comment,
      userId: CURRENT_USER.id,
      userName: CURRENT_USER.name
    })
    .then(function(res) {
      hideLoading();
      if (res.success) {
        loadComments(currentCommentKaizenId);
        showSuccess('เพิ่มความคิดเห็นสำเร็จ');
      } else showError(res.message);
    })
    .catch(function(err) { hideLoading(); showError(err); });
}

function deleteComment(commentId) {
  Swal.fire({
    icon: 'warning',
    title: 'ยืนยันการลบ',
    text: 'คุณต้องการลบความคิดเห็นนี้ใช่หรือไม่?',
    showCancelButton: true,
    confirmButtonText: 'ลบ',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#B0392C',
    cancelButtonColor: '#8695B4'
  }).then(function(result) {
    if (result.isConfirmed) {
      showLoading();
      callAppsScript('deleteComment', { commentId: commentId, userId: CURRENT_USER.id })
        .then(function(res) {
          hideLoading();
          if (res.success) {
            loadComments(currentCommentKaizenId);
            showSuccess('ลบความคิดเห็นสำเร็จ');
          } else showError(res.message);
        })
        .catch(function(err) { hideLoading(); showError(err); });
    }
  });
}

function showAdvancedSearch() {
  const depts = [];
  QUEUE_RECORDS.forEach(function(r) {
    if (r.department && depts.indexOf(r.department) === -1) depts.push(r.department);
  });
  depts.sort();

  const categories = ['P', 'D', 'E', 'S', 'Q', 'E2', 'C', 'M'];
  const statuses = [STATUS_PENDING_HEAD, STATUS_PENDING_DIRECTOR, STATUS_APPROVED, STATUS_REJECTED];

  const html =
    '<div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-left" style="padding-top:4px;">' +
    '<div><label class="text-xs font-semibold block mb-1" style="color:var(--ink-soft);">ค้นหาคำ</label><input id="advKeyword" class="input-field text-sm" placeholder="รหัส, หัวข้อ, ชื่อพนักงาน..."></div>' +
    '<div><label class="text-xs font-semibold block mb-1" style="color:var(--ink-soft);">สถานะ</label><select id="advStatus" class="input-field text-sm"><option value="">ทั้งหมด</option>' +
    statuses.map(function(s) { return '<option value="' + s + '">' + s + '</option>'; }).join('') +
    '</select></div>' +
    '<div><label class="text-xs font-semibold block mb-1" style="color:var(--ink-soft);">แผนก</label><select id="advDepartment" class="input-field text-sm"><option value="">ทั้งหมด</option>' +
    depts.map(function(d) { return '<option value="' + d + '">' + d + '</option>'; }).join('') +
    '</select></div>' +
    '<div><label class="text-xs font-semibold block mb-1" style="color:var(--ink-soft);">หมวดหมู่</label><select id="advCategory" class="input-field text-sm"><option value="">ทั้งหมด</option>' +
    categories.map(function(c) { return '<option value="' + c + '">' + CATEGORIES[c] + '</option>'; }).join('') +
    '</select></div>' +
    '<div><label class="text-xs font-semibold block mb-1" style="color:var(--ink-soft);">วันที่เริ่มต้น</label><input id="advDateFrom" type="date" class="input-field text-sm"></div>' +
    '<div><label class="text-xs font-semibold block mb-1" style="color:var(--ink-soft);">วันที่สิ้นสุด</label><input id="advDateTo" type="date" class="input-field text-sm"></div>' +
    '<div><label class="text-xs font-semibold block mb-1" style="color:var(--ink-soft);">ผู้ตรวจสอบ</label><input id="advReviewedBy" class="input-field text-sm" placeholder="ชื่อผู้ตรวจสอบ"></div>' +
    '<div class="flex items-end gap-3"><div class="flex-1"><label class="text-xs font-semibold block mb-1" style="color:var(--ink-soft);">เรียงตาม</label><select id="advSortBy" class="input-field text-sm"><option value="date">วันที่</option><option value="id">รหัส</option><option value="title">หัวข้อ</option><option value="name">พนักงาน</option><option value="department">แผนก</option><option value="status">สถานะ</option></select></div>' +
    '<div class="flex-1"><label class="text-xs font-semibold block mb-1" style="color:var(--ink-soft);">ลำดับ</label><select id="advSortOrder" class="input-field text-sm"><option value="desc">มากไปน้อย</option><option value="asc">น้อยไปมาก</option></select></div></div>' +
    '</div>';

  Swal.fire({
    title: '🔍 ค้นหาและกรองขั้นสูง',
    html: html,
    confirmButtonText: 'ค้นหา',
    cancelButtonText: 'ยกเลิก',
    showCancelButton: true,
    confirmButtonColor: '#1B6E4C',
    cancelButtonColor: '#8695B4',
    width: '860px',
    padding: '1.75rem',
    preConfirm: function() {
      return {
        keyword: document.getElementById('advKeyword').value.trim(),
        status: document.getElementById('advStatus').value,
        department: document.getElementById('advDepartment').value,
        category: document.getElementById('advCategory').value,
        dateFrom: document.getElementById('advDateFrom').value,
        dateTo: document.getElementById('advDateTo').value,
        reviewedBy: document.getElementById('advReviewedBy').value.trim(),
        sortBy: document.getElementById('advSortBy').value,
        sortOrder: document.getElementById('advSortOrder').value
      };
    }
  }).then(function(result) {
    if (result.isConfirmed && result.value) performAdvancedSearch(result.value);
  });
}

function performAdvancedSearch(params) {
  showLoading();
  callAppsScript('advancedSearch', params)
    .then(function(res) {
      hideLoading();
      if (!res.success) { showError(res.message); return; }
      QUEUE_RECORDS = res.records || [];
      renderMgrKPI();
      renderMgrTable();
      Swal.fire({ icon: 'success', title: 'พบ ' + res.total + ' รายการ', timer: 1500, showConfirmButton: false });
    })
    .catch(function(err) { hideLoading(); showError(err); });
}

function loadHrDashboard(beYear) {
  if (isLoading) return;
  const yearToLoad = beYear ? Number(beYear) : null;
  document.getElementById('hrDashScopeLabel').textContent = ' (ทุกแผนก)';

  showLoading();
  callAppsScript('getDashboardData', { beYear: yearToLoad, department: null })
    .then(function(res) {
      hideLoading();
      if (!res.success) { showError(res.message); return; }
      DASHBOARD_DATA = res;
      currentDashboardYear = res.beYear;
      populateHrDashYears(res.availableYears, res.beYear);
      renderHrDashKPI(res.summary);
      renderHrDashTable();
    })
    .catch(function(err) { hideLoading(); showError(err); });
}

function populateHrDashYears(years, selected) {
  const sel = document.getElementById('hrDashYear');
  sel.innerHTML = '';
  (years || []).forEach(function(y) {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = 'พ.ศ. ' + y;
    sel.appendChild(opt);
  });
  sel.value = selected;
}

function renderHrDashKPI(summary) {
  document.getElementById('hrTotalEmp').textContent = summary.totalEmployees || 0;
  document.getElementById('hrAchieved').textContent = summary.submittedApprovedCount || 0;
  document.getElementById('hrTargetSum').textContent = summary.totalTargetSum || 0;
  document.getElementById('hrPercent').textContent = (summary.achievedPercent || 0) + '%';
}

function renderHrDashTable() {
  if (!DASHBOARD_DATA) return;

  const search = document.getElementById('hrDashSearch').value.trim().toLowerCase();
  const status = document.getElementById('hrDashStatus').value;

  const filtered = DASHBOARD_DATA.employees.filter(function(e) {
    const matchSearch = !search ||
      (e.name || '').toLowerCase().indexOf(search) > -1 ||
      (e.department || '').toLowerCase().indexOf(search) > -1 ||
      (e.empId || '').toLowerCase().indexOf(search) > -1;
    const matchStatus = !status || (status === 'achieved' ? e.achieved : !e.achieved);
    return matchSearch && matchStatus;
  });

  const tbody = document.getElementById('hrDashTableBody');
  tbody.innerHTML = '';
  document.getElementById('hrRowCount').textContent = filtered.length;
  document.getElementById('hrDashEmptyState').classList.toggle('hidden', filtered.length > 0);

  filtered.forEach(function(e) {
    const pct = e.percent || 0;
    const barColor = e.achieved ? 'linear-gradient(90deg,#1B6E4C,#2A8C61)' : (pct >= 50 ? 'linear-gradient(90deg,#B07A17,#C3780C)' : 'linear-gradient(90deg,#B0392C,#D8433B)');
    const badge = e.achieved ? '<span class="badge badge-approved">✅ ถึงเป้าหมาย</span>' : '<span class="badge badge-pending">⏳ ยังไม่ถึง</span>';

    const tr = document.createElement('tr');
    tr.dataset.empid = e.empId;
    tr.innerHTML =
      '<td class="font-semibold" style="color:var(--ink);">' + escapeHtml(e.empId) + '</td>' +
      '<td class="font-semibold" style="color:var(--ink);">' + escapeHtml(e.name) + '</td>' +
      '<td>' + escapeHtml(e.department || '-') + '</td>' +
      '<td class="text-center font-semibold num">' + e.target + '</td>' +
      '<td class="text-center font-bold num" style="color:' + (e.achieved ? 'var(--brand-600)' : 'var(--ink)') + ';">' + e.count + '</td>' +
      '<td><div class="flex items-center gap-2"><div class="progress-track flex-1"><div class="progress-fill" style="width:' + pct + '%;background:' + barColor + '"></div></div><span class="text-xs font-semibold num min-w-[2.5rem]">' + pct + '%</span></div></td>' +
      '<td class="text-center">' + badge + '</td>' +
      '<td class="text-center"><button class="btnViewEmpHistory btn-secondary text-xs py-1 px-2" data-empid="' + escapeHtml(e.empId) + '" aria-label="ดูประวัติ Kaizen">📋 ดูประวัติ</button></td>';
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.btnViewEmpHistory').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      const empId = this.dataset.empid;
      const emp = DASHBOARD_DATA.employees.find(function(e) { return e.empId === empId; });
      if (emp) showEmployeeHistory(empId, emp.name);
    });
  });
}

function showEmployeeHistory(empId, empName) {
  const beYear = document.getElementById('hrDashYear').value;
  currentEmpHistoryEmpId = empId;
  currentEmpHistoryEmpName = empName;

  showLoading();
  callAppsScript('getEmployeeKaizenHistory', { empId: empId, beYear: beYear || null })
    .then(function(res) {
      hideLoading();
      if (!res.success) { showError(res.message); return; }

      document.getElementById('empHistoryName').textContent = empName || empId;
      document.getElementById('empHistPending').textContent = res.summary.pending || 0;
      document.getElementById('empHistApproved').textContent = res.summary.approved || 0;
      document.getElementById('empHistRejected').textContent = res.summary.rejected || 0;

      const list = document.getElementById('empHistoryList');
      const records = res.records || [];

      if (records.length === 0) {
        document.getElementById('empHistoryEmptyState').classList.remove('hidden');
        list.innerHTML = '';
      } else {
        document.getElementById('empHistoryEmptyState').classList.add('hidden');
        let html = '';
        records.forEach(function(r) {
          html +=
            '<div class="rounded-lg p-3" style="background:var(--surface-tint); border:1px solid var(--line-soft);">' +
            '<div class="flex items-center justify-between flex-wrap gap-2">' +
            '<div><span class="font-semibold" style="color:var(--ink);">' + escapeHtml(r.id) + '</span> ' +
            '<span class="text-xs" style="color:var(--ink-faint);">' + escapeHtml(r.dateDisplay) + '</span></div>' +
            statusPill(r.status) +
            '</div>' +
            '<p class="text-sm mt-1 font-semibold" style="color:var(--ink);">' + escapeHtml(r.title) + '</p>' +
            '<div class="flex items-center gap-2 mt-1 flex-wrap">' +
            '<span class="text-xs" style="color:var(--ink-faint);">ประเภท: ' + escapeHtml(getTypeLabel(r.kaizenType)) + '</span> ' +
            catBadges(r.categories) +
            '</div>' +
            '<button class="btnViewEmpHistoryDetail btn-secondary text-xs py-1 px-2 mt-2" data-id="' + escapeHtml(r.id) + '" aria-label="ดูรายละเอียด">ดูรายละเอียด</button>' +
            '</div>';
        });
        list.innerHTML = html;

        list.querySelectorAll('.btnViewEmpHistoryDetail').forEach(function(btn) {
          btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const id = this.dataset.id;
            const rec = records.find(function(r) { return r.id === id; });
            if (rec) showDetail(rec, false);
          });
        });
      }

      document.getElementById('empHistoryModal').classList.remove('hidden');
    })
    .catch(function(err) { hideLoading(); showError(err); });
}

function populateProgressYearOptions(years, selected) {
  const sel = document.getElementById('progressYear');
  sel.innerHTML = '';
  (years || []).forEach(function(y) {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = 'พ.ศ. ' + y;
    sel.appendChild(opt);
  });
  sel.value = selected;
}

function populateProgressMonthOptions(currentMonth) {
  const sel = document.getElementById('progressMonth');
  if (sel.options.length === 0) {
    monthNamesTH.forEach(function(m, i) {
      const opt = document.createElement('option');
      opt.value = (i + 1);
      opt.textContent = m;
      sel.appendChild(opt);
    });
  }
  progressSelectedMonth = progressSelectedMonth || currentMonth;
  sel.value = progressSelectedMonth;
}

function populateProgressFilterOptions(plants, departments) {
  const plantSel = document.getElementById('progressPlantFilter');
  const deptSel = document.getElementById('progressDeptFilter');
  const prevPlant = progressPlantFilter || plantSel.value || '';
  const prevDept = progressDeptFilter || deptSel.value || '';

  plantSel.innerHTML = '<option value="">ทุก Plant</option>';
  (plants || []).forEach(function(p) {
    const opt = document.createElement('option');
    opt.value = p;
    opt.textContent = p;
    plantSel.appendChild(opt);
  });

  deptSel.innerHTML = '<option value="">ทุกแผนก</option>';
  (departments || []).forEach(function(d) {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = d;
    deptSel.appendChild(opt);
  });

  if (prevPlant && plants && plants.indexOf(prevPlant) > -1) plantSel.value = prevPlant;
  if (prevDept && departments && departments.indexOf(prevDept) > -1) deptSel.value = prevDept;

  progressPlantFilter = plantSel.value;
  progressDeptFilter = deptSel.value;
}

function loadMonthlyProgress(beYear) {
  if (isLoading) return;
  showLoading();

  document.getElementById('progressTableBody').innerHTML =
    '<tr><td colspan="10" class="text-center py-8" style="color:var(--ink-faint);">⏳ กำลังโหลดข้อมูล...</td></tr>';

  callAppsScript('getMonthlyProgressForManager', { reviewerId: CURRENT_USER.id, beYear: beYear || null })
    .then(function(res) {
      hideLoading();
      if (!res.success) { showError(res.message); return; }

      PROGRESS_EMPLOYEES = res.employees || [];
      progressBeYear = res.beYear;
      progressCurrentMonth = res.currentMonth;
      if (!progressSelectedMonth) progressSelectedMonth = res.currentMonth;

      populateProgressYearOptions(res.availableYears, res.beYear);
      populateProgressMonthOptions(res.currentMonth);
      populateProgressFilterOptions(res.availablePlants, res.availableDepartments);
      renderProgressSummary(res.summary);
      renderProgressTable();
    })
    .catch(function(err) { hideLoading(); showError(err); });
}

function renderProgressSummary(summary) {
  document.getElementById('progTotalEmp').textContent = summary.totalEmployees || 0;
  document.getElementById('progAchieved').textContent = summary.achievedCount || 0;
  document.getElementById('progNotAchieved').textContent = summary.notAchievedCount || 0;
  document.getElementById('progPercent').textContent = (summary.achievedPercent || 0) + '%';
}

function getFilteredProgressList_() {
  const search = document.getElementById('progressSearch').value.trim().toLowerCase();
  progressPlantFilter = document.getElementById('progressPlantFilter').value || '';
  progressDeptFilter = document.getElementById('progressDeptFilter').value || '';

  return PROGRESS_EMPLOYEES.filter(function(e) {
    const matchSearch = !search ||
      (e.name || '').toLowerCase().indexOf(search) > -1 ||
      (e.department || '').toLowerCase().indexOf(search) > -1 ||
      (e.plant || '').toLowerCase().indexOf(search) > -1 ||
      (e.empId || '').toLowerCase().indexOf(search) > -1;
    const matchPlant = !progressPlantFilter || e.plant === progressPlantFilter;
    const matchDept = !progressDeptFilter || e.department === progressDeptFilter;
    return matchSearch && matchPlant && matchDept;
  });
}

function renderProgressTable() {
  const month = Number(document.getElementById('progressMonth').value) || progressSelectedMonth;
  const filtered = getFilteredProgressList_();

  const tbody = document.getElementById('progressTableBody');
  tbody.innerHTML = '';
  document.getElementById('progEmpCount').textContent = filtered.length;
  document.getElementById('progressEmptyState').classList.toggle('hidden', filtered.length > 0);

  filtered.forEach(function(e) {
    const pct = e.percent || 0;
    const barColor = e.achieved ? 'linear-gradient(90deg,#1B6E4C,#2A8C61)' : (pct >= 50 ? 'linear-gradient(90deg,#B07A17,#C3780C)' : 'linear-gradient(90deg,#B0392C,#D8433B)');
    const monthCount = (e.monthly && e.monthly[month] !== undefined) ? e.monthly[month] : 0;

    const tr = document.createElement('tr');
    tr.dataset.empid = e.empId;
    tr.innerHTML =
      '<td class="font-semibold" style="color:var(--ink);">' + escapeHtml(e.empId) + '</td>' +
      '<td>' + escapeHtml(e.name) + '</td>' +
      '<td class="text-xs" style="color:var(--ink-faint);">' + escapeHtml(e.plant || '-') + '</td>' +
      '<td>' + escapeHtml(e.department) + '</td>' +
      '<td class="text-center font-semibold num">' + e.target + '</td>' +
      '<td class="text-center font-bold num" style="color:' + (e.achieved ? 'var(--brand-600)' : 'var(--ink)') + ';">' + e.total + '</td>' +
      '<td class="text-center font-semibold num" style="color:' + (e.remaining > 0 ? 'var(--warn-600)' : 'var(--good-600)') + ';">' + e.remaining + '</td>' +
      '<td><div class="flex items-center gap-2"><div class="progress-track flex-1"><div class="progress-fill" style="width:' + pct + '%;background:' + barColor + '"></div></div><span class="text-xs font-semibold num min-w-[2.5rem]">' + pct + '%</span></div></td>' +
      '<td class="text-center"><input type="number" min="0" step="1" class="count-input progress-count-input" data-empid="' + escapeHtml(e.empId) + '" value="' + monthCount + '" aria-label="จำนวน Kaizen เดือนนี้"></td>' +
      '<td class="text-center"><button class="count-save-btn btnSaveProgress" data-empid="' + escapeHtml(e.empId) + '" aria-label="บันทึกจำนวน">บันทึก</button></td>';
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.progress-count-input').forEach(function(input) {
    input.addEventListener('input', function() {
      const tr = this.closest('tr');
      if (tr) tr.classList.add('count-row-dirty');
    });
    input.addEventListener('keydown', function(ev) {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        const tr = this.closest('tr');
        const btn = tr ? tr.querySelector('.btnSaveProgress') : null;
        if (btn) btn.click();
      }
    });
  });

  tbody.querySelectorAll('.btnSaveProgress').forEach(function(btn) {
    btn.addEventListener('click', function() { saveProgressCountForRow(this); });
  });
}

function saveProgressCountForRow(btn) {
  const empId = btn.dataset.empid;
  const tr = btn.closest('tr');
  const input = tr ? tr.querySelector('.progress-count-input') : null;
  if (!input) return;

  const count = Number(input.value);
  if (isNaN(count) || count < 0) {
    Swal.fire({ icon: 'warning', title: 'กรุณากรอกจำนวนที่ถูกต้อง', confirmButtonColor: '#1B6E4C' });
    input.focus();
    return;
  }

  const month = Number(document.getElementById('progressMonth').value) || progressSelectedMonth;
  const beYear = Number(document.getElementById('progressYear').value) || progressBeYear;

  btn.disabled = true;
  const originalText = btn.textContent;
  btn.textContent = '...';

  callAppsScript('saveMonthlyProgressCount', {
      reviewerId: CURRENT_USER.id,
      empId: empId,
      beYear: beYear,
      month: month,
      count: count
    })
    .then(function(res) {
      btn.disabled = false;
      btn.textContent = originalText;
      if (res.success) {
        if (tr) tr.classList.remove('count-row-dirty');
        const emp = PROGRESS_EMPLOYEES.find(function(e) { return e.empId === empId; });
        if (emp) {
          const prevMonthCount = (emp.monthly && emp.monthly[month] !== undefined) ? emp.monthly[month] : 0;
          emp.monthly = emp.monthly || {};
          emp.monthly[month] = count;
          emp.total = emp.total - prevMonthCount + count;
          emp.achieved = emp.total >= emp.target;
          emp.percent = emp.target > 0 ? Math.min(100, Math.round((emp.total / emp.target) * 100)) : 100;
          emp.remaining = Math.max(0, emp.target - emp.total);
        }
        const achievedCount = PROGRESS_EMPLOYEES.filter(function(e) { return e.achieved; }).length;
        const totalEmployees = PROGRESS_EMPLOYEES.length;
        renderProgressSummary({
          totalEmployees: totalEmployees,
          achievedCount: achievedCount,
          notAchievedCount: totalEmployees - achievedCount,
          achievedPercent: totalEmployees > 0 ? Math.round((achievedCount / totalEmployees) * 100) : 0
        });
        renderProgressTable();
        showSuccess('บันทึกจำนวนสำเร็จ');
      } else showError(res.message);
    })
    .catch(function(err) {
      btn.disabled = false;
      btn.textContent = originalText;
      showError(err);
    });
}

function loadEmployeeManage() {
  if (isLoading) return;
  showLoading();
  callAppsScript('getAllEmployeesRaw', { reviewerId: CURRENT_USER.id })
    .then(function(res) {
      hideLoading();
      if (!res.success) { showError(res.message); return; }
      EMP_MANAGE_LIST = res.employees || [];
      renderEmployeeManageTable();
    })
    .catch(function(err) { hideLoading(); showError(err); });
}

function getFilteredEmployeeManageList_() {
  const searchInput = document.getElementById('empMgrSearch');
  const search = searchInput ? searchInput.value.trim().toLowerCase() : '';

  return EMP_MANAGE_LIST.filter(function(e) {
    return !search ||
      (e.empId || '').toLowerCase().indexOf(search) > -1 ||
      (e.firstName || '').toLowerCase().indexOf(search) > -1 ||
      (e.lastName || '').toLowerCase().indexOf(search) > -1 ||
      (e.department || '').toLowerCase().indexOf(search) > -1;
  });
}

function renderEmployeeManageTable() {
  const filtered = getFilteredEmployeeManageList_();

  const tbody = document.getElementById('empMgrTableBody');
  tbody.innerHTML = '';
  document.getElementById('empMgrCount').textContent = filtered.length;
  document.getElementById('empMgrEmptyState').classList.toggle('hidden', filtered.length > 0);

  const isDirector = (CURRENT_USER.approverType || []).indexOf('ผู้จัดการ') > -1;

  filtered.forEach(function(e) {
    const tr = document.createElement('tr');
    tr.dataset.rowIndex = e.rowIndex;
    tr.innerHTML =
      '<td><input type="text" class="input-field text-xs emp-field" data-field="empId" value="' + escapeHtml(e.empId) + '" style="min-width:90px;background:var(--surface-sunken);color:var(--ink-faint);cursor:not-allowed;" readonly aria-label="รหัสพนักงาน (แก้ไขไม่ได้)" title="ไม่สามารถแก้ไขรหัสพนักงานได้ที่นี่"></td>' +
      '<td><input type="text" class="input-field text-xs emp-field" data-field="prefix" value="' + escapeHtml(e.prefix) + '" style="min-width:70px;" aria-label="คำนำหน้า"></td>' +
      '<td><input type="text" class="input-field text-xs emp-field" data-field="firstName" value="' + escapeHtml(e.firstName) + '" style="min-width:100px;" aria-label="ชื่อ"></td>' +
      '<td><input type="text" class="input-field text-xs emp-field" data-field="lastName" value="' + escapeHtml(e.lastName) + '" style="min-width:100px;" aria-label="นามสกุล"></td>' +
      '<td><input type="text" class="input-field text-xs emp-field" data-field="department" value="' + escapeHtml(e.department) + '" style="min-width:130px;" aria-label="แผนก"></td>' +
      '<td><input type="text" class="input-field text-xs emp-field" data-field="position" value="' + escapeHtml(e.position) + '" style="min-width:110px;" aria-label="ตำแหน่ง"></td>' +
      '<td><input type="text" class="input-field text-xs emp-field" data-field="plant" value="' + escapeHtml(e.plant) + '" style="min-width:110px;" aria-label="Plant"></td>' +
      '<td><input type="text" class="input-field text-xs emp-field" data-field="email" value="' + escapeHtml(e.email) + '" style="min-width:160px;" aria-label="อีเมล"></td>' +
      '<td class="text-center"><input type="number" min="0" step="1" class="count-input emp-field" data-field="tasks" value="' + escapeHtml(String(e.tasks === '' ? '' : e.tasks)) + '" aria-label="เป้าหมาย"></td>' +
      '<td class="text-center"><input type="number" min="0" step="1" class="count-input emp-field" data-field="done" value="' + escapeHtml(String(e.done === '' ? '' : e.done)) + '" aria-label="ทำแล้ว"></td>' +
      '<td class="text-center"><div class="flex gap-1 justify-center flex-wrap">' +
        '<button type="button" class="count-save-btn btnSaveEmp" aria-label="บันทึก">💾 บันทึก</button>' +
        (isDirector ? '<button type="button" class="count-save-btn btnDeleteEmp2" style="background:var(--bad-600);" aria-label="ลบพนักงาน">🗑️ ลบ</button>' : '') +
      '</div></td>';
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.emp-field').forEach(function(input) {
    input.addEventListener('input', function() {
      const tr = this.closest('tr');
      if (tr) tr.classList.add('count-row-dirty');
    });
  });

  tbody.querySelectorAll('.btnSaveEmp').forEach(function(btn) {
    btn.addEventListener('click', function() { saveEmployeeRow(this); });
  });

  tbody.querySelectorAll('.btnDeleteEmp2').forEach(function(btn) {
    btn.addEventListener('click', function() { confirmDeleteEmployeeRow(this); });
  });
}

function exportEmployeeManageToExcel() {
  if (typeof XLSX === 'undefined') {
    Swal.fire({ icon: 'error', title: 'ไม่สามารถโหลดไลบรารี Excel ได้', text: 'กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่อีกครั้ง', confirmButtonColor: '#1B6E4C' });
    return;
  }

  if (!EMP_MANAGE_LIST || EMP_MANAGE_LIST.length === 0) {
    Swal.fire({ icon: 'warning', title: 'ยังไม่มีข้อมูลพนักงาน', text: 'กรุณากดโหลดข้อมูลก่อน export', confirmButtonColor: '#1B6E4C' });
    return;
  }

  const rows = getFilteredEmployeeManageList_();
  if (rows.length === 0) {
    Swal.fire({ icon: 'warning', title: 'ไม่พบข้อมูลที่จะ export', text: 'ลองล้างคำค้นหาแล้วลองใหม่อีกครั้ง', confirmButtonColor: '#1B6E4C' });
    return;
  }

  const headers = ['รหัสพนักงาน', 'คำนำหน้า', 'ชื่อ', 'นามสกุล', 'ชื่อ-สกุล', 'แผนก', 'ตำแหน่ง', 'Plant', 'อีเมล', 'เป้าหมาย (Tasks)', 'ทำแล้ว (Done)'];
  const aoa = [headers];

  rows.forEach(function(e) {
    const fullName = [e.prefix, e.firstName, e.lastName].filter(Boolean).join(' ');
    aoa.push([
      e.empId || '',
      e.prefix || '',
      e.firstName || '',
      e.lastName || '',
      fullName,
      e.department || '',
      e.position || '',
      e.plant || '',
      e.email || '',
      (e.tasks === '' || e.tasks === null || e.tasks === undefined) ? '' : Number(e.tasks),
      (e.done === '' || e.done === null || e.done === undefined) ? '' : Number(e.done)
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [
    { wch: 12 }, { wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 28 },
    { wch: 22 }, { wch: 18 }, { wch: 18 }, { wch: 26 }, { wch: 12 }, { wch: 12 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'HR_Employees');

  const now = new Date();
  const pad = function(n) { return String(n).padStart(2, '0'); };
  const stamp = now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) + '_' + pad(now.getHours()) + pad(now.getMinutes());
  const fileName = 'HR_Employees_' + stamp + '.xlsx';

  XLSX.writeFile(wb, fileName);
}

function exportProgressToExcel() {
  if (typeof XLSX === 'undefined') {
    Swal.fire({ icon: 'error', title: 'ไม่สามารถโหลดไลบรารี Excel ได้', text: 'กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่อีกครั้ง', confirmButtonColor: '#1B6E4C' });
    return;
  }

  if (!PROGRESS_EMPLOYEES || PROGRESS_EMPLOYEES.length === 0) {
    Swal.fire({ icon: 'warning', title: 'ยังไม่มีข้อมูล', text: 'กรุณากดโหลดข้อมูลก่อน export', confirmButtonColor: '#1B6E4C' });
    return;
  }

  const rows = getFilteredProgressList_();
  if (rows.length === 0) {
    Swal.fire({ icon: 'warning', title: 'ไม่พบข้อมูลที่จะ export', text: 'ลองล้างคำค้นหา/ตัวกรองแล้วลองใหม่อีกครั้ง', confirmButtonColor: '#1B6E4C' });
    return;
  }

  const month = Number(document.getElementById('progressMonth').value) || progressSelectedMonth;
  const monthLabel = monthNamesTH[(month || 1) - 1] || ('เดือน ' + month);
  const beYear = Number(document.getElementById('progressYear').value) || progressBeYear;

  const headers = ['รหัสพนักงาน', 'ชื่อ-สกุล', 'Plant', 'แผนก', 'เป้าหมาย/ปี', 'ส่งแล้ว(สะสม)', 'คงเหลือ', '% ความคืบหน้า', 'สถานะ', 'จำนวนเดือน ' + monthLabel];
  const aoa = [headers];

  rows.forEach(function(e) {
    const monthCount = (e.monthly && e.monthly[month] !== undefined) ? e.monthly[month] : 0;
    aoa.push([
      e.empId || '',
      e.name || '',
      e.plant || '',
      e.department || '',
      Number(e.target) || 0,
      Number(e.total) || 0,
      Number(e.remaining) || 0,
      Number(e.percent) || 0,
      e.achieved ? 'ถึงเป้าหมาย' : 'ยังไม่ถึง',
      Number(monthCount) || 0
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [
    { wch: 12 }, { wch: 26 }, { wch: 18 }, { wch: 22 },
    { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 16 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'ความคืบหน้า Kaizen');

  const now = new Date();
  const pad = function(n) { return String(n).padStart(2, '0'); };
  const stamp = now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) + '_' + pad(now.getHours()) + pad(now.getMinutes());
  const fileName = 'Kaizen_ความคืบหน้า_' + (beYear || '') + '_' + monthLabel + '_' + stamp + '.xlsx';

  XLSX.writeFile(wb, fileName);
}

function collectEmployeeRowData(tr) {
  const data = { rowIndex: tr.dataset.rowIndex };
  tr.querySelectorAll('.emp-field').forEach(function(input) {
    data[input.dataset.field] = input.value.trim();
  });
  return data;
}

function saveEmployeeRow(btn) {
  const tr = btn.closest('tr');
  if (!tr) return;
  const data = collectEmployeeRowData(tr);

  if (!data.empId) {
    Swal.fire({ icon: 'warning', title: 'กรุณากรอกรหัสพนักงาน', confirmButtonColor: '#1B6E4C' });
    return;
  }

  btn.disabled = true;
  const originalText = btn.textContent;
  btn.textContent = '...';

  callAppsScript('updateEmployeeRecord', {
      reviewerId: CURRENT_USER.id,
      rowIndex: data.rowIndex,
      empId: data.empId,
      prefix: data.prefix,
      firstName: data.firstName,
      lastName: data.lastName,
      department: data.department,
      position: data.position,
      plant: data.plant,
      email: data.email,
      tasks: data.tasks,
      done: data.done
    })
    .then(function(res) {
      btn.disabled = false;
      btn.textContent = originalText;
      if (res.success) {
        tr.classList.remove('count-row-dirty');
        showSuccess(res.message);
        loadEmployeeManage();
      } else {
        showError(res.message);
      }
    })
    .catch(function(err) {
      btn.disabled = false;
      btn.textContent = originalText;
      showError(err);
    });
}

function confirmDeleteEmployeeRow(btn) {
  const tr = btn.closest('tr');
  if (!tr) return;
  const empIdInput = tr.querySelector('.emp-field[data-field="empId"]');
  const empId = empIdInput ? empIdInput.value : '';

  Swal.fire({
    title: 'ยืนยันการลบพนักงาน',
    html: 'คุณต้องการลบข้อมูลพนักงาน <b>' + escapeHtml(empId) + '</b> ใช่หรือไม่?<br>' +
      '<span style="color:var(--bad-600);font-size:.8rem;">⚠️ การลบจะไม่สามารถกู้คืนได้ พนักงานคนนี้จะไม่สามารถเข้าสู่ระบบได้อีก</span>',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ลบ',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#B0392C',
    cancelButtonColor: '#8695B4'
  }).then(function(result) {
    if (result.isConfirmed) {
      showLoading();
      callAppsScript('deleteEmployeeRecord', { reviewerId: CURRENT_USER.id, rowIndex: tr.dataset.rowIndex })
        .then(function(res) {
          hideLoading();
          if (res.success) {
            showSuccess(res.message);
            loadEmployeeManage();
          } else showError(res.message);
        })
        .catch(function(err) { hideLoading(); showError(err); });
    }
  });
}

function openAddEmployeeModal() {
  const html =
    '<div class="grid grid-cols-2 gap-3 text-left" style="padding-top:4px;">' +
    '<div><label class="text-xs font-semibold block mb-1" style="color:var(--ink-soft);">รหัสพนักงาน *</label><input id="newEmpId" class="input-field text-sm"></div>' +
    '<div><label class="text-xs font-semibold block mb-1" style="color:var(--ink-soft);">คำนำหน้า</label><input id="newEmpPrefix" class="input-field text-sm"></div>' +
    '<div><label class="text-xs font-semibold block mb-1" style="color:var(--ink-soft);">ชื่อ</label><input id="newEmpFirstName" class="input-field text-sm"></div>' +
    '<div><label class="text-xs font-semibold block mb-1" style="color:var(--ink-soft);">นามสกุล</label><input id="newEmpLastName" class="input-field text-sm"></div>' +
    '<div><label class="text-xs font-semibold block mb-1" style="color:var(--ink-soft);">แผนก</label><input id="newEmpDept" class="input-field text-sm"></div>' +
    '<div><label class="text-xs font-semibold block mb-1" style="color:var(--ink-soft);">ตำแหน่ง</label><input id="newEmpPosition" class="input-field text-sm"></div>' +
    '<div><label class="text-xs font-semibold block mb-1" style="color:var(--ink-soft);">Plant</label><input id="newEmpPlant" class="input-field text-sm"></div>' +
    '<div><label class="text-xs font-semibold block mb-1" style="color:var(--ink-soft);">อีเมล</label><input id="newEmpEmail" class="input-field text-sm"></div>' +
    '<div><label class="text-xs font-semibold block mb-1" style="color:var(--ink-soft);">เป้าหมาย (Tasks)</label><input id="newEmpTasks" type="number" min="0" class="input-field text-sm"></div>' +
    '<div><label class="text-xs font-semibold block mb-1" style="color:var(--ink-soft);">ทำแล้ว (Done)</label><input id="newEmpDone" type="number" min="0" class="input-field text-sm"></div>' +
    '</div>';

  Swal.fire({
    title: '➕ เพิ่มพนักงานใหม่',
    html: html,
    showCancelButton: true,
    confirmButtonText: 'เพิ่ม',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#1B6E4C',
    cancelButtonColor: '#8695B4',
    width: '640px',
    padding: '1.5rem',
    preConfirm: function() {
      const empId = document.getElementById('newEmpId').value.trim();
      if (!empId) {
        Swal.showValidationMessage('กรุณากรอกรหัสพนักงาน');
        return false;
      }
      return {
        empId: empId,
        prefix: document.getElementById('newEmpPrefix').value.trim(),
        firstName: document.getElementById('newEmpFirstName').value.trim(),
        lastName: document.getElementById('newEmpLastName').value.trim(),
        department: document.getElementById('newEmpDept').value.trim(),
        position: document.getElementById('newEmpPosition').value.trim(),
        plant: document.getElementById('newEmpPlant').value.trim(),
        email: document.getElementById('newEmpEmail').value.trim(),
        tasks: document.getElementById('newEmpTasks').value.trim(),
        done: document.getElementById('newEmpDone').value.trim()
      };
    }
  }).then(function(result) {
    if (result.isConfirmed && result.value) {
      showLoading();
      callAppsScript('addEmployeeRecord', Object.assign({ reviewerId: CURRENT_USER.id }, result.value))
        .then(function(res) {
          hideLoading();
          if (res.success) {
            showSuccess(res.message);
            loadEmployeeManage();
          } else showError(res.message);
        })
        .catch(function(err) { hideLoading(); showError(err); });
    }
  });
}

function openForm(recordToEdit) {
  currentTransactionId = null;
  isSubmitting = false;

  document.getElementById('formModal').classList.remove('hidden');
  document.getElementById('kaizenForm').reset();
  document.getElementById('beforeImageInput').value = '';
  document.getElementById('afterImageInput').value = '';
  document.getElementById('beforeImageContainer').classList.add('hidden');
  document.getElementById('afterImageContainer').classList.add('hidden');
  document.getElementById('editRowIndex').value = '';
  document.getElementById('editKaizenId').value = '';
  document.getElementById('multiFileInput').value = '';
  selectedFiles = [];
  existingFileUrlsForEdit = [];
  renderSelectedFilesList();
  renderExistingFilesList();
  clearCategories();
  clearKaizenType();

  function updateFormUserInfo(user) {
    document.getElementById('empName').value = user.name || '';
    document.getElementById('empDept').value = user.department || '';
    document.getElementById('kaizenForm').dataset.empId = user.id || '';
    document.getElementById('kaizenForm').dataset.empPosition = user.position || '';
    document.getElementById('kaizenForm').dataset.empPlant = user.plant || '';
  }

  updateFormUserInfo(CURRENT_USER);

  const rejectBanner = document.getElementById('rejectBanner');
  const btnSubmit = document.getElementById('btnSubmit');
  btnSubmit.disabled = false;
  btnSubmit.innerHTML =
    '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg> บันทึก';

  const now = new Date();
  const beYear = now.getFullYear() + 543;
  const month = now.getMonth() + 1;
  const day = now.getDate();

  const dDay = document.getElementById('dDay');
  const dMonth = document.getElementById('dMonth');
  const dYear = document.getElementById('dYear');

  if (dDay.options.length === 0) {
    const maxDay = daysInMonth(beYear, month);
    for (let i = 1; i <= maxDay; i++) {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = i;
      dDay.appendChild(opt);
    }
  }

  if (dMonth.options.length === 0) {
    monthNamesTH.forEach(function(m, idx) {
      const opt = document.createElement('option');
      opt.value = idx + 1;
      opt.textContent = m;
      dMonth.appendChild(opt);
    });
  }

  if (dYear.options.length === 0) {
    for (let y = beYear - 3; y <= beYear + 1; y++) {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = y;
      dYear.appendChild(opt);
    }
  }

  dMonth.value = month;
  dYear.value = beYear;
  updateDayOptions();
  dDay.value = Math.min(day, daysInMonth(beYear, month));
  updateFormHeaderDate();

  if (recordToEdit) {
    document.getElementById('formModalTitle').textContent = 'แก้ไขและส่งใหม่ (' + recordToEdit.id + ')';
    document.getElementById('editRowIndex').value = recordToEdit.rowIndex;
    document.getElementById('editKaizenId').value = recordToEdit.id;
    document.getElementById('title').value = recordToEdit.title || '';
    document.getElementById('detail').value = recordToEdit.detail || '';
    document.getElementById('beforeProblem').value = recordToEdit.beforeProblem || '';
    document.getElementById('afterSolution').value = recordToEdit.afterSolution || '';
    setCategories(recordToEdit.categories);
    if (recordToEdit.kaizenType) setKaizenType(recordToEdit.kaizenType);
    existingFileUrlsForEdit = (recordToEdit.fileUrls || []).slice();
    renderExistingFilesList();

    if (recordToEdit.beforeImageUrl) {
      const beforeContainer = document.getElementById('beforeImageContainer');
      const beforeImg = document.getElementById('beforeImagePreview');
      beforeContainer.classList.remove('hidden');
      beforeImg.classList.remove('img-loading');
      beforeImg.src = driveImageSrc(recordToEdit.beforeImageUrl);
      beforeContainer.onclick = function() { openImageViewer(recordToEdit.beforeImageUrl, 'Before (เดิม)'); };
      beforeContainer.title = 'คลิกเพื่อดูรูปภาพเดิม';
    }

    if (recordToEdit.afterImageUrl) {
      const afterContainer = document.getElementById('afterImageContainer');
      const afterImg = document.getElementById('afterImagePreview');
      afterContainer.classList.remove('hidden');
      afterImg.classList.remove('img-loading');
      afterImg.src = driveImageSrc(recordToEdit.afterImageUrl);
      afterContainer.onclick = function() { openImageViewer(recordToEdit.afterImageUrl, 'After (เดิม)'); };
      afterContainer.title = 'คลิกเพื่อดูรูปภาพเดิม';
    }

    if (recordToEdit.date) {
      const dateParts = recordToEdit.date.split('-');
      if (dateParts.length === 3) {
        const yBe = parseInt(dateParts[0], 10) + 543;
        let hasYear = false;
        for (let i = 0; i < dYear.options.length; i++) {
          if (parseInt(dYear.options[i].value, 10) === yBe) {
            hasYear = true;
            break;
          }
        }
        if (!hasYear) {
          const opt = document.createElement('option');
          opt.value = yBe;
          opt.textContent = yBe;
          dYear.appendChild(opt);
        }
        dYear.value = yBe;
        dMonth.value = parseInt(dateParts[1], 10);
        updateDayOptions();
        dDay.value = Math.min(parseInt(dateParts[2], 10), daysInMonth(yBe, parseInt(dateParts[1], 10)));
        updateFormHeaderDate();
      }
    }

    if (recordToEdit.rejectReason) {
      rejectBanner.textContent = 'เหตุผลที่ถูกตีกลับ: ' + recordToEdit.rejectReason;
      rejectBanner.classList.remove('hidden');
    } else {
      rejectBanner.classList.add('hidden');
    }
  } else {
    document.getElementById('formModalTitle').textContent = 'ส่ง Kaizen ใหม่';
    document.getElementById('detail').value = '';
    rejectBanner.classList.add('hidden');
  }

  updateFormHeaderDate();
  document.getElementById('title').focus();
}

function closeForm() {
  if (isSubmitting) return;

  document.getElementById('formModal').classList.add('hidden');
  document.getElementById('kaizenForm').reset();
  document.getElementById('beforeImageInput').value = '';
  document.getElementById('afterImageInput').value = '';
  document.getElementById('beforeImageContainer').classList.add('hidden');
  document.getElementById('afterImageContainer').classList.add('hidden');
  document.getElementById('editRowIndex').value = '';
  document.getElementById('editKaizenId').value = '';
  document.getElementById('multiFileInput').value = '';
  selectedFiles = [];
  existingFileUrlsForEdit = [];
  renderSelectedFilesList();
  renderExistingFilesList();
  clearCategories();
  clearKaizenType();
  currentTransactionId = null;
  isSubmitting = false;
}

function onSubmit(e) {
  e.preventDefault();
  if (isSubmitting) return;

  const btnSubmit = document.getElementById('btnSubmit');
  if (btnSubmit.disabled) return;

  const kaizenType = getSelectedKaizenType();
  if (!kaizenType) {
    Swal.fire({ icon: 'warning', title: 'กรุณาเลือกประเภท Kaizen', confirmButtonColor: '#1B6E4C' });
    return;
  }

  const categories = getSelectedCategories();
  if (Object.keys(categories).length === 0) {
    Swal.fire({ icon: 'warning', title: 'กรุณาเลือกหมวดหมู่', text: 'ต้องเลือกอย่างน้อย 1 หมวดหมู่', confirmButtonColor: '#1B6E4C' });
    return;
  }

  const title = document.getElementById('title').value.trim();
  if (!title) {
    Swal.fire({ icon: 'warning', title: 'กรุณากรอกหัวข้อ Kaizen', confirmButtonColor: '#1B6E4C' });
    document.getElementById('title').focus();
    return;
  }

  const detail = document.getElementById('detail').value.trim();
  if (!detail) {
    Swal.fire({ icon: 'warning', title: 'กรุณากรอก "ทำแล้วดีขึ้นอย่างไร"', text: 'อธิบายผลลัพธ์ของการปรับปรุง', confirmButtonColor: '#1B6E4C' });
    document.getElementById('detail').focus();
    return;
  }

  currentTransactionId = 'txn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
  isSubmitting = true;

  const rowIndex = document.getElementById('editRowIndex').value;
  const kaizenId = document.getElementById('editKaizenId').value;
  
  const payload = {
    empId: CURRENT_USER.id || document.getElementById('kaizenForm').dataset.empId,
    name: CURRENT_USER.name || document.getElementById('empName').value,
    department: CURRENT_USER.department || document.getElementById('empDept').value,
    position: CURRENT_USER.position || document.getElementById('kaizenForm').dataset.empPosition,
    plant: CURRENT_USER.plant || document.getElementById('kaizenForm').dataset.empPlant,
    date: getCurrentDateString(),
    title: title,
    detail: detail,
    beforeProblem: document.getElementById('beforeProblem').value.trim(),
    afterSolution: document.getElementById('afterSolution').value.trim(),
    categories: categories,
    kaizenType: kaizenType,
    transactionId: currentTransactionId
  };

  if (rowIndex) {
    payload.rowIndex = parseInt(rowIndex, 10);
    payload.id = kaizenId;
    payload.kaizenId = kaizenId;
    payload.existingFileUrls = existingFileUrlsForEdit;
  }

  btnSubmit.disabled = true;
  const btnSubmitOriginalHtml =
    '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg> บันทึก';
  btnSubmit.innerHTML = '⏳ กำลังบันทึก...';

  const steps = PROCESS_STEPS_SUBMIT;
  openProcessingModal(steps, rowIndex ? 'กำลังแก้ไขและส่ง Kaizen ใหม่ (' + kaizenId + ')' : 'กำลังบันทึก Kaizen ใหม่');
  setProcessingStep(steps, 'validate', 'done');

  const restoreSubmitButton = function() {
    isSubmitting = false;
    currentTransactionId = null;
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = btnSubmitOriginalHtml;
  };

  const finish = function(payloadWithFile) {
    const action = rowIndex ? 'resubmitKaizenRecord' : 'addKaizenRecordWithMultipleFiles';

    setProcessingStep(steps, 'upload', 'active');
    // เซิร์ฟเวอร์ (Code.gs) ทำงานทั้งหมดในคำขอเดียว: บันทึกชีต -> สร้าง PDF -> ส่งอีเมล
    // เนื่องจาก Apps Script เป็น request/response เดียว จึงไม่มีสัญญาณความคืบหน้าจริงระหว่างรอ
    // จำลองการไล่ขั้นตอนให้ตรงกับลำดับการทำงานจริงฝั่งเซิร์ฟเวอร์ จนกว่าจะได้ผลลัพธ์จริง
    const cycleStartTimer = setTimeout(function() {
      setProcessingStep(steps, 'upload', 'done');
      cycleServerSteps(steps, ['save', 'pdf', 'email'], 1100);
    }, 500);

    callAppsScript(action, payloadWithFile)
      .then(function(res) {
        clearTimeout(cycleStartTimer);
        if (processingCycleTimer) { clearInterval(processingCycleTimer); processingCycleTimer = null; }
        restoreSubmitButton();

        if (res.success) {
          ['upload', 'save', 'pdf', 'email'].forEach(function(id) { setProcessingStep(steps, id, 'done'); });
          setProcessingStep(steps, 'done', 'done');
          setTimeout(function() {
            closeProcessingModal();
            showSuccess(res.message);
            closeForm();
            loadMyRecords();
          }, 500);
        } else {
          const activeStep = ['save', 'pdf', 'email', 'upload'].find(function(id) { return processingStepStates[id] === 'active'; }) || 'upload';
          setProcessingStep(steps, activeStep, 'error');
          setTimeout(function() {
            closeProcessingModal();
            showError(res.message);
          }, 400);
        }
      })
      .catch(function(err) {
        clearTimeout(cycleStartTimer);
        if (processingCycleTimer) { clearInterval(processingCycleTimer); processingCycleTimer = null; }
        restoreSubmitButton();
        setProcessingStep(steps, 'upload', 'error');
        setTimeout(function() {
          closeProcessingModal();
          showError(err);
        }, 400);
      });
  };

  const fileTasks = [];

  if (selectedFiles.length > 0) {
    setProcessingStep(steps, 'files', 'active');
    const filesData = selectedFiles.map(function(f) { return { file: f.file, name: f.name, type: f.type }; });
    const progressContainer = document.getElementById('uploadProgressContainer');
    const progressFill = document.getElementById('uploadProgressFill');
    const progressText = document.getElementById('uploadProgressText');
    if (progressContainer) progressContainer.classList.remove('hidden');

    fileTasks.push(processFilesWithProgress(filesData, function(current, total, fileName) {
      const pct = Math.round((current / total) * 100);
      if (progressFill) progressFill.style.width = pct + '%';
      if (progressText) progressText.textContent = 'กำลังประมวลผล: ' + current + '/' + total + ' (' + pct + '%) - ' + fileName;
    }).then(function(results) {
      if (progressContainer) progressContainer.classList.add('hidden');
      if (results.length > 0) payload.files = results;
      setProcessingStep(steps, 'files', 'done');
    }).catch(function(err) {
      if (progressContainer) progressContainer.classList.add('hidden');
      setProcessingStep(steps, 'files', 'error');
      throw err;
    }));
  } else {
    setProcessingStep(steps, 'files', 'done');
  }

  const beforeFile = document.getElementById('beforeImageInput').files[0];
  const afterFile = document.getElementById('afterImageInput').files[0];

  if (beforeFile || afterFile) {
    setProcessingStep(steps, 'images', 'active');
  } else {
    setProcessingStep(steps, 'images', 'done');
  }

  if (beforeFile) {
    fileTasks.push(readFileAsDataUrl(beforeFile).then(function(dataUrl) {
      payload.beforeImageBase64 = dataUrl;
      payload.beforeImageFileName = beforeFile.name;
      payload.beforeImageMimeType = beforeFile.type;
    }));
  }

  if (afterFile) {
    fileTasks.push(readFileAsDataUrl(afterFile).then(function(dataUrl) {
      payload.afterImageBase64 = dataUrl;
      payload.afterImageFileName = afterFile.name;
      payload.afterImageMimeType = afterFile.type;
    }));
  }

  Promise.all(fileTasks).then(function() {
    if (beforeFile || afterFile) setProcessingStep(steps, 'images', 'done');
    finish(payload);
  }).catch(function(err) {
    restoreSubmitButton();
    setProcessingStep(steps, (selectedFiles.length > 0 ? 'files' : 'images'), 'error');
    setTimeout(function() {
      closeProcessingModal();
      showError('ไม่สามารถอ่านไฟล์ได้: ' + err.message);
    }, 300);
  });
}

function bindEvents() {
  document.getElementById('loginForm').addEventListener('submit', handleLogin);
  document.getElementById('roleEmployeeBtn').addEventListener('click', function() { setSelectedRole('employee'); });
  document.getElementById('roleManagerBtn').addEventListener('click', function() { setSelectedRole('manager'); });
  document.getElementById('btnLogout').addEventListener('click', logout);
  document.getElementById('btnAdminTools').addEventListener('click', showAdminToolsMenu);

  document.getElementById('btnOpenForm').addEventListener('click', function() {
    if (!isLoading && !isSubmitting) openForm(null);
  });
  document.getElementById('btnCloseForm').addEventListener('click', closeForm);
  document.getElementById('btnCancel').addEventListener('click', closeForm);
  document.getElementById('kaizenForm').addEventListener('submit', onSubmit);
  document.getElementById('formModal').addEventListener('click', function(ev) {
    if (ev.target === this && !isSubmitting) closeForm();
  });

  document.getElementById('btnCloseDetail').addEventListener('click', function() {
    document.getElementById('detailModal').classList.add('hidden');
  });
  document.getElementById('detailModal').addEventListener('click', function(ev) {
    if (ev.target === this) this.classList.add('hidden');
  });

  document.getElementById('btnCloseComment').addEventListener('click', closeCommentModal);
  document.getElementById('commentModal').addEventListener('click', function(ev) {
    if (ev.target === this) closeCommentModal();
  });
  document.getElementById('btnSubmitComment').addEventListener('click', submitComment);
  document.getElementById('newComment').addEventListener('keydown', function(ev) {
    if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) {
      ev.preventDefault();
      submitComment();
    }
  });

  document.getElementById('btnCloseEmpHistory').addEventListener('click', function() {
    document.getElementById('empHistoryModal').classList.add('hidden');
    currentEmpHistoryEmpId = null;
    currentEmpHistoryEmpName = null;
  });
  document.getElementById('empHistoryModal').addEventListener('click', function(ev) {
    if (ev.target === this) {
      this.classList.add('hidden');
      currentEmpHistoryEmpId = null;
      currentEmpHistoryEmpName = null;
    }
  });

  document.getElementById('btnRefreshEmp').addEventListener('click', loadMyRecords);
  document.getElementById('btnRefreshQueue').addEventListener('click', loadQueue);
  document.getElementById('btnRefreshHrDash').addEventListener('click', function() {
    loadHrDashboard(document.getElementById('hrDashYear').value);
  });

  document.getElementById('mgrSearch').addEventListener('input', debounce(function() { loadQueue(); }, 400));
  document.getElementById('mgrStatusFilter').addEventListener('change', renderMgrTable);
  document.getElementById('mgrScopeFilter').addEventListener('change', function() {
    this.dataset.userSet = '1';
    loadQueue();
  });
  document.getElementById('btnAdvancedSearch').addEventListener('click', showAdvancedSearch);

  document.getElementById('progressSearch').addEventListener('input', debounce(renderProgressTable, 300));
  document.getElementById('btnExportProgressExcel').addEventListener('click', exportProgressToExcel);
  document.getElementById('btnRefreshProgress').addEventListener('click', function() {
    loadMonthlyProgress(document.getElementById('progressYear').value);
  });
  document.getElementById('progressYear').addEventListener('change', function() {
    loadMonthlyProgress(this.value);
  });
  document.getElementById('progressMonth').addEventListener('change', function() {
    progressSelectedMonth = Number(this.value);
    renderProgressTable();
  });
  document.getElementById('progressPlantFilter').addEventListener('change', function() {
    progressPlantFilter = this.value;
    renderProgressTable();
  });
  document.getElementById('progressDeptFilter').addEventListener('change', function() {
    progressDeptFilter = this.value;
    renderProgressTable();
  });

  document.getElementById('hrDashYear').addEventListener('change', function() {
    loadHrDashboard(this.value);
  });
  document.getElementById('hrDashSearch').addEventListener('input', debounce(renderHrDashTable, 300));
  document.getElementById('hrDashStatus').addEventListener('change', renderHrDashTable);

  document.getElementById('empMgrSearch').addEventListener('input', debounce(renderEmployeeManageTable, 300));
  document.getElementById('btnAddEmployee').addEventListener('click', openAddEmployeeModal);
  document.getElementById('btnExportEmpExcel').addEventListener('click', exportEmployeeManageToExcel);
  document.getElementById('btnRefreshEmpMgr').addEventListener('click', loadEmployeeManage);

  document.getElementById('dMonth').addEventListener('change', updateDayOptions);
  document.getElementById('dYear').addEventListener('change', updateDayOptions);

  document.getElementById('beforeImageInput').addEventListener('change', function() {
    const f = this.files[0];
    const container = document.getElementById('beforeImageContainer');
    if (!f) { container.classList.add('hidden'); return; }
    container.classList.remove('hidden');
    const preview = document.getElementById('beforeImagePreview');
    preview.classList.add('img-loading');
    readFileAsDataUrl(f).then(function(dataUrl) {
      preview.onload = function() { preview.classList.remove('img-loading'); };
      preview.onerror = function() { preview.classList.remove('img-loading'); };
      preview.src = dataUrl;
      container.onclick = function() { openImageViewer(dataUrl, 'Before (ใหม่)'); };
    }).catch(function() { container.classList.add('hidden'); });
  });

  document.getElementById('afterImageInput').addEventListener('change', function() {
    const f = this.files[0];
    const container = document.getElementById('afterImageContainer');
    if (!f) { container.classList.add('hidden'); return; }
    container.classList.remove('hidden');
    const preview = document.getElementById('afterImagePreview');
    preview.classList.add('img-loading');
    readFileAsDataUrl(f).then(function(dataUrl) {
      preview.onload = function() { preview.classList.remove('img-loading'); };
      preview.onerror = function() { preview.classList.remove('img-loading'); };
      preview.src = dataUrl;
      container.onclick = function() { openImageViewer(dataUrl, 'After (ใหม่)'); };
    }).catch(function() { container.classList.add('hidden'); });
  });

  document.getElementById('multiFileInput').addEventListener('change', function() {
    handleMultiFileSelect(this.files);
    this.value = '';
  });

  bindCategoryEvents();
  bindKaizenTypeEvents();

  document.addEventListener('keydown', function(ev) {
    if (ev.key === 'Escape') {
      if (!document.getElementById('formModal').classList.contains('hidden')) {
        if (!isSubmitting) closeForm();
      } else if (!document.getElementById('detailModal').classList.contains('hidden')) {
        document.getElementById('detailModal').classList.add('hidden');
      } else if (!document.getElementById('commentModal').classList.contains('hidden')) {
        closeCommentModal();
      } else if (!document.getElementById('empHistoryModal').classList.contains('hidden')) {
        document.getElementById('empHistoryModal').classList.add('hidden');
      }
    }
    if (ev.key === 'n' && ev.ctrlKey && CURRENT_USER && CURRENT_USER.role === 'employee') {
      ev.preventDefault();
      if (!isLoading && !isSubmitting && document.getElementById('formModal').classList.contains('hidden')) {
        openForm(null);
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', function() {
  initDatePickers();
  bindEvents();
  initAutoLogoutListeners();

  const saved = loadSession();
  if (saved && saved.id && saved.role) {
    showLoading();
    callAppsScript('identifyUser', { role: saved.role, id: saved.id })
      .then(function(res) {
        hideLoading();
        if (res.success) {
          const user = buildUserFromIdentifyResult_(saved.id, res);
          saveSession(user);
          startApp(user);
        } else {
          clearSession();
          document.getElementById('loginScreen').classList.remove('hidden');
        }
      })
      .catch(function() {
        hideLoading();
        clearSession();
        document.getElementById('loginScreen').classList.remove('hidden');
      });
  } else {
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('loginId').focus();
  }
});

window.addEventListener('beforeunload', function(e) {
  if (!document.getElementById('formModal').classList.contains('hidden') && isSubmitting) {
    e.preventDefault();
    e.returnValue = 'กำลังบันทึกข้อมูล กรุณารอสักครู่';
    return e.returnValue;
  }
});