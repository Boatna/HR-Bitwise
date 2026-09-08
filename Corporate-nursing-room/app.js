let allNurses = [], allDrugs = [], allEmployees = [];
let exportModal, historyModal, newEmployeeModal;
let currentExportType = '';

document.addEventListener('DOMContentLoaded', () => {
  exportModal = new bootstrap.Modal(document.getElementById('exportModal'));
  historyModal = new bootstrap.Modal(document.getElementById('historyModal'));
  newEmployeeModal = new bootstrap.Modal(document.getElementById('newEmployeeModal'));
  updateTimestampBadge();

  const yearSelect = document.getElementById('export-year');
  if (yearSelect) {
    const currentYear = new Date().getFullYear();
    yearSelect.innerHTML = '';
    for (let i = 0; i <= 3; i++) {
      let opt = document.createElement('option');
      opt.value = currentYear - i;
      opt.text = `${currentYear - i} (${currentYear - i + 543})`;
      yearSelect.appendChild(opt);
    }
  }

  const monthSelect = document.getElementById('export-month');
  if (monthSelect) {
    monthSelect.value = new Date().getMonth() + 1;
  }

  const searchInput = document.getElementById('search-keyword');
  if (searchInput) {
    searchInput.addEventListener('input', handleSearchInput);
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        searchEmployee();
      }
    });
  }

  ['1', '2'].forEach(i => {
    const qtyEl = document.getElementById(`outbound-qty-${i}`);
    if (qtyEl) {
      qtyEl.addEventListener('input', () => calculateOutboundTotal(i));
      qtyEl.addEventListener('change', () => calculateOutboundTotal(i));
    }
    const drugEl = document.getElementById(`outbound-drug-${i}`);
    if (drugEl) drugEl.addEventListener('change', () => updateDrugInfo(i));
  });

  const inbQtyEl = document.getElementById('inbound-qty');
  if (inbQtyEl) {
    inbQtyEl.addEventListener('input', calculateInboundTotal);
  }

  document.addEventListener('click', e => {
    if (!e.target.closest('#search-keyword') && !e.target.closest('#suggestion-box')) {
      const box = document.getElementById('suggestion-box');
      if (box) box.style.display = 'none';
    }
  });

  checkApiSetup();
});

function updateTimestampBadge() {
  const tsEl = document.getElementById('report-timestamp');
  const now = new Date();
  const thaiMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  const dateStr = `ข้อมูล ณ วันที่: ${now.getDate()} ${thaiMonths[now.getMonth()]} ${now.getFullYear() + 543}`;
  if (tsEl) tsEl.innerText = dateStr;
}

function checkApiSetup() {
  const banner = document.getElementById('api-status-banner');

  if (!AppApi.isConfigured()) {
    if (banner) {
      banner.style.display = 'flex';
      banner.innerHTML = `
        <div>
          <i class="fas fa-exclamation-triangle text-warning me-2"></i>
          <strong>เชื่อมต่อ Google Sheets API ไม่สำเร็จ:</strong> กรุณาตรวจสอบ URL ใน api.js (ApiConfig.DEFAULT_URL) หรือติดต่อผู้ดูแลระบบ
        </div>
      `;
    }
  } else {
    if (banner) banner.style.display = 'none';
    initSystem();
  }
}

function showPage(id) {
  document.querySelectorAll('.page-section').forEach(el => el.style.display = 'none');
  const target = document.getElementById(id + '-page');
  if (target) {
    target.style.display = 'block';
  }

  if (id === 'home') initSystem(false);
  if (id === 'attendance') searchAttendance();
  if (id === 'inventory') loadInventory();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

let loaderWatchdogTimer = null;
let loaderHintTimer = null;
function toggleLoader(show) {
  const loader = document.getElementById('loader');
  const hint = document.getElementById('loader-hint');
  const closeBtn = document.getElementById('loader-close-btn');
  if (!loader) return;

  clearTimeout(loaderWatchdogTimer);
  clearTimeout(loaderHintTimer);

  if (show) {
    loader.style.display = 'flex';
    if (hint) hint.style.display = 'none';
    if (closeBtn) closeBtn.style.display = 'none';

    loaderHintTimer = setTimeout(() => {
      if (hint) hint.style.display = 'block';
      if (closeBtn) closeBtn.style.display = 'inline-block';
    }, 8000);

    loaderWatchdogTimer = setTimeout(() => {
      forceHideLoader();
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'warning',
          title: 'ใช้เวลานานผิดปกติ',
          html: 'ระบบหยุดรอโดยอัตโนมัติ<br><small class="text-muted">หากกดบันทึกไปแล้ว กรุณาตรวจสอบข้อมูลใน Google Sheet ก่อนบันทึกซ้ำ หรือลองรีเฟรชหน้าใหม่</small>'
        });
      }
    }, 50000);
  } else {
    loader.style.display = 'none';
    if (hint) hint.style.display = 'none';
    if (closeBtn) closeBtn.style.display = 'none';
  }
}

