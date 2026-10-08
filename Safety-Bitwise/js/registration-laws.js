const CONFIG = {
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbwaoVhuuQXzodU179I--3imlWi5VO5MhHElLmLxqfs8KzIeua6ynhI8h4vV5rec3Muz/exec",
  SHEET: "Registration_Laws_and_Safety",
  TIMEOUT: 30000,
  RETRY: 3
};

const regFilterState = { ministry: "", result: "", owner: "", seq: "" };
let regRowsCache = [];
let regEditingRowIndex = null;
let regSearchTerm = "";
let regCurrentPage = 1;
const REG_PAGE_SIZE = 10;

let regGroupEditItems = null;   
let regGroupEditSeq   = null;   
let regGroupItemUidCounter = 0;

const MINISTRY_PREFIX = {
  'แรงงาน': 'L',
  'อุตสาหกรรม': 'I',
  'สาธารณสุข': 'H',
  'พลังงาน': 'E',
  'มหาดไทย': 'In',
  'อบต./เทศบาล': 'M',
  'ลูกค้า': 'C'
};
const MINISTRY_OPTIONS = Object.keys(MINISTRY_PREFIX);

let regSeqAutoFilled = false;

const REG_SCHEMA = {
  fields: [
    {
      key: "กระทรวง", label: "กระทรวง", type: "select", required: true,
      options: MINISTRY_OPTIONS.map(m => ({ value: m, label: `${m} (${MINISTRY_PREFIX[m]})` }))
    },
    {
      key: "ลำดับ", label: "ลำดับ (รหัส)", type: "text", required: true,
      hint: "เลือกกระทรวงก่อน ระบบจะรันเลขลำดับให้อัตโนมัติ"
    },
    { key: "ชื่อกฎหมาย",               label: "ชื่อกฎหมาย",                type: "text",     required: true, wide: true },
    { key: "วันที่ประกาศ",             label: "วันที่ประกาศ",              type: "date" },
    { key: "วันที่มีผลบังคับใช้",      label: "วันที่มีผลบังคับใช้",       type: "date" },
    { key: "รายละเอียดข้อกำหนดกฎหมาย", label: "รายละเอียดข้อกำหนดกฎหมาย",  type: "textarea", wide: true },
    { key: "ความถี่",                  label: "ความถี่",                   type: "text" },
    { key: "กำหนดการ",                 label: "กำหนดการ",                  type: "text" },
    { key: "ผลการประเมิน",             label: "ผลการประเมิน",              type: "select",   options: [
      { value: "Yes", label: "สอดคล้อง (Yes)" },
      { value: "No",  label: "ไม่สอดคล้อง (No)" },
      { value: "NA",  label: "NA (ไม่ระบุ)" },
    ] },
    { key: "ผู้รับผิดชอบ",             label: "ผู้รับผิดชอบ",              type: "text" },
    { key: "หมายเหตุ",                 label: "หมายเหตุ",                  type: "text" },
    {
      key: "ไฟล์แนบ", label: "ไฟล์แนบ (PDF)", type: "file", wide: true,
      hint: "แนบไฟล์ PDF ขนาดไม่เกิน 10MB"
    },
  ],
};

// ============ Helper Functions ============

function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function escapeJsAttr(value) {
  return String(value ?? "").replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, "&quot;").replace(/[\r\n]+/g, " ");
}

function normSeq(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toUpperCase();
}

function cleanMinistryName(value) {
  if (!value) return "ไม่ระบุ";
  let m = String(value).trim();
  m = m.replace(/^กระทรวง/, "");
  return m || "ไม่ระบุ";
}

function formatNum(v) {
  if (v === undefined || v === null || v === "") return "-";
  const n = Number(v);
  return isNaN(n) ? v : n.toLocaleString("th-TH");
}

const MONTH_NAMES_TH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

function toISODateString(value) {
  if (!value && value !== 0) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
    const dmy = trimmed.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})$/);
    if (dmy) {
      let y = Number(dmy[3]);
      if (y > 2400) y -= 543;
      const m = String(Number(dmy[2])).padStart(2, '0');
      const d = String(Number(dmy[1])).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }
  if (value instanceof Date && !isNaN(value)) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const num = Number(value);
  if (!isNaN(num) && num > 1000) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    const d = new Date(excelEpoch + num * 86400000);
    const year  = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day   = String(d.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return null;
}

function formatDateThai(value) {
  if (!value && value !== 0) return "-";
  const iso = toISODateString(value);
  if (!iso) return String(value);
  const [y, m, d] = iso.split('-').map(Number);
  const beYear = y > 2400 ? y : y + 543;
  return `${d} ${MONTH_NAMES_TH[m - 1]} ${beYear}`;
}

function showToast(msg, isError = false) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.className = `toast show ${isError ? "error" : ""}`;
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => { toast.className = "toast"; }, 3000);
}

function showLoading(el) { if (el) el.innerHTML = `<div class="skeleton-row">⏳ กำลังโหลด...</div>`; }

function evalBadge(result) {
  const s = String(result || "").trim().toLowerCase();
  if (s === "yes") return `<span class="result-badge yes">✅ สอดคล้อง</span>`;
  if (s === "no")  return `<span class="result-badge no">❌ ไม่สอดคล้อง</span>`;
  return `<span class="result-badge na">NA</span>`;
}

function getMinistryIcon(ministry) {
  const m = cleanMinistryName(ministry);
  const icons = { 'แรงงาน': '⚙️', 'อุตสาหกรรม': '🏭', 'สาธารณสุข': '🏥', 'พลังงาน': '⚡', 'มหาดไทย': '🏛️', 'อบต./เทศบาล': '🏘️', 'ลูกค้า': '🤝' };
  return icons[m] || '📋';
}

function getMinistryClass(ministry) {
  const m = cleanMinistryName(ministry);
  const map = {
    'แรงงาน': 'ministry-แรงงาน', 'อุตสาหกรรม': 'ministry-อุตสาหกรรม',
    'สาธารณสุข': 'ministry-สาธารณสุข', 'พลังงาน': 'ministry-พลังงาน', 'มหาดไทย': 'ministry-มหาดไทย',
    'อบต./เทศบาล': 'ministry-govlocal', 'ลูกค้า': 'ministry-customer'
  };
  return map[m] || 'ministry-ไม่ระบุ';
}

// ============ Auto-number Logic ============
function computeNextSeq(ministry) {
  const cleanM = cleanMinistryName(ministry);
  const prefix = MINISTRY_PREFIX[cleanM];
  if (!prefix) return '';
  let maxNum = 0;
  const re = new RegExp('^' + prefix + '(\\d+)$', 'i');
  regRowsCache.forEach(r => {
    const seq = (r["ลำดับ"] || "").toString().trim();
    const m = seq.match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!isNaN(n) && n > maxNum) maxNum = n;
    }
  });
  return prefix + String(maxNum + 1).padStart(3, '0');
}

