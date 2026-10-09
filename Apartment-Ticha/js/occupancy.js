const OccupancyWorkflow = {
  activeRooms: [],
  activeEmployees: [],
  currentOccupants: [],
  selectedCheckinEmployeeId: '',

  async initModalData() {
    try {
      const [rooms, emps] = await Promise.all([
        API.getRooms(),
        API.getEmployees()
      ]);
      this.activeRooms = rooms || [];
      this.activeEmployees = emps || [];
    } catch (e) {
      console.error('Cannot load modal dependencies', e);
      App.showToast('โหลดข้อมูลห้อง/พนักงานไม่สำเร็จ: ' + e.message, 'error');
    }
  },

  async openCheckInModal(preselectedRoomId = null) {
    App.showLoading('กำลังเตรียมข้อมูล...');
    await this.initModalData();
    App.closeLoading();
    this.resetEmployeeSearch();
    // ล้างช่องที่ค้างค่าจากการเปิดครั้งก่อน
    ['checkin-expected-date', 'checkin-remark'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    const roomSelect = document.getElementById('checkin-room');
    if (roomSelect) {
      roomSelect.innerHTML = '<option value="">-- เลือกห้องพัก --</option>';
      const availableRooms = this.activeRooms.filter(r => r.canCheckIn && r.availableBedsCount > 0);
      availableRooms.forEach(r => {
        const isSelected = preselectedRoomId && String(r.roomId) === String(preselectedRoomId) ? 'selected' : '';
        roomSelect.innerHTML += `<option value="${App.escHtml(r.roomId)}" ${isSelected}>${App.escHtml(r.roomNumber)} - ${App.escHtml(r.buildingName)} (ว่าง ${r.availableBedsCount} ที่)</option>`;
      });
    }

    const checkinDateInput = document.getElementById('checkin-date');
    if (checkinDateInput) {
      checkinDateInput.value = App.todayStr();
    }

    if (preselectedRoomId) {
      this.onCheckInRoomSelected(preselectedRoomId);
    } else {
      document.getElementById('checkin-bed').innerHTML = '<option value="">-- กรุณาเลือกห้องก่อน --</option>';
    }

    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('checkInModal'));
    modal.show();
    setTimeout(() => {
      document.getElementById('checkin-employee-search')?.focus();
    }, 300);
  },

  resetEmployeeSearch() {
    this.selectedCheckinEmployeeId = '';
    const searchInput = document.getElementById('checkin-employee-search');
    const hiddenInput = document.getElementById('checkin-employee');
    const suggestBox = document.getElementById('checkin-employee-suggestions');
    if (searchInput) searchInput.value = '';
    if (hiddenInput) hiddenInput.value = '';
    if (suggestBox) {
      suggestBox.innerHTML = '';
      suggestBox.style.display = 'none';
    }
  },

  onEmployeeSearchInput(value) {
    const suggestBox = document.getElementById('checkin-employee-suggestions');
    const hiddenInput = document.getElementById('checkin-employee');
    if (!suggestBox) return;
    if (hiddenInput) hiddenInput.value = '';
    this.selectedCheckinEmployeeId = '';

    const keyword = (value || '').trim().toLowerCase();
    if (!keyword) {
      suggestBox.innerHTML = '';
      suggestBox.style.display = 'none';
      return;
    }

    // กรองพนักงาน (แสดงเฉพาะคนที่ยังไม่มีห้องพัก active อยู่ เพื่อความสะดวก)
    const results = this.activeEmployees.filter(e => {
      const id = String(e.EmployeeID || '').toLowerCase();
      const firstName = String(e.FirstName || '').toLowerCase();
      const lastName = String(e.LastName || '').toLowerCase();
      const fullName = String(e.FullName || `${e.FirstName || ''} ${e.LastName || ''}`).toLowerCase();

      return id.includes(keyword) ||
             firstName.includes(keyword) ||
             lastName.includes(keyword) ||
             fullName.includes(keyword);
    }).slice(0, 15);

    if (results.length === 0) {
      suggestBox.innerHTML = '<div class="list-group-item text-muted small py-2">ไม่พบพนักงานที่ตรงกับคำค้นหา</div>';
      suggestBox.style.display = 'block';
      return;
    }

    suggestBox.innerHTML = results.map(e => {
      const fullName = e.FullName || `${e.FirstName || ''} ${e.LastName || ''}`;
      const stayBadge = e.isAccommodated ? `<span class="badge bg-warning text-dark ms-1">พักห้อง ${App.escHtml(e.currentRoomNumber)}</span>` : '<span class="badge bg-success-subtle text-success ms-1">ยังไม่มีห้องพัก</span>';
      return `
        <button type="button" class="list-group-item list-group-item-action py-2"
          onmousedown="event.preventDefault()"
          onclick="OccupancyWorkflow.selectCheckInEmployee('${App.escAttr(e.EmployeeID)}')">
          <div class="d-flex justify-content-between align-items-center">
            <span class="fw-semibold text-dark">${App.escHtml(e.EmployeeID)} - ${App.escHtml(fullName)}</span>
            ${stayBadge}
          </div>
          <small class="text-muted">${App.escHtml(e.Department || '-')} | โทร: ${App.escHtml(e.Phone || '-')}</small>
        </button>
      `;
    }).join('');
    suggestBox.style.display = 'block';
  },

  selectCheckInEmployee(employeeId) {
    const emp = this.activeEmployees.find(e => String(e.EmployeeID) === String(employeeId));
    if (!emp) return;

    if (emp.isAccommodated) {
      App.showToast(`พนักงานคนนี้พักอยู่ที่ห้อง ${emp.currentRoomNumber} อยู่แล้ว (หากต้องการเปลี่ยนห้องให้ใช้เมนู "ย้ายห้อง")`, 'warning');
      return;
    }

    const searchInput = document.getElementById('checkin-employee-search');
    const hiddenInput = document.getElementById('checkin-employee');
    const suggestBox = document.getElementById('checkin-employee-suggestions');
    const fullName = emp.FullName || `${emp.FirstName || ''} ${emp.LastName || ''}`;

    if (searchInput) searchInput.value = `${emp.EmployeeID} - ${fullName}`;
    if (hiddenInput) hiddenInput.value = emp.EmployeeID;
    this.selectedCheckinEmployeeId = emp.EmployeeID;

    if (suggestBox) {
      suggestBox.innerHTML = '';
      suggestBox.style.display = 'none';
    }
  },

  onCheckInRoomSelected(roomId) {
    const bedSelect = document.getElementById('checkin-bed');
    if (!bedSelect) return;

    bedSelect.innerHTML = '<option value="">-- เลือกที่พัก/เตียง --</option>';
    const room = this.activeRooms.find(r => String(r.roomId) === String(roomId));
    if (!room || !room.beds) return;

    const vacantBeds = room.beds.filter(b => !b.isOccupied && b.status === 'Active');
    if (vacantBeds.length === 0) {
      bedSelect.innerHTML = '<option value="">ไม่มีที่ว่างในห้องนี้</option>';
      return;
    }

    vacantBeds.forEach(b => {
      bedSelect.innerHTML += `<option value="${App.escHtml(b.bedNumber)}">ที่พัก / เตียง ${App.escHtml(b.bedNumber)} (ว่าง)</option>`;
    });

    if (vacantBeds.length > 0) {
      bedSelect.value = vacantBeds[0].bedNumber;
    }
  },

  async submitCheckIn() {
    const employeeId = document.getElementById('checkin-employee')?.value;
    const roomId = document.getElementById('checkin-room')?.value;
    const bedNumber = document.getElementById('checkin-bed')?.value;
    const checkInDate = document.getElementById('checkin-date')?.value;
    const expectedCheckOutDate = document.getElementById('checkin-expected-date')?.value;
    const remark = document.getElementById('checkin-remark')?.value;

    if (!employeeId) {
      App.showError('กรุณาเลือกพนักงานผู้เข้าพัก', 'พิมพ์รหัสพนักงานหรือชื่อ-นามสกุลในช่องค้นหา แล้วคลิกเลือกชื่อพนักงาน');
      document.getElementById('checkin-employee-search')?.focus();
      return;
    }

    if (!roomId || !checkInDate) {
      App.showError('กรุณาเลือกห้องพักและวันที่เข้าพัก');
      return;
    }

    try {
      App.showLoading('กำลังบันทึกรายการ Check-in...');
      await API.checkIn({
        employeeId,
        roomId,
        bedNumber: Number(bedNumber) || 1,
        bedId: 'BED-' + roomId + '-' + (bedNumber || 1),
        checkInDate,
        expectedCheckOutDate,
        remark
      });

      App.closeLoading();
      bootstrap.Modal.getInstance(document.getElementById('checkInModal'))?.hide();
      await App.showSuccess('Check-in สำเร็จ!', 'บันทึกข้อมูลการเข้าพักเรียบร้อยแล้ว หากพนักงานมีรถ สามารถจองช่องจอดได้ที่เมนู "ที่จอดรถ"');
      if (typeof Admin !== 'undefined') Admin.loadOccupancy();
    } catch (error) {
      App.closeLoading();
      App.showError('เกิดข้อผิดพลาดในการ Check-in', error.message);
    }
  },

  openCheckOutModal(occupancyId, occupantName, roomNumber, bedNumber) {
    document.getElementById('checkout-occupancy-id').value = occupancyId;
    document.getElementById('checkout-occupant-name').textContent = occupantName;
    document.getElementById('checkout-room-info').textContent = `ห้อง ${roomNumber} (ที่พัก ${bedNumber || 1})`;
    document.getElementById('checkout-date').value = App.todayStr();
    document.getElementById('checkout-reason').value = 'หมดสัญญา / ย้ายออก';
    if (document.getElementById('checkout-remark')) document.getElementById('checkout-remark').value = '';

    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('checkOutModal'));
    modal.show();
  },

  async submitCheckOut() {
    const occupancyId = document.getElementById('checkout-occupancy-id')?.value;
    const checkOutDate = document.getElementById('checkout-date')?.value;
    const reason = document.getElementById('checkout-reason')?.value;
    const remark = document.getElementById('checkout-remark')?.value;

    if (!occupancyId || !checkOutDate) {
      App.showError('กรุณาระบุวันที่เช็คเอาท์');
      return;
    }

    const confirmed = await App.confirm('ยืนยันการเช็คเอาท์', 'เมื่อเช็คเอาท์แล้ว ห้องพักจะคืนสถานะ "ว่าง" และช่องจอดรถของพนักงานคนนี้ (ถ้ามี) จะถูกคืนให้อัตโนมัติ');
    if (!confirmed) return;

    try {
      App.showLoading('กำลังบันทึกการเช็คเอาท์...');
      const outResult = await API.checkOut({
        occupancyId,
        checkOutDate,
        reason,
        remark: remark || reason
      });

      App.closeLoading();
      bootstrap.Modal.getInstance(document.getElementById('checkOutModal'))?.hide();
      const parkMsg = outResult && outResult.releasedParking ? ` และคืนช่องจอดรถ ${outResult.releasedParking} ช่องแล้ว` : '';
      await App.showSuccess('Check-out สำเร็จ!', 'คืนสถานะห้องว่างเรียบร้อยแล้ว' + parkMsg);
      if (typeof Admin !== 'undefined') Admin.loadOccupancy();
    } catch (error) {
      App.closeLoading();
      App.showError('เกิดข้อผิดพลาดในการ Check-out', error.message);
    }
  },

  async openTransferModal(occupancyId, occupantName, currentRoomId, currentRoomNumber, currentBedNumber) {
    App.showLoading('กำลังเตรียมข้อมูลห้องว่าง...');
    await this.initModalData();
    App.closeLoading();

    document.getElementById('transfer-occupancy-id').value = occupancyId;
    document.getElementById('transfer-occupant-name').textContent = occupantName;
    document.getElementById('transfer-current-room').textContent = `ห้อง ${currentRoomNumber} (ที่พัก ${currentBedNumber || 1})`;
    document.getElementById('transfer-date').value = App.todayStr();
    document.getElementById('transfer-reason').value = 'ขอย้ายห้อง';
    document.getElementById('transfer-remark').value = '';

    const newRoomSelect = document.getElementById('transfer-new-room');
    if (newRoomSelect) {
      newRoomSelect.innerHTML = '<option value="">-- เลือกห้องพักใหม่ --</option>';
      const availableRooms = this.activeRooms.filter(r => r.canCheckIn && r.availableBedsCount > 0 && String(r.roomId) !== String(currentRoomId));
      availableRooms.forEach(r => {
        newRoomSelect.innerHTML += `<option value="${App.escHtml(r.roomId)}">${App.escHtml(r.roomNumber)} - ${App.escHtml(r.buildingName)} (ว่าง ${r.availableBedsCount} ที่)</option>`;
      });
    }

    document.getElementById('transfer-new-bed').innerHTML = '<option value="">-- กรุณาเลือกห้องใหม่ก่อน --</option>';

    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('transferModal'));
    modal.show();
  },

  onTransferRoomSelected(newRoomId) {
    const bedSelect = document.getElementById('transfer-new-bed');
    if (!bedSelect) return;

    bedSelect.innerHTML = '<option value="">-- เลือกที่พัก/เตียงใหม่ --</option>';
    const room = this.activeRooms.find(r => String(r.roomId) === String(newRoomId));
    if (!room || !room.beds) return;

    const vacantBeds = room.beds.filter(b => !b.isOccupied && b.status === 'Active');
    vacantBeds.forEach(b => {
      bedSelect.innerHTML += `<option value="${App.escHtml(b.bedNumber)}">ที่พัก / เตียง ${App.escHtml(b.bedNumber)} (ว่าง)</option>`;
    });

    if (vacantBeds.length > 0) {
      bedSelect.value = vacantBeds[0].bedNumber;
    }
  },

  async submitTransfer() {
    const occupancyId = document.getElementById('transfer-occupancy-id')?.value;
    const newRoomId = document.getElementById('transfer-new-room')?.value;
    const newBedNumber = document.getElementById('transfer-new-bed')?.value;
    const transferDate = document.getElementById('transfer-date')?.value;
    const reason = document.getElementById('transfer-reason')?.value;
    const remark = document.getElementById('transfer-remark')?.value;

    if (!occupancyId || !newRoomId || !transferDate) {
      App.showError('กรุณาเลือกห้องใหม่และวันที่ย้ายห้อง');
      return;
    }

    const confirmed = await App.confirm('ยืนยันการย้ายห้อง', 'ระบบจะทำการย้ายพนักงานไปยังห้องพักใหม่และอัปเดตสถานะห้องอัตโนมัติ');
    if (!confirmed) return;

    try {
      App.showLoading('กำลังดำเนินการย้ายห้องพัก...');
      await API.transferRoom({
        occupancyId,
        newRoomId,
        newBedNumber: Number(newBedNumber) || 1,
        newBedId: 'BED-' + newRoomId + '-' + (newBedNumber || 1),
        transferDate,
        reason,
        remark
      });

      App.closeLoading();
      bootstrap.Modal.getInstance(document.getElementById('transferModal'))?.hide();
      await App.showSuccess('ย้ายห้องสำเร็จ!', 'ย้ายข้อมูลพนักงานเข้าสู่ห้องใหม่เรียบร้อยแล้ว (ห้องของที่จอดรถอัปเดตให้อัตโนมัติ)');
      if (typeof Admin !== 'undefined') Admin.loadOccupancy();
    } catch (error) {
      App.closeLoading();
      App.showError('เกิดข้อผิดพลาดในการย้ายห้อง', error.message);
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('checkin-employee-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      OccupancyWorkflow.onEmployeeSearchInput(e.target.value);
    });
    searchInput.addEventListener('focus', (e) => {
      if (e.target.value) OccupancyWorkflow.onEmployeeSearchInput(e.target.value);
    });
    searchInput.addEventListener('blur', () => {
      setTimeout(() => {
        const suggestBox = document.getElementById('checkin-employee-suggestions');
        if (suggestBox) suggestBox.style.display = 'none';
      }, 200);
    });
  }
});