function forceHideLoader() {
  const loader = document.getElementById('loader');
  const hint = document.getElementById('loader-hint');
  const closeBtn = document.getElementById('loader-close-btn');
  if (loader) loader.style.display = 'none';
  if (hint) hint.style.display = 'none';
  if (closeBtn) closeBtn.style.display = 'none';
  clearTimeout(loaderWatchdogTimer);
  clearTimeout(loaderHintTimer);
}
window.forceHideLoader = forceHideLoader;

async function initSystem(showLoading = true) {
  if (!AppApi.isConfigured()) return;

  if (showLoading) toggleLoader(true);
  try {
    const data = await AppApi.getInitialData();

    allNurses = data.nurses || [];
    allDrugs = data.drugs || [];
    allEmployees = data.employees || [];
    let nOpts = '<option value="" disabled selected>-- เลือกพยาบาล --</option>';
    allNurses.forEach(n => {
      nOpts += `<option value="${n.id}">${n.name}</option>`;
    });
    ['attend', 'outbound', 'inbound'].forEach(p => {
      const el = document.getElementById(p + '-nurse-select');
      if (el) el.innerHTML = nOpts;
    });

    allDrugs.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    let dOpts = '<option value="" disabled selected>-- เลือกยา --</option>';
    let dOptsOpt = '<option value="">- ไม่จ่ายยา -</option>';
    allDrugs.forEach(d => {
      let o = `<option value="${d.id}">${d.name}</option>`;
      dOpts += o;
      dOptsOpt += o;
    });

    const inbDrug = document.getElementById('inbound-drug');
    if (inbDrug) inbDrug.innerHTML = dOpts;
    const outDrug1 = document.getElementById('outbound-drug-1');
    if (outDrug1) outDrug1.innerHTML = dOptsOpt;
    const outDrug2 = document.getElementById('outbound-drug-2');
    if (outDrug2) outDrug2.innerHTML = dOptsOpt;

    let sOpts = '<option value="" disabled selected>-- เลือกอาการ --</option>';
    (data.symptomList || []).forEach(s => {
      sOpts += `<option value="${s}">${s}</option>`;
    });
    const symEl = document.getElementById('pat-symptom-select');
    if (symEl) symEl.innerHTML = sOpts;

    if (data.dashboard) {
      renderHomeSummary(data.dashboard);
    }
  } catch (err) {
    console.error("initSystem Error:", err);
    Swal.fire({
      icon: 'error',
      title: 'โหลดข้อมูลไม่สำเร็จ',
      html: `โปรดตรวจสอบการเชื่อมต่อ Google Sheets Web App<br><small class="text-muted">${err.message}</small>`
    });
  } finally {
    if (showLoading) toggleLoader(false);
  }
}

