const ADMIN_STATE = {
  currentUser: null,
  isApiConfigured: false,
  adminData: {
    stats: {
      totalEmployees: 0,
      totalAdmins: 0,
      totalProducts: 0,
      activeProducts: 0,
      soldProducts: 0,
      deletedProducts: 0,
      totalMessages: 0,
      totalLogs: 0,
      totalReservations: 0,      // [ใหม่]
      pendingReservations: 0,    // [ใหม่]
      confirmedReservations: 0   // [ใหม่]
    },
    products: [],
    logs: [],
    reservations: [] // [ใหม่]
  },
  adminProductFilterStatus: 'ALL',
  adminSearchQuery: '',
  currentAdminTab: 'products' // [ใหม่] products | reservations | logs
};

const ADMIN_STORAGE_KEY = 'emp_marketplace_user';

document.addEventListener('DOMContentLoaded', () => {
  ADMIN_STATE.isApiConfigured = Boolean(CONFIG.API_URL && CONFIG.API_URL.trim() !== '');
  tryAutoLoginFromStorage();
});

async function tryAutoLoginFromStorage() {
  const saved = localStorage.getItem(ADMIN_STORAGE_KEY);
  if (!saved) {
    showAdminLoginScreen();
    return;
  }

  try {
    const user = JSON.parse(saved);
    if (!user || !user.empId) {
      showAdminLoginScreen();
      return;
    }

    if (!ADMIN_STATE.isApiConfigured) {
      if (user.isAdmin === true) {
        ADMIN_STATE.currentUser = user;
        showAdminDashboardScreen();
      } else {
        showAdminLoginScreen();
      }
      return;
    }

    const isAdmin = await verifyAdminOnServer(user.empId, user.sessionToken);
    if (isAdmin) {
      ADMIN_STATE.currentUser = user;
      showAdminDashboardScreen();
    } else {
      showAdminLoginScreen();
    }
  } catch (e) {
    showAdminLoginScreen();
  }
}

async function verifyAdminOnServer(empId, token) {
  try {
    const response = await fetch(`${CONFIG.API_URL}?action=getAdminDashboard&adminEmpId=${encodeURIComponent(empId)}&token=${encodeURIComponent(token || '')}&_t=${Date.now()}`);
    const result = await response.json();
    return Boolean(result.success);
  } catch (e) {
    return false;
  }
}

// เรียกเมื่อเซิร์ฟเวอร์ตอบกลับว่า session หมดอายุ/ไม่ถูกต้อง (sessionExpired: true)
function handleAdminAuthExpired(result) {
  if (!result || !result.sessionExpired) return false;

  ADMIN_STATE.currentUser = null;
  localStorage.removeItem(ADMIN_STORAGE_KEY);

  Swal.fire({
    icon: 'warning',
    title: 'เซสชันหมดอายุ',
    text: 'กรุณาเข้าสู่ระบบแอดมินใหม่อีกครั้ง',
    confirmButtonColor: '#0f172a'
  }).then(() => showAdminLoginScreen());

  return true;
}

function showAdminLoginScreen() {
  document.getElementById('adminLoginScreen').classList.remove('hidden');
  document.getElementById('adminDashboardScreen').classList.add('hidden');
  document.getElementById('adminDashboardScreen').classList.remove('flex');
}

function showAdminDashboardScreen() {
  document.getElementById('adminLoginScreen').classList.add('hidden');
  document.getElementById('adminDashboardScreen').classList.remove('hidden');

  document.getElementById('adminNavName').textContent = ADMIN_STATE.currentUser.name || ADMIN_STATE.currentUser.empId;
  document.getElementById('adminNavId').textContent = ADMIN_STATE.currentUser.empId;

  loadAdminDashboardData();
}

