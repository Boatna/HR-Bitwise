let hrSession;
let rewardsManageCache = [];
let grantEmployeePreviewData = null; // last employee fetched for the grant-stamp preview

const REWARD_IMAGE_FOLDER = 'images/rewards/';
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
  hrSession = Session.requireManager();
  if (!hrSession) return;

  document.getElementById('welcomeName').textContent = `${hrSession.name} (${hrSession.approverType})`;

  // Tabs
  document.querySelectorAll('#hrTabs .nav-link').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  showLoading('กำลังเปิดห้องควบคุมเวทมนตร์...');
  try {
    await Promise.all([loadHrDashboard(), loadRewardsManage(), loadRedemptions()]);
  } catch (err) {
    alert(err.message);
  } finally {
    hideLoading();
  }

  document.getElementById('grantStampForm').addEventListener('submit', submitGrantStamp);
  document.getElementById('searchBtn').addEventListener('click', doSearch);
  document.getElementById('searchInput').addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
  document.getElementById('saveRewardBtn').addEventListener('click', saveReward);

  document.getElementById('rewardImageField').addEventListener('input', updateRewardImagePreview);

  let debounce;
  document.getElementById('grantEmployeeId').addEventListener('input', (e) => {
    clearTimeout(debounce);
    const val = e.target.value.trim();
    const preview = document.getElementById('grantEmployeePreview');
    grantEmployeePreviewData = null;
    if (!val) { preview.textContent = ''; return; }
    preview.innerHTML = `<span class="text-muted-light"><i class="fa-solid fa-spinner fa-spin"></i> กำลังตรวจสอบ...</span>`;
    debounce = setTimeout(async () => {
      try {
        const emp = await API.getEmployee(val);
        grantEmployeePreviewData = emp;
        renderGrantPreview();
      } catch (err) {
        grantEmployeePreviewData = null;
        preview.innerHTML = `<span class="text-danger"><i class="fa-solid fa-circle-xmark"></i> ไม่พบพนักงาน</span>`;
      }
    }, 450);
  });

  // Live-update the "แต้มหลังบันทึก" figure whenever the stamp amount changes,
  // as long as we already have a confirmed employee loaded.
  document.getElementById('grantAmount').addEventListener('input', renderGrantPreview);

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

function renderGrantPreview() {
  const preview = document.getElementById('grantEmployeePreview');
  if (!grantEmployeePreviewData) return; // nothing confirmed yet — leave whatever message is already shown

  const emp = grantEmployeePreviewData;
  const amountRaw = document.getElementById('grantAmount').value;
  const amount = Number(amountRaw);
  const hasValidAmount = amountRaw !== '' && !isNaN(amount) && amount > 0;
  const current = Number(emp.TotalStamps) || 0;

  if (hasValidAmount) {
    const newTotal = current + amount;
    preview.innerHTML = `
      <span class="text-success">
        <i class="fa-solid fa-circle-check"></i> ${escapeHtml(emp.FullName)} — ${escapeHtml(emp.Department)}
      </span><br>
      <span class="text-muted-light">แสตมป์ปัจจุบัน: <strong>${current}</strong> ➜ หลังบันทึก: <strong class="text-success">${newTotal}</strong> (+${amount})</span>
    `;
  } else {
    preview.innerHTML = `<span class="text-success"><i class="fa-solid fa-circle-check"></i> ${escapeHtml(emp.FullName)} — ${escapeHtml(emp.Department)} (แสตมป์ปัจจุบัน: ${current})</span>`;
  }
}

function switchTab(tab) {
  document.querySelectorAll('#hrTabs .nav-link').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.add('d-none'));
  document.getElementById('tab-' + tab).classList.remove('d-none');
  if (tab === 'analytics') loadHrDashboard();
  if (tab === 'redemptions') loadRedemptions();
  if (tab === 'rewards') loadRewardsManage();
}