function renderHomeSummary(db) {
  if (!db || !db.summary) return;

  const homeSumToday = document.getElementById('home-sum-today');
  const homeSumCases = document.getElementById('home-sum-cases');
  const homeSumStock = document.getElementById('home-sum-stock');

  if (homeSumToday) homeSumToday.innerText = `${(db.summary.today || 0).toLocaleString()} ราย`;
  if (homeSumCases) homeSumCases.innerText = `${(db.summary.month || 0).toLocaleString()} เคส`;

  if (homeSumStock) {
    const outCount = (db.stockHealth && db.stockHealth.outOfStock) || 0;
    const lowCount = (db.stockHealth && db.stockHealth.lowStock) || 0;
    if (outCount > 0) {
      homeSumStock.className = 'fw-bold mb-0 text-danger';
      homeSumStock.innerText = `ยาขาด ${outCount} รายการ`;
    } else if (lowCount > 0) {
      homeSumStock.className = 'fw-bold mb-0 text-warning';
      homeSumStock.innerText = `ใกล้หมด ${lowCount} รายการ`;
    } else {
      homeSumStock.className = 'fw-bold mb-0 text-success';
      homeSumStock.innerText = 'คลังยาพร้อมจ่ายปกติ';
    }
  }

  const tb = document.getElementById('recent-tbody');
  if (tb) {
    tb.innerHTML = '';
    if (!db.recent || !db.recent.length) {
      tb.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">ไม่มีข้อมูลบันทึกในเดือนนี้</td></tr>';
    } else {
      db.recent.forEach(r => {
        let drugDisplay = r.drug && r.drug !== '-'
          ? `<span class="text-primary small"><i class="fas fa-pills me-1"></i>${r.drug}</span>`
          : '<span class="text-muted">-</span>';
        tb.innerHTML += `<tr>
          <td>${r.date}</td>
          <td>${r.time}</td>
          <td class="fw-bold text-truncate" style="max-width:140px;">${r.patient}</td>
          <td><span class="badge bg-light text-dark border">${r.dept}</span></td>
          <td class="text-truncate" style="max-width:140px;">${r.symptom}</td>
          <td>${drugDisplay}</td>
        </tr>`;
      });
    }
  }
}

function handleSearchInput(e) {
  const val = e.target.value.toLowerCase().trim();
  const box = document.getElementById('suggestion-box');
  const patIdEl = document.getElementById('pat-id');
  if (patIdEl && patIdEl.value) {
    patIdEl.value = '';
    document.getElementById('pat-pos').value = '';
    document.getElementById('pat-plant').value = '';
    document.getElementById('pat-display-id').innerText = '-';
    document.getElementById('pat-name').innerText = '-';
    document.getElementById('pat-dept').innerText = '-';
  }

  if (!box) return;

  box.innerHTML = '';
  if (val.length < 1) {
    box.style.display = 'none';
    return;
  }

  const matches = allEmployees.filter(emp =>
    String(emp.id).toLowerCase().includes(val) ||
    String(emp.name).toLowerCase().includes(val)
  ).slice(0, 6);

  if (matches.length > 0) {
    matches.forEach(m => {
      const item = document.createElement('a');
      item.className = 'list-group-item list-group-item-action';
      item.innerHTML = `<strong>${m.id}</strong> - ${m.name} <small class="text-muted">(${m.dept || 'ไม่ระบุแผนก'})</small>`;
      item.onclick = () => {
        selectEmployee(m);
        box.style.display = 'none';
      };
      box.appendChild(item);
    });
    box.style.display = 'block';
  } else {
    const notFoundItem = document.createElement('div');
    notFoundItem.className = 'list-group-item p-3 text-center bg-light';
    notFoundItem.innerHTML = `
      <div class="text-muted small mb-2"><i class="fas fa-user-slash me-1 text-danger"></i>ไม่พบข้อมูล "${val}" ในระบบ</div>
      <button type="button" class="btn btn-sm btn-success fw-bold px-3" onclick="openNewEmployeeModal('${val}')">
        <i class="fas fa-user-plus me-1"></i>เพิ่มข้อมูลพนักงานใหม่
      </button>
    `;
    box.appendChild(notFoundItem);
    box.style.display = 'block';
  }
}

function selectEmployee(m) {
  document.getElementById('pat-display-id').innerText = m.id || '-';
  document.getElementById('pat-name').innerText = m.name;
  document.getElementById('pat-dept').innerText = m.dept || '-';
  document.getElementById('pat-id').value = m.id;
  document.getElementById('pat-pos').value = m.position || '';
  document.getElementById('pat-plant').value = m.plant || '';
  document.getElementById('search-keyword').value = `${m.id} - ${m.name}`;
}