async function handleAdminLoginSubmit(event) {
  event.preventDefault();

  const empId = document.getElementById('adminEmpIdInput').value.trim().toUpperCase();
  const pin = document.getElementById('adminPinInput').value.trim();
  const errorDiv = document.getElementById('adminLoginError');
  const submitBtn = document.getElementById('adminLoginSubmitBtn');

  if (!empId || !pin) return;

  errorDiv.classList.add('hidden');
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-lg"></i> กำลังตรวจสอบ...`;

  try {
    let user = null;

    if (!ADMIN_STATE.isApiConfigured) {
      await new Promise(r => setTimeout(r, 500));
      const demoAdminIds = Array.isArray(CONFIG.ADMIN_EMP_IDS) ? CONFIG.ADMIN_EMP_IDS : ['EMP001', 'ADMIN', 'ADMIN001', 'IT001'];
      const isAdminUser = demoAdminIds.includes(empId) || empId.startsWith('ADMIN');
      if (!isAdminUser) {
        errorDiv.textContent = 'บัญชีนี้ไม่มีสิทธิ์ผู้ดูแลระบบ (Demo Mode)';
        errorDiv.classList.remove('hidden');
        return;
      }
      user = { empId, name: `ผู้ดูแลระบบ ${empId}`, department: 'Administration', isAdmin: true };
    } else {
      const response = await fetch(CONFIG.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'login', empId, pin })
      });
      const result = await response.json();

      if (!result.success || !result.user) {
        errorDiv.textContent = result.message || 'รหัสพนักงานหรือ PIN ไม่ถูกต้อง';
        errorDiv.classList.remove('hidden');
        return;
      }

      if (result.user.isAdmin !== true) {
        errorDiv.textContent = 'บัญชีนี้ไม่มีสิทธิ์ผู้ดูแลระบบ กรุณาติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์';
        errorDiv.classList.remove('hidden');
        return;
      }

      user = result.user;
    }

    ADMIN_STATE.currentUser = user;
    localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(user));
    showAdminDashboardScreen();

  } catch (err) {
    errorDiv.textContent = 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง';
    errorDiv.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<span>เข้าสู่ระบบแอดมิน</span><i class="ph-bold ph-arrow-right"></i>`;
  }
}

function handleAdminLogout() {
  Swal.fire({
    title: 'ออกจากระบบแอดมิน?',
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#0f172a',
    cancelButtonColor: '#94a3b8',
    confirmButtonText: 'ออกจากระบบ',
    cancelButtonText: 'ยกเลิก'
  }).then((res) => {
    if (res.isConfirmed) {
      ADMIN_STATE.currentUser = null;
      localStorage.removeItem(ADMIN_STORAGE_KEY);
      showAdminLoginScreen();
    }
  });
}

async function loadAdminDashboardData() {
  if (!ADMIN_STATE.currentUser) return;

  try {
    if (!ADMIN_STATE.isApiConfigured) {
      ADMIN_STATE.adminData = {
        stats: {
          totalEmployees: 0, totalAdmins: 0, totalProducts: 0,
          activeProducts: 0, soldProducts: 0, deletedProducts: 0,
          totalMessages: 0, totalLogs: 0,
          totalReservations: 0, pendingReservations: 0, confirmedReservations: 0
        },
        products: [],
        logs: [],
        reservations: []
      };
      renderAdminDashboard();
      Swal.fire({
        icon: 'info',
        title: 'ยังไม่ได้เชื่อมต่อ Backend',
        text: 'กรุณาตั้งค่า API_URL ใน config.js เพื่อดูข้อมูลจริงจาก Google Sheets',
        timer: 2500,
        showConfirmButton: false
      });
      return;
    }

    const response = await fetch(`${CONFIG.API_URL}?action=getAdminDashboard&adminEmpId=${encodeURIComponent(ADMIN_STATE.currentUser.empId)}&token=${encodeURIComponent(ADMIN_STATE.currentUser.sessionToken || '')}&_t=${Date.now()}`);
    const result = await response.json();

    if (handleAdminAuthExpired(result)) return;

    if (result.success) {
      ADMIN_STATE.adminData = {
        stats: result.stats || {},
        products: result.products || [],
        logs: result.logs || [],
        reservations: result.reservations || [] // [ใหม่]
      };
      renderAdminDashboard();
    } else {
      Swal.fire({ icon: 'error', title: 'ปฏิเสธการเข้าถึง', text: result.message || 'คุณไม่มีสิทธิ์เข้าถึงข้อมูลนี้แล้ว' });
      handleAdminLogout();
    }
  } catch (err) {
    console.error('Error fetching admin data:', err);
    Swal.fire({ icon: 'error', title: 'เชื่อมต่อล้มเหลว', text: 'ไม่สามารถโหลดข้อมูลจากเซิร์ฟเวอร์ได้' });
  }
}

function renderAdminDashboard() {
  const stats = ADMIN_STATE.adminData.stats;
  document.getElementById('adminStatActiveProd').textContent = stats.activeProducts || 0;
  document.getElementById('adminStatSoldProd').textContent = stats.soldProducts || 0;
  document.getElementById('adminStatDeletedProd').textContent = stats.deletedProducts || 0;
  document.getElementById('adminStatEmployees').textContent = `${stats.totalEmployees || 0} คน`;
  document.getElementById('adminStatPendingReservations').textContent = stats.pendingReservations || 0; // [ใหม่]

  renderAdminProductTable();
  renderAdminReservationsTable(); // [ใหม่]
  renderAdminLogsTable();
}

function switchAdminTab(tabName) {
  ADMIN_STATE.currentAdminTab = tabName;

  const tabs = {
    products: { btn: 'adminTabBtnProducts', panel: 'adminTabProducts' },
    reservations: { btn: 'adminTabBtnReservations', panel: 'adminTabReservations' },
    logs: { btn: 'adminTabBtnLogs', panel: 'adminTabLogs' }
  };

  const activeCls = 'flex-shrink-0 whitespace-nowrap px-3 sm:px-4 py-2 text-[11px] sm:text-xs font-bold rounded-xl transition bg-blue-600 text-white shadow-sm flex items-center gap-1.5';
  const inactiveCls = 'flex-shrink-0 whitespace-nowrap px-3 sm:px-4 py-2 text-[11px] sm:text-xs font-medium rounded-xl transition bg-white text-slate-700 hover:bg-slate-200 border border-slate-200 flex items-center gap-1.5';

  Object.keys(tabs).forEach(key => {
    const btnEl = document.getElementById(tabs[key].btn);
    const panelEl = document.getElementById(tabs[key].panel);
    if (!btnEl || !panelEl) return;

    if (key === tabName) {
      btnEl.className = activeCls;
      panelEl.classList.remove('hidden');
    } else {
      btnEl.className = inactiveCls;
      panelEl.classList.add('hidden');
    }
  });
}

function setAdminProductFilter(status, evt) {
  ADMIN_STATE.adminProductFilterStatus = status;

  document.querySelectorAll('.admin-prod-filter').forEach(btn => {
    btn.className = 'admin-prod-filter flex-shrink-0 whitespace-nowrap px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs';
  });

  const targetBtn = evt ? evt.target.closest('button') : null;
  if (targetBtn) {
    targetBtn.className = 'admin-prod-filter flex-shrink-0 whitespace-nowrap px-3 py-1.5 rounded-lg bg-slate-800 text-white font-medium text-xs';
  }

  renderAdminProductTable();
}

function filterAdminProducts() {
  ADMIN_STATE.adminSearchQuery = (document.getElementById('adminProductSearch').value || '').trim().toLowerCase();
  renderAdminProductTable();
}

function renderAdminProductTable() {
  const tbody = document.getElementById('adminProductTableBody');
  const products = ADMIN_STATE.adminData.products || [];

  const filtered = products.filter(item => {
    const matchStatus = ADMIN_STATE.adminProductFilterStatus === 'ALL' ||
      (ADMIN_STATE.adminProductFilterStatus === 'DELETED' && (item.status === 'DELETED' || item.status === 'DELETED_BY_ADMIN')) ||
      item.status === ADMIN_STATE.adminProductFilterStatus;

    const matchQuery = !ADMIN_STATE.adminSearchQuery ||
      (item.title && item.title.toLowerCase().includes(ADMIN_STATE.adminSearchQuery)) ||
      (item.empId && item.empId.toLowerCase().includes(ADMIN_STATE.adminSearchQuery)) ||
      (item.productId && item.productId.toLowerCase().includes(ADMIN_STATE.adminSearchQuery));

    return matchStatus && matchQuery;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="p-8 text-center text-slate-400">
          ไม่พบรายการสินค้าที่ตรงกับเงื่อนไข
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(item => {
    const isDeleted = item.status === 'DELETED' || item.status === 'DELETED_BY_ADMIN';
    let statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">กำลังขาย</span>`;
    if (item.status === 'SOLD') {
      statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">ขายแล้ว</span>`;
    } else if (isDeleted) {
      statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">ถูกลบ/แบน</span>`;
    }

    return `
      <tr class="hover:bg-slate-50/80 transition">
        <td class="p-3">
          <div class="flex items-center gap-2.5">
            <img src="${item.imageUrl || 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?w=100'}" class="w-10 h-10 rounded-lg object-cover bg-slate-100 flex-shrink-0" />
            <div class="min-w-0">
              <div class="font-bold text-slate-800 truncate max-w-[200px]">${escapeHtmlAdmin(item.title)}</div>
              <div class="text-[10px] text-slate-400 font-mono">${item.productId} • ${escapeHtmlAdmin(item.category)}</div>
            </div>
          </div>
        </td>
        <td class="p-3 font-mono font-bold text-blue-600">
          ฿${Number(item.price).toLocaleString()}
        </td>
        <td class="p-3">
          <span class="font-mono font-semibold text-slate-700">${escapeHtmlAdmin(item.empId)}</span>
          <div class="text-[10px] text-slate-400">${escapeHtmlAdmin(item.phone) || '-'}</div>
        </td>
        <td class="p-3 text-slate-500 text-[11px] hidden sm:table-cell">
          ${item.createdAt || '-'}
        </td>
        <td class="p-3">
          ${statusBadge}
        </td>
        <td class="p-3 text-right">
          ${!isDeleted ? `
            <button
              onclick="handleAdminDeletePost('${item.productId}')"
              class="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-lg text-xs font-semibold flex items-center gap-1 ml-auto transition"
              title="ลบโพสต์ที่ไม่เหมาะสม"
            >
              <i class="ph-bold ph-trash"></i>
              <span>ลบโพสต์นี้</span>
            </button>
          ` : `
            <span class="text-[11px] text-slate-400 italic">ลบแล้ว</span>
          `}
        </td>
      </tr>
    `;
  }).join('');
}

