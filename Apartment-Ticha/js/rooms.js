let allRooms = [];
let allBuildings = [];
let allFloors = [];

async function loadRoomsData() {
  const loadingEl = document.getElementById('loading-indicator');
  const containerEl = document.getElementById('rooms-container');

  if (loadingEl) loadingEl.classList.remove('d-none');
  if (containerEl) containerEl.innerHTML = '';

  try {
    const [rooms, buildings, floors] = await Promise.all([
      API.getRooms(),
      API.getBuildings(),
      API.getFloors()
    ]);

    allRooms = rooms || [];
    allBuildings = buildings || [];
    allFloors = floors || [];

    populateFilterOptions();
    renderSummaryBar();
    applyFilterAndRender();
  } catch (error) {
    if (containerEl) {
      containerEl.innerHTML = `
        <div class="col-12 text-center py-5">
          <i class="bi bi-exclamation-circle text-danger fs-1"></i>
          <h5 class="mt-3 text-danger">ไม่สามารถโหลดข้อมูลห้องพักได้</h5>
          <p class="text-muted">${App.escHtml(error.message)}</p>
          <button class="btn btn-outline-primary mt-2" onclick="loadRoomsData()">
            <i class="bi bi-arrow-clockwise me-1"></i> ลองใหม่อีกครั้ง
          </button>
        </div>
      `;
    }
  } finally {
    if (loadingEl) loadingEl.classList.add('d-none');
  }
}

function populateFilterOptions() {
  const bldSelect = document.getElementById('filter-building');
  if (bldSelect) {
    const curVal = bldSelect.value;
    bldSelect.innerHTML = '<option value="">ทุกอาคาร</option>';
    allBuildings.forEach(b => {
      bldSelect.innerHTML += `<option value="${App.escHtml(b.BuildingID)}">${App.escHtml(b.BuildingName)} (${App.escHtml(b.BuildingCode)})</option>`;
    });
    bldSelect.value = curVal;
  }
}

function renderSummaryBar() {
  const total = allRooms.length;
  const avail = allRooms.filter(r => r.computedStatus === 'Available').length;
  const partial = allRooms.filter(r => r.computedStatus === 'Partially Occupied').length;
  const full = allRooms.filter(r => r.computedStatus === 'Full').length;
  const maint = allRooms.filter(r => r.computedStatus === 'Maintenance').length;

  const summaryEl = document.getElementById('room-summary-chips');
  if (summaryEl) {
    summaryEl.innerHTML = `
      <div class="d-flex flex-wrap gap-2 align-items-center">
        <span class="badge bg-secondary px-3 py-2 rounded-pill fs-7">ทั้งหมด: <strong>${total}</strong> ห้อง</span>
        <span class="badge bg-success px-3 py-2 rounded-pill fs-7">🟢 ว่าง: <strong>${avail}</strong></span>
        <span class="badge bg-warning text-dark px-3 py-2 rounded-pill fs-7">🟡 ว่างบางส่วน: <strong>${partial}</strong></span>
        <span class="badge bg-danger px-3 py-2 rounded-pill fs-7">🔴 เต็ม: <strong>${full}</strong></span>
        <span class="badge bg-orange text-white px-3 py-2 rounded-pill fs-7" style="background-color: #ea580c;">🟠 ปิดปรับปรุง: <strong>${maint}</strong></span>
      </div>
    `;
  }
}

function applyFilterAndRender() {
  const bldVal = document.getElementById('filter-building')?.value || '';
  const statusVal = document.getElementById('filter-status')?.value || '';
  const genderVal = document.getElementById('filter-gender')?.value || '';
  const typeVal = document.getElementById('filter-type')?.value || '';
  const searchVal = (document.getElementById('search-room')?.value || '').trim().toLowerCase();

  const filtered = allRooms.filter(room => {
    if (bldVal && room.buildingId !== bldVal) return false;
    if (statusVal && room.computedStatus !== statusVal) return false;
    if (genderVal && room.gender !== genderVal) return false;
    if (typeVal && room.roomType !== typeVal) return false;

    if (searchVal) {
      const matchRoom = (room.roomNumber || '').toLowerCase().includes(searchVal);
      const matchId = (room.roomId || '').toLowerCase().includes(searchVal);
      const matchOccupant = room.occupants?.some(o =>
        (o.fullName || '').toLowerCase().includes(searchVal) ||
        (o.employeeId || '').toLowerCase().includes(searchVal)
      );
      if (!matchRoom && !matchId && !matchOccupant) return false;
    }

    return true;
  });

  renderRooms(filtered);
}

