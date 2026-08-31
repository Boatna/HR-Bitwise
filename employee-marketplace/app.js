
const STATE = {
  currentUser: null,
  allProducts: [],
  filteredProducts: [],
  selectedCategory: 'all',
  searchQuery: '',
  selectedImageBase64: '',
  selectedImageName: '',
  currentDetailProduct: null,
  currentChatPartnerId: '',
  currentChatPartnerName: '',
  chatPollingInterval: null,
  isApiConfigured: false,

  // Admin Dashboard State
  adminData: {
    stats: {
      totalEmployees: 0,
      totalProducts: 0,
      activeProducts: 0,
      soldProducts: 0,
      deletedProducts: 0,
      totalMessages: 0,
      totalLogs: 0
    },
    products: [],
    logs: []
  },
  adminActiveTab: 'products',
  adminProductFilterStatus: 'ALL',
  adminSearchQuery: ''
};

const MOCK_PRODUCTS = [
  {
    productId: 'PROD-001',
    empId: 'EMP001',
    sellerName: 'สมชาย ใจดี',
    sellerDept: 'IT Development',
    sellerPlant: 'Plant 1',
    title: 'หูฟังไร้สาย Sony WH-1000XM4 สภาพ 95%',
    category: 'อิเล็กทรอนิกส์ & มือถือ',
    price: 4900,
    description: 'ใช้งานน้อยมากครับ อุปกรณ์ครบกล่อง มีเคส สายชาร์จ สายแจ็คครบ แบตยังอึดเหมือนใหม่ นัดรับได้ที่ตึก A ชั้น 3 ครับ',
    phone: '081-234-5678',
    imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80',
    status: 'ACTIVE',
    createdAt: '31/08/2026 09:30'
  },
  {
    productId: 'PROD-002',
    empId: 'EMP002',
    sellerName: 'สมศรี มีสุข',
    sellerDept: 'Human Resources',
    sellerPlant: 'Plant 2',
    title: 'เก้าอี้เพื่อสุขภาพ Ergonomic Chair สีกรม',
    category: 'ของใช้ในบ้าน & เฟอร์นิเจอร์',
    price: 2200,
    description: 'เก้าอี้ทำงานปรับระดับได้ รองรับหลังได้ดีมาก ซื้อมาใช้งาน Work From Home สภาพดีไม่มีรอยขาด นัดรับแถวสำนักงานใหญ่',
    phone: '089-987-6543',
    imageUrl: 'https://images.unsplash.com/photo-1580481077190-736959684218?w=600&auto=format&fit=crop&q=80',
    status: 'ACTIVE',
    createdAt: '31/08/2026 11:15'
  },
  {
    productId: 'PROD-003',
    empId: 'EMP003',
    sellerName: 'วิชัย ชัยชนะ',
    sellerDept: 'Production Line B',
    sellerPlant: 'Plant 1',
    title: 'ขนมเปี๊ยะอบควันเทียน ไส้ถั่วไข่เค็ม (กล่อง 6 ลูก)',
    category: 'อาหาร & ขนม',
    price: 120,
    description: 'คุณแม่ทำเอง สดใหม่ทุกวัน ไส้แน่นแป้งบาง หวานน้อย สั่งจองแล้วนัดรับที่โรงอาหารตอนพักเที่ยงได้เลยครับ',
    phone: '086-555-1234',
    imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&auto=format&fit=crop&q=80',
    status: 'ACTIVE',
    createdAt: '31/08/2026 13:00'
  },
  {
    productId: 'PROD-004',
    empId: 'EMP004',
    sellerName: 'ณภัทร รุ่งเรือง',
    sellerDept: 'Logistics & Warehouse',
    sellerPlant: 'Plant 3',
    title: 'กล้องติดหน้ารถยนต์ Xiaomi 70mai 2K คมชัด',
    category: 'ยานยนต์ & อะไหล่',
    price: 850,
    description: 'กล้องติดหน้ารถ สภาพใช้งานได้ปกติ อุปกรณ์ครบ นัดรับได้ที่โกดัง 2 ครับ',
    phone: '082-111-9988',
    imageUrl: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&auto=format&fit=crop&q=80',
    status: 'ACTIVE',
    createdAt: '31/08/2026 14:20'
  }
];

// Sample Mock Messages Store
let MOCK_MESSAGES = [
  {
    messageId: 'MSG-1',
    productId: 'PROD-001',
    senderEmpID: 'EMP002',
    receiverEmpID: 'EMP001',
    message: 'สวัสดีครับ หูฟังยังอยู่ไหมครับ ลดได้อีกนิดไหมครับ',
    timestamp: '31/08/2026 10:00'
  },
  {
    messageId: 'MSG-2',
    productId: 'PROD-001',
    senderEmpID: 'EMP001',
    receiverEmpID: 'EMP002',
    message: 'ยังอยู่ครับ ถ้ามารับเองที่ตึก A ลดให้เหลือ 4,500 บาทได้ครับ',
    timestamp: '31/08/2026 10:05'
  }
];

// Sample Mock Logs
let MOCK_LOGS = [
  { logId: 'LOG-1', timestamp: '31/08/2026 09:00', empId: 'EMP001', action: 'LOGIN', details: 'เข้าสู่ระบบสำเร็จ (สมชาย ใจดี, IT)' },
  { logId: 'LOG-2', timestamp: '31/08/2026 09:30', empId: 'EMP001', action: 'POST_PRODUCT', details: 'ลงขายสินค้า [PROD-001] "หูฟังไร้สาย Sony WH-1000XM4"' },
  { logId: 'LOG-3', timestamp: '31/08/2026 10:00', empId: 'EMP002', action: 'LOGIN', details: 'เข้าสู่ระบบสำเร็จ (สมศรี มีสุข, HR)' },
  { logId: 'LOG-4', timestamp: '31/08/2026 10:00', empId: 'EMP002', action: 'SEND_MESSAGE', details: 'ส่งข้อความถึง EMP001 (สินค้า PROD-001)' }
];

/**
 * =========================================================================
 * 1. INITIALIZATION & AUTHENTICATION
 * =========================================================================
 */
document.addEventListener('DOMContentLoaded', () => {
  STATE.isApiConfigured = Boolean(CONFIG.API_URL && CONFIG.API_URL.trim() !== '');

  // ตรวจสอบสถานะการเข้าสู่ระบบ
  checkStoredAuth();

  // สร้างปุ่มหมวดหมู่
  renderCategories();

  // โหลดรายการสินค้า
  loadProducts();
});

function checkStoredAuth() {
  const savedUser = localStorage.getItem('emp_marketplace_user');
  if (savedUser) {
    try {
      STATE.currentUser = JSON.parse(savedUser);
    } catch (e) {
      STATE.currentUser = null;
    }
  }
  updateUserNav();
}

