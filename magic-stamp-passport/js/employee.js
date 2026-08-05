const LEVELS = [
  { name: 'Explorer',   th: 'อ่อนวะ',      min: 0,   icon: 'fa-compass' },
  { name: 'Dreamer',    th: 'ใช้ได้',         min: 10,  icon: 'fa-cloud-moon' },
  { name: 'Adventurer', th: 'กลางๆ',      min: 25,  icon: 'fa-map' },
  { name: 'Hero',       th: 'วีรบุรุษ',        min: 50,  icon: 'fa-shield-heart' },
  { name: 'Legend',     th: 'ตำนาน',          min: 100, icon: 'fa-crown' }
];

function getLevelInfo(stamps) {
  let current = LEVELS[0];
  let next = LEVELS[1] || null;
  for (let i = 0; i < LEVELS.length; i++) {
    if (stamps >= LEVELS[i].min) {
      current = LEVELS[i];
      next = LEVELS[i + 1] || null;
    }
  }
  return { current, next };
}

let session;
let rewardsCache = [];
let employeeCache = null;

const REWARD_IMAGE_FOLDER = 'images/rewards/';
const STAMP_IMAGE_DEFAULT = 'images/stamps/stamp-default.svg';

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

document.addEventListener('DOMContentLoaded', async () => {
  session = Session.requireEmployee();
  if (!session) return;

  document.getElementById('welcomeName').textContent = 'สวัสดี, ' + session.name;

  showLoading('กำลังเปิดสมุดแสตมป์เวทมนตร์...');
  try {
    await loadRewards();
    await loadProfile();
    await Promise.all([loadHistory(), loadRedemptionHistory(), loadDashboard()]);
  } catch (err) {
    showAlert('pageContent', err.message, 'danger');
  } finally {
    hideLoading();
  }

  document.getElementById('confirmRedeemBtn').addEventListener('click', doRedeem);
  document.getElementById('prevPageBtn').addEventListener('click', () => {
    if (spreadIndex > 0) { spreadIndex--; renderStampbook(); }
  });
  document.getElementById('nextPageBtn').addEventListener('click', () => {
    if (spreadIndex < totalSpreadsCache - 1) { spreadIndex++; renderStampbook(); }
  });

  const field = document.getElementById('sparkleField');
  for (let i = 0; i < 20; i++) {
    const s = document.createElement('div');
    s.className = 'sparkle';
    s.style.left = Math.random() * 100 + '%';
    s.style.top = Math.random() * 100 + '%';
    s.style.animationDelay = (Math.random() * 3) + 's';
    field.appendChild(s);
  }
});

