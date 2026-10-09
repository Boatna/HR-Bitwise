const Admin = {
  currentTab: 'occupancy',
  cachedEmployees: [],
  cachedRooms: [],
  cachedBuildings: [],
  cachedOccupancy: [],

  init() {
    this.bindEvents();
    this.checkUrlParams();
    this.switchTab(this.currentTab);
  },

  bindEvents() {
    document.querySelectorAll('.admin-sidebar .nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = link.getAttribute('data-tab');
        if (tab) this.switchTab(tab);
      });
    });

    document.getElementById('search-employee')?.addEventListener('input', () => {
      this.filterEmployees();
    });
  },

  _idEquals(a, b) {
    if (a === null || a === undefined) a = '';
    if (b === null || b === undefined) b = '';
    return String(a).trim() === String(b).trim();
  },

  checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    const roomId = params.get('roomId');
    const occId = params.get('occId');
    const empName = params.get('empName') || '';
    const roomNum = params.get('roomNum') || '';
    const bedNum = params.get('bedNum') || '';
    const tab = params.get('tab');

    if (tab) {
      if (document.getElementById('tab-' + tab)) this.currentTab = tab;
    }
    // ล้างพารามิเตอร์ออกจาก URL กันการรีเฟรชแล้วป๊อปอัปเด้งซ้ำ
    if (window.location.search) {
      window.history.replaceState(null, '', window.location.pathname);
    }

    if (action === 'checkin') {
      this.currentTab = 'occupancy';
      setTimeout(() => {
        OccupancyWorkflow.openCheckInModal(roomId);
      }, 500);
    } else if (action === 'checkout') {
      this.currentTab = 'occupancy';
      setTimeout(() => {
        OccupancyWorkflow.openCheckOutModal(occId, empName, roomNum, bedNum);
      }, 500);
    } else if (action === 'transfer') {
      this.currentTab = 'occupancy';
      setTimeout(() => {
        OccupancyWorkflow.openTransferModal(occId, empName, roomId, roomNum, bedNum);
      }, 500);
    }
  },

  switchTab(tabName) {
    this.currentTab = tabName;
    document.querySelectorAll('.admin-sidebar .nav-link').forEach(link => {
      if (link.getAttribute('data-tab') === tabName) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    document.querySelectorAll('.tab-content-section').forEach(sec => {
      sec.classList.add('d-none');
    });

    const activeSec = document.getElementById(`tab-${tabName}`);
    if (activeSec) {
      activeSec.classList.remove('d-none');
    }

    switch (tabName) {
      case 'occupancy':
        this.loadOccupancy();
        break;
      case 'rooms':
        this.loadRooms();
        break;
      case 'employees':
        this.loadEmployees();
        break;
      case 'parking':
        this.loadParking();
        break;
      case 'buildings':
        this.loadBuildings();
        break;
      case 'reports':
        Reports.generateReport('rooms');
        break;
      case 'settings':
        this.loadSettings();
        break;
    }
  },

  // ===================== 1. จัดการการเข้าพัก (Occupancy) =====================
  async loadOccupancy() {
    const tableBody = document.getElementById('occupancy-table-body');
    if (tableBody) tableBody.innerHTML = '<tr><td colspan="7" class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary me-2"></div>กำลังโหลดข้อมูลการเข้าพัก...</td></tr>';

    try {
      const rooms = await API.getRooms();
      this.cachedRooms = rooms || [];

      let rows = [];
      (rooms || []).forEach(r => {
        (r.occupants || []).forEach(o => {
          rows.push({
            ...o,
            buildingName: r.buildingName,
            roomNumber: r.roomNumber,
            roomId: r.roomId,
            parking: (r.parkingSlots || []).filter(p => String(p.ownerEmployeeId) === String(o.employeeId))
          });
        });
      });

      this.cachedOccupancy = rows;
      this.renderOccupancyTable(rows);
    } catch (e) {
      if (tableBody) tableBody.innerHTML = `<tr><td colspan="7" class="text-danger text-center py-4">${App.escHtml(e.message)}</td></tr>`;
    }
  },

  filterOccupancy() {
    const keyword = (document.getElementById('search-occupancy')?.value || '').trim().toLowerCase();
    if (!keyword) {
      this.renderOccupancyTable(this.cachedOccupancy);
      return;
    }
    const filtered = this.cachedOccupancy.filter(o =>
      String(o.fullName || '').toLowerCase().includes(keyword) ||
      String(o.employeeId || '').toLowerCase().includes(keyword) ||
      String(o.roomNumber || '').toLowerCase().includes(keyword) ||
      String(o.buildingName || '').toLowerCase().includes(keyword) ||
      String(o.department || '').toLowerCase().includes(keyword)
    );
    this.renderOccupancyTable(filtered);
  },

  renderOccupancyTable(rows) {
    const tableBody = document.getElementById('occupancy-table-body');
    if (!tableBody) return;

    if (!rows || rows.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">ไม่พบข้อมูลการเข้าพัก</td></tr>';
      return;
    }

    tableBody.innerHTML = rows.map(o => `
      <tr>
        <td><strong class="text-primary">${App.escHtml(o.employeeId)}</strong></td>
        <td>
          <div class="fw-semibold text-dark">${App.escHtml(o.fullName)}</div>
          <small class="text-muted">${App.escHtml(o.department || '-')} | โทร: ${App.escHtml(o.phone || '-')}</small>
          ${(o.parking || []).length ? `<div class="mt-1">${o.parking.map(p => App.parkingChip(p.slotNumber, p.vehicleType, p.licensePlate)).join(' ')}</div>` : ''}
        </td>
        <td>${App.escHtml(o.buildingName)}</td>
        <td><strong class="text-dark">ห้อง ${App.escHtml(o.roomNumber)}</strong></td>
        <td><span class="badge bg-primary-subtle text-primary border border-primary-subtle">ที่พัก ${App.escHtml(o.bedNumber)}</span></td>
        <td>${App.formatDate(o.checkInDate)}</td>
        <td>
          <button class="btn btn-sm btn-outline-primary me-1" onclick="OccupancyWorkflow.openTransferModal('${App.escAttr(o.occupancyId)}', '${App.escAttr(o.fullName)}', '${App.escAttr(o.roomId)}', '${App.escAttr(o.roomNumber)}', '${App.escAttr(o.bedNumber)}')" title="ย้ายห้อง">
            <i class="bi bi-arrow-left-right me-1"></i>ย้ายห้อง
          </button>
          <button class="btn btn-sm btn-outline-danger" onclick="OccupancyWorkflow.openCheckOutModal('${App.escAttr(o.occupancyId)}', '${App.escAttr(o.fullName)}', '${App.escAttr(o.roomNumber)}', '${App.escAttr(o.bedNumber)}')" title="เช็คเอาท์">
            <i class="bi bi-box-arrow-right me-1"></i>เช็คเอาท์
          </button>
        </td>
      </tr>
    `).join('');
  },

  // ===================== 2. ข้อมูลห้องพัก (Rooms) =====================
  async loadRooms() {
    const tableBody = document.getElementById('rooms-table-body');
    if (tableBody) tableBody.innerHTML = '<tr><td colspan="9" class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary me-2"></div>กำลังโหลดข้อมูลห้องพัก...</td></tr>';

    try {
      const [rooms, buildings] = await Promise.all([
        API.getRooms(),
        API.getBuildings()
      ]);
      this.cachedRooms = rooms || [];
      this.cachedBuildings = buildings || [];

      if (!tableBody) return;

      if (!rooms || rooms.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="9" class="text-center text-muted py-4">ไม่พบห้องพักในระบบ</td></tr>';
        return;
      }

      tableBody.innerHTML = rooms.map(r => {
        const isMaint = r.computedStatus === 'Maintenance';
        return `
          <tr>
            <td><strong class="text-dark">ห้อง ${App.escHtml(r.roomNumber)}</strong></td>
            <td>${App.escHtml(r.buildingName)}</td>
            <td>ชั้น ${App.escHtml(r.floorId || '1')}</td>
            <td><span class="badge bg-light text-dark">${App.escHtml(r.roomType)}</span></td>
            <td>${App.escHtml(r.capacity)} คน</td>
            <td>
              <span class="fw-bold">${r.occupiedBedsCount}</span> / ${r.capacity} คน
              <small class="${r.canCheckIn && r.availableBedsCount > 0 ? 'text-success' : 'text-muted'} ms-1">(${!r.canCheckIn && r.computedStatus !== 'Full' ? 'ไม่พร้อมใช้งาน' : (r.availableBedsCount > 0 ? `ว่าง ${r.availableBedsCount}` : 'เต็ม')})</small>
            </td>
            <td>${App.getStatusBadge(r.computedStatus)}</td>
            <td>
              <button class="btn btn-sm ${isMaint ? 'btn-outline-success' : 'btn-outline-warning'} me-1" onclick="Admin.toggleRoomMaintenance('${App.escAttr(r.roomId)}', '${App.escAttr(r.roomNumber)}', ${isMaint})" title="${isMaint ? 'เปิดห้องใช้งาน' : 'ปิดปรับปรุง'}">
                <i class="bi ${isMaint ? 'bi-check-circle' : 'bi-cone-striped'}"></i> ${isMaint ? 'เปิดใช้' : 'ปิดซ่อม'}
              </button>
              <button class="btn btn-sm btn-outline-secondary me-1" onclick="Admin.openRoomModal('${App.escAttr(r.roomId)}')" title="แก้ไข">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-sm btn-outline-danger" onclick="Admin.deleteRoom('${App.escAttr(r.roomId)}', '${App.escAttr(r.roomNumber)}')" title="ลบ">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>
        `;
      }).join('');
    } catch (e) {
      if (tableBody) tableBody.innerHTML = `<tr><td colspan="9" class="text-danger text-center py-4">${App.escHtml(e.message)}</td></tr>`;
    }
  },

  async toggleRoomMaintenance(roomId, roomNumber, isCurrentMaint) {
    const actionText = isCurrentMaint ? 'เปิดใช้งานห้อง' : 'ปิดปรับปรุงห้อง';
    const confirmed = await App.confirm(`ยืนยันการ${actionText}`, `คุณต้องการ${actionText} ${roomNumber} ใช่หรือไม่?`);
    if (!confirmed) return;

    try {
      App.showLoading(`กำลัง${actionText}...`);
      await API.toggleRoomMaintenance(roomId);
      App.closeLoading();
      App.showToast(`${actionText} ${roomNumber} สำเร็จ`, 'success');
      this.loadRooms();
    } catch (e) {
      App.closeLoading();
      App.showError('ไม่สามารถดำเนินการได้', e.message);
    }
  },

  async openRoomModal(roomId = null) {
    let room = null;
    if (roomId) {
      room = this.cachedRooms.find(r => this._idEquals(r.roomId, roomId));
    }

    if (!this.cachedBuildings || this.cachedBuildings.length === 0) {
      try {
        this.cachedBuildings = await API.getBuildings();
      } catch (err) {}
    }

    const bldSelect = document.getElementById('room-building');
    if (bldSelect) {
      bldSelect.innerHTML = '<option value="">-- เลือกอาคาร --</option>';
      (this.cachedBuildings || []).forEach(b => {
        const isSel = room && this._idEquals(room.buildingId, b.BuildingID) ? 'selected' : '';
        bldSelect.innerHTML += `<option value="${App.escHtml(b.BuildingID)}" ${isSel}>${App.escHtml(b.BuildingName)}</option>`;
      });
    }

    document.getElementById('room-id').value = room ? room.roomId : '';
    document.getElementById('room-number').value = room ? room.roomNumber : '';
    document.getElementById('room-floor').value = room ? (room.floorId || '1') : '1';
    document.getElementById('room-type').value = room ? (room.roomType || 'Double') : 'Double';
    document.getElementById('room-capacity').value = room ? room.capacity : '2';
    document.getElementById('room-rate').value = room ? (room.monthlyRate || 0) : '1500';
    document.getElementById('room-remark').value = room ? (room.remark || '') : 'เฟอร์นิเจอร์มาตรฐานครบชุด';

    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('roomModal'));
    modal.show();
  },

  syncRoomType() {
    const cap = Number(document.getElementById('room-capacity')?.value) || 0;
    const map = { 1: 'Single', 2: 'Double', 3: 'Triple', 4: 'Quad' };
    if (map[cap] && document.getElementById('room-type')) document.getElementById('room-type').value = map[cap];
  },

  async saveRoom() {
    const roomId = document.getElementById('room-id')?.value;
    const buildingId = document.getElementById('room-building')?.value;
    const roomNumber = document.getElementById('room-number')?.value;
    const floor = document.getElementById('room-floor')?.value;
    const roomType = document.getElementById('room-type')?.value;
    const capacity = document.getElementById('room-capacity')?.value;
    const monthlyRate = document.getElementById('room-rate')?.value;
    const remark = document.getElementById('room-remark')?.value;

    if (!buildingId || !roomNumber || !capacity) {
      App.showError('กรุณากรอกอาคาร เลขห้อง และความจุผู้พัก');
      return;
    }

    try {
      App.showLoading('กำลังบันทึกข้อมูลห้องพัก...');
      await API.saveRoom({
        roomId,
        buildingId,
        roomNumber,
        floor,
        roomType,
        capacity: Number(capacity),
        monthlyRate: Number(monthlyRate) || 0,
        remark
      });
      App.closeLoading();
      bootstrap.Modal.getInstance(document.getElementById('roomModal'))?.hide();
      App.showToast('บันทึกห้องพักสำเร็จ', 'success');
      this.loadRooms();
    } catch (e) {
      App.closeLoading();
      App.showError('บันทึกไม่สำเร็จ', e.message);
    }
  },

  async deleteRoom(roomId, roomNumber) {
    const confirmed = await App.confirm('ยืนยันการลบห้องพัก', `คุณต้องการลบห้อง ${roomNumber} ใช่หรือไม่? (ต้องไม่มีผู้พักอาศัยอยู่)`);
    if (!confirmed) return;

    try {
      App.showLoading('กำลังลบห้องพัก...');
      await API.deleteRoom(roomId);
      App.closeLoading();
      App.showToast('ลบห้องพักสำเร็จ', 'success');
      this.loadRooms();
    } catch (e) {
      App.closeLoading();
      App.showError('ลบไม่สำเร็จ', e.message);
    }
  },

  // ===================== 3. ข้อมูลพนักงาน (Employees) =====================
  async loadEmployees() {
    const tableBody = document.getElementById('employees-table-body');
    if (tableBody) tableBody.innerHTML = '<tr><td colspan="7" class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary me-2"></div>กำลังโหลดรายชื่อพนักงาน...</td></tr>';
    const searchInput = document.getElementById('search-employee');
    if (searchInput) searchInput.value = '';
    this.setEmployeeResultCount('');

    try {
      const emps = await API.getEmployees();
      this.cachedEmployees = emps || [];
      this.renderEmployeesTable(this.cachedEmployees);
    } catch (e) {
      if (tableBody) tableBody.innerHTML = `<tr><td colspan="7" class="text-danger text-center py-4">${App.escHtml(e.message)}</td></tr>`;
    }
  },

  filterEmployees() {
    const searchVal = (document.getElementById('search-employee')?.value || '').trim().toLowerCase();
    if (!searchVal) {
      this.renderEmployeesTable(this.cachedEmployees);
      this.setEmployeeResultCount('');
      return;
    }

    const filtered = this.cachedEmployees.filter(e => {
      const id = String(e.EmployeeID || '').toLowerCase();
      const fullName = String(e.FullName || '').toLowerCase();
      const dept = String(e.Department || '').toLowerCase();
      const room = String(e.currentRoomNumber || '').toLowerCase();
      return id.includes(searchVal) || fullName.includes(searchVal) || dept.includes(searchVal) || room.includes(searchVal);
    });

    this.renderEmployeesTable(filtered);
    this.setEmployeeResultCount(`พบ ${filtered.length} จากทั้งหมด ${this.cachedEmployees.length} คน`);
  },

  setEmployeeResultCount(text) {
    const el = document.getElementById('employee-search-result-count');
    if (el) el.textContent = text;
  },

  renderEmployeesTable(emps) {
    const tableBody = document.getElementById('employees-table-body');
    if (!tableBody) return;

    if (!emps || emps.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">ไม่พบข้อมูลพนักงาน</td></tr>';
      return;
    }

    tableBody.innerHTML = emps.map(e => `
      <tr>
        <td><strong>${App.escHtml(e.EmployeeID)}</strong></td>
        <td>
          <div class="fw-semibold text-dark">${App.escHtml(e.Prefix || '')} ${App.escHtml(e.FirstName || '')} ${App.escHtml(e.LastName || '')}</div>
        </td>
        <td>${App.escHtml(e.Department || '-')}</td>
        <td>${App.escHtml(e.Position || '-')}</td>
        <td>${App.escHtml(e.Phone || '-')}</td>
        <td>
          ${e.isAccommodated ? `<span class="badge bg-success">ห้อง ${App.escHtml(e.currentRoomNumber)}</span>` : '<span class="badge bg-light text-muted">ยังไม่มีห้องพัก</span>'}
          ${(e.parkingSlots || []).map(p => ' ' + App.parkingChip(p.slotNumber, p.vehicleType, p.licensePlate)).join('')}
        </td>
        <td>
          <button class="btn btn-sm btn-outline-secondary me-1" onclick="Admin.openEmployeeModal('${App.escAttr(e.EmployeeID)}')">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger" onclick="Admin.deleteEmployee('${App.escAttr(e.EmployeeID)}', '${App.escAttr(e.FullName)}')">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `).join('');
  },

  async openEmployeeModal(empId = null) {
    let emp = null;
    if (empId) {
      emp = this.cachedEmployees.find(e => this._idEquals(e.EmployeeID, empId));
    }

    const v = (x, def = '') => (x === undefined || x === null || x === '') ? def : x;
    document.getElementById('emp-id').value = emp ? emp.EmployeeID : '';
    document.getElementById('emp-custom-id').value = emp ? emp.EmployeeID : '';
    document.getElementById('emp-custom-id').disabled = !!emp;
    document.getElementById('emp-prefix').value = emp ? v(emp.Prefix, 'นาย') : 'นาย';
    document.getElementById('emp-firstname').value = emp ? v(emp.FirstName) : '';
    document.getElementById('emp-lastname').value = emp ? v(emp.LastName) : '';
    document.getElementById('emp-dept').value = emp ? v(emp.Department) : '';
    document.getElementById('emp-pos').value = emp ? v(emp.Position) : '';
    document.getElementById('emp-plant').value = emp ? v(emp.Plant, 'Plant 1') : 'Plant 1';
    document.getElementById('emp-phone').value = emp ? v(emp.Phone) : '';
    document.getElementById('emp-email').value = emp ? v(emp.Email) : '';

    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('employeeModal'));
    modal.show();
  },

  async saveEmployee() {
    const employeeId = document.getElementById('emp-id')?.value;
    const customEmployeeId = document.getElementById('emp-custom-id')?.value?.trim();
    const prefix = document.getElementById('emp-prefix')?.value;
    const firstName = document.getElementById('emp-firstname')?.value;
    const lastName = document.getElementById('emp-lastname')?.value;
    const department = document.getElementById('emp-dept')?.value;
    const position = document.getElementById('emp-pos')?.value;
    const plant = document.getElementById('emp-plant')?.value;
    const phone = document.getElementById('emp-phone')?.value;
    const email = document.getElementById('emp-email')?.value;

    if (!firstName || !lastName) {
      App.showError('กรุณากรอกชื่อและนามสกุลพนักงาน');
      return;
    }

    try {
      App.showLoading('กำลังบันทึกข้อมูลพนักงาน...');
      await API.saveEmployee({
        employeeId,
        customEmployeeId,
        prefix,
        firstName,
        lastName,
        department,
        position,
        plant,
        phone,
        email
      });
      App.closeLoading();
      bootstrap.Modal.getInstance(document.getElementById('employeeModal'))?.hide();
      App.showToast('บันทึกข้อมูลพนักงานสำเร็จ', 'success');
      this.loadEmployees();
    } catch (e) {
      App.closeLoading();
      App.showError('บันทึกไม่สำเร็จ', e.message);
    }
  },

  async deleteEmployee(empId, name) {
    const confirmed = await App.confirm('ยืนยันการลบพนักงาน', `คุณต้องการลบข้อมูลพนักงาน ${name} (${empId}) ใช่หรือไม่? (ช่องจอดรถของพนักงานจะถูกคืนอัตโนมัติ)`);
    if (!confirmed) return;

    try {
      App.showLoading('กำลังลบข้อมูล...');
      await API.deleteEmployee(empId);
      App.closeLoading();
      App.showToast('ลบข้อมูลเรียบร้อยแล้ว', 'success');
      this.loadEmployees();
    } catch (e) {
      App.closeLoading();
      App.showError('ลบไม่สำเร็จ', e.message);
    }
  },

  // ===================== 4. ข้อมูลอาคาร (Buildings) =====================
  async loadBuildings() {
    const container = document.getElementById('buildings-list-container');
    if (container) container.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary"></div></div>';

    try {
      const buildings = await API.getBuildings();
      this.cachedBuildings = buildings || [];

      if (!container) return;
      if (buildings.length === 0) {
        container.innerHTML = '<p class="text-muted text-center py-4">ไม่พบข้อมูลอาคาร</p>';
        return;
      }

      container.innerHTML = buildings.map(b => `
        <div class="col-md-6 mb-3">
          <div class="card border-0 rounded-4 p-3 shadow-sm h-100">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <div>
                <h5 class="fw-bold text-dark mb-0">${App.escHtml(b.BuildingName)}</h5>
                <span class="badge bg-primary-subtle text-primary">รหัสอาคาร: ${App.escHtml(b.BuildingCode)}</span>
              </div>
              <button class="btn btn-sm btn-outline-secondary" onclick="Admin.openBuildingModal('${App.escAttr(b.BuildingID)}')">
                <i class="bi bi-pencil"></i> แก้ไข
              </button>
            </div>
            <p class="text-muted small mb-2">${App.escHtml(b.Location || 'ไม่ระบุสถานที่')}</p>
            <div class="d-flex gap-3 small text-secondary">
              <span><i class="bi bi-layers me-1"></i>${App.escHtml(b.NumberOfFloors)} ชั้น</span>
              <span><i class="bi bi-door-open me-1"></i>${App.escHtml(b.TotalRooms || 0)} ห้อง</span>
              <span>${App.getStatusBadge(b.Status)}</span>
            </div>
          </div>
        </div>
      `).join('');
    } catch (e) {
      if (container) container.innerHTML = `<div class="text-danger text-center py-4">${App.escHtml(e.message)}</div>`;
    }
  },

  async openBuildingModal(bldId = null) {
    let bld = null;
    if (bldId) {
      bld = this.cachedBuildings.find(b => this._idEquals(b.BuildingID, bldId));
    }

    const v = (x, def = '') => (x === undefined || x === null) ? def : x;
    document.getElementById('bld-id').value = bld ? bld.BuildingID : '';
    document.getElementById('bld-code').value = bld ? v(bld.BuildingCode) : '';
    document.getElementById('bld-name').value = bld ? v(bld.BuildingName) : '';
    document.getElementById('bld-location').value = bld ? v(bld.Location) : '';
    document.getElementById('bld-floors').value = bld ? v(bld.NumberOfFloors, '2') : '2';
    document.getElementById('bld-remark').value = bld ? v(bld.Remark) : '';

    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('buildingModal'));
    modal.show();
  },

  async saveBuilding() {
    const buildingId = document.getElementById('bld-id')?.value;
    const buildingCode = document.getElementById('bld-code')?.value;
    const buildingName = document.getElementById('bld-name')?.value;
    const location = document.getElementById('bld-location')?.value;
    const numberOfFloors = document.getElementById('bld-floors')?.value;
    const remark = document.getElementById('bld-remark')?.value;

    if (!buildingCode || !buildingName) {
      App.showError('กรุณากรอกรหัสอาคารและชื่ออาคาร');
      return;
    }

    try {
      App.showLoading('กำลังบันทึกข้อมูลอาคาร...');
      await API.saveBuilding({
        buildingId,
        buildingCode,
        buildingName,
        location,
        numberOfFloors: Number(numberOfFloors) || 2,
        remark
      });
      App.closeLoading();
      bootstrap.Modal.getInstance(document.getElementById('buildingModal'))?.hide();
      App.showToast('บันทึกอาคารสำเร็จ', 'success');
      this.loadBuildings();
    } catch (e) {
      App.closeLoading();
      App.showError('บันทึกไม่สำเร็จ', e.message);
    }
  },

  // ===================== 6. ที่จอดรถ (Parking) =====================
  cachedParking: [],
  _assignEmployeeMap: {},

  async loadParking() {
    const tableBody = document.getElementById('parking-table-body');
    if (tableBody) tableBody.innerHTML = '<tr><td colspan="8" class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary me-2"></div>กำลังโหลดข้อมูลที่จอดรถ...</td></tr>';
    try {
      this.cachedParking = (await API.getParking()) || [];
      this.renderParkingSummary();
      this.filterParking();
    } catch (e) {
      if (tableBody) tableBody.innerHTML = `<tr><td colspan="8" class="text-danger text-center py-4">${App.escHtml(e.message)}</td></tr>`;
    }
  },

  renderParkingSummary() {
    const el = document.getElementById('parking-summary');
    if (!el) return;
    const list = this.cachedParking;
    const count = (type, st) => list.filter(p => (!type || p.VehicleType === type) && (!st || p.Status === st)).length;
    const box = (label, value, cls = 'text-dark', sub = '') => `
      <div class="col-6 col-md-3">
        <div class="parking-kpi">
          <small class="text-muted d-block">${label}</small>
          <div class="fs-4 fw-bold ${cls}">${value}</div>
          ${sub ? `<small class="text-muted">${sub}</small>` : ''}
        </div>
      </div>`;
    const review = list.filter(p => p.needsReview).length;
    el.innerHTML =
      box('ช่องจอดทั้งหมด', list.length, 'text-dark', `ว่าง ${count('', 'Available')} · มีผู้จอง ${count('', 'Occupied')}`) +
      box('<i class="bi bi-car-front-fill"></i> รถยนต์', `${count('Car', 'Occupied')} / ${count('Car', '')}`, 'text-primary', `ว่าง ${count('Car', 'Available')} ช่อง`) +
      box('<i class="bi bi-bicycle"></i> มอเตอร์ไซค์', `${count('Motorcycle', 'Occupied')} / ${count('Motorcycle', '')}`, 'text-primary', `ว่าง ${count('Motorcycle', 'Available')} ช่อง`) +
      box('ต้องตรวจสอบ', review, review ? 'text-warning' : 'text-success', review ? 'ผู้จองไม่ได้พักอยู่แล้ว' : 'ข้อมูลปกติ');
  },

  filterParking() {
    const kw = (document.getElementById('search-parking')?.value || '').trim().toLowerCase();
    const type = document.getElementById('filter-parking-type')?.value || '';
    const st = document.getElementById('filter-parking-status')?.value || '';
    const rows = this.cachedParking.filter(p => {
      if (type && p.VehicleType !== type) return false;
      if (st && p.Status !== st) return false;
      if (!kw) return true;
      return [p.SlotNumber, p.Zone, p.LicensePlate, p.VehicleModel, p.EmployeeID, p.ownerName, p.roomNumber, p.buildingName]
        .some(v => String(v || '').toLowerCase().includes(kw));
    });
    this.renderParkingTable(rows);
  },

  renderParkingTable(rows) {
    const tableBody = document.getElementById('parking-table-body');
    if (!tableBody) return;
    if (!rows || rows.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">ไม่พบข้อมูลช่องจอดรถ</td></tr>';
      return;
    }
    tableBody.innerHTML = rows.map(p => {
      const occ = p.Status === 'Occupied';
      const moto = p.VehicleType === 'Motorcycle';
      const sid = App.escAttr(p.SlotID), sno = App.escAttr(p.SlotNumber);
      const actions = occ
        ? `<button class="btn btn-sm btn-outline-danger me-1" onclick="Admin.releaseParking('${sid}', '${sno}', '${App.escAttr(p.ownerName)}')" title="คืนช่องจอด"><i class="bi bi-x-circle me-1"></i>คืนช่อง</button>`
        : (p.Status === 'Available'
            ? `<button class="btn btn-sm btn-success me-1" onclick="Admin.openAssignParkingModal('${sid}')" title="จองช่องจอด"><i class="bi bi-check2-circle me-1"></i>จอง</button>`
            : '');
      return `
        <tr class="${p.needsReview ? 'parking-row-warning' : ''}">
          <td>
            <strong class="text-dark">${App.escHtml(p.SlotNumber)}</strong>
            <div class="small text-muted">${App.escHtml(p.Zone || '-')}</div>
          </td>
          <td><i class="bi ${moto ? 'bi-bicycle' : 'bi-car-front-fill'} me-1 text-secondary"></i>${App.escHtml(App.vehicleLabel(p.VehicleType))}</td>
          <td>${App.getStatusBadge(p.Status === 'Maintenance' ? 'Maintenance' : (occ ? 'Occupied' : 'Available'))}</td>
          <td>${occ ? `
            <div class="fw-semibold text-dark">${App.escHtml(p.ownerName)}</div>
            <small class="text-muted">${App.escHtml(p.EmployeeID)} | ${App.escHtml(p.ownerDepartment || '-')} | โทร: ${App.escHtml(p.ownerPhone || '-')}</small>
            ${p.needsReview ? '<div class="small text-warning fw-semibold"><i class="bi bi-exclamation-triangle-fill me-1"></i>ผู้จองไม่ได้พักอยู่แล้ว ควรคืนช่อง</div>' : ''}
          ` : '<span class="text-muted">-</span>'}</td>
          <td>${occ ? `<strong>ห้อง ${App.escHtml(p.roomNumber || '-')}</strong><div class="small text-muted">${App.escHtml(p.buildingName || '')}</div>` : '<span class="text-muted">-</span>'}</td>
          <td>${occ ? `<div class="fw-semibold">${App.escHtml(p.LicensePlate || '-')}</div><small class="text-muted">${App.escHtml(p.VehicleModel || '')}</small>` : '<span class="text-muted">-</span>'}</td>
          <td>${occ ? App.formatDate(p.AssignedDate) : '-'}</td>
          <td class="text-nowrap">
            ${actions}
            <button class="btn btn-sm btn-outline-secondary me-1" onclick="Admin.openParkingSlotModal('${sid}')" title="แก้ไขช่องจอด"><i class="bi bi-pencil"></i></button>
            ${occ ? '' : `<button class="btn btn-sm btn-outline-danger" onclick="Admin.deleteParkingSlot('${sid}', '${sno}')" title="ลบช่องจอด"><i class="bi bi-trash"></i></button>`}
          </td>
        </tr>`;
    }).join('');
  },

  openParkingSlotModal(slotId = null) {
    const p = slotId ? this.cachedParking.find(x => this._idEquals(x.SlotID, slotId)) : null;
    const occ = !!p && p.Status === 'Occupied';
    document.getElementById('ps-id').value = p ? p.SlotID : '';
    document.getElementById('ps-number').value = p ? p.SlotNumber : '';
    document.getElementById('ps-zone').value = p ? (p.Zone || '') : '';
    document.getElementById('ps-type').value = p ? p.VehicleType : 'Car';
    document.getElementById('ps-status').value = p && p.Status === 'Maintenance' ? 'Maintenance' : 'Available';
    document.getElementById('ps-remark').value = p ? (p.Remark || '') : '';
    document.getElementById('ps-type').disabled = occ;
    document.getElementById('ps-status').disabled = occ;
    document.getElementById('ps-locked-note').textContent = occ ? 'ช่องนี้มีผู้จองอยู่ จึงเปลี่ยนประเภท/สถานะไม่ได้ (คืนช่องก่อน)' : '';
    bootstrap.Modal.getOrCreateInstance(document.getElementById('parkingSlotModal')).show();
  },

  async saveParkingSlot() {
    const slotNumber = document.getElementById('ps-number')?.value?.trim();
    if (!slotNumber) {
      App.showError('กรุณาระบุเลขช่องจอดรถ', 'เช่น P-01 (รถยนต์) หรือ M-01 (มอเตอร์ไซค์)');
      return;
    }
    try {
      App.showLoading('กำลังบันทึกช่องจอด...');
      await API.saveParkingSlot({
        slotId: document.getElementById('ps-id').value,
        slotNumber,
        zone: document.getElementById('ps-zone').value,
        vehicleType: document.getElementById('ps-type').value,
        status: document.getElementById('ps-status').value,
        remark: document.getElementById('ps-remark').value
      });
      App.closeLoading();
      bootstrap.Modal.getInstance(document.getElementById('parkingSlotModal'))?.hide();
      App.showToast('บันทึกช่องจอดสำเร็จ', 'success');
      this.loadParking();
    } catch (e) {
      App.closeLoading();
      App.showError('บันทึกไม่สำเร็จ', e.message);
    }
  },

  async deleteParkingSlot(slotId, slotNumber) {
    const ok = await App.confirm('ยืนยันการลบช่องจอด', `ต้องการลบช่องจอด ${slotNumber} ใช่หรือไม่?`);
    if (!ok) return;
    try {
      App.showLoading('กำลังลบช่องจอด...');
      await API.deleteParkingSlot(slotId);
      App.closeLoading();
      App.showToast('ลบช่องจอดสำเร็จ', 'success');
      this.loadParking();
    } catch (e) {
      App.closeLoading();
      App.showError('ลบไม่สำเร็จ', e.message);
    }
  },

  async openAssignParkingModal(slotId) {
    const slot = this.cachedParking.find(x => this._idEquals(x.SlotID, slotId));
    if (!slot) return;
    try {
      App.showLoading('กำลังเตรียมรายชื่อพนักงาน...');
      const emps = (await API.getEmployees()) || [];
      App.closeLoading();

      this._assignEmployeeMap = {};
      const resident = emps.filter(e => e.isAccommodated);
      document.getElementById('ap-employee-list').innerHTML = resident.map(e => {
        const label = `${e.EmployeeID} - ${e.FullName} (ห้อง ${e.currentRoomNumber})`;
        this._assignEmployeeMap[label] = e;
        return `<option value="${App.escHtml(label)}"></option>`;
      }).join('');

      document.getElementById('ap-slot-id').value = slot.SlotID;
      document.getElementById('ap-slot-info').textContent = `${slot.SlotNumber} · ${App.vehicleLabel(slot.VehicleType)} · ${slot.Zone || '-'}`;
      document.getElementById('ap-employee-input').value = '';
      document.getElementById('ap-employee-id').value = '';
      document.getElementById('ap-room-info').value = '';
      document.getElementById('ap-plate').value = '';
      document.getElementById('ap-model').value = '';
      document.getElementById('ap-date').value = App.todayStr();
      document.getElementById('ap-remark').value = '';
      bootstrap.Modal.getOrCreateInstance(document.getElementById('assignParkingModal')).show();
    } catch (e) {
      App.closeLoading();
      App.showError('ไม่สามารถโหลดรายชื่อพนักงานได้', e.message);
    }
  },

  onAssignEmployeeInput() {
    const emp = this._assignEmployeeMap[document.getElementById('ap-employee-input').value];
    document.getElementById('ap-employee-id').value = emp ? emp.EmployeeID : '';
    document.getElementById('ap-room-info').value = emp ? `ห้อง ${emp.currentRoomNumber}` : '';
  },

  async submitAssignParking() {
    const slotId = document.getElementById('ap-slot-id').value;
    const employeeId = document.getElementById('ap-employee-id').value;
    const licensePlate = document.getElementById('ap-plate').value.trim();
    if (!employeeId) {
      App.showError('กรุณาเลือกพนักงานผู้จอง', 'พิมพ์รหัสหรือชื่อ แล้วเลือกจากรายการที่แสดง');
      return;
    }
    if (!licensePlate) {
      App.showError('กรุณากรอกทะเบียนรถ');
      return;
    }
    try {
      App.showLoading('กำลังบันทึกการจอง...');
      await API.assignParking({
        slotId,
        employeeId,
        licensePlate,
        vehicleModel: document.getElementById('ap-model').value.trim(),
        assignedDate: document.getElementById('ap-date').value,
        remark: document.getElementById('ap-remark').value.trim()
      });
      App.closeLoading();
      bootstrap.Modal.getInstance(document.getElementById('assignParkingModal'))?.hide();
      App.showToast('จองช่องจอดรถสำเร็จ', 'success');
      this.loadParking();
    } catch (e) {
      App.closeLoading();
      App.showError('จองไม่สำเร็จ', e.message);
    }
  },

  async releaseParking(slotId, slotNumber, ownerName) {
    const ok = await App.confirm('ยืนยันการคืนช่องจอด', `ต้องการคืนช่องจอด ${slotNumber} ของ ${ownerName} ใช่หรือไม่?`, 'คืนช่องจอด');
    if (!ok) return;
    try {
      App.showLoading('กำลังคืนช่องจอด...');
      await API.releaseParking({ slotId });
      App.closeLoading();
      App.showToast(`คืนช่องจอด ${slotNumber} สำเร็จ`, 'success');
      this.loadParking();
    } catch (e) {
      App.closeLoading();
      App.showError('คืนช่องจอดไม่สำเร็จ', e.message);
    }
  },

  // ===================== 5. การตั้งค่า (Settings) =====================
  async loadSettings() {
    const urlInput = document.getElementById('setting-api-url');
    if (urlInput) {
      urlInput.value = API.API_URL;
      const tokenInput = document.getElementById('setting-api-token');
      if (tokenInput) tokenInput.value = API.getToken();
    }

    try {
      const s = await API.getSettings();
      if (s) {
        if (document.getElementById('setting-system-name')) document.getElementById('setting-system-name').value = s.SYSTEM_NAME || 'ระบบบริหารหอพักพนักงาน';
        if (document.getElementById('setting-company-name')) document.getElementById('setting-company-name').value = s.COMPANY_NAME || 'Bitwise Group';
      }
    } catch (e) {
      console.warn('Could not load remote settings', e);
    }
  },

  saveApiUrl() {
    const url = document.getElementById('setting-api-url')?.value?.trim();
    if (!url) {
      App.showError('กรุณากรอก Web App URL');
      return;
    }
    if (!/^https:\/\/script\.google(usercontent)?\.com\/.+\/exec$/.test(url)) {
      App.showError('รูปแบบ URL ไม่ถูกต้อง', 'ต้องเป็น URL ที่ได้จากการ Deploy (ขึ้นต้น https://script.google.com/... และลงท้ายด้วย /exec ไม่ใช่ /dev)');
      return;
    }
    API.setApiUrl(url);
    API.setToken(document.getElementById('setting-api-token')?.value || '');
    App.showToast('บันทึกการเชื่อมต่อเรียบร้อยแล้ว', 'success');
  },

  async testApiConnection() {
    const url = document.getElementById('setting-api-url')?.value?.trim();
    if (url) API.setApiUrl(url);
    API.setToken(document.getElementById('setting-api-token')?.value || '');

    try {
      App.showLoading('กำลังทดสอบการเชื่อมต่อ Google Sheets API...');
      const res = await API.getRooms();
      App.closeLoading();
      App.showSuccess('เชื่อมต่อสำเร็จ!', `เชื่อมต่อกับ Google Apps Script เรียบร้อยแล้ว พบข้อมูลห้องพักทั้งหมด ${res.length} ห้อง`);
    } catch (e) {
      App.closeLoading();
      App.showError('เชื่อมต่อไม่สำเร็จ', e.message + '\n\nกรุณาตรวจสอบว่า Deploy เป็น Web App โดยตั้งค่า Who has access: Anyone หรือยัง');
    }
  },

  async saveSettings() {
    const systemName = document.getElementById('setting-system-name')?.value;
    const companyName = document.getElementById('setting-company-name')?.value;

    try {
      App.showLoading('กำลังบันทึกการตั้งค่า...');
      await API.saveSettings({
        SYSTEM_NAME: systemName,
        COMPANY_NAME: companyName
      });
      App.closeLoading();
      App.showToast('บันทึกการตั้งค่าสำเร็จ', 'success');
    } catch (e) {
      App.closeLoading();
      App.showError('บันทึกการตั้งค่าไม่สำเร็จ', e.message);
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  Admin.init();
});