function checkIsAdmin(user) {
  if (!user || !user.empId) return false;
  const adminList = Array.isArray(CONFIG.ADMIN_EMP_IDS) ? CONFIG.ADMIN_EMP_IDS : ['EMP001', 'ADMIN', 'ADMIN001', 'IT001'];
  return user.isAdmin === true || adminList.includes(user.empId.toUpperCase());
}

function updateUserNav() {
  const container = document.getElementById('userNavContainer');
  const welcomeBanner = document.getElementById('welcomeBanner');

  if (STATE.currentUser) {
    const initials = STATE.currentUser.name ? STATE.currentUser.name.substring(0, 2) : 'EM';
    const isAdminUser = checkIsAdmin(STATE.currentUser);

    container.innerHTML = `
      <div class="relative group">
        <button class="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 transition border border-slate-200">
          <div class="w-8 h-8 rounded-lg ${isAdminUser ? 'bg-indigo-700' : 'bg-blue-600'} text-white flex items-center justify-center font-bold text-xs shadow-sm">
            ${initials}
          </div>
          <div class="hidden lg:block text-left pr-1">
            <div class="flex items-center gap-1.5">
              <span class="text-xs font-bold text-slate-800 leading-tight">${STATE.currentUser.name}</span>
              ${isAdminUser ? '<span class="text-[9px] bg-indigo-100 text-indigo-700 px-1.5 py-0.2 rounded font-bold">Admin</span>' : ''}
            </div>
            <div class="text-[10px] text-slate-400 font-mono">${STATE.currentUser.empId}</div>
          </div>
          <i class="ph ph-caret-down text-xs text-slate-400"></i>
        </button>

        <!-- Dropdown Menu -->
        <div class="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 hidden group-hover:block hover:block z-50 fade-in">
          <div class="px-4 py-2 border-b border-slate-100">
            <div class="flex items-center justify-between">
              <p class="text-xs font-bold text-slate-800">${STATE.currentUser.name}</p>
              ${isAdminUser ? '<span class="text-[9px] bg-indigo-600 text-white px-1.5 py-0.5 rounded font-mono">ADMIN</span>' : ''}
            </div>
            <p class="text-[11px] text-slate-500">${STATE.currentUser.department || ''} ${STATE.currentUser.plant ? '• ' + STATE.currentUser.plant : ''}</p>
            <p class="text-[10px] text-blue-600 font-mono mt-0.5">EmpID: ${STATE.currentUser.empId}</p>
          </div>

          ${isAdminUser ? `
            <button onclick="openAdminDashboard()" class="w-full text-left px-4 py-2 text-xs font-bold text-indigo-600 hover:bg-indigo-50 flex items-center gap-2">
              <i class="ph-bold ph-shield-check text-base"></i> แผงควบคุมผู้ดูแลระบบ (Admin)
            </button>
            <div class="border-t border-slate-100 my-1"></div>
          ` : ''}

          <button onclick="openMyListingsModal()" class="w-full text-left px-4 py-2 text-xs font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2">
            <i class="ph ph-archive-box text-base"></i> สินค้าของฉัน
          </button>
          <div class="border-t border-slate-100 my-1"></div>
          <button onclick="handleLogout()" class="w-full text-left px-4 py-2 text-xs font-medium text-red-600 hover:bg-red-50 flex items-center gap-2">
            <i class="ph ph-sign-out text-base"></i> ออกจากระบบ
          </button>
        </div>
      </div>
    `;

    // Show banner
    if (welcomeBanner) {
      welcomeBanner.classList.remove('hidden');
      document.getElementById('bannerUserName').textContent = `สวัสดีคุณ ${STATE.currentUser.name}`;
      document.getElementById('bannerUserDetail').textContent = `รหัส ${STATE.currentUser.empId} • ${STATE.currentUser.department || 'พนักงาน'} ${STATE.currentUser.plant ? '• ' + STATE.currentUser.plant : ''} ${isAdminUser ? '• (ผู้ดูแลระบบ)' : ''}`;
    }
  } else {
    container.innerHTML = `
      <button
        onclick="openLoginModal()"
        class="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-medium text-sm rounded-xl transition"
      >
        <i class="ph-bold ph-sign-in text-base"></i>
        <span>เข้าสู่ระบบ</span>
      </button>
    `;

    if (welcomeBanner) {
      welcomeBanner.classList.add('hidden');
    }
  }
}

/**
 * =========================================================================
 * 2. LOGIN / AUTHENTICATION MODAL & SUBMIT
 * =========================================================================
 */
function openLoginModal() {
  document.getElementById('loginModal').classList.remove('hidden');
  document.getElementById('loginModal').classList.add('flex');
  document.getElementById('loginError').classList.add('hidden');
  document.getElementById('loginEmpId').focus();
}

function closeLoginModal() {
  document.getElementById('loginModal').classList.add('hidden');
  document.getElementById('loginModal').classList.remove('flex');
}