function setupSeqAutoGenerate() {
  const ministrySel = document.getElementById('rf_กระทรวง');
  const seqInput    = document.getElementById('rf_ลำดับ');
  if (!ministrySel || !seqInput) return;
  seqInput.addEventListener('input', () => {
    if (!seqInput.dataset.settingProgrammatically) regSeqAutoFilled = false;
  });
  ministrySel.addEventListener('change', () => {
    if (regEditingRowIndex !== null) return;
    const ministry = ministrySel.value;
    if (!ministry) return;
    if (seqInput.value.trim() === '' || regSeqAutoFilled) {
      const nextSeq = computeNextSeq(ministry);
      if (nextSeq) {
        seqInput.dataset.settingProgrammatically = '1';
        seqInput.value = nextSeq;
        regSeqAutoFilled = true;
        delete seqInput.dataset.settingProgrammatically;
      }
    }
  });
}

// ============ Donut Chart ============
function renderDonut(segments, centerLabel, centerValue) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = 54, cx = 64, cy = 64, circumference = 2 * Math.PI * r;
  let offset = 0;
  const circles = segments.map(seg => {
    const frac = seg.value / total;
    const dash = frac * circumference;
    const gap = circumference - dash;
    const circle = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${seg.color}" stroke-width="16"
      stroke-dasharray="${dash} ${gap}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})"/>`;
    offset += dash;
    return circle;
  }).join("");
  return `
  <svg viewBox="0 0 128 128" width="140" height="140">
    ${circles}
    <text x="64" y="60" text-anchor="middle" font-size="20" font-weight="800" fill="#1A365D" font-family="'Noto Sans Thai', sans-serif">${centerValue}</text>
    <text x="64" y="76" text-anchor="middle" font-size="10" fill="#64748B" font-family="'Noto Sans Thai', sans-serif">${centerLabel}</text>
  </svg>`;
}

// ============ API Client ============
async function fetchWithRetry(url, options = {}, retries = CONFIG.RETRY) {
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), CONFIG.TIMEOUT);
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeout);
      return response;
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

async function fetchSheetData(sheetName) {
  const qs = new URLSearchParams({ sheet: sheetName });
  const url = `${CONFIG.APPS_SCRIPT_URL}?${qs.toString()}`;
  const response = await fetchWithRetry(url);
  const text = await response.text();
  let json;
  try { json = JSON.parse(text); } catch { throw new Error(`Server error: ${text.slice(0, 100)}`); }
  if (json.error) throw new Error(json.error);
  return json.rows || [];
}

async function postToSheet(payload) {
  try {
    const response = await fetchWithRetry(CONFIG.APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(payload)
    });
    const text = await response.text();
    let json;
    try { json = JSON.parse(text); } catch { throw new Error(`Server error: ${text.slice(0, 100)}`); }
    if (json.error) throw new Error(json.error);
    return json;
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('เชื่อมต่อ timeout (เกิน 30 วินาที)');
    throw err;
  }
}

const addSheetRow    = (data)           => postToSheet({ action: "add",    sheet: CONFIG.SHEET, data });
const updateSheetRow = (rowIndex, data) => postToSheet({ action: "update", sheet: CONFIG.SHEET, rowIndex, data });
const deleteSheetRow = (rowIndex)       => postToSheet({ action: "delete", sheet: CONFIG.SHEET, rowIndex });

// ============ File Upload ============
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result || "";
      const base64 = String(result).split(",")[1] || "";
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('อ่านไฟล์ไม่สำเร็จ'));
    reader.readAsDataURL(file);
  });
}

async function uploadAttachmentFileObject(file, existingUrl, seqForFolder) {
  if (!file) return existingUrl || '';
  if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name || '')) {
    throw new Error('รองรับเฉพาะไฟล์ PDF เท่านั้น');
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('ไฟล์ต้องมีขนาดไม่เกิน 10MB');
  }
  const base64Data = await readFileAsBase64(file);
  const result = await postToSheet({
    action: 'uploadFile',
    fileName: file.name,
    mimeType: file.type || 'application/pdf',
    base64Data: base64Data,
    seq: seqForFolder || ''
  });
  if (result.error) throw new Error(result.error);
  return result.fileUrl || '';
}

// ============ Form Setup ============
function renderRegFormFields() {
  document.getElementById("regFieldGrid").innerHTML = REG_SCHEMA.fields.map(f => {
    let inputHtml;
    if (f.type === "select") {
      const optsHtml = f.options.map(o => {
        if (o && typeof o === 'object') return `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`;
        return `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`;
      }).join("");
      inputHtml = `<select id="rf_${f.key}"><option value="">-- เลือก --</option>${optsHtml}</select>`;
    } else if (f.type === "date") {
      inputHtml = `<input id="rf_${f.key}" type="date">`;
    } else if (f.type === "textarea") {
      inputHtml = `<textarea id="rf_${f.key}></textarea>`;
    } else if (f.type === "file") {
      inputHtml = `
        <input id="rf_${f.key}" type="file" accept="application/pdf">
        <input type="hidden" id="rf_${f.key}_url" value="">
        <div class="file-current-note" id="rf_${f.key}_current"></div>
        <div class="file-current-note file-selected-status" style="color:var(--green-dark);display:none;"></div>
      `;
    } else {
      inputHtml = `<input id="rf_${f.key}" type="text">`;
    }
    return `
      <div class="field${f.wide ? ' wide' : ''}">
        <label for="rf_${f.key}">${f.label}${f.required ? ' <span style="color:var(--red)">*</span>' : ''}</label>
        ${inputHtml}
        <div class="error-msg" id="rerr_${f.key}">กรุณากรอกข้อมูล</div>
        ${f.hint ? `<div class="hint">${escapeHtml(f.hint)}</div>` : ''}
        ${f.key === 'ผลการประเมิน' ? `<div class="file-current-note" id="rf_ผลการประเมิน_reviewdate"></div>` : ''}
      </div>
    `;
  }).join("");
  
  const fileInput = document.getElementById('rf_ไฟล์แนบ');
  if (fileInput) {
    fileInput.addEventListener('change', function() {
      const file = this.files && this.files[0] ? this.files[0] : null;
      const parentDiv = this.closest('.field');
      if (parentDiv) {
        const statusEl = parentDiv.querySelector('.file-selected-status');
        if (statusEl) {
          statusEl.textContent = file ? `✅ เลือกไฟล์: ${file.name}` : '';
          statusEl.style.display = file ? 'block' : 'none';
        }
      }
    });
  }
}