async function loadProfile() {
  const emp = await API.getEmployee(session.employeeId);
  employeeCache = emp;
  document.getElementById('empName').textContent = emp.FullName;
  document.getElementById('empMeta').textContent = `${emp.Position} · ${emp.Department}`;

  const stamps = emp.TotalStamps || 0;
  document.getElementById('stampCount').textContent = stamps;

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

// ---- Stamp collection album: a real book with front cover, numbered pages
// (6 stamps each), and a back cover — flipped through two pages at a time.
const STAMPS_PER_BOOK_PAGE = 6;

let stampHistoryCache = [];
let stampbookPages = [];   // [{type:'cover'}, {type:'stamps', pageNumber, items}, ..., {type:'back'}]
let spreadIndex = 0;       // which left/right spread is currently shown
let totalSpreadsCache = 1;

async function loadHistory() {
  const history = await API.getStampHistory(session.employeeId);
  // The album only shows stamps actually earned — redemption/refund entries
  // are logged with negative amounts server-side to keep the balance
  // accurate, but they belong in "ประวัติการแลกรางวัล", not the collection.
  stampHistoryCache = (history || []).filter(h => Number(h.StampAmount) > 0);
  spreadIndex = 0;
  renderStampbook();
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
  const leftEl = document.getElementById('stampPageLeft');
  const rightEl = document.getElementById('stampPageRight');
  const leftHeader = document.getElementById('stampPageLeftHeader');
  const rightHeader = document.getElementById('stampPageRightHeader');
  const indicatorEl = document.getElementById('pageIndicator');
  const prevBtn = document.getElementById('prevPageBtn');
  const nextBtn = document.getElementById('nextPageBtn');

  stampbookPages = buildStampbookPages();
  totalSpreadsCache = Math.ceil(stampbookPages.length / 2);
  spreadIndex = Math.min(Math.max(spreadIndex, 0), totalSpreadsCache - 1);

  const leftPage = stampbookPages[spreadIndex * 2];
  const rightPage = stampbookPages[spreadIndex * 2 + 1];

  renderBookPage(leftEl, leftHeader, leftPage);
  renderBookPage(rightEl, rightHeader, rightPage);

  indicatorEl.textContent = `แผ่นที่ ${spreadIndex + 1} / ${totalSpreadsCache}`;
  prevBtn.disabled = spreadIndex === 0;
  nextBtn.disabled = spreadIndex >= totalSpreadsCache - 1;
}

function renderBookPage(container, headerEl, page) {
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
    const name = employeeCache ? employeeCache.FullName : '';
    container.innerHTML = `
      <i class="fa-solid fa-book-bookmark stampbook-cover-icon"></i>
      <div class="stampbook-cover-title">สมุดสะสมแสตมป์</div>
      <div class="stampbook-cover-name">${escapeHtml(name)}</div>
      <div class="stampbook-cover-count"><i class="fa-solid fa-stamp"></i> ${stamps} แสตมป์สะสม</div>
      <div class="stampbook-cover-hint">พลิกดูแสตมป์ทั้งหมดที่สะสมไว้ →</div>`;
    return;
  }

  if (page.type === 'back') {
    headerEl.textContent = 'ปกหลัง';
    container.className = 'stampbook-grid is-cover';
    container.innerHTML = `
      <i class="fa-solid fa-wand-magic-sparkles stampbook-cover-icon"></i>
      <div class="stampbook-cover-title" style="font-size:1rem;">สะสมแสตมป์ต่อไปเรื่อยๆ</div>
      <div class="stampbook-cover-hint">เข้าร่วมกิจกรรมเพิ่มเพื่อเปิดหน้าใหม่ในสมุดของคุณ ✨</div>`;
    return;
  }

  if (page.type === 'empty') {
    headerEl.textContent = 'หน้า 1';
    container.className = 'stampbook-grid is-cover';
    container.innerHTML = `
      <i class="fa-solid fa-feather-pointed stampbook-cover-icon"></i>
      <div class="stampbook-cover-title" style="font-size:1rem;">ยังไม่มีแสตมป์</div>
      <div class="stampbook-cover-hint">เข้าร่วมกิจกรรมของบริษัทเพื่อเริ่มสะสมแสตมป์เวทมนตร์!</div>`;
    return;
  }

  // page.type === 'stamps'
  headerEl.textContent = `หน้า ${page.pageNumber}`;
  container.className = 'stampbook-grid';
  let html = '';
  for (let i = 0; i < STAMPS_PER_BOOK_PAGE; i++) {
    const item = page.items[i];
    html += item ? stampCardHtml(item, i % 2 === 0 ? '' : 'tone-b') : emptyStampCardHtml();
  }
  container.innerHTML = html;
}

function stampCardHtml(item, tone) {
  return `
    <div class="postage-stamp ${tone}">
      <div class="postage-stamp-value">+${item.StampAmount}</div>
      <div class="postage-stamp-inner">
        <div class="postage-stamp-icon">
          <img src="${STAMP_IMAGE_DEFAULT}" alt="stamp"
               onerror="this.replaceWith(Object.assign(document.createElement('i'), {className:'fa-solid fa-stamp', style:'font-size:0.9rem;color:var(--gold)'}))">
        </div>
        <div class="postage-stamp-caption" title="${escapeHtml(item.ActivityName)}">${escapeHtml(item.ActivityName)}</div>
        <div class="postage-stamp-date">${escapeHtml(item.DateTime)}</div>
      </div>
    </div>`;
}

function emptyStampCardHtml() {
  return `
    <div class="postage-stamp-empty">
      <i class="fa-solid fa-stamp"></i>
      <span>ว่าง</span>
    </div>`;
}

async function loadRedemptionHistory() {
  const list = await API.getRedemptionHistory(session.employeeId);
  const box = document.getElementById('redemptionHistoryList');
  if (!list || list.length === 0) {
    box.innerHTML = `<div class="text-center text-muted py-4">ยังไม่มีการแลกรางวัล</div>`;
    return;
  }
  const statusClass = s => s === 'Approved' ? 'badge-status-active' : (s === 'Rejected' ? 'badge-status-rejected' : 'badge-status-pending');
  const statusLabel = s => s === 'Approved' ? 'อนุมัติแล้ว' : (s === 'Rejected' ? 'ถูกปฏิเสธ' : 'รอดำเนินการ');
  box.innerHTML = list.map(r => {
    const reward = rewardsCache.find(x => String(x.RewardID) === String(r.RewardID));
    const imgSrc = resolveRewardImage(reward ? reward.RewardImage : '');
    return `
    <div class="stamp-row">
      <div class="stamp-icon">
        <img src="${imgSrc}" alt="reward" onerror="this.src='${REWARD_IMAGE_FOLDER}reward-placeholder.svg'">
      </div>
      <div class="flex-grow-1">
        <div class="fw-bold" style="color:var(--royal-blue)">${escapeHtml(r.RewardName)}</div>
        <div class="small text-muted">${escapeHtml(r.RedemptionDate)}</div>
      </div>
      <span class="badge ${statusClass(r.ApprovalStatus)}">${statusLabel(r.ApprovalStatus)}</span>
    </div>
  `;
  }).join('');
}

