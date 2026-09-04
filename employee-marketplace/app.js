const PDPA_CONSENT_KEY = 'emp_marketplace_pdpa_consent_v1';

const STATE = {
  currentUser: null,
  allProducts: [],
  filteredProducts: [],
  selectedCategory: 'all',
  searchQuery: '',
  selectedImageBase64: '',
  selectedImageName: '',
  currentDetailProduct: null,
  currentChatProduct: null,
  currentChatPartnerId: '',
  currentChatPartnerName: '',
  chatPollingInterval: null,
  notificationPollingInterval: null,
  isApiConfigured: false,

  myConversations: [],
  totalUnreadCount: 0,
  lastKnownUnreadCount: 0,
  hasShownInitialUnreadAlert: false,
  sessionExpiredNotified: false,

  // [ใหม่] ระบบจองสินค้า
  myReservations: { asBuyer: [], asSeller: [] },
  reservationTargetProduct: null
};

// คืนค่า session token ของผู้ใช้ปัจจุบัน (ใช้แนบไปกับทุก action ที่ต้องยืนยันตัวตน)
function getSessionToken() {
  return (STATE.currentUser && STATE.currentUser.sessionToken) || '';
}

// เรียกเมื่อเซิร์ฟเวอร์ตอบกลับว่า session หมดอายุ/ไม่ถูกต้อง (sessionExpired: true)
// คืนค่า true ถ้าเป็นกรณี session หมดอายุ (ผู้เรียกควรหยุดทำงานต่อ)
function handleAuthExpired(result) {
  if (!result || !result.sessionExpired) return false;

  if (!STATE.sessionExpiredNotified) {
    STATE.sessionExpiredNotified = true;
    STATE.currentUser = null;
    localStorage.removeItem('emp_marketplace_user');

    if (STATE.chatPollingInterval) {
      clearInterval(STATE.chatPollingInterval);
      STATE.chatPollingInterval = null;
    }
    if (STATE.notificationPollingInterval) {
      clearInterval(STATE.notificationPollingInterval);
      STATE.notificationPollingInterval = null;
    }

    updateUserNav();
    updateUnreadBadgeUI();
    updateReservationBadge();
    closeChatModal();
    closeInboxModal();
    closeReservationModal();
    closeMyReservationsModal();

    Swal.fire({
      icon: 'warning',
      title: 'เซสชันหมดอายุ',
      text: 'กรุณาเข้าสู่ระบบใหม่อีกครั้งเพื่อดำเนินการต่อ',
      confirmButtonColor: '#3b82f6'
    }).then(() => openConsentOrLogin());
  }
  return true;
}

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
    createdAt: '31/08/2026 09:30',
    quantity: null,
    reservedQty: 0,
    remainingQty: null
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
    createdAt: '31/08/2026 11:15',
    quantity: null,
    reservedQty: 0,
    remainingQty: null
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
    createdAt: '31/08/2026 13:00',
    quantity: 10,
    reservedQty: 3,
    remainingQty: 7
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
    createdAt: '31/08/2026 14:20',
    quantity: null,
    reservedQty: 0,
    remainingQty: null
  }
];

let MOCK_MESSAGES = [
  {
    messageId: 'MSG-1',
    productId: 'PROD-001',
    senderEmpID: 'EMP002',
    receiverEmpID: 'EMP001',
    message: 'สวัสดีครับ หูฟังยังอยู่ไหมครับ ลดได้อีกนิดไหมครับ',
    timestamp: '31/08/2026 10:00',
    isRead: false
  },
  {
    messageId: 'MSG-2',
    productId: 'PROD-001',
    senderEmpID: 'EMP001',
    receiverEmpID: 'EMP002',
    message: 'ยังอยู่ครับ ถ้ามารับเองที่ตึก A ลดให้เหลือ 4,500 บาทได้ครับ',
    timestamp: '31/08/2026 10:05',
    isRead: true
  }
];

let MOCK_LOGS = [
  { logId: 'LOG-1', timestamp: '31/08/2026 09:00', empId: 'EMP001', action: 'LOGIN', details: 'เข้าสู่ระบบสำเร็จ (สมชาย ใจดี, IT) [ADMIN]' },
  { logId: 'LOG-2', timestamp: '31/08/2026 09:30', empId: 'EMP001', action: 'POST_PRODUCT', details: 'ลงขายสินค้า [PROD-001] "หูฟังไร้สาย Sony WH-1000XM4"' },
  { logId: 'LOG-3', timestamp: '31/08/2026 10:00', empId: 'EMP002', action: 'LOGIN', details: 'เข้าสู่ระบบสำเร็จ (สมศรี มีสุข, HR)' },
  { logId: 'LOG-4', timestamp: '31/08/2026 10:00', empId: 'EMP002', action: 'SEND_MESSAGE', details: 'ส่งข้อความถึง EMP001 (สินค้า PROD-001)' }
];

// [ใหม่] ตัวอย่างข้อมูลจองสินค้าสำหรับ Demo Mode
let MOCK_RESERVATIONS = [];

document.addEventListener('DOMContentLoaded', () => {
  STATE.isApiConfigured = Boolean(CONFIG.API_URL && CONFIG.API_URL.trim() !== '');

  checkStoredAuth();

  renderCategories();

  loadProducts();
});

function getFoodCategoryName() {
  const foodCat = CONFIG.CATEGORIES.find(c => c.id === 'food');
  return foodCat ? foodCat.name : 'อาหาร & ขนม';
}

function checkStoredAuth() {
  const savedUser = localStorage.getItem('emp_marketplace_user');
  if (savedUser) {
    try {
      STATE.currentUser = JSON.parse(savedUser);
      startNotificationPolling();
    } catch (e) {
      STATE.currentUser = null;
    }
  }
  updateUserNav();
}

function checkIsAdmin(user) {
  if (!user || !user.empId) return false;
  if (STATE.isApiConfigured) {
    return user.isAdmin === true;
  }

  const adminList = Array.isArray(CONFIG.ADMIN_EMP_IDS) ? CONFIG.ADMIN_EMP_IDS : ['EMP001', 'ADMIN', 'ADMIN001', 'IT001'];
  return user.isAdmin === true || adminList.includes(user.empId.toUpperCase());
}

