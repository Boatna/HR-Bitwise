let charts = {};

async function loadDashboard() {
  const loadingEl = document.getElementById('loading-indicator');
  const contentEl = document.getElementById('dashboard-content');

  if (loadingEl) loadingEl.classList.remove('d-none');
  if (contentEl) contentEl.classList.add('d-none');

  try {
    const data = await API.getDashboardData();
    renderKPIs(data.kpi);
    renderCharts(data);
    renderBuildingOccupancy(data.buildingStats);
    renderAlmostFullRooms(data.almostFullRooms);
    renderRecentActivities(data);

    if (contentEl) contentEl.classList.remove('d-none');
  } catch (error) {
    console.error('Error loading dashboard:', error);
    if (contentEl) {
      contentEl.classList.remove('d-none');
      contentEl.innerHTML = `
        <div class="col-12 text-center py-5">
          <i class="bi bi-exclamation-triangle text-danger fs-1"></i>
          <h5 class="mt-3 text-danger">ไม่สามารถโหลดข้อมูล Dashboard ได้</h5>
          <p class="text-muted">${App.escHtml(error.message)}</p>
          <button class="btn btn-outline-primary" onclick="loadDashboard()">
            <i class="bi bi-arrow-clockwise me-1"></i> ลองใหม่อีกครั้ง
          </button>
        </div>
      `;
    }
  } finally {
    if (loadingEl) loadingEl.classList.add('d-none');
  }
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function renderKPIs(kpi) {
  if (!kpi) return;
  setText('kpi-total-rooms', kpi.totalRooms || 0);
  setText('kpi-avail-rooms', kpi.availableRooms || 0);
  setText('kpi-partial-rooms', kpi.partiallyOccupiedRooms || 0);
  setText('kpi-full-rooms', kpi.fullRooms || 0);
  setText('kpi-maint-rooms', kpi.maintenanceRooms || 0);
  setText('kpi-total-beds', kpi.totalBeds || 0);
  setText('kpi-avail-beds', kpi.availableBeds || 0);
  setText('kpi-total-occupants', kpi.totalOccupants || 0);
  setText('kpi-rate', `${kpi.overallOccupancyRate || 0}%`);
  setText('kpi-new-this-month', kpi.newThisMonth || 0);
  setText('kpi-checkout-this-month', kpi.checkOutThisMonth || 0);
  setText('kpi-pending-requests', kpi.pendingRequestsCount || 0);
}

function renderBuildingOccupancy(buildingStats) {
  const container = document.getElementById('building-occupancy-bars');
  if (!container) return;

  if (!buildingStats || buildingStats.length === 0) {
    container.innerHTML = '<p class="text-muted text-center py-3">ไม่มีข้อมูลอาคาร</p>';
    return;
  }

  let html = '';
  buildingStats.forEach(b => {
    let colorClass = 'bg-success';
    if (b.occupancyRate >= 90) colorClass = 'bg-danger';
    else if (b.occupancyRate >= 70) colorClass = 'bg-warning text-dark';

    html += `
      <div class="mb-3">
        <div class="d-flex justify-content-between align-items-center mb-1">
          <span class="fw-semibold text-dark">${App.escHtml(b.buildingName)} (อาคาร ${App.escHtml(b.buildingCode)})</span>
          <span class="small text-muted">${b.occupiedBeds} / ${b.totalBeds} เตียง (<strong>${b.occupancyRate}%</strong>)</span>
        </div>
        <div class="progress" style="height: 12px; border-radius: 6px;">
          <div class="progress-bar ${colorClass}" role="progressbar" style="width: ${b.occupancyRate}%;" aria-valuenow="${b.occupancyRate}" aria-valuemin="0" aria-valuemax="100"></div>
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
}

function renderAlmostFullRooms(almostFullRooms) {
  const container = document.getElementById('almost-full-rooms-list');
  if (!container) return;

  if (!almostFullRooms || almostFullRooms.length === 0) {
    container.innerHTML = '<div class="text-muted text-center py-3"><i class="bi bi-check2-circle text-success me-1"></i>ไม่มีห้องที่เหลือ 1 เตียง</div>';
    return;
  }

  let html = '<div class="list-group list-group-flush">';
  almostFullRooms.forEach(r => {
    html += `
      <div class="list-group-item d-flex justify-content-between align-items-center px-0 py-2">
        <div>
          <span class="fw-bold text-dark">ห้อง ${App.escHtml(r.roomNumber)}</span>
          <small class="text-muted ms-2">${App.escHtml(r.buildingName)}</small>
        </div>
        <span class="badge bg-warning text-dark">เหลือ ${r.available} เตียงสุดท้าย</span>
      </div>
    `;
  });
  html += '</div>';
  container.innerHTML = html;
}

function renderRecentActivities(data) {
  const reqContainer = document.getElementById('recent-requests-list');
  if (reqContainer && data.recentRequests) {
    if (data.recentRequests.length === 0) {
      reqContainer.innerHTML = '<p class="text-muted text-center py-3 mb-0">ไม่มีคำขอเข้าพักใหม่</p>';
    } else {
      reqContainer.innerHTML = data.recentRequests.map(r => `
        <div class="list-group-item d-flex justify-content-between align-items-center px-0 py-2">
          <div>
            <div class="fw-semibold text-dark">รหัสพนักงาน: ${App.escHtml(r.EmployeeID)}</div>
            <small class="text-muted">วันที่ขอ: ${App.formatDate(r.RequestDate)} | อาคาร: ${App.escHtml(r.PreferredBuilding || 'ไม่ระบุ')}</small>
          </div>
          ${App.getStatusBadge(r.RequestStatus)}
        </div>
      `).join('');
    }
  }

  const repairContainer = document.getElementById('active-repairs-list');
  if (repairContainer && data.activeRepairs) {
    if (data.activeRepairs.length === 0) {
      repairContainer.innerHTML = '<p class="text-muted text-center py-3 mb-0">ไม่มีงานแจ้งซ่อมค้างอยู่</p>';
    } else {
      repairContainer.innerHTML = data.activeRepairs.map(rep => `
        <div class="list-group-item d-flex justify-content-between align-items-center px-0 py-2">
          <div>
            <div class="fw-semibold text-dark">ห้อง: ${App.escHtml(rep.RoomID)} (${App.escHtml(rep.IssueType)})</div>
            <small class="text-muted text-truncate d-block" style="max-width: 250px;">${App.escHtml(rep.Description || '-')}</small>
          </div>
          <span class="badge ${rep.Priority === 'Urgent' ? 'bg-danger' : 'bg-warning text-dark'}">${App.escHtml(rep.Priority)}</span>
        </div>
      `).join('');
    }
  }
}

function destroyChart(id) {
  if (charts[id]) {
    charts[id].destroy();
    delete charts[id];
  }
}

function renderCharts(data) {
  const chartConfig = data.charts || {};
  destroyChart('chart-room-status');
  const ctx1 = document.getElementById('chart-room-status')?.getContext('2d');
  if (ctx1 && chartConfig.roomStatus) {
    charts['chart-room-status'] = new Chart(ctx1, {
      type: 'doughnut',
      data: {
        labels: chartConfig.roomStatus.labels,
        datasets: [{
          data: chartConfig.roomStatus.counts,
          backgroundColor: ['#10b981', '#f59e0b', '#ef4444', '#f97316', '#64748b']
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom' } }
      }
    });
  }

  destroyChart('chart-occupants-building');
  const ctx2 = document.getElementById('chart-occupants-building')?.getContext('2d');
  if (ctx2 && chartConfig.buildingOccupancy) {
    charts['chart-occupants-building'] = new Chart(ctx2, {
      type: 'bar',
      data: {
        labels: chartConfig.buildingOccupancy.labels,
        datasets: [{
          label: 'จำนวนผู้พัก (คน)',
          data: chartConfig.buildingOccupancy.counts,
          backgroundColor: '#2563eb'
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
      }
    });
  }

  destroyChart('chart-occupancy-rate');
  const ctx3 = document.getElementById('chart-occupancy-rate')?.getContext('2d');
  if (ctx3 && chartConfig.buildingOccupancy) {
    charts['chart-occupancy-rate'] = new Chart(ctx3, {
      type: 'bar',
      data: {
        labels: chartConfig.buildingOccupancy.labels,
        datasets: [{
          label: 'อัตราการเข้าพัก (%)',
          data: chartConfig.buildingOccupancy.rates,
          backgroundColor: '#0ea5e9'
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, max: 100 } }
      }
    });
  }

  destroyChart('chart-dept');
  const ctx4 = document.getElementById('chart-dept')?.getContext('2d');
  if (ctx4 && chartConfig.departmentDistribution) {
    charts['chart-dept'] = new Chart(ctx4, {
      type: 'bar',
      data: {
        labels: chartConfig.departmentDistribution.labels,
        datasets: [{
          label: 'จำนวน (คน)',
          data: chartConfig.departmentDistribution.counts,
          backgroundColor: '#8b5cf6'
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true, ticks: { precision: 0 } } }
      }
    });
  }

  destroyChart('chart-monthly-trends');
  const ctx5 = document.getElementById('chart-monthly-trends')?.getContext('2d');
  if (ctx5 && chartConfig.monthlyTrends) {
    charts['chart-monthly-trends'] = new Chart(ctx5, {
      type: 'line',
      data: {
        labels: chartConfig.monthlyTrends.labels,
        datasets: [
          {
            label: 'ผู้เข้าพักใหม่',
            data: chartConfig.monthlyTrends.checkIns,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            fill: true,
            tension: 0.3
          },
          {
            label: 'ผู้ย้ายออก',
            data: chartConfig.monthlyTrends.checkOuts,
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            fill: true,
            tension: 0.3
          }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom' } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
      }
    });
  }

  destroyChart('chart-repairs');
  const ctx7 = document.getElementById('chart-repairs')?.getContext('2d');
  if (ctx7 && chartConfig.repairStats) {
    charts['chart-repairs'] = new Chart(ctx7, {
      type: 'bar',
      data: {
        labels: chartConfig.repairStats.labels,
        datasets: [{
          label: 'จำนวนงานแจ้งซ่อม',
          data: chartConfig.repairStats.counts,
          backgroundColor: '#f59e0b'
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
      }
    });
  }

  destroyChart('chart-room-types');
  const ctx8 = document.getElementById('chart-room-types')?.getContext('2d');
  if (ctx8 && chartConfig.roomTypes) {
    charts['chart-room-types'] = new Chart(ctx8, {
      type: 'pie',
      data: {
        labels: chartConfig.roomTypes.labels,
        datasets: [{
          data: chartConfig.roomTypes.counts,
          backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6']
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom' } }
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadDashboard();
});
