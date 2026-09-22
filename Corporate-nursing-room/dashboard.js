let charts = {};
let cachedDashboardData = null;
let allEmployees = [];
let apiSettingsModal = null;

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
];

document.addEventListener('DOMContentLoaded', () => {
  initYearFilters();
  const monthSelect = document.getElementById('exec-filter-month');
  if (monthSelect) {
    monthSelect.value = new Date().getMonth() + 1;
  }
  
  const modalEl = document.getElementById('apiSettingsModal');
  if (modalEl) {
    apiSettingsModal = new bootstrap.Modal(modalEl);
  }

  checkApiSetup();
});

function checkApiSetup() {
  const banner = document.getElementById('api-status-banner');

  if (!AppApi.isConfigured()) {
    if (banner) banner.style.display = 'flex';
    const errorDiv = document.getElementById('dashboard-error');
    if (errorDiv) {
      errorDiv.style.display = 'block';
      errorDiv.innerHTML = '<i class="fas fa-exclamation-circle me-2"></i>เชื่อมต่อ Google Sheets API ไม่สำเร็จ กรุณาคลิกปุ่ม "ตั้งค่า API" ด้านบนเพื่อระบุ URL';
    }
  } else {
    if (banner) banner.style.display = 'none';
    initDashboard();
  }
}

async function initDashboard(showLoading = true) {
  if (!AppApi.isConfigured()) return;

  if (showLoading) toggleLoader(true);
  
  try {
    const initialData = await AppApi.getInitialData();
    allEmployees = initialData.employees || [];
    populateExecPlantFilter();

    cachedDashboardData = initialData.dashboard || null;

    if (cachedDashboardData) {
      renderDashboard(cachedDashboardData);
      updateTimestamp();
      
      const m = document.getElementById('exec-filter-month')?.value || (new Date().getMonth() + 1);
      const y = document.getElementById('exec-filter-year')?.value || new Date().getFullYear();
      const p = document.getElementById('exec-filter-plant')?.value || 'all';
      updateFilterLabel(m, y, p);
    }
  } catch (error) {
    console.error('Dashboard Load Error:', error);
    const errorDiv = document.getElementById('dashboard-error');
    if (errorDiv) {
      errorDiv.style.display = 'block';
      errorDiv.innerHTML = `<i class="fas fa-exclamation-circle me-2"></i>${error.message}`;
    }
  } finally {
    if (showLoading) toggleLoader(false);
  }
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
          html: 'ระบบหยุดรอโดยอัตโนมัติ<br><small class="text-muted">กรุณาตรวจสอบการเชื่อมต่อ หรือลองรีเฟรชหน้าใหม่</small>'
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

function populateExecPlantFilter() {
  const plantSelect = document.getElementById('exec-filter-plant');
  if (!plantSelect) return;

  const previousValue = plantSelect.value || 'all';
  const plants = Array.from(
    new Set((allEmployees || []).map(e => (e.plant || '').trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, 'th'));

  let opts = '<option value="all">ทั้งหมด (All Plants)</option>';
  plants.forEach(p => {
    opts += `<option value="${p}">${p}</option>`;
  });
  plantSelect.innerHTML = opts;
  if (plants.includes(previousValue) || previousValue === 'all') {
    plantSelect.value = previousValue;
  }
}

function initYearFilters() {
  const yearSelect = document.getElementById('exec-filter-year');
  if (!yearSelect) return;
  
  const currentYear = new Date().getFullYear();
  yearSelect.innerHTML = '';
  
  for (let i = 0; i <= 3; i++) {
    let opt = document.createElement('option');
    opt.value = currentYear - i;
    opt.text = `${currentYear - i} (${currentYear - i + 543})`;
    yearSelect.appendChild(opt);
  }
}

function updateTimestamp() {
  const tsEl = document.getElementById('exec-report-timestamp');
  if (!tsEl) return;
  
  const now = new Date();
  const dateStr = `ข้อมูล ณ วันที่: ${now.getDate()} ${THAI_MONTHS[now.getMonth()]} ${now.getFullYear() + 543}`;
  tsEl.innerText = dateStr;
}

async function applyExecutiveFilters() {
  const monthEl = document.getElementById('exec-filter-month');
  const yearEl = document.getElementById('exec-filter-year');
  const plantEl = document.getElementById('exec-filter-plant');
  
  if (!monthEl || !yearEl || !plantEl) return;

  const month = monthEl.value;
  const year = yearEl.value;
  const plant = plantEl.value;

  toggleLoader(true);
  
  try {
    const data = await AppApi.getDashboardData(month, year, plant);
    cachedDashboardData = data;
    renderDashboard(data);
    updateFilterLabel(month, year, plant);
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'กรองข้อมูลไม่สำเร็จ',
      html: `<small class="text-muted">${error.message}</small>`
    });
  } finally {
    toggleLoader(false);
  }
}