// [ใหม่] ตารางแสดงรายการจองสินค้าทั้งหมดสำหรับแอดมิน (อ่านอย่างเดียว เพื่อการตรวจสอบ)
function renderAdminReservationsTable() {
  const tbody = document.getElementById('adminReservationsTableBody');
  if (!tbody) return;

  const reservations = ADMIN_STATE.adminData.reservations || [];

  if (reservations.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="p-8 text-center text-slate-400">
          ยังไม่มีข้อมูลการจองสินค้าในระบบ
        </td>
      </tr>
    `;
    return;
  }

  const statusBadge = (status) => {
    if (status === 'PENDING') return `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">รอยืนยัน</span>`;
    if (status === 'CONFIRMED') return `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">ยืนยันแล้ว</span>`;
    if (status === 'REJECTED') return `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">ถูกปฏิเสธ</span>`;
    return `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">ยกเลิกแล้ว</span>`;
  };

  tbody.innerHTML = reservations.map(r => `
    <tr class="hover:bg-slate-50 transition">
      <td class="p-3 text-slate-500 font-mono text-[11px] whitespace-nowrap">${r.createdAt || '-'}</td>
      <td class="p-3 font-mono text-[11px] text-slate-600">${escapeHtmlAdmin(r.reservationId)}</td>
      <td class="p-3 font-mono text-[11px] text-slate-600">${escapeHtmlAdmin(r.productId)}</td>
      <td class="p-3 font-mono font-semibold text-slate-700">${escapeHtmlAdmin(r.buyerEmpId)}</td>
      <td class="p-3 font-mono font-semibold text-slate-700">${escapeHtmlAdmin(r.sellerEmpId)}</td>
      <td class="p-3 font-mono text-slate-700">${r.quantity}</td>
      <td class="p-3">${statusBadge(r.status)}</td>
    </tr>
  `).join('');
}

