const App = {
  init() {
    this.renderHeader();
  },

  renderHeader() {
    const headerContainer = document.getElementById('navbar-container');
    if (!headerContainer) return;

    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    const isIndex = currentPath === 'index.html' || currentPath === '';
    const isDashboard = currentPath === 'dashboard.html';
    const isAdmin = currentPath === 'admin.html';

    headerContainer.innerHTML = `
      <nav class="navbar navbar-expand-lg navbar-dark navbar-dorm">
        <div class="container-fluid px-3 px-lg-4">
          <a class="navbar-brand d-flex align-items-center gap-2 brand-link" href="index.html">
            <img src="assets/mascot.png" alt="ทาคุจัง" class="rounded-circle bg-white shadow-sm flex-shrink-0" style="width: 40px; height: 40px; object-fit: contain; padding: 2px;">
            <div class="brand-text">
              <div class="fw-bold brand-title leading-tight">ระบบบริหารหอพักพนักงาน</div>
              <small class="text-white-50 brand-subtitle">Employee Dormitory Management v1.0</small>
            </div>
          </a>

          <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarDormContent">
            <span class="navbar-toggler-icon"></span>
          </button>

          <div class="collapse navbar-collapse" id="navbarDormContent">
            <ul class="navbar-nav me-auto mb-2 mb-lg-0 ms-lg-4">
              <li class="nav-item">
                <a class="nav-link ${isIndex ? 'active' : ''}" href="index.html">
                  <i class="bi bi-grid-3x3-gap-fill me-1"></i> สถานะห้องพัก
                </a>
              </li>
              <li class="nav-item">
                <a class="nav-link ${isDashboard ? 'active' : ''}" href="dashboard.html">
                  <i class="bi bi-speedometer2 me-1"></i> แดชบอร์ด (Dashboard)
                </a>
              </li>
              <li class="nav-item">
                <a class="nav-link ${isAdmin ? 'active' : ''}" href="admin.html">
                  <i class="bi bi-gear-wide-connected me-1"></i> จัดการระบบ (Admin)
                </a>
              </li>
            </ul>

            <div class="d-flex align-items-center gap-2 mt-3 mt-lg-0">
              <span class="badge bg-white bg-opacity-25 text-white px-3 py-2 rounded-pill d-flex align-items-center gap-2">
                <i class="bi bi-shield-check text-warning fs-6"></i>
                <span class="fw-semibold">Admin (ผู้ดูแลระบบ)</span>
              </span>
            </div>
          </div>
        </div>
      </nav>
    `;
  },

  updateUserBadge() {
    const display = document.getElementById('current-user-display');
    if (display) {
      const u = API.getCurrentUser();
      display.textContent = `${u.name} (${u.role})`;
    }
  },

  getStatusBadge(status) {
    const s = String(status || '').replace(/\s+/g, '-');
    let label = status;
    let icon = 'bi-circle-fill';

    switch (status) {
      case 'Available':
        label = 'ว่าง';
        icon = 'bi-check-circle-fill text-success';
        break;
      case 'Partially Occupied':
      case 'Partially-Occupied':
        label = 'ว่างบางส่วน';
        icon = 'bi-pie-chart-fill text-warning';
        break;
      case 'Full':
        label = 'เต็ม';
        icon = 'bi-x-circle-fill text-danger';
        break;
      case 'Maintenance':
        label = 'ปิดปรับปรุง';
        icon = 'bi-tools text-orange';
        break;
      case 'Inactive':
        label = 'ไม่เปิดใช้งาน';
        icon = 'bi-dash-circle-fill text-secondary';
        break;
      case 'Active':
        label = 'ใช้งานอยู่';
        icon = 'bi-check-circle-fill text-success';
        break;
      case 'Pending':
        label = 'รอตรวจสอบ';
        icon = 'bi-clock-fill text-warning';
        break;
      case 'Approved':
        label = 'อนุมัติแล้ว';
        icon = 'bi-check-all text-primary';
        break;
      case 'Rejected':
        label = 'ปฏิเสธ';
        icon = 'bi-x-octagon-fill text-danger';
        break;
      case 'Completed':
        label = 'เสร็จสมบูรณ์';
        icon = 'bi-check2-circle text-success';
        break;
    }

    return `<span class="badge-status ${s}"><i class="bi ${icon}"></i> ${label}</span>`;
  },

  /**
   * จัดรูปแบบวันที่ DD/MM/YYYY
   */
  formatDate(dateVal) {
    if (!dateVal) return '-';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return String(dateVal);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (e) {
      return String(dateVal);
    }
  },

  /**
   * SweetAlert2 Alerts
   */
  showLoading(title = 'กำลังโหลดข้อมูล...') {
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        title: title,
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });
    }
  },

  closeLoading() {
    if (typeof Swal !== 'undefined') {
      Swal.close();
    }
  },

  showSuccess(title, text = '') {
    if (typeof Swal !== 'undefined') {
      return Swal.fire({
        icon: 'success',
        title: title,
        text: text,
        confirmButtonColor: '#1e3a8a',
        confirmButtonText: 'ตกลง'
      });
    } else {
      alert(title + (text ? '\n' + text : ''));
    }
  },

  showError(title, text = '') {
    if (typeof Swal !== 'undefined') {
      return Swal.fire({
        icon: 'error',
        title: title,
        text: text,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'ปิด'
      });
    } else {
      alert('Error: ' + title + (text ? '\n' + text : ''));
    }
  },

  showToast(message, icon = 'success') {
    if (typeof Swal !== 'undefined') {
      const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
      });
      Toast.fire({
        icon: icon,
        title: message
      });
    }
  },

  async confirm(title, text = '', confirmText = 'ยืนยัน', cancelText = 'ยกเลิก') {
    if (typeof Swal !== 'undefined') {
      const res = await Swal.fire({
        title: title,
        text: text,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#1e3a8a',
        cancelButtonColor: '#94a3b8',
        confirmButtonText: confirmText,
        cancelButtonText: cancelText
      });
      return res.isConfirmed;
    }
    return confirm(title + '\n' + text);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});