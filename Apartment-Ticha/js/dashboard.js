async function loadDashboard() {
  const loadingEl = document.getElementById('loading-indicator');
  const contentEl = document.getElementById('dashboard-content');
  const errorEl = document.getElementById('dashboard-error');

  loadingEl?.classList.remove('d-none');
  contentEl?.classList.add('d-none');
  errorEl?.classList.add('d-none');

  try {
    const data = await API.getDashboardData();
    renderKPIs(data.kpi);
    renderCharts(data.charts || {});
    renderBuildingOccupancy(data.buildingStats);
    renderAlmostFullRooms(data.almostFullRooms);
    renderParking(data.parkingStats);
    contentEl?.classList.remove('d-none');
  } catch (error) {
    console.error('Error loading dashboard:', error);
    // แสดงข้อผิดพลาดในกล่องแยก (ไม่เขียนทับ dashboard-content ไม่งั้นกราฟ/KPI จะหายถาวร)
    if (errorEl) {
      errorEl.classList.remove('d-none');
      errorEl.innerHTML = `
        <div class="text-center py-5">
          <i class="bi bi-exclamation-triangle text-danger fs-1"></i>
          <h5 class="mt-3 text-danger">ไม่สามารถโหลดข้อมูล Dashboard ได้</h5>
          <p class="text-muted">${App.escHtml(error.message)}</p>
          <button class="btn btn-outline-primary" onclick="loadDashboard()">
            <i class="bi bi-arrow-clockwise me-1"></i> ลองใหม่อีกครั้ง
          </button>
        </div>`;
    }
  } finally {
    loadingEl?.classList.add('d-none');
  }
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function renderKPIs(kpi) {
  if (!kpi) return;
  const map = {
    'kpi-total-rooms': kpi.totalRooms,
    'kpi-avail-rooms': kpi.availableRooms,
    'kpi-partial-rooms': kpi.partiallyOccupiedRooms,
    'kpi-full-rooms': kpi.fullRooms,
    'kpi-maint-rooms': kpi.maintenanceRooms,
    'kpi-total-beds': kpi.totalBeds,
    'kpi-avail-beds': kpi.availableBeds,
    'kpi-total-occupants': kpi.totalOccupants,
    'kpi-new-this-month': kpi.newThisMonth,
    'kpi-checkout-this-month': kpi.checkOutThisMonth
  };
  Object.keys(map).forEach(id => setText(id, map[id] || 0));
  setText('kpi-rate', `${kpi.overallOccupancyRate || 0}%`);
}

function progressColor(pct) {
  return pct >= 90 ? 'bg-danger' : (pct >= 70 ? 'bg-warning' : 'bg-success');
}

function renderParking(ps) {
  if (!ps) return;
  setText('pk-total', ps.total || 0);
  setText('pk-occupied', ps.occupied || 0);
  setText('pk-available', ps.available || 0);
  setText('pk-rate', `${ps.rate || 0}%`);
  setText('pk-maint', ps.maintenance ? `ปิดปรับปรุง ${ps.maintenance} ช่อง` : '');

  const container = document.getElementById('parking-type-bars');
  if (!container) return;
  const row = (icon, label, t) => {
    const total = t?.total || 0;
    const occ = t?.occupied || 0;
    const pct = total > 0 ? Math.round((occ / total) * 100) : 0;
    return `
      <div class="col-12 col-md-6">
        <div class="d-flex justify-content-between mb-1">
          <span class="fw-semibold"><i class="bi ${icon} me-1"></i>${label}</span>
          <span class="small text-muted">${occ} / ${total} ช่อง (ว่าง ${t?.available || 0})</span>
        </div>
        <div class="progress" style="height: 10px; border-radius: 6px;">
          <div class="progress-bar ${progressColor(pct)}" style="width: ${pct}%"></div>
        </div>
      </div>`;
  };
  container.innerHTML = row('bi-car-front-fill', 'รถยนต์', ps.car) + row('bi-bicycle', 'มอเตอร์ไซค์', ps.motorcycle);
}

function renderBuildingOccupancy(buildingStats) {
  const container = document.getElementById('building-occupancy-bars');
  if (!container) return;
  if (!buildingStats || buildingStats.length === 0) {
    container.innerHTML = '<p class="text-muted text-center py-3">ไม่มีข้อมูลอาคาร</p>';
    return;
  }
  container.innerHTML = buildingStats.map(b => `
    <div class="mb-3">
      <div class="d-flex justify-content-between align-items-center mb-1">
        <span class="fw-semibold text-dark">${App.escHtml(b.buildingName)}</span>
        <span class="small text-muted">${b.occupiedBeds} / ${b.totalBeds} ที่ (<strong>${b.occupancyRate}%</strong>)</span>
      </div>
      <div class="progress" style="height: 12px; border-radius: 6px;">
        <div class="progress-bar ${progressColor(b.occupancyRate)}" role="progressbar" style="width: ${b.occupancyRate}%;" aria-valuenow="${b.occupancyRate}" aria-valuemin="0" aria-valuemax="100"></div>
      </div>
    </div>`).join('');
}

function renderAlmostFullRooms(rooms) {
  const container = document.getElementById('almost-full-rooms-list');
  if (!container) return;
  if (!rooms || rooms.length === 0) {
    container.innerHTML = '<div class="text-muted text-center py-3"><i class="bi bi-check2-circle text-success me-1"></i>ไม่มีห้องที่เหลือ 1 ที่สุดท้าย</div>';
    return;
  }
  container.innerHTML = '<div class="list-group list-group-flush">' + rooms.map(r => `
    <div class="list-group-item d-flex justify-content-between align-items-center px-0 py-2">
      <div>
        <span class="fw-bold text-dark">ห้อง ${App.escHtml(r.roomNumber)}</span>
        <small class="text-muted ms-2">${App.escHtml(r.buildingName)}</small>
      </div>
      <span class="badge bg-warning text-dark">เหลือ ${r.available} ที่สุดท้าย</span>
    </div>`).join('') + '</div>';
}

/** วาดกราฟ (ทำลายกราฟเดิมบน canvas เดียวกันก่อนเสมอ) */
function drawChart(id, config) {
  const canvas = document.getElementById(id);
  if (!canvas || typeof Chart === 'undefined') return;
  Chart.getChart(canvas)?.destroy();
  new Chart(canvas.getContext('2d'), config);
}

function barConfig(labels, data, label, color, extra = {}) {
  const valueAxis = { beginAtZero: true, ticks: { precision: 0 }, ...(extra.max ? { max: extra.max } : {}) };
  return {
    type: 'bar',
    data: { labels, datasets: [{ label, data, backgroundColor: color }] },
    options: {
      responsive: true,
      indexAxis: extra.horizontal ? 'y' : 'x',
      plugins: { legend: { display: false } },
      scales: { [extra.horizontal ? 'x' : 'y']: valueAxis }
    }
  };
}

function renderCharts(c) {
  if (c.roomStatus) {
    drawChart('chart-room-status', {
      type: 'doughnut',
      data: {
        labels: c.roomStatus.labels,
        datasets: [{ data: c.roomStatus.counts, backgroundColor: ['#10b981', '#f59e0b', '#ef4444', '#f97316', '#64748b'] }]
      },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });
  }
  if (c.buildingOccupancy) {
    const b = c.buildingOccupancy;
    drawChart('chart-occupants-building', barConfig(b.labels, b.counts, 'จำนวนผู้พัก (คน)', '#2563eb'));
    drawChart('chart-occupancy-rate', barConfig(b.labels, b.rates, 'อัตราการเข้าพัก (%)', '#0ea5e9', { max: 100 }));
  }
  if (c.departmentDistribution) {
    const d = c.departmentDistribution;
    drawChart('chart-dept', barConfig(d.labels, d.counts, 'จำนวน (คน)', '#8b5cf6', { horizontal: true }));
  }
  if (c.monthlyTrends) {
    const m = c.monthlyTrends;
    const line = (label, data, color, bg) => ({ label, data, borderColor: color, backgroundColor: bg, fill: true, tension: 0.3 });
    drawChart('chart-monthly-trends', {
      type: 'line',
      data: {
        labels: m.labels,
        datasets: [
          line('ผู้เข้าพักใหม่', m.checkIns, '#10b981', 'rgba(16, 185, 129, 0.1)'),
          line('ผู้ย้ายออก', m.checkOuts, '#ef4444', 'rgba(239, 68, 68, 0.1)')
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom' } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', loadDashboard);