function renderRooms(rooms) {
  const container = document.getElementById('rooms-container');
  if (!container) return;

  if (rooms.length === 0) {
    container.innerHTML = `
      <div class="col-12 text-center py-5">
        <i class="bi bi-search text-muted fs-1"></i>
        <h5 class="mt-3 text-muted">ไม่พบห้องพักที่ตรงกับเงื่อนไขการค้นหา</h5>
      </div>
    `;
    return;
  }

  const groupedByBuilding = {};
  rooms.forEach(r => {
    const bId = r.buildingId || 'OTHER';
    if (!groupedByBuilding[bId]) {
      groupedByBuilding[bId] = {
        name: r.buildingName || 'อาคารอื่น',
        code: r.buildingCode || '',
        floors: {}
      };
    }

    const fId = r.floorId || 'F_DEF';
    if (!groupedByBuilding[bId].floors[fId]) {
      const flr = allFloors.find(f => f.FloorID === fId);
      groupedByBuilding[bId].floors[fId] = {
        name: flr ? flr.FloorName : `ชั้น ${r.floorId || '1'}`,
        rooms: []
      };
    }

    groupedByBuilding[bId].floors[fId].rooms.push(r);
  });

  let html = '';
  Object.keys(groupedByBuilding).forEach(bId => {
    const bld = groupedByBuilding[bId];
    html += `
      <div class="col-12 mb-4">
        <div class="d-flex align-items-center gap-2 mb-3">
          <h4 class="mb-0 fw-bold text-primary">
            <i class="bi bi-building me-2"></i>${App.escHtml(bld.name)}
          </h4>
          <span class="badge bg-primary-subtle text-primary">อาคาร ${App.escHtml(bld.code)}</span>
        </div>
    `;

    Object.keys(bld.floors).forEach(fId => {
      const floor = bld.floors[fId];
      html += `
        <div class="floor-section mb-3 shadow-sm">
          <div class="floor-title">
            <i class="bi bi-layers text-secondary"></i> ${App.escHtml(floor.name)}
            <span class="text-muted fs-7 fw-normal ms-auto">${floor.rooms.length} ห้อง</span>
          </div>
          <div class="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 g-3">
      `;

      floor.rooms.forEach(room => {
        const statusClass = (room.computedStatus || '').replace(/\s+/g, '-');
        const genderBadge = room.gender === 'Male' ? '<span class="badge bg-info-subtle text-info"><i class="bi bi-gender-male"></i> ชาย</span>' :
                            (room.gender === 'Female' ? '<span class="badge bg-danger-subtle text-danger"><i class="bi bi-gender-female"></i> หญิง</span>' : '');

        // Render Bed Indicators
        // หมายเหตุการแก้ไข: เดิมวนลูปแสดงเตียงทุกใบใน room.beds รวมถึงเตียงที่ถูกปิด
        // ใช้งาน (Status = 'Inactive') จากการลดความจุห้องด้วย ทำให้ผังห้องโชว์เตียง
        // "ว่าง" หลอน ๆ ที่จริงแล้วไม่มีอยู่แล้ว จึงแก้ให้กรองเฉพาะเตียงที่ยัง Active
        let bedIndicatorsHtml = '';
        const visibleBeds = (room.beds || []).filter(b => b.status === 'Active');
        if (visibleBeds.length > 0) {
          bedIndicatorsHtml = visibleBeds.map(b => `
            <span class="bed-indicator ${b.isOccupied ? 'occupied' : 'vacant'}" title="เตียง ${App.escHtml(b.bedNumber)}: ${b.isOccupied ? App.escHtml(b.occupantName) : 'ว่าง'}">
              ${App.escHtml(b.bedNumber)}
            </span>
          `).join('');
        }

        html += `
          <div class="col">
            <div class="card room-card status-${statusClass} h-100" onclick="showRoomDetails('${App.escAttr(room.roomId)}')">
              <div class="room-header p-3 pb-2 d-flex justify-content-between align-items-center">
                <span class="fs-5 fw-bold text-dark">${App.escHtml(room.roomNumber)}</span>
                ${App.getStatusBadge(room.computedStatus)}
              </div>
              <div class="card-body p-3 pt-2">
                <div class="d-flex justify-content-between align-items-center mb-2">
                  <small class="text-muted">${App.escHtml(room.roomType || 'Standard')}</small>
                  ${genderBadge}
                </div>

                <div class="d-flex justify-content-between align-items-center mb-3">
                  <div class="text-muted small">
                    <i class="bi bi-people me-1"></i>ผู้พัก: <strong>${room.occupiedBedsCount}/${room.activeBedsCount}</strong> คน
                  </div>
                  <div class="text-success small fw-semibold">
                    ว่าง: ${room.availableBedsCount} เตียง
                  </div>
                </div>

                <div class="d-flex align-items-center gap-1">
                  <small class="text-muted me-1" style="font-size: 0.75rem;">เตียง:</small>
                  ${bedIndicatorsHtml}
                </div>
              </div>
            </div>
          </div>
        `;
      });

      html += `
          </div>
        </div>
      `;
    });

    html += `</div>`;
  });

  container.innerHTML = html;
}

