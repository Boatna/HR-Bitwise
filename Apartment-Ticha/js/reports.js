const Reports = {
  currentReportData: [],
  currentReportType: '',

  async generateReport(type) {
    this.currentReportType = type;
    const tableBody = document.getElementById('report-table-body');
    const titleEl = document.getElementById('report-title-display');

    if (tableBody) tableBody.innerHTML = '<tr><td colspan="8" class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary me-2"></div>กำลังประมวลผลรายงาน...</td></tr>';

    try {
      if (type === 'rooms') {
        if (titleEl) titleEl.textContent = 'รายงานสถานะห้องพักและความจุ (ห้องว่าง / ห้องเต็ม)';
        const rooms = await API.getRooms();
        this.currentReportData = (rooms || []).map(r => ({
          'อาคาร': r.buildingName,
          'เลขห้อง': r.roomNumber,
          'ชั้น': r.floorId || '1',
          'ประเภท': r.roomType || 'Standard',
          'ความจุ (คน)': r.capacity,
          'ผู้พักจริง (คน)': r.occupiedBedsCount,
          'ที่ว่าง (ที่)': r.availableBedsCount,
          'สถานะห้อง': r.computedStatus === 'Available' ? 'ว่าง' : (r.computedStatus === 'Partially Occupied' ? 'ว่างบางส่วน' : (r.computedStatus === 'Full' ? 'เต็ม' : 'ปิดปรับปรุง')),
          'เฟอร์นิเจอร์': 'มาตรฐานครบชุด'
        }));

        this.renderTable([
          'อาคาร', 'เลขห้อง', 'ชั้น', 'ประเภท', 'ความจุ (คน)', 'ผู้พักจริง (คน)', 'ที่ว่าง (ที่)', 'สถานะห้อง', 'เฟอร์นิเจอร์'
        ], this.currentReportData);

      } else if (type === 'occupants') {
        if (titleEl) titleEl.textContent = 'รายงานผู้พักอาศัยปัจจุบัน (พนักงานคนไหน พักห้องไหน)';
        const rooms = await API.getRooms();
        const rows = [];
        (rooms || []).forEach(r => {
          (r.occupants || []).forEach(o => {
            rows.push({
              'รหัสพนักงาน': o.employeeId,
              'ชื่อ-นามสกุล': o.fullName,
              'แผนก': o.department || '-',
              'เบอร์โทร': o.phone || '-',
              'อาคาร': r.buildingName,
              'เลขห้อง': r.roomNumber,
              'ที่พัก / เตียง': o.bedNumber || 1,
              'วันที่เข้าพัก': App.formatDate(o.checkInDate)
            });
          });
        });
        this.currentReportData = rows;
        this.renderTable([
          'รหัสพนักงาน', 'ชื่อ-นามสกุล', 'แผนก', 'เบอร์โทร', 'อาคาร', 'เลขห้อง', 'ที่พัก / เตียง', 'วันที่เข้าพัก'
        ], this.currentReportData);

      } else if (type === 'history') {
        if (titleEl) titleEl.textContent = 'รายงานประวัติการเข้าพักและย้ายออก';
        const occupancy = await API.getOccupancy();
        this.currentReportData = (occupancy || []).map(o => ({
          'รหัสพนักงาน': o.EmployeeID,
          'ชื่อ-นามสกุล': o.EmployeeName || '-',
          'แผนก': o.Department || '-',
          'ห้องพัก': o.RoomNumber || o.RoomID,
          'วันที่เข้าพัก': App.formatDate(o.CheckInDate),
          'วันที่ย้ายออก': o.ActualCheckOutDate ? App.formatDate(o.ActualCheckOutDate) : '-',
          'สถานะ': o.Status === 'Active' ? 'พักอยู่' : (o.Status === 'CheckedOut' ? 'ย้ายออกแล้ว' : 'ย้ายห้อง'),
          'หมายเหตุ': o.Remark || '-'
        }));
        this.renderTable([
          'รหัสพนักงาน', 'ชื่อ-นามสกุล', 'แผนก', 'ห้องพัก', 'วันที่เข้าพัก', 'วันที่ย้ายออก', 'สถานะ', 'หมายเหตุ'
        ], this.currentReportData);
      }
    } catch (e) {
      if (tableBody) tableBody.innerHTML = `<tr><td colspan="8" class="text-danger text-center py-4">เกิดข้อผิดพลาดในการโหลดรายงาน: ${App.escHtml(e.message)}</td></tr>`;
    }
  },

  renderTable(headers, rows) {
    const tableHead = document.getElementById('report-table-head');
    const tableBody = document.getElementById('report-table-body');

    if (tableHead) {
      tableHead.innerHTML = `<tr>${headers.map(h => `<th>${App.escHtml(h)}</th>`).join('')}</tr>`;
    }

    if (tableBody) {
      if (rows.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="${headers.length}" class="text-center text-muted py-4">ไม่มีข้อมูลในรายงานนี้</td></tr>`;
        return;
      }

      tableBody.innerHTML = rows.map(r => `
        <tr>
          ${headers.map(h => `<td>${App.escHtml(r[h] !== undefined ? r[h] : '-')}</td>`).join('')}
        </tr>
      `).join('');
    }
  },

  exportToCSV() {
    if (!this.currentReportData || this.currentReportData.length === 0) {
      App.showToast('ไม่มีข้อมูลสำหรับส่งออก', 'warning');
      return;
    }

    const headers = Object.keys(this.currentReportData[0]);
    let csvContent = '\uFEFF'; // UTF-8 BOM สำหรับเปิดใน Microsoft Excel ได้อย่างถูกต้อง

    csvContent += headers.map(h => `"${h.replace(/"/g, '""')}"`).join(',') + '\r\n';

    this.currentReportData.forEach(row => {
      const line = headers.map(h => {
        let val = row[h];
        if (val === null || val === undefined) val = '';
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(',');
      csvContent += line + '\r\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute('href', url);
    link.setAttribute('download', `Dormitory_Report_${this.currentReportType}_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    App.showToast('ดาวน์โหลดไฟล์ CSV เรียบร้อยแล้ว', 'success');
  },

  printReport() {
    window.print();
  }
};
