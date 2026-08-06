const LEVELS = [
  { name: 'Beginner',   th: 'นักสะสมมือใหม่',      min: 0,    icon: 'fa-compass' },
  { name: 'Collector',    th: 'นักสะสม',         min: 10,   icon: 'fa-cloud-moon' },
  { name: 'Curator', th: 'ภัณฑารักษ์',      min: 25,   icon: 'fa-map' },
  { name: 'Connoisseur',       th: 'ผู้เชี่ยวชาญ',        min: 50,   icon: 'fa-shield-heart' },
  { name: 'Grandmaster',     th: 'ปรมาจารย์แห่งการสะสม',          min: 100,  icon: 'fa-crown' },
  { name: 'Luminary',      th: 'ผู้ทรงคุณวุฒิ',        min: 300,  icon: 'fa-gem' },
  { name: 'Legend',       th: 'ตำนาน',            min: 500,  icon: 'fa-meteor' },
  { name: 'Mythic',       th: 'ผู้วิเศษ',           min: 1000, icon: 'fa-hat-wizard' }
];

const STAMPS_PER_BOOK_PAGE = 9;
const FLIP_DURATION_MS = 700;

let session = null;
let rewardsCache = [];
let employeeCache = null;
let stampHistoryCache = [];
let redemptionHistoryCache = [];
let stampbookPages = [];
let spreadIndex = 0;
let totalSpreadsCache = 1;
let isFlipping = false;
let pendingRewardId = null;
let lastMobileSingleState = null;

const REWARD_IMAGE_FOLDER = 'images/rewards/';
const STAMP_IMAGE_DEFAULT = 'images/stamps/stamp.png';

function getLevelInfo(stamps) {
  let current = LEVELS[0];
  let next = null;
  for (let i = 0; i < LEVELS.length; i++) {
    if (stamps >= LEVELS[i].min) {
      current = LEVELS[i];
      next = LEVELS[i + 1] || null;
    }
  }
  return { current, next };
}