function validateRegForm() {
  let isValid = true;
  REG_SCHEMA.fields.forEach(f => {
    const el = document.getElementById(`rf_${f.key}`);
    const errEl = document.getElementById(`rerr_${f.key}`);
    if (!el) return;
    if (f.required && (!el.value || el.value.trim() === '')) {
      el.classList.add('error');
      if (errEl) errEl.style.display = 'block';
      isValid = false;
    } else {
      el.classList.remove('error');
      if (errEl) errEl.style.display = 'none';
    }
  });
  return isValid;
}

function getRegFormData() {
  const data = {};
  REG_SCHEMA.fields.forEach(f => {
    if (f.type === 'file') return;
    const el = document.getElementById(`rf_${f.key}`);
    if (el) data[f.key] = el.value;
  });
  return data;
}

function resetRegForm() {
  if (regGroupEditItems) cancelGroupEdit();
  regEditingRowIndex = null;
  regSeqAutoFilled = false;
  document.getElementById("regFormTitle").textContent = "➕ เพิ่มรายการกฎหมายใหม่";
  document.getElementById("regCancelEditBtn").style.display = "none";
  REG_SCHEMA.fields.forEach(f => {
    if (f.type === 'file') {
      const fileInput = document.getElementById(`rf_${f.key}`);
      const hiddenUrl  = document.getElementById(`rf_${f.key}_url`);
      const currentEl  = document.getElementById(`rf_${f.key}_current`);
      if (fileInput) fileInput.value = "";
      if (hiddenUrl) hiddenUrl.value = "";
      if (currentEl) currentEl.innerHTML = "";
      const parentDiv = fileInput?.closest?.('.field');
      if (parentDiv) {
        const statusEl = parentDiv.querySelector('.file-selected-status');
        if (statusEl) { statusEl.textContent = ''; statusEl.style.display = 'none'; }
      }
      return;
    }
    const el = document.getElementById(`rf_${f.key}`);
    if (el) { el.value = ""; el.classList.remove('error'); }
  });
  const reviewDateEl = document.getElementById('rf_ผลการประเมิน_reviewdate');
  if (reviewDateEl) reviewDateEl.innerHTML = "";
}

function startRegEdit(row) {
  if (regGroupEditItems) cancelGroupEdit();
  regEditingRowIndex = row._rowIndex;
  regSeqAutoFilled = false;
  document.getElementById("regFormTitle").textContent = "✏️ แก้ไขรายการกฎหมาย";
  document.getElementById("regCancelEditBtn").style.display = "inline-block";
  
  REG_SCHEMA.fields.forEach(f => {
    if (f.type === 'file') {
      const fileInput = document.getElementById(`rf_${f.key}`);
      const hiddenUrl = document.getElementById(`rf_${f.key}_url`);
      const currentEl = document.getElementById(`rf_${f.key}_current`);
      const existingUrl = row[f.key] || "";
      if (fileInput) fileInput.value = "";
      if (hiddenUrl) hiddenUrl.value = existingUrl;
      if (currentEl) {
        currentEl.innerHTML = existingUrl
          ? `📎 ไฟล์เดิม: <a href="${escapeHtml(existingUrl)}" target="_blank" rel="noopener">เปิดดูไฟล์</a> (เลือกไฟล์ใหม่เพื่อแทนที่)`
          : `ยังไม่มีไฟล์แนบ`;
      }
      return;
    }
    const el = document.getElementById(`rf_${f.key}`);
    if (!el) return;
    let val = row[f.key] !== undefined && row[f.key] !== null ? row[f.key] : "";
    if (f.type === 'date' && val) {
      val = toISODateString(val) || "";
    }
    el.value = val;
    el.classList.remove('error');
  });
  
  const reviewDateEl = document.getElementById('rf_ผลการประเมิน_reviewdate');
  if (reviewDateEl) {
    const reviewDate = row['วันที่ประเมินล่าสุด'];
    reviewDateEl.innerHTML = reviewDate ? `🕓 ประเมิน/ทบทวนล่าสุดเมื่อ: ${formatDateThai(reviewDate)}` : '';
  }
  
  document.querySelector(".form-card").scrollIntoView({ behavior: "smooth" });
}

function startRegEditByIndex(rowIndex) {
  const idx = Number(rowIndex);
  const row = regRowsCache.find(r => r._rowIndex === idx);
  if (row) startRegEdit(row);
  else showToast('ไม่พบข้อมูลแถวนี้ กรุณารีเฟรชแล้วลองใหม่', true);
}

// ============ Group Edit (Atomic Batch API) ============

function startRegEditGroupBySeq(seq) {
  const items = regRowsCache
    .filter(r => normSeq(r["ลำดับ"]) === normSeq(seq))
    .sort((a, b) => a._rowIndex - b._rowIndex);
  if (!items.length) { showToast('ไม่พบข้อมูลฉบับนี้ กรุณารีเฟรชแล้วลองใหม่', true); return; }

  resetRegForm();
  regGroupEditSeq = seq;
  regGroupItemUidCounter = 0;
  regGroupEditItems = items.map(it => ({
    uid: regGroupItemUidCounter++,
    rowIndex: it._rowIndex,
    detail: it["รายละเอียดข้อกำหนดกฎหมาย"] || "",
    freq:   it["ความถี่"] || "",
    sched:  it["กำหนดการ"] || "",
    result: it["ผลการประเมิน"] || "",
    owner:  it["ผู้รับผิดชอบ"] || "",
    note:   it["หมายเหตุ"] || "",
    attachUrl: it["ไฟล์แนบ"] || "",
    attachFileObj: null,
    reviewDate: it["วันที่ประเมินล่าสุด"] || "",
  }));

  const first = items[0];
  document.getElementById("gf_ลำดับ").value = seq;
  document.getElementById("gf_กระทรวง").value = cleanMinistryName(first["กระทรวง"]);
  document.getElementById("gf_ชื่อกฎหมาย").value = first["ชื่อกฎหมาย"] || "";
  document.getElementById("gf_วันที่ประกาศ").value = toISODateString(first["วันที่ประกาศ"]) || "";
  document.getElementById("gf_วันที่มีผลบังคับใช้").value = toISODateString(first["วันที่มีผลบังคับใช้"]) || "";

  const labelEl = document.getElementById("regGroupEditLabel");
  if (labelEl) labelEl.textContent = `${seq} · ${items.length} ข้อกำหนด`;

  document.querySelector(".form-card").style.display = "none";
  document.getElementById("regGroupEditPanel").style.display = "block";
  renderGroupEditRows();
  document.getElementById("regGroupEditPanel").scrollIntoView({ behavior: "smooth" });
}