function updateUserNav() {
  const container = document.getElementById('userNavContainer');
  const welcomeBanner = document.getElementById('welcomeBanner');
  const notificationBellBtn = document.getElementById('notificationBellBtn');

  if (STATE.currentUser) {
    const initials = STATE.currentUser.name ? STATE.currentUser.name.substring(0, 2) : 'EM';
    const isAdminUser = checkIsAdmin(STATE.currentUser);

    if (notificationBellBtn) notificationBellBtn.classList.remove('hidden');

    container.innerHTML = `
      <div class="relative group">
        <button class="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 transition border border-slate-200">
          <div class="w-8 h-8 rounded-lg ${isAdminUser ? 'bg-indigo-700' : 'bg-blue-600'} text-white flex items-center justify-center font-bold text-xs shadow-sm">
            ${escapeHtml(initials)}
          </div>
          <div class="hidden lg:block text-left pr-1">
            <div class="flex items-center gap-1.5">
              <span class="text-xs font-bold text-slate-800 leading-tight">${escapeHtml(STATE.currentUser.name)}</span>
              ${isAdminUser ? '<span class="text-[9px] bg-indigo-100 text-indigo-700 px-1.5 py-0.2 rounded font-bold">Admin</span>' : ''}
            </div>
            <div class="text-[10px] text-slate-400 font-mono">${escapeHtml(STATE.currentUser.empId)}</div>
          </div>
          <i class="ph ph-caret-down text-xs text-slate-400"></i>
        </button>

        <!-- Dropdown Menu -->
        <div class="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 hidden group-hover:block hover:block z-50 fade-in">
          <div class="px-4 py-2 border-b border-slate-100">
            <div class="flex items-center justify-between">
              <p class="text-xs font-bold text-slate-800">${escapeHtml(STATE.currentUser.name)}</p>
              ${isAdminUser ? '<span class="text-[9px] bg-indigo-600 text-white px-1.5 py-0.5 rounded font-mono">ADMIN</span>' : ''}
            </div>
            <p class="text-[11px] text-slate-500">${escapeHtml(STATE.currentUser.department || '')} ${STATE.currentUser.plant ? '• ' + escapeHtml(STATE.currentUser.plant) : ''}</p>
            <p class="text-[10px] text-blue-600 font-mono mt-0.5">EmpID: ${escapeHtml(STATE.currentUser.empId)}</p>
          </div>

          <button onclick="openInboxModal()" class="w-full text-left px-4 py-2 text-xs font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-600 flex items-center justify-between">
            <span class="flex items-center gap-2">
              <i class="ph ph-chats-teardrop text-base"></i> ข้อความแชททั้งหมด
            </span>
            <span id="dropdownUnreadBadge" class="hidden bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-mono">0</span>
          </button>

          <button onclick="openMyReservationsModal()" class="w-full text-left px-4 py-2 text-xs font-medium text-slate-700 hover:bg-amber-50 hover:text-amber-600 flex items-center justify-between">
            <span class="flex items-center gap-2">
              <i class="ph ph-bookmark-simple text-base"></i> การจองสินค้า
            </span>
            <span id="dropdownReservationBadge" class="hidden bg-amber-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-mono">0</span>
          </button>

          <button onclick="openMyListingsModal()" class="w-full text-left px-4 py-2 text-xs font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2">
            <i class="ph ph-archive-box text-base"></i> สินค้าของฉัน
          </button>

          ${isAdminUser ? `
            <div class="border-t border-slate-100 my-1"></div>
            <a href="admin.html" target="_blank" class="w-full text-left px-4 py-2 text-xs font-bold text-indigo-600 hover:bg-indigo-50 flex items-center gap-2">
              <i class="ph-bold ph-shield-check text-base"></i> แผงควบคุมผู้ดูแลระบบ (Admin)
              <i class="ph ph-arrow-square-out text-xs ml-auto"></i>
            </a>
          ` : ''}

          <div class="border-t border-slate-100 my-1"></div>
          <button onclick="handleLogout()" class="w-full text-left px-4 py-2 text-xs font-medium text-red-600 hover:bg-red-50 flex items-center gap-2">
            <i class="ph ph-sign-out text-base"></i> ออกจากระบบ
          </button>
        </div>
      </div>
    `;

    if (welcomeBanner) {
      welcomeBanner.classList.remove('hidden');
      document.getElementById('bannerUserName').textContent = `สวัสดีคุณ ${STATE.currentUser.name}`;
      document.getElementById('bannerUserDetail').textContent = `รหัส ${STATE.currentUser.empId} • ${STATE.currentUser.department || 'พนักงาน'} ${STATE.currentUser.plant ? '• ' + STATE.currentUser.plant : ''} ${isAdminUser ? '• (ผู้ดูแลระบบ)' : ''}`;
    }

    updateReservationBadge();
  } else {
    container.innerHTML = `
      <button
        onclick="openConsentOrLogin()"
        class="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-medium text-sm rounded-xl transition"
      >
        <i class="ph-bold ph-sign-in text-base"></i>
        <span>เข้าสู่ระบบ</span>
      </button>
    `;

    if (welcomeBanner) welcomeBanner.classList.add('hidden');
    if (notificationBellBtn) notificationBellBtn.classList.add('hidden');
  }
}

// ========================================================================
// [ใหม่] Consent / PDPA - นโยบายความเป็นส่วนตัว
// ========================================================================

// เรียกจากปุ่ม "เข้าสู่ระบบ" ทุกจุดในระบบ: ถ้ายังไม่เคยกดยอมรับ PDPA จะแสดง Consent Modal ก่อนเสมอ
function openConsentOrLogin() {
  const accepted = localStorage.getItem(PDPA_CONSENT_KEY) === 'true';
  if (accepted) {
    openLoginModal();
  } else {
    openConsentModal();
  }
}

function openConsentModal() {
  document.getElementById('consentModal').classList.remove('hidden');
  document.getElementById('consentModal').classList.add('flex');
  const alreadyAccepted = localStorage.getItem(PDPA_CONSENT_KEY) === 'true';
  document.getElementById('consentCheckbox').checked = alreadyAccepted;
  document.getElementById('consentAcceptBtn').disabled = !alreadyAccepted;
}

function closeConsentModal() {
  document.getElementById('consentModal').classList.add('hidden');
  document.getElementById('consentModal').classList.remove('flex');
}

function toggleConsentAcceptBtn() {
  const checked = document.getElementById('consentCheckbox').checked;
  document.getElementById('consentAcceptBtn').disabled = !checked;
}

function acceptConsentAndContinue() {
  localStorage.setItem(PDPA_CONSENT_KEY, 'true');
  closeConsentModal();
  openLoginModal();
}

// ========================================================================
// [ใหม่] กติกาการซื้อ-ขายสินค้า
// ========================================================================

function openRulesModal() {
  document.getElementById('rulesModal').classList.remove('hidden');
  document.getElementById('rulesModal').classList.add('flex');
}

function closeRulesModal() {
  document.getElementById('rulesModal').classList.add('hidden');
  document.getElementById('rulesModal').classList.remove('flex');
}

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

  const consentAccepted = localStorage.getItem(PDPA_CONSENT_KEY) === 'true';

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
      localStorage.setItem(PDPA_CONSENT_KEY, 'true');
      closeLoginModal();
      updateUserNav();
      startNotificationPolling();
      STATE.sessionExpiredNotified = false;
      Swal.fire({
        icon: 'success',
        title: 'เข้าสู่ระบบสำเร็จ (Demo Mode)',
        text: `ยินดีต้อนรับคุณ ${STATE.currentUser.name} ${isAdminUser ? '👑 (Admin)' : ''}`,
        timer: 2000,
        showConfirmButton: false
      });
      return;
    }

    // Real API Call
    const response = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'login',
        empId: empId,
        pin: pin,
        consentAccepted: consentAccepted // [ใหม่] ส่งสถานะการยอมรับ PDPA ไปบันทึกลง Logs
      })
    });

    const result = await response.json();

    if (result.success && result.user) {
      STATE.currentUser = result.user;
      localStorage.setItem('emp_marketplace_user', JSON.stringify(STATE.currentUser));
      localStorage.setItem(PDPA_CONSENT_KEY, 'true');
      closeLoginModal();
      updateUserNav();
      startNotificationPolling();
      STATE.sessionExpiredNotified = false;
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
      STATE.currentUser = null;
      localStorage.removeItem('emp_marketplace_user');
      localStorage.removeItem('emp_marketplace_chat_cache');
      sessionStorage.clear();
      if (STATE.chatPollingInterval) {
        clearInterval(STATE.chatPollingInterval);
        STATE.chatPollingInterval = null;
      }
      if (STATE.notificationPollingInterval) {
        clearInterval(STATE.notificationPollingInterval);
        STATE.notificationPollingInterval = null;
      }

      STATE.currentChatProduct = null;
      STATE.currentChatPartnerId = '';
      STATE.currentChatPartnerName = '';
      STATE.myConversations = [];
      STATE.totalUnreadCount = 0;
      STATE.lastKnownUnreadCount = 0;
      STATE.myReservations = { asBuyer: [], asSeller: [] };
      STATE.reservationTargetProduct = null;

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

      removeSelectedImage();
      closeChatModal();
      closeInboxModal();
      closeProductDetailModal();
      closeSellModal();
      closeMyListingsModal();
      closeReservationModal();
      closeMyReservationsModal();
      updateUserNav();
      updateUnreadBadgeUI();
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

function playNotificationChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.15);
    gain2.gain.setValueAtTime(0.2, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.5);
  } catch (e) {
    console.log('Audio chime not allowed yet by user interaction.');
  }
}