async function loadRewards() {
  const rewards = await API.getRewards();
  rewardsCache = rewards;
  const grid = document.getElementById('rewardsGrid');
  const active = rewards.filter(r => r.Status === 'Active');
  if (active.length === 0) {
    grid.innerHTML = `<div class="text-center text-muted py-4 w-100">ยังไม่มีรางวัลในขณะนี้</div>`;
    return;
  }
  grid.innerHTML = active.map(r => `
    <div class="col-sm-6 col-lg-4">
      <div class="reward-card">
        <div class="reward-image">
          <img src="${resolveRewardImage(r.RewardImage)}" alt="${escapeHtml(r.RewardName)}"
               onerror="this.src='${REWARD_IMAGE_FOLDER}reward-placeholder.svg'">
        </div>
        <div class="reward-body">
          <h5 class="font-heading" style="color:var(--royal-blue)">${escapeHtml(r.RewardName)}</h5>
          <p class="small text-muted flex-grow-1">${escapeHtml(r.Description || '')}</p>
          <div class="d-flex justify-content-between align-items-center mb-2">
            <span class="reward-req"><i class="fa-solid fa-stamp"></i> ${r.RequiredStamps} แสตมป์</span>
            <span class="small text-muted">เหลือ ${r.RemainingQuantity} ชิ้น</span>
          </div>
          <button class="btn btn-magic-gold w-100" onclick="openRedeemModal('${r.RewardID}')"
            ${r.RemainingQuantity <= 0 ? 'disabled' : ''}>
            ${r.RemainingQuantity <= 0 ? 'ของหมด' : 'แลกรางวัลนี้'}
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

async function loadDashboard() {
  const stats = await API.getEmployeeDashboard(session.employeeId);
  document.getElementById('statTotalStamps').textContent = stats.totalStamps;
  document.getElementById('statActivities').textContent = stats.totalActivities;
  document.getElementById('statRedeemed').textContent = stats.totalRedeemed;
}

let pendingRewardId = null;
function openRedeemModal(rewardId) {
  const reward = rewardsCache.find(r => String(r.RewardID) === String(rewardId));
  if (!reward) return;
  const stamps = employeeCache ? (employeeCache.TotalStamps || 0) : 0;

  pendingRewardId = rewardId;
  const body = document.getElementById('redeemModalBody');
  if (stamps < reward.RequiredStamps) {
    body.innerHTML = `<div class="alert alert-warning mb-0">แสตมป์ของคุณไม่เพียงพอสำหรับรางวัลนี้ (ต้องการ ${reward.RequiredStamps} มีอยู่ ${stamps})</div>`;
    document.getElementById('confirmRedeemBtn').disabled = true;
  } else {
    body.innerHTML = `
      <p>คุณต้องการแลก <strong>${escapeHtml(reward.RewardName)}</strong> ด้วย <strong>${reward.RequiredStamps}</strong> แสตมป์ใช่หรือไม่?</p>
      <p class="text-muted small mb-0">แสตมป์คงเหลือหลังแลก: ${stamps - reward.RequiredStamps}</p>`;
    document.getElementById('confirmRedeemBtn').disabled = false;
  }
  new bootstrap.Modal(document.getElementById('redeemModal')).show();
}

async function doRedeem() {
  if (!pendingRewardId) return;
  const modalEl = document.getElementById('redeemModal');
  showLoading('กำลังร่ายเวทมนตร์แลกรางวัล...');
  try {
    await API.redeemReward(session.employeeId, pendingRewardId);
    bootstrap.Modal.getInstance(modalEl).hide();
    await loadProfile();
    await Promise.all([loadRewards(), loadRedemptionHistory(), loadDashboard()]);
    renderStampbook(); // refresh cover's stamp count with the new balance
    showAlert('pageContent', 'แลกรางวัลสำเร็จ! กรุณารอการอนุมัติจากฝ่าย HR', 'success');
  } catch (err) {
    bootstrap.Modal.getInstance(modalEl).hide();
    showAlert('pageContent', err.message, 'danger');
  } finally {
    hideLoading();
  }
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}