function renderGroupEditRows() {
  const container = document.getElementById("regGroupItemsContainer");
  if (!regGroupEditItems || !regGroupEditItems.length) {
    container.innerHTML = `<div class="skeleton-row">ยังไม่มีข้อกำหนดในฉบับนี้ กด "➕ เพิ่มข้อกำหนดใหม่" เพื่อเริ่มเพิ่ม</div>`;
    return;
  }
  
  container.innerHTML = regGroupEditItems.map((item, idx) => `
    <div class="group-item-card" data-uid="${item.uid}">
      <div class="group-item-head">
        <span class="group-item-num">📌 ข้อที่ ${idx + 1}${item.rowIndex ? '' : ' (ใหม่)'}</span>
        <button type="button" class="icon-btn delete" onclick="removeGroupItemRow(${item.uid})">🗑️ ลบข้อนี้</button>
      </div>
      <div class="field-grid">
        <div class="field wide">
          <label>รายละเอียดข้อกำหนดกฎหมาย</label>
          <textarea data-uid="${item.uid}" data-field="detail">${escapeHtml(item.detail)}</textarea>
        </div>
        <div class="field"><label>ความถี่</label><input type="text" data-uid="${item.uid}" data-field="freq" value="${escapeHtml(item.freq)}"></div>
        <div class="field"><label>กำหนดการ</label><input type="text" data-uid="${item.uid}" data-field="sched" value="${escapeHtml(item.sched)}"></div>
        <div class="field">
          <label>ผลการประเมิน</label>
          <select data-uid="${item.uid}" data-field="result">
            <option value="" ${item.result === '' ? 'selected' : ''}>-- เลือก --</option>
            <option value="Yes" ${item.result === 'Yes' ? 'selected' : ''}>สอดคล้อง (Yes)</option>
            <option value="No" ${item.result === 'No' ? 'selected' : ''}>ไม่สอดคล้อง (No)</option>
            <option value="NA" ${item.result === 'NA' ? 'selected' : ''}>NA (ไม่ระบุ)</option>
          </select>
          ${item.reviewDate ? `<div class="file-current-note">🕓 ประเมินล่าสุด: ${formatDateThai(item.reviewDate)}</div>` : ''}
        </div>
        <div class="field"><label>ผู้รับผิดชอบ</label><input type="text" data-uid="${item.uid}" data-field="owner" value="${escapeHtml(item.owner)}"></div>
        <div class="field wide"><label>หมายเหตุ</label><input type="text" data-uid="${item.uid}" data-field="note" value="${escapeHtml(item.note)}"></div>
        <div class="field wide">
          <label>ไฟล์แนบ (PDF)</label>
          <input type="file" accept="application/pdf" data-uid="${item.uid}" data-field="attachFile">
          <div class="file-current-note" data-uid="${item.uid}" data-role="attach-note">
            ${item.attachFileObj ? `✅ เลือกไฟล์ใหม่แล้ว: ${escapeHtml(item.attachFileObj.name)}`
              : (item.attachUrl ? `📎 ไฟล์เดิม: <a href="${escapeHtml(item.attachUrl)}" target="_blank" rel="noopener">เปิดดูไฟล์</a> (เลือกไฟล์ใหม่เพื่อแทนที่)` : `ยังไม่มีไฟล์แนบ`)}
          </div>
        </div>
      </div>
    </div>
  `).join("");
  
  container.querySelectorAll('[data-uid][data-field]').forEach(el => {
    el.addEventListener('input', onGroupItemFieldChange);
    el.addEventListener('change', onGroupItemFieldChange);
  });
}

function onGroupItemFieldChange(e) {
  const uid = Number(e.target.dataset.uid);
  const field = e.target.dataset.field;
  const item = regGroupEditItems && regGroupEditItems.find(it => it.uid === uid);
  if (!item) return;
  if (field === 'attachFile') {
    const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
    if (file) {
      item.attachFileObj = file;
      const note = document.querySelector(`.file-current-note[data-uid="${uid}"][data-role="attach-note"]`);
      if (note) note.innerHTML = `✅ เลือกไฟล์ใหม่แล้ว: ${escapeHtml(file.name)}`;
    }
    return;
  }
  item[field] = e.target.value;
}

function addGroupEditRow() {
  if (!regGroupEditItems) return;
  regGroupEditItems.push({
    uid: regGroupItemUidCounter++,
    rowIndex: null, detail: "", freq: "", sched: "", result: "", owner: "", note: "",
    attachUrl: "", attachFileObj: null, reviewDate: ""
  });
  renderGroupEditRows();
}

function removeGroupItemRow(uid) {
  if (!regGroupEditItems) return;
  if (regGroupEditItems.length <= 1) { showToast('ต้องมีข้อกำหนดอย่างน้อย 1 ข้อ', true); return; }
  if (!confirm('ลบข้อกำหนดนี้ออกจากฉบับ?')) return;
  regGroupEditItems = regGroupEditItems.filter(it => it.uid !== uid);
  renderGroupEditRows();
}

function cancelGroupEdit() {
  regGroupEditItems = null;
  regGroupEditSeq   = null;
  document.getElementById("regGroupEditPanel").style.display = "none";
  document.querySelector(".form-card").style.display = "";
}

async function handleRegSave() {
  if (!validateRegForm()) { showToast("กรุณากรอกข้อมูลให้ครบถ้วน", true); return; }
  const data = getRegFormData();
  const saveBtn = document.getElementById("regSaveBtn");
  saveBtn.disabled = true;
  saveBtn.textContent = "⏳ กำลังบันทึก...";
  try {
    const fileInput = document.getElementById('rf_ไฟล์แนบ');
    const hiddenUrl = document.getElementById('rf_ไฟล์แนบ_url');
    const seqForFolder = (document.getElementById('rf_ลำดับ').value || '').trim();
    if (fileInput && fileInput.files && fileInput.files.length > 0) {
      saveBtn.textContent = "⏳ กำลังอัปโหลดไฟล์...";
      data["ไฟล์แนบ"] = await uploadAttachmentFileObject(fileInput.files[0], hiddenUrl?.value || '', seqForFolder);
    } else if (hiddenUrl && hiddenUrl.value) {
      data["ไฟล์แนบ"] = hiddenUrl.value;
    }
    if (regEditingRowIndex !== null) {
      const existingRow = regRowsCache.find(r => r._rowIndex === regEditingRowIndex);
      if (existingRow && existingRow['วันที่ประเมินล่าสุด']) {
        data['วันที่ประเมินล่าสุด'] = existingRow['วันที่ประเมินล่าสุด'];
      }
      await updateSheetRow(regEditingRowIndex, data);
      showToast("✅ แก้ไขข้อมูลสำเร็จ");
    } else {
      await addSheetRow(data);
      showToast("✅ เพิ่มข้อมูลสำเร็จ");
    }
    resetRegForm();
    await loadRegistrationData();
  } catch (err) {
    showToast(`❌ ${err.message}`, true);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "💾 บันทึก";
  }
}