function triggerAlarmEffect() {
  const bellIcon = document.getElementById('bellIcon');
  if (bellIcon) {
    bellIcon.classList.remove('ph-bell');
    bellIcon.classList.add('ph-bell-ringing', 'bell-ringing', 'text-rose-600');
    setTimeout(() => {
      bellIcon.classList.remove('bell-ringing', 'text-rose-600');
    }, 4000);
  }
}

function showNewMessageFloatAlert(conv) {
  let el = document.getElementById('newMessageFloatAlert');
  if (!el) {
    el = document.createElement('div');
    el.id = 'newMessageFloatAlert';
    el.className = 'fixed bottom-5 right-5 z-[60] max-w-xs';
    document.body.appendChild(el);
  }

  el.innerHTML = `
    <button
      onclick="handleFloatAlertClick('${conv.key}')"
      class="w-full flex items-center gap-3 bg-slate-900 text-white pl-3 pr-4 py-3 rounded-2xl shadow-2xl shadow-black/30 hover:bg-slate-800 active:scale-[0.98] transition scale-in border border-white/10"
    >
      <span class="relative flex-shrink-0">
        <i class="ph-fill ph-bell-ringing text-2xl text-amber-400"></i>
        <span class="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping"></span>
        <span class="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full"></span>
      </span>
      <span class="text-left min-w-0">
        <span class="block text-[11px] font-bold text-amber-300">มีข้อความใหม่จาก ${escapeHtml(conv.partnerName)}</span>
        <span class="block text-xs text-slate-200 truncate max-w-[190px]">${escapeHtml(conv.lastMessage)}</span>
      </span>
      <i class="ph-bold ph-arrow-right ml-auto flex-shrink-0"></i>
    </button>
  `;
  el.classList.remove('hidden');
  if (el._hideTimeout) clearTimeout(el._hideTimeout);
  el._hideTimeout = setTimeout(() => hideNewMessageFloatAlert(), 8000);
}

function hideNewMessageFloatAlert() {
  const el = document.getElementById('newMessageFloatAlert');
  if (el) el.classList.add('hidden');
}

function handleFloatAlertClick(key) {
  hideNewMessageFloatAlert();
  openChatModalFromInboxByKey(key);
}

function handleBellClick() {
  if (!STATE.currentUser) {
    openConsentOrLogin();
    return;
  }

  hideNewMessageFloatAlert();

  const unreadConvs = (STATE.myConversations || []).filter(c => c.unreadCount > 0);
  if (unreadConvs.length === 1) {
    openChatModalFromInbox(unreadConvs[0]);
  } else {
    openInboxModal();
  }
}

function updateUnreadBadgeUI() {
  const badge = document.getElementById('unreadBadge');
  const dropdownBadge = document.getElementById('dropdownUnreadBadge');
  const count = STATE.totalUnreadCount || 0;

  if (badge) {
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  if (dropdownBadge) {
    if (count > 0) {
      dropdownBadge.textContent = count;
      dropdownBadge.classList.remove('hidden');
    } else {
      dropdownBadge.classList.add('hidden');
    }
  }
}

function startNotificationPolling() {
  if (STATE.notificationPollingInterval) clearInterval(STATE.notificationPollingInterval);
  loadMyChats(false);
  loadMyReservations(false); // [ใหม่]
  STATE.notificationPollingInterval = setInterval(() => {
    if (STATE.currentUser) {
      loadMyChats(false);
      loadMyReservations(false); // [ใหม่]
    }
  }, 4000);
}

async function loadMyChats(showLoader = false) {
  if (!STATE.currentUser) return;

  try {
    let conversations = [];
    let totalUnread = 0;

    if (!STATE.isApiConfigured) {
      // Demo Mode
      const myId = STATE.currentUser.empId;
      const convMap = {};

      MOCK_MESSAGES.forEach(m => {
        if (m.senderEmpID === myId || m.receiverEmpID === myId) {
          const partnerId = m.senderEmpID === myId ? m.receiverEmpID : m.senderEmpID;
          const key = `${m.productId}_${partnerId}`;
          const prod = MOCK_PRODUCTS.find(p => p.productId === m.productId) || { title: 'สินค้า', price: 0, imageUrl: '' };
          const isSeller = prod.empId === myId;

          if (!convMap[key]) {
            convMap[key] = {
              key: key,
              productId: m.productId,
              productTitle: prod.title,
              productImage: prod.imageUrl,
              productPrice: prod.price,
              isSeller: isSeller,
              partnerId: partnerId,
              partnerName: partnerId === 'EMP001' ? 'สมชาย ใจดี' : (partnerId === 'EMP002' ? 'สมศรี มีสุข' : `พนักงาน ${partnerId}`),
              partnerDept: partnerId === 'EMP001' ? 'IT' : 'HR',
              lastMessage: m.message,
              lastSenderId: m.senderEmpID,
              timestamp: m.timestamp,
              unreadCount: (m.receiverEmpID === myId && !m.isRead) ? 1 : 0
            };
          } else {
            convMap[key].lastMessage = m.message;
            convMap[key].lastSenderId = m.senderEmpID;
            convMap[key].timestamp = m.timestamp;
            if (m.receiverEmpID === myId && !m.isRead) convMap[key].unreadCount++;
          }

          if (m.receiverEmpID === myId && !m.isRead) totalUnread++;
        }
      });

      conversations = Object.values(convMap);
    } else {
      const response = await fetch(`${CONFIG.API_URL}?action=getMyChats&empId=${encodeURIComponent(STATE.currentUser.empId)}&token=${encodeURIComponent(getSessionToken())}&_t=${Date.now()}`);
      const result = await response.json();
      if (handleAuthExpired(result)) return;
      if (result.success) {
        conversations = result.conversations || [];
        totalUnread = result.totalUnread || 0;
      }
    }

    const isFirstPollThisSession = !STATE.hasShownInitialUnreadAlert;
    STATE.hasShownInitialUnreadAlert = true;

    if (isFirstPollThisSession) {
      if (totalUnread > 0) {
        triggerAlarmEffect();
        const firstUnreadConv = conversations.find(c => c.unreadCount > 0);
        if (firstUnreadConv) showNewMessageFloatAlert(firstUnreadConv);
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'info',
          title: `🔔 คุณมีข้อความที่ยังไม่ได้อ่าน ${totalUnread} ข้อความ`,
          showConfirmButton: true,
          confirmButtonText: 'เปิดดูแชท',
          confirmButtonColor: '#3b82f6',
          timer: 6000,
          timerProgressBar: true
        }).then((res) => {
          if (res.isConfirmed) openInboxModal();
        });
      }
    } else if (totalUnread > STATE.lastKnownUnreadCount) {
      // ทุกครั้งหลังจากนั้น: ยอด unread "เพิ่มขึ้น" จากค่าก่อนหน้า = มีข้อความใหม่จริงๆ ให้แจ้งเตือนเสมอ
      // ไม่ว่าค่าก่อนหน้าจะเป็น 0 หรือไม่ก็ตาม
      playNotificationChime();
      triggerAlarmEffect();

      const latestUnreadConv = conversations.find(c => c.unreadCount > 0);
      if (latestUnreadConv) {
        showNewMessageFloatAlert(latestUnreadConv);
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'info',
          title: `🔔 มีข้อความใหม่จาก ${latestUnreadConv.partnerName}`,
          html: `<span class="text-xs text-slate-600">${escapeHtml(latestUnreadConv.lastMessage)}</span>`,
          showConfirmButton: true,
          confirmButtonText: 'เปิดดูแชท',
          confirmButtonColor: '#3b82f6',
          timer: 6000,
          timerProgressBar: true
        }).then((res) => {
          if (res.isConfirmed) {
            openChatModalFromInbox(latestUnreadConv);
          }
        });
      }
    }

    STATE.lastKnownUnreadCount = totalUnread;
    STATE.totalUnreadCount = totalUnread;
    STATE.myConversations = conversations;

    updateUnreadBadgeUI();
    const inboxModal = document.getElementById('inboxModal');
    if (inboxModal && !inboxModal.classList.contains('hidden')) {
      renderInboxList();
    }

  } catch (err) {
    console.error('Error loading chats:', err);
  }
}