async function handleAdminDeletePost(productId) {
  const item = (ADMIN_STATE.adminData.products || []).find(p => p.productId === productId);

  if (!item) {
    Swal.fire({ icon: 'error', title: 'ไม่พบข้อมูลสินค้านี้ อาจถูกลบหรือรีเฟรชข้อมูลไปแล้ว' });
    return;
  }

  const productTitle = item.title;
  const sellerEmpId = item.empId;

  const { value: reason, isConfirmed } = await Swal.fire({
    title: 'ลบโพสต์ที่ไม่เหมาะสม (Admin)',
    html: `
      <p class="text-xs text-slate-600 mb-3 text-left">
        ต้องการลบสินค้า: <b>${escapeHtmlAdmin(productTitle)}</b><br/>
        ของผู้ลงประกาศ: <b>${escapeHtmlAdmin(sellerEmpId)}</b>
      </p>
    `,
    input: 'select',
    inputOptions: {
      'เนื้อหาไม่เกี่ยวข้องกับการซื้อขายในองค์กร': 'เนื้อหาไม่เกี่ยวข้องกับการซื้อขายในองค์กร',
      'สินค้าหรือบริการผิดระเบียบบริษัท': 'สินค้าหรือบริการผิดระเบียบบริษัท',
      'โพสต์สแปม หรือข้อมูลหลอกลวง': 'โพสต์สแปม หรือข้อมูลหลอกลวง',
      'รูปภาพหรือข้อความไม่เหมาะสม/หยาบคาย': 'รูปภาพหรือข้อความไม่เหมาะสม/หยาบคาย',
      'อื่นๆ': 'เหตุผลอื่นๆ'
    },
    inputPlaceholder: 'เลือกเหตุผลการลบโพสต์',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    confirmButtonText: 'ยืนยันลบโพสต์นี้',
    cancelButtonText: 'ยกเลิก',
    inputValidator: (value) => {
      if (!value) return 'กรุณาเลือกเหตุผลในการลบโพสต์';
    }
  });

  if (!isConfirmed || !reason) return;

  try {
    if (ADMIN_STATE.isApiConfigured) {
      const response = await fetch(CONFIG.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'adminDeleteProduct',
          productId: productId,
          adminEmpId: ADMIN_STATE.currentUser.empId,
          token: ADMIN_STATE.currentUser.sessionToken,
          reason: reason
        })
      });
      const result = await response.json();
      if (handleAdminAuthExpired(result)) return;
      if (!result.success) {
        Swal.fire({ icon: 'error', title: 'ลบไม่สำเร็จ', text: result.message || 'เกิดข้อผิดพลาด' });
        return;
      }
    }

    item.status = 'DELETED_BY_ADMIN';
    renderAdminDashboard();

    Swal.fire({
      icon: 'success',
      title: 'ลบโพสต์เรียบร้อย',
      text: 'โพสต์ถูกนำออกจากระบบและบันทึกประวัติลง Logs แล้ว',
      timer: 2000,
      showConfirmButton: false
    });

    loadAdminDashboardData();
  } catch (err) {
    console.error(err);
    Swal.fire({ icon: 'error', title: 'เชื่อมต่อล้มเหลว', text: 'ไม่สามารถส่งคำสั่งลบไปยังเซิร์ฟเวอร์ได้' });
  }
}