function resetExecutiveFilters() {
  const now = new Date();
  const monthEl = document.getElementById('exec-filter-month');
  const yearEl = document.getElementById('exec-filter-year');
  const plantEl = document.getElementById('exec-filter-plant');

  if (monthEl) monthEl.value = now.getMonth() + 1;
  if (yearEl) yearEl.value = now.getFullYear();
  if (plantEl) plantEl.value = 'all';

  applyExecutiveFilters();
}

function isAllMonthsValue(month) {
  const v = String(month || '').trim().toLowerCase();
  return v === 'all' || v === 'ทั้งหมด';
}

function updateFilterLabel(month, year, plant) {
  const tsEl = document.getElementById('exec-report-timestamp');
  const badgeEl = document.getElementById('trend-period-badge');
  const y = parseInt(year, 10) || new Date().getFullYear();
  const plantLabel = (!plant || plant === 'all' || plant === 'ทั้งหมด') ? 'ทุกโรงงาน/สาขา' : plant;
  const allMonths = isAllMonthsValue(month);

  if (tsEl) {
    if (allMonths) {
      tsEl.innerText = `ข้อมูลทุกเดือนของปี ${y + 543} | Plant: ${plantLabel}`;
    } else {
      const mIdx = (parseInt(month, 10) || 1) - 1;
      tsEl.innerText = `ข้อมูลเดือน ${THAI_MONTHS[mIdx] || ''} ${y + 543} | Plant: ${plantLabel}`;
    }
  }

  if (badgeEl) {
    badgeEl.innerText = allMonths ? 'รายเดือน (ทั้งปี)' : 'รายวัน (เดือนที่เลือก)';
  }
}

function renderDashboard(db) {
  if (!db || !db.summary) return;
  renderKPIs(db);
  renderTrendChart(db);
  renderSymptomChart(db);
  renderDepartmentChart(db);
  renderDrugChart(db);
  renderCategoryChart(db);
  renderReferralStats(db);
  renderAccidentTable(db);
  renderProcurementTable(db);

  const badgeEl = document.getElementById('trend-period-badge');
  if (badgeEl) {
    badgeEl.innerText = db.isAllMonths ? 'รายเดือน (ทั้งปี)' : 'รายวัน (เดือนที่เลือก)';
  }
}