async function handleGroupSave() {
  if (!regGroupEditItems) return;
  
  document.querySelectorAll('#regGroupItemsContainer [data-uid][data-field]').forEach(el => {
    const uid = Number(el.dataset.uid);
    const field = el.dataset.field;
    const item = regGroupEditItems.find(it => it.uid === uid);
    if (item && field !== 'attachFile') item[field] = el.value;
  });
  
  const seqVal = document.getElementById("gf_ลำดับ").value.trim();
  const ministry = document.getElementById("gf_กระทรวง").value.trim();
  const lawName = document.getElementById("gf_ชื่อกฎหมาย").value.trim();
  const announceDt = document.getElementById("gf_วันที่ประกาศ").value;
  const effectiveDt = document.getElementById("gf_วันที่มีผลบังคับใช้").value;
  
  if (!seqVal || !lawName) { showToast('กรุณากรอก "ลำดับ" และ "ชื่อกฎหมาย"', true); return; }
  if (!regGroupEditItems.length) { showToast('ต้องมีข้อกำหนดอย่างน้อย 1 ข้อ', true); return; }
  
  const saveBtn = document.getElementById("regGroupSaveBtn");
  saveBtn.disabled = true;
  saveBtn.textContent = "⏳ กำลังบันทึก...";
  
  try {
    const sharedData = {
      "ลำดับ": seqVal,
      "กระทรวง": ministry,
      "ชื่อกฎหมาย": lawName,
      "วันที่ประกาศ": announceDt,
      "วันที่มีผลบังคับใช้": effectiveDt
    };

    for (const item of regGroupEditItems) {
      if (item.attachFileObj) {
        saveBtn.textContent = "⏳ กำลังอัปโหลดไฟล์...";
        item.attachUrl = await uploadAttachmentFileObject(item.attachFileObj, item.attachUrl, seqVal);
        item.attachFileObj = null;
      }
    }

    const originalRowIndexes = new Set(regRowsCache.filter(r => normSeq(r["ลำดับ"]) === normSeq(regGroupEditSeq)).map(r => r._rowIndex));
    const keptRowIndexes     = new Set(regGroupEditItems.filter(it => it.rowIndex !== null).map(it => it.rowIndex));
    const rowsToDelete       = [...originalRowIndexes].filter(idx => !keptRowIndexes.has(idx));

    const itemsToUpdate = regGroupEditItems.filter(it => it.rowIndex !== null).map(it => ({
      rowIndex: it.rowIndex,
      data: {
        "รายละเอียดข้อกำหนดกฎหมาย": it.detail,
        "ความถี่": it.freq,
        "กำหนดการ": it.sched,
        "ผลการประเมิน": it.result,
        "วันที่ประเมินล่าสุด": it.reviewDate || "",
        "ผู้รับผิดชอบ": it.owner,
        "หมายเหตุ": it.note,
        "ไฟล์แนบ": it.attachUrl || ""
      }
    }));

    const itemsToAdd = regGroupEditItems.filter(it => it.rowIndex === null).map(it => ({
      data: {
        "รายละเอียดข้อกำหนดกฎหมาย": it.detail,
        "ความถี่": it.freq,
        "กำหนดการ": it.sched,
        "ผลการประเมิน": it.result,
        "ผู้รับผิดชอบ": it.owner,
        "หมายเหตุ": it.note,
        "ไฟล์แนบ": it.attachUrl || ""
      }
    }));

    saveBtn.textContent = "⏳ บันทึกข้อมูลลงชีต...";
    await postToSheet({
      action: "batchGroupSave",
      sheet: CONFIG.SHEET,
      sharedData,
      itemsToUpdate,
      itemsToAdd,
      rowsToDelete
    });

    showToast(`✅ บันทึกฉบับ ${seqVal} เรียบร้อย`);
    cancelGroupEdit();
    await loadRegistrationData();
  } catch (err) {
    showToast(`❌ ${err.message}`, true);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "💾 บันทึกทั้งฉบับ";
  }
}

async function handleRegDelete(rowIndex) {
  if (!confirm("ยืนยันการลบข้อกำหนดนี้?")) return;
  try {
    await deleteSheetRow(rowIndex);
    showToast("✅ ลบข้อมูลสำเร็จ");
    await loadRegistrationData();
  } catch (err) {
    showToast(`❌ ${err.message}`, true);
  }
}

async function handleRegDeleteBySeq(seq) {
  const items = regRowsCache.filter(r => normSeq(r["ลำดับ"]) === normSeq(seq));
  if (!items.length) return;
  if (!confirm(`ยืนยันการลบกฎหมาย ${seq} (${items.length} ข้อกำหนด) ทั้งหมด?`)) return;
  try {
    await postToSheet({
      action: "batchDelete",
      sheet: CONFIG.SHEET,
      rowIndexes: items.map(it => it._rowIndex)
    });
    showToast(`✅ ลบกฎหมาย ${seq} เรียบร้อย`);
    await loadRegistrationData();
  } catch (err) {
    showToast(`❌ ${err.message}`, true);
  }
}

// ============ Filters & Render ============

function populateRegFilterOptions(rows) {
  const ministries = [...new Set(rows.map(r => cleanMinistryName(r["กระทรวง"])).filter(Boolean))].sort();
  const owners     = [...new Set(rows.map(r => (r["ผู้รับผิดชอบ"] || "").trim()).filter(Boolean))].sort();
  
  const seqMap = new Map();
  rows.forEach(r => {
    const raw = (r["ลำดับ"] || "").toString().trim();
    if (raw && !seqMap.has(normSeq(raw))) seqMap.set(normSeq(raw), raw);
  });
  const sequences = [...seqMap.values()].sort((a, b) => a.localeCompare(b));

  const setSelect = (id, options, currentVal) => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = `<option value="">${id.includes('Ministry') ? 'ทุกกระทรวง' : id.includes('Owner') ? 'ทุกผู้รับผิดชอบ' : 'ทุกลำดับ'}</option>` + options.map(o => `<option value="${o}">${o}</option>`).join("");
    sel.value = currentVal;
  };
  
  setSelect("regFilterMinistry", ministries, regFilterState.ministry);
  setSelect("regFilterOwner", owners, regFilterState.owner);
  setSelect("regFilterSeq", sequences, regFilterState.seq);
}