function resolveRewardImage(value) {
  if (!value) return REWARD_IMAGE_FOLDER + 'reward-placeholder.svg';
  let v = String(value).trim();
  if (/^https?:\/\//i.test(v)) return v;
  v = v.replace(/\\/g, '/');
  const parts = v.split('/').filter(Boolean);
  const filename = parts[parts.length - 1] || '';
  if (!filename) return REWARD_IMAGE_FOLDER + 'reward-placeholder.svg';
  return REWARD_IMAGE_FOLDER + filename;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function displayDate(dateStr) {
  return dateStr || '';
}

function showLoading(message) {
  const existing = document.querySelector('.loading-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'loading-overlay';
  overlay.innerHTML = `
    <div class="spinner-magic"></div>
    <div>${escapeHtml(message)}</div>
  `;
  document.body.appendChild(overlay);
}

function hideLoading() {
  const overlay = document.querySelector('.loading-overlay');
  if (overlay) overlay.remove();
}

function showAlert(containerId, message, type = 'info') {
  const container = document.getElementById(containerId);
  if (!container) return;

  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type} alert-dismissible fade show mt-3`;
  alertDiv.innerHTML = `
    ${escapeHtml(message)}
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;
  container.prepend(alertDiv);

  setTimeout(() => {
    alertDiv.remove();
  }, 5000);
}

function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function updateStackedLayout() {
  const spreadEl = document.querySelector('.stampbook-spread');
  if (!spreadEl) return;
  spreadEl.classList.toggle('is-stacked', window.innerWidth < 768);
}

function isMobileSingle() {
  return window.innerWidth < 576;
}

async function loadProfile() {
  employeeCache = await API.getEmployee(session.employeeId);

  document.getElementById('empName').textContent = employeeCache.FullName || 'ไม่ระบุชื่อ';
  document.getElementById('empMeta').textContent = `${employeeCache.Position || ''} · ${employeeCache.Department || ''}`;
  document.getElementById('coverName').textContent = employeeCache.FullName || '——';

  const stamps = employeeCache.TotalStamps || 0;
  document.getElementById('stampCount').textContent = stamps;
  document.getElementById('coverCount').textContent = stamps + ' แสตมป์';
  document.getElementById('statTotalStamps').textContent = stamps;

  const { current, next } = getLevelInfo(stamps);
  document.getElementById('levelBadge').innerHTML =
    `<i class="fa-solid ${current.icon}"></i> ${current.th} (${current.name})`;

  let pct = 100;
  let hint = 'คุณไปถึงระดับสูงสุดแล้ว! ✨';
  if (next) {
    const span = next.min - current.min;
    pct = Math.min(100, Math.round(((stamps - current.min) / span) * 100));
    hint = `อีก ${next.min - stamps} แสตมป์ สู่ระดับ "${next.th}"`;
  }
  document.getElementById('journeyFill').style.width = pct + '%';
  document.getElementById('nextLevelHint').textContent = hint;
}

async function loadStampHistory() {
  const data = await API.getStampHistory(session.employeeId);
  const chronological = (data || []).slice().reverse();
  let collected = [];

  chronological.forEach(item => {
    const amount = Number(item.StampAmount) || 0;

    if (amount > 0) {
      const units = Math.floor(amount);
      for (let i = 0; i < units; i++) {
        collected.push({
          ActivityName: item.ActivityName,
          DateTime: item.DateTime,
          GrantedBy: item.GrantedBy,
          Remark: item.Remark,
          StampAmount: 1
        });
      }
    } else if (amount < 0) {
      let toRemove = Math.floor(Math.abs(amount));
      while (toRemove > 0 && collected.length > 0) {
        collected.shift();
        toRemove--;
      }
    }
  });

  stampHistoryCache = collected.reverse();

  spreadIndex = 0;
  renderStampbook();
}

async function loadRewards() {
  rewardsCache = await API.getRewards();
  renderRewards();
}

function renderRewards() {
  const grid = document.getElementById('rewardsGrid');
  const active = rewardsCache.filter(r => r.Status === 'Active');

  if (active.length === 0) {
    grid.innerHTML = `<div class="text-center text-muted-light py-4 w-100">ยังไม่มีรางวัลในขณะนี้</div>`;
    return;
  }

  const employeeStamps = employeeCache ? (employeeCache.TotalStamps || 0) : 0;

  grid.innerHTML = active.map(r => {
    const id = r.RewardID;
    const name = r.RewardName;
    const desc = r.Description || '';
    const cost = r.RequiredStamps || 0;
    const qty = r.RemainingQuantity || 0;
    const img = resolveRewardImage(r.RewardImage);
    const canRedeem = employeeStamps >= cost && qty > 0;

    return `
    <div class="col-sm-6 col-lg-4">
      <div class="reward-card">
        <div class="reward-image">
          <img src="${img}" alt="${escapeHtml(name)}"
               onerror="this.src='${REWARD_IMAGE_FOLDER}reward-placeholder.svg'">
        </div>
        <div class="reward-body">
          <h5 class="font-heading" style="color:var(--primary-blue)">${escapeHtml(name)}</h5>
          <p class="small text-muted-light flex-grow-1">${escapeHtml(desc)}</p>
          <div class="d-flex justify-content-between align-items-center mb-2">
            <span class="reward-req"><i class="fa-solid fa-stamp"></i> ${cost} แสตมป์</span>
            <span class="small text-muted-light">เหลือ ${qty} ชิ้น</span>
          </div>
          <button class="btn btn-magic-gold w-100" onclick="openRedeemModal('${id}')"
            ${!canRedeem ? 'disabled' : ''}>
            ${qty <= 0 ? 'ของหมด' : (employeeStamps < cost ? 'แสตมป์ไม่พอ' : 'แลกรางวัลนี้')}
          </button>
        </div>
      </div>
    </div>
  `;
  }).join('');
}

async function loadRedemptionHistory() {
  redemptionHistoryCache = await API.getRedemptionHistory(session.employeeId);
  renderRedemptionHistory();
}

function renderRedemptionHistory() {
  const box = document.getElementById('redemptionHistoryList');

  if (!redemptionHistoryCache || redemptionHistoryCache.length === 0) {
    box.innerHTML = `<tr><td colspan="5" class="text-center text-muted-light py-4">ยังไม่มีการแลกรางวัล</td></tr>`;
    return;
  }

  const statusClass = s => {
    const status = (s || '').toLowerCase();
    if (status === 'approved') return 'badge-status-active';
    if (status === 'rejected') return 'badge-status-rejected';
    return 'badge-status-pending';
  };

  const statusLabel = s => {
    const status = (s || '').toLowerCase();
    if (status === 'approved') return 'อนุมัติแล้ว';
    if (status === 'rejected') return 'ถูกปฏิเสธ';
    return 'รอดำเนินการ';
  };

  box.innerHTML = redemptionHistoryCache.map(r => {
    const reward = rewardsCache.find(x => String(x.RewardID) === String(r.RewardID));
    const imgSrc = resolveRewardImage(reward ? reward.RewardImage : '');
    const usedStamps = r.UsedStamps || 0;

    return `
    <tr>
      <td>
        <img src="${imgSrc}" alt="${escapeHtml(r.RewardName || 'reward')}"
             style="width:44px;height:44px;object-fit:cover;border-radius:8px;"
             onerror="this.src='${REWARD_IMAGE_FOLDER}reward-placeholder.svg'">
      </td>
      <td class="fw-bold" style="color:var(--primary-blue)">${escapeHtml(r.RewardName || 'รางวัล')}</td>
      <td class="small text-muted-light">${escapeHtml(displayDate(r.RedemptionDate))}</td>
      <td>${usedStamps}</td>
      <td><span class="badge ${statusClass(r.ApprovalStatus)}">${statusLabel(r.ApprovalStatus)}</span></td>
    </tr>
  `;
  }).join('');
}

async function loadDashboard() {
  const stats = await API.getEmployeeDashboard(session.employeeId);
  document.getElementById('statTotalStamps').textContent = stats.totalStamps || 0;
  document.getElementById('statActivities').textContent = stats.totalActivities || 0;
  document.getElementById('statRedeemed').textContent = stats.totalRedeemed || 0;
}

function buildStampbookPages() {
  const pages = [{ type: 'cover' }];

  if (!stampHistoryCache || stampHistoryCache.length === 0) {
    pages.push({ type: 'empty' });
  } else {
    const totalStampPages = Math.ceil(stampHistoryCache.length / STAMPS_PER_BOOK_PAGE);
    for (let p = 0; p < totalStampPages; p++) {
      pages.push({
        type: 'stamps',
        pageNumber: p + 1,
        items: stampHistoryCache.slice(p * STAMPS_PER_BOOK_PAGE, p * STAMPS_PER_BOOK_PAGE + STAMPS_PER_BOOK_PAGE)
      });
    }
  }

  pages.push({ type: 'back' });
  return pages;
}

function renderStampbook() {
  const leftEl = document.getElementById('stampPageLeftGrid');
  const rightEl = document.getElementById('stampPageRightGrid');
  const leftHeader = document.getElementById('stampPageLeftHeader');
  const rightHeader = document.getElementById('stampPageRightHeader');
  const indicatorEl = document.getElementById('pageIndicator');
  const prevBtn = document.getElementById('prevPageBtn');
  const nextBtn = document.getElementById('nextPageBtn');
  const spreadEl = document.querySelector('.stampbook-spread');

  stampbookPages = buildStampbookPages();
  const mobileSingle = isMobileSingle();
  const pagesPerView = mobileSingle ? 1 : 2;
  totalSpreadsCache = Math.ceil(stampbookPages.length / pagesPerView);
  spreadIndex = Math.min(Math.max(spreadIndex, 0), totalSpreadsCache - 1);

  if (spreadEl) spreadEl.classList.toggle('is-mobile-single', mobileSingle);

  if (mobileSingle) {
    const page = stampbookPages[spreadIndex];
    renderBookPage(rightEl, rightHeader, page, 'right', true);
    if (leftHeader) leftHeader.textContent = '';
    if (leftEl) { leftEl.className = 'stampbook-grid'; leftEl.innerHTML = ''; }
  } else {
    const leftPage = stampbookPages[spreadIndex * 2];
    const rightPage = stampbookPages[spreadIndex * 2 + 1];
    renderBookPage(leftEl, leftHeader, leftPage, 'left', false);
    renderBookPage(rightEl, rightHeader, rightPage, 'right', false);
  }

  indicatorEl.textContent = `แผ่นที่ ${spreadIndex + 1} / ${totalSpreadsCache}`;
  prevBtn.disabled = isFlipping || spreadIndex === 0;
  nextBtn.disabled = isFlipping || spreadIndex >= totalSpreadsCache - 1;

  const leftPageWrap = document.querySelector('.stampbook-page-left');
  const rightPageWrap = document.querySelector('.stampbook-page-right');
  if (leftPageWrap) {
    leftPageWrap.style.cursor = (mobileSingle || isFlipping || spreadIndex === 0) ? 'default' : 'pointer';
  }
  if (rightPageWrap) {
    rightPageWrap.style.cursor = (isFlipping || spreadIndex >= totalSpreadsCache - 1) ? 'default' : 'pointer';
  }
}

function renderBookPage(container, headerEl, page, side, singleMode) {
  if (!page) {
    headerEl.textContent = '';
    container.className = 'stampbook-grid is-cover';
    container.innerHTML = `<i class="fa-solid fa-book stampbook-cover-icon" style="opacity:.35"></i>`;
    return;
  }

  if (page.type === 'cover') {
    headerEl.textContent = 'ปกหน้า';
    container.className = 'stampbook-grid is-cover';
    const stamps = employeeCache ? (employeeCache.TotalStamps || 0) : 0;
    const name = employeeCache ? (employeeCache.FullName || '') : '';
    const coverHint = singleMode
      ? 'แตะ "แผ่นถัดไป" เพื่อดูแสตมป์ที่สะสมไว้ →'
      : (side === 'left' ? 'พลิกดูแสตมป์ทั้งหมดที่สะสมไว้ →' : '← กลับไปหน้าแรก');
    container.innerHTML = `
      <i class="fa-solid fa-book-bookmark stampbook-cover-icon"></i>
      <div class="stampbook-cover-title">สมุดสะสมแสตมป์</div>
      <div class="stampbook-cover-name">${escapeHtml(name)}</div>
      <div class="stampbook-cover-count"><i class="fa-solid fa-stamp"></i> ${stamps} แสตมป์สะสม</div>
      <div class="stampbook-cover-hint">${coverHint}</div>
    `;
    return;
  }

  if (page.type === 'back') {
    headerEl.textContent = 'ปกหลัง';
    container.className = 'stampbook-grid is-cover';
    container.innerHTML = `
      <i class="fa-solid fa-wand-magic-sparkles stampbook-cover-icon"></i>
      <div class="stampbook-cover-title" style="font-size:1rem;">สะสมแสตมป์ต่อไปเรื่อยๆ</div>
      <div class="stampbook-cover-hint">เข้าร่วมกิจกรรมเพิ่มเพื่อเปิดหน้าใหม่ในสมุดของคุณ ✨</div>
    `;
    return;
  }

  if (page.type === 'empty') {
    headerEl.textContent = 'หน้า 1';
    container.className = 'stampbook-grid is-cover';
    container.innerHTML = `
      <i class="fa-solid fa-feather-pointed stampbook-cover-icon"></i>
      <div class="stampbook-cover-title" style="font-size:1rem;">ยังไม่มีแสตมป์</div>
      <div class="stampbook-cover-hint">เข้าร่วมกิจกรรมของบริษัทเพื่อเริ่มสะสมแสตมป์เวทมนตร์!</div>
    `;
    return;
  }

  headerEl.textContent = `หน้า ${page.pageNumber}`;
  container.className = 'stampbook-grid page-fade-in';
  let html = '';
  for (let i = 0; i < STAMPS_PER_BOOK_PAGE; i++) {
    const item = page.items[i];
    html += item ? stampCardHtml(item, i % 2 === 0 ? '' : 'tone-b') : emptyStampCardHtml();
  }
  container.innerHTML = html;
}

function stampCardHtml(item, tone) {
  const amount = item.StampAmount || 1;
  const activity = item.ActivityName || 'กิจกรรม';
  const date = item.DateTime;
  const icon = STAMP_IMAGE_DEFAULT;

  return `
    <div class="postage-stamp ${tone}">
      ${amount > 1 ? `<div class="postage-stamp-value">+${amount}</div>` : ''}
      <div class="postage-stamp-inner">
        <div class="postage-stamp-icon">
          <img src="${icon}" alt="stamp"
               onerror="this.replaceWith(Object.assign(document.createElement('i'), {className:'fa-solid fa-stamp', style:'font-size:0.9rem;color:var(--gold)'}))">
        </div>
        <div class="postage-stamp-caption" title="${escapeHtml(activity)}">${escapeHtml(activity)}</div>
        <div class="postage-stamp-date">${escapeHtml(displayDate(date))}</div>
      </div>
    </div>`;
}

function emptyStampCardHtml() {
  return `
    <div class="postage-stamp-empty">
      <i class="fa-regular fa-square"></i>
      <span>ว่าง</span>
    </div>`;
}

function goToSpread(delta) {
  if (isFlipping) return;
  const newIndex = spreadIndex + delta;
  if (newIndex < 0 || newIndex > totalSpreadsCache - 1) return;
  playPageFlip(delta > 0 ? 'next' : 'prev', newIndex);
}

function playPageFlip(direction, newIndex) {
  const spreadEl = document.querySelector('.stampbook-spread');
  if (!spreadEl || prefersReducedMotion()) {
    spreadIndex = newIndex;
    renderStampbook();
    return;
  }

  if (isMobileSingle()) {
    isFlipping = true;
    document.getElementById('prevPageBtn').disabled = true;
    document.getElementById('nextPageBtn').disabled = true;
    spreadEl.classList.add('is-page-fading');
    setTimeout(() => {
      spreadIndex = newIndex;
      isFlipping = false;
      renderStampbook();
      spreadEl.classList.remove('is-page-fading');
    }, 180);
    return;
  }

  const flippingPageEl = direction === 'next'
    ? document.querySelector('.stampbook-page-right')
    : document.querySelector('.stampbook-page-left');

  if (!flippingPageEl) {
    spreadIndex = newIndex;
    renderStampbook();
    return;
  }

  isFlipping = true;
  document.getElementById('prevPageBtn').disabled = true;
  document.getElementById('nextPageBtn').disabled = true;

  const frontHtml = flippingPageEl.innerHTML;
  const leafLeft = flippingPageEl.offsetLeft;
  const leafWidth = flippingPageEl.offsetWidth;
  spreadIndex = newIndex;
  renderStampbook();

  const backHtml = flippingPageEl.innerHTML;

  const overlay = document.createElement('div');
  overlay.className = `page-flip-overlay ${direction === 'next' ? 'flip-forward' : 'flip-backward'}`;
  overlay.style.left = leafLeft + 'px';
  overlay.style.width = leafWidth + 'px';
  overlay.style.transitionDuration = FLIP_DURATION_MS + 'ms';

  const front = document.createElement('div');
  front.className = 'page-flip-face page-flip-front';
  front.innerHTML = frontHtml;
  front.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));

  const back = document.createElement('div');
  back.className = 'page-flip-face page-flip-back';
  back.innerHTML = backHtml;
  back.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));

  overlay.appendChild(front);
  overlay.appendChild(back);
  spreadEl.appendChild(overlay);
  void overlay.offsetWidth;
  overlay.classList.add('is-flipping');

  let done = false;
  const cleanup = () => {
    if (done) return;
    done = true;
    overlay.remove();
    isFlipping = false;
    renderStampbook();
  };
  overlay.addEventListener('transitionend', (e) => {
    if (e.propertyName === 'transform') cleanup();
  });
  setTimeout(cleanup, FLIP_DURATION_MS + 150);
}

