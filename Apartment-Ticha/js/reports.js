const Reports = {
  currentReportData: [],
  currentReportType: '',

  async generateReport(type) {
    this.currentReportType = type;
    const tableHead = document.getElementById('report-table-head');
    const tableBody = document.getElementById('report-table-body');
    const titleEl = document.getElementById('report-title-display');

    if (tableBody) tableBody.innerHTML = '<tr><td colspan="8" class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary me-2"></div>กำลังดึงข้อมูลรายงาน...</td></tr>';

    try {
      if (type === 'rooms') {
        if (titleEl) titleEl.textContent = 'รายงานสถานะห้องพักและความจุทั้งหมด';
        const rooms = await API.getRooms();
        this.currentReportData = rooms.map(r => ({
          'รหัสห้อง': r.roomId,
          'อาคาร': r.buildingName,
          'เลขห้อง': r.roomNumber,
          'ประเภท': r.roomType,
          'ความจุ (คน)': r.capacity,
          'ผู้พักปัจจุบัน': r.occupiedBedsCount,
          'เตียงว่าง': r.availableBedsCount,
          'สถานะ': r.computedStatus
        }));

        this.renderTable([
          'รหัสห้อง', 'อาคาร', 'เลขห้อง', 'ประเภท', 'ความจุ (คน)', 'ผู้พักปัจจุบัน', 'เตียงว่าง', 'สถานะ'
        ], this.currentReportData);

      } else if (type === 'occupants') {
        if (titleEl) titleEl.textContent = 'รายงานผู้พักอาศัยปัจจุบัน';
        const rooms = await API.getRooms();
        const rows = [];
        rooms.forEach(r => {
          r.occupants.forEach(o => {
            rows.push({
              'รหัสพนักงาน': o.employeeId,
              'ชื่อ-นามสกุล': o.fullName,
              'แผนก': o.department,
              'เบอร์โทร': o.phone,
              'อาคาร': r.buildingName,
              'เลขห้อง': r.roomNumber,
              'เตียง': o.bedNumber,
              'วันที่เข้าพัก': App.formatDate(o.checkInDate)
            });
          });
        });
        this.currentReportData = rows;
        this.renderTable([
          'รหัสพนักงาน', 'ชื่อ-นามสกุล', 'แผนก', 'เบอร์โทร', 'อาคาร', 'เลขห้อง', 'เตียง', 'วันที่เข้าพัก'
        ], this.currentReportData);

      } else if (type === 'repairs') {
        if (titleEl) titleEl.textContent = 'รายงานการแจ้งซ่อมและซ่อมบำรุง';
        const repairs = await API.getRepairRequests();
        this.currentReportData = (repairs || []).map(r => ({
          'รหัสแจ้งซ่อม': r.RepairID,
          'ห้อง': r.RoomID,
          'ประเภทปัญหา': r.IssueType,
          'รายละเอียด': r.Description,
          'ระดับความสำคัญ': r.Priority,
          'ผู้รับผิดชอบ': r.AssignedTo || '-',
          'สถานะ': r.Status,
          'วันที่แจ้ง': App.formatDate(r.RequestDate)
        }));
        this.renderTable([
          'รหัสแจ้งซ่อม', 'ห้อง', 'ประเภทปัญหา', 'รายละเอียด', 'ระดับความสำคัญ', 'ผู้รับผิดชอบ', 'สถานะ', 'วันที่แจ้ง'
        ], this.currentReportData);

      } else if (type === 'audit') {
        if (titleEl) titleEl.textContent = 'รายงานประวัติการเปลี่ยนแปลงข้อมูล (Audit Log)';
        const logs = await API.getAuditLogs();
        this.currentReportData = (logs || []).map(l => ({
          'เวลา': l.Timestamp,
          'ผู้ทำรายการ': l.UserEmail,
          'การกระทำ': l.Action,
          'โมดูล': l.Module,
          'รหัสข้อมูล': l.RecordID,
          'หมายเหตุ': l.Remark
        }));
        this.renderTable([
          'เวลา', 'ผู้ทำรายการ', 'การกระทำ', 'โมดูล', 'รหัสข้อมูล', 'หมายเหตุ'
        ], this.currentReportData);
      }
    } catch (e) {
      if (tableBody) tableBody.innerHTML = `<tr><td colspan="8" class="text-danger text-center py-4">เกิดข้อผิดพลาดในการโหลดรายงาน: ${e.message}</td></tr>`;
    }
  },

  renderTable(headers, rows) {
    const tableHead = document.getElementById('report-table-head');
    const tableBody = document.getElementById('report-table-body');

    if (tableHead) {
      tableHead.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
    }

    if (tableBody) {
      if (rows.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="${headers.length}" class="text-muted text-center py-4">ไม่พบข้อมูลในรายงานนี้</td></tr>`;
        return;
      }

      tableBody.innerHTML = rows.map(row => {
        return `<tr>${headers.map(h => `<td>${row[h] !== undefined ? row[h] : '-'}</td>`).join('')}</tr>`;
      }).join('');
    }
  },

  /**
   * Export ข้อมูลปัจจุบันเป็นไฟล์ CSV รองรับภาษาไทย (UTF-8 BOM)
   */
  exportToCSV() {
    if (!this.currentReportData || this.currentReportData.length === 0) {
      App.showError('ไม่มีข้อมูลสำหรับส่งออก CSV');
      return;
    }

    const headers = Object.keys(this.currentReportData[0]);
    const csvRows = [];
    csvRows.push(headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','));

    this.currentReportData.forEach(row => {
      const values = headers.map(header => {
        const val = row[header] === null || row[header] === undefined ? '' : String(row[header]);
        return `"${val.replace(/"/g, '""')}"`;
      });
      csvRows.push(values.join(','));
    });

    const csvContent = '\uFEFF' + csvRows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Dormitory_Report_${this.currentReportType}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    App.showToast('ส่งออกไฟล์ CSV สำเร็จ', 'success');
  },

  printReport() {
    window.print();
  }
};