function openInboxModal() {
  if (!STATE.currentUser) {
    openConsentOrLogin();
    return;
  }

  document.getElementById('inboxModal').classList.remove('hidden');
  document.getElementById('inboxModal').classList.add('flex');

  hideNewMessageFloatAlert();
  loadMyChats(true);
  renderInboxList();
}

function closeInboxModal() {
  document.getElementById('inboxModal').classList.add('hidden');
  document.getElementById('inboxModal').classList.remove('flex');
}

function renderInboxList() {
  const container = document.getElementById('inboxListContainer');
  const conversations = STATE.myConversations || [];

  if (conversations.length === 0) {
    container.innerHTML = `
      <div class="text-center py-12 text-slate-400">
        <i class="ph ph-chat-circle-dots text-4xl mb-2 block text-slate-300"></i>
        <p class="text-sm font-semibold text-slate-600">ยังไม่มีข้อความสนทนา</p>
        <p class="text-xs text-slate-400 mt-1">เมื่อคุณทักถามสินค้า หรือมีลูกค้าทักมา จะแสดงที่นี่</p>
      </div>
    `;
    return;
  }

  container.innerHTML = conversations.map(conv => {
    const isUnread = conv.unreadCount > 0;
    const isSeller = conv.isSeller;
    const roleBadge = isSeller
      ? `<span class="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full"><i class="ph-bold ph-storefront"></i> ลูกค้าทักซื้อ</span>`
      : `<span class="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full"><i class="ph-bold ph-shopping-cart"></i> คุณทักถาม</span>`;

    const fallbackImg = 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?w=100&auto=format&fit=crop&q=60';
    const imgUrl = conv.productImage || fallbackImg;

    return `
      <div
        onclick="openChatModalFromInboxByKey('${conv.key}')"
        class="p-3 sm:p-3.5 bg-white border ${isUnread ? 'border-blue-300 bg-blue-50/40 shadow-sm' : 'border-slate-200/80'} hover:border-blue-400 rounded-2xl cursor-pointer transition flex items-start sm:items-center justify-between gap-2 sm:gap-3 group relative"
      >
        <div class="flex items-start sm:items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
          <img
            src="${imgUrl}"
            alt="Product"
            class="w-11 h-11 sm:w-12 sm:h-12 rounded-xl object-cover bg-slate-100 flex-shrink-0 border border-slate-200"
            onerror="this.src='${fallbackImg}'"
          />
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5 sm:gap-2 mb-0.5 flex-wrap">
              ${roleBadge}
              <span class="text-xs font-bold text-slate-800 truncate max-w-[120px] sm:max-w-none">${escapeHtml(conv.partnerName)}</span>
              <span class="text-[10px] text-slate-400 font-mono">(${conv.partnerId})</span>
            </div>
            <div class="text-xs font-semibold text-blue-600 truncate max-w-[180px] sm:max-w-[280px]">
              ${escapeHtml(conv.productTitle)}
            </div>
            <div class="text-xs text-slate-600 truncate max-w-[180px] sm:max-w-[280px] mt-0.5 ${isUnread ? 'font-bold text-slate-900' : ''}">
              ${escapeHtml(conv.lastMessage)}
            </div>
          </div>
        </div>

        <div class="flex flex-col items-end gap-1.5 flex-shrink-0">
          <span class="text-[10px] text-slate-400">${conv.timestamp || ''}</span>
          ${isUnread ? `
            <span class="bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full font-mono shadow-sm animate-pulse">
              ${conv.unreadCount} ใหม่
            </span>
          ` : `
            <i class="ph ph-caret-right text-slate-300 group-hover:text-blue-500 transition"></i>
          `}
        </div>
      </div>
    `;
  }).join('');
}

function openChatModalFromInboxByKey(key) {
  const conv = STATE.myConversations.find(c => c.key === key);
  if (!conv) return;
  openChatModalFromInbox(conv);
}

function openChatModalFromInbox(conv) {
  closeInboxModal();

  const mockProduct = {
    productId: conv.productId,
    title: conv.productTitle,
    price: conv.productPrice,
    imageUrl: conv.productImage,
    empId: conv.isSeller ? (STATE.currentUser && STATE.currentUser.empId) : conv.partnerId
  };

  openChatModal(mockProduct, conv.partnerId, conv.partnerName, Boolean(conv.isSeller));
}

function openSellerInquiriesFromDetail() {
  const item = STATE.currentDetailProduct;
  if (!item || !STATE.currentUser) return;

  closeProductDetailModal();
  openInboxModal();
}

