const Admin = {
  currentTab: 'occupancy',
  cachedEmployees: [],
  cachedRooms: [],
  cachedBuildings: [],
  cachedFloors: [],

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
    const bedId = params.get('bedId') || '';
    const bedNum = params.get('bedNum') || '';
    const tab = params.get('tab');

    if (tab) {
      this.currentTab = tab;
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
        OccupancyWorkflow.openTransferModal(occId, empName, roomId, bedId, roomNum);
      }, 500);
    } else if (action === 'repair') {
      this.currentTab = 'repairs';
      setTimeout(() => {
        this.openRepairModal(roomId);
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
      case 'employees':
        this.loadEmployees();
        break;
      case 'buildings':
        this.loadBuildings();
        break;
      case 'rooms':
        this.loadRooms();
        break;
      case 'requests':
        this.loadRequests();
        break;
      case 'repairs':
        this.loadRepairs();
        break;
      case 'maintenance':
        this.loadMaintenance();
        break;
      case 'assets':
        this.loadAssets();
        break;
      case 'keys':
        this.loadKeys();
        break;
      case 'reports':
        Reports.generateReport('rooms');
        break;
      case 'audit':
        this.loadAuditLogs();
        break;
      case 'settings':
        this.loadSettings();
        break;
    }
  },

  async loadOccupancy() {
    const tableBody = document.getElementById('occupancy-table-body');
    if (tableBody) tableBody.innerHTML = '<tr><td colspan="8" class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary me-2"></div>กำลังโหลดข้อมูลผู้พักอาศัย...</td></tr>';

    try {
      const rooms = await API.getRooms();
      this.cachedRooms = rooms;

      let rows = [];
      rooms.forEach(r => {
        r.occupants.forEach(o => {
          rows.push({
            ...o,
            buildingName: r.buildingName,
            roomNumber: r.roomNumber,
            roomId: r.roomId
          });
        });
      });

      if (tableBody) {
        if (rows.length === 0) {
          tableBody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">ยังไม่มีผู้เข้าพักในระบบ</td></tr>';
          return;
        }

        tableBody.innerHTML = rows.map(o => `
          <tr>
            <td><strong class="text-primary">${o.employeeId}</strong></td>
            <td>
              <div class="fw-semibold text-dark">${o.fullName}</div>
              <small class="text-muted">${o.department} | ${o.phone}</small>
            </td>
            <td>${o.buildingName}</td>
            <td><strong>ห้อง ${o.roomNumber}</strong></td>
            <td><span class="badge bg-secondary">เตียง ${o.bedNumber}</span></td>
            <td>${App.formatDate(o.checkInDate)}</td>
            <td>${App.formatDate(o.expectedCheckOutDate)}</td>
            <td>
              <button class="btn btn-sm btn-outline-primary me-1" onclick="OccupancyWorkflow.openTransferModal('${o.occupancyId}', '${o.fullName}', '${o.roomId}', '${o.bedId}', '${o.roomNumber}')" title="ย้ายห้อง">
                <i class="bi bi-arrow-left-right"></i> ย้ายห้อง
              </button>
              <button class="btn btn-sm btn-outline-danger" onclick="OccupancyWorkflow.openCheckOutModal('${o.occupancyId}', '${o.fullName}', '${o.roomNumber}', '${o.bedNumber}')" title="เช็คเอาท์">
                <i class="bi bi-box-arrow-right"></i> เช็คเอาท์
              </button>
            </td>
          </tr>
        `).join('');
      }
    } catch (e) {
      if (tableBody) tableBody.innerHTML = `<tr><td colspan="8" class="text-danger text-center py-4">${e.message}</td></tr>`;
    }
  },

  async loadEmployees() {
    const tableBody = document.getElementById('employees-table-body');
    if (tableBody) tableBody.innerHTML = '<tr><td colspan="7" class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary me-2"></div>กำลังโหลดรายชื่อพนักงาน...</td></tr>';

    // ล้างช่องค้นหาทุกครั้งที่โหลดข้อมูลใหม่ เพื่อไม่ให้ผลค้นหาเก่าค้าง
    const searchInput = document.getElementById('search-employee');
    if (searchInput) searchInput.value = '';
    this.setEmployeeResultCount('');

    try {
      const emps = await API.getEmployees();
      this.cachedEmployees = emps || [];
      this.renderEmployeesTable(this.cachedEmployees);
    } catch (e) {
      if (tableBody) tableBody.innerHTML = `<tr><td colspan="7" class="text-danger text-center py-4">${e.message}</td></tr>`;
    }
  },

  /**
   * ค้นหาพนักงานจาก cachedEmployees ด้วยรหัสพนักงาน หรือ ชื่อ-นามสกุล
   * (ค้นหาได้ทั้งชื่อจริงอย่างเดียว นามสกุลอย่างเดียว หรือชื่อเต็ม รองรับพิมพ์บางส่วนของคำ)
   */
  filterEmployees() {
    const searchVal = (document.getElementById('search-employee')?.value || '').trim().toLowerCase();

    if (!searchVal) {
      this.renderEmployeesTable(this.cachedEmployees);
      this.setEmployeeResultCount('');
      return;
    }

    const filtered = this.cachedEmployees.filter(e => {
      const id = String(e.EmployeeID || '').toLowerCase();
      const firstName = String(e.FirstName || '').toLowerCase();
      const lastName = String(e.LastName || '').toLowerCase();
      const fullName = String(e.FullName || `${e.FirstName || ''} ${e.LastName || ''}`).toLowerCase();

      return id.includes(searchVal) ||
             firstName.includes(searchVal) ||
             lastName.includes(searchVal) ||
             fullName.includes(searchVal);
    });

    this.renderEmployeesTable(filtered);
    this.setEmployeeResultCount(`พบ ${filtered.length} รายการ จากทั้งหมด ${this.cachedEmployees.length} คน`);
  },

  setEmployeeResultCount(text) {
    const el = document.getElementById('employee-search-result-count');
    if (el) el.textContent = text;
  },

  renderEmployeesTable(emps) {
    const tableBody = document.getElementById('employees-table-body');
    if (!tableBody) return;

    if (!emps || emps.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">ไม่พบข้อมูลพนักงานที่ตรงกับการค้นหา</td></tr>';
      return;
    }

    tableBody.innerHTML = emps.map(e => `
      <tr>
        <td><strong>${e.EmployeeID}</strong></td>
        <td>${e.Prefix} ${e.FirstName} ${e.LastName}</td>
        <td>${e.Department || '-'}</td>
        <td>${e.Position || '-'}</td>
        <td>${e.Phone || '-'}</td>
        <td>${e.Email || '-'}</td>
        <td>
          <button class="btn btn-sm btn-outline-secondary me-1" onclick="Admin.openEmployeeModal('${e.EmployeeID}')">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger" onclick="Admin.deleteEmployee('${e.EmployeeID}', '${e.FullName}')">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `).join('');
  },

  /**
   * เปิดฟอร์มแก้ไข/เพิ่มพนักงาน
   *
   * แก้บั๊ก: เดิมเทียบ e.EmployeeID === empId ตรงๆ ถ้ามีช่องว่างแฝงในเซลล์
   * Google Sheet หรือ cache ยังไม่อัปเดต จะหาไม่เจอ (find() คืนค่า undefined)
   * แล้วฟอร์มจะถูกเซ็ตเป็นค่าว่างทุกช่องแบบเงียบๆ โดยไม่มี error ใดๆ
   *
   * ตอนนี้: 1) เทียบ ID แบบ trim string กันปัญหาช่องว่าง/type ไม่ตรง
   *         2) ถ้าหาไม่เจอในแคช ให้ลองดึงข้อมูลล่าสุดจาก Sheet มาเช็คอีกครั้ง
   *         3) ถ้ายังไม่เจอจริงๆ แจ้ง error ชัดเจนแทนการเปิดฟอร์มเปล่า
   */
  async openEmployeeModal(empId = null) {
    let emp = null;

    if (empId) {
      emp = this.cachedEmployees.find(e => this._idEquals(e.EmployeeID, empId));

      if (!emp) {
        // ข้อมูลในแคชอาจไม่ตรงกับตารางจริง ลองโหลดข้อมูลล่าสุดอีกครั้งก่อนสรุปว่าไม่พบ
        try {
          const freshList = await API.getEmployees();
          this.cachedEmployees = freshList || [];
          emp = this.cachedEmployees.find(e => this._idEquals(e.EmployeeID, empId));
        } catch (err) {
          console.error('ไม่สามารถโหลดข้อมูลพนักงานล่าสุดได้:', err);
        }
      }

      if (!emp) {
        App.showError(
          'ไม่พบข้อมูลพนักงาน',
          `ไม่สามารถดึงข้อมูลพนักงานรหัส "${empId}" ได้ อาจเป็นเพราะข้อมูลถูกแก้ไข/ลบไปแล้ว กรุณากดรีเฟรชหน้าแล้วลองใหม่อีกครั้ง`
        );
        console.warn('openEmployeeModal: ไม่พบ EmployeeID ที่ตรงกันใน cachedEmployees', {
          ต้องการหา: empId,
          รายการที่มีในแคช: this.cachedEmployees.map(e => e.EmployeeID)
        });
        return;
      }
    }

    document.getElementById('emp-id').value = emp ? emp.EmployeeID : '';
    document.getElementById('emp-prefix').value = emp ? emp.Prefix : 'นาย';
    document.getElementById('emp-firstname').value = emp ? emp.FirstName : '';
    document.getElementById('emp-lastname').value = emp ? emp.LastName : '';
    document.getElementById('emp-dept').value = emp ? emp.Department : '';
    document.getElementById('emp-pos').value = emp ? emp.Position : '';
    document.getElementById('emp-plant').value = emp ? emp.Plant : 'Plant 1';
    document.getElementById('emp-phone').value = emp ? emp.Phone : '';
    document.getElementById('emp-email').value = emp ? emp.Email : '';

    const modal = new bootstrap.Modal(document.getElementById('employeeModal'));
    modal.show();
  },

  async saveEmployee() {
    const employeeId = document.getElementById('emp-id')?.value;
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
    const confirmed = await App.confirm('ยืนยันการลบพนักงาน', `คุณต้องการลบข้อมูลพนักงาน ${name} (${empId}) ใช่หรือไม่?`);
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

  async loadBuildings() {
    const container = document.getElementById('buildings-list-container');
    if (container) container.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary"></div></div>';

    try {
      const buildings = await API.getBuildings();
      this.cachedBuildings = buildings;

      if (container) {
        if (buildings.length === 0) {
          container.innerHTML = '<p class="text-muted text-center py-4">ไม่พบข้อมูลอาคาร</p>';
          return;
        }

        container.innerHTML = buildings.map(b => `
          <div class="col-md-6 mb-3">
            <div class="card border rounded-3 p-3 shadow-sm h-100">
              <div class="d-flex justify-content-between align-items-start mb-2">
                <div>
                  <h5 class="fw-bold text-dark mb-0">${b.BuildingName}</h5>
                  <span class="badge bg-primary-subtle text-primary">รหัส: ${b.BuildingCode}</span>
                </div>
                <button class="btn btn-sm btn-outline-secondary" onclick="Admin.openBuildingModal('${b.BuildingID}')">
                  <i class="bi bi-pencil"></i> แก้ไข
                </button>
              </div>
              <p class="text-muted small mb-2">${b.Location || 'ไม่ระบุสถานที่'}</p>
              <div class="d-flex gap-3 small text-secondary">
                <span><i class="bi bi-layers me-1"></i>${b.NumberOfFloors} ชั้น</span>
                <span><i class="bi bi-door-open me-1"></i>${b.TotalRooms} ห้อง</span>
                <span>${App.getStatusBadge(b.Status)}</span>
              </div>
            </div>
          </div>
        `).join('');
      }
    } catch (e) {
      if (container) container.innerHTML = `<div class="text-danger text-center py-4">${e.message}</div>`;
    }
  },

  /**
   * เปิดฟอร์มแก้ไข/เพิ่มอาคาร (ใช้แนวทางป้องกันบั๊กเดียวกับ openEmployeeModal)
   */
  async openBuildingModal(bldId = null) {
    let bld = null;

    if (bldId) {
      bld = this.cachedBuildings.find(b => this._idEquals(b.BuildingID, bldId));

      if (!bld) {
        try {
          const freshList = await API.getBuildings();
          this.cachedBuildings = freshList || [];
          bld = this.cachedBuildings.find(b => this._idEquals(b.BuildingID, bldId));
        } catch (err) {
          console.error('ไม่สามารถโหลดข้อมูลอาคารล่าสุดได้:', err);
        }
      }

      if (!bld) {
        App.showError('ไม่พบข้อมูลอาคาร', `ไม่สามารถดึงข้อมูลอาคารรหัส "${bldId}" ได้ กรุณากดรีเฟรชหน้าแล้วลองใหม่อีกครั้ง`);
        return;
      }
    }

    document.getElementById('bld-id').value = bld ? bld.BuildingID : '';
    document.getElementById('bld-code').value = bld ? bld.BuildingCode : '';
    document.getElementById('bld-name').value = bld ? bld.BuildingName : '';
    document.getElementById('bld-location').value = bld ? bld.Location : '';
    document.getElementById('bld-floors').value = bld ? bld.NumberOfFloors : '2';
    document.getElementById('bld-remark').value = bld ? bld.Remark : '';

    const modal = new bootstrap.Modal(document.getElementById('buildingModal'));
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
        numberOfFloors,
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

  async loadRooms() {
    const tableBody = document.getElementById('rooms-table-body');
    if (tableBody) tableBody.innerHTML = '<tr><td colspan="8" class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary me-2"></div>กำลังโหลดข้อมูลห้องพัก...</td></tr>';

    try {
      const [rooms, buildings] = await Promise.all([
        API.getRooms(),
        API.getBuildings()
      ]);
      this.cachedRooms = rooms;
      this.cachedBuildings = buildings;

      if (tableBody) {
        if (rooms.length === 0) {
          tableBody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">ไม่พบห้องพักในระบบ</td></tr>';
          return;
        }

        tableBody.innerHTML = rooms.map(r => `
          <tr>
            <td><strong>${r.roomNumber}</strong></td>
            <td>${r.buildingName}</td>
            <td>${r.roomType}</td>
            <td>${r.capacity} คน</td>
            <td>
              <span class="fw-bold">${r.occupiedBedsCount}</span> / ${r.activeBedsCount} 
              <small class="text-success ms-1">(ว่าง ${r.availableBedsCount})</small>
            </td>
            <td>${r.gender === 'Male' ? 'ชาย' : (r.gender === 'Female' ? 'หญิง' : 'ทั่วไป')}</td>
            <td>${App.getStatusBadge(r.computedStatus)}</td>
            <td>
              <button class="btn btn-sm btn-outline-secondary me-1" onclick="Admin.openRoomModal('${r.roomId}')">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-sm btn-outline-danger" onclick="Admin.deleteRoom('${r.roomId}', '${r.roomNumber}')">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>
        `).join('');
      }
    } catch (e) {
      if (tableBody) tableBody.innerHTML = `<tr><td colspan="8" class="text-danger text-center py-4">${e.message}</td></tr>`;
    }
  },

  /**
   * เปิดฟอร์มแก้ไข/เพิ่มห้องพัก (ใช้แนวทางป้องกันบั๊กเดียวกับ openEmployeeModal)
   */
  async openRoomModal(roomId = null) {
    let room = null;

    if (roomId) {
      room = this.cachedRooms.find(r => this._idEquals(r.roomId, roomId));

      if (!room) {
        try {
          const [freshRooms, freshBuildings] = await Promise.all([API.getRooms(), API.getBuildings()]);
          this.cachedRooms = freshRooms || [];
          this.cachedBuildings = freshBuildings || [];
          room = this.cachedRooms.find(r => this._idEquals(r.roomId, roomId));
        } catch (err) {
          console.error('ไม่สามารถโหลดข้อมูลห้องพักล่าสุดได้:', err);
        }
      }

      if (!room) {
        App.showError('ไม่พบข้อมูลห้องพัก', `ไม่สามารถดึงข้อมูลห้องรหัส "${roomId}" ได้ กรุณากดรีเฟรชหน้าแล้วลองใหม่อีกครั้ง`);
        return;
      }
    }

    // เติมตัวเลือกอาคาร
    const bldSelect = document.getElementById('room-building');
    if (bldSelect) {
      bldSelect.innerHTML = '<option value="">-- เลือกอาคาร --</option>';
      this.cachedBuildings.forEach(b => {
        const isSel = room && this._idEquals(room.buildingId, b.BuildingID) ? 'selected' : '';
        bldSelect.innerHTML += `<option value="${b.BuildingID}" ${isSel}>${b.BuildingName}</option>`;
      });
    }

    document.getElementById('room-id').value = room ? room.roomId : '';
    document.getElementById('room-number').value = room ? room.roomNumber : '';
    document.getElementById('room-type').value = room ? room.roomType : 'Double';
    document.getElementById('room-capacity').value = room ? room.capacity : '2';
    document.getElementById('room-gender').value = room ? room.gender : 'Male';
    document.getElementById('room-rate').value = room ? (room.monthlyRate || 0) : '1500';
    document.getElementById('room-has-ac').checked = room ? !!room.hasAirConditioner : true;
    document.getElementById('room-has-furn').checked = room ? !!room.hasFurniture : true;
    document.getElementById('room-remark').value = room ? (room.remark || '') : '';

    const modal = new bootstrap.Modal(document.getElementById('roomModal'));
    modal.show();
  },

  async saveRoom() {
    const roomId = document.getElementById('room-id')?.value;
    const buildingId = document.getElementById('room-building')?.value;
    const roomNumber = document.getElementById('room-number')?.value;
    const roomType = document.getElementById('room-type')?.value;
    const capacity = document.getElementById('room-capacity')?.value;
    const gender = document.getElementById('room-gender')?.value;
    const monthlyRate = document.getElementById('room-rate')?.value;
    const hasAirConditioner = document.getElementById('room-has-ac')?.checked;
    const hasFurniture = document.getElementById('room-has-furn')?.checked;
    const remark = document.getElementById('room-remark')?.value;

    if (!buildingId || !roomNumber || !capacity) {
      App.showError('กรุณากรอกอาคาร เลขห้อง และความจุเตียง');
      return;
    }

    try {
      App.showLoading('กำลังบันทึกข้อมูลห้องพัก...');
      await API.saveRoom({
        roomId,
        buildingId,
        roomNumber,
        roomType,
        capacity,
        gender,
        monthlyRate,
        hasAirConditioner,
        hasFurniture,
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

  async loadRequests() {
    const tableBody = document.getElementById('requests-table-body');
    if (tableBody) tableBody.innerHTML = '<tr><td colspan="7" class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary me-2"></div>กำลังโหลดคำขอเข้าพัก...</td></tr>';

    try {
      const requests = await API.getRoomRequests();
      if (tableBody) {
        if (requests.length === 0) {
          tableBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">ไม่มีคำขอเข้าพักในระบบ</td></tr>';
          return;
        }

        tableBody.innerHTML = requests.map(r => `
          <tr>
            <td><strong>${r.RequestID}</strong></td>
            <td>${r.EmployeeID}</td>
            <td>${App.formatDate(r.RequestDate)}</td>
            <td>${r.PreferredBuilding || 'ไม่ระบุ'} (${r.PreferredRoomType})</td>
            <td>${r.Reason || '-'}</td>
            <td>${App.getStatusBadge(r.RequestStatus)}</td>
            <td>
              ${r.RequestStatus === 'Pending' ? `
                <button class="btn btn-sm btn-success me-1" onclick="Admin.updateRequestStatus('${r.RequestID}', 'Approved')" title="อนุมัติ">
                  <i class="bi bi-check-lg"></i> อนุมัติ
                </button>
                <button class="btn btn-sm btn-danger" onclick="Admin.updateRequestStatus('${r.RequestID}', 'Rejected')" title="ปฏิเสธ">
                  <i class="bi bi-x-lg"></i> ปฏิเสธ
                </button>
              ` : `<small class="text-muted">${r.ApprovedBy || 'ดำเนินการแล้ว'}</small>`}
            </td>
          </tr>
        `).join('');
      }
    } catch (e) {
      if (tableBody) tableBody.innerHTML = `<tr><td colspan="7" class="text-danger text-center py-4">${e.message}</td></tr>`;
    }
  },

  async updateRequestStatus(requestId, status) {
    const confirmed = await App.confirm(`ยืนยันการ${status === 'Approved' ? 'อนุมัติ' : 'ปฏิเสธ'}คำขอ`, `คุณต้องการ${status === 'Approved' ? 'อนุมัติ' : 'ปฏิเสธ'}คำขอนี้ใช่หรือไม่?`);
    if (!confirmed) return;

    try {
      App.showLoading('กำลังปรับปรุงสถานะ...');
      await API.updateRequestStatus({ requestId, status });
      App.closeLoading();
      App.showToast(`ปรับปรุงสถานะเป็น ${status} สำเร็จ`, 'success');
      this.loadRequests();
    } catch (e) {
      App.closeLoading();
      App.showError('ดำเนินการไม่สำเร็จ', e.message);
    }
  },

  async loadRepairs() {
    const tableBody = document.getElementById('repairs-table-body');
    if (tableBody) tableBody.innerHTML = '<tr><td colspan="8" class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary me-2"></div>กำลังโหลดงานแจ้งซ่อม...</td></tr>';

    try {
      const repairs = await API.getRepairRequests();
      if (tableBody) {
        if (repairs.length === 0) {
          tableBody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">ไม่มีรายการแจ้งซ่อม</td></tr>';
          return;
        }

        tableBody.innerHTML = repairs.map(r => `
          <tr>
            <td><strong>${r.RepairID}</strong></td>
            <td>ห้อง ${r.RoomID}</td>
            <td><span class="badge bg-secondary-subtle text-secondary">${r.IssueType}</span></td>
            <td>${r.Description || '-'}</td>
            <td><span class="badge ${r.Priority === 'Urgent' ? 'bg-danger' : (r.Priority === 'High' ? 'bg-warning text-dark' : 'bg-light text-dark')}">${r.Priority}</span></td>
            <td>${r.AssignedTo || '-'}</td>
            <td>${App.getStatusBadge(r.Status)}</td>
            <td>
              ${r.Status !== 'Completed' ? `
                <button class="btn btn-sm btn-outline-success" onclick="Admin.completeRepair('${r.RepairID}')">
                  <i class="bi bi-check2"></i> ปิดงาน
                </button>
              ` : '<small class="text-success"><i class="bi bi-check-all"></i> เสร็จสิ้น</small>'}
            </td>
          </tr>
        `).join('');
      }
    } catch (e) {
      if (tableBody) tableBody.innerHTML = `<tr><td colspan="8" class="text-danger text-center py-4">${e.message}</td></tr>`;
    }
  },

  openRepairModal(roomId = '') {
    document.getElementById('repair-room').value = roomId || '';
    document.getElementById('repair-type').value = 'Air Conditioner';
    document.getElementById('repair-priority').value = 'Medium';
    document.getElementById('repair-desc').value = '';
    const modal = new bootstrap.Modal(document.getElementById('repairModal'));
    modal.show();
  },

  async saveRepairRequest() {
    const roomId = document.getElementById('repair-room')?.value;
    const issueType = document.getElementById('repair-type')?.value;
    const priority = document.getElementById('repair-priority')?.value;
    const description = document.getElementById('repair-desc')?.value;

    if (!roomId || !description) {
      App.showError('กรุณากรอกเลขห้องและรายละเอียดปัญหา');
      return;
    }

    try {
      App.showLoading('กำลังบันทึกการแจ้งซ่อม...');
      await API.saveRepairRequest({
        roomId,
        issueType,
        priority,
        description
      });
      App.closeLoading();
      bootstrap.Modal.getInstance(document.getElementById('repairModal'))?.hide();
      App.showToast('ส่งแจ้งซ่อมเรียบร้อยแล้ว', 'success');
      this.loadRepairs();
    } catch (e) {
      App.closeLoading();
      App.showError('ส่งแจ้งซ่อมไม่สำเร็จ', e.message);
    }
  },

  async completeRepair(repairId) {
    const confirmed = await App.confirm('ยืนยันปิดงานซ่อม', 'บันทึกสถานะงานซ่อมนี้เป็นเสร็จสิ้นเรียบร้อยแล้ว?');
    if (!confirmed) return;

    try {
      App.showLoading('กำลังปิดงานซ่อม...');
      await API.updateRepairStatus({
        repairId,
        status: 'Completed'
      });
      App.closeLoading();
      App.showToast('ปิดงานซ่อมสำเร็จ', 'success');
      this.loadRepairs();
    } catch (e) {
      App.closeLoading();
      App.showError('ดำเนินการไม่สำเร็จ', e.message);
    }
  },

  async loadMaintenance() {
    const tableBody = document.getElementById('maint-table-body');
    if (tableBody) tableBody.innerHTML = '<tr><td colspan="7" class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary me-2"></div>กำลังโหลดรายการปิดปรับปรุง...</td></tr>';

    try {
      const maint = await API.getMaintenance();
      if (tableBody) {
        if (maint.length === 0) {
          tableBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">ไม่มีรายการปิดปรับปรุงห้อง</td></tr>';
          return;
        }

        tableBody.innerHTML = maint.map(m => `
          <tr>
            <td><strong>${m.MaintenanceID}</strong></td>
            <td>ห้อง ${m.RoomID}</td>
            <td>${App.formatDate(m.StartDate)}</td>
            <td>${App.formatDate(m.ExpectedEndDate)}</td>
            <td>${m.Problem || '-'}</td>
            <td>${App.getStatusBadge(m.Status)}</td>
            <td>${m.Technician || '-'}</td>
          </tr>
        `).join('');
      }
    } catch (e) {
      if (tableBody) tableBody.innerHTML = `<tr><td colspan="7" class="text-danger text-center py-4">${e.message}</td></tr>`;
    }
  },

  async loadAssets() {
    const tableBody = document.getElementById('assets-table-body');
    if (tableBody) tableBody.innerHTML = '<tr><td colspan="6" class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary me-2"></div>กำลังโหลดทรัพย์สิน...</td></tr>';

    try {
      const assets = await API.getRoomAssets();
      if (tableBody) {
        if (assets.length === 0) {
          tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">ไม่พบรายการทรัพย์สิน</td></tr>';
          return;
        }

        tableBody.innerHTML = assets.map(a => `
          <tr>
            <td><strong>${a.AssetCode || a.AssetID}</strong></td>
            <td>ห้อง ${a.RoomID}</td>
            <td>${a.AssetType}</td>
            <td>${a.AssetName}</td>
            <td><span class="badge ${a.Condition === 'Good' ? 'bg-success' : 'bg-warning text-dark'}">${a.Condition}</span></td>
            <td>${App.getStatusBadge(a.Status)}</td>
          </tr>
        `).join('');
      }
    } catch (e) {
      if (tableBody) tableBody.innerHTML = `<tr><td colspan="6" class="text-danger text-center py-4">${e.message}</td></tr>`;
    }
  },

  async loadKeys() {
    const tableBody = document.getElementById('keys-table-body');
    if (tableBody) tableBody.innerHTML = '<tr><td colspan="6" class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary me-2"></div>กำลังโหลดข้อมูลกุญแจ...</td></tr>';

    try {
      const keys = await API.getKeys();
      if (tableBody) {
        if (keys.length === 0) {
          tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">ไม่มีข้อมูลกุญแจ</td></tr>';
          return;
        }

        tableBody.innerHTML = keys.map(k => `
          <tr>
            <td><strong>${k.KeyNumber || k.KeyID}</strong></td>
            <td>ห้อง ${k.RoomID}</td>
            <td>${k.EmployeeID || '<span class="text-muted">-</span>'}</td>
            <td>${App.formatDate(k.IssueDate)}</td>
            <td>${App.getStatusBadge(k.Status)}</td>
            <td>${k.Remark || '-'}</td>
          </tr>
        `).join('');
      }
    } catch (e) {
      if (tableBody) tableBody.innerHTML = `<tr><td colspan="6" class="text-danger text-center py-4">${e.message}</td></tr>`;
    }
  },



  async loadAuditLogs() {
    const tableBody = document.getElementById('audit-table-body');
    if (tableBody) tableBody.innerHTML = '<tr><td colspan="6" class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary me-2"></div>กำลังโหลด Audit Log...</td></tr>';

    try {
      const logs = await API.getAuditLogs();
      if (tableBody) {
        if (logs.length === 0) {
          tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">ไม่มีประวัติการทำรายการ</td></tr>';
          return;
        }

        tableBody.innerHTML = logs.slice().reverse().map(l => `
          <tr>
            <td><small class="text-muted">${l.Timestamp}</small></td>
            <td><strong>${l.UserEmail}</strong></td>
            <td><span class="badge bg-secondary-subtle text-secondary">${l.Action}</span></td>
            <td>${l.Module}</td>
            <td>${l.RecordID}</td>
            <td>${l.Remark || '-'}</td>
          </tr>
        `).join('');
      }
    } catch (e) {
      if (tableBody) tableBody.innerHTML = `<tr><td colspan="6" class="text-danger text-center py-4">${e.message}</td></tr>`;
    }
  },

  async loadSettings() {
    try {
      const s = await API.getSettings();
      if (s) {
        if (document.getElementById('setting-system-name')) document.getElementById('setting-system-name').value = s.SYSTEM_NAME || '';
        if (document.getElementById('setting-company-name')) document.getElementById('setting-company-name').value = s.COMPANY_NAME || '';
        if (document.getElementById('setting-email')) document.getElementById('setting-email').value = s.SYSTEM_EMAIL || '';
        if (document.getElementById('setting-reminder-days')) document.getElementById('setting-reminder-days').value = s.CHECKOUT_REMINDER_DAYS || '7';
      }
    } catch (e) {
      console.warn('Could not load remote settings', e);
    }
  },

  async saveSettings() {
    const systemName = document.getElementById('setting-system-name')?.value;
    const companyName = document.getElementById('setting-company-name')?.value;
    const email = document.getElementById('setting-email')?.value;
    const reminderDays = document.getElementById('setting-reminder-days')?.value;

    try {
      App.showLoading('กำลังบันทึกการตั้งค่า...');
      await API.saveSettings({
        SYSTEM_NAME: systemName,
        COMPANY_NAME: companyName,
        SYSTEM_EMAIL: email,
        CHECKOUT_REMINDER_DAYS: reminderDays
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