function renderKPIs(db) {
  const summary = db.summary || {};
  const stockHealth = db.stockHealth || {};
  const isAllMonths = !!db.isAllMonths;

  const kpi1Label = document.getElementById('kpi1-label');
  if (kpi1Label) kpi1Label.innerText = isAllMonths ? 'ผู้รับบริการทั้งปี' : 'ผู้รับบริการเดือนนี้';

  const sumMonth = document.getElementById('sum-month');
  if (sumMonth) sumMonth.innerText = (summary.month || 0).toLocaleString();
  
  const sumToday = document.getElementById('sum-today');
  if (sumToday) sumToday.innerText = isAllMonths ? '-' : (summary.today || 0).toLocaleString();

  const momGrowth = document.getElementById('kpi-mom-growth');
  if (momGrowth) {
    const growth = summary.monthGrowth || 0;
    const unitLabel = isAllMonths ? 'YoY' : 'MoM';
    if (summary.prevMonth === 0 && summary.month > 0) {
      momGrowth.className = 'trend-badge trend-up-blue';
      momGrowth.innerHTML = `<i class="fas fa-arrow-up"></i> +100% ${unitLabel} (ช่วงก่อน 0 ราย)`;
    } else if (growth < 0) {
      momGrowth.className = 'trend-badge trend-down-green';
      momGrowth.innerHTML = `<i class="fas fa-arrow-down"></i> ${Math.abs(growth)}% ${unitLabel} (ลดลง)`;
    } else if (growth > 0) {
      momGrowth.className = 'trend-badge trend-up-blue';
      momGrowth.innerHTML = `<i class="fas fa-arrow-up"></i> +${growth}% ${unitLabel}`;
    } else {
      momGrowth.className = 'trend-badge trend-neutral';
      momGrowth.innerHTML = `<i class="fas fa-minus"></i> คงที่ 0% ${unitLabel}`;
    }
  }

  const accidentCount = summary.accidents || 0;
  const sumAccidents = document.getElementById('sum-accidents');
  if (sumAccidents) sumAccidents.innerText = accidentCount.toLocaleString();
  
  const accidentStatus = document.getElementById('kpi-accident-status');
  if (accidentStatus) {
    if (accidentCount === 0) {
      accidentStatus.className = 'badge bg-success-subtle text-success border border-success-subtle';
      accidentStatus.innerHTML = '<i class="fas fa-shield-check me-1"></i>Zero Accident (100%)';
    } else {
      accidentStatus.className = 'badge bg-danger-subtle text-danger border border-danger-subtle';
      accidentStatus.innerHTML = `<i class="fas fa-exclamation-triangle me-1"></i>พบ ${accidentCount} เคส`;
    }
  }

  const totalCost = summary.totalCostMonth || 0;
  const costPerCase = summary.costPerCase || 0;
  
  const sumCost = document.getElementById('sum-cost');
  if (sumCost) sumCost.innerText = `฿${totalCost.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  
  const sumCostPerCase = document.getElementById('sum-cost-per-case');
  if (sumCostPerCase) sumCostPerCase.innerText = `฿${costPerCase.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / ราย`;

  // ✅ ตรวจสอบ readinessRate ป้องกัน 0 || 100 แสดงเป็น 100%
  const sumReadiness = document.getElementById('sum-readiness');
  const readinessValue = stockHealth.readinessRate !== undefined ? stockHealth.readinessRate : 100;
  if (sumReadiness) sumReadiness.innerText = `${readinessValue}%`;
  
  const stockDetail = document.getElementById('stock-detail-summary');
  if (stockDetail) {
    stockDetail.innerText = `พร้อมใช้ ${stockHealth.normalStock || 0} | ใกล้หมด ${stockHealth.lowStock || 0} | หมด ${stockHealth.outOfStock || 0}`;
  }
  
  const stockBadge = document.getElementById('kpi-stock-badge');
  if (stockBadge) {
    if (stockHealth.outOfStock > 0) {
      stockBadge.className = 'badge bg-danger';
      stockBadge.innerText = 'ต้องจัดซื้อด่วน';
    } else if (stockHealth.lowStock > 0) {
      stockBadge.className = 'badge bg-warning text-dark';
      stockBadge.innerText = 'เฝ้าระวัง';
    } else {
      stockBadge.className = 'badge bg-success';
      stockBadge.innerText = 'สมบูรณ์';
    }
  }
}

function renderTrendChart(db) {
  const ctx = document.getElementById('trendChart');
  if (!ctx) return;
  if (charts['trendChart']) charts['trendChart'].destroy();

  const isAllMonths = !!db.isAllMonths;
  let labels, patientData, accidentData, xTicks;

  if (isAllMonths) {
    labels = THAI_MONTHS_SHORT;
    patientData = THAI_MONTHS_SHORT.map((_, i) => (db.trend && db.trend[i + 1]) || 0);
    accidentData = THAI_MONTHS_SHORT.map((_, i) => (db.accidentTrend && db.accidentTrend[i + 1]) || 0);
    xTicks = {};
  } else {
    // คำนวณจำนวนวันตามเดือนและปีที่เลือกจริง (เช่น กุมภาพันธ์ มี 28 หรือ 29 วัน)
    const selectedMonth = parseInt(document.getElementById('exec-filter-month')?.value, 10) || (new Date().getMonth() + 1);
    const selectedYear = parseInt(document.getElementById('exec-filter-year')?.value, 10) || new Date().getFullYear();
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    
    labels = days;
    patientData = days.map(d => (db.trend && db.trend[d]) || 0);
    accidentData = days.map(d => (db.accidentTrend && db.accidentTrend[d]) || 0);
    xTicks = { maxTicksLimit: 10 };
  }

  charts['trendChart'] = new Chart(ctx.getContext('2d'), {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          type: 'line',
          label: 'ผู้รับบริการทั่วไป (ราย)',
          data: patientData,
          borderColor: '#1e3a8a',
          backgroundColor: 'rgba(30, 58, 138, 0.08)',
          fill: true,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 2,
          yAxisID: 'y'
        },
        {
          type: 'bar',
          label: 'อุบัติเหตุในงาน (เคส)',
          data: accidentData,
          backgroundColor: '#dc2626',
          borderRadius: 4,
          maxBarThickness: isAllMonths ? 18 : 10,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      maintainAspectRatio: false,
      scales: {
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          beginAtZero: true,
          grid: { color: '#f1f5f9' },
          ticks: { precision: 0 }
        },
        y1: {
          type: 'linear',
          display: false,
          position: 'right',
          beginAtZero: true,
          grid: { drawOnChartArea: false },
          ticks: { precision: 0 }
        },
        x: {
          grid: { display: false },
          ticks: xTicks
        }
      },
      plugins: {
        legend: {
          position: 'top',
          labels: { boxWidth: 12, usePointStyle: true, font: { size: 11 } }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              let label = context.dataset.label || '';
              if (label) label += ': ';
              if (context.parsed.y !== null) label += context.parsed.y + ' ราย';
              return label;
            }
          }
        }
      }
    }
  });
}

function renderSymptomChart(db) {
  const ctx = document.getElementById('symptomChart');
  if (!ctx) return;
  if (charts['symptomChart']) charts['symptomChart'].destroy();

  const symptomKeys = Object.keys(db.symptoms || {});
  const symptomVals = Object.values(db.symptoms || {});

  charts['symptomChart'] = new Chart(ctx.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: symptomKeys,
      datasets: [{
        data: symptomVals,
        backgroundColor: [
          '#1e3a8a', '#059669', '#d97706', '#dc2626', 
          '#0284c7', '#8b5cf6', '#db2777', '#10b981'
        ],
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      maintainAspectRatio: false,
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { 
            boxWidth: 12, 
            font: { size: 11 },
            padding: 8
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              let label = context.label || '';
              if (label) label += ': ';
              if (context.parsed !== null) label += context.parsed + ' เคส';
              return label;
            }
          }
        }
      }
    }
  });
}

function renderDepartmentChart(db) {
  const ctx = document.getElementById('posChart');
  if (!ctx) return;
  if (charts['posChart']) charts['posChart'].destroy();

  const deptData = db.depts || db.positions || {};
  const deptLabels = Object.keys(deptData);
  const deptValues = Object.values(deptData);

  charts['posChart'] = new Chart(ctx.getContext('2d'), {
    type: 'bar',
    data: {
      labels: deptLabels,
      datasets: [{
        label: 'จำนวนเคส (คน)',
        data: deptValues,
        backgroundColor: '#3b82f6',
        borderRadius: 6,
        maxBarThickness: 32
      }]
    },
    options: {
      maintainAspectRatio: false,
      scales: {
        y: { 
          beginAtZero: true, 
          grid: { color: '#f1f5f9' }, 
          ticks: { precision: 0 } 
        },
        x: { 
          grid: { display: false },
          ticks: { 
            maxRotation: 45,
            minRotation: 0,
            font: { size: 10 }
          }
        }
      },
      plugins: { 
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) {
              return context.parsed.y + ' ราย';
            }
          }
        }
      }
    }
  });
}

function renderDrugChart(db) {
  const ctx = document.getElementById('drugChart');
  if (!ctx) return;
  if (charts['drugChart']) charts['drugChart'].destroy();

  const drugData = db.drugs || {};
  const drugLabels = Object.keys(drugData);
  const drugValues = Object.values(drugData);

  charts['drugChart'] = new Chart(ctx.getContext('2d'), {
    type: 'bar',
    data: {
      labels: drugLabels,
      datasets: [{
        label: 'จำนวนครั้งที่สั่งจ่าย',
        data: drugValues,
        backgroundColor: '#059669',
        borderRadius: 6,
        maxBarThickness: 24
      }]
    },
    options: {
      indexAxis: 'y',
      maintainAspectRatio: false,
      scales: {
        x: { 
          beginAtZero: true, 
          grid: { color: '#f1f5f9' }, 
          ticks: { precision: 0 } 
        },
        y: { 
          grid: { display: false },
          ticks: { 
            font: { size: 10 },
            callback: function(value) {
              const label = this.getLabelForValue(value);
              return label.length > 20 ? label.substring(0, 20) + '...' : label;
            }
          }
        }
      },
      plugins: { 
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) {
              return context.parsed.x + ' ครั้ง';
            }
          }
        }
      }
    }
  });
}

function renderCategoryChart(db) {
  const ctx = document.getElementById('categoryChart');
  if (!ctx) return;
  if (charts['categoryChart']) charts['categoryChart'].destroy();

  const categories = db.symptomCategories || {};
  const order = ['ทั่วไป', 'โรคจากการทำงาน', 'อุบัติเหตุจากการทำงาน'];
  const labels = order;
  const values = order.map(k => categories[k] || 0);

  charts['categoryChart'] = new Chart(ctx.getContext('2d'), {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'จำนวนเคส',
        data: values,
        backgroundColor: ['#0284c7', '#d97706', '#dc2626'],
        borderRadius: 8,
        maxBarThickness: 60
      }]
    },
    options: {
      maintainAspectRatio: false,
      scales: {
        y: { 
          beginAtZero: true, 
          grid: { color: '#f1f5f9' }, 
          ticks: { precision: 0 } 
        },
        x: { grid: { display: false } }
      },
      plugins: { 
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) {
              return context.parsed.y + ' เคส';
            }
          }
        }
      }
    }
  });
}

function renderReferralStats(db) {
  const summary = db.summary || {};
  const rateEl = document.getElementById('referral-rate-value');
  const countEl = document.getElementById('referral-count-value');
  const totalEl = document.getElementById('referral-total-value');

  const referralCount = summary.referralCount || 0;
  const referralRate = summary.referralRate || 0;
  const totalCases = summary.month || 0;

  if (rateEl) rateEl.innerText = `${referralRate}%`;
  if (countEl) countEl.innerText = referralCount.toLocaleString();
  if (totalEl) totalEl.innerText = totalCases.toLocaleString();
}

function renderAccidentTable(db) {
  const tbody = document.getElementById('accident-tbody');
  if (!tbody) return;

  tbody.innerHTML = '';
  const accidents = db.accidentCases || [];

  if (accidents.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-success py-3"><i class="fas fa-shield-alt me-1"></i>ไม่มีรายงานอุบัติเหตุจากการทำงานในช่วงที่เลือก (Zero Accident)</td></tr>';
  } else {
    accidents.forEach(acc => {
      tbody.innerHTML += `<tr>
        <td><span class="badge bg-light text-dark border">${escapeHtml(acc.date)}</span></td>
        <td class="fw-semibold text-danger">${escapeHtml(acc.patient)}</td>
        <td><span class="badge bg-secondary-subtle text-secondary">${escapeHtml(acc.dept)}</span></td>
        <td class="small">${escapeHtml(acc.remarks || acc.symptom)}</td>
      </tr>`;
    });
  }
}

function renderProcurementTable(db) {
  const tbody = document.getElementById('procure-tbody');
  if (!tbody) return;

  tbody.innerHTML = '';
  const procureList = (db.stockHealth && db.stockHealth.urgentProcureList) || [];

  if (procureList.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-success py-3"><i class="fas fa-check-circle me-1"></i>คลังยาและเวชภัณฑ์มีปริมาณเพียงพอทุกรายการ</td></tr>';
  } else {
    procureList.forEach(item => {
      const isOut = item.status === 'หมด';
      const badgeCls = isOut ? 'bg-danger' : 'bg-warning text-dark';
      tbody.innerHTML += `<tr>
        <td class="fw-bold">${escapeHtml(item.id)}</td>
        <td>${escapeHtml(item.name)}</td>
        <td class="text-end fw-bold ${isOut ? 'text-danger' : 'text-warning'}">${item.balance} ${escapeHtml(item.unit || '')}</td>
        <td class="text-center"><span class="badge ${badgeCls}">${escapeHtml(item.status)}</span></td>
      </tr>`;
    });
  }
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* =========================================================================
   API Settings Modal Handlers
   ========================================================================= */
function openApiSettingsModal() {
  const input = document.getElementById('settings-api-url');
  const defaultHint = document.getElementById('settings-default-url-hint');
  if (input) input.value = ApiConfig.getUrl();
  if (defaultHint) defaultHint.innerText = ApiConfig.DEFAULT_URL;
  if (apiSettingsModal) apiSettingsModal.show();
}

async function testApiConnection() {
  const input = document.getElementById('settings-api-url');
  const testUrl = input ? input.value.trim() : '';

  if (!testUrl || !testUrl.startsWith('https://script.google.com/macros/s/')) {
    return Swal.fire('URL ไม่ถูกต้อง', 'URL ต้องขึ้นต้นด้วย https://script.google.com/macros/s/', 'warning');
  }

  toggleLoader(true);
  try {
    const res = await fetch(`${testUrl}?action=ping`, { method: 'GET', redirect: 'follow' });
    const json = await res.json();
    toggleLoader(false);
    if (json && json.success) {
      Swal.fire({
        icon: 'success',
        title: 'เชื่อมต่อสำเร็จ!',
        html: `<p class="mb-1 text-success"><strong>${json.message}</strong></p><small class="text-muted">เวลาเซิร์ฟเวอร์: ${json.timestamp || '-'}</small>`
      });
    } else {
      Swal.fire('เชื่อมต่อไม่สำเร็จ', json?.message || 'ไม่ได้รับข้อความตอบรับที่ถูกต้อง', 'error');
    }
  } catch (err) {
    toggleLoader(false);
    Swal.fire('การเชื่อมต่อล้มเหลว', `ไม่สามารถเรียก API ได้: ${err.message}`, 'error');
  }
}

function resetApiUrlToDefault() {
  const input = document.getElementById('settings-api-url');
  if (input) input.value = ApiConfig.DEFAULT_URL;
  ApiConfig.resetUrl();
  Swal.fire({
    icon: 'info',
    title: 'รีเซ็ตค่าแล้ว',
    text: 'รีเซ็ต URL กลับเป็นค่าเริ่มต้นเรียบร้อยแล้ว กด "บันทึก URL" เพื่อนำไปใช้',
    timer: 2000,
    showConfirmButton: false
  });
}

function saveApiSettings() {
  const input = document.getElementById('settings-api-url');
  const url = input ? input.value.trim() : '';

  if (!url || !url.startsWith('https://script.google.com/macros/s/')) {
    return Swal.fire('URL ไม่ถูกต้อง', 'กรุณาระบุ Google Apps Script Web App URL ที่ถูกต้อง', 'warning');
  }

  ApiConfig.setUrl(url);
  if (apiSettingsModal) apiSettingsModal.hide();

  Swal.fire({
    icon: 'success',
    title: 'บันทึก URL เรียบร้อย',
    text: 'ระบบจะเริ่มโหลดข้อมูลจาก Google Sheets ใหม่ทันที',
    timer: 1500,
    showConfirmButton: false
  }).then(() => {
    location.reload();
  });
}

window.applyExecutiveFilters = applyExecutiveFilters;
window.resetExecutiveFilters = resetExecutiveFilters;
window.openApiSettingsModal = openApiSettingsModal;
window.testApiConnection = testApiConnection;
window.resetApiUrlToDefault = resetApiUrlToDefault;
window.saveApiSettings = saveApiSettings;