function searchEmployee() {
  const kw = document.getElementById('search-keyword').value.trim().toLowerCase();
  if (!kw) return;

  const found = allEmployees.find(e =>
    String(e.id).toLowerCase() === kw ||
    String(e.name).toLowerCase().includes(kw)
  );

  if (found) {
    selectEmployee(found);
    const box = document.getElementById('suggestion-box');
    if (box) box.style.display = 'none';
  } else {
    Swal.fire({
      title: 'ไม่พบข้อมูลพนักงาน',
      text: `ไม่พบ "${kw}" ในฐานข้อมูล ต้องการเพิ่มข้อมูลพนักงานใหม่หรือไม่?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: '<i class="fas fa-user-plus me-1"></i>เพิ่มพนักงานใหม่',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#198754'
    }).then(result => {
      if (result.isConfirmed) {
        openNewEmployeeModal(kw);
      }
    });
  }
}

function openNewEmployeeModal(defaultVal = '') {
  const box = document.getElementById('suggestion-box');
  if (box) box.style.display = 'none';

  document.getElementById('newEmployeeForm').reset();
  if (defaultVal) {
    const isNum = /^[0-9A-Za-z-_]+$/.test(defaultVal);
    if (isNum) {
      document.getElementById('new-emp-id').value = defaultVal;
    } else {
      document.getElementById('new-emp-name').value = defaultVal;
    }
  }

  newEmployeeModal.show();
}

async function submitNewEmployee() {
  const id = document.getElementById('new-emp-id').value.trim();
  const name = document.getElementById('new-emp-name').value.trim();
  const dept = document.getElementById('new-emp-dept').value.trim();
  const position = document.getElementById('new-emp-pos').value.trim();
  const plant = document.getElementById('new-emp-plant').value.trim();

  if (!id || !name) {
    return Swal.fire('ข้อมูลไม่ครบถ้วน', 'กรุณาระบุรหัสพนักงานและชื่อ-นามสกุล', 'warning');
  }

  const empData = { id, name, dept, position, plant };

  toggleLoader(true);
  try {
    const res = await AppApi.saveEmployee(empData);
    toggleLoader(false);
    if (res.success) {
      newEmployeeModal.hide();
      allEmployees.push(res.employee || empData);
      selectEmployee(res.employee || empData);

      await Swal.fire({
        icon: 'success',
        title: 'บันทึกพนักงานใหม่สำเร็จ',
        text: `เลือกพนักงาน "${name}" เข้าสู่ฟอร์มเรียบร้อยแล้ว`,
        timer: 1800,
        showConfirmButton: false
      });
    } else {
      Swal.fire('ไม่สามารถบันทึกได้', res.message, 'error');
    }
  } catch (err) {
    toggleLoader(false);
    Swal.fire('เกิดข้อผิดพลาด', String(err.message || err), 'error');
  } finally {
    toggleLoader(false);
  }
}

function parseMoney(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const n = parseFloat(String(value || '').replace(/[,฿]/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

function formatBaht(value) {
  return `฿${parseMoney(value).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function calculateOutboundTotal(suffix) {
  const qtyEl = document.getElementById(`outbound-qty-${suffix}`);
  const priceEl = document.getElementById(`outbound-price-${suffix}`);
  const totalEl = document.getElementById(`outbound-total-${suffix}`);
  const displayEl = document.getElementById(`outbound-price-display-${suffix}`);
  if (!qtyEl || !priceEl || !totalEl) return 0;

  const qty = Math.max(0, parseMoney(qtyEl.value));
  const price = Math.max(0, parseMoney(priceEl.value));
  const total = qty * price;
  if (displayEl) displayEl.value = price > 0 ? formatBaht(price) : '';
  totalEl.value = total > 0 ? total.toFixed(2) : '';
  calculateGrandTotal();
  return total;
}

function calculateGrandTotal() {
  let grandTotal = 0;
  ['1', '2'].forEach(i => {
    const totalEl = document.getElementById(`outbound-total-${i}`);
    grandTotal += parseMoney(totalEl && totalEl.value);
  });
  const grandTotalEl = document.getElementById('outbound-grand-total');
  if (grandTotalEl) grandTotalEl.innerText = formatBaht(grandTotal);
  return grandTotal;
}

function calculateInboundTotal() {
  const qtyEl = document.getElementById('inbound-qty');
  const priceEl = document.getElementById('inbound-price');
  const totalEl = document.getElementById('inbound-total');
  if (!qtyEl || !priceEl || !totalEl) return 0;
  const qty = Math.max(0, parseMoney(qtyEl.value));
  const price = Math.max(0, parseMoney(priceEl.value));
  const total = qty * price;
  totalEl.value = total > 0 ? total.toFixed(2) : '';
  return total;
}

function updateDrugInfo(suffix) {
  const isInbound = suffix === 'inbound';
  const selectId = isInbound ? 'inbound-drug' : `outbound-drug-${suffix}`;
  const drugId = document.getElementById(selectId)?.value || '';
  const drug = allDrugs.find(d => String(d.id) === String(drugId));

  if (isInbound) {
    const unitEl = document.getElementById('inbound-unit');
    const nameEl = document.getElementById('inbound-drugName');
    const priceEl = document.getElementById('inbound-price');
    const idHidden = document.getElementById('inbound-drugId');
    if (drug) {
      unitEl.value = drug.unit || '';
      nameEl.value = drug.name || '';
      priceEl.value = parseMoney(drug.price).toFixed(2);
      idHidden.value = drug.id;
    } else {
      unitEl.value = ''; nameEl.value = ''; priceEl.value = ''; idHidden.value = '';
    }
    calculateInboundTotal();
    return;
  }

  const unitEl = document.getElementById(`outbound-unit-${suffix}`);
  const nameEl = document.getElementById(`outbound-drugName-${suffix}`);
  const priceEl = document.getElementById(`outbound-price-${suffix}`);
  const priceDisplayEl = document.getElementById(`outbound-price-display-${suffix}`);
  if (drug) {
    unitEl.value = drug.unit || '';
    nameEl.value = drug.name || '';
    priceEl.value = parseMoney(drug.price).toFixed(2);
    priceDisplayEl.value = formatBaht(drug.price);
  } else {
    unitEl.value = ''; nameEl.value = ''; priceEl.value = ''; priceDisplayEl.value = '';
  }
  calculateOutboundTotal(suffix);
  preventDuplicateDrugSelection();
}

function preventDuplicateDrugSelection() {
  const s1 = document.getElementById('outbound-drug-1');
  const s2 = document.getElementById('outbound-drug-2');
  if (!s1 || !s2) return;
  const v1 = s1.value;
  const v2 = s2.value;
  Array.from(s1.options).forEach(o => o.disabled = Boolean(v2 && o.value === v2 && o.value !== v1));
  Array.from(s2.options).forEach(o => o.disabled = Boolean(v1 && o.value === v1 && o.value !== v2));
}

async function submitOutbound() {
  const submitBtn = document.querySelector('#outboundForm button[onclick="submitOutbound()"]');
  if (submitBtn?.disabled) return;
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.dataset.originalHtml = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>กำลังบันทึก...';
  }

  const nurseId = document.getElementById('outbound-nurse-select').value;
  const restoreSubmitButton = () => { if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = submitBtn.dataset.originalHtml || 'บันทึกการรักษา'; } };
  const patId = document.getElementById('pat-id').value;
  const symptom = document.getElementById('pat-symptom-select').value;

  if (!nurseId || !patId || !symptom) {
    restoreSubmitButton();
    return Swal.fire('ข้อมูลไม่ครบถ้วน', 'กรุณาระบุ พยาบาล, ค้นหาผู้ป่วย และเลือกอาการให้ครบถ้วน', 'warning');
  }

  let items = [];
  ['1', '2'].forEach(i => {
    const d = document.getElementById(`outbound-drug-${i}`).value;
    const q = parseFloat(document.getElementById(`outbound-qty-${i}`).value);
    if (d && q > 0) {
      items.push({
        drugId: d,
        drugName: document.getElementById(`outbound-drugName-${i}`).value,
        quantity: q,
        unit: document.getElementById(`outbound-unit-${i}`).value,
        price: document.getElementById(`outbound-price-${i}`).value
      });
    }
  });

  if (items.length === 0) {
    restoreSubmitButton();
    return Swal.fire('ไม่พบรายการยา', 'กรุณาเลือกยาและระบุจำนวนอย่างน้อย 1 รายการ', 'warning');
  }

  if (items.length > 1 && String(items[0].drugId) === String(items[1].drugId)) {
    restoreSubmitButton();
    return Swal.fire('เลือกยาซ้ำ', 'กรุณาเลือกรายการยาตัวที่ 1 และตัวที่ 2 ให้แตกต่างกัน', 'warning');
  }

  items = items.map(item => {
    const master = allDrugs.find(d => String(d.id) === String(item.drugId));
    const price = master ? parseMoney(master.price) : parseMoney(item.price);
    return { ...item, drugName: master?.name || item.drugName, unit: master?.unit || item.unit, price: price.toFixed(2), total: Number(item.quantity) * price };
  });

  const nurse = allNurses.find(n => n.id == nurseId);
  const referralEl = document.getElementById('pat-referral');
  const isReferred = referralEl ? referralEl.value === 'yes' : false;
  const form = {
    nurseId: nurse ? nurse.id : nurseId,
    nurseName: nurse ? nurse.name : '',
    patientId: patId,
    patientName: document.getElementById('pat-name').innerText,
    dept: document.getElementById('pat-dept').innerText,
    position: document.getElementById('pat-pos').value,
    plant: document.getElementById('pat-plant').value,
    symptom: symptom,
    remarks: document.getElementById('pat-remarks').value,
    referral: isReferred,
    items: items
  };

  toggleLoader(true);
  try {
    const res = await AppApi.saveOutbound(form);
    toggleLoader(false);
    if (res.success) {
      await Swal.fire({
        icon: 'success',
        title: 'บันทึกสำเร็จ',
        text: res.message,
        timer: 1600,
        showConfirmButton: false
      });
      document.getElementById('outboundForm').reset();
      document.getElementById('pat-display-id').innerText = '-';
      document.getElementById('pat-name').innerText = '-';
      document.getElementById('pat-dept').innerText = '-';
      document.getElementById('pat-id').value = '';
      ['1', '2'].forEach(i => {
        document.getElementById(`outbound-qty-${i}`).value = '';
        document.getElementById(`outbound-total-${i}`).value = '';
        document.getElementById(`outbound-price-display-${i}`).value = '';
        document.getElementById(`outbound-price-${i}`).value = '';
        document.getElementById(`outbound-unit-${i}`).value = '';
        document.getElementById(`outbound-drugName-${i}`).value = '';
      });
      document.getElementById('outbound-grand-total').innerText = '฿0.00';
      showPage('home');
    } else {
      Swal.fire({ icon: 'error', title: 'แจ้งเตือน', text: res.message });
    }
  } catch (err) {
    toggleLoader(false);
    Swal.fire('เกิดข้อผิดพลาด', String(err.message || err), 'error');
  } finally {
    toggleLoader(false);
    restoreSubmitButton();
  }
}

async function submitInbound() {
  const submitBtn = document.querySelector('#inboundForm button[onclick="submitInbound()"]');
  if (submitBtn?.disabled) return;
  const dId = document.getElementById('inbound-drug').value;
  const qty = parseFloat(document.getElementById('inbound-qty').value);
  const nurseId = document.getElementById('inbound-nurse-select').value;

  if (!dId || !(qty > 0) || !nurseId) {
    return Swal.fire('ข้อมูลไม่ครบถ้วน', 'กรุณาระบุ ยา, จำนวนที่มากกว่า 0 และพยาบาลผู้รับเข้า', 'warning');
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.dataset.originalHtml = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>กำลังบันทึก...';
  }
  const restoreInboundBtn = () => { if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = submitBtn.dataset.originalHtml || 'ยืนยันรับยาเข้าคลัง'; } };

  const nurse = allNurses.find(x => x.id == nurseId);
  let drugName = document.getElementById('inbound-drugName').value;

  if (!drugName) {
    const drug = allDrugs.find(d => String(d.id) === String(dId));
    if (drug) drugName = drug.name;
  }

  const form = {
    nurseId: nurse ? nurse.id : nurseId,
    nurseName: nurse ? nurse.name : '',
    drugId: dId,
    drugName: drugName,
    quantity: qty,
    unit: document.getElementById('inbound-unit').value,
    price: document.getElementById('inbound-price').value || 0,
    prodDate: document.getElementById('inbound-prodDate').value,
    expireDate: document.getElementById('inbound-expDate').value
  };

  toggleLoader(true);
  try {
    const res = await AppApi.saveInbound(form);
    toggleLoader(false);
    if (res.success) {
      await Swal.fire('สำเร็จ', res.message, 'success');
      document.getElementById('inboundForm').reset();
      document.getElementById('inbound-total').value = '';
      showPage('inventory');
    } else {
      Swal.fire('เกิดข้อผิดพลาด', res.message, 'error');
    }
  } catch (err) {
    toggleLoader(false);
    Swal.fire('เกิดข้อผิดพลาด', String(err.message || err), 'error');
  } finally {
    toggleLoader(false);
    restoreInboundBtn();
  }
}

let isSubmittingAttendance = false;
async function submitAttendance(status) {
  if (isSubmittingAttendance) return;
  const id = document.getElementById('attend-nurse-select').value;
  if (!id) return Swal.fire('เตือน', 'กรุณาเลือกรายชื่อพยาบาลก่อน', 'warning');

  const n = allNurses.find(x => x.id == id);
  isSubmittingAttendance = true;
  toggleLoader(true);
  try {
    const res = await AppApi.saveTimeAttendance(n ? n.id : id, n ? n.name : '', status);
    toggleLoader(false);
    const msg = res.message || res;
    Swal.fire({
      icon: 'success',
      title: 'สำเร็จ',
      text: msg,
      timer: 1500,
      showConfirmButton: false
    });
    searchAttendance();
  } catch (err) {
    toggleLoader(false);
    Swal.fire('เกิดข้อผิดพลาด', String(err.message || err), 'error');
  } finally {
    toggleLoader(false);
    isSubmittingAttendance = false;
  }
}

async function searchAttendance() {
  const tb = document.getElementById('attend-tbody');
  if (!tb) return;
  tb.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-3">กำลังโหลดข้อมูล...</td></tr>';

  try {
    const data = await AppApi.getAttendanceHistory("");
    tb.innerHTML = '';
    if (!data || !data.length) {
      tb.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-3">ไม่พบข้อมูลประวัติการลงเวลา</td></tr>';
    } else {
      data.forEach(r => {
        const cls = r.status === 'เข้าเวร' ? 'bg-success' : 'bg-danger';
        tb.innerHTML += `<tr>
          <td>${r.date}</td>
          <td>${r.time}</td>
          <td>${r.name}</td>
          <td><span class="badge ${cls}">${r.status}</span></td>
        </tr>`;
      });
    }
  } catch (err) {
    tb.innerHTML = `<tr><td colspan="4" class="text-center text-danger py-3">โหลดข้อมูลไม่สำเร็จ: ${err.message}</td></tr>`;
  }
}

async function loadInventory() {
  toggleLoader(true);
  try {
    const data = await AppApi.getInventoryData();
    renderInvTable(data);
  } catch (err) {
    Swal.fire('เกิดข้อผิดพลาด', String(err.message || err), 'error');
  } finally {
    toggleLoader(false);
  }
}

function renderInvTable(data) {
  const tbody = document.querySelector('#inv-table tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">ไม่มีข้อมูลในคลังยา</td></tr>';
    return;
  }

  data.forEach(r => {
    const b = parseFloat(r[3]) || 0;
    const badge = b <= 0
      ? '<span class="badge bg-danger">หมด</span>'
      : (b < 10
        ? '<span class="badge bg-warning text-dark">ใกล้หมด</span>'
        : '<span class="badge bg-success">ปกติ</span>');
    const cls = b <= 0 ? 'table-danger' : (b < 10 ? 'table-warning' : '');

    tbody.innerHTML += `<tr class="${cls}">
      <td><span class="fw-bold text-primary">${r[0]}</span></td>
      <td class="fw-bold">${r[1]}</td>
      <td>${r[2]}</td>
      <td class="text-end fw-bold fs-6">${b}</td>
      <td class="text-center">${badge}</td>
      <td class="text-center">
        <button class="btn btn-sm btn-outline-info" onclick="viewHistory('${r[0]}', '${r[1]}')" title="ดูประวัติ">
          <i class="fas fa-list-alt me-1"></i>ประวัติ
        </button>
      </td>
    </tr>`;
  });
}

function filterInventory() {
  const input = document.getElementById("inv-search").value.toUpperCase().trim();
  const rows = document.querySelectorAll("#inv-table tbody tr");
  rows.forEach(tr => {
    const tdId = tr.cells[0];
    const tdName = tr.cells[1];
    if (tdId && tdName) {
      const text = (tdId.textContent + " " + tdName.textContent).toUpperCase();
      tr.style.display = text.includes(input) ? "" : "none";
    }
  });
}

async function viewHistory(id, name) {
  document.getElementById('hist-drug-name').innerText = `ยา: ${name} (รหัส: ${id})`;
  const tb = document.getElementById('hist-tbody');
  tb.innerHTML = '<tr><td colspan="5" class="text-center py-3">กำลังโหลดประวัติ...</td></tr>';
  historyModal.show();

  try {
    const history = await AppApi.getDrugHistory(id);
    tb.innerHTML = '';
    if (!history || !history.length) {
      tb.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-3">ไม่พบประวัติการเคลื่อนไหว</td></tr>';
    } else {
      history.forEach(x => {
        const color = x.type === 'รับเข้า' ? 'text-success' : 'text-danger';
        const sign = x.qty > 0 ? '+' : '';
        tb.innerHTML += `<tr>
          <td>${x.date}</td>
          <td><span class="${color} fw-bold">${x.type}</span></td>
          <td class="text-end fw-bold ${color}">${sign}${x.qty}</td>
          <td>${x.by}</td>
          <td class="small text-muted">${x.note}</td>
        </tr>`;
      });
    }
  } catch (err) {
    tb.innerHTML = `<tr><td colspan="5" class="text-center text-danger py-3">โหลดประวัติไม่สำเร็จ: ${err.message}</td></tr>`;
  }
}

function showExportModal(type) {
  currentExportType = type;
  exportModal.show();
}

async function executeExport() {
  const m = document.getElementById('export-month').value;
  const y = document.getElementById('export-year').value;

  toggleLoader(true);
  exportModal.hide();

  try {
    const res = await AppApi.exportData(currentExportType, parseInt(m, 10), parseInt(y, 10));
    toggleLoader(false);

    if (res.success && res.base64) {
      downloadBase64File(res.base64, res.fileName || `Export_${m}_${y}.xlsx`);
      Swal.fire({
        icon: 'success',
        title: 'ดาวน์โหลดสำเร็จ',
        text: res.message,
        timer: 1800,
        showConfirmButton: false
      });
    } else if (res.success && res.url) {
      Swal.fire({
        icon: 'success',
        title: 'Export สำเร็จ',
        text: res.message,
        html: `<p>${res.message}</p><a href="${res.url}" target="_blank" class="btn btn-primary mt-2"><i class="fas fa-download me-2"></i>Download Excel File</a>`
      });
    } else {
      Swal.fire('ไม่พบข้อมูล', res.message || 'ไม่มีข้อมูลในเดือนที่เลือก', 'warning');
    }
  } catch (err) {
    toggleLoader(false);
    Swal.fire('เกิดข้อผิดพลาด', String(err.message || err), 'error');
  } finally {
    toggleLoader(false);
  }
}

function downloadBase64File(base64Data, fileName) {
  const mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  try {
    const byteChars = atob(base64Data);
    const byteNumbers = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteNumbers[i] = byteChars.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });
    if (window.navigator && window.navigator.msSaveOrOpenBlob) {
      window.navigator.msSaveOrOpenBlob(blob, fileName);
      return;
    }

    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    link.rel = 'noopener';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
  } catch (err) {
    console.error('downloadBase64File Error:', err);
    Swal.fire({
      icon: 'error',
      title: 'ดาวน์โหลดไฟล์ไม่สำเร็จ',
      html: `เบราว์เซอร์หรือแอปที่เปิดอยู่นี้อาจไม่รองรับการดาวน์โหลดไฟล์อัตโนมัติ<br>
             กรุณาลองเปิดด้วย <strong>Chrome</strong> หรือ <strong>Safari</strong> โดยตรง
             (ไม่ใช่เปิดผ่านแอป LINE หรือ Facebook)`
    });
  }
}