function openRedeemModal(rewardId) {
  const reward = rewardsCache.find(r => String(r.RewardID) === String(rewardId));
  if (!reward) return;

  const stamps = employeeCache ? (employeeCache.TotalStamps || 0) : 0;
  const cost = reward.RequiredStamps || 0;
  const qty = reward.RemainingQuantity || 0;

  pendingRewardId = rewardId;
  const body = document.getElementById('redeemModalBody');

  if (qty <= 0) {
    body.innerHTML = `<div class="alert alert-warning mb-0">รางวัลนี้หมดแล้ว!</div>`;
    document.getElementById('confirmRedeemBtn').disabled = true;
  } else if (stamps < cost) {
    body.innerHTML = `
      <div class="alert alert-warning mb-0">
        แสตมป์ของคุณไม่เพียงพอสำหรับรางวัลนี้
        (ต้องการ ${cost} มีอยู่ ${stamps})
      </div>
    `;
    document.getElementById('confirmRedeemBtn').disabled = true;
  } else {
    const name = reward.RewardName || 'รางวัล';
    body.innerHTML = `
      <div class="text-center mb-3">
        <div style="font-size:3rem; color:var(--primary-blue);">
          <img src="${resolveRewardImage(reward.RewardImage)}"
               style="width:80px;height:80px;object-fit:cover;border-radius:10px;"
               onerror="this.style.display='none'">
        </div>
        <h5>${escapeHtml(name)}</h5>
        <p class="text-muted-light">${escapeHtml(reward.Description || '')}</p>
      </div>
      <div class="alert alert-info">
        <i class="fa-regular fa-stamp"></i> ต้องใช้ ${cost} แสตมป์
      </div>
      <p class="small text-muted-light">
        คุณมี <strong>${stamps}</strong> แสตมป์
        (เหลือหลังแลก: <strong>${stamps - cost}</strong>)
      </p>
    `;
    document.getElementById('confirmRedeemBtn').disabled = false;
  }

  new bootstrap.Modal(document.getElementById('redeemModal')).show();
}