function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  const icon = btn.querySelector('i');
  if (input.type === 'password') {
    input.type = 'text';
    icon.classList.remove('ph-eye');
    icon.classList.add('ph-eye-slash');
  } else {
    input.type = 'password';
    icon.classList.remove('ph-eye-slash');
    icon.classList.add('ph-eye');
  }
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  const empId = document.getElementById('loginEmpId').value.trim().toUpperCase();
  const pin = document.getElementById('loginPin').value.trim();
  const errorDiv = document.getElementById('loginError');
  const submitBtn = document.getElementById('loginSubmitBtn');

  if (!empId || !pin) return;

  errorDiv.classList.add('hidden');
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-lg"></i> กำลังตรวจสอบ...`;

  try {
    if (!STATE.isApiConfigured) {
      // Demo Mode Fallback
      await new Promise(r => setTimeout(r, 600));
      const isAdminUser = CONFIG.ADMIN_EMP_IDS.includes(empId) || empId.startsWith('ADMIN');
      STATE.currentUser = {
        empId: empId,
        name: `พนักงาน ${empId}`,
        department: isAdminUser ? 'Administration' : 'IT / Operations',
        position: isAdminUser ? 'System Admin' : 'Officer',
        plant: 'Plant 1',
        isAdmin: isAdminUser
      };
      localStorage.setItem('emp_marketplace_user', JSON.stringify(STATE.currentUser));
      closeLoginModal();
      updateUserNav();
      Swal.fire({
        icon: 'success',
        title: 'เข้าสู่ระบบสำเร็จ (Demo Mode)',
        text: `ยินดีต้อนรับคุณ ${STATE.currentUser.name} ${isAdminUser ? '👑 (Admin)' : ''}`,
        timer: 2000,
        showConfirmButton: false
      });
      return;
    }

    // Call Real Google Apps Script Backend
    const response = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'login',
        empId: empId,
        pin: pin
      })
    });

    const result = await response.json();

    if (result.success && result.user) {
      STATE.currentUser = result.user;
      localStorage.setItem('emp_marketplace_user', JSON.stringify(STATE.currentUser));
      closeLoginModal();
      updateUserNav();
      Swal.fire({
        icon: 'success',
        title: 'เข้าสู่ระบบสำเร็จ',
        text: `ยินดีต้อนรับคุณ ${result.user.name}`,
        timer: 2000,
        showConfirmButton: false
      });
    } else {
      errorDiv.textContent = result.message || 'รหัสพนักงานหรือ PIN ไม่ถูกต้อง';
      errorDiv.classList.remove('hidden');
    }
  } catch (err) {
    errorDiv.textContent = 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง';
    errorDiv.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<span>เข้าสู่ระบบ</span><i class="ph-bold ph-arrow-right"></i>`;
  }
}

function handleLogout() {
  Swal.fire({
    title: 'ต้องการออกจากระบบ?',
    text: 'ระบบจะล้างข้อมูลและประวัติการสนทนาในเครื่อง เพื่อความปลอดภัยและไม่ให้หนักเครื่อง',
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#3b82f6',
    cancelButtonColor: '#94a3b8',
    confirmButtonText: 'ออกจากระบบ',
    cancelButtonText: 'ยกเลิก'
  }).then((res) => {
    if (res.isConfirmed) {
      // 1. ล้างข้อมูลผู้ใช้ใน State และ Storage
      STATE.currentUser = null;
      localStorage.removeItem('emp_marketplace_user');
      localStorage.removeItem('emp_marketplace_chat_cache');
      sessionStorage.clear();

      // 2. หยุดการทำงานของ Polling และล้างข้อมูลแชททั้งหมดในหน่วยความจำ
      if (STATE.chatPollingInterval) {
        clearInterval(STATE.chatPollingInterval);
        STATE.chatPollingInterval = null;
      }
      STATE.currentChatProduct = null;
      STATE.currentChatPartnerId = '';
      STATE.currentChatPartnerName = '';

      // 3. ล้างข้อความในหน้าต่างแชท (DOM) เพื่อไม่ให้ค้างในเบราว์เซอร์
      const chatArea = document.getElementById('chatMessagesArea');
      if (chatArea) {
        chatArea.innerHTML = `
          <div class="text-center py-12 text-slate-400 text-xs">
            <i class="ph ph-chat-circle-dots text-3xl mb-2 block"></i>
            เริ่มการสนทนาเกี่ยวกับสินค้านี้
          </div>
        `;
      }
      const chatInput = document.getElementById('chatInput');
      if (chatInput) chatInput.value = '';

      // 4. ล้างข้อมูลภาพที่อาจค้างอยู่ในฟอร์มลงขาย
      removeSelectedImage();

      // 5. ปิด Modal ทั้งหมดที่อาจเปิดอยู่
      closeChatModal();
      closeProductDetailModal();
      closeSellModal();
      closeMyListingsModal();
      closeAdminDashboardModal();

      // 6. อัปเดต UI หน้าเว็บ
      updateUserNav();
      applyFilters();

      Swal.fire({
        icon: 'success',
        title: 'ออกจากระบบเรียบร้อย',
        text: 'ล้างข้อมูลแชทและเซสชันออกจากเครื่องสำเร็จ',
        timer: 1800,
        showConfirmButton: false
      });
    }
  });
}

/**
 * =========================================================================
 * 3. CATEGORIES & SEARCH & PRODUCT FEED
 * =========================================================================
 */
function renderCategories() {
  const container = document.getElementById('categoryContainer');
  const sellCategorySelect = document.getElementById('sellCategory');

  // Categories Bar
  container.innerHTML = CONFIG.CATEGORIES.map(cat => `
    <button
      onclick="filterCategory('${cat.id}')"
      id="cat-btn-${cat.id}"
      class="cat-chip flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition ${
        STATE.selectedCategory === cat.id
          ? 'bg-blue-600 text-white shadow-sm'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }"
    >
      <i class="ph ph-${cat.icon} text-sm"></i>
      <span>${cat.name}</span>
    </button>
  `).join('');

  // Populate Select in Sell Form
  sellCategorySelect.innerHTML = CONFIG.CATEGORIES
    .filter(c => c.id !== 'all')
    .map(cat => `<option value="${cat.name}">${cat.name}</option>`)
    .join('');
}

function filterCategory(catId) {
  STATE.selectedCategory = catId;
  
  document.querySelectorAll('.cat-chip').forEach(btn => {
    btn.className = 'cat-chip flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition bg-slate-100 text-slate-600 hover:bg-slate-200';
  });
  const activeBtn = document.getElementById(`cat-btn-${catId}`);
  if (activeBtn) {
    activeBtn.className = 'cat-chip flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition bg-blue-600 text-white shadow-sm';
  }

  const catObj = CONFIG.CATEGORIES.find(c => c.id === catId);
  document.getElementById('currentCategoryTitle').textContent = catObj ? (catId === 'all' ? 'สินค้าทั้งหมด' : catObj.name) : 'สินค้าทั้งหมด';

  applyFilters();
}

function handleSearch(query) {
  STATE.searchQuery = (query || '').trim().toLowerCase();
  
  const desktopInput = document.getElementById('searchInputDesktop');
  const mobileInput = document.getElementById('searchInputMobile');
  if (desktopInput && desktopInput.value !== query) desktopInput.value = query;
  if (mobileInput && mobileInput.value !== query) mobileInput.value = query;

  applyFilters();
}

function resetSearch() {
  STATE.searchQuery = '';
  document.getElementById('searchInputDesktop').value = '';
  document.getElementById('searchInputMobile').value = '';
  applyFilters();
}

function applyFilters() {
  const catObj = CONFIG.CATEGORIES.find(c => c.id === STATE.selectedCategory);
  const targetCategoryName = catObj && catObj.id !== 'all' ? catObj.name : null;

  STATE.filteredProducts = STATE.allProducts.filter(item => {
    const matchCategory = !targetCategoryName || item.category === targetCategoryName;

    const matchSearch = !STATE.searchQuery || 
      (item.title && item.title.toLowerCase().includes(STATE.searchQuery)) ||
      (item.description && item.description.toLowerCase().includes(STATE.searchQuery)) ||
      (item.sellerName && item.sellerName.toLowerCase().includes(STATE.searchQuery)) ||
      (item.category && item.category.toLowerCase().includes(STATE.searchQuery)) ||
      (item.empId && item.empId.toLowerCase().includes(STATE.searchQuery));

    const matchStatus = item.status !== 'DELETED' && item.status !== 'DELETED_BY_ADMIN';

    return matchCategory && matchSearch && matchStatus;
  });

  renderProductGrid();
}

async function loadProducts(forceRefresh = false) {
  renderLoadingSkeletons();

  try {
    if (!STATE.isApiConfigured) {
      await new Promise(r => setTimeout(r, 400));
      STATE.allProducts = [...MOCK_PRODUCTS];
    } else {
      const response = await fetch(`${CONFIG.API_URL}?action=getProducts&_t=${Date.now()}`);
      const result = await response.json();
      if (result.success && Array.isArray(result.products)) {
        STATE.allProducts = result.products;
      }
    }
  } catch (err) {
    console.error('Error loading products:', err);
    STATE.allProducts = [...MOCK_PRODUCTS];
  }

  applyFilters();
}

function renderLoadingSkeletons() {
  const grid = document.getElementById('productGrid');
  grid.innerHTML = Array(8).fill(0).map(() => `
    <div class="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm p-3 space-y-3">
      <div class="w-full aspect-square rounded-xl shimmer"></div>
      <div class="h-4 bg-slate-200 rounded w-3/4 shimmer"></div>
      <div class="h-5 bg-slate-200 rounded w-1/2 shimmer"></div>
      <div class="flex items-center gap-2 pt-2">
        <div class="w-6 h-6 rounded-full bg-slate-200 shimmer"></div>
        <div class="h-3 bg-slate-200 rounded w-1/3 shimmer"></div>
      </div>
    </div>
  `).join('');
}

function renderProductGrid() {
  const grid = document.getElementById('productGrid');
  const emptyState = document.getElementById('emptyState');
  const countBadge = document.getElementById('productCountBadge');

  countBadge.textContent = `${STATE.filteredProducts.length} รายการ`;

  if (STATE.filteredProducts.length === 0) {
    grid.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  grid.innerHTML = STATE.filteredProducts.map(item => {
    const isSold = item.status === 'SOLD';
    const fallbackImg = 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?w=400&auto=format&fit=crop&q=60';
    const imgUrl = item.imageUrl || fallbackImg;
    const initials = item.sellerName ? item.sellerName.substring(0, 2) : 'EM';

    return `
      <div
        onclick="openProductDetail('${item.productId}')"
        class="product-card bg-white rounded-2xl border border-slate-200/80 overflow-hidden cursor-pointer flex flex-col justify-between group relative"
      >
        <div class="relative w-full aspect-square bg-slate-100 overflow-hidden">
          <img
            src="${imgUrl}"
            alt="${escapeHtml(item.title)}"
            loading="lazy"
            class="w-full h-full object-cover group-hover:scale-105 transition duration-300 ${isSold ? 'grayscale' : ''}"
            onerror="this.src='${fallbackImg}'"
          />
          
          <span class="absolute top-2.5 left-2.5 bg-white/90 backdrop-blur text-[10px] font-semibold text-slate-700 px-2 py-0.5 rounded-md shadow-sm">
            ${item.category || 'ทั่วไป'}
          </span>

          ${isSold ? `
            <div class="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center">
              <span class="bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow">ขายแล้ว</span>
            </div>
          ` : ''}
        </div>

        <div class="p-3 sm:p-4 flex-1 flex flex-col justify-between">
          <div>
            <div class="text-base sm:text-lg font-bold text-blue-600 font-mono leading-none mb-1">
              ฿${Number(item.price || 0).toLocaleString()}
            </div>
            <h3 class="font-semibold text-slate-800 text-xs sm:text-sm line-clamp-2 leading-snug group-hover:text-blue-600 transition">
              ${escapeHtml(item.title)}
            </h3>
          </div>

          <div class="pt-3 mt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <div class="flex items-center gap-1.5 truncate">
              <div class="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[9px] flex-shrink-0">
                ${initials}
              </div>
              <span class="truncate font-medium">${escapeHtml(item.sellerName || item.empId)}</span>
            </div>
            ${item.sellerPlant ? `<span class="text-[10px] text-slate-400 flex-shrink-0">${item.sellerPlant}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * =========================================================================
 * 4. PRODUCT DETAIL MODAL
 * =========================================================================
 */
function openProductDetail(productId) {
  const item = STATE.allProducts.find(p => p.productId === productId);
  if (!item) return;

  STATE.currentDetailProduct = item;

  const fallbackImg = 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?w=600&auto=format&fit=crop&q=60';
  document.getElementById('detailImage').src = item.imageUrl || fallbackImg;
  document.getElementById('detailCategoryBadge').textContent = item.category || 'ทั่วไป';
  document.getElementById('detailPrice').textContent = `฿${Number(item.price || 0).toLocaleString()}`;
  document.getElementById('detailTitle').textContent = item.title;
  document.getElementById('detailDate').textContent = item.createdAt ? `ลงขายเมื่อ: ${item.createdAt}` : '';
  document.getElementById('detailDescription').textContent = item.description || 'ไม่มีรายละเอียดเพิ่มเติม';

  // Seller Info
  document.getElementById('detailSellerAvatar').textContent = item.sellerName ? item.sellerName.substring(0, 2) : 'EM';
  document.getElementById('detailSellerName').textContent = item.sellerName || item.empId;
  document.getElementById('detailSellerDept').textContent = `${item.sellerDept || 'พนักงาน'} ${item.sellerPlant ? '• ' + item.sellerPlant : ''} (รหัส ${item.empId})`;

  // Phone Call Button
  const phoneBtn = document.getElementById('detailPhoneBtn');
  const phoneText = document.getElementById('detailPhoneText');
  if (item.phone) {
    phoneBtn.href = `tel:${item.phone}`;
    phoneText.textContent = `โทร ${item.phone}`;
    phoneBtn.classList.remove('opacity-50', 'pointer-events-none');
  } else {
    phoneBtn.href = '#';
    phoneText.textContent = 'ไม่มีเบอร์ติดต่อ';
    phoneBtn.classList.add('opacity-50', 'pointer-events-none');
  }

  // Owner / Admin Management Button
  const ownerBtn = document.getElementById('detailOwnerManageBtn');
  const chatBtn = document.getElementById('detailChatBtn');
  const isAdminUser = checkIsAdmin(STATE.currentUser);

  if (STATE.currentUser && (STATE.currentUser.empId === item.empId || isAdminUser)) {
    ownerBtn.classList.remove('hidden');
    ownerBtn.innerHTML = isAdminUser && STATE.currentUser.empId !== item.empId
      ? `<i class="ph-bold ph-shield-warning"></i> <span>จัดการ (Admin)</span>`
      : `<i class="ph-bold ph-gear"></i> <span>จัดการ</span>`;
  } else {
    ownerBtn.classList.add('hidden');
  }

  if (STATE.currentUser && STATE.currentUser.empId === item.empId) {
    chatBtn.classList.add('hidden');
  } else {
    chatBtn.classList.remove('hidden');
  }

  document.getElementById('productDetailModal').classList.remove('hidden');
  document.getElementById('productDetailModal').classList.add('flex');
}

function closeProductDetailModal() {
  document.getElementById('productDetailModal').classList.add('hidden');
  document.getElementById('productDetailModal').classList.remove('flex');
}

function promptManageOwnerProduct() {
  const item = STATE.currentDetailProduct;
  if (!item || !STATE.currentUser) return;

  const isAdminUser = checkIsAdmin(STATE.currentUser);
  const isOwner = STATE.currentUser.empId === item.empId;

  if (isAdminUser && !isOwner) {
    // Admin Action for other user's post
    handleAdminDeletePost(item.productId, item.title, item.empId);
    return;
  }

  Swal.fire({
    title: 'จัดการรายการสินค้า',
    text: item.title,
    showDenyButton: true,
    showCancelButton: true,
    confirmButtonText: item.status === 'SOLD' ? 'เปลี่ยนเป็น: กำลังขาย' : 'เปลี่ยนเป็น: ขายแล้ว',
    denyButtonText: 'ลบประกาศนี้',
    cancelButtonText: 'ปิด',
    confirmButtonColor: '#3b82f6',
    denyButtonColor: '#ef4444'
  }).then(async (result) => {
    if (result.isConfirmed) {
      const newStatus = item.status === 'SOLD' ? 'ACTIVE' : 'SOLD';
      await updateItemStatus(item.productId, newStatus);
    } else if (result.isDenied) {
      await deleteItem(item.productId);
    }
  });
}

/**
 * =========================================================================
 * 5. POST / SELL PRODUCT MODAL & IMAGE COMPRESSION
 * =========================================================================
 */
function openSellModal() {
  if (!STATE.currentUser) {
    Swal.fire({
      icon: 'info',
      title: 'กรุณาเข้าสู่ระบบ',
      text: 'คุณต้องเข้าสู่ระบบด้วยรหัสพนักงานก่อนลงประกาศขายสินค้า',
      confirmButtonText: 'เข้าสู่ระบบตอนนี้',
      confirmButtonColor: '#3b82f6'
    }).then((res) => {
      if (res.isConfirmed) openLoginModal();
    });
    return;
  }

  document.getElementById('sellPhone').value = STATE.currentUser.phone || '';
  resetSellForm();

  document.getElementById('sellModal').classList.remove('hidden');
  document.getElementById('sellModal').classList.add('flex');
}

function closeSellModal() {
  document.getElementById('sellModal').classList.add('hidden');
  document.getElementById('sellModal').classList.remove('flex');
}

function resetSellForm() {
  document.getElementById('sellForm').reset();
  removeSelectedImage();
}

function handleImageSelected(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 900;
      const scaleSize = MAX_WIDTH / img.width;
      
      let targetWidth = img.width;
      let targetHeight = img.height;

      if (img.width > MAX_WIDTH) {
        targetWidth = MAX_WIDTH;
        targetHeight = img.height * scaleSize;
      }

      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      STATE.selectedImageBase64 = canvas.toDataURL('image/jpeg', 0.82);
      STATE.selectedImageName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";

      document.getElementById('imagePlaceholder').classList.add('hidden');
      const preview = document.getElementById('imagePreview');
      preview.src = STATE.selectedImageBase64;
      preview.classList.remove('hidden');
      document.getElementById('removeImageBtn').classList.remove('hidden');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function removeSelectedImage() {
  STATE.selectedImageBase64 = '';
  STATE.selectedImageName = '';
  document.getElementById('productImageInput').value = '';
  document.getElementById('imagePreview').src = '';
  document.getElementById('imagePreview').classList.add('hidden');
  document.getElementById('removeImageBtn').classList.add('hidden');
  document.getElementById('imagePlaceholder').classList.remove('hidden');
}

async function handleSellSubmit(event) {
  event.preventDefault();
  if (!STATE.currentUser) return;

  const title = document.getElementById('sellTitle').value.trim();
  const category = document.getElementById('sellCategory').value;
  const price = Number(document.getElementById('sellPrice').value);
  const phone = document.getElementById('sellPhone').value.trim();
  const description = document.getElementById('sellDescription').value.trim();
  const submitBtn = document.getElementById('sellSubmitBtn');

  if (!title || isNaN(price) || !phone) {
    Swal.fire({ icon: 'warning', title: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-lg"></i> กำลังบันทึกข้อมูล...`;

  const newProductPayload = {
    action: 'createProduct',
    empId: STATE.currentUser.empId,
    title: title,
    category: category,
    price: price,
    phone: phone,
    description: description,
    imageBase64: STATE.selectedImageBase64,
    imageName: STATE.selectedImageName
  };

  try {
    if (!STATE.isApiConfigured) {
      await new Promise(r => setTimeout(r, 800));
      const mockNewItem = {
        productId: 'PROD-' + Date.now(),
        empId: STATE.currentUser.empId,
        sellerName: STATE.currentUser.name,
        sellerDept: STATE.currentUser.department || 'IT',
        sellerPlant: STATE.currentUser.plant || 'Plant 1',
        title: title,
        category: category,
        price: price,
        description: description,
        phone: phone,
        imageUrl: STATE.selectedImageBase64 || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80',
        status: 'ACTIVE',
        createdAt: 'เมื่อสักครู่'
      };
      STATE.allProducts.unshift(mockNewItem);
      MOCK_LOGS.unshift({
        logId: 'LOG-' + Date.now(),
        timestamp: 'เมื่อสักครู่',
        empId: STATE.currentUser.empId,
        action: 'POST_PRODUCT',
        details: `ลงขายสินค้า [${mockNewItem.productId}] "${title}" (ราคา: ฿${price})`
      });
      closeSellModal();
      applyFilters();
      Swal.fire({
        icon: 'success',
        title: 'ลงประกาศสินค้าสำเร็จ!',
        text: 'สินค้าของคุณแสดงบนหน้าเว็บเรียบร้อยแล้ว'
      });
      return;
    }

    const response = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(newProductPayload)
    });

    const result = await response.json();
    if (result.success) {
      closeSellModal();
      Swal.fire({
        icon: 'success',
        title: 'ลงประกาศสินค้าสำเร็จ!',
        text: 'สินค้าถูกบันทึกลงใน Google Sheets เรียบร้อยแล้ว'
      });
      loadProducts(true);
    } else {
      Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: result.message });
    }
  } catch (err) {
    Swal.fire({ icon: 'error', title: 'เชื่อมต่อล้มเหลว', text: 'ไม่สามารถส่งข้อมูลไปยังเซิร์ฟเวอร์ได้' });
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<i class="ph-bold ph-paper-plane-tilt"></i> <span>ลงประกาศขายทันที</span>`;
  }
}

/**
 * =========================================================================
 * 6. CHAT & MESSAGING SYSTEM
 * =========================================================================
 */
function openChatFromDetail() {
  const item = STATE.currentDetailProduct;
  if (!item) return;

  if (!STATE.currentUser) {
    closeProductDetailModal();
    Swal.fire({
      icon: 'info',
      title: 'กรุณาเข้าสู่ระบบ',
      text: 'คุณต้องเข้าสู่ระบบก่อนเริ่มแชทกับผู้ขาย',
      confirmButtonText: 'เข้าสู่ระบบ',
      confirmButtonColor: '#3b82f6'
    }).then((res) => {
      if (res.isConfirmed) openLoginModal();
    });
    return;
  }

  if (STATE.currentUser.empId === item.empId) {
    Swal.fire({ icon: 'info', text: 'คุณคือเจ้าของสินค้านี้' });
    return;
  }

  closeProductDetailModal();
  openChatModal(item, item.empId, item.sellerName || item.empId);
}

function openChatModal(product, partnerId, partnerName) {
  STATE.currentChatProduct = product;
  STATE.currentChatPartnerId = partnerId;
  STATE.currentChatPartnerName = partnerName;

  document.getElementById('chatProductThumb').src = product.imageUrl || 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?w=100&auto=format&fit=crop&q=60';
  document.getElementById('chatProductTitle').textContent = product.title;
  document.getElementById('chatPartnerName').textContent = partnerName;
  document.getElementById('chatInput').value = '';

  document.getElementById('chatModal').classList.remove('hidden');
  document.getElementById('chatModal').classList.add('flex');

  loadChatMessages();

  if (STATE.chatPollingInterval) clearInterval(STATE.chatPollingInterval);
  STATE.chatPollingInterval = setInterval(loadChatMessages, CONFIG.CHAT_POLL_INTERVAL || 4000);
}

function closeChatModal() {
  document.getElementById('chatModal').classList.add('hidden');
  document.getElementById('chatModal').classList.remove('flex');
  if (STATE.chatPollingInterval) {
    clearInterval(STATE.chatPollingInterval);
    STATE.chatPollingInterval = null;
  }
}

async function loadChatMessages() {
  if (!STATE.currentChatProduct || !STATE.currentUser) return;

  const messagesArea = document.getElementById('chatMessagesArea');
  const productId = STATE.currentChatProduct.productId;
  const myId = STATE.currentUser.empId;
  const partnerId = STATE.currentChatPartnerId;

  try {
    let messages = [];

    if (!STATE.isApiConfigured) {
      messages = MOCK_MESSAGES.filter(m => 
        m.productId === productId &&
        ((m.senderEmpID === myId && m.receiverEmpID === partnerId) || (m.senderEmpID === partnerId && m.receiverEmpID === myId))
      );
    } else {
      const response = await fetch(`${CONFIG.API_URL}?action=getMessages&productId=${encodeURIComponent(productId)}&buyerId=${encodeURIComponent(myId)}&sellerId=${encodeURIComponent(partnerId)}&_t=${Date.now()}`);
      const result = await response.json();
      if (result.success && Array.isArray(result.messages)) {
        messages = result.messages;
      }
    }

    if (messages.length === 0) {
      messagesArea.innerHTML = `
        <div class="text-center py-12 text-slate-400 text-xs">
          <i class="ph ph-chat-circle-dots text-3xl mb-2 block"></i>
          ยังไม่มีบทสนทนา พิมพ์ทักทายหรือต่อรองราคาสินค้าได้เลยครับ
        </div>
      `;
      return;
    }

    messagesArea.innerHTML = messages.map(msg => {
      const isMe = msg.senderEmpID === myId;
      return `
        <div class="flex flex-col ${isMe ? 'items-end' : 'items-start'}">
          <div class="max-w-[78%] px-4 py-2.5 rounded-2xl text-xs sm:text-sm ${
            isMe ? 'chat-bubble-me' : 'chat-bubble-other border border-slate-200'
          }">
            ${escapeHtml(msg.message)}
          </div>
          <span class="text-[10px] text-slate-400 mt-1 px-1">${msg.timestamp || ''}</span>
        </div>
      `;
    }).join('');

    messagesArea.scrollTop = messagesArea.scrollHeight;

  } catch (err) {
    console.error('Error fetching chat messages:', err);
  }
}

async function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const messageText = input.value.trim();
  if (!messageText || !STATE.currentUser || !STATE.currentChatProduct) return;

  input.value = '';
  const myId = STATE.currentUser.empId;
  const partnerId = STATE.currentChatPartnerId;
  const productId = STATE.currentChatProduct.productId;

  const now = new Date();
  const timeFormatted = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const messagesArea = document.getElementById('chatMessagesArea');
  const tempMsgElement = document.createElement('div');
  tempMsgElement.className = 'flex flex-col items-end';
  tempMsgElement.innerHTML = `
    <div class="max-w-[78%] px-4 py-2.5 rounded-2xl text-xs sm:text-sm chat-bubble-me">
      ${escapeHtml(messageText)}
    </div>
    <span class="text-[10px] text-slate-400 mt-1 px-1">ส่งแล้ว ${timeFormatted}</span>
  `;
  messagesArea.appendChild(tempMsgElement);
  messagesArea.scrollTop = messagesArea.scrollHeight;

  try {
    if (!STATE.isApiConfigured) {
      MOCK_MESSAGES.push({
        messageId: 'MSG-' + Date.now(),
        productId: productId,
        senderEmpID: myId,
        receiverEmpID: partnerId,
        message: messageText,
        timestamp: timeFormatted
      });
      return;
    }

    await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'sendMessage',
        productId: productId,
        senderEmpID: myId,
        receiverEmpID: partnerId,
        message: messageText
      })
    });
  } catch (err) {
    console.error('Failed to send chat message:', err);
  }
}

/**
 * =========================================================================
 * 7. MY LISTINGS (จัดการสินค้าของฉัน)
 * =========================================================================
 */
function openMyListingsModal() {
  if (!STATE.currentUser) {
    openLoginModal();
    return;
  }

  const container = document.getElementById('myListingsContent');
  const myListings = STATE.allProducts.filter(p => p.empId === STATE.currentUser.empId && p.status !== 'DELETED' && p.status !== 'DELETED_BY_ADMIN');

  if (myListings.length === 0) {
    container.innerHTML = `
      <div class="text-center py-12">
        <i class="ph ph-bag text-4xl text-slate-300 mb-2"></i>
        <p class="text-sm font-semibold text-slate-600">คุณยังไม่ได้ลงประกาศขายสินค้าใดๆ</p>
        <button onclick="closeMyListingsModal(); openSellModal();" class="mt-3 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold shadow-sm">
          + ลงขายสินค้าชิ้นแรก
        </button>
      </div>
    `;
  } else {
    container.innerHTML = myListings.map(item => `
      <div class="flex items-center justify-between gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
        <img src="${item.imageUrl || 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?w=100'}" class="w-14 h-14 rounded-xl object-cover bg-white" />
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-blue-600 font-mono">฿${Number(item.price).toLocaleString()}</span>
            <span class="text-[10px] px-2 py-0.5 rounded-full font-bold ${item.status === 'SOLD' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'}">
              ${item.status === 'SOLD' ? 'ขายแล้ว' : 'กำลังขาย'}
            </span>
          </div>
          <h4 class="text-xs sm:text-sm font-bold text-slate-800 truncate">${escapeHtml(item.title)}</h4>
          <p class="text-[11px] text-slate-400">${item.category} • ${item.createdAt || ''}</p>
        </div>
        <div class="flex flex-col gap-1.5">
          <button
            onclick="updateItemStatus('${item.productId}', '${item.status === 'SOLD' ? 'ACTIVE' : 'SOLD'}')"
            class="px-2.5 py-1 text-[11px] font-semibold rounded-lg ${item.status === 'SOLD' ? 'bg-slate-200 text-slate-700' : 'bg-emerald-600 text-white'}"
          >
            ${item.status === 'SOLD' ? 'เปิดขายใหม่' : 'ทำเครื่องหมายว่าขายแล้ว'}
          </button>
          <button
            onclick="deleteItem('${item.productId}')"
            class="px-2.5 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 rounded-lg transition"
          >
            ลบประกาศ
          </button>
        </div>
      </div>
    `).join('');
  }

  document.getElementById('myListingsModal').classList.remove('hidden');
  document.getElementById('myListingsModal').classList.add('flex');
}

function closeMyListingsModal() {
  document.getElementById('myListingsModal').classList.add('hidden');
  document.getElementById('myListingsModal').classList.remove('flex');
}

async function updateItemStatus(productId, newStatus) {
  const item = STATE.allProducts.find(p => p.productId === productId);
  if (!item || !STATE.currentUser) return;

  item.status = newStatus;
  applyFilters();
  closeProductDetailModal();
  openMyListingsModal();

  if (STATE.isApiConfigured) {
    try {
      await fetch(CONFIG.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'updateProductStatus',
          productId: productId,
          empId: STATE.currentUser.empId,
          status: newStatus
        })
      });
    } catch (e) {
      console.error(e);
    }
  }
}

async function deleteItem(productId) {
  const confirm = await Swal.fire({
    title: 'ยืนยันการลบประกาศ?',
    text: 'เมื่อลบแล้วสินค้าจะไม่ปรากฏในระบบอีก',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    confirmButtonText: 'ลบประกาศ',
    cancelButtonText: 'ยกเลิก'
  });

  if (!confirm.isConfirmed || !STATE.currentUser) return;

  const itemIndex = STATE.allProducts.findIndex(p => p.productId === productId);
  if (itemIndex > -1) {
    STATE.allProducts[itemIndex].status = 'DELETED';
    applyFilters();
    closeProductDetailModal();
    openMyListingsModal();
  }

  if (STATE.isApiConfigured) {
    try {
      await fetch(CONFIG.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'deleteProduct',
          productId: productId,
          empId: STATE.currentUser.empId
        })
      });
    } catch (e) {
      console.error(e);
    }
  }

  Swal.fire({ icon: 'success', title: 'ลบสินค้าเรียบร้อย', timer: 1500, showConfirmButton: false });
}

/**
 * =========================================================================
 * 8. ADMIN DASHBOARD & MODERATION (ผู้ดูแลระบบ)
 * =========================================================================
 */
function openAdminDashboard() {
  if (!checkIsAdmin(STATE.currentUser)) {
    Swal.fire({ icon: 'error', title: 'ปฏิเสธการเข้าถึง', text: 'คุณไม่มีสิทธิ์เข้าถึงหน้านี้' });
    return;
  }

  document.getElementById('adminDashboardModal').classList.remove('hidden');
  document.getElementById('adminDashboardModal').classList.add('flex');

  loadAdminDashboardData();
}

function closeAdminDashboardModal() {
  document.getElementById('adminDashboardModal').classList.add('hidden');
  document.getElementById('adminDashboardModal').classList.remove('flex');
}

function switchAdminTab(tabName) {
  STATE.adminActiveTab = tabName;

  const btnProd = document.getElementById('adminTabBtnProducts');
  const btnLogs = document.getElementById('adminTabBtnLogs');
  const tabProd = document.getElementById('adminTabProducts');
  const tabLogs = document.getElementById('adminTabLogs');

  if (tabName === 'products') {
    btnProd.className = 'px-4 py-2 text-xs font-bold rounded-xl transition bg-blue-600 text-white shadow-sm flex items-center gap-1.5';
    btnLogs.className = 'px-4 py-2 text-xs font-medium rounded-xl transition bg-slate-200 text-slate-700 hover:bg-slate-300 flex items-center gap-1.5';
    tabProd.classList.remove('hidden');
    tabLogs.classList.add('hidden');
  } else {
    btnLogs.className = 'px-4 py-2 text-xs font-bold rounded-xl transition bg-blue-600 text-white shadow-sm flex items-center gap-1.5';
    btnProd.className = 'px-4 py-2 text-xs font-medium rounded-xl transition bg-slate-200 text-slate-700 hover:bg-slate-300 flex items-center gap-1.5';
    tabLogs.classList.remove('hidden');
    tabProd.classList.add('hidden');
  }
}

async function loadAdminDashboardData(forceRefresh = false) {
  try {
    if (!STATE.isApiConfigured) {
      // Demo Mode Data
      const activeCount = STATE.allProducts.filter(p => p.status === 'ACTIVE').length;
      const soldCount = STATE.allProducts.filter(p => p.status === 'SOLD').length;
      const deletedCount = STATE.allProducts.filter(p => p.status === 'DELETED' || p.status === 'DELETED_BY_ADMIN').length;

      STATE.adminData = {
        stats: {
          totalEmployees: 12,
          totalProducts: STATE.allProducts.length,
          activeProducts: activeCount,
          soldProducts: soldCount,
          deletedProducts: deletedCount,
          totalMessages: MOCK_MESSAGES.length,
          totalLogs: MOCK_LOGS.length
        },
        products: [...STATE.allProducts],
        logs: [...MOCK_LOGS]
      };
    } else {
      const response = await fetch(`${CONFIG.API_URL}?action=getAdminDashboard&adminEmpId=${encodeURIComponent(STATE.currentUser.empId)}&_t=${Date.now()}`);
      const result = await response.json();
      if (result.success) {
        STATE.adminData = {
          stats: result.stats || {},
          products: result.products || [],
          logs: result.logs || []
        };
      }
    }

    renderAdminDashboard();
  } catch (err) {
    console.error('Error fetching admin data:', err);
  }
}

function renderAdminDashboard() {
  const stats = STATE.adminData.stats;
  document.getElementById('adminStatActiveProd').textContent = stats.activeProducts || 0;
  document.getElementById('adminStatSoldProd').textContent = stats.soldProducts || 0;
  document.getElementById('adminStatDeletedProd').textContent = stats.deletedProducts || 0;
  document.getElementById('adminStatEmployees').textContent = `${stats.totalEmployees || 0} คน`;

  renderAdminProductTable();
  renderAdminLogsTable();
}

function setAdminProductFilter(status) {
  STATE.adminProductFilterStatus = status;

  document.querySelectorAll('.admin-prod-filter').forEach(btn => {
    btn.className = 'admin-prod-filter px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs';
  });
  event.target.className = 'admin-prod-filter px-3 py-1.5 rounded-lg bg-slate-800 text-white font-medium text-xs';

  renderAdminProductTable();
}

function filterAdminProducts() {
  STATE.adminSearchQuery = (document.getElementById('adminProductSearch').value || '').trim().toLowerCase();
  renderAdminProductTable();
}

function renderAdminProductTable() {
  const tbody = document.getElementById('adminProductTableBody');
  const products = STATE.adminData.products || [];

  const filtered = products.filter(item => {
    const matchStatus = STATE.adminProductFilterStatus === 'ALL' ||
      (STATE.adminProductFilterStatus === 'DELETED' && (item.status === 'DELETED' || item.status === 'DELETED_BY_ADMIN')) ||
      item.status === STATE.adminProductFilterStatus;

    const matchQuery = !STATE.adminSearchQuery ||
      (item.title && item.title.toLowerCase().includes(STATE.adminSearchQuery)) ||
      (item.empId && item.empId.toLowerCase().includes(STATE.adminSearchQuery)) ||
      (item.productId && item.productId.toLowerCase().includes(STATE.adminSearchQuery));

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
              <div class="font-bold text-slate-800 truncate max-w-[200px]">${escapeHtml(item.title)}</div>
              <div class="text-[10px] text-slate-400 font-mono">${item.productId} • ${item.category}</div>
            </div>
          </div>
        </td>
        <td class="p-3 font-mono font-bold text-blue-600">
          ฿${Number(item.price).toLocaleString()}
        </td>
        <td class="p-3">
          <span class="font-mono font-semibold text-slate-700">${item.empId}</span>
          <div class="text-[10px] text-slate-400">${item.phone || '-'}</div>
        </td>
        <td class="p-3 text-slate-500 text-[11px]">
          ${item.createdAt || '-'}
        </td>
        <td class="p-3">
          ${statusBadge}
        </td>
        <td class="p-3 text-right">
          ${!isDeleted ? `
            <button
              onclick="handleAdminDeletePost('${item.productId}', '${escapeHtml(item.title)}', '${item.empId}')"
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