function showRoomDetails(roomId) {
  const room = allRooms.find(r => r.roomId === roomId);
  if (!room) return;

  const modalEl = document.getElementById('roomDetailModal');
  if (!modalEl) return;

  document.getElementById('modal-room-number').textContent = room.roomNumber;
  document.getElementById('modal-building-name').textContent = `${room.buildingName} (อาคาร ${room.buildingCode})`;
  document.getElementById('modal-room-status-badge').innerHTML = App.getStatusBadge(room.computedStatus);
  document.getElementById('modal-room-type').textContent = room.roomType || 'Standard';
  document.getElementById('modal-gender').textContent = room.gender === 'Male' ? 'ชาย' : (room.gender === 'Female' ? 'หญิง' : 'ทั่วไป');
  document.getElementById('modal-capacity').textContent = `${room.occupiedBedsCount} / ${room.activeBedsCount} คน (ว่าง ${room.availableBedsCount} เตียง)`;
  document.getElementById('modal-rate').textContent = room.monthlyRate ? `${Number(room.monthlyRate).toLocaleString()} บาท/เดือน` : 'ฟรี/สวัสดิการ';
  document.getElementById('modal-facilities').innerHTML = `
    ${room.hasAirConditioner ? '<span class="badge bg-success-subtle text-success me-1"><i class="bi bi-snow"></i> เครื่องปรับอากาศ</span>' : '<span class="badge bg-light text-muted me-1">พัดลม</span>'}
    ${room.hasFurniture ? '<span class="badge bg-primary-subtle text-primary me-1"><i class="bi bi-box-seam"></i> เฟอร์นิเจอร์ครบ</span>' : ''}
  `;

  const occContainer = document.getElementById('modal-occupants-list');
  if (room.occupants && room.occupants.length > 0) {
    occContainer.innerHTML = room.occupants.map(o => `
      <li class="list-group-item d-flex justify-content-between align-items-center py-2">
        <div>
          <div class="fw-bold text-dark"><i class="bi bi-person-fill me-1"></i>${App.escHtml(o.fullName)} (${App.escHtml(o.employeeId)})</div>
          <small class="text-muted">แผนก: ${App.escHtml(o.department || '-')} | โทร: ${App.escHtml(o.phone || '-')}</small>
          <div class="text-muted" style="font-size: 0.75rem;">
            เข้าพัก: ${App.formatDate(o.checkInDate)} ${o.expectedCheckOutDate ? ' | สิ้นสุด: ' + App.formatDate(o.expectedCheckOutDate) : ''}
          </div>
        </div>
        <div class="d-flex align-items-center gap-1">
          <span class="badge bg-danger-subtle text-danger border border-danger-subtle me-1">เตียง ${App.escHtml(o.bedNumber)}</span>
          <a href="admin.html?action=transfer&occId=${encodeURIComponent(o.occupancyId)}&empName=${encodeURIComponent(o.fullName)}&roomId=${encodeURIComponent(room.roomId)}&bedId=${encodeURIComponent(o.bedId)}&roomNum=${encodeURIComponent(room.roomNumber)}" class="btn btn-sm btn-outline-primary py-1 px-2" title="ย้ายห้อง">
            <i class="bi bi-arrow-left-right me-1"></i>ย้าย
          </a>
          <a href="admin.html?action=checkout&occId=${encodeURIComponent(o.occupancyId)}&empName=${encodeURIComponent(o.fullName)}&roomNum=${encodeURIComponent(room.roomNumber)}&bedNum=${encodeURIComponent(o.bedNumber)}" class="btn btn-sm btn-outline-danger py-1 px-2" title="เช็คเอาท์">
            <i class="bi bi-box-arrow-right me-1"></i>ออก
          </a>
        </div>
      </li>
    `).join('');
  } else {
    occContainer.innerHTML = '<li class="list-group-item text-muted text-center py-3">ยังไม่มีผู้เข้าพักในห้องนี้</li>';
  }

  // หมายเหตุการแก้ไข: กรองเฉพาะเตียงที่ยัง Active เช่นเดียวกับผังห้อง เพื่อไม่ให้แสดง
  // เตียงที่ถูกปิดใช้งานไปแล้วจากการลดความจุห้อง
  const bedsContainer = document.getElementById('modal-beds-list');
  const visibleBedsForModal = (room.beds || []).filter(b => b.status === 'Active');
  if (visibleBedsForModal.length > 0) {
    bedsContainer.innerHTML = visibleBedsForModal.map(b => `
      <div class="col-6 col-md-4 mb-2">
        <div class="p-2 border rounded ${b.isOccupied ? 'bg-danger-subtle border-danger' : 'bg-success-subtle border-success'}">
          <div class="d-flex justify-content-between align-items-center">
            <span class="fw-bold">เตียง ${App.escHtml(b.bedNumber)}</span>
            <span class="badge ${b.isOccupied ? 'bg-danger' : 'bg-success'}">${b.isOccupied ? 'มีผู้พัก' : 'ว่าง'}</span>
          </div>
          <div class="small text-truncate mt-1 text-muted" title="${b.isOccupied ? App.escHtml(b.occupantName) : 'พร้อมเข้าพัก'}">
            ${b.isOccupied ? `<i class="bi bi-person-fill"></i> ${App.escHtml(b.occupantName)}` : '<i class="bi bi-check2"></i> เตียงว่าง'}
          </div>
        </div>
      </div>
    `).join('');
  } else {
    bedsContainer.innerHTML = '<div class="col-12 text-muted text-center py-2">ไม่มีเตียงที่เปิดใช้งานในห้องนี้</div>';
  }

  const actionContainer = document.getElementById('modal-quick-actions');
  if (actionContainer) {
    let buttons = '';
    if (room.availableBedsCount > 0 && room.computedStatus !== 'Maintenance') {
      buttons += `
        <a href="admin.html?action=checkin&roomId=${encodeURIComponent(room.roomId)}" class="btn btn-sm btn-success me-2">
          <i class="bi bi-box-arrow-in-right me-1"></i> เช็คอินเข้าห้องนี้
        </a>
      `;
    }
    buttons += `
      <a href="admin.html?action=repair&roomId=${encodeURIComponent(room.roomId)}" class="btn btn-sm btn-outline-warning me-2">
        <i class="bi bi-wrench me-1"></i> แจ้งซ่อม
      </a>
      <a href="admin.html?tab=rooms" class="btn btn-sm btn-outline-secondary me-2">
        <i class="bi bi-pencil me-1"></i> แก้ไขห้อง
      </a>
    `;
    actionContainer.innerHTML = buttons;
  }

  const modal = new bootstrap.Modal(modalEl);
  modal.show();
}

document.addEventListener('DOMContentLoaded', () => {
  loadRoomsData();
  ['filter-building', 'filter-status', 'filter-gender', 'filter-type'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', applyFilterAndRender);
  });
  document.getElementById('search-room')?.addEventListener('input', applyFilterAndRender);
});