async function doRedeem() {
  if (!pendingRewardId) return;

  const modalEl = document.getElementById('redeemModal');
  const confirmBtn = document.getElementById('confirmRedeemBtn');
  if (confirmBtn) confirmBtn.disabled = true;
  showLoading('กำลังร่ายเวทมนตร์แลกรางวัล...');

  try {
    await API.redeemReward(session.employeeId, pendingRewardId);

    bootstrap.Modal.getInstance(modalEl).hide();
    await loadProfile();
    await loadRewards();
    await Promise.all([
      loadStampHistory(),
      loadRedemptionHistory(),
      loadDashboard()
    ]);

    showAlert('pageContent', 'แลกรางวัลสำเร็จ! 🎉 กรุณารอการอนุมัติจากฝ่าย HR', 'success');
  } catch (err) {
    bootstrap.Modal.getInstance(modalEl).hide();
    showAlert('pageContent', err.message || 'เกิดข้อผิดพลาดในการแลกรางวัล', 'danger');
  } finally {
    hideLoading();
    if (confirmBtn) confirmBtn.disabled = false;
    pendingRewardId = null;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  session = Session.requireEmployee();
  if (!session) return;

  document.getElementById('welcomeName').textContent = 'สวัสดี, ' + (session.name || 'พนักงาน');
  const field = document.getElementById('sparkleField');
  if (field) {
    for (let i = 0; i < 20; i++) {
      const s = document.createElement('div');
      s.className = 'sparkle';
      s.style.left = Math.random() * 100 + '%';
      s.style.top = Math.random() * 100 + '%';
      s.style.animationDelay = (Math.random() * 3) + 's';
      field.appendChild(s);
    }
  }

  showLoading('กำลังเปิดสมุดแสตมป์เวทมนตร์...');

  try {
    await loadProfile();
    await loadRewards();
    await Promise.all([
      loadStampHistory(),
      loadRedemptionHistory(),
      loadDashboard()
    ]);
  } catch (err) {
    console.error('Error loading data:', err);
    showAlert('pageContent', err.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล', 'danger');
  } finally {
    hideLoading();
  }

  document.getElementById('confirmRedeemBtn').addEventListener('click', doRedeem);
  document.getElementById('prevPageBtn').addEventListener('click', () => goToSpread(-1));
  document.getElementById('nextPageBtn').addEventListener('click', () => goToSpread(1));

  const leftPageEl = document.querySelector('.stampbook-page-left');
  const rightPageEl = document.querySelector('.stampbook-page-right');
  if (leftPageEl) {
    leftPageEl.addEventListener('click', (e) => {
      if (e.target.closest('button, a, .postage-stamp')) return;
      if (!isFlipping && spreadIndex > 0) goToSpread(-1);
    });
  }
  if (rightPageEl) {
    rightPageEl.addEventListener('click', (e) => {
      if (e.target.closest('button, a, .postage-stamp')) return;
      if (!isFlipping && spreadIndex < totalSpreadsCache - 1) goToSpread(1);
    });
  }

  updateStackedLayout();
  lastMobileSingleState = isMobileSingle();

  let resizeDebounce;
  window.addEventListener('resize', () => {
    updateStackedLayout();
    clearTimeout(resizeDebounce);
    resizeDebounce = setTimeout(() => {
      const nowSingle = isMobileSingle();
      if (nowSingle === lastMobileSingleState) return;
      spreadIndex = nowSingle ? spreadIndex * 2 : Math.floor(spreadIndex / 2);
      lastMobileSingleState = nowSingle;
      if (!isFlipping) renderStampbook();
    }, 150);
  });
});