function renderAdminLogsTable() {
  const tbody = document.getElementById('adminLogsTableBody');
  const logs = ADMIN_STATE.adminData.logs || [];

  if (logs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="p-8 text-center text-slate-400">
          ยังไม่มีข้อมูลประวัติกิจกรรม (Logs)
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = logs.map(log => {
    let actionBadge = `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 font-mono">${escapeHtmlAdmin(log.action)}</span>`;
    if (log.action === 'LOGIN') {
      actionBadge = `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-700 font-mono">LOGIN</span>`;
    } else if (log.action === 'POST_PRODUCT') {
      actionBadge = `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-700 font-mono">POST</span>`;
    } else if (log.action.includes('DELETE') || log.action.includes('CLEANUP')) {
      actionBadge = `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-700 font-mono">${escapeHtmlAdmin(log.action)}</span>`;
    } else if (log.action === 'SEND_MESSAGE') {
      actionBadge = `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 text-purple-700 font-mono">MESSAGE</span>`;
    } else if (log.action.includes('RESERVATION')) {
      actionBadge = `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-700 font-mono">${escapeHtmlAdmin(log.action)}</span>`;
    }

    return `
      <tr class="hover:bg-slate-50 transition">
        <td class="p-3 text-slate-500 font-mono text-[11px] whitespace-nowrap">${log.timestamp || '-'}</td>
        <td class="p-3 font-mono font-bold text-slate-800">${escapeHtmlAdmin(log.empId)}</td>
        <td class="p-3">${actionBadge}</td>
        <td class="p-3 text-slate-700 text-xs">${escapeHtmlAdmin(log.details)}</td>
      </tr>
    `;
  }).join('');
}

function escapeHtmlAdmin(string) {
  if (!string) return '';
  return String(string)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}