function applyRegFilter(rows) {
  let result = rows;
  if (regFilterState.ministry) result = result.filter(r => cleanMinistryName(r["กระทรวง"]) === regFilterState.ministry);
  if (regFilterState.owner)    result = result.filter(r => (r["ผู้รับผิดชอบ"] || "").trim() === regFilterState.owner);
  if (regFilterState.result)   result = result.filter(r => String(r["ผลการประเมิน"] || "").trim().toLowerCase() === regFilterState.result.toLowerCase());
  if (regFilterState.seq)      result = result.filter(r => normSeq(r["ลำดับ"]) === normSeq(regFilterState.seq));
  return result;
}

function groupRegRows(rows) {
  const map = new Map();
  rows.forEach(r => {
    const rawSeq = (r["ลำดับ"] || "").toString().trim();
    const key = rawSeq ? normSeq(rawSeq) : `__no_seq_${r._rowIndex}`;
    if (!map.has(key)) map.set(key, { seq: rawSeq, items: [] });
    map.get(key).items.push(r);
  });
  return Array.from(map.values()).sort((a, b) => a.seq.localeCompare(b.seq));
}

function getFilteredGroups() {
  const filteredRows = applyRegFilter(regRowsCache);
  let groups = groupRegRows(filteredRows);
  if (regSearchTerm) {
    groups = groups.filter(({ items }) => items.map(it => Object.values(it).join(' ')).join(' ').toLowerCase().includes(regSearchTerm));
  }
  return groups;
}

function renderMinistryFilter() {
  const container = document.getElementById('regMinistryFilterContainer');
  if (!container) return;
  const counts = {};
  regRowsCache.forEach(r => {
    const m = cleanMinistryName(r["กระทรวง"]);
    counts[m] = (counts[m] || 0) + 1;
  });
  const ministries = Object.keys(counts).sort();
  container.innerHTML = `
    <div class="ministry-filter-group">
      <button class="filter-chip active" data-ministry="">🏛️ ทั้งหมด <span class="chip-count">${regRowsCache.length}</span></button>
      ${ministries.map(m => `
        <button class="filter-chip" data-ministry="${m}">${getMinistryIcon(m)} ${m} <span class="chip-count">${counts[m]}</span></button>
      `).join("")}
    </div>
  `;
  container.querySelectorAll('.filter-chip').forEach(btn => {
    btn.addEventListener('click', function () {
      container.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      document.getElementById('regFilterMinistry').value = this.dataset.ministry;
      regFilterState.ministry = this.dataset.ministry;
      document.getElementById('regQuickSearch').value = '';
      regSearchTerm = "";
      regCurrentPage = 1;
      renderRegList();
    });
  });
}

function renderRegSummary(rows) {
  const kpiGrid    = document.getElementById("regKpiGrid");
  const donutEl    = document.getElementById("regDonut");
  const donutTot   = document.getElementById("regDonutTotal");
  const ministryEl = document.getElementById("regMinistryChart");

  if (!rows.length) {
    kpiGrid.innerHTML = `<div class="skeleton-row">❌ ยังไม่มีข้อมูลในทะเบียนกฎหมาย</div>`;
    donutEl.innerHTML = "";
    ministryEl.innerHTML = "";
    return;
  }

  const total = rows.length;
  const uniqueLaws = new Set(rows.map(r => normSeq(r["ลำดับ"])).filter(Boolean)).size || total;
  
  const counts = { yes: 0, no: 0, na: 0 };
  rows.forEach(r => {
    const v = String(r["ผลการประเมิน"] || "").trim().toLowerCase();
    if (v === "yes") counts.yes++;
    else if (v === "no") counts.no++;
    else counts.na++;
  });
  
  const compliancePct = total ? Math.round((counts.yes / total) * 100) : 0;

  const cards = [
    { label: "ข้อกำหนดทั้งหมด", value: total,      icon: "📜", status: "good", subtitle: `${uniqueLaws} ฉบับ` },
    { label: "สอดคล้อง",        value: counts.yes, icon: "✅", status: counts.yes > 0 ? "good" : "warn", subtitle: `${compliancePct}%` },
    { label: "ไม่สอดคล้อง",     value: counts.no,  icon: "❌", status: counts.no > 0 ? "bad" : "good", subtitle: counts.no > 0 ? 'ต้องดำเนินการ' : 'ไม่มี' },
    { label: "รอประเมิน (NA)",  value: counts.na,  icon: "⏳", status: counts.na > 0 ? "warn" : "good", subtitle: 'ยังไม่ประเมิน' },
  ];

  kpiGrid.innerHTML = cards.map(c => `
    <div class="kpi-card status-${c.status}">
      <div class="kpi-icon">${c.icon}</div>
      <div class="kpi-label">${c.label}</div>
      <div class="kpi-value">${formatNum(c.value)}</div>
      <div class="kpi-meta"><span class="target">${c.subtitle}</span></div>
    </div>
  `).join("");

  if (donutTot) donutTot.textContent = `${total} รายการ`;
  donutEl.innerHTML = `
    <div class="donut-wrap">
      ${renderDonut([{ value: counts.yes, color: "#10B981" }, { value: counts.no, color: "#EF4444" }, { value: counts.na, color: "#94A3B8" }], "ทั้งหมด", total)}
      <div class="donut-legend">
        <div class="donut-legend-item"><span class="sw" style="background:#10B981"></span>สอดคล้อง (Yes) <b>${counts.yes} รายการ</b></div>
        <div class="donut-legend-item"><span class="sw" style="background:#EF4444"></span>ไม่สอดคล้อง (No) <b>${counts.no} รายการ</b></div>
        ${counts.na ? `<div class="donut-legend-item"><span class="sw" style="background:#94A3B8"></span>NA <b>${counts.na} รายการ</b></div>` : ''}
      </div>
    </div>
  `;

  const byMinistry = {};
  rows.forEach(r => {
    const m = cleanMinistryName(r["กระทรวง"]);
    byMinistry[m] = (byMinistry[m] || 0) + 1;
  });
  const entries = Object.entries(byMinistry).sort((a, b) => b[1] - a[1]);
  const maxVal = Math.max(...entries.map(e => e[1]), 1);
  const palette = ["blue", "green", "amber", "purple", "red"];
  ministryEl.innerHTML = entries.map(([label, value], i) => `
    <div class="bar-item">
      <span class="bar-label">${getMinistryIcon(label)} ${escapeHtml(label)}</span>
      <div class="bar-track"><div class="bar-fill ${palette[i % palette.length]}" style="width:${(value / maxVal) * 100}%">${value > 0 ? value : ''}</div></div>
      <span class="bar-value">${value}</span>
    </div>
  `).join("");
}