function renderCategories() {
  const container = document.getElementById('categoryContainer');
  const sellCategorySelect = document.getElementById('sellCategory');

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

  sellCategorySelect.innerHTML = CONFIG.CATEGORIES
    .filter(c => c.id !== 'all')
    .map(cat => `<option value="${cat.name}">${cat.name}</option>`)
    .join('');

  // ตั้งค่าเริ่มต้นให้ช่องจำนวนสินค้า (สำหรับระบบจอง) แสดง/ซ่อนให้ถูกต้องตามหมวดหมู่เริ่มต้น
  handleSellCategoryChange();
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

  const foodCategoryName = getFoodCategoryName();

  grid.innerHTML = STATE.filteredProducts.map(item => {
    const isSold = item.status === 'SOLD';
    const fallbackImg = 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?w=400&auto=format&fit=crop&q=60';
    const imgUrl = item.imageUrl || fallbackImg;
    const initials = item.sellerName ? item.sellerName.substring(0, 2) : 'EM';

    const isFood = item.category === foodCategoryName;
    const hasQtyLimit = isFood && item.quantity !== null && item.quantity !== undefined;
    const reservationBadge = hasQtyLimit
      ? `<span class="absolute bottom-2 left-2 bg-amber-500/95 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm flex items-center gap-1">
          <i class="ph-bold ph-bookmark-simple"></i> เหลือ ${item.remainingQty}
        </span>`
      : (isFood ? `<span class="absolute bottom-2 left-2 bg-amber-500/95 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm flex items-center gap-1"><i class="ph-bold ph-bookmark-simple"></i> จองได้</span>` : '');

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
          
          <span class="absolute top-2 left-2 right-2 max-w-[85%] truncate bg-white/90 backdrop-blur text-[10px] font-semibold text-slate-700 px-2 py-0.5 rounded-md shadow-sm">
            ${escapeHtml(item.category) || 'ทั่วไป'}
          </span>

          ${!isSold ? reservationBadge : ''}

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
  document.getElementById('detailSellerAvatar').textContent = item.sellerName ? item.sellerName.substring(0, 2) : 'EM';
  document.getElementById('detailSellerName').textContent = item.sellerName || item.empId;
  document.getElementById('detailSellerDept').textContent = `${item.sellerDept || 'พนักงาน'} ${item.sellerPlant ? '• ' + item.sellerPlant : ''} (รหัส ${item.empId})`;

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

  const ownerBtn = document.getElementById('detailOwnerManageBtn');
  const chatBtn = document.getElementById('detailChatBtn');
  const inquiriesBtn = document.getElementById('detailSellerInquiriesBtn');
  const isAdminUser = checkIsAdmin(STATE.currentUser);
  const isOwner = STATE.currentUser && STATE.currentUser.empId === item.empId;

  if (isOwner) {
    chatBtn.classList.add('hidden');
    inquiriesBtn.classList.remove('hidden');
    ownerBtn.classList.remove('hidden');
    ownerBtn.innerHTML = `<i class="ph-bold ph-gear"></i> <span>จัดการ</span>`;
  } else if (isAdminUser) {
    chatBtn.classList.remove('hidden');
    inquiriesBtn.classList.add('hidden');
    ownerBtn.classList.remove('hidden');
    ownerBtn.innerHTML = `<i class="ph-bold ph-shield-warning"></i> <span>จัดการ (Admin)</span>`;
  } else {
    chatBtn.classList.remove('hidden');
    inquiriesBtn.classList.add('hidden');
    ownerBtn.classList.add('hidden');
  }

  updateReserveButtonVisibility(item); // [ใหม่]

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
    handleAdminDeletePost(item.productId);
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

function openSellModal() {
  if (!STATE.currentUser) {
    Swal.fire({
      icon: 'info',
      title: 'กรุณาเข้าสู่ระบบ',
      text: 'คุณต้องเข้าสู่ระบบด้วยรหัสพนักงานก่อนลงประกาศขายสินค้า',
      confirmButtonText: 'เข้าสู่ระบบตอนนี้',
      confirmButtonColor: '#3b82f6'
    }).then((res) => {
      if (res.isConfirmed) openConsentOrLogin();
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
  const consentBox = document.getElementById('sellConsentRules');
  if (consentBox) consentBox.checked = false;
  handleSellCategoryChange();
}

// [ใหม่] แสดง/ซ่อนช่องจำนวนสินค้า เมื่อเลือกหมวดหมู่ "อาหาร & ขนม" ในฟอร์มลงขาย
function handleSellCategoryChange() {
  const select = document.getElementById('sellCategory');
  const qtyWrap = document.getElementById('sellQuantityWrap');
  if (!select || !qtyWrap) return;

  const selectedName = select.value;
  const isFood = selectedName === getFoodCategoryName();
  qtyWrap.classList.toggle('hidden', !isFood);
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
  const consentChecked = document.getElementById('sellConsentRules').checked;

  if (!title || isNaN(price) || !phone) {
    Swal.fire({ icon: 'warning', title: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
    return;
  }

  // [ใหม่] บังคับให้ยอมรับการเปิดเผยข้อมูลและกติกาการขายก่อนลงประกาศทุกครั้ง
  if (!consentChecked) {
    Swal.fire({
      icon: 'warning',
      title: 'กรุณายอมรับเงื่อนไข',
      text: 'กรุณายืนยันการยินยอมเปิดเผยข้อมูลผู้ขาย และรับทราบกติกาการขายสินค้าก่อนลงประกาศ'
    });
    return;
  }

  const isFoodCategory = category === getFoodCategoryName();
  const quantityInput = document.getElementById('sellQuantity');
  const quantityVal = (isFoodCategory && quantityInput && quantityInput.value.trim() !== '') ? Number(quantityInput.value) : '';

  if (isFoodCategory && quantityInput && quantityInput.value.trim() !== '' && (isNaN(quantityVal) || quantityVal <= 0)) {
    Swal.fire({ icon: 'warning', title: 'จำนวนสินค้าไม่ถูกต้อง', text: 'กรุณาระบุจำนวนสินค้าเป็นตัวเลขที่มากกว่า 0 หรือเว้นว่างไว้หากไม่จำกัดจำนวน' });
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-lg"></i> กำลังบันทึกข้อมูล...`;

  const newProductPayload = {
    action: 'createProduct',
    empId: STATE.currentUser.empId,
    token: getSessionToken(),
    title: title,
    category: category,
    price: price,
    phone: phone,
    description: description,
    imageBase64: STATE.selectedImageBase64,
    imageName: STATE.selectedImageName,
    quantity: quantityVal // [ใหม่]
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
        createdAt: 'เมื่อสักครู่',
        quantity: quantityVal === '' ? null : quantityVal,
        reservedQty: 0,
        remainingQty: quantityVal === '' ? null : quantityVal
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
    if (handleAuthExpired(result)) return;
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
      if (res.isConfirmed) openConsentOrLogin();
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

function openChatModal(product, partnerId, partnerName, currentUserIsSeller) {
  hideNewMessageFloatAlert();

  STATE.currentChatProduct = product;
  STATE.currentChatPartnerId = partnerId;
  STATE.currentChatPartnerName = partnerName;

  const isSeller = typeof currentUserIsSeller === 'boolean'
    ? currentUserIsSeller
    : Boolean(STATE.currentUser && product && product.empId && STATE.currentUser.empId === product.empId);

  const roleBadge = document.getElementById('chatPartnerRoleBadge');
  if (roleBadge) {
    if (isSeller) {
      roleBadge.textContent = 'ลูกค้า';
      roleBadge.className = 'flex-shrink-0 text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold';
    } else {
      roleBadge.textContent = 'ผู้ขาย';
      roleBadge.className = 'flex-shrink-0 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold';
    }
  }

  document.getElementById('chatProductThumb').src = product.imageUrl || 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?w=100&auto=format&fit=crop&q=60';
  document.getElementById('chatProductTitle').textContent = product.title;
  document.getElementById('chatPartnerName').textContent = partnerName;
  document.getElementById('chatInput').value = '';

  document.getElementById('chatModal').classList.remove('hidden');
  document.getElementById('chatModal').classList.add('flex');
  loadChatMessages();
  markChatMessagesAsRead(product.productId, partnerId);

  if (STATE.chatPollingInterval) clearInterval(STATE.chatPollingInterval);
  STATE.chatPollingInterval = setInterval(loadChatMessages, CONFIG.CHAT_POLL_INTERVAL || 3500);
}

function closeChatModal() {
  document.getElementById('chatModal').classList.add('hidden');
  document.getElementById('chatModal').classList.remove('flex');
  if (STATE.chatPollingInterval) {
    clearInterval(STATE.chatPollingInterval);
    STATE.chatPollingInterval = null;
  }
  loadMyChats(false);
}

async function markChatMessagesAsRead(productId, partnerId) {
  if (!STATE.currentUser) return;

  if (!STATE.isApiConfigured) {
    MOCK_MESSAGES.forEach(m => {
      if (m.productId === productId && m.senderEmpID === partnerId && m.receiverEmpID === STATE.currentUser.empId) {
        m.isRead = true;
      }
    });
    loadMyChats(false);
    return;
  }

  try {
    const response = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'markAsRead',
        productId: productId,
        myEmpId: STATE.currentUser.empId,
        partnerEmpId: partnerId,
        token: getSessionToken()
      })
    });
    const result = await response.json();
    if (handleAuthExpired(result)) return;
    loadMyChats(false);
  } catch (e) {
    console.error('Mark read error:', e);
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
      const response = await fetch(`${CONFIG.API_URL}?action=getMessages&productId=${encodeURIComponent(productId)}&buyerId=${encodeURIComponent(myId)}&sellerId=${encodeURIComponent(partnerId)}&token=${encodeURIComponent(getSessionToken())}&_t=${Date.now()}`);
      const result = await response.json();
      if (handleAuthExpired(result)) return;
      if (result.success && Array.isArray(result.messages)) {
        messages = result.messages;
      }
    }

    if (messages.length === 0) {
      messagesArea.innerHTML = `
        <div class="text-center py-12 text-slate-400 text-xs">
          <i class="ph ph-chat-circle-dots text-3xl mb-2 block"></i>
          ยังไม่มีบทสนทนา พิมพ์ทักทายหรือต่อรองราคาสินค้าได้เลยครับ
          <p class="text-[10px] text-slate-400 mt-2">⏳ ข้อความจะถูกลบอัตโนมัติทุกเที่ยงคืนของวันถัดไป</p>
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
  const tempId = 'temp-' + Date.now();
  const messagesArea = document.getElementById('chatMessagesArea');
  const tempMsgElement = document.createElement('div');
  tempMsgElement.className = 'flex flex-col items-end';
  tempMsgElement.id = tempId;
  tempMsgElement.innerHTML = `
    <div class="max-w-[78%] px-4 py-2.5 rounded-2xl text-xs sm:text-sm chat-bubble-me">
      ${escapeHtml(messageText)}
    </div>
    <span class="text-[10px] text-slate-400 mt-1 px-1" data-role="status">กำลังส่ง...</span>
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
        timestamp: timeFormatted,
        isRead: false
      });
      updateChatBubbleStatus(tempId, `ส่งแล้ว ${timeFormatted}`);
      loadMyChats(false);
      return;
    }

    const response = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'sendMessage',
        productId: productId,
        senderEmpID: myId,
        receiverEmpID: partnerId,
        message: messageText,
        token: getSessionToken()
      })
    });

    const result = await response.json();

    if (result && result.sessionExpired) {
      markChatBubbleFailed(tempId, messageText);
      handleAuthExpired(result);
      return;
    }

    if (!result || !result.success) {
      markChatBubbleFailed(tempId, messageText);
      Swal.fire({ icon: 'error', title: 'ส่งข้อความไม่สำเร็จ', text: (result && result.message) || 'กรุณาลองส่งข้อความอีกครั้ง' });
      return;
    }

    updateChatBubbleStatus(tempId, `ส่งแล้ว ${timeFormatted}`);
    loadChatMessages();
    loadMyChats(false);
  } catch (err) {
    console.error('Failed to send chat message:', err);
    markChatBubbleFailed(tempId, messageText);
    Swal.fire({
      icon: 'error',
      title: 'เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ',
      text: 'ข้อความนี้ยังไม่ถูกส่งไปยังอีกฝ่าย กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง'
    });
  }
}