function renderAdminLogsTable() {
  const tbody = document.getElementById('adminLogsTableBody');
  const logs = STATE.adminData.logs || [];

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
    let actionBadge = `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 font-mono">${log.action}</span>`;
    if (log.action === 'LOGIN') {
      actionBadge = `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-700 font-mono">LOGIN</span>`;
    } else if (log.action === 'POST_PRODUCT') {
      actionBadge = `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-700 font-mono">POST</span>`;
    } else if (log.action.includes('DELETE')) {
      actionBadge = `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-700 font-mono">${log.action}</span>`;
    } else if (log.action === 'SEND_MESSAGE') {
      actionBadge = `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 text-purple-700 font-mono">MESSAGE</span>`;
    }

    return `
      <tr class="hover:bg-slate-50 transition">
        <td class="p-3 text-slate-500 font-mono text-[11px] whitespace-nowrap">${log.timestamp || '-'}</td>
        <td class="p-3 font-mono font-bold text-slate-800">${log.empId}</td>
        <td class="p-3">${actionBadge}</td>
        <td class="p-3 text-slate-700 text-xs">${escapeHtml(log.details)}</td>
      </tr>
    `;
  }).join('');
}

async function handleAdminDeletePost(productId, productTitle, sellerEmpId) {
  const { value: reason, isConfirmed } = await Swal.fire({
    title: 'ลบโพสต์ที่ไม่เหมาะสม (Admin)',
    html: `
      <p class="text-xs text-slate-600 mb-3 text-left">
        ต้องการลบสินค้า: <b>${escapeHtml(productTitle)}</b><br/>
        ของผู้ลงประกาศ: <b>${sellerEmpId}</b>
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

  // Local state update
  const prodIndex = STATE.allProducts.findIndex(p => p.productId === productId);
  if (prodIndex > -1) {
    STATE.allProducts[prodIndex].status = 'DELETED_BY_ADMIN';
  }

  // Update admin list
  const adminProdIndex = STATE.adminData.products.findIndex(p => p.productId === productId);
  if (adminProdIndex > -1) {
    STATE.adminData.products[adminProdIndex].status = 'DELETED_BY_ADMIN';
  }

  // Add Log entry
  const newLog = {
    logId: 'LOG-' + Date.now(),
    timestamp: 'เมื่อสักครู่',
    empId: STATE.currentUser.empId,
    action: 'ADMIN_DELETE_PRODUCT',
    details: `แอดมินลบโพสต์ [${productId}] "${productTitle}" ของพนักงาน ${sellerEmpId} (เหตุผล: ${reason})`
  };
  STATE.adminData.logs.unshift(newLog);
  MOCK_LOGS.unshift(newLog);

  applyFilters();
  closeProductDetailModal();
  renderAdminDashboard();

  if (STATE.isApiConfigured) {
    try {
      await fetch(CONFIG.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'adminDeleteProduct',
          productId: productId,
          adminEmpId: STATE.currentUser.empId,
          reason: reason
        })
      });
    } catch (e) {
      console.error(e);
    }
  }

  Swal.fire({
    icon: 'success',
    title: 'ลบโพสต์เรียบร้อย',
    text: 'โพสต์ถูกนำออกจากระบบและบันทึกประวัติลง Logs แล้ว',
    timer: 2000,
    showConfirmButton: false
  });
}

/**
 * =========================================================================
 * UTILITY HELPERS
 * =========================================================================
 */
function escapeHtml(string) {
  if (!string) return '';
  return String(string)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
