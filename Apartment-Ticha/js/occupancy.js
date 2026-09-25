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
    }
  },

  async openCheckInModal(preselectedRoomId = null) {
    App.showLoading('กำลังเตรียมข้อมูล...');
    await this.initModalData();
    App.closeLoading();
    this.resetEmployeeSearch();

    const roomSelect = document.getElementById('checkin-room');
    if (roomSelect) {
      roomSelect.innerHTML = '<option value="">-- เลือกห้องพัก --</option>';
      const availableRooms = this.activeRooms.filter(r => r.availableBedsCount > 0 && r.computedStatus !== 'Maintenance');
      availableRooms.forEach(r => {
        const isSelected = preselectedRoomId && r.roomId === preselectedRoomId ? 'selected' : '';
        roomSelect.innerHTML += `<option value="${App.escHtml(r.roomId)}" ${isSelected}>${App.escHtml(r.roomNumber)} - ${App.escHtml(r.buildingName)} (ว่าง ${r.availableBedsCount} เตียง)</option>`;
      });
    }

    const checkinDateInput = document.getElementById('checkin-date');
    if (checkinDateInput) {
      checkinDateInput.value = new Date().toISOString().split('T')[0];
    }

    if (preselectedRoomId) {
      this.onCheckInRoomSelected(preselectedRoomId);
    } else {
      document.getElementById('checkin-bed').innerHTML = '<option value="">-- กรุณาเลือกห้องก่อน --</option>';
    }

    const modal = new bootstrap.Modal(document.getElementById('checkInModal'));
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

    const results = this.activeEmployees.filter(e => {
      const id = String(e.EmployeeID || '').toLowerCase();
      const firstName = String(e.FirstName || '').toLowerCase();
      const lastName = String(e.LastName || '').toLowerCase();
      const fullName = String(e.FullName || `${e.FirstName || ''} ${e.LastName || ''}`).toLowerCase();

      return id.includes(keyword) ||
             firstName.includes(keyword) ||
             lastName.includes(keyword) ||
             fullName.includes(keyword);
    }).slice(0, 20);

    if (results.length === 0) {
      suggestBox.innerHTML = '<div class="list-group-item text-muted small py-2">ไม่พบพนักงานที่ตรงกับคำค้นหา</div>';
      suggestBox.style.display = 'block';
      return;
    }

    // หมายเหตุการแก้ไข: เดิมจุดนี้แทรก e.EmployeeID / fullName / Department / Position
    // ลงใน innerHTML แบบดิบโดยไม่ escape เลย (ไม่เหมือนไฟล์อื่นที่ใช้ App.escHtml/escAttr
    // ทั่วทั้งระบบ) ถ้าชื่อพนักงานหรือแผนกมีอักขระ HTML พิเศษปนอยู่จะทำให้หน้าเว็บแสดงผล
    // เพี้ยนหรือเสี่ยงต่อการแทรกโค้ดได้ จึงแก้ให้ escape ให้ครบเหมือนไฟล์อื่น ๆ
    suggestBox.innerHTML = results.map(e => {
      const fullName = e.FullName || `${e.FirstName || ''} ${e.LastName || ''}`;
      return `
        <button type="button" class="list-group-item list-group-item-action py-2"
          onmousedown="event.preventDefault()"
          onclick="OccupancyWorkflow.selectCheckInEmployee('${App.escAttr(e.EmployeeID)}')">
          <div class="fw-semibold text-dark">${App.escHtml(e.EmployeeID)} - ${App.escHtml(fullName)}</div>
          <small class="text-muted">${App.escHtml(e.Department || '-')} ${e.Position ? '| ' + App.escHtml(e.Position) : ''}</small>
        </button>
      `;
    }).join('');
    suggestBox.style.display = 'block';
  },

  selectCheckInEmployee(employeeId) {
    const emp = this.activeEmployees.find(e => String(e.EmployeeID) === String(employeeId));
    if (!emp) return;

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

    bedSelect.innerHTML = '<option value="">-- เลือกเตียงว่าง --</option>';
    const room = this.activeRooms.find(r => r.roomId === roomId);
    if (!room || !room.beds) return;

    const vacantBeds = room.beds.filter(b => !b.isOccupied && b.status === 'Active');
    if (vacantBeds.length === 0) {
      bedSelect.innerHTML = '<option value="">ไม่มีเตียงว่างในห้องนี้</option>';
      return;
    }

    vacantBeds.forEach(b => {
      bedSelect.innerHTML += `<option value="${App.escHtml(b.bedId)}">เตียง ${App.escHtml(b.bedNumber)} (${App.escHtml(b.bedType)})</option>`;
    });
  },

  async submitCheckIn() {
    const employeeId = document.getElementById('checkin-employee')?.value;
    const roomId = document.getElementById('checkin-room')?.value;
    const bedId = document.getElementById('checkin-bed')?.value;
    const checkInDate = document.getElementById('checkin-date')?.value;
    const expectedCheckOutDate = document.getElementById('checkin-expected-date')?.value;
    const reason = document.getElementById('checkin-reason')?.value;
    const remark = document.getElementById('checkin-remark')?.value;

    if (!employeeId) {
      App.showError('กรุณาเลือกพนักงานผู้เข้าพัก', 'พิมพ์รหัสพนักงานหรือชื่อ-นามสกุลในช่องค้นหา แล้วคลิกเลือกชื่อจากรายการที่แสดงขึ้นมาให้เรียบร้อยก่อนบันทึก');
      document.getElementById('checkin-employee-search')?.focus();
      return;
    }

    if (!roomId || !bedId || !checkInDate) {
      App.showError('กรุณากรอกข้อมูลสำคัญให้ครบถ้วน (ห้อง, เตียง, วันที่)');
      return;
    }

    try {
      App.showLoading('กำลังบันทึกรายการ Check-in...');
      await API.checkIn({
        employeeId,
        roomId,
        bedId,
        checkInDate,
        expectedCheckOutDate,
        reason,
        remark
      });

      App.closeLoading();
      bootstrap.Modal.getInstance(document.getElementById('checkInModal'))?.hide();
      await App.showSuccess('Check-in สำเร็จ!', 'บันทึกข้อมูลการเข้าพักเรียบร้อยแล้ว');
      if (typeof Admin !== 'undefined') Admin.loadOccupancy();
    } catch (error) {
      App.closeLoading();
      App.showError('เกิดข้อผิดพลาดในการ Check-in', error.message);
    }
  },

  openCheckOutModal(occupancyId, occupantName, roomNumber, bedNumber) {
    document.getElementById('checkout-occupancy-id').value = occupancyId;
    document.getElementById('checkout-occupant-name').textContent = occupantName;
    document.getElementById('checkout-room-info').textContent = `ห้อง ${roomNumber} (เตียง ${bedNumber})`;
    document.getElementById('checkout-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('checkout-damage').value = '0';
    document.getElementById('checkout-reason').value = '';

    const modal = new bootstrap.Modal(document.getElementById('checkOutModal'));
    modal.show();
  },

  async submitCheckOut() {
    const occupancyId = document.getElementById('checkout-occupancy-id')?.value;
    const checkOutDate = document.getElementById('checkout-date')?.value;
    const reason = document.getElementById('checkout-reason')?.value;
    const keyReturned = document.getElementById('checkout-key-returned')?.checked;
    const propertyReturned = document.getElementById('checkout-prop-returned')?.checked;
    const roomCondition = document.getElementById('checkout-condition')?.value;
    const damageAmount = document.getElementById('checkout-damage')?.value;
    const remark = document.getElementById('checkout-remark')?.value;

    if (!occupancyId || !checkOutDate) {
      App.showError('กรุณาระบุข้อมูลวันที่เช็คเอาท์');
      return;
    }

    const confirmed = await App.confirm('ยืนยันการเช็คเอาท์', 'เมื่อเช็คเอาท์แล้ว เตียงพักจะกลับมาอยู่ในสถานะ "ว่าง" พร้อมใช้งาน');
    if (!confirmed) return;

    try {
      App.showLoading('กำลังบันทึกการเช็คเอาท์...');
      await API.checkOut({
        occupancyId,
        checkOutDate,
        reason,
        keyReturned,
        propertyReturned,
        roomCondition,
        damageAmount,
        remark
      });

      App.closeLoading();
      bootstrap.Modal.getInstance(document.getElementById('checkOutModal'))?.hide();
      await App.showSuccess('Check-out สำเร็จ!', 'คืนสถานะเตียงว่างเรียบร้อยแล้ว');
      if (typeof Admin !== 'undefined') Admin.loadOccupancy();
    } catch (error) {
      App.closeLoading();
      App.showError('เกิดข้อผิดพลาดในการ Check-out', error.message);
    }
  },

  async openTransferModal(occupancyId, occupantName, currentRoomId, currentBedId, currentRoomNumber) {
    App.showLoading('กำลังเตรียมข้อมูลห้องว่าง...');
    await this.initModalData();
    App.closeLoading();

    document.getElementById('transfer-occupancy-id').value = occupancyId;
    document.getElementById('transfer-occupant-name').textContent = occupantName;
    document.getElementById('transfer-current-room').textContent = `ห้อง ${currentRoomNumber}`;
    document.getElementById('transfer-date').value = new Date().toISOString().split('T')[0];

    const newRoomSelect = document.getElementById('transfer-new-room');
    if (newRoomSelect) {
      newRoomSelect.innerHTML = '<option value="">-- เลือกห้องพักใหม่ --</option>';
      const availableRooms = this.activeRooms.filter(r => r.availableBedsCount > 0 && r.roomId !== currentRoomId && r.computedStatus !== 'Maintenance');
      availableRooms.forEach(r => {
        newRoomSelect.innerHTML += `<option value="${App.escHtml(r.roomId)}">${App.escHtml(r.roomNumber)} - ${App.escHtml(r.buildingName)} (ว่าง ${r.availableBedsCount} เตียง)</option>`;
      });
    }

    document.getElementById('transfer-new-bed').innerHTML = '<option value="">-- กรุณาเลือกห้องใหม่ก่อน --</option>';

    const modal = new bootstrap.Modal(document.getElementById('transferModal'));
    modal.show();
  },

  onTransferRoomSelected(newRoomId) {
    const bedSelect = document.getElementById('transfer-new-bed');
    if (!bedSelect) return;

    bedSelect.innerHTML = '<option value="">-- เลือกเตียงใหม่ --</option>';
    const room = this.activeRooms.find(r => r.roomId === newRoomId);
    if (!room || !room.beds) return;

    const vacantBeds = room.beds.filter(b => !b.isOccupied && b.status === 'Active');
    vacantBeds.forEach(b => {
      bedSelect.innerHTML += `<option value="${App.escHtml(b.bedId)}">เตียง ${App.escHtml(b.bedNumber)} (${App.escHtml(b.bedType)})</option>`;
    });
  },

  async submitTransfer() {
    const occupancyId = document.getElementById('transfer-occupancy-id')?.value;
    const newRoomId = document.getElementById('transfer-new-room')?.value;
    const newBedId = document.getElementById('transfer-new-bed')?.value;
    const transferDate = document.getElementById('transfer-date')?.value;
    const reason = document.getElementById('transfer-reason')?.value;
    const remark = document.getElementById('transfer-remark')?.value;

    if (!occupancyId || !newRoomId || !newBedId || !transferDate) {
      App.showError('กรุณาเลือกห้องใหม่ เตียงใหม่ และวันที่ย้ายห้อง');
      return;
    }

    const confirmed = await App.confirm('ยืนยันการย้ายห้อง', 'ระบบจะทำการปิดประวัติเดิมและสร้างรายการเข้าพักใหม่ พร้อมบันทึก Audit Log');
    if (!confirmed) return;

    try {
      App.showLoading('กำลังดำเนินการย้ายห้องพัก...');
      await API.transferRoom({
        occupancyId,
        newRoomId,
        newBedId,
        transferDate,
        reason,
        remark
      });

      App.closeLoading();
      bootstrap.Modal.getInstance(document.getElementById('transferModal'))?.hide();
      await App.showSuccess('ย้ายห้องสำเร็จ!', 'ย้ายข้อมูลพนักงานเข้าสู่ห้องและเตียงใหม่เรียบร้อยแล้ว');
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
      }, 150);
    });
  }
});