function updateChatBubbleStatus(bubbleId, text) {
  const bubbleElement = document.getElementById(bubbleId);
  if (!bubbleElement) return;
  const statusEl = bubbleElement.querySelector('[data-role="status"]');
  if (statusEl) statusEl.textContent = text;
}

function markChatBubbleFailed(bubbleId, originalMessageText) {
  const bubbleElement = document.getElementById(bubbleId);
  if (!bubbleElement) return;
  bubbleElement.dataset.failedText = originalMessageText;

  const statusEl = bubbleElement.querySelector('[data-role="status"]');
  if (statusEl) {
    statusEl.innerHTML = `
      <span class="text-rose-500 font-semibold">✕ ส่งไม่สำเร็จ</span>
      <button onclick="retryFailedMessage('${bubbleElement.id}')" class="ml-1 text-blue-600 underline font-semibold">ลองอีกครั้ง</button>
    `;
  }
}

function retryFailedMessage(bubbleId) {
  const bubbleElement = document.getElementById(bubbleId);
  if (!bubbleElement) return;
  const text = bubbleElement.dataset.failedText || '';
  bubbleElement.remove();

  const input = document.getElementById('chatInput');
  input.value = text;
  sendChatMessage();
}

function openMyListingsModal() {
  if (!STATE.currentUser) {
    openConsentOrLogin();
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
      <div class="flex flex-col sm:flex-row sm:items-center gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
        <div class="flex items-center gap-3 min-w-0">
          <img src="${item.imageUrl || 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?w=100'}" class="w-14 h-14 rounded-xl object-cover bg-white flex-shrink-0" />
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-xs font-bold text-blue-600 font-mono">฿${Number(item.price).toLocaleString()}</span>
              <span class="text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${item.status === 'SOLD' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'}">
                ${item.status === 'SOLD' ? 'ขายแล้ว' : 'กำลังขาย'}
              </span>
              ${item.quantity !== null && item.quantity !== undefined ? `<span class="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-700 flex-shrink-0">เหลือ ${item.remainingQty}/${item.quantity}</span>` : ''}
            </div>
            <h4 class="text-xs sm:text-sm font-bold text-slate-800 truncate">${escapeHtml(item.title)}</h4>
            <p class="text-[11px] text-slate-400 truncate">${escapeHtml(item.category)} • ${item.createdAt || ''}</p>
          </div>
        </div>
        <div class="flex sm:flex-col gap-1.5 flex-shrink-0">
          <button
            onclick="updateItemStatus('${item.productId}', '${item.status === 'SOLD' ? 'ACTIVE' : 'SOLD'}')"
            class="flex-1 sm:flex-none px-2.5 py-1.5 sm:py-1 text-[11px] font-semibold rounded-lg text-center whitespace-nowrap sm:whitespace-normal ${item.status === 'SOLD' ? 'bg-slate-200 text-slate-700' : 'bg-emerald-600 text-white'}"
          >
            ${item.status === 'SOLD' ? 'เปิดขายใหม่' : 'ทำเครื่องหมายว่าขายแล้ว'}
          </button>
          <button
            onclick="deleteItem('${item.productId}')"
            class="flex-1 sm:flex-none px-2.5 py-1.5 sm:py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 bg-white sm:bg-transparent border sm:border-0 border-red-200 rounded-lg transition whitespace-nowrap"
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
      const response = await fetch(CONFIG.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'updateProductStatus',
          productId: productId,
          empId: STATE.currentUser.empId,
          token: getSessionToken(),
          status: newStatus
        })
      });
      const result = await response.json();
      handleAuthExpired(result);
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
      const response = await fetch(CONFIG.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'deleteProduct',
          productId: productId,
          empId: STATE.currentUser.empId,
          token: getSessionToken()
        })
      });
      const result = await response.json();
      if (handleAuthExpired(result)) return;
    } catch (e) {
      console.error(e);
    }
  }

  Swal.fire({ icon: 'success', title: 'ลบสินค้าเรียบร้อย', timer: 1500, showConfirmButton: false });
}