async function submitGrantStamp(e) {
  e.preventDefault();
  const payload = {
    employeeId: document.getElementById('grantEmployeeId').value.trim(),
    activityName: document.getElementById('grantActivity').value.trim(),
    stampAmount: Number(document.getElementById('grantAmount').value),
    remark: document.getElementById('grantRemark').value.trim(),
    grantedById: hrSession.managerId,
    grantedByName: hrSession.name
  };
  const submitBtn = document.querySelector('#grantStampForm button[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;
  showLoading('กำลังประทับตราเวทมนตร์...');
  try {
    await API.addStamp(payload);
    hideLoading();
    showAlert('grantAlertBox', `มอบแสตมป์ให้พนักงาน ${payload.employeeId} สำเร็จ!`, 'success');
    document.getElementById('grantStampForm').reset();
    document.getElementById('grantEmployeePreview').textContent = '';
    grantEmployeePreviewData = null;
    loadHrDashboard();
  } catch (err) {
    hideLoading();
    showAlert('grantAlertBox', err.message, 'danger');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

async function doSearch() {
  const q = document.getElementById('searchInput').value.trim();
  const body = document.getElementById('searchResultsBody');
  const searchBtn = document.getElementById('searchBtn');
  if (searchBtn) searchBtn.disabled = true;
  body.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-3">กำลังค้นหา...</td></tr>`;
  try {
    const results = await API.searchEmployees(q);
    if (!results || results.length === 0) {
      body.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-3">ไม่พบข้อมูล</td></tr>`;
      return;
    }
    body.innerHTML = results.map(r => `
      <tr>
        <td>${escapeHtml(r.EmployeeID)}</td>
        <td>${escapeHtml(r.FullName)}</td>
        <td>${escapeHtml(r.Department)}</td>
        <td>${escapeHtml(r.Position)}</td>
        <td><span class="fw-bold" style="color:var(--gold-light,var(--gold))">${r.TotalStamps}</span></td>
      </tr>`).join('');
  } catch (err) {
    body.innerHTML = `<tr><td colspan="5" class="text-center text-danger py-3">${escapeHtml(err.message)}</td></tr>`;
  } finally {
    if (searchBtn) searchBtn.disabled = false;
  }
}

async function loadRewardsManage() {
  const rewards = await API.getRewards();
  rewardsManageCache = rewards;
  const body = document.getElementById('rewardsManageBody');
  if (!rewards || rewards.length === 0) {
    body.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-3">ยังไม่มีรางวัล</td></tr>`;
    return;
  }
  body.innerHTML = rewards.map(r => `
    <tr>
      <td>
        <img src="${resolveRewardImage(r.RewardImage)}" alt="${escapeHtml(r.RewardName)}"
             style="width:44px;height:44px;object-fit:cover;border-radius:8px;"
             onerror="this.src='${REWARD_IMAGE_FOLDER}reward-placeholder.svg'">
      </td>
      <td>${escapeHtml(r.RewardName)}</td>
      <td>${r.RequiredStamps}</td>
      <td>${r.RemainingQuantity}</td>
      <td><span class="badge ${r.Status === 'Active' ? 'badge-status-active' : 'badge-status-rejected'}">${r.Status === 'Active' ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}</span></td>
      <td>
        <button class="btn btn-sm btn-purple" onclick="openRewardEditor('${r.RewardID}')"><i class="fa-solid fa-pen"></i></button>
        <button class="btn btn-sm btn-outline-danger" onclick="toggleRewardStatus('${r.RewardID}')"><i class="fa-solid fa-power-off"></i></button>
      </td>
    </tr>`).join('');
}

function openRewardEditor(rewardId) {
  const isEdit = !!rewardId;
  document.getElementById('rewardModalTitle').textContent = isEdit ? 'แก้ไขรางวัล' : 'เพิ่มรางวัลใหม่';
  document.getElementById('rewardForm').reset();
  document.getElementById('rewardIdField').value = rewardId || '';
  if (isEdit) {
    const r = rewardsManageCache.find(x => String(x.RewardID) === String(rewardId));
    if (r) {
      document.getElementById('rewardNameField').value = r.RewardName;
      document.getElementById('rewardDescField').value = r.Description || '';
      document.getElementById('rewardStampsField').value = r.RequiredStamps;
      document.getElementById('rewardQtyField').value = r.RemainingQuantity;
      document.getElementById('rewardImageField').value = r.RewardImage || '';
      document.getElementById('rewardStatusField').value = r.Status;
    }
  }
  updateRewardImagePreview();
  new bootstrap.Modal(document.getElementById('rewardModal')).show();
}

function updateRewardImagePreview() {
  const val = document.getElementById('rewardImageField').value.trim();
  const preview = document.getElementById('rewardImagePreview');
  if (!val) { preview.style.display = 'none'; return; }
  preview.src = resolveRewardImage(val);
  preview.style.display = 'inline-block';
  preview.onerror = () => { preview.style.display = 'none'; };
}

async function saveReward() {
  const rewardId = document.getElementById('rewardIdField').value;
  const payload = {
    rewardId: rewardId || null,
    rewardName: document.getElementById('rewardNameField').value.trim(),
    description: document.getElementById('rewardDescField').value.trim(),
    requiredStamps: Number(document.getElementById('rewardStampsField').value),
    remainingQuantity: Number(document.getElementById('rewardQtyField').value),
    rewardImage: document.getElementById('rewardImageField').value.trim(),
    status: document.getElementById('rewardStatusField').value
  };
  const saveBtn = document.getElementById('saveRewardBtn');
  if (saveBtn) saveBtn.disabled = true;
  showLoading('กำลังบันทึกรางวัล...');
  try {
    if (rewardId) { await API.updateReward(payload); } else { await API.createReward(payload); }
    bootstrap.Modal.getInstance(document.getElementById('rewardModal')).hide();
    await loadRewardsManage();
  } catch (err) {
    alert(err.message);
  } finally {
    hideLoading();
    if (saveBtn) saveBtn.disabled = false;
  }
}

async function toggleRewardStatus(rewardId) {
  if (!confirm('ต้องการเปลี่ยนสถานะรางวัลนี้ใช่หรือไม่?')) return;
  showLoading('กำลังอัปเดต...');
  try {
    await API.disableReward(rewardId);
    await loadRewardsManage();
  } catch (err) {
    alert(err.message);
  } finally {
    hideLoading();
  }
}

async function loadRedemptions() {
  const list = await API.getAllRedemptions();
  const body = document.getElementById('redemptionsBody');
  if (!list || list.length === 0) {
    body.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-3">ยังไม่มีคำขอแลกรางวัล</td></tr>`;
    return;
  }
  const statusClass = s => s === 'Approved' ? 'badge-status-active' : (s === 'Rejected' ? 'badge-status-rejected' : 'badge-status-pending');
  const statusLabel = s => s === 'Approved' ? 'อนุมัติแล้ว' : (s === 'Rejected' ? 'ถูกปฏิเสธ' : 'รอดำเนินการ');
  body.innerHTML = list.map(r => `
    <tr>
      <td>${escapeHtml(r.EmployeeName)} <span class="text-muted small">(${escapeHtml(r.EmployeeID)})</span></td>
      <td>${escapeHtml(r.RewardName)}</td>
      <td>${escapeHtml(r.RedemptionDate)}</td>
      <td>${r.UsedStamps}</td>
      <td><span class="badge ${statusClass(r.ApprovalStatus)}">${statusLabel(r.ApprovalStatus)}</span></td>
      <td>
        ${r.ApprovalStatus === 'Pending' ? `
          <button class="btn btn-sm btn-magic-gold" onclick="decideRedemption('${r.RedemptionID}','Approved')"><i class="fa-solid fa-check"></i></button>
          <button class="btn btn-sm btn-outline-danger" onclick="decideRedemption('${r.RedemptionID}','Rejected')"><i class="fa-solid fa-xmark"></i></button>
        ` : '<span class="text-muted small">—</span>'}
      </td>
    </tr>`).join('');
}

async function decideRedemption(redemptionId, status) {
  showLoading('กำลังบันทึกผลการพิจารณา...');
  try {
    await API.approveRedemption(redemptionId, hrSession.name, status);
    await loadRedemptions();
  } catch (err) {
    alert(err.message);
  } finally {
    hideLoading();
  }
}

async function loadHrDashboard() {
  const stats = await API.getHrDashboard();
  document.getElementById('statTotalEmployees').textContent = stats.totalEmployees;
  document.getElementById('statTotalIssued').textContent = stats.totalStampsIssued;
  document.getElementById('statTotalRedemptions').textContent = stats.totalRedemptions;
  document.getElementById('statPendingRedemptions').textContent = stats.pendingRedemptions;

  document.getElementById('topEmployeesList').innerHTML = (stats.topEmployees || [])
    .map(e => `<li>${escapeHtml(e.name)} — <strong>${e.stamps}</strong> แสตมป์</li>`).join('') || '<li class="text-muted">ยังไม่มีข้อมูล</li>';

  document.getElementById('topRewardsList').innerHTML = (stats.topRewards || [])
    .map(r => `<li>${escapeHtml(r.name)} — แลกแล้ว <strong>${r.count}</strong> ครั้ง</li>`).join('') || '<li class="text-muted">ยังไม่มีข้อมูล</li>';

  document.getElementById('monthlySummaryBody').innerHTML = (stats.monthlySummary || [])
    .map(m => `<tr><td>${escapeHtml(m.month)}</td><td>${m.stamps}</td><td>${m.activities}</td></tr>`).join('')
    || '<tr><td colspan="3" class="text-center text-muted">ยังไม่มีข้อมูล</td></tr>';
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}