function renderRegList() {
  const tbody   = document.getElementById("regList");
  const cardsEl = document.getElementById("regCards");
  const countEl = document.getElementById("regTableCount");

  const allGroups = getFilteredGroups();
  const totalItems = allGroups.reduce((sum, g) => sum + g.items.length, 0);
  const totalPages = Math.max(1, Math.ceil(allGroups.length / REG_PAGE_SIZE));
  if (regCurrentPage > totalPages) regCurrentPage = totalPages;
  if (regCurrentPage < 1) regCurrentPage = 1;

  const startIdx = (regCurrentPage - 1) * REG_PAGE_SIZE;
  const pageGroups = allGroups.slice(startIdx, startIdx + REG_PAGE_SIZE);

  if (countEl) {
    countEl.innerHTML = `
      <div class="row-count">
        <span>📋 ทะเบียนกฎหมาย</span>
        <span class="count-badge">${allGroups.length} ฉบับ</span>
        <span>· ข้อกำหนดทั้งหมด</span>
        <span class="count-badge">${totalItems} ข้อ</span>
        ${allGroups.length ? `<span>· แสดง ${startIdx + 1}-${Math.min(startIdx + REG_PAGE_SIZE, allGroups.length)}</span>` : ''}
      </div>
    `;
  }

  if (!allGroups.length) {
    const emptyHtml = `<div class="empty-state"><div class="icon">🔍</div><div>ไม่พบข้อมูลตามตัวกรองที่เลือก</div><div style="font-size:11px;margin-top:4px;">ลองปรับตัวกรองหรือค้นหาด้วยคำอื่น</div></div>`;
    tbody.innerHTML = `<tr><td colspan="14">${emptyHtml}</td></tr>`;
    if (cardsEl) cardsEl.innerHTML = emptyHtml;
    renderPagination(0, 0);
    return;
  }

  // Table View
  tbody.innerHTML = pageGroups.map(({ seq, items }) => {
    const escapedSeq = escapeHtml(seq ?? "");
    const jsSeq = escapeJsAttr(seq ?? "");
    const first = items[0];
    const ministry = cleanMinistryName(first["กระทรวง"]);
    return items.map((it, idx) => {
      const isFirst = idx === 0;
      return `
        <tr class="reg-group-row${isFirst ? ' reg-group-first' : ''}">
          ${isFirst ? `
            <td class="center" rowspan="${items.length}">
              <div class="law-group-actions">
                <span class="law-seq-badge">${escapedSeq || "-"}</span>
                <div class="group-btns">
                  <button class="icon-btn edit" onclick="startRegEditGroupBySeq('${jsSeq}')">✏️</button>
                  <button class="icon-btn delete" onclick="handleRegDeleteBySeq('${jsSeq}')">🗑️</button>
                </div>
              </div>
            </td>
            <td rowspan="${items.length}"><span class="ministry-pill ${getMinistryClass(ministry)}">${getMinistryIcon(ministry)} ${escapeHtml(ministry)}</span></td>
            <td rowspan="${items.length}"><span class="law-name-cell">${escapeHtml(first["ชื่อกฎหมาย"] || "-")}</span></td>
            <td class="center" rowspan="${items.length}">${formatDateThai(first["วันที่ประกาศ"])}</td>
            <td class="center" rowspan="${items.length}">${formatDateThai(first["วันที่มีผลบังคับใช้"])}</td>
          ` : ``}
          <td>${escapeHtml(it["รายละเอียดข้อกำหนดกฎหมาย"] || "-")}</td>
          <td class="center">${escapeHtml(it["ความถี่"] || "-")}</td>
          <td class="center">${escapeHtml(it["กำหนดการ"] || "-")}</td>
          <td class="center">${evalBadge(it["ผลการประเมิน"])}</td>
          <td class="center">${it["วันที่ประเมินล่าสุด"] ? formatDateThai(it["วันที่ประเมินล่าสุด"]) : '-'}</td>
          <td>${escapeHtml(it["ผู้รับผิดชอบ"] || "-")}</td>
          <td>${escapeHtml(it["หมายเหตุ"] || "-")}</td>
          <td class="center">${it["ไฟล์แนบ"] ? `<a class="attach-link" href="${escapeHtml(it["ไฟล์แนบ"])}" target="_blank" rel="noopener">📎 ดูไฟล์</a>` : '<span class="attach-none">-</span>'}</td>
          <td class="center"><div class="table-actions"><button class="icon-btn edit" onclick="startRegEditByIndex(${it._rowIndex})">✏️</button><button class="icon-btn delete" onclick="handleRegDelete(${it._rowIndex})">🗑️</button></div></td>
        </tr>
      `;
    }).join("");
  }).join("");

  // Cards View
  if (cardsEl) {
    cardsEl.innerHTML = pageGroups.map(({ seq, items }) => {
      const jsSeq = escapeJsAttr(seq ?? "");
      const first = items[0];
      const ministry = cleanMinistryName(first["กระทรวง"]);
      return `
        <div class="law-card">
          <div class="law-card-head">
            <div class="law-card-head-main">
              <span class="law-seq-badge">${escapeHtml(seq || "-")}</span>
              <div class="law-card-title">${escapeHtml(first["ชื่อกฎหมาย"] || "-")}</div>
              <div class="law-card-meta">
                <span class="ministry-pill ${getMinistryClass(ministry)}">${getMinistryIcon(ministry)} ${escapeHtml(ministry)}</span>
                <span><b>ประกาศ:</b> ${formatDateThai(first["วันที่ประกาศ"])}</span>
                <span><b>มีผล:</b> ${formatDateThai(first["วันที่มีผลบังคับใช้"])}</span>
              </div>
            </div>
            <div class="law-card-actions">
              <button class="icon-btn edit" onclick="startRegEditGroupBySeq('${jsSeq}')">✏️ ทั้งฉบับ</button>
              <button class="icon-btn delete" onclick="handleRegDeleteBySeq('${jsSeq}')">🗑️</button>
            </div>
          </div>
          <div class="law-card-items">
            ${items.map((it, idx) => `
              <div class="law-card-item">
                <div class="item-row"><span class="k">ข้อที่</span><span class="v">${idx + 1} / ${items.length}</span></div>
                <div class="item-row detail-row"><span class="k">รายละเอียด</span><span class="v">${escapeHtml(it["รายละเอียดข้อกำหนดกฎหมาย"] || "-")}</span></div>
                <div class="item-row"><span class="k">ความถี่</span><span class="v">${escapeHtml(it["ความถี่"] || "-")}</span></div>
                <div class="item-row"><span class="k">กำหนดการ</span><span class="v">${escapeHtml(it["กำหนดการ"] || "-")}</span></div>
                <div class="item-row"><span class="k">ผลการประเมิน</span><span class="v">${evalBadge(it["ผลการประเมิน"])}</span></div>
                <div class="item-row"><span class="k">ผู้รับผิดชอบ</span><span class="v">${escapeHtml(it["ผู้รับผิดชอบ"] || "-")}</span></div>
                <div class="item-row"><span class="k">ไฟล์แนบ</span><span class="v">${it["ไฟล์แนบ"] ? `<a class="attach-link" href="${escapeHtml(it["ไฟล์แนบ"])}" target="_blank" rel="noopener">📎 ดูไฟล์</a>` : '-'}</span></div>
                <div class="item-actions">
                  <button class="icon-btn edit" onclick="startRegEditByIndex(${it._rowIndex})">✏️ แก้ไข</button>
                  <button class="icon-btn delete" onclick="handleRegDelete(${it._rowIndex})">🗑️ ลบ</button>
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      `;
    }).join("");
  }

  renderPagination(regCurrentPage, totalPages);
}

function renderPagination(currentPage, totalPages) {
  const el = document.getElementById("regPagination");
  if (!el) return;
  if (totalPages <= 1) { el.innerHTML = ""; return; }

  function pageBtn(label, page, opts = {}) {
    const disabled = opts.disabled ? 'disabled' : '';
    const active   = opts.active ? 'active' : '';
    const onclick  = opts.disabled ? '' : `onclick="goToRegPage(${page})"`;
    return `<button class="page-btn ${active}" ${disabled} ${onclick}>${label}</button>`;
  }

  const pages = [];
  const windowSize = 1;
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || (p >= currentPage - windowSize && p <= currentPage + windowSize)) {
      pages.push(p);
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...');
    }
  }

  el.innerHTML = `
    <span class="page-info">หน้า ${currentPage} จาก ${totalPages}</span>
    ${pageBtn('«', currentPage - 1, { disabled: currentPage <= 1 })}
    ${pages.map(p => p === '...' ? '<span class="page-ellipsis">…</span>' : pageBtn(p, p, { active: p === currentPage })).join("")}
    ${pageBtn('»', currentPage + 1, { disabled: currentPage >= totalPages })}
  `;
}

function goToRegPage(page) {
  regCurrentPage = page;
  renderRegList();
  document.querySelector('.reg-table-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function setupQuickSearch() {
  const searchInput = document.getElementById('regQuickSearch');
  if (!searchInput) return;
  let searchTimeout;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      regSearchTerm = searchInput.value.trim().toLowerCase();
      regCurrentPage = 1;
      renderRegList();
    }, 300);
  });
}

async function loadRegistrationData() {
  const kpiGrid  = document.getElementById("regKpiGrid");
  const listBody = document.getElementById("regList");
  const cardsEl  = document.getElementById("regCards");
  showLoading(kpiGrid);
  listBody.innerHTML = `<tr><td colspan="14" class="skeleton-row">⏳ กำลังโหลด...</td></tr>`;
  if (cardsEl) cardsEl.innerHTML = `<div class="skeleton-row">⏳ กำลังโหลด...</div>`;
  try {
    regRowsCache = await fetchSheetData(CONFIG.SHEET);
    populateRegFilterOptions(regRowsCache);
    renderMinistryFilter();
    renderRegSummary(regRowsCache);
    renderRegList();
  } catch (err) {
    const errHtml = `<div class="empty-state"><div class="icon">⚠️</div><div>${escapeHtml(err.message)}</div></div>`;
    kpiGrid.innerHTML = `<div class="skeleton-row">❌ ${escapeHtml(err.message)}</div>`;
    document.getElementById("regDonut").innerHTML = "";
    document.getElementById("regMinistryChart").innerHTML = "";
    listBody.innerHTML = `<tr><td colspan="14">${errHtml}</td></tr>`;
    if (cardsEl) cardsEl.innerHTML = errHtml;
  }
}

function populateGroupEditMinistrySelect() {
  const sel = document.getElementById('gf_กระทรวง');
  if (!sel) return;
  sel.innerHTML = `<option value="">-- เลือกกระทรวง --</option>` +
    MINISTRY_OPTIONS.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)} (${MINISTRY_PREFIX[m]})</option>`).join("");
}

function init() {
  renderRegFormFields();
  setupSeqAutoGenerate();
  populateGroupEditMinistrySelect();
  
  document.getElementById("regSaveBtn").addEventListener("click", handleRegSave);
  document.getElementById("regCancelEditBtn").addEventListener("click", resetRegForm);
  document.getElementById("regAddGroupItemBtn").addEventListener("click", addGroupEditRow);
  document.getElementById("regGroupSaveBtn").addEventListener("click", handleGroupSave);
  document.getElementById("regGroupCancelBtn").addEventListener("click", cancelGroupEdit);

  document.getElementById("regClearFilterBtn").addEventListener("click", () => {
    ["regFilterMinistry", "regFilterResult", "regFilterOwner", "regFilterSeq"].forEach(id => document.getElementById(id).value = "");
    document.getElementById("regQuickSearch").value = "";
    Object.keys(regFilterState).forEach(k => regFilterState[k] = "");
    regSearchTerm = "";
    regCurrentPage = 1;
    document.querySelectorAll('#regMinistryFilterContainer .filter-chip').forEach(chip => chip.classList.remove('active'));
    const allChip = document.querySelector('#regMinistryFilterContainer .filter-chip[data-ministry=""]');
    if (allChip) allChip.classList.add('active');
    renderRegList();
  });

  ["regFilterMinistry", "regFilterResult", "regFilterOwner", "regFilterSeq"].forEach(id => {
    document.getElementById(id).addEventListener("change", (e) => {
      const map = { regFilterMinistry: "ministry", regFilterResult: "result", regFilterOwner: "owner", regFilterSeq: "seq" };
      regFilterState[map[id]] = e.target.value;
      document.getElementById("regQuickSearch").value = "";
      regSearchTerm = "";
      regCurrentPage = 1;
      if (id === 'regFilterMinistry') {
        document.querySelectorAll('#regMinistryFilterContainer .filter-chip').forEach(chip => {
          chip.classList.toggle('active', chip.dataset.ministry === e.target.value);
        });
      }
      renderRegList();
    });
  });

  setupQuickSearch();
  document.getElementById("regClearSearchBtn").addEventListener("click", () => {
    document.getElementById("regQuickSearch").value = "";
    regSearchTerm = "";
    regCurrentPage = 1;
    renderRegList();
  });

  document.getElementById("refreshBtn").addEventListener("click", () => {
    loadRegistrationData();
    showToast("🔄 รีเฟรชข้อมูลแล้ว");
  });

  loadRegistrationData();
}

document.addEventListener("DOMContentLoaded", init);
console.log('✅ Registration Laws and Safety - Script loaded successfully!');