async function handleAdminDeletePost(productId) {
  const item = STATE.allProducts.find(p => p.productId === productId);

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
        ต้องการลบสินค้า: <b>${escapeHtml(productTitle)}</b><br/>
        ของผู้ลงประกาศ: <b>${escapeHtml(sellerEmpId)}</b>
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

  const prodIndex = STATE.allProducts.findIndex(p => p.productId === productId);
  if (prodIndex > -1) {
    STATE.allProducts[prodIndex].status = 'DELETED_BY_ADMIN';
  }

  const newLog = {
    logId: 'LOG-' + Date.now(),
    timestamp: 'เมื่อสักครู่',
    empId: STATE.currentUser.empId,
    action: 'ADMIN_DELETE_PRODUCT',
    details: `แอดมินลบโพสต์ [${productId}] "${productTitle}" ของพนักงาน ${sellerEmpId} (เหตุผล: ${reason})`
  };
  MOCK_LOGS.unshift(newLog);

  applyFilters();
  closeProductDetailModal();

  if (STATE.isApiConfigured) {
    try {
      const response = await fetch(CONFIG.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'adminDeleteProduct',
          productId: productId,
          adminEmpId: STATE.currentUser.empId,
          token: getSessionToken(),
          reason: reason
        })
      });
      const result = await response.json();
      if (handleAuthExpired(result)) return;
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

// ========================================================================
// [ใหม่] ระบบจองสินค้า (Reservation System) - สำหรับหมวดหมู่ "อาหาร & ขนม"
// ========================================================================

function updateReserveButtonVisibility(item) {
  const reserveBtn = document.getElementById('detailReserveBtn');
  if (!reserveBtn) return;

  const isFood = item.category === getFoodCategoryName();
  const isOwner = STATE.currentUser && STATE.currentUser.empId === item.empId;
  const isActive = item.status === 'ACTIVE';

  if (isFood && isActive && !isOwner) {
    reserveBtn.classList.remove('hidden');

    let qtyText = '';
    let disabled = false;
    if (item.quantity !== null && item.quantity !== undefined) {
      const remaining = (item.remainingQty !== undefined && item.remainingQty !== null) ? item.remainingQty : item.quantity;
      qtyText = ` (เหลือ ${remaining})`;
      disabled = remaining <= 0;
    }

    reserveBtn.disabled = disabled;
    reserveBtn.classList.toggle('opacity-50', disabled);
    reserveBtn.classList.toggle('pointer-events-none', disabled);

    const labelSpan = reserveBtn.querySelector('span');
    if (labelSpan) labelSpan.textContent = disabled ? 'จองครบแล้ว' : `จองสินค้า${qtyText}`;
  } else {
    reserveBtn.classList.add('hidden');
  }
}

function openReservationModal() {
  const item = STATE.currentDetailProduct;
  if (!item) return;

  if (!STATE.currentUser) {
    closeProductDetailModal();
    Swal.fire({
      icon: 'info',
      title: 'กรุณาเข้าสู่ระบบ',
      text: 'คุณต้องเข้าสู่ระบบก่อนทำการจองสินค้า',
      confirmButtonText: 'เข้าสู่ระบบ',
      confirmButtonColor: '#3b82f6'
    }).then((res) => {
      if (res.isConfirmed) openConsentOrLogin();
    });
    return;
  }

  STATE.reservationTargetProduct = item;

  document.getElementById('reservationProductTitle').textContent = item.title;
  document.getElementById('reservationProductThumb').src = item.imageUrl || 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?w=100';

  const qtyInput = document.getElementById('reservationQuantityInput');
  const hasLimit = item.quantity !== null && item.quantity !== undefined;
  const maxQty = hasLimit ? Math.max(1, item.remainingQty) : 99;

  qtyInput.max = maxQty;
  qtyInput.value = 1;

  document.getElementById('reservationMaxHint').textContent = hasLimit
    ? `จองได้สูงสุด ${maxQty} รายการ (คงเหลือทั้งหมด ${item.remainingQty} จาก ${item.quantity})`
    : 'ผู้ขายไม่ได้จำกัดจำนวนสินค้าไว้';
  document.getElementById('reservationNoteInput').value = '';

  closeProductDetailModal();
  document.getElementById('reservationModal').classList.remove('hidden');
  document.getElementById('reservationModal').classList.add('flex');
}

function closeReservationModal() {
  document.getElementById('reservationModal').classList.add('hidden');
  document.getElementById('reservationModal').classList.remove('flex');
}

async function submitReservation(event) {
  event.preventDefault();
  const item = STATE.reservationTargetProduct;
  if (!item || !STATE.currentUser) return;

  const qty = Number(document.getElementById('reservationQuantityInput').value) || 1;
  const note = document.getElementById('reservationNoteInput').value.trim();
  const btn = document.getElementById('reservationSubmitBtn');

  if (qty <= 0) {
    Swal.fire({ icon: 'warning', title: 'จำนวนไม่ถูกต้อง', text: 'กรุณาระบุจำนวนที่ต้องการจองมากกว่า 0' });
    return;
  }

  btn.disabled = true;
  btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin"></i> กำลังส่งคำขอจอง...`;

  try {
    if (!STATE.isApiConfigured) {
      await new Promise(r => setTimeout(r, 500));
      Swal.fire({
        icon: 'success',
        title: 'จองสินค้าสำเร็จ (Demo Mode)',
        text: 'รอผู้ขายยืนยันการจอง (โหมดทดลองยังไม่บันทึกข้อมูลถาวร)',
        timer: 2500,
        showConfirmButton: false
      });
      closeReservationModal();
      return;
    }

    const response = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'createReservation',
        productId: item.productId,
        buyerEmpId: STATE.currentUser.empId,
        quantity: qty,
        note: note,
        token: getSessionToken()
      })
    });

    const result = await response.json();
    if (handleAuthExpired(result)) return;

    if (result.success) {
      Swal.fire({
        icon: 'success',
        title: 'จองสินค้าสำเร็จ',
        text: result.message || 'รอผู้ขายยืนยันการจอง',
        timer: 2500,
        showConfirmButton: false
      });
      closeReservationModal();
      loadProducts(true);
      loadMyReservations(false);
    } else {
      Swal.fire({ icon: 'error', title: 'จองไม่สำเร็จ', text: result.message || 'เกิดข้อผิดพลาด' });
    }
  } catch (err) {
    console.error(err);
    Swal.fire({ icon: 'error', title: 'เชื่อมต่อล้มเหลว', text: 'ไม่สามารถส่งคำขอจองไปยังเซิร์ฟเวอร์ได้' });
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i class="ph-bold ph-bookmark-simple"></i> <span>ยืนยันการจอง</span>`;
  }
}

async function loadMyReservations(showModal = false) {
  if (!STATE.currentUser) {
    if (showModal) openConsentOrLogin();
    return;
  }

  try {
    let asBuyer = [];
    let asSeller = [];

    if (!STATE.isApiConfigured) {
      // Demo Mode: ยังไม่มีระบบจัดเก็บถาวร แสดงเป็นรายการว่างเปล่า
      asBuyer = [];
      asSeller = [];
    } else {
      const response = await fetch(`${CONFIG.API_URL}?action=getMyReservations&empId=${encodeURIComponent(STATE.currentUser.empId)}&token=${encodeURIComponent(getSessionToken())}&_t=${Date.now()}`);
      const result = await response.json();
      if (handleAuthExpired(result)) return;
      if (result.success) {
        asBuyer = result.asBuyer || [];
        asSeller = result.asSeller || [];
      }
    }

    STATE.myReservations = { asBuyer, asSeller };
    updateReservationBadge();

    const modal = document.getElementById('myReservationsModal');
    if (showModal || (modal && !modal.classList.contains('hidden'))) {
      renderMyReservations();
    }
  } catch (err) {
    console.error('Error loading reservations:', err);
  }
}

function updateReservationBadge() {
  const pendingCount = (STATE.myReservations.asSeller || []).filter(r => r.status === 'PENDING').length;
  const badge = document.getElementById('dropdownReservationBadge');
  if (badge) {
    if (pendingCount > 0) {
      badge.textContent = pendingCount;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }
}

function openMyReservationsModal() {
  if (!STATE.currentUser) {
    openConsentOrLogin();
    return;
  }

  document.getElementById('myReservationsModal').classList.remove('hidden');
  document.getElementById('myReservationsModal').classList.add('flex');
  switchReservationTab('seller');
  loadMyReservations(true);
}

function closeMyReservationsModal() {
  document.getElementById('myReservationsModal').classList.add('hidden');
  document.getElementById('myReservationsModal').classList.remove('flex');
}

let currentReservationTab = 'seller';

function switchReservationTab(tab) {
  currentReservationTab = tab;
  const btnSeller = document.getElementById('resTabBtnSeller');
  const btnBuyer = document.getElementById('resTabBtnBuyer');
  const activeCls = 'flex-1 px-3 py-2 text-xs font-bold rounded-xl transition bg-blue-600 text-white shadow-sm';
  const inactiveCls = 'flex-1 px-3 py-2 text-xs font-medium rounded-xl transition bg-white text-slate-600 border border-slate-200';

  if (tab === 'seller') {
    btnSeller.className = activeCls;
    btnBuyer.className = inactiveCls;
  } else {
    btnBuyer.className = activeCls;
    btnSeller.className = inactiveCls;
  }

  renderMyReservations();
}

function renderMyReservations() {
  const container = document.getElementById('myReservationsContent');
  if (!container) return;

  const list = currentReservationTab === 'seller' ? (STATE.myReservations.asSeller || []) : (STATE.myReservations.asBuyer || []);

  if (list.length === 0) {
    container.innerHTML = `
      <div class="text-center py-10 text-slate-400">
        <i class="ph ph-bookmark-simple text-4xl mb-2 block text-slate-300"></i>
        <p class="text-sm font-semibold text-slate-600">${currentReservationTab === 'seller' ? 'ยังไม่มีคำขอจองสินค้าของคุณ' : 'คุณยังไม่ได้จองสินค้าใดๆ'}</p>
        <p class="text-xs text-slate-400 mt-1">${currentReservationTab === 'seller' ? 'เมื่อมีคนจองสินค้าอาหาร & ขนมของคุณ จะแสดงที่นี่' : 'ลองเลือกดูสินค้าหมวด "อาหาร & ขนม" แล้วกดจองได้เลย'}</p>
      </div>`;
    return;
  }

  const statusBadge = (status) => {
    if (status === 'PENDING') return `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">รอยืนยัน</span>`;
    if (status === 'CONFIRMED') return `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">ยืนยันแล้ว</span>`;
    if (status === 'REJECTED') return `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">ถูกปฏิเสธ</span>`;
    return `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">ยกเลิกแล้ว</span>`;
  };

  container.innerHTML = list.map(r => `
    <div class="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col gap-2">
      <div class="flex items-center gap-3">
        <img src="${r.productImage || 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?w=100'}" class="w-12 h-12 rounded-xl object-cover bg-white flex-shrink-0" onerror="this.src='https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?w=100'" />
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1.5 flex-wrap">
            ${statusBadge(r.status)}
            <span class="text-[10px] text-slate-400">${r.createdAt || ''}</span>
          </div>
          <h4 class="text-xs sm:text-sm font-bold text-slate-800 truncate">${escapeHtml(r.productTitle)}</h4>
          <p class="text-[11px] text-slate-500">จำนวน ${r.quantity} รายการ ${currentReservationTab === 'seller' ? '• ผู้จอง: ' + escapeHtml(r.buyerName) + ' (' + escapeHtml(r.buyerEmpId) + ')' : '• ผู้ขาย: ' + escapeHtml(r.sellerName)}</p>
          ${r.note ? `<p class="text-[11px] text-slate-500 italic">หมายเหตุ: ${escapeHtml(r.note)}</p>` : ''}
        </div>
      </div>
      ${currentReservationTab === 'seller' && r.status === 'PENDING' ? `
        <div class="flex gap-2 pt-1 border-t border-slate-200">
          <button onclick="handleReservationAction('${r.reservationId}','CONFIRMED')" class="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg transition">ยืนยันการจอง</button>
          <button onclick="handleReservationAction('${r.reservationId}','REJECTED')" class="flex-1 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-700 text-[11px] font-bold rounded-lg transition">ปฏิเสธ</button>
        </div>
      ` : ''}
      ${currentReservationTab === 'buyer' && r.status === 'PENDING' ? `
        <div class="flex gap-2 pt-1 border-t border-slate-200">
          <button onclick="handleReservationAction('${r.reservationId}','CANCELLED')" class="flex-1 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[11px] font-bold rounded-lg transition">ยกเลิกการจอง</button>
        </div>
      ` : ''}
    </div>
  `).join('');
}

async function handleReservationAction(reservationId, newStatus) {
  if (!STATE.currentUser) return;

  try {
    if (!STATE.isApiConfigured) {
      Swal.fire({ icon: 'info', text: 'โหมดทดลอง (Demo Mode) ยังไม่รองรับการบันทึกการจองถาวร กรุณาตั้งค่า API_URL เพื่อใช้งานฟีเจอร์นี้จริง' });
      return;
    }

    const response = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'updateReservationStatus',
        reservationId: reservationId,
        empId: STATE.currentUser.empId,
        token: getSessionToken(),
        newStatus: newStatus
      })
    });

    const result = await response.json();
    if (handleAuthExpired(result)) return;

    if (result.success) {
      Swal.fire({ icon: 'success', title: result.message, timer: 1500, showConfirmButton: false });
      loadMyReservations(true);
      loadProducts(true);
    } else {
      Swal.fire({ icon: 'error', title: 'ไม่สำเร็จ', text: result.message || 'เกิดข้อผิดพลาด' });
    }
  } catch (err) {
    console.error(err);
    Swal.fire({ icon: 'error', title: 'เชื่อมต่อล้มเหลว', text: 'ไม่สามารถอัปเดตรายการจองได้' });
  }
}

function escapeHtml(string) {
  if (!string) return '';
  return String(string)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}