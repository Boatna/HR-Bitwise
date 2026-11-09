const API_URL = 'https://script.google.com/macros/s/AKfycbzxFxslas66892BMR5hGj6TxttQ_4QeTVEVpC-VSCZfqrp33B0I6RdNZpuyR6Z_JeRe/exec';
const API_TIMEOUT_MS = 30000;
const TIMEZONE = 'Asia/Bangkok';
const ASSET_DIR = 'asset/';
const SIM_ENABLED = new URLSearchParams(location.search).has('sim');

let TOKEN = sessionStorage.getItem('fl_token') || '';
let USER_NAME = sessionStorage.getItem('fl_user_name') || '';
let USER_ID = sessionStorage.getItem('fl_user_id') || '';
let USER_DEPT = sessionStorage.getItem('fl_user_dept') || '';

let FORM = null;
let formLoading = false;
const CUR = { forklift: null, elec: false, kind: 'engine', items: [], clean: [] };

let res = {};
let ngd = {};
let cres = {};
let submitId = '';
let autoNextTimer = null;

let pin = '';
let PEOPLE = [];
let loginBusy = false;
let namesLoading = false;

let curFocusIdx = 0;

const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const stripNo = t => String(t == null ? '' : t).replace(/^\s*\d+\s*[.)]\s*/, '');
const typeInfo = m => {
  if (!m) return { group: 'engine', subtype: 'diesel', icon: '🚜', badge: 'badge-other', label: '' };
  const vt = String(m.vehicleType || '').trim();
  const label = vt || String(m.model || '').trim() || String(m.label || '').trim();
  if (m.group) {
    return {
      group: m.group,
      subtype: m.subtype || (m.group === 'electric' ? 'reach_truck' : 'diesel'),
      icon: m.icon || '🚜',
      badge: m.badge || 'badge-other',
      label
    };
  }

  const combined = (vt + ' ' + (m.model || '') + ' ' + (m.name || '')).toLowerCase();
  if (/walkie|stacker|สแต็กเกอร์|วอล์คกี้/i.test(combined)) {
    return { group: 'electric', subtype: 'walkie_stacker', icon: '⚡', badge: 'badge-walkie', label: label || 'Walkie Stacker (ไฟฟ้า)' };
  }
  if (/reach|รีช/i.test(combined)) {
    return { group: 'electric', subtype: 'reach_truck', icon: '⚡', badge: 'badge-reach', label: label || 'Reach Truck (ไฟฟ้า)' };
  }
  return /ไฟฟ้า|electric/i.test(combined)
    ? { group: 'electric', subtype: 'reach_truck', icon: '⚡', badge: 'badge-elec', label }
    : { group: 'engine', subtype: 'diesel', icon: '⛽', badge: 'badge-gas', label };
};
const forkliftKind = m => typeInfo(m).group;
const model3dOf = m => {
  if (!m) return 'diesel';
  const ki = typeInfo(m);
  if (m.model3d) return m.model3d;
  if (ki.subtype === 'walkie_stacker') return 'walkie_stacker';
  if (ki.group === 'electric') {
    const txt = ((m.vehicleType || '') + ' ' + (m.model || '') + ' ' + (m.name || '')).toLowerCase();
    return (ki.subtype === 'reach_truck' && /reach|รีช/.test(txt)) ? 'reach_truck' : 'electric_cb';
  }
  return ki.subtype || 'diesel';
};
const isElecForklift = m => forkliftKind(m) === 'electric';
const newSubmitId = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2);

function toast(m, ms) {
  const t = $('toast');
  if (!t) return;
  t.textContent = m;
  t.classList.remove('hide');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.add('hide'), ms || 2800);
}

function setApiStatus(isOnline, note) {
  const dot = $('apiDot'), txt = $('apiStatusText');
  if (!dot || !txt) return;
  dot.className = 'status-dot ' + (isOnline ? '' : 'offline');
  window._apiState = isOnline;
  txt.textContent = note || _t(isOnline ? 'apiOnline' : 'apiOffline');
}

function getBangkokWeekday(date = new Date()) {
  return new Intl.DateTimeFormat('en-US', { timeZone: TIMEZONE, weekday: 'short' }).format(date);
}
const isMondayCleaningDay = () => window._simMonday === true || getBangkokWeekday() === 'Mon';

function toggleSimMonday() {
  window._simMonday = !window._simMonday;
  toast(_t(window._simMonday ? 'simOn' : 'simOff'));
  renderFocusView();
}
const simButtonHtml = css => SIM_ENABLED
  ? `<button type="button" class="btn alt" style="${css}" onclick="toggleSimMonday()">${_t(window._simMonday ? 'simBtnOn' : 'simBtnOff')}</button>`
  : '';

async function api(method, action, payload = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), API_TIMEOUT_MS);
  try {
    const r = method === 'GET'
      ? await fetch(`${API_URL}?${new URLSearchParams({ action, ...payload })}`, { redirect: 'follow', signal: ctrl.signal })
      : await fetch(API_URL, {
          method: 'POST',
          body: JSON.stringify({ action, ...payload }),
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          redirect: 'follow',
          signal: ctrl.signal
        });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const json = await r.json();
    setApiStatus(true);
    if (json && json.code === 'AUTH') handleSessionExpired();
    return json || { ok: false, error: _t('errNoResp') };
  } catch (err) {
    console.warn('API failed:', action, err);
    setApiStatus(false);
    return {
      ok: false,
      network: true,
      error: err.name === 'AbortError'
        ? _t('errTimeout')
        : _t('errNetwork')
    };
  } finally {
    clearTimeout(timer);
  }
}
const apiGet = (action, params) => api('GET', action, params);
const apiPost = (action, payload) => api('POST', action, payload);

function handleSessionExpired() {
  if (!TOKEN) return;
  toast(_t('sessionExpired'), 4500);
  doLogout(false);
}

function loginMsg(text, isError) {
  const el = $('loginErr');
  el.style.color = isError ? 'var(--ng)' : 'var(--navy)';
  el.textContent = text || '';
}

function drawDots() {
  $('dots').innerHTML = [0, 1, 2, 3].map(i => `<i class="${i < pin.length ? 'on' : ''}"></i>`).join('');
}

function pressKey(k) {
  if (loginBusy) return;
  if (k === '⌫') pin = pin.slice(0, -1);
  else if (k === '✓') return doLogin();
  else if (pin.length < 4) pin += k;
  else return;
  drawDots();
  if (pin.length === 4 && k !== '⌫') doLogin();
}

function buildKeys() {
  $('keys').innerHTML = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✓']
    .map(k => `<button type="button" data-k="${k}" class="${k === '✓' ? 'go' : ''}">${k}</button>`)
    .join('');
}

async function loadNames() {
  if (namesLoading) return;
  namesLoading = true;
  $('selName').innerHTML = '<option value="">' + _t('namesLoadingOpt') + '</option>';
  const r = await apiGet('getLoginData');
  namesLoading = false;

  if (!(r.ok && Array.isArray(r.data) && r.data.length)) {
    PEOPLE = [];
    $('selName').innerHTML = '<option value="">' + _t('namesFailOpt') + '</option>';
    loginMsg(_tr(r.error || _t('namesNone')), true);
    return;
  }

  loginMsg('');
  PEOPLE = r.data;
  renderDeptOptions();
  fillNames();
}

function fillNames() {
  const d = ($('selDept').value || '').trim();
  const keepName = $('selName').value;
  $('selName').innerHTML = '<option value="">' + _t('pickName') + '</option>' +
    PEOPLE.filter(p => !d || (p.dept || '').trim() === d)
      .map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
  if (keepName && [...$('selName').options].some(o => o.value === keepName)) {
    $('selName').value = keepName;
  } else {
    $('selName').value = '';
  }
}

async function doLogin() {
  if (loginBusy) return;
  const empId = $('selName').value;
  if (!empId) return loginMsg(_t('pickNameErr'), true);
  if (pin.length < 4) return loginMsg(_t('pinLenErr'), true);

  loginBusy = true;
  loginMsg(_t('checking'));
  const r = await apiPost('login', { empId, pin });
  loginBusy = false;

  if (r.ok) {
    TOKEN = r.token;
    USER_NAME = r.name;
    USER_ID = r.id || empId;
    USER_DEPT = r.dept || $('selDept').value || '';
    loginMsg('');
    finishLogin();
    return;
  }
  loginMsg(_tr(r.msg || r.error || _t('pinWrong')), true);
  pin = '';
  drawDots();
}

function finishLogin() {
  sessionStorage.setItem('fl_token', TOKEN);
  sessionStorage.setItem('fl_user_name', USER_NAME);
  sessionStorage.setItem('fl_user_id', USER_ID);
  sessionStorage.setItem('fl_user_dept', USER_DEPT);
  FORM = null;
  pin = '';
  drawDots();
  enter();
  syncOfflineQueue();
}

function doLogout(callServer = true) {
  if (callServer && TOKEN) apiPost('logout', { token: TOKEN });
  TOKEN = USER_NAME = USER_ID = USER_DEPT = '';
  FORM = null;
  setCurrent(null);
  resetInspection();
  ['fl_token', 'fl_user_name', 'fl_user_id', 'fl_user_dept'].forEach(k => sessionStorage.removeItem(k));
  pin = '';
  drawDots();
  show('login');
}

function enter() {
  $('whoName').textContent = USER_NAME;
  $('av').textContent = USER_NAME.charAt(0);
  show('form');
}

function show(v) {
  ['Login', 'Form', 'Dash'].forEach(x => {
    const el = $('v' + x);
    if (el) el.classList.toggle('hide', x.toLowerCase() !== v);
  });
  $('top').classList.toggle('hide', v === 'login');
  $('nForm').classList.toggle('on', v === 'form');
  $('nDash').classList.toggle('on', v === 'dash');

  if (v === 'login') loadNames();
  if (v === 'form') loadForm();
  if (v === 'dash') loadDash();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setCurrent(m) {
  CUR.forklift = m || null;
  CUR.elec = isElecForklift(m);
  CUR.kind = forkliftKind(m);
  CUR.items = m && FORM ? FORM.items.filter(i => i.forkliftId === m.id).map(i => ({ ...i, point: stripNo(i.point) })) : [];
  CUR.clean = m && FORM ? FORM.clean.filter(c => c.forkliftId === m.id) : [];
}
const getCurItems = () => CUR.items;
const isCurElectric = () => CUR.elec;

function cleanMatches(item, c) {
  const point = (item.point || '').toLowerCase();
  const text = ((c.area || '') + ' ' + (c.task || '')).toLowerCase();
  if (/ล้อ|ยาง/.test(point) && /ล้อ|เพลา/.test(text)) return true;
  if (/เสา|งา|โซ่|ไฮดรอลิค|ไฮดรอลิก/.test(point) && /เสา|ชุดยก/.test(text)) return true;
  if (/หม้อพักน้ำ|น้ำมันเครื่อง|เครื่องยนต์/.test(point) && /ระบายความร้อน|เครื่องยนต์/.test(text)) return true;
  if (/แบตเตอร์รี่|ปลั๊กชาร์จ|น้ำกลั่น/.test(point) && /แบตเตอรี่|ความปลอดภัยก่อนเริ่ม/.test(text)) return true;
  if (/พวงมาลัย|เบรค|กระจก|เข็มขัด|ไฟ|แตร|คันบังคับ/.test(point) && /ห้องคนขับ|เบาะนั่ง/.test(text)) return true;
  return false;
}

function getCleaningForPoint(item) {
  const list = CUR.clean, items = CUR.items;
  if (!list.length) return [];
  let out = list.filter(c => cleanMatches(item, c));
  if (item === items[items.length - 1]) {
    const orphan = list.filter(c => !items.some(it => cleanMatches(it, c)) && !out.includes(c));
    out = out.concat(orphan);
  }
  return out;
}

function resetInspection() {
  clearTimeout(autoNextTimer);
  res = {};
  ngd = {};
  cres = {};
  submitId = '';
  curFocusIdx = 0;
  if ($('note')) $('note').value = '';
}

function showFormError(msg) {
  $('minfo').innerHTML = `<div style="color:var(--ng); font-weight:600; margin-bottom:8px;">⚠️ ${esc(_tr(msg))}</div>` +
    '<button type="button" class="btn alt" onclick="retryLoadForm()">' + _t('retry') + '</button>';
  $('btnSave').disabled = true;
}

function retryLoadForm() {
  FORM = null;
  loadForm();
}

async function loadForm() {
  if (FORM || formLoading) return;
  formLoading = true;
  $('minfo').innerHTML = '<span style="color:var(--mute); font-size:13.5px;">' + _t('formLoading') + '</span>';
  try {
    const r = await apiPost('getFormData', { token: TOKEN });
    if (!(r.ok && r.data)) {
      if (r.code !== 'AUTH') showFormError(r.error || _t('formLoadFail'));
      return;
    }
    FORM = r.data;
    FORM.forklifts = FORM.forklifts || [];
    FORM.items = FORM.items || [];
    FORM.clean = FORM.clean || [];
    updateFormDeptFilter();
    populateForkliftSelect();
  } catch (err) {
    console.error(err);
    showFormError(_t('formLoadErr'));
  } finally {
    formLoading = false;
  }
}

function updateFormDeptFilter() {
  const depts = [...new Set(FORM.forklifts.map(m => (m.dept || '').trim()).filter(Boolean))].sort();
  const sel = $('selFormDept');
  sel.innerHTML = '<option value="">' + _t('allDeptsShow') + '</option>' +
    depts.map(d => `<option value="${esc(d)}">${esc(_tr(d))}</option>`).join('');
  const mine = depts.find(d => d.toLowerCase() === (USER_DEPT || '').trim().toLowerCase());
  const mineHasForklifts = mine && FORM.forklifts.some(m => (m.dept || '').trim().toLowerCase() === mine.toLowerCase());
  sel.value = mineHasForklifts ? mine : '';
}

function populateForkliftSelect() {
  if (!FORM) return;
  const dept = $('selFormDept').value.trim().toLowerCase();
  const list = dept ? FORM.forklifts.filter(m => (m.dept || '').trim().toLowerCase() === dept) : FORM.forklifts;

  if (!list.length) {
    $('selForklift').innerHTML = '<option value="">' + _t('noForkliftOpt') + '</option>';
    $('minfo').innerHTML = '<span style="color:var(--mute); font-size:13.5px;">' + _t('noForkliftInfo') + '</span>';
    ['boxFocusView', 'plist'].forEach(id => { $(id).innerHTML = ''; });
    setCurrent(null);
    resetInspection();
    $('cnt').textContent = _t('cntFmt', { a: 0, b: 0 });
    $('pg').style.width = '0%';
    $('btnSave').disabled = true;
    return;
  }

  $('btnSave').disabled = false;
  $('selForklift').innerHTML = list.map(m =>
    `<option value="${esc(m.id)}">${esc(forkliftLabel(m))}</option>`
  ).join('');
  pickForklift();
}

function pickForklift() {
  const m = FORM && FORM.forklifts.find(x => x.id === $('selForklift').value);
  resetInspection();
  setCurrent(m);
  if (!m) return;

  renderMinfo(m);

  renderForklift3D(m, CUR.elec);
  if (!V3.inited) showPartViewer(curFocusIdx);
  renderAll();
}

function renderAll() {
  updateProgress();
  renderFocusView();
  $('btnSave').disabled = !CUR.items.length;
}

function refreshViews() {
  updateProgress();
  renderFocusView();
}

function updateProgress() {
  const total = CUR.items.length;
  const checked = CUR.items.filter(i => res[i.id]).length;
  $('cnt').textContent = _t('cntFmt', { a: checked, b: total });
  $('pg').style.width = (total ? (checked / total) * 100 : 0) + '%';
}

function renderFocusView() {
  const its = CUR.items;
  if (!its.length) {
    $('boxFocusView').innerHTML = '<p class="hint" style="padding:10px 0;">' + _t('noChecklist') + '</p>';
    drawPlist();
    return;
  }
  curFocusIdx = Math.max(0, Math.min(curFocusIdx, its.length - 1));

  const item = its[curFocusIdx];
  const curStatus = res[item.id] || '';
  const relCleans = getCleaningForPoint(item);

  const statusBadge = curStatus === 'OK'
    ? '<span class="plist-status OK">' + _t('stOkFull') + '</span>'
    : curStatus === 'NG'
      ? '<span class="plist-status NG">' + _t('stNgFull') + '</span>'
      : '<span class="plist-status pend">' + _t('stPend') + '</span>';

  const cleanHtml = relCleans.map(c => `
    <label style="display:flex; align-items:flex-start; gap:10px; margin-top:8px; cursor:pointer;">
      <input type="checkbox" data-fc="${esc(c.id)}" ${cres[c.id] ? 'checked' : ''} style="width:19px; height:19px; accent-color:var(--orange); margin-top:3px; flex:none;">
      <span style="font-size:13.5px;">
        <b>${esc(_tr(c.area))}: ${esc(_tr(c.task))}</b>
        ${c.method ? `<span class="t" style="display:block; font-size:12px; color:var(--mute); margin-top:2px;">${esc(_t('cleanHow'))}: ${esc(_tr(c.method))}${c.tool ? ' · ' + esc(_t('cleanTool')) + ': ' + esc(_tr(c.tool)) : ''}</span>` : ''}
      </span>
    </label>`).join('');

  let cleanBlock = '';
  if (isMondayCleaningDay()) {
    if (relCleans.length) {
      cleanBlock = `
        <div class="focus-clean-card">
          <div class="focus-clean-title">
            <span>${_t('cleanTitle')}</span>
            <span style="font-size:12px; font-weight:normal; color:#ea580c; margin-left:auto;">${_t('cleanMon')}</span>
          </div>
          ${cleanHtml}
        </div>`;
    }
  } else {
    cleanBlock = `
      <div style="background:#f8fafc; border:1.5px dashed var(--line); border-radius:10px; padding:10px 14px; margin-top:14px; font-size:13px; color:var(--mute); display:flex; justify-content:space-between; align-items:center; gap:8px;">
        <span>${_t('cleanOff')}</span>
        ${simButtonHtml('padding:3px 9px; font-size:11.5px;')}
      </div>`;
  }

  $('boxFocusView').innerHTML = `
    <div class="focus-card">
      <div class="focus-header">
        <span class="badge-tag" style="background:#f1f5f9; color:var(--navy2); border:1px solid var(--line);">📂 ${esc(_tr(item.cat))}</span>
        ${statusBadge}
      </div>

      <div class="focus-title">
        <span class="mark" style="width:30px; height:30px; font-size:15px; font-weight:700;">${curFocusIdx + 1}</span>
        <span>${esc(_tr(item.point))}</span>
      </div>

      <div class="focus-std-box">
        <b style="color:var(--navy2); display:block; margin-bottom:4px;">${_t('stdTitle')}</b>
        ${esc(_tr(item.std))}
      </div>

      <div class="focus-actions">
        <button type="button" class="btn-choice btn-ok ${curStatus === 'OK' ? 'active' : ''}" data-act="res" data-id="${esc(item.id)}" data-val="OK">${_t('btnOk')}</button>
        <button type="button" class="btn-choice btn-ng ${curStatus === 'NG' ? 'active' : ''}" data-act="res" data-id="${esc(item.id)}" data-val="NG">${_t('btnNg')}</button>
        <button type="button" class="btn-choice btn-clear" data-act="res" data-id="${esc(item.id)}" data-val="">${_t('btnClear')}</button>
      </div>

      ${curStatus === 'NG' ? ngDetailBox(item.id, 'f') : ''}
      ${cleanBlock}

      <div class="step-nav">
        <button type="button" class="btn alt" style="padding:6px 14px; font-size:13px;" onclick="prevFocusPoint()" ${curFocusIdx === 0 ? 'disabled' : ''}>${_t('prevPt')}</button>
        <span style="font-family:'Kanit',sans-serif; font-weight:600; font-size:14px; color:var(--navy2);">${_t('ptOf', { a: curFocusIdx + 1, b: its.length })}</span>
        <button type="button" class="btn alt" style="padding:6px 14px; font-size:13px;" onclick="nextFocusPoint()" ${curFocusIdx === its.length - 1 ? 'disabled' : ''}>${_t('nextPt')}</button>
      </div>
    </div>`;

  drawPlist();
}

function ngDetailBox(id, view) {
  return `
    <div class="ng-detail">
      <label for="ngd_${view}_${esc(id)}">${_t('ngLabel')} <span class="req">${_t('ngReq')}</span></label>
      <textarea id="ngd_${view}_${esc(id)}" class="ng-detail-input" data-ngd="${esc(id)}" rows="3" maxlength="500"
        placeholder="${esc(_t('ngPh'))}">${esc(ngd[id] || '')}</textarea>
    </div>`;
}

function onNgInput(e) {
  const id = e.target && e.target.dataset && e.target.dataset.ngd;
  if (id) ngd[id] = e.target.value;
}

function focusNgInput(id) {
  setTimeout(() => {
    const t = Array.from(document.querySelectorAll('textarea[data-ngd]')).find(x => x.dataset.ngd === String(id) && x.offsetParent !== null);
    if (t) t.focus();
  }, 60);
}

function setFocusResult(itemId, val) {
  if (val) res[itemId] = val; else delete res[itemId];
  if (val !== 'NG') delete ngd[itemId];
  refreshViews();
  if (val === 'NG') focusNgInput(itemId);

  clearTimeout(autoNextTimer);
  if (val === 'OK' && curFocusIdx < CUR.items.length - 1) autoNextTimer = setTimeout(nextFocusPoint, 280);
}

function prevFocusPoint() { if (curFocusIdx > 0) selectInspectionPoint(curFocusIdx - 1); }
function nextFocusPoint() { if (curFocusIdx < CUR.items.length - 1) selectInspectionPoint(curFocusIdx + 1); }

function selectInspectionPoint(idx) {
  clearTimeout(autoNextTimer);
  curFocusIdx = idx;
  sel3DPart(idx);
  showPartViewer(idx);
  renderFocusView();
}

function drawPlist() {
  $('plist').innerHTML = CUR.items.map((item, idx) => {
    const state = res[item.id] || '';
    const label = state === 'OK' ? _t('lOk') : state === 'NG' ? _t('lNg') : _t('lWait');
    const cls = state === 'OK' ? 'OK' : state === 'NG' ? 'NG' : 'pend';
    return `
      <li>
        <button type="button" class="${idx === curFocusIdx ? 'on' : ''}" data-p="${idx}">
          <span class="no">${idx + 1}</span>
          <span style="flex:1; min-width:0;">
            <b style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(_tr(item.point))}</b>
            <span class="t">${esc(_tr(item.cat))}</span>
          </span>
          <span class="plist-status ${cls}">${label}</span>
        </button>
      </li>`;
  }).join('');
}

const OFFLINE_KEY = 'fl_offline_queue';
let offlineSyncing = false;

function readQueue() {
  try { return JSON.parse(localStorage.getItem(OFFLINE_KEY) || '[]'); } catch (e) { return []; }
}
function writeQueue(q) {
  try {
    if (q.length) localStorage.setItem(OFFLINE_KEY, JSON.stringify(q));
    else localStorage.removeItem(OFFLINE_KEY);
  } catch (e) { console.warn('writeQueue error', e); }
}

function saveOfflineQueue(payload) {
  const q = readQueue();
  if (!q.some(x => x.data && x.data.submitId === payload.data.submitId)) {
    q.push(payload);
    writeQueue(q);
  }
}

async function syncOfflineQueue() {
  if (offlineSyncing || !navigator.onLine || !TOKEN) return;
  offlineSyncing = true;
  try {
    const q = readQueue();
    const mine = q.filter(x => (x.userId || USER_ID) === USER_ID);
    if (!mine.length) return;
    const keep = q.filter(x => (x.userId || USER_ID) !== USER_ID);
    let sent = 0, rejected = 0;
    for (let i = 0; i < mine.length; i++) {
      const r = await apiPost('submitCheck', { token: TOKEN, data: mine[i].data });
      if (r.ok) { sent++; continue; }
      if (r.network || r.code === 'AUTH') { keep.push(...mine.slice(i)); break; }
      rejected++;
      console.warn('Offline item rejected:', r.error || r.msg);
    }
    writeQueue(keep);
    if (sent) toast(_t('syncDone', { n: sent }), 4000);
    if (rejected) toast(_t('syncRejected', { n: rejected }), 6000);
  } catch (e) {
    console.warn('syncOfflineQueue error', e);
  } finally {
    offlineSyncing = false;
  }
}

async function saveInspection() {
  const its = CUR.items;
  const m = CUR.forklift;
  const uid = USER_ID;
  if (!m) return toast(_t('pickForkliftToast'));
  if (!its.length) return toast(_t('noItemsToast'));

  const left = its.filter(i => !res[i.id]).length;
  if (left > 0) return toast(_t('notComplete', { n: left }));

  const missing = its.filter(i => res[i.id] === 'NG' && !(ngd[i.id] || '').trim());
  if (missing.length) {
    toast(_t('ngMissing', { n: missing.length, p: _tr(missing[0].point) }), 4500);
    selectInspectionPoint(its.findIndex(i => i.id === missing[0].id));
    focusNgInput(missing[0].id);
    return;
  }

  const ngDetails = {};
  its.forEach(i => { if (res[i.id] === 'NG') ngDetails[i.id] = ngd[i.id].trim(); });

  if (!submitId) submitId = newSubmitId();
  const btn = $('btnSave');
  btn.disabled = true;
  btn.textContent = _t('saving');
  $('vForm').classList.add('busy');

  try {
    const data = {
      submitId,
      forkliftId: m.id,
      results: res,
      ngDetails,
      cleaning: cres,
      cleaningRequired: isMondayCleaningDay(),
      note: $('note').value.trim()
    };
    const r = await apiPost('submitCheck', { token: TOKEN, data });

    if (!r.ok) {
      if (r.code === 'AUTH') {
        // เซสชันหมดอายุระหว่างบันทึก: เก็บผลที่กรอกไว้ในเครื่อง แล้วส่งให้อัตโนมัติหลังเข้าสู่ระบบใหม่ (ไม่ให้ข้อมูลหาย)
        const qd = JSON.parse(JSON.stringify(data));
        qd.offlineTs = Date.now();
        saveOfflineQueue({ userId: uid, data: qd });
        toast(_t('queuedAuth'), 8000);
        return;
      }
      if (r.network) {
        const qd = JSON.parse(JSON.stringify(data));
        qd.offlineTs = Date.now();
        saveOfflineQueue({ userId: uid, data: qd });
        toast(_t('queuedOffline'), 7000);
        resetInspection();
        renderAll();
        sel3DPart(0);
        showPartViewer(0);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      toast(_tr(r.error || r.msg || _t('saveFail')), 6000);
      return;
    }

    const msg = _t('saveOk');
    if (r.emailSent === false) {
      console.warn('Email error:', r.emailError);
      toast('⚠️ ' + msg + ' · ' + _t('emailFail') + (r.emailError ? ' (' + r.emailError + ')' : ''), 7000);
    } else {
      toast('✓ ' + msg, 4500);
    }

    resetInspection();
    renderAll();
    sel3DPart(0);
    showPartViewer(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    console.error(err);
    toast(_t('saveErr'));
  } finally {
    btn.disabled = !CUR.items.length;
    btn.textContent = _t('btnSave');
    $('vForm').classList.remove('busy');
  }
}

const PI = Math.PI;
let BODY_C = 0xf28200;

const V3 = {
  inited: false, st: null, root: null, drag: null,
  theta: 0.75, phi: 1.15, dist: 10.5, autoRotate: true,
  parts: [], selectedPart: -1, target: null, tgoal: null, showLabels: true, covers: [], internal: null
};

const PV = {
  hidden: false, src: '', tok: 0, item: null,
  mode: (function () { try { return localStorage.getItem('fl_part_mode') === '3d' ? '3d' : 'photo'; } catch (e) { return 'photo'; } })(),
  inited: false, st: null, pivot: null, drag: null,
  rotY: 0.7, rotX: 0.35, zoom: 5.2, auto: true
};

function M(c, o) {
  const m = new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.55, metalness: 0.25 }, o || {}));
  m.userData.e0 = m.emissive.getHex();
  m.userData.i0 = m.emissiveIntensity;
  return m;
}
const GL = (c, op) => M(c, { transparent: true, opacity: op, roughness: 0.08, metalness: 0, depthWrite: false });
const steel = () => M(0x9aa5b1, { metalness: 0.85, roughness: 0.35 });
const chrome = () => M(0xdfe6ed, { metalness: 1, roughness: 0.12 });
const dark = () => M(0x1f2630, { roughness: 0.6, metalness: 0.3 });
const rubber = () => M(0x14171c, { roughness: 0.95, metalness: 0 });
const bodyMat = () => M(BODY_C, { roughness: 0.42, metalness: 0.1, envMapIntensity: 0.6 });
const brass = () => M(0xd4af37, { metalness: 0.85, roughness: 0.28 });
const copper = () => M(0xb87333, { metalness: 0.9, roughness: 0.25 });
const brightRed = () => M(0xdc2626, { roughness: 0.3, metalness: 0.15 });
const warningYellow = () => M(0xfacc15, { roughness: 0.35, metalness: 0.2 });
const castIron = () => M(0x282c34, { metalness: 0.75, roughness: 0.6 });

function rbox(w, h, d, r) {
  r = r == null ? Math.min(w, h, d) * 0.18 : r;
  const b = Math.max(0.002, Math.min(r * 0.6, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
  const rr = Math.max(0.001, Math.min(r - b, w / 2 - b - 0.001, h / 2 - b - 0.001));
  const W = w - 2 * b, H = h - 2 * b, x = -W / 2, y = -H / 2;
  const s = new THREE.Shape();
  s.moveTo(x + rr, y); s.lineTo(x + W - rr, y); s.quadraticCurveTo(x + W, y, x + W, y + rr);
  s.lineTo(x + W, y + H - rr); s.quadraticCurveTo(x + W, y + H, x + W - rr, y + H);
  s.lineTo(x + rr, y + H); s.quadraticCurveTo(x, y + H, x, y + H - rr);
  s.lineTo(x, y + rr); s.quadraticCurveTo(x, y, x + rr, y);
  const depth = Math.max(0.002, d - 2 * b);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 4 });
  g.translate(0, 0, -depth / 2);
  return g;
}

function put(g, geo, mat, x, y, z, rx, ry, rz) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x || 0, y || 0, z || 0);
  if (rx) m.rotation.x = rx;
  if (ry) m.rotation.y = ry;
  if (rz) m.rotation.z = rz;
  g.add(m);
  return m;
}
const RB = (g, w, h, d, mat, x, y, z, r, rx, ry, rz) => put(g, rbox(w, h, d, r), mat, x, y, z, rx, ry, rz);
const BX = (g, w, h, d, mat, x, y, z, rx, ry, rz) => put(g, new THREE.BoxGeometry(w, h, d), mat, x, y, z, rx, ry, rz);
const CY = (g, r, h, mat, x, y, z, ax, seg) => {
  const m = put(g, new THREE.CylinderGeometry(r, r, h, seg || 28), mat, x, y, z);
  if (ax === 'x') m.rotation.z = PI / 2;
  if (ax === 'z') m.rotation.x = PI / 2;
  return m;
};
const HX = (g, r, h, mat, x, y, z, ax) => CY(g, r, h, mat, x, y, z, ax, 6);
const CN = (g, rt, rb, h, mat, x, y, z, ax) => {
  const m = put(g, new THREE.CylinderGeometry(rt, rb, h, 28), mat, x, y, z);
  if (ax === 'x') m.rotation.z = -PI / 2;
  if (ax === 'z') m.rotation.x = PI / 2;
  return m;
};
const SP = (g, r, mat, x, y, z) => put(g, new THREE.SphereGeometry(r, 20, 14), mat, x, y, z);
const TR = (g, R, t, mat, x, y, z, rx, ry, rz) => put(g, new THREE.TorusGeometry(R, t, 10, 40), mat, x, y, z, rx, ry, rz);
function TB(g, pts, r, mat) {
  const c = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2])));
  return put(g, new THREE.TubeGeometry(c, Math.max(14, pts.length * 12), r, 10, false), mat);
}
function strap(g, a, b, w, t, mat) {
  const A = new THREE.Vector3(a[0], a[1], a[2]), B = new THREE.Vector3(b[0], b[1], b[2]);
  const d = B.clone().sub(A), len = d.length();
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, t, len), mat);
  m.position.copy(A.clone().add(B).multiplyScalar(0.5));
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d.normalize());
  g.add(m);
  return m;
}
function disposeObj(o) {
  if (!o) return;
  o.traverse(n => {
    if (n.geometry) n.geometry.dispose();
    if (n.material) {
      (Array.isArray(n.material) ? n.material : [n.material]).forEach(m => {
        if (m.map) m.map.dispose();
        m.dispose();
      });
    }
  });
}

function wheelAt(g, R, W, solid, side, x, y, z) {
  const w = new THREE.Group();
  w.position.set(x, y, z);
  const ri = R * 0.58, h = W / 2, c = solid ? R * 0.03 : R * 0.07;
  const prof = [[ri, -h], [R - c, -h], [R - 0.01, -h + c * 0.9], [R, -h + c * 2], [R, h - c * 2], [R - 0.01, h - c * 0.9], [R - c, h], [ri, h]]
    .map(p => new THREE.Vector2(p[0], p[1]));
  put(w, new THREE.LatheGeometry(prof, 44), M(solid ? 0x2b2f36 : 0x15181d, { roughness: 0.9, metalness: 0, side: THREE.DoubleSide }), 0, 0, 0, 0, 0, PI / 2);
  if (!solid) {
    const lug = M(0x0d0f12, { roughness: 0.95, metalness: 0 });
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * PI * 2;
      put(w, new THREE.BoxGeometry(W * 0.82, 0.045, R * 0.2), lug, 0, Math.cos(a) * R, Math.sin(a) * R, a);
    }
  } else {
    CY(w, ri + 0.02, W * 0.9, M(0x9ca3af, { metalness: 0.8, roughness: 0.4 }), 0, 0, 0, 'x');
    [-1, 1].forEach(k => TR(w, R - 0.02, 0.012, M(0x0d0f12), k * W * 0.2, 0, 0, 0, PI / 2));
  }
  CY(w, ri * 0.98, W * 0.62, M(0xc9d1d9, { metalness: 0.8, roughness: 0.35 }), 0, 0, 0, 'x');
  [-1, 1].forEach(k => TR(w, ri * 0.98, 0.02, steel(), k * W * 0.31, 0, 0, 0, PI / 2));
  CY(w, ri * 0.72, 0.05, M(0x7b8794, { metalness: 0.7, roughness: 0.45 }), side * W * 0.3, 0, 0, 'x');
  CY(w, ri * 0.3, 0.1, steel(), side * W * 0.34, 0, 0, 'x');
  CY(w, ri * 0.14, 0.12, M(BODY_C, { metalness: 0.5, roughness: 0.4 }), side * W * 0.38, 0, 0, 'x');
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * PI * 2;
    HX(w, 0.03, 0.06, chrome(), side * W * 0.34, Math.cos(a) * ri * 0.55, Math.sin(a) * ri * 0.55, 'x');
  }
  g.add(w);
  return w;
}

function pEngine(solo) {
  const g = new THREE.Group();
  RB(g, 0.94, 0.64, 0.96, castIron(), 0, 0, 0, 0.07);
  RB(g, 0.86, 0.16, 0.9, M(0x1f242b, { metalness: 0.6, roughness: 0.4 }), 0, 0.4, 0, 0.04);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) CY(g, 0.024, 0.04, steel(), (i - 1.5) * 0.22, 0.49, j ? 0.32 : -0.32);

  RB(g, 0.76, 0.2, 0.84, dark(), 0, -0.42, 0, 0.05);
  HX(g, 0.03, 0.03, brass(), 0, -0.52, -0.3, 'y');
  CY(g, 0.016, 0.52, steel(), 0.52, 0.16, 0.22);
  TR(g, 0.048, 0.014, warningYellow(), 0.52, 0.43, 0.22, 0, PI / 2);
  CY(g, 0.09, 0.06, warningYellow(), -0.28, 0.5, -0.2);
  CY(g, 0.1, 0.02, dark(), -0.28, 0.46, -0.2);
  CY(g, 0.11, 0.22, brightRed(), -0.54, -0.1, 0.22, 'x');
  HX(g, 0.04, 0.04, steel(), -0.66, -0.1, 0.22, 'x');
  CY(g, 0.22, 0.06, steel(), 0, -0.06, 0.53, 'z');
  CY(g, 0.12, 0.05, steel(), -0.32, 0.22, 0.53, 'z');
  CY(g, 0.14, 0.05, steel(), 0.3, 0.18, 0.53, 'z');
  TR(g, 0.22, 0.02, rubber(), 0, -0.06, 0.53);
  TR(g, 0.12, 0.018, rubber(), -0.32, 0.22, 0.53);
  CY(g, 0.16, 0.26, steel(), -0.32, 0.22, 0.36, 'z');
  CY(g, 0.13, 0.16, copper(), -0.32, 0.22, 0.36, 'z');
  TB(g, [[-0.48, 0.22, 0.32], [-0.64, 0.2, 0.12], [-0.64, 0.1, -0.28], [-0.48, -0.02, -0.48]], 0.055, castIron());

  if (solo) {
    const ds = new THREE.Group();
    ds.position.set(0.72, 0, 0);
    ds.rotation.z = -0.15;
    BX(ds, 0.015, 0.9, 0.004, chrome(), 0, 0, 0);
    TR(ds, 0.045, 0.012, warningYellow(), 0, 0.48, 0, 0, PI / 2);
    CY(ds, 0.02, 0.08, warningYellow(), 0, 0.42, 0);
    BX(ds, 0.018, 0.26, 0.007, M(0xb45309, { roughness: 0.1, metalness: 0.3 }), 0, -0.28, 0);
    BX(ds, 0.028, 0.008, 0.008, brightRed(), 0, -0.17, 0);
    BX(ds, 0.028, 0.008, 0.008, dark(), 0, -0.38, 0);
    g.add(ds);
  }
  return g;
}

function pCoolant(solo) {
  const g = new THREE.Group();
  BX(g, 1.35, 0.9, 0.18, M(0x232830, { metalness: 0.65, roughness: 0.4 }), 0, 0, 0);
  const fin = M(0xb0bac5, { metalness: 0.9, roughness: 0.35 });
  for (let i = -32; i <= 32; i += 2) BX(g, 0.012, 0.82, 0.19, fin, i * 0.0195, 0, 0);
  for (let j = -4; j <= 4; j++) BX(g, 1.28, 0.016, 0.195, steel(), 0, j * 0.09, 0);
  RB(g, 1.42, 0.16, 0.26, castIron(), 0, 0.52, 0, 0.05);
  RB(g, 1.42, 0.16, 0.26, castIron(), 0, -0.52, 0, 0.05);
  CY(g, 0.09, 0.04, brass(), -0.42, 0.63, 0);
  CY(g, 0.06, 0.03, chrome(), -0.42, 0.66, 0);
  BX(g, 0.16, 0.02, 0.04, brass(), -0.42, 0.66, 0);
  TR(g, 0.42, 0.04, dark(), 0, 0, 0.18);
  CY(g, 0.1, 0.06, steel(), 0, 0, 0.18, 'z');
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * PI * 2 + 0.2;
    BX(g, 0.36, 0.1, 0.015, dark(), Math.cos(a) * 0.2, Math.sin(a) * 0.2, 0.18, 0, 0, a);
  }

  const resX = solo ? 0.68 : 0.54, resY = solo ? 0.1 : 0.85;
  RB(g, 0.32, 0.58, 0.24, GL(0xf1f5f9, 0.45), resX, resY, 0.05, 0.05);
  RB(g, 0.28, 0.36, 0.2, M(0x22c55e, { transparent: true, opacity: 0.88, emissive: 0x15803d, emissiveIntensity: 0.5, roughness: 0.2 }), resX, resY - 0.08, 0.05, 0.03);
  CY(g, 0.08, 0.06, warningYellow(), resX, resY + 0.32, 0.05);
  BX(g, 0.33, 0.015, 0.245, brightRed(), resX, resY + 0.12, 0.05);
  BX(g, 0.33, 0.015, 0.245, dark(), resX, resY - 0.18, 0.05);
  TB(g, [[-0.42, 0.6, 0], [-0.1, 0.68, 0.06], [resX, resY + 0.26, 0.05]], 0.022, rubber());
  TB(g, [[0.5, -0.45, 0], [0.65, -0.35, 0.2], [0.65, -0.05, 0.3]], 0.045, rubber());
  HX(g, 0.06, 0.04, steel(), 0.5, -0.45, 0, 'x');
  return g;
}

function pBrakeFluid(solo) {
  const g = new THREE.Group();
  RB(g, 0.72, 0.08, 0.32, castIron(), 0, -0.18, 0, 0.02);
  CY(g, 0.085, 0.58, castIron(), 0, -0.06, 0, 'x');
  CY(g, 0.024, 0.38, chrome(), 0.44, -0.06, 0, 'x');
  for (let k = 0; k < 5; k++) TR(g, 0.045, 0.012, rubber(), 0.28 + k * 0.04, -0.06, 0, 0, PI / 2);
  [-0.19, 0.19].forEach((x, i) => {
    RB(g, 0.24, 0.36, 0.18, GL(0xf8fafc, 0.45), x, 0.14, 0, 0.04);
    RB(g, 0.21, 0.22, 0.15, M(i ? 0xf59e0b : 0xd97706, { transparent: true, opacity: 0.86, emissive: 0x7c2d12, emissiveIntensity: 0.35, roughness: 0.2 }), x, 0.07, 0, 0.03);
    CY(g, 0.088, 0.06, dark(), x, 0.34, 0);
    CY(g, 0.07, 0.01, warningYellow(), x, 0.37, 0);
    BX(g, 0.245, 0.012, 0.185, brightRed(), x, 0.23, 0);
    BX(g, 0.245, 0.012, 0.185, dark(), x, -0.02, 0);
  });

  HX(g, 0.03, 0.04, brass(), -0.32, 0.02, 0.06, 'y');
  HX(g, 0.03, 0.04, brass(), -0.15, 0.02, 0.06, 'y');
  TB(g, [[-0.3, -0.06, 0], [-0.46, -0.22, 0.12], [-0.52, -0.42, 0.32]], 0.022, steel());
  TB(g, [[-0.25, -0.1, 0.05], [-0.42, -0.32, -0.06], [-0.5, -0.52, 0.12]], 0.022, steel());
  return g;
}

function pBattery(solo) {
  const g = new THREE.Group();
  RB(g, 0.66, 0.42, 0.36, M(0x16202e, { roughness: 0.6, metalness: 0.15 }), 0, 0, 0, 0.03);
  for (let k = -2; k <= 2; k++) BX(g, 0.67, 0.36, 0.015, M(0x0f172a), 0, 0, k * 0.065);
  RB(g, 0.68, 0.08, 0.38, M(0x0f172a, { roughness: 0.5, metalness: 0.2 }), 0, 0.23, 0, 0.02);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
    const cx = (i - 1) * 0.18, cz = (j - 0.5) * 0.16;
    CY(g, 0.034, 0.04, warningYellow(), cx, 0.28, cz);
    BX(g, 0.055, 0.015, 0.018, dark(), cx, 0.3, cz);
  }

  CY(g, 0.025, 0.02, chrome(), 0.09, 0.28, 0);
  CY(g, 0.018, 0.022, M(0x22c55e, { emissive: 0x16a34a, emissiveIntensity: 0.6 }), 0.09, 0.285, 0);
  CY(g, 0.03, 0.09, steel(), -0.26, 0.28, -0.1);
  CY(g, 0.03, 0.09, steel(), 0.26, 0.28, -0.1);
  RB(g, 0.085, 0.06, 0.085, brightRed(), -0.26, 0.33, -0.1, 0.015);
  RB(g, 0.085, 0.06, 0.085, dark(), 0.26, 0.33, -0.1, 0.015);
  TB(g, [[-0.34, 0.18, 0], [-0.34, 0.38, 0], [0, 0.44, 0], [0.34, 0.38, 0], [0.34, 0.18, 0]], 0.014, dark());
  if (solo) {
    const hyd = new THREE.Group();
    hyd.position.set(0.68, 0, 0);
    CY(hyd, 0.06, 0.45, GL(0xffffff, 0.6), 0, 0.05, 0);
    put(hyd, new THREE.SphereGeometry(0.09, 18, 14), brightRed(), 0, 0.35, 0);
    CY(hyd, 0.018, 0.28, rubber(), 0, -0.26, 0);
    SP(hyd, 0.022, M(0x22c55e, { emissive: 0x15803d, emissiveIntensity: 0.4 }), 0, 0.12, 0);
    SP(hyd, 0.022, M(0xf8fafc, { emissive: 0x64748b, emissiveIntensity: 0.2 }), 0, 0.04, 0);
    SP(hyd, 0.022, brightRed(), 0, -0.04, 0);

    const bot = new THREE.Group();
    bot.position.set(-0.68, -0.05, 0);
    CY(bot, 0.12, 0.45, GL(0xe0f2fe, 0.7), 0, 0, 0);
    CN(bot, 0.05, 0.12, 0.1, GL(0xe0f2fe, 0.7), 0, 0.27, 0);
    CY(bot, 0.055, 0.05, M(0x0284c7), 0, 0.34, 0);
    TB(bot, [[0, 0.35, 0], [0.05, 0.46, 0], [0.18, 0.42, 0]], 0.014, M(0x0284c7));
    g.add(hyd);
    g.add(bot);
  }
  return g;
}

function pBatteryElec(solo) {
  const g = new THREE.Group();
  RB(g, 1.62, 0.84, 1.42, M(0x232d38, { metalness: 0.7, roughness: 0.4 }), 0, 0, 0, 0.06);
  [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sz]) => {
    BX(g, 0.08, 0.18, 0.08, steel(), sx * 0.76, 0.46, sz * 0.66);
    CY(g, 0.025, 0.1, steel(), sx * 0.76, 0.49, sz * 0.66, 'x');
  });

  RB(g, 1.66, 0.08, 1.46, dark(), 0, 0.44, 0, 0.03);
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 4; j++) {
      const cx = (i - 2.5) * 0.25, cz = (j - 1.5) * 0.32;
      RB(g, 0.23, 0.04, 0.3, M(0x1a202c, { roughness: 0.6 }), cx, 0.46, cz, 0.02);
      CY(g, 0.042, 0.05, M(0xf1f5f9, { roughness: 0.4 }), cx, 0.5, cz);
      CY(g, 0.016, 0.04, M(0x22c55e, { emissive: 0x16a34a, emissiveIntensity: 0.6 }), cx, 0.53, cz);
    }
  }

  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 4; j++) {
      const bx = (i - 2.0) * 0.25, bz = (j - 1.5) * 0.32;
      BX(g, 0.12, 0.022, 0.05, copper(), bx, 0.485, bz);
      BX(g, 0.13, 0.026, 0.055, dark(), bx, 0.49, bz);
    }
  }

  for (let j = 0; j < 4; j++) {
    const tz = (j - 1.5) * 0.32;
    CY(g, 0.012, 1.35, GL(0x38bdf8, 0.6), 0, 0.51, tz, 'x');
  }

  TB(g, [[0.55, 0.48, -0.5], [0.72, 0.68, -0.45], [0.88, 0.62, -0.2], [0.95, 0.3, -0.05]], 0.052, brightRed());
  TB(g, [[0.55, 0.48, -0.2], [0.72, 0.65, -0.2], [0.88, 0.58, 0.0], [0.95, 0.26, 0.1]], 0.052, dark());
  RB(g, 0.16, 0.24, 0.26, brightRed(), 0.98, 0.16, 0.02, 0.04);
  HX(g, 0.04, 0.14, copper(), 1.05, 0.16, 0.08, 'x');
  HX(g, 0.04, 0.14, copper(), 1.05, 0.16, -0.04, 'x');
  BX(g, 0.4, 0.18, 0.01, warningYellow(), 0, 0.2, 0.72);
  return g;
}

function pTerminals(solo) {
  const g = new THREE.Group();
  RB(g, 0.8, 0.12, 0.45, dark(), 0, -0.18, 0, 0.03);
  [[-0.24, 0xdc2626, '+'], [0.24, 0x111827, '-']].forEach(([x, col, sign]) => {
    CY(g, 0.052, 0.22, steel(), x, -0.02, 0);
    RB(g, 0.18, 0.08, 0.16, brass(), x, 0.06, 0, 0.02);
    HX(g, 0.03, 0.05, chrome(), x, 0.06, 0.1, 'z');
    CY(g, 0.016, 0.22, chrome(), x, 0.06, 0, 'z');
    HX(g, 0.03, 0.05, chrome(), x, 0.06, -0.1, 'z');
    RB(g, 0.22, 0.14, 0.2, M(col, { roughness: 0.6 }), x, 0.14, -0.02, 0.04);
    BX(g, 0.06, 0.018, 0.015, M(0xffffff), x, 0.215, -0.02);
    if (sign === '+') BX(g, 0.018, 0.018, 0.06, M(0xffffff), x, 0.215, -0.02);
    CY(g, 0.045, 0.12, copper(), x, 0.06, -0.16, 'z');
    TB(g, [[x, 0.06, -0.22], [x, -0.02, -0.45], [x * 1.3, -0.15, -0.7]], 0.042, M(col, { roughness: 0.7 }));
  });
  return g;
}

function pChargePlug(solo) {
  const g = new THREE.Group();
  RB(g, 0.38, 0.28, 0.48, brightRed(), 0, 0, 0, 0.06);
  TB(g, [[0, 0.14, -0.05], [0, 0.26, -0.05], [0, 0.26, 0.12], [0, 0.14, 0.12]], 0.024, dark());
  [-0.08, 0.08].forEach(x => {
    CY(g, 0.048, 0.28, copper(), x, 0, 0.28, 'z');
    CY(g, 0.032, 0.08, chrome(), x, 0, 0.42, 'z');
  });

  [-0.03, 0.03].forEach(x => CY(g, 0.016, 0.2, brass(), x, 0.06, 0.28, 'z'));
  CY(g, 0.12, 0.16, rubber(), 0, 0, -0.3, 'z');
  TB(g, [[-0.04, 0, -0.35], [-0.08, -0.15, -0.65], [-0.15, -0.35, -0.95]], 0.052, brightRed());
  TB(g, [[0.04, 0, -0.35], [0.08, -0.15, -0.65], [0.15, -0.35, -0.95]], 0.052, dark());
  if (solo) {
    const soc = new THREE.Group();
    soc.position.set(0, 0, 0.82);
    RB(soc, 0.48, 0.38, 0.18, dark(), 0, 0, 0, 0.04);
    [-0.08, 0.08].forEach(x => {
      CY(soc, 0.055, 0.12, M(0x0f172a), x, 0, -0.04, 'z');
      TR(soc, 0.052, 0.01, brass(), x, 0, -0.09);
    });
    CY(soc, 0.022, 0.03, M(0x22c55e, { emissive: 0x16a34a, emissiveIntensity: 0.7 }), 0, 0.13, -0.09, 'z');
    g.add(soc);
  }
  return g;
}

function pHydTank(solo) {
  const g = new THREE.Group();
  RB(g, 0.42, 0.88, 0.94, M(0x0f4c6e, { metalness: 0.6, roughness: 0.38 }), 0, 0, 0, 0.06);
  [-0.24, 0.18].forEach(y => BX(g, 0.44, 0.04, 0.96, M(0x082f49, { metalness: 0.5 }), 0, y, 0));
  const sgX = 0.22, sgY = 0.04, sgZ = 0.22;
  RB(g, 0.06, 0.44, 0.1, steel(), sgX, sgY, sgZ, 0.015);
  CY(g, 0.032, 0.38, GL(0xffffff, 0.65), sgX + 0.02, sgY, sgZ);
  CY(g, 0.026, 0.26, M(0xd97706, { transparent: true, opacity: 0.88, emissive: 0x78350f, emissiveIntensity: 0.4, roughness: 0.2 }), sgX + 0.02, sgY - 0.05, sgZ);
  BX(g, 0.02, 0.008, 0.08, brightRed(), sgX + 0.035, sgY + 0.1, sgZ);
  BX(g, 0.02, 0.008, 0.08, dark(), sgX + 0.035, sgY - 0.12, sgZ);
  CY(g, 0.1, 0.08, dark(), 0, 0.48, -0.2);
  CY(g, 0.08, 0.06, chrome(), 0, 0.55, -0.2);
  BX(g, 0.02, 0.12, 0.12, chrome(), 0, 0.58, -0.2);
  HX(g, 0.04, 0.05, brass(), 0.22, -0.4, 0.28, 'x');
  CY(g, 0.06, 0.1, castIron(), 0, 0.32, 0.45);
  TB(g, [[0, 0.32, 0.45], [0.08, 0.52, 0.52], [-0.1, 0.68, 0.68]], 0.046, rubber());
  return g;
}

function pMast(solo, ctx) {
  const g = new THREE.Group();
  const sub = ctx && ctx.subtype;
  const P = sub === 'walkie_stacker' ? { S: 0.36, H: 3.2, F: 1.05, tilt: false, lbr: 0.95 }
    : sub === 'reach_truck' ? { S: 0.6, H: 3.8, F: 1.15, tilt: false, lbr: 1.15 }
    : { S: 0.72, H: 3.4, F: 1.55, tilt: true, lbr: 1.35 };
  const S = P.S, H = P.H;
  const dkm = sub === 'walkie_stacker' || sub === 'reach_truck';
  const st = () => M(dkm ? 0x1c2025 : 0x1f262e, { metalness: dkm ? 0.25 : 0.4, roughness: dkm ? 0.55 : 0.5, envMapIntensity: dkm ? 0.35 : 1 });
  const lt = () => M(dkm ? 0x555c65 : 0x59636f, { metalness: dkm ? 0.4 : 0.5, roughness: 0.45 });
  const cm = () => M(0x192028, { metalness: 0.65, roughness: 0.45 });

  [-1, 1].forEach(s => {
    RB(g, 0.22, H, 0.28, st(), s * S, H / 2, 0, 0.03);
    RB(g, 0.16, H - 0.2, 0.2, lt(), s * (S - 0.2), H / 2 + 0.05, 0.08, 0.02);
    [0.6, H / 2 + 0.1, H - 0.4].forEach(ry => CY(g, 0.065, 0.08, steel(), s * (S - 0.1), ry, 0.08, 'x'));
    if (P.tilt) {
      CY(g, 0.08, 0.82, st(), s * (S + 0.14), 0.95, -0.62, 'z');
      CY(g, 0.04, 0.65, chrome(), s * (S + 0.14), 0.95, -0.16, 'z');
    }
  });
  BX(g, 2 * S + 0.22, 0.12, 0.16, st(), 0, H - 0.02, 0);
  BX(g, 2 * S + 0.14, 0.14, 0.22, st(), 0, 0.22, 0);
  BX(g, 2 * S + 0.14, 0.1, 0.16, st(), 0, H / 2 + 0.1, -0.06);
  CY(g, 0.12, 1.6, st(), 0, 0.98, -0.22);
  CY(g, 0.08, H * 0.56, chrome(), 0, 0.81 + H * 0.28, -0.22);
  const cw = 2 * S + 0.12;
  RB(g, cw, 0.14, 0.14, cm(), 0, 0.44, 0.22, 0.02);
  RB(g, cw, 0.14, 0.14, cm(), 0, 1.08, 0.22, 0.02);
  const k = Math.max(1, Math.floor((S - 0.03) / 0.17));
  const bt = 0.475;
  for (let i = -k; i <= k; i++) RB(g, 0.05, P.lbr, 0.05, cm(), i * 0.17, bt + P.lbr / 2, 0.24, 0.015);
  RB(g, 2 * S + 0.08, 0.08, 0.08, cm(), 0, bt + P.lbr, 0.24, 0.02);
  RB(g, 2 * S + 0.08, 0.06, 0.06, cm(), 0, bt + P.lbr * 0.73, 0.24, 0.02);
  [-S * 0.625, S * 0.625].forEach(x => {
    const f = new THREE.Group();
    f.position.set(x, 0.06, 0.29);
    const fm = () => M(dkm ? 0x2a2e34 : 0x39414a, { metalness: dkm ? 0.3 : 0.3, roughness: 0.55, envMapIntensity: dkm ? 0.4 : 1 });
    RB(f, 0.2, 0.88, 0.1, fm(), 0, 0.44, 0, 0.02);
    const sh = new THREE.Shape();
    sh.moveTo(0, 0); sh.lineTo(P.F, 0); sh.lineTo(P.F, 0.035); sh.lineTo(P.F * 0.72, 0.1); sh.lineTo(0.3, 0.125); sh.lineTo(0, 0.125); sh.lineTo(0, 0);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.25, bevelEnabled: false });
    geo.translate(0, 0, -0.125);
    const b = new THREE.Mesh(geo, fm());
    b.rotation.y = -PI / 2;
    b.position.z = -0.04;
    f.add(b);
    BX(f, 0.14, 0.04, 0.14, warningYellow(), 0, 0.9, 0);
    BX(f, 0.182, 0.03, 0.35, warningYellow(), 0, 0.015, P.F - 0.17);
    g.add(f);
  });
  return g;
}

function wheelSet(g, elec, sub) {
  if (sub === 'reach_truck') {
    [-1, 1].forEach(s => {
      wheelAt(g, 0.26, 0.26, true, s, s * 0.95, 0.26, 2.0);
      wheelAt(g, 0.17, 0.16, true, s, s * 0.7, 0.17, -2.0);
    });
    wheelAt(g, 0.4, 0.34, false, 1, 0, 0.4, -1.2);
    return;
  }
  if (sub === 'walkie_stacker') {
    [-1, 1].forEach(s => {
      wheelAt(g, 0.08, 0.1, true, s, s * 0.23, 0.08, 1.5);
      wheelAt(g, 0.1, 0.1, true, s, s * 0.36, 0.1, -0.85);
    });
    wheelAt(g, 0.3, 0.26, false, 1, 0, 0.3, -0.45);
    return;
  }
  const fx = elec ? 1.02 : 1.0, rx = elec ? 0.86 : 0.82;
  [-1, 1].forEach(s => {
    wheelAt(g, 0.5, elec ? 0.4 : 0.38, false, s, s * fx, 0.5, 0.9);
    wheelAt(g, 0.42, 0.32, false, s, s * rx, 0.42, -1.3);
  });
}

function pWheel(solo, ctx) {
  const g = new THREE.Group(), el = ctx && ctx.elec;
  if (solo) {
    const w = new THREE.Group();
    wheelAt(w, 0.52, 0.38, false, 1, 0, 0, 0);
    TR(w, 0.46, 0.024, rubber(), 0.16, 0, 0, 0, PI / 2);
    TR(w, 0.46, 0.024, rubber(), -0.16, 0, 0, 0, PI / 2);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * PI * 2;
      HX(w, 0.026, 0.06, chrome(), 0.19, Math.cos(a) * 0.22, Math.sin(a) * 0.22, 'x');
      CY(w, 0.012, 0.08, steel(), 0.21, Math.cos(a) * 0.22, Math.sin(a) * 0.22, 'x');
    }
    CY(w, 0.12, 0.12, castIron(), 0.18, 0, 0, 'x');
    CY(w, 0.03, 0.04, brass(), 0.25, 0, 0, 'x');
    CY(w, 0.065, 0.6, steel(), -0.32, 0, 0, 'x');
    g.add(w);
    return g;
  }
  wheelSet(g, el, ctx && ctx.subtype);
  return g;
}

function pHoses(solo) {
  const g = new THREE.Group();
  const hoseMat = () => M(0x1a1e24, { roughness: 0.75, metalness: 0.15 });
  RB(g, 0.94, 0.3, 0.24, brass(), 0, 1.3, -0.8, 0.03);
  [-0.24, -0.08, 0.08, 0.24].forEach((x, idx) => {
    CY(g, 0.016, 0.32, chrome(), x, 1.52, -0.8);
    SP(g, 0.042, M(idx === 0 ? 0xdc2626 : idx === 1 ? 0x2563eb : 0x16a34a, { roughness: 0.35 }), x, 1.68, -0.8);
  });

  [-1, 1].forEach(s => {
    CY(g, 0.14, 0.08, castIron(), s * 0.38, 3.12, -0.22, 'x');
    TR(g, 0.14, 0.02, steel(), s * 0.38, 3.12, -0.22, 0, PI / 2);
  });

  [-1, 1].forEach(s => {
    const a = [[s * 0.42, 1.3, -0.74], [s * 0.48, 1.22, -0.42], [s * 0.44, 1.65, -0.26], [s * 0.42, 2.35, -0.25], [s * 0.38, 3.12, -0.22]];
    const b = [[s * 0.29, 1.3, -0.74], [s * 0.32, 1.12, -0.46], [s * 0.32, 1.55, -0.3], [s * 0.32, 2.35, -0.3], [s * 0.38, 3.12, -0.22]];
    TB(g, a, 0.036, hoseMat());
    TB(g, b, 0.03, hoseMat());
    [a, b].forEach((p, i) => {
      HX(g, 0.058, 0.11, chrome(), p[0][0], p[0][1], p[0][2] - 0.03, 'z');
      HX(g, 0.058, 0.11, chrome(), p[4][0], p[4][1] + 0.03, p[4][2]);
      CY(g, 0.045, 0.09, M(i ? 0x2563eb : 0xfacc15, { roughness: 0.4 }), p[3][0], p[3][1], p[3][2]);
    });
  });
  return g;
}

function headlight(g, x, y, z, s) {
  const h = new THREE.Group();
  h.position.set(x, y, z);
  if (s) h.scale.setScalar(s);
  RB(h, 0.32, 0.26, 0.18, dark(), 0, 0, -0.02, 0.04);
  for (let k = -2; k <= 2; k++) BX(h, 0.28, 0.015, 0.06, dark(), 0, k * 0.04, -0.12);
  CY(h, 0.11, 0.05, chrome(), 0, 0, 0.06, 'z');
  SP(h, 0.035, M(0xffffff, { emissive: 0xffedd5, emissiveIntensity: 1.0 }), 0, 0, 0.07);
  CY(h, 0.095, 0.025, GL(0xfffbeb, 0.55), 0, 0, 0.09, 'z');
  CY(h, 0.02, 0.1, steel(), 0, -0.16, 0);
  HX(h, 0.025, 0.04, chrome(), 0, -0.16, 0.03, 'z');
  g.add(h);
}

function taillight(g, x, y, z, s, ry) {
  const h = new THREE.Group();
  h.position.set(x, y, z);
  if (s) h.scale.setScalar(s);
  if (ry) h.rotation.y = ry;
  RB(h, 0.34, 0.16, 0.09, dark(), 0, 0, 0, 0.02);
  RB(h, 0.1, 0.12, 0.095, M(0xdc2626, { emissive: 0xef4444, emissiveIntensity: 0.6, roughness: 0.2 }), -0.1, 0, 0.01, 0.015);
  RB(h, 0.1, 0.12, 0.095, M(0xf59e0b, { emissive: 0xf59e0b, emissiveIntensity: 0.55, roughness: 0.2 }), 0, 0, 0.01, 0.015);
  RB(h, 0.1, 0.12, 0.095, M(0xf8fafc, { emissive: 0xffffff, emissiveIntensity: 0.5, roughness: 0.2 }), 0.1, 0, 0.01, 0.015);
  g.add(h);
}

function beacon(g, x, y, z, s) {
  const h = new THREE.Group();
  h.position.set(x, y, z);
  if (s) h.scale.setScalar(s);
  CY(h, 0.12, 0.06, dark(), 0, 0, 0);
  put(h, new THREE.CylinderGeometry(0.12, 0.14, 0.2, 28), M(0xf59e0b, { emissive: 0xd97706, emissiveIntensity: 0.85, transparent: true, opacity: 0.88 }), 0, 0.12, 0);
  put(h, new THREE.SphereGeometry(0.12, 24, 14, 0, PI * 2, 0, PI / 2), M(0xf59e0b, { emissive: 0xd97706, emissiveIntensity: 0.85, transparent: true, opacity: 0.88 }), 0, 0.22, 0);
  CY(h, 0.05, 0.14, chrome(), 0, 0.12, 0);
  SP(h, 0.025, M(0xfff7ed, { emissive: 0xffffff, emissiveIntensity: 1.2 }), 0, 0.16, 0);
  g.add(h);
}

function horn(g, x, y, z, s) {
  const h = new THREE.Group();
  h.position.set(x, y, z);
  if (s) h.scale.setScalar(s);
  CY(h, 0.11, 0.06, castIron(), 0, 0, -0.06, 'z');
  CN(h, 0.16, 0.07, 0.18, chrome(), 0, 0, 0.06, 'z');
  SP(h, 0.045, chrome(), 0, 0, 0.08);
  BX(h, 0.03, 0.18, 0.012, steel(), 0, -0.12, -0.08);
  g.add(h);
}

function pLights(solo, ctx) {
  const g = new THREE.Group(), sub = ctx && ctx.subtype;
  if (solo) {
    headlight(g, -0.65, 0, 0, 1.4);
    taillight(g, -0.15, 0, 0, 1.4);
    beacon(g, 0.38, -0.1, 0, 1.25);
    horn(g, 0.92, 0, 0, 1.25);
    return g;
  }
  if (sub === 'walkie_stacker') {
    [-1, 1].forEach(s => { headlight(g, s * 0.3, 3.0, 0.62, 0.5); taillight(g, s * 0.28, 0.8, -0.97, 0.9, PI); });
    beacon(g, -0.5, 2.45, 0.4, 0.6);
    horn(g, 0.3, 1.45, -0.1, 0.6);
    return g;
  }
  if (sub === 'reach_truck') {
    [-1, 1].forEach(s => { headlight(g, s * 0.6, 3.72, 0.7, 0.8); taillight(g, s * 0.5, 0.95, -1.8, 0.9, PI); });
    beacon(g, 0, 4.04, -1.0);
    horn(g, 0, 1.0, 0.5, 0.8);
    return g;
  }
  [-1, 1].forEach(s => { headlight(g, s * 0.8, 3.05, 0.68); taillight(g, s * 0.75, 1.3, -2.29, 1, PI); });
  beacon(g, 0, 3.6, -0.3);
  horn(g, 0.45, 1.0, 1.02);
  return g;
}

function pBrake(solo) {
  const g = new THREE.Group();
  CY(g, 0.028, 0.96, steel(), 0, 0.52, -0.1, 'x');
  [[-0.26, 0.14, 0.12, 0], [0, 0.24, 0.15, 1], [0.26, 0.12, 0.18, 2]].forEach(([x, w, d, type]) => {
    const arm = CY(g, 0.022, 0.52, steel(), x, 0.28, -0.04);
    arm.rotation.x = -0.35;
    TR(g, 0.045, 0.012, steel(), x, 0.52, -0.1, 0, PI / 2);
    const pad = RB(g, w, 0.045, d, rubber(), x, 0.0, 0.06, 0.012);
    pad.rotation.x = -0.4;

    if (type === 1) {
      for (let k = -2; k <= 2; k++) {
        const tr = BX(g, w * 0.9, 0.014, 0.014, M(0x3a424c), x, 0.026, 0.06 + k * 0.026);
        tr.rotation.x = -0.4;
      }
    }
  });

  RB(g, 0.12, 0.18, 0.22, dark(), 0.6, 0.05, -0.1, 0.02);
  CY(g, 0.08, 0.015, steel(), 0.58, 0.12, -0.1, 'x');
  const lev = CY(g, 0.02, 0.54, steel(), 0.6, 0.32, -0.2);
  lev.rotation.x = -0.5;
  const grip = CY(g, 0.038, 0.2, M(0x111827, { roughness: 0.85 }), 0.6, 0.54, -0.32);
  grip.rotation.x = -0.5;
  CY(g, 0.02, 0.04, brightRed(), 0.6, 0.64, -0.37);
  return g;
}

function mirrorUnit(g, s, x) {
  const u = new THREE.Group();
  u.position.set(x, 0, 0);
  TB(u, [[0, 0, 0], [s * 0.14, 0.05, -0.02], [s * 0.34, 0.12, -0.06]], 0.02, dark());
  SP(u, 0.038, steel(), s * 0.35, 0.12, -0.06);
  CY(u, 0.03, 0.05, chrome(), s * 0.35, 0.12, -0.08, 'z');
  RB(u, 0.34, 0.42, 0.07, dark(), s * 0.44, 0.15, -0.1, 0.04);
  put(u, new THREE.CylinderGeometry(0.18, 0.18, 0.015, 32), M(0xe0f2fe, { metalness: 0.98, roughness: 0.03 }), s * 0.44, 0.15, -0.14, PI / 2);
  TR(u, 0.182, 0.012, rubber(), s * 0.44, 0.15, -0.14);
  g.add(u);
}

function pMirror(solo) {
  const g = new THREE.Group();
  if (solo) { mirrorUnit(g, 1, 0); return g; }
  mirrorUnit(g, -1, -0.88);
  mirrorUnit(g, 1, 0.88);
  return g;
}

function pSteering(solo) {
  const g = new THREE.Group();
  const tg = new THREE.Group();
  tg.rotation.x = -0.52;
  CY(tg, 0.052, 0.74, dark(), 0, 0.36, 0);
  CY(tg, 0.016, 0.18, chrome(), -0.12, 0.22, 0, 'x');
  SP(tg, 0.03, dark(), -0.22, 0.22, 0);
  for (let k = 0; k < 4; k++) TR(tg, 0.065, 0.012, rubber(), 0, 0.12 + k * 0.04, 0, PI / 2, 0, 0);
  CY(tg, 0.014, 0.22, dark(), -0.16, 0.52, 0, 'x');
  CY(tg, 0.024, 0.06, brightRed(), -0.26, 0.52, 0, 'x');
  const vin = M(0x181c22, { roughness: 0.85, metalness: 0.1 });
  TR(tg, 0.28, 0.034, vin, 0, 0.74, 0, -PI / 2);
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * PI * 2 + PI / 2;
    BX(tg, 0.28, 0.028, 0.045, vin, Math.cos(a) * 0.14, 0.74, Math.sin(a) * 0.14, 0, -a);
  }
  CY(tg, 0.08, 0.065, dark(), 0, 0.74, 0);
  CY(tg, 0.06, 0.01, warningYellow(), 0, 0.775, 0);
  CY(tg, 0.048, 0.035, steel(), 0.28, 0.79, 0);
  CY(tg, 0.035, 0.15, M(0x0f172a, { roughness: 0.7 }), 0.28, 0.87, 0);
  SP(tg, 0.038, M(0x0f172a, { roughness: 0.7 }), 0.28, 0.94, 0);
  tg.position.set(0, 0, 0);
  g.add(tg);
  RB(g, 0.54, 0.22, 0.14, dark(), 0, 0.22, -0.14, 0.03);
  BX(g, 0.24, 0.12, 0.01, M(0x064e3b, { emissive: 0x059669, emissiveIntensity: 0.5 }), 0, 0.24, -0.215);
  [-0.18, -0.12, 0.12, 0.18].forEach((x, idx) => {
    CY(g, 0.022, 0.01, M(idx === 0 ? 0xef4444 : idx === 1 ? 0xf59e0b : 0x22c55e, { emissive: idx === 0 ? 0xef4444 : idx === 1 ? 0xf59e0b : 0x22c55e, emissiveIntensity: 0.7 }), x, 0.24, -0.212, 'z');
  });
  return g;
}

function pSeatbelt(solo) {
  const g = new THREE.Group();
  const vin = M(0x181c22, { roughness: 0.9, metalness: 0.05 });
  RB(g, 0.64, 0.18, 0.58, dark(), 0, -0.28, 0, 0.04);
  CY(g, 0.045, 0.06, chrome(), 0, -0.28, 0.3, 'z');
  RB(g, 0.82, 0.18, 0.76, vin, 0, 0, 0, 0.08);
  [-1, 1].forEach(s => RB(g, 0.12, 0.14, 0.62, vin, s * 0.41, 0.08, 0, 0.04));
  RB(g, 0.8, 0.92, 0.16, vin, 0, 0.52, -0.38, 0.08, -0.15);
  RB(g, 0.52, 0.28, 0.12, vin, 0, 1.1, -0.45, 0.05, -0.15);
  RB(g, 0.12, 0.22, 0.12, dark(), -0.46, 0.56, -0.42, 0.02);
  const belt = M(0xf97316, { roughness: 0.7, metalness: 0.1 });
  strap(g, [-0.32, 0.98, -0.32], [0.22, 0.12, 0.14], 0.075, 0.014, belt);
  strap(g, [-0.44, 0.08, -0.15], [0.22, 0.12, 0.14], 0.075, 0.014, belt);
  RB(g, 0.075, 0.15, 0.035, chrome(), 0.22, 0.14, 0.14, 0.01);
  CY(g, 0.018, 0.2, steel(), 0.22, 0.04, 0.16);
  RB(g, 0.06, 0.12, 0.08, dark(), 0.22, 0.16, 0.16, 0.02);
  BX(g, 0.045, 0.045, 0.014, brightRed(), 0.22, 0.21, 0.16);
  BX(g, 0.58, 0.38, 0.02, dark(), 0, 0.5, -0.47);
  return g;
}

function pChain(solo) {
  const g = new THREE.Group();
  const chainMat = M(0x525c68, { metalness: 0.92, roughness: 0.32 });
  BX(g, 0.86, 0.08, 0.12, steel(), 0, 2.22, -0.14);
  [-0.28, 0.28].forEach(x => {
    CY(g, 0.22, 0.08, castIron(), x, 2.22, -0.06, 'x');
    TR(g, 0.22, 0.02, steel(), x, 2.22, -0.06, 0, PI / 2);
    CY(g, 0.04, 0.14, chrome(), x, 2.22, -0.06, 'x');
    for (let i = 0; i < 34; i++) {
      const y = i * 0.068 - 0.05;
      const t = put(g, new THREE.TorusGeometry(0.048, 0.014, 8, 14), chainMat, x, y, 0, 0, (i % 2) * PI / 2, 0);
      t.scale.set(1, 1.48, 1);
      CY(g, 0.008, 0.05, chrome(), x, y, 0, 'x');
    }

    BX(g, 0.12, 0.16, 0.09, dark(), x, -0.1, 0);
    CY(g, 0.024, 0.22, chrome(), x, -0.12, 0);
    HX(g, 0.04, 0.035, brass(), x, -0.18, 0, 'y');
    HX(g, 0.04, 0.035, brass(), x, -0.22, 0, 'y');
    CY(g, 0.006, 0.06, steel(), x, -0.25, 0, 'x');
  });
  return g;
}

function pGasTank(solo) {
  const g = new THREE.Group();
  const tankMat = M(0xc8d1da, { metalness: 0.65, roughness: 0.35 });
  CY(g, 0.28, 1.08, tankMat, 0, 0, 0, 'x');
  put(g, new THREE.SphereGeometry(0.28, 28, 18), tankMat, -0.54, 0, 0);
  put(g, new THREE.SphereGeometry(0.28, 28, 18), tankMat, 0.54, 0, 0);
  TR(g, 0.284, 0.012, steel(), -0.35, 0, 0, 0, PI / 2);
  TR(g, 0.284, 0.012, steel(), 0.35, 0, 0, 0, PI / 2);
  TR(g, 0.23, 0.038, steel(), 0.66, 0, 0, 0, PI / 2);
  BX(g, 0.08, 0.26, 0.04, steel(), 0.62, 0.16, 0);
  BX(g, 0.08, 0.26, 0.04, steel(), 0.62, -0.16, 0);
  TR(g, 0.23, 0.038, steel(), -0.66, 0, 0, 0, PI / 2);
  BX(g, 0.06, 0.08, 0.04, brightRed(), -0.66, 0.23, 0);
  CY(g, 0.048, 0.14, brass(), 0.64, 0.04, 0, 'x');
  TR(g, 0.055, 0.016, warningYellow(), 0.72, 0.04, 0, 0, PI / 2);
  HX(g, 0.032, 0.08, brass(), 0.58, 0.14, 0.08, 'x');
  CY(g, 0.02, 0.03, brightRed(), 0.63, 0.14, 0.08, 'x');
  CY(g, 0.065, 0.04, chrome(), 0.56, -0.08, 0.1, 'x');
  CY(g, 0.058, 0.01, M(0xffffff), 0.585, -0.08, 0.1, 'x');
  BX(g, 0.24, 0.24, 0.01, brightRed(), 0, 0.285, 0);
  BX(g, 0.18, 0.18, 0.012, M(0xffffff), 0, 0.286, 0);
  return g;
}

function pGasSecuring(solo) {
  const g = new THREE.Group();
  const tankMat = M(0x9ca3af, { metalness: 0.5, roughness: 0.5 });
  CY(g, 0.28, 1.05, tankMat, 0, 0, 0, 'x');
  [-0.34, 0.34].forEach(x => {
    BX(g, 0.08, 0.18, 0.72, dark(), x, -0.24, 0);
    TR(g, 0.288, 0.02, rubber(), x, 0, 0, 0, PI / 2);
    TR(g, 0.298, 0.028, warningYellow(), x, 0, 0, 0, PI / 2);
    BX(g, 0.09, 0.12, 0.09, chrome(), x, 0.28, 0.12);
    CY(g, 0.016, 0.18, chrome(), x, 0.34, 0.16);
    SP(g, 0.028, brightRed(), x, 0.44, 0.16);
    CY(g, 0.008, 0.1, chrome(), x, 0.28, 0.06, 'x');
    TR(g, 0.035, 0.008, chrome(), x + 0.05, 0.28, 0.06);
  });
  
  CY(g, 0.02, 0.12, steel(), -0.48, -0.12, 0, 'y');
  return g;
}

function pGasPipeline(solo) {
  const g = new THREE.Group();
  CY(g, 0.28, 0.6, M(0x9ca3af, { metalness: 0.4, roughness: 0.5 }), -0.25, 0, -0.3, 'x');
  const hosePts = [[0.35, 0.04, -0.3], [0.48, 0.12, -0.12], [0.44, 0.06, 0.22], [0.22, -0.12, 0.44]];
  TB(g, hosePts, 0.046, rubber());
  for (let k = 0; k < 12; k++) {
    const t = k / 12;
    const px = 0.35 * (1 - t) + 0.22 * t + Math.sin(t * PI) * 0.15;
    const py = 0.04 * (1 - t) - 0.12 * t;
    const pz = -0.3 * (1 - t) + 0.44 * t;
    TR(g, 0.052, 0.008, warningYellow(), px, py, pz, 0.4, 0.6, 0);
  }

  HX(g, 0.045, 0.08, brass(), 0.35, 0.04, -0.3, 'x');
  CY(g, 0.038, 0.06, brass(), 0.35, 0.04, -0.3, 'z');
  HX(g, 0.05, 0.09, brass(), 0.22, -0.12, 0.44, 'z');
  CY(g, 0.038, 0.08, chrome(), 0.22, -0.12, 0.48, 'z');
  return g;
}

function pGasFittings(solo) {
  const g = new THREE.Group();
  CY(g, 0.075, 0.22, brass(), 0, 0, 0, 'x');
  CY(g, 0.096, 0.09, brass(), -0.05, 0, 0, 'x');
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * PI * 2;
    BX(g, 0.088, 0.012, 0.012, dark(), -0.05, Math.cos(a) * 0.096, Math.sin(a) * 0.096, 0, 0, a);
  }

  TR(g, 0.065, 0.012, rubber(), 0.06, 0, 0, 0, PI / 2);
  for (let t = -2; t <= 2; t++) TR(g, 0.075, 0.007, brass(), t * 0.02, 0, 0, 0, PI / 2);
  CY(g, 0.025, 0.16, steel(), -0.05, 0.12, 0, 'y');
  TR(g, 0.075, 0.018, brightRed(), -0.05, 0.2, 0);
  CY(g, 0.06, 0.05, rubber(), 0.22, 0.12, 0.08, 'x');
  TB(g, [[-0.05, 0.08, 0], [0.1, 0.16, 0.05], [0.22, 0.12, 0.08]], 0.006, steel());
  TB(g, [[0.16, 0, 0], [0.32, -0.08, 0.1], [0.44, -0.18, 0.2]], 0.046, rubber());
  HX(g, 0.062, 0.08, chrome(), 0.14, 0, 0, 'x');
  return g;
}

function pGasLeak(solo) {
  const g = new THREE.Group();
  CY(g, 0.075, 0.24, brass(), 0, 0, 0, 'x');
  HX(g, 0.095, 0.08, brass(), -0.04, 0, 0, 'x');
  CY(g, 0.065, 0.16, chrome(), 0.14, 0, 0, 'x');
  CY(g, 0.02, 0.14, steel(), -0.04, 0.1, 0, 'y');
  TR(g, 0.082, 0.018, brightRed(), -0.04, 0.17, 0);
  const soapMat = GL(0x7dd3fc, 0.45);
  const bubbles = [
    [0.08, 0.08, 0.06, 0.055],
    [0.12, 0.11, 0.03, 0.042],
    [0.06, 0.12, -0.04, 0.048],
    [0.02, 0.09, 0.08, 0.038],
    [0.15, 0.06, 0.07, 0.032],
    [0.1, -0.07, 0.06, 0.045],
    [0.05, -0.09, -0.05, 0.05],
    [-0.02, -0.08, 0.07, 0.035]
  ];
  bubbles.forEach(([bx, by, bz, br]) => {
    put(g, new THREE.SphereGeometry(br, 18, 14), soapMat, bx, by, bz);
    SP(g, br * 0.25, M(0xffffff, { transparent: true, opacity: 0.8 }), bx + br * 0.35, by + br * 0.4, bz + br * 0.4);
  });

  if (solo) {
    const bot = new THREE.Group();
    bot.position.set(-0.45, -0.05, 0.15);
    CY(bot, 0.08, 0.32, GL(0x38bdf8, 0.65), 0, 0, 0);
    CN(bot, 0.035, 0.08, 0.08, GL(0x38bdf8, 0.65), 0, 0.2, 0);
    RB(bot, 0.06, 0.1, 0.14, dark(), 0, 0.28, 0.04, 0.02);
    CY(bot, 0.012, 0.12, dark(), 0, 0.3, 0.15, 'z');
    CY(bot, 0.008, 0.08, brightRed(), 0, 0.24, 0.06, 'y');
    g.add(bot);
  }
  return g;
}

function pGasGauge(solo) {
  const g = new THREE.Group();
  CY(g, 0.16, 0.08, brass(), 0, 0, 0, 'y');
  CY(g, 0.175, 0.04, chrome(), 0, 0.025, 0, 'y');
  CY(g, 0.155, 0.015, M(0xffffff, { roughness: 0.18 }), 0, 0.045, 0, 'y');
  BX(g, 0.06, 0.005, 0.025, brightRed(), 0.06, 0.052, -0.06);
  BX(g, 0.05, 0.005, 0.025, warningYellow(), 0.03, 0.052, -0.08);
  BX(g, 0.09, 0.005, 0.025, M(0x16a34a), -0.04, 0.052, -0.07);
  BX(g, 0.015, 0.006, 0.025, brightRed(), -0.08, 0.052, -0.04);

  const needle = new THREE.Group();
  needle.rotation.y = 0.55;
  BX(needle, 0.012, 0.006, 0.11, dark(), 0, 0.054, -0.045);
  SP(needle, 0.02, dark(), 0, 0.054, 0);
  g.add(needle);
  put(g, new THREE.CylinderGeometry(0.16, 0.16, 0.02, 32), GL(0xf8fafc, 0.3), 0, 0.06, 0);
  TR(g, 0.162, 0.008, rubber(), 0, 0.06, 0, PI / 2);
  return g;
}

function pGeneric() {
  const g = new THREE.Group();
  RB(g, 0.6, 0.4, 0.4, dark(), 0, 0, 0, 0.05);
  CY(g, 0.08, 0.1, M(0xf08a1c), 0, 0.25, 0);
  return g;
}

function pBellyButton(solo) {
  const g = new THREE.Group();
  RB(g, 0.32, 0.28, 0.16, dark(), 0, 0, 0, 0.04);
  RB(g, 0.28, 0.24, 0.02, warningYellow(), 0, 0.04, 0.08, 0.03);
  put(g, new THREE.SphereGeometry(0.095, 24, 14, 0, PI * 2, 0, PI * 0.6), M(0xdc2626, { roughness: 0.2, metalness: 0.15, emissive: 0xef4444, emissiveIntensity: 0.6 }), 0, 0.07, 0.09);
  CY(g, 0.08, 0.04, M(0x991b1b), 0, 0.03, 0.09);
  CY(g, 0.05, 0.12, steel(), 0, -0.16, 0);
  return g;
}

function pEmergencyStop(solo) {
  const g = new THREE.Group();
  RB(g, 0.26, 0.16, 0.2, dark(), 0, 0, 0, 0.04);
  CY(g, 0.03, 0.09, chrome(), 0, 0.06, 0.04);
  CY(g, 0.08, 0.015, warningYellow(), 0, 0.085, 0.04);
  TR(g, 0.078, 0.012, warningYellow(), 0, 0.085, 0.04, PI / 2, 0, 0);
  put(g,
    new THREE.SphereGeometry(0.08, 24, 14, 0, PI * 2, 0, PI * 0.65),
    brightRed(),
    0, 0.12, 0.04
  );
  TR(g, 0.055, 0.008, M(0xffffff), 0, 0.155, 0.04, PI / 2, 0, 0);
  return g;
}

function pTiller(solo) {
  const g = new THREE.Group();
  const arm = M(0x2b3036, { metalness: 0.6, roughness: 0.45 });
  TB(g, [[0, 0, 0], [0, 0.55, 0.1], [0, 1.0, 0.2], [0, 1.2, 0.26]], 0.05, arm);
  RB(g, 0.22, 0.14, 0.3, arm, 0, 1.27, 0.26, 0.05);
  [-1, 1].forEach(s => {
    TR(g, 0.11, 0.026, rubber(), s * 0.15, 1.3, 0.34, PI / 2, 0, 0);
    CY(g, 0.034, 0.16, rubber(), s * 0.15, 1.26, 0.2, 'z');
    SP(g, 0.022, warningYellow(), s * 0.15, 1.36, 0.22);
    BX(g, 0.035, 0.02, 0.06, M(0x2563eb), s * 0.07, 1.35, 0.3);
  });
  [-1, 1].forEach(s => RB(g, 0.05, 0.04, 0.1, brightRed(), s * 0.05, 1.35, 0.14, 0.01));
  CY(g, 0.07, 0.12, castIron(), 0, 0.04, 0.02);
  CY(g, 0.015, 0.03, brass(), 0.07, 0.04, 0.02, 'x');
  return g;
}

function pTillerBrake(solo) {
  const g = new THREE.Group();
  RB(g, 0.28, 0.18, 0.22, castIron(), 0, 0, 0, 0.03);
  CY(g, 0.028, 0.32, chrome(), 0, 0.04, 0, 'x');
  CY(g, 0.008, 0.03, brass(), 0.17, 0.04, 0, 'x');
  const arm = new THREE.Group();
  arm.rotation.x = -0.32;
  CY(arm, 0.026, 0.46, steel(), 0, 0.23, 0);
  for (let k = 0; k < 8; k++) TR(arm, 0.038, 0.008, steel(), 0, 0.1 + k * 0.024, 0, PI / 2, 0, 0);
  CY(arm, 0.14, 0.022, steel(), 0, 0.04, 0, 'x');
  RB(arm, 0.12, 0.08, 0.1, dark(), 0.08, 0.14, 0, 0.02);
  BX(arm, 0.04, 0.06, 0.04, warningYellow(), -0.1, 0.08, 0);
  g.add(arm);
  if (solo) {
    const arc = new THREE.Group();
    arc.position.set(-0.16, 0.04, 0);
    arc.rotation.y = -PI / 2;
    BX(arc, 0.12, 0.28, 0.01, M(0x22c55e, { roughness: 0.4 }), 0, 0.18, 0);
    BX(arc, 0.12, 0.08, 0.012, brightRed(), 0, 0.32, 0);
    BX(arc, 0.12, 0.08, 0.012, brightRed(), 0, 0.04, 0);
    g.add(arc);
  }
  return g;
}

const WK = 'walkie_stacker', RT = 'reach_truck';
const PART_DEFS = {
  engine:      { build: pEngine,      pos: () => [0, 1.25, -0.55], scale: 0.85 },
  coolant:     { build: pCoolant,     pos: () => [0, 1.17, -1.12], scale: 0.85 },
  brakeFluid:  { build: pBrakeFluid,  pos: () => [0.5, 1.68, 0.62], scale: 0.6 },
  battery:     { build: pBattery,     pos: () => [-1.25, 0.98, -0.45], rot: [0, PI / 2, 0] },
  batteryElec: { build: pBatteryElec,
    pos: (e, sub) => sub === WK ? [-0.1, 1.0, -0.28] : sub === RT ? [-0.3, 1.1, -0.1] : [0, 1.17, -0.62],
    scale: (e, sub) => sub === WK ? 0.5 : sub === RT ? 0.6 : 0.8 },
  terminals:   { build: pTerminals,
    pos: (e, sub) => sub === WK ? [-0.1, 1.35, -0.28] : sub === RT ? [-0.3, 1.5, -0.1] : [0.4, 1.45, -0.62],
    scale: (e, sub) => sub === WK ? 0.5 : sub === RT ? 0.6 : 0.8 },
  chargePlug:  { build: pChargePlug,
    pos: (e, sub) => sub === WK ? [-0.32, 1.2, -0.82] : sub === RT ? [0.78, 1.15, -0.25] : [0.8, 1.05, -0.85],
    rot: (e, sub) => sub === WK ? [0, PI, 0] : [0, PI / 2, 0],
    scale: (e, sub) => sub === WK ? 0.55 : 0.6 },
  hydTank:     { build: pHydTank,
    pos: (e, sub) => sub === WK ? [0.3, 1.0, -0.28] : sub === RT ? [0.4, 1.1, -0.1] : [1.2, 1.12, -0.15],
    scale: (e, sub) => sub === WK ? 0.55 : sub === RT ? 0.6 : 1 },
  mast:        { build: pMast,        pos: (e, sub) => [0, 0, sub === WK ? 0.52 : sub === RT ? 1.0 : 1.65] },
  wheel:       { build: pWheel,       pos: () => [0, 0, 0] },
  hoses:       { build: pHoses,       pos: (e, sub) => [0, 0, sub === WK ? 0.42 : sub === RT ? 1.0 : 1.65],
    scale: (e, sub) => sub === WK ? [0.75, 0.9, 1] : sub === RT ? [0.84, 1.15, 1] : 1 },
  lights:      { build: pLights,      pos: () => [0, 0, 0] },
  brake:       { build: pBrake,       pos: (e, sub) => sub === WK ? [0, 0.62, -0.9] : [0, 0.85, 0.22], scale: (e, sub) => sub === WK ? 0.7 : 1 },
  mirror:      { build: pMirror,      pos: (e, sub) => sub === RT ? [0, 3.0, 0.42] : [0, 2.6, 0.55] },
  steering:    { build: pSteering,    pos: (e, sub) => sub === RT ? [-0.45, 1.72, -0.6] : [0, 1.55, 0.5] },
  seatbelt:    { build: pSeatbelt,    pos: (e, sub) => sub === RT ? [0, 1.7, -1.3] : [0, 2.02, -0.4] },
  chain:       { build: pChain,       pos: (e, sub) => sub === WK ? [0, 0.8, 0.64] : sub === RT ? [0, 1.45, 1.22] : [0, 1.1, 1.9] },
  gasTank:     { build: pGasTank,     pos: () => [0, 2.0, -1.75] },
  gasSecuring: { build: pGasSecuring, pos: () => [-0.45, 2.0, -1.75] },
  gasPipeline: { build: pGasPipeline, pos: () => [0.45, 1.73, -1.35] },
  gasFittings: { build: pGasFittings, pos: () => [0.65, 2.0, -1.75] },
  gasLeak:     { build: pGasLeak,     pos: () => [0.78, 2.0, -1.75] },
  gasGauge:    { build: pGasGauge,    pos: () => [0.35, 2.2, -1.75] },
  bellyButton:   { build: pBellyButton,   pos: () => [0, 1.93, -1.22], rot: [0, PI, 0], scale: 0.6 },
  emergencyStop: { build: pEmergencyStop, pos: () => [0.3, 1.5, -0.55] },
  tiller:        { build: pTiller,        pos: () => [0, 0.6, -0.92], rot: [0, PI, 0] },
  tillerBrake:   { build: pTillerBrake,   pos: () => [0, 0.62, -0.95], rot: [0, PI, 0] },
  generic:     { build: pGeneric,     pos: () => [0, 1.5, 0] }
};

const pv_ = (v, e, sub) => typeof v === 'function' ? v(e, sub) : v;
function placePart(parent, key, elec, sub) {
  const def = PART_DEFS[key] || PART_DEFS.generic;
  const g = def.build(false, { elec, subtype: sub });
  const p = def.pos(elec, sub);
  g.position.set(p[0], p[1], p[2]);
  const r = pv_(def.rot, elec, sub);
  if (r) g.rotation.set(r[0], r[1], r[2]);
  const s = pv_(def.scale, elec, sub);
  if (s) { if (Array.isArray(s)) g.scale.set(s[0], s[1], s[2]); else g.scale.setScalar(s); }
  parent.add(g);
  return g;
}

function internalKeys(elec, sub) {
  if (sub === WK) return new Set(['batteryElec', 'terminals', 'hydTank']);
  if (sub === RT) return new Set(['batteryElec', 'terminals', 'hydTank']);
  return new Set(elec ? ['batteryElec', 'terminals'] : ['engine', 'coolant']);
}

function partKeyFor(it, elec) {
  const t = (it && it.point) || '';
  if (/belly|ฉุกเฉินกันชน|กันชน/i.test(t)) return 'bellyButton';
  if (/หยุดฉุกเฉิน|emergency.*stop/i.test(t)) return 'emergencyStop';
  if (/คันบังคับ|ด้ามจับ|ปุ่มเดินหน้า|tiller/i.test(t)) return 'tiller';
  if (/dead-?man/i.test(t)) return 'tillerBrake';
  if (/ขั้วแบต/.test(t)) return 'terminals';
  if (/ปลั๊ก|ชาร์จ/.test(t)) return 'chargePlug';
  if (/น้ำมันเบรค|น้ำมันเบรก|คลัตช์|คลัช|ครัช|คลัทช์/.test(t)) return 'brakeFluid';
  if (/น้ำมันเครื่อง/.test(t)) return 'engine';
  if (/หม้อพักน้ำ|หม้อน้ำ|น้ำยาหล่อเย็น/.test(t)) return 'coolant';
  if (/น้ำกลั่น|แบตเตอรี่|เเบตเตอรี่|แบตเตอร์รี่|เเบตเตอร์รี่/.test(t)) return elec ? 'batteryElec' : 'battery';
  if (/ล้อ.*ไฮดรอลิ[คก]/.test(t)) return 'wheel';
  if (/สายไฮ/.test(t)) return 'hoses';
  if (/ไฮดรอลิค|ไฮดรอลิก/.test(t)) return 'hydTank';
  if (/เสา|งา/.test(t)) return 'mast';
  if (/ล้อ|ยาง/.test(t)) return 'wheel';
  if (/ไฟ|แตร/.test(t)) return 'lights';
  if (/กระจก/.test(t)) return 'mirror';
  if (/พวงมาลัย/.test(t)) return 'steering';
  if (/เข็มขัด|เบาะ/.test(t)) return 'seatbelt';
  if (/โซ่/.test(t)) return 'chain';
  if (/เบรค|เบรก/.test(t)) return 'brake';
  if (/รั่วซึม.*ก๊าซ|รั่วซึม.*แก๊ส/.test(t)) return 'gasLeak';
  if (/มาตรวัด.*ก๊าซ|เกจ.*แก๊ส|เกจ.*ก๊าซ/.test(t)) return 'gasGauge';
  if (/สายส่งก๊าซ|สายส่งแก๊ส|ท่อ.*แก๊ส/.test(t)) return 'gasPipeline';
  if (/ยึดถังก๊าซ|ยึดถังแก๊ส|ล็อกถัง/.test(t)) return 'gasSecuring';
  if (/ข้อต่อ.*ก๊าซ|ข้อต่อ.*แก๊ส|อุปกรณ์เชื่อมต่อ/.test(t)) return 'gasFittings';
  if (/ถังก๊าซ|ถังแก๊ส/.test(t)) return 'gasTank';
  return 'generic';
}

function rrPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function decalTex(draw, w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  t.anisotropy = 4;
  return t;
}

function decalPlane(g, tex, w, h, x, y, z, side) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
  );
  m.position.set(x, y, z);
  m.rotation.y = side * PI / 2;
  g.add(m);
  return m;
}

function hazardTex() {
  return decalTex((c, w, h) => {
    c.clearRect(0, 0, w, h);
    const nS = 8, sw = w / nS;
    for (let i = 0; i < nS; i++) {
      c.fillStyle = i % 2 === 0 ? '#facc15' : '#1a1a1a';
      c.beginPath(); c.moveTo(i * sw, 0); c.lineTo((i + 1) * sw, 0);
      c.lineTo((i + 1) * sw - h * 0.6, h); c.lineTo(i * sw - h * 0.6, h); c.closePath(); c.fill();
    }
  }, 320, 48);
}

function newCover(g) {
  const c = new THREE.Group();
  c.userData.cover = true;
  g.add(c);
  return c;
}

function buildBaseCB(g, elec, subtype, has) {
  const frame = () => M(0x2b323a, { metalness: 0.6, roughness: 0.5 });
  const trim = () => M(0x3a4048, { roughness: 0.8, metalness: 0.5 });
  const guardM = () => elec ? M(0x5d6670, { metalness: 0.55, roughness: 0.5 }) : M(0x20262d, { metalness: 0.6, roughness: 0.45 });
  const fx = elec ? 1.02 : 1.0;

  RB(g, 1.5, 0.42, 1.55, frame(), 0, 0.62, 0.38, 0.05);
  RB(g, 1.2, 0.42, 1.5, frame(), 0, 0.62, -1.15, 0.05);
  CY(g, 0.1, 2.0, dark(), 0, 0.5, 0.9, 'x');
  CY(g, 0.07, 1.6, dark(), 0, 0.42, -1.3, 'x');
  RB(g, 1.3, 0.3, 0.7, frame(), 0, 0.42, 1.3, 0.05);
  RB(g, 1.46, 0.07, 0.5, trim(), 0, 0.81, 0.18, 0.02);
  for (let i = 0; i < 6; i++) BX(g, 1.3, 0.012, 0.03, M(0x555d66), 0, 0.85, -0.02 + i * 0.075);
  RB(g, 2.0, 0.92, 1.1, bodyMat(), 0, 1.26, -1.7, 0.3);
  RB(g, 1.2, 0.5, 0.9, bodyMat(), 0, 0.55, -1.8, 0.1);
  RB(g, 1.0, 0.16, 0.08, rubber(), 0, 0.4, -2.3, 0.02);
  RB(g, 0.3, 0.18, 0.1, steel(), 0, 0.62, -2.32, 0.02);
  decalPlane(g, hazardTex(), 1.2, 0.16, 0, 0.98, -2.258, 0).rotation.y = PI;

  const cover = newCover(g);
  RB(cover, 1.56, 0.87, 1.12, bodyMat(), 0, 1.265, -0.62, 0.12);
  RB(cover, 1.4, 0.04, 1.0, M(0x20262d, { roughness: 0.7, metalness: 0.3 }), 0, 1.71, -0.62, 0.015);
  [-1, 1].forEach(s => {
    for (let i = 0; i < 6; i++) BX(cover, 0.02, 0.28, 0.035, dark(), s * 0.785, 1.15, -1.0 + i * 0.15);
    BX(cover, 0.02, 0.05, 0.9, M(0xfacc15, { roughness: 0.5 }), s * 0.785, 0.9, -0.62);
  });
  if (elec) {
    const texV = decalTex((c, w, h) => {
      c.clearRect(0, 0, w, h);
      c.font = 'bold italic 84px Kanit, Arial, sans-serif';
      c.textBaseline = 'middle'; c.textAlign = 'left';
      const a = 'VORTE', aw = c.measureText(a).width, xw = c.measureText('X').width;
      const x0 = (w - aw - xw) / 2;
      c.fillStyle = '#ffffff'; c.fillText(a, x0, h / 2 + 4);
      c.fillStyle = '#ffd23f'; c.fillText('X', x0 + aw, h / 2 + 4);
    }, 512, 128);
    const tex35 = decalTex((c, w, h) => {
      c.clearRect(0, 0, w, h);
      rrPath(c, 8, 8, w - 16, h - 16, 22);
      c.fillStyle = '#1b232c'; c.fill();
      c.save(); c.clip();
      c.fillStyle = '#22c55e';
      c.beginPath(); c.moveTo(8, 8); c.lineTo(66, 8); c.lineTo(34, h - 8); c.lineTo(8, h - 8); c.closePath(); c.fill();
      c.restore();
      c.fillStyle = '#ffffff';
      c.font = 'bold 96px Kanit, Arial, sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('35', 150, h / 2 + 6);
    }, 256, 160);
    [-1, 1].forEach(s => {
      decalPlane(cover, texV, 0.8, 0.2, s * 0.795, 1.5, -0.62, s);
      decalPlane(cover, tex35, 0.34, 0.21, s * 0.795, 1.25, -0.4, s);
    });
  }

  RB(g, 1.4, 0.92, 0.55, bodyMat(), 0, 1.04, 0.72, 0.14);
  RB(g, 1.3, 0.06, 0.5, M(0x20262d, { roughness: 0.6, metalness: 0.3 }), 0, 1.53, 0.72, 0.02);
  CY(g, 0.12, 0.1, rubber(), 0, 1.57, 0.5);
  RB(g, 1.1, 0.4, 0.04, dark(), 0, 0.85, 1.0, 0.02);
  for (let i = 0; i < 5; i++) BX(g, 0.9, 0.025, 0.02, M(0x555d66), 0, 0.72 + i * 0.07, 1.025);
  [-1, 1].forEach(s => {
    RB(g, 0.62, 0.1, 1.2, bodyMat(), s * fx, 1.1, 0.9, 0.04);
    RB(g, 0.05, 0.38, 1.2, bodyMat(), s * (fx + 0.3), 0.92, 0.9, 0.02);
    RB(g, 0.55, 0.07, 0.35, trim(), s * 1.0, 0.62, 0.18, 0.02);
    for (let i = 0; i < 4; i++) BX(g, 0.5, 0.012, 0.03, M(0x555d66), s * 1.0, 0.66, 0.06 + i * 0.08);
    RB(g, 0.3, 0.1, 0.3, frame(), s * 0.78, 0.6, 0.18, 0.02);
  });

  if (!elec) {
    RB(g, 0.5, 0.06, 0.9, frame(), -1.25, 0.74, -0.45, 0.02);
    RB(g, 0.7, 0.08, 0.35, frame(), -0.95, 0.74, -0.45, 0.02);
  }

  const gm = guardM;
  [-1, 1].forEach(s => {
    RB(g, 0.1, 2.55, 0.1, gm(), s * 0.86, 2.27, 0.6, 0.02, 0.09);
    RB(g, 0.1, 1.83, 0.1, gm(), s * 0.86, 2.64, -1.3, 0.02);
    RB(g, 0.1, 0.08, 1.95, gm(), s * 0.86, 3.55, -0.25, 0.02);
    strap(g, [s * 0.86, 2.2, -1.3], [s * 0.86, 3.5, -0.5], 0.05, 0.05, gm());
  });
  RB(g, 1.82, 0.1, 0.1, gm(), 0, 3.55, 0.8, 0.02);
  RB(g, 1.82, 0.1, 0.1, gm(), 0, 3.55, -1.3, 0.02);
  for (let i = 0; i < 9; i++) BX(g, 0.04, 0.05, 2.0, gm(), -0.7 + i * 0.175, 3.57, -0.25);
  [0.3, -0.5].forEach(z => BX(g, 1.7, 0.05, 0.05, gm(), 0, 3.58, z));
  TB(g, [[-0.86, 1.6, 0.55], [-1.02, 1.95, 0.5], [-0.86, 2.5, 0.45]], 0.03, chrome());

  const sUp = String(subtype || '').toLowerCase();
  const isLPG = sUp.includes('lpg') || sUp.includes('petrol');
  if (isLPG) {
    RB(g, 1.3, 0.04, 0.78, dark(), 0, 1.73, -1.75, 0.01);
    if (!has.has('gasTank')) {
      const tankMat = M(0xc8d1da, { metalness: 0.65, roughness: 0.35 });
      CY(g, 0.28, 1.05, tankMat, 0, 2.0, -1.75, 'x');
      SP(g, 0.28, tankMat, -0.525, 2.0, -1.75);
      SP(g, 0.28, tankMat, 0.525, 2.0, -1.75);
      [-0.32, 0.32].forEach(x => {
        BX(g, 0.06, 0.22, 0.68, dark(), x, 1.82, -1.75);
        TR(g, 0.295, 0.024, warningYellow(), x, 2.0, -1.75, 0, PI / 2);
      });
      TR(g, 0.23, 0.035, steel(), 0.64, 2.0, -1.75, 0, PI / 2);
      CY(g, 0.045, 0.12, brass(), 0.62, 2.03, -1.75, 'x');
      TB(g, [[0.58, 2.03, -1.75], [0.68, 1.9, -1.5], [0.65, 1.6, -1.2], [0.45, 1.45, -0.9]], 0.038, rubber());
    }
  } else if (!elec) {
    TB(g, [[0.82, 1.0, -1.7], [1.0, 1.8, -1.55], [1.0, 3.7, -1.45]], 0.048, castIron());
    CY(g, 0.052, 0.06, castIron(), 1.0, 3.72, -1.45);
    BX(g, 0.09, 0.012, 0.08, steel(), 1.0, 3.76, -1.43, 0.25, 0, 0);
    CY(g, 0.065, 0.04, M(0x16a34a, { roughness: 0.4 }), -1.02, 1.35, -1.9, 'x');
    CY(g, 0.045, 2.0, dark(), -1.0, 2.72, -1.45);
    put(g, new THREE.CylinderGeometry(0.11, 0.07, 0.18, 20), GL(0xffffff, 0.6), -1.0, 3.8, -1.45);
    CY(g, 0.12, 0.04, dark(), -1.0, 3.9, -1.45);
  }
}

function buildBaseReachTruck(g, has) {
  const red = () => M(0xd51d12, { roughness: 0.38, metalness: 0.12, envMapIntensity: 0.35 });
  const dred = () => M(0x9d160d, { roughness: 0.5, metalness: 0.12, envMapIntensity: 0.35 });
  const blk = () => M(0x16191d, { roughness: 0.6, metalness: 0.12, envMapIntensity: 0.35 });
  const blk2 = () => M(0x23282e, { roughness: 0.65, metalness: 0.12, envMapIntensity: 0.35 });
  const yw = () => M(0xfacc15, { roughness: 0.5 });
  const LX = 0.95;
  [-1, 1].forEach(s => {
    RB(g, 0.26, 0.36, 2.65, blk(), s * LX, 0.36, 0.95, 0.07);
    RB(g, 0.3, 0.3, 0.45, blk(), s * LX, 0.33, 2.02, 0.12);
    BX(g, 0.08, 0.04, 2.0, steel(), s * LX, 0.56, 0.9);
  });

  RB(g, 1.7, 0.36, 2.9, blk(), 0, 0.34, -0.75, 0.08);
  RB(g, 1.74, 0.2, 0.1, M(0x14171c, { roughness: 0.9 }), 0, 0.3, -2.22, 0.03);
  RB(g, 1.9, 0.32, 0.4, blk(), 0, 0.46, 0.55, 0.05);
  [-1, 1].forEach(s => {
    strap(g, [s * 0.55, 0.68, 0.52], [s * 0.2, 0.68, 0.9], 0.07, 0.05, steel());
    strap(g, [s * 0.2, 0.68, 0.52], [s * 0.55, 0.68, 0.9], 0.07, 0.05, steel());
  });

  RB(g, 1.5, 0.85, 1.15, red(), 0, 0.83, -1.2, 0.2);
  RB(g, 1.4, 0.05, 1.0, blk2(), 0, 1.27, -1.2, 0.02);
  RB(g, 1.1, 0.06, 0.55, blk2(), 0, 0.95, -0.55, 0.02);
  for (let i = 0; i < 5; i++) BX(g, 1.0, 0.012, 0.03, M(0x555d66), 0, 0.985, -0.75 + i * 0.1);
  [-1, 1].forEach(s => { for (let i = 0; i < 5; i++) BX(g, 0.02, 0.2, 0.03, dark(), s * 0.76, 0.75, -1.65 + i * 0.12); });
  RB(g, 0.3, 0.08, 0.7, blk2(), 0.5, 1.5, -1.0, 0.03);
  [-0.12, 0.12].forEach(z => { CY(g, 0.018, 0.16, chrome(), 0.5, 1.6, -1.0 + z); SP(g, 0.035, M(0x111827, { roughness: 0.6 }), 0.5, 1.7, -1.0 + z); });

  const cover = newCover(g);
  RB(cover, 1.5, 1.5, 1.1, red(), 0, 1.15, -0.1, 0.28);
  RB(cover, 1.34, 0.05, 0.9, dred(), 0, 1.92, -0.1, 0.02);
  const texF = decalTex((c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.font = 'bold italic 76px Kanit, Arial, sans-serif';
    c.textBaseline = 'middle'; c.textAlign = 'center';
    c.fillStyle = '#ffffff'; c.fillText('REACH', w / 2, h * 0.42);
    c.font = 'bold 34px Kanit, Arial, sans-serif';
    c.fillStyle = '#ffd23f'; c.fillText('TRUCK', w / 2, h * 0.76);
  }, 384, 160);
  [-1, 1].forEach(s => decalPlane(cover, texF, 0.8, 0.34, s * 0.752, 1.45, -0.1, s));
  [-1, 1].forEach(s => {
    RB(cover, 0.02, 0.75, 0.5, M(0xb81a10, { roughness: 0.5, metalness: 0.12 }), s * 0.755, 0.95, 0.15, 0.02);
    BX(cover, 0.02, 0.12, 0.1, yw(), s * 0.765, 1.0, 0.15);
  });

  BX(cover, 0.5, 0.35, 0.02, M(0xf1f5f9, { roughness: 0.6 }), 0, 1.0, 0.46);
  RB(g, 0.42, 0.5, 0.35, blk2(), -0.45, 1.5, -0.6, 0.05);

  const ROOF_Y = 3.95;
  RB(g, 1.7, 0.14, 2.5, blk(), 0, ROOF_Y, -0.55, 0.05);
  RB(g, 1.76, 0.04, 2.56, M(0x14171c, { roughness: 0.8 }), 0, ROOF_Y - 0.09, -0.55, 0.01);

  const tL = decalTex((c, w, h) => {
    c.fillStyle = '#23282e'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#ffffff';
    for (let r = 0; r < 3; r++) for (let q = 0; q < 2; q++) {
      c.beginPath(); c.ellipse(w * (0.28 + q * 0.44), h * (0.2 + r * 0.3), w * 0.17, h * 0.085, 0, 0, PI * 2); c.fill();
    }
  }, 256, 384);
  const led = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 2.2), new THREE.MeshBasicMaterial({ map: tL, toneMapped: false }));
  led.rotation.x = -PI / 2; led.position.set(0, ROOF_Y + 0.075, -0.55);
  g.add(led);
  [-1, 1].forEach(s => {
    RB(g, 0.12, 2.65, 0.12, blk(), s * 0.78, 2.6, -1.72, 0.03);
    RB(g, 0.12, 2.1, 0.12, blk(), s * 0.74, 2.9, 0.42, 0.03);
  });
  [-0.45, 0, 0.45].forEach(x => BX(g, 0.04, 1.6, 0.04, blk(), x, 3.0, -1.72));
  BX(g, 1.5, 0.05, 0.05, blk(), 0, 2.45, -1.72);
}

function buildBaseWalkieStacker(g, has) {
  const bc = () => M(0xd2380a, { roughness: 0.38, metalness: 0.12, envMapIntensity: 0.35 });
  const dbc = () => M(0xb83c12, { roughness: 0.5, metalness: 0.12, envMapIntensity: 0.35 });
  const gray = () => M(0x2c3036, { metalness: 0.15, roughness: 0.6, envMapIntensity: 0.35 });
  const dgray = () => M(0x1e2227, { metalness: 0.15, roughness: 0.6, envMapIntensity: 0.35 });

  RB(g, 1.0, 0.42, 1.3, gray(), 0, 0.3, -0.28, 0.16);
  RB(g, 0.98, 0.34, 0.12, M(0x14171c, { roughness: 0.9, envMapIntensity: 0.35 }), 0, 0.28, -0.96, 0.04);
  RB(g, 0.9, 0.5, 0.26, gray(), 0, 0.4, 0.42, 0.05);

  const cover = newCover(g);
  RB(cover, 0.96, 0.9, 1.1, bc(), 0, 0.97, -0.3, 0.22);
  RB(cover, 0.9, 0.06, 1.0, gray(), 0, 1.45, -0.3, 0.02);
  RB(cover, 0.5, 0.06, 0.36, dgray(), 0.2, 1.49, -0.55, 0.01);
  for (let i = 0; i < 4; i++) BX(cover, 0.44, 0.012, 0.03, M(0x555d66), 0.2, 1.525, -0.66 + i * 0.09);
  RB(cover, 0.3, 0.05, 0.2, dark(), -0.22, 1.5, -0.05, 0.01);
  BX(cover, 0.22, 0.01, 0.11, M(0x064e3b, { emissive: 0x059669, emissiveIntensity: 0.6 }), -0.22, 1.53, -0.05);
  CY(cover, 0.035, 0.05, chrome(), 0.2, 1.5, -0.02);
  for (let i = 0; i < 5; i++) BX(cover, 0.7, 0.014, 0.03, M(0x555d66), 0, 0.7 + i * 0.07, -0.86);
  const texWS = decalTex((c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.font = 'bold 54px Kanit, Arial, sans-serif';
    c.textBaseline = 'middle'; c.textAlign = 'center';
    c.fillStyle = '#ffffff'; c.fillText('WALKIE', w / 2, h * 0.38);
    c.font = 'bold 30px Kanit, Arial, sans-serif';
    c.fillStyle = '#ffe28a'; c.fillText('STACKER', w / 2, h * 0.72);
  }, 384, 160);
  [-1, 1].forEach(s => decalPlane(cover, texWS, 0.6, 0.25, s * 0.482, 1.05, -0.3, s));
  RB(g, 0.5, 0.22, 0.04, dgray(), 0, 0.62, 0.3, 0.01);
}

const ESSENTIAL_PARTS = {
  walkie_stacker: ['wheel', 'mast', 'tiller', 'tillerBrake', 'bellyButton', 'emergencyStop', 'lights'],
  reach_truck: ['wheel', 'mast', 'seatbelt', 'steering', 'brake', 'lights'],
  cb: ['wheel', 'mast', 'seatbelt', 'steering', 'brake', 'lights']
};

function buildBase(g, elec, noSeat, subtype, has) {
  has = has || new Set();
  if (subtype === 'reach_truck') buildBaseReachTruck(g, has);
  else if (subtype === 'walkie_stacker') buildBaseWalkieStacker(g, has);
  else buildBaseCB(g, elec, subtype, has);
  const list = ESSENTIAL_PARTS[subtype] || ESSENTIAL_PARTS.cb;
  list.forEach(k => { if (!has.has(k)) placePart(g, k, elec, subtype); });
}

function makeEnvScene() {
  const s = new THREE.Scene();
  const geo = new THREE.SphereGeometry(40, 32, 16), pos = geo.attributes.position, col = [];
  const top = new THREE.Color(0xeaf2fa), mid = new THREE.Color(0xb7c3cf), bot = new THREE.Color(0x4a545e), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getY(i) / 40;
    if (t > 0) c.copy(mid).lerp(top, Math.pow(t, 0.6)); else c.copy(mid).lerp(bot, Math.min(1, -t * 1.6));
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  s.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const lamp = (w, h, x, y, z, k) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k, k), side: THREE.DoubleSide }));
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    s.add(m);
  };
  lamp(18, 8, 14, 22, 10, 5); lamp(10, 10, -22, 12, -6, 2.5); lamp(24, 4, 0, 10, -24, 2);
  return s;
}

function makeStage(canvas, shadowR) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.88;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  let hasEnv = false;
  try {
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(makeEnvScene(), 0.02).texture;
    pm.dispose();
    hasEnv = true;
  } catch (e) { console.warn('env map skipped', e); }
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8c98a4, hasEnv ? 0.28 : 0.9));
  const sun = new THREE.DirectionalLight(0xffffff, hasEnv ? 0.75 : 0.85);
  sun.position.set(6, 12, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -shadowR; sc.right = shadowR; sc.top = shadowR; sc.bottom = -shadowR; sc.near = 1; sc.far = 40;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  const fill = new THREE.DirectionalLight(0xdbeafe, hasEnv ? 0.3 : 0.4);
  fill.position.set(-8, 5, -5);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xfef3c7, hasEnv ? 0.35 : 0.5);
  rim.position.set(0, 8, -9);
  scene.add(rim);
  scene.add(sun);
  return { renderer, scene, camera, sun };
}

function fitStage(st, canvas) {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return false;
  const pr = st.renderer.getPixelRatio();
  if (canvas.width !== Math.round(w * pr) || canvas.height !== Math.round(h * pr)) {
    st.renderer.setSize(w, h, false);
    st.camera.aspect = w / h;
    st.camera.updateProjectionMatrix();
  }
  return true;
}

function shadowize(root) {
  root.traverse(o => {
    if (o.isMesh) {
      o.castShadow = !(o.material && o.material.transparent);
      o.receiveShadow = true;
    }
  });
}

function setGlow(group, on) {
  group.traverse(o => {
    if (o.isMesh && o.material && o.material.emissive) {
      const m = o.material;
      if (on) { m.emissive.setHex(0xf08a1c); m.emissiveIntensity = 0.5; }
      else { m.emissive.setHex(m.userData.e0 || 0); m.emissiveIntensity = m.userData.i0 == null ? 1 : m.userData.i0; }
    }
  });
}

function pulseGlow(group, k) {
  group.traverse(o => {
    if (o.isMesh && o.material && o.material.emissive) {
      o.material.emissive.setHex(0xff9a1f);
      o.material.emissiveIntensity = 0.1 + k * 1.3;
    }
  });
}

const badgeCache = {};
function numberBadgeTexture(num, isSelected) {
  const key = num + (isSelected ? 's' : 'n');
  if (badgeCache[key]) return badgeCache[key];
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.beginPath();
  ctx.arc(32, 32, 28, 0, Math.PI * 2);
  ctx.fillStyle = isSelected ? '#f59e0b' : '#1e3a8a';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  ctx.fillStyle = isSelected ? '#0f2438' : '#ffffff';
  ctx.font = 'bold 32px Kanit, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(num, 32, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.encoding = THREE.sRGBEncoding;
  badgeCache[key] = tex;
  return tex;
}

function init3D() {
  if (V3.inited) return true;
  try {
    if (!window.THREE) return false;
    const canvas = $('cv');
    if (!canvas) return false;
    V3.st = makeStage(canvas, 9);
    const scene = V3.st.scene;

    const floor = new THREE.Mesh(new THREE.CircleGeometry(9, 64), new THREE.MeshStandardMaterial({ color: 0xe3ecf7, roughness: 0.92, metalness: 0 }));
    floor.rotation.x = -PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    const ring = new THREE.Mesh(new THREE.RingGeometry(8.4, 8.6, 64), new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
    ring.rotation.x = -PI / 2;
    ring.position.y = 0.01;
    scene.add(ring);
    const grid = new THREE.GridHelper(16, 16, 0xb5c1cc, 0xcdd6de);
    grid.position.y = 0.012;
    grid.material.transparent = true;
    grid.material.opacity = 0.5;
    scene.add(grid);

    V3.target = new THREE.Vector3(0, 1.8, 0);
    V3.tgoal = V3.target.clone();

    canvas.addEventListener('pointerdown', e => {
      V3.drag = { x: e.clientX, y: e.clientY, moved: 0 };
      V3.autoRotate = false;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', e => {
      if (!V3.drag) return;
      const dx = e.clientX - V3.drag.x, dy = e.clientY - V3.drag.y;
      V3.drag.x = e.clientX; V3.drag.y = e.clientY;
      V3.drag.moved += Math.abs(dx) + Math.abs(dy);
      V3.theta -= dx * 0.01;
      V3.phi = Math.max(0.2, Math.min(1.5, V3.phi - dy * 0.01));
    });
    canvas.addEventListener('pointerup', e => {
      if (V3.drag && V3.drag.moved < 6) pick3DPart(e);
      V3.drag = null;
    });
    canvas.addEventListener('pointercancel', () => { V3.drag = null; });
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      v3zoom(e.deltaY > 0 ? 1.2 : -1.2);
    }, { passive: false });

    V3.inited = true;
    requestAnimationFrame(loop3D);
    return true;
  } catch (err) {
    console.warn('3D initialization skipped:', err);
    return false;
  }
}

function loop3D() {
  requestAnimationFrame(loop3D);
  if (document.hidden) return;
  renderMain();
  renderPartStage();
}

function renderMain() {
  if (!V3.inited) return;
  const canvas = $('cv');
  if (!canvas || !canvas.offsetParent || !fitStage(V3.st, canvas)) return;
  if (V3.autoRotate) V3.theta += 0.004;
  V3.target.lerp(V3.tgoal, 0.08);
  const t = V3.target, cam = V3.st.camera;
  const D = V3.dist * Math.min(1.7, Math.max(1, 1.5 / cam.aspect));
  cam.position.set(
    t.x + D * Math.sin(V3.phi) * Math.sin(V3.theta),
    t.y + D * Math.cos(V3.phi),
    t.z + D * Math.sin(V3.phi) * Math.cos(V3.theta)
  );
  cam.lookAt(t);
  const sp = V3.parts[V3.selectedPart];
  if (sp) {
    const k = 0.5 + 0.5 * Math.sin(performance.now() / 120);
    if (sp.group) pulseGlow(sp.group, k);
    if (sp.sprite) { const s = 0.38 + 0.14 * k; sp.sprite.scale.set(s, s, s); }
  }
  V3.st.renderer.render(V3.st.scene, cam);
}

function toggleV3Labels() {
  V3.showLabels = !V3.showLabels;
  V3.parts.forEach(p => { if (p.sprite) p.sprite.visible = V3.showLabels; });
  const b = $('btnLabels');
  if (b) b.textContent = _t(V3.showLabels ? 'hideNum' : 'showNum');
}

function v3zoom(d) {
  V3.dist = Math.max(5, Math.min(22, V3.dist + d));
}

function v3reset() {
  V3.theta = 0.75;
  V3.phi = 1.15;
  V3.dist = 10.5;
  V3.autoRotate = true;
  sel3DPart(-1);
}

function pick3DPart(e) {
  if (!V3.inited || !V3.root) return;
  const rect = $('cv').getBoundingClientRect();
  const mouse = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  const ray = new THREE.Raycaster();
  ray.setFromCamera(mouse, V3.st.camera);
  const hits = ray.intersectObjects(V3.root.children, true).filter(x => x.object.userData && x.object.userData.partIdx != null && x.object.visible);
  const hit = hits.find(x => x.object.isSprite) || hits[0];
  if (hit) selectInspectionPoint(hit.object.userData.partIdx);
}

function sel3DPart(idx) {
  V3.selectedPart = idx;
  const cp = V3.parts[idx];
  const hideCover = !!(cp && V3.internal && V3.internal.has(cp.key));
  (V3.covers || []).forEach(c => { c.visible = !hideCover; });
  V3.parts.forEach((p, k) => {
    const on = k === idx;
    if (p.group) setGlow(p.group, on);
    if (p.sprite) {
      if (!on) p.sprite.scale.set(0.38, 0.38, 0.38);
      p.sprite.material.map = numberBadgeTexture(k + 1, on);
      p.sprite.material.needsUpdate = true;
    }
  });
  if (V3.tgoal) {
    if (idx >= 0 && V3.parts[idx]) { V3.tgoal.copy(V3.parts[idx].center); V3.autoRotate = false; }
    else V3.tgoal.set(0, 1.8, 0);
  }
}

function renderForklift3D(m, isElec) {
  if (!init3D()) return;
  if (V3.root) { V3.st.scene.remove(V3.root); disposeObj(V3.root); }
  V3.root = new THREE.Group();
  V3.st.scene.add(V3.root);
  V3.parts = [];
  BODY_C = isElec ? 0xd23f0a : 0xf28200;

  const sub = m ? model3dOf(m) : '';
  const items = getCurItems();
  const keys = items.map(it => partKeyFor(it, isElec));
  const has = new Set(keys);

  const base = new THREE.Group();
  buildBase(base, isElec, false, sub, has);
  V3.root.add(base);
  V3.covers = [];
  base.traverse(o => { if (o.userData && o.userData.cover) V3.covers.push(o); });
  V3.internal = internalKeys(isElec, sub);

  const placed = {};
  items.forEach((it, idx) => {
    const key = keys[idx];
    let g = placed[key];
    if (!g) {
      g = placePart(V3.root, key, isElec, sub);
      placed[key] = g;
    }
    V3.parts.push({ group: g, key, sprite: null, center: new THREE.Vector3(), idx });
  });

  shadowize(V3.root);
  V3.root.updateMatrixWorld(true);
  V3.root.traverse(o => { if (o.isMesh) o.userData.partIdx = null; });
  V3.parts.forEach((p, idx) => {
    p.group.traverse(o => { if (o.isMesh && o.userData.partIdx == null) o.userData.partIdx = idx; });
    const box = new THREE.Box3().setFromObject(p.group);
    box.getCenter(p.center);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: numberBadgeTexture(idx + 1, idx === curFocusIdx), depthTest: false, toneMapped: false }));
    sprite.position.set(p.center.x, Math.min(box.max.y, p.center.y + 0.6) + 0.1, p.center.z);
    sprite.scale.set(0.38, 0.38, 0.38);
    sprite.visible = V3.showLabels;
    sprite.renderOrder = 99;
    sprite.userData.partIdx = idx;
    V3.root.add(sprite);
    p.sprite = sprite;
  });

  sel3DPart(curFocusIdx);
  showPartViewer(curFocusIdx);
}

function getForkliftModelType() {
  const m = CUR.forklift;
  if (!m) return CUR.elec ? 'electric' : 'diesel';
  const ki = typeInfo(m);
  if (ki.subtype === 'walkie_stacker' || ki.subtype === 'reach_truck') return ki.subtype;
  if (ki.group === 'electric') return 'electric';
  const raw = (String(m.model || '') + ' ' + ki.subtype).toLowerCase();
  return /petrol|gasoline|lpg|cng|gas|แก๊ส|แก๊ซ/.test(raw) ? 'petrol+LPG' : 'diesel';
}

const PART_IMAGES = {
  walkie_stacker: {
    batteryElec:   'electric/electric-battery-water.jpg',
    terminals:     'electric/electric-battery-terminal.jpg',
    chargePlug:    'electric/electric-charge-plug.jpg',
    bellyButton:   'electric/electric-lights-horn.jpg',
    emergencyStop: 'electric/electric-lights-horn.jpg',
    tiller:        'electric/electric-brake.jpg',
    tillerBrake:   'electric/electric-brake.jpg',
    mast:          'electric/electric-mast-forks.jpg',
    chain:         'electric/electric-chain.jpg',
    wheel:         'electric/electric-wheel-tire.jpg',
    hydTank:       'electric/electric-hydraulic-oil.jpg',
    hoses:         'electric/electric-hydraulic-hose.jpg',
    lights:        'electric/electric-lights-horn.jpg',
    brake:         'electric/electric-brake.jpg'
  },
  reach_truck: {
    batteryElec: 'electric/electric-battery-water.jpg',
    terminals:   'electric/electric-battery-terminal.jpg',
    chargePlug:  'electric/electric-charge-plug.jpg',
    mast:        'electric/electric-mast-forks.jpg',
    chain:       'electric/electric-chain.jpg',
    wheel:       'electric/electric-wheel-tire.jpg',
    hydTank:     'electric/electric-hydraulic-oil.jpg',
    hoses:       'electric/electric-hydraulic-hose.jpg',
    lights:      'electric/electric-lights-horn.jpg',
    brake:       'electric/electric-brake.jpg'
  },
  electric: {
    batteryElec: 'electric/electric-battery-water.jpg',
    terminals:   'electric/electric-battery-terminal.jpg',
    chargePlug:  'electric/electric-charge-plug.jpg',
    mast:        'electric/electric-mast-forks.jpg',
    chain:       'electric/electric-chain.jpg',
    wheel:       'electric/electric-wheel-tire.jpg',
    hydTank:     'electric/electric-hydraulic-oil.jpg',
    hoses:       'electric/electric-hydraulic-hose.jpg',
    lights:      'electric/electric-lights-horn.jpg',
    brake:       'electric/electric-brake.jpg'
  },
  diesel: {
    engine:      'diesel/Forklift-diesel-Engine-oil-level.jpg',
    coolant:     'diesel/Forklift-diesel-Coolant-reservoir-level.jpg',
    battery:     'diesel/Forklift-diesel-battery.jpg',
    hydTank:     'diesel/Forklift-diesel-Hydraulic-oil-level.jpg',
    hoses:       'diesel/Forklift-diesel-Condition-of-the-hydraulic-hose.jpg',
    mast:        'diesel/Forklift-diesel-Mast-and-forks.jpg',
    chain:       'diesel/Forklift-diesel-Chain-condition.jpg',
    brakeFluid:  'diesel/Forklift-diesel-Brake-and-clutch-fluid-level.jpg',
    brake:       'diesel/Forklift-diesel-Brake-system.jpg',
    wheel:       'diesel/Forklift-diesel-Condition-of-wheels-and-tires.jpg',
    steering:    'diesel/Forklift-diesel-steering-wheel.jpg',
    lights:      'diesel/Forklift-diesel-Signal-lights-and-horn.jpg',
    mirror:      'diesel/Forklift-diesel-Side-view-mirror.jpg',
    seatbelt:    'diesel/Forklift-diesel-Seat-belt.jpg'
  },
  'petrol+LPG': {
    engine:      'petrol+LPG/Forklift-petrol+LPG-Engine-oil-level.jpg',
    coolant:     'petrol+LPG/Forklift-petrol+LPG-Coolant-reservoir-level.jpg',
    battery:     'petrol+LPG/Forklift-petrol+LPG-battery.jpg',
    hydTank:     'petrol+LPG/Forklift-petrol+LPG-Hydraulic-oil-level.jpg',
    hoses:       'petrol+LPG/Forklift-petrol+LPG-Condition-of-the-hydraulic-hose.jpg',
    mast:        'petrol+LPG/Forklift-petrol+LPG-Mast-and-forks.jpg',
    chain:       'petrol+LPG/Forklift-petrol+LPG-Chain-condition.jpg',
    brakeFluid:  'petrol+LPG/Forklift-petrol+LPG-Brake-and-clutch-fluid-level.jpg',
    brake:       'petrol+LPG/Forklift-petrol+LPG-Brake-system.jpg',
    wheel:       'petrol+LPG/Forklift-petrol+LPG-Wheels-and-tires.jpg',
    steering:    'petrol+LPG/Forklift-petrol+LPG-steering-wheel.jpg',
    lights:      'petrol+LPG/Forklift-petrol+LPG-Signal-and-horn.jpg',
    mirror:      'petrol+LPG/Forklift-petrol+LPG-Side-view-mirror.jpg',
    seatbelt:    'petrol+LPG/Forklift-petrol+LPG-Seat-belt.jpg',
    gasTank:     'petrol+LPG/Forklift-petrol+LPG-Gas.jpg',
    gasSecuring: 'petrol+LPG/Forklift-petrol+LPG-Securing-gas.jpg',
    gasPipeline: 'petrol+LPG/Forklift-petrol+LPG-Gas-pipeline.jpg',
    gasFittings: 'petrol+LPG/Gas-fittings-and-connection.jpg',
    gasLeak:     'petrol+LPG/Forklift-petrol+LPG-Gas-leakage.jpg',
    gasGauge:    'petrol+LPG/Forklift-petrol+LPG-Gas-level-gauge.jpg'
  }
};

const imageFolderFor = t => (t === 'walkie_stacker' || t === 'reach_truck' || t === 'electric') ? 'electric' : t;

function partImageCandidates(it, key) {
  const modelType = getForkliftModelType();
  const folder = imageFolderFor(modelType);
  const typeMap = PART_IMAGES[modelType] || PART_IMAGES.electric;
  const out = [];
  const add = p => {
    if (!p) return;
    const u = (/^(https?:|data:)/i.test(p)) ? p : (p.startsWith(ASSET_DIR) ? p : ASSET_DIR + p);
    if (!out.includes(u)) out.push(u);
  };

  if (typeMap && typeMap[key]) {
    add(typeMap[key]);
  }

  if (it && it.img) {
    const raw = String(it.img).trim();
    if (raw) {
      if (/^(https?:|data:)/i.test(raw)) add(raw);
      else {
        const rel = raw.startsWith(ASSET_DIR) ? raw.slice(ASSET_DIR.length) : raw;
        add(rel);
        if (rel.includes('/')) {
          const parts = rel.split('/'), name = parts.slice(1).join('/');
          add(folder + '/' + name);
          if (folder === 'electric' && !name.startsWith('electric-')) add('electric/electric-' + name);
        } else {
          add(folder + '/' + rel);
          if (folder === 'electric' && !rel.startsWith('electric-')) add('electric/electric-' + rel);
        }
      }
    }
  }

  return out;
}

function showPartViewer(idx) {
  const nameEl = $('partName');
  if (!nameEl) return;
  const it = getCurItems()[idx];
  if (!it) return;
  nameEl.textContent = (idx + 1) + '. ' + _tr(it.point);
  if ($('partCat')) $('partCat').textContent = _tr(it.cat || '');
  PV.item = it;
  applyPartMode();
}

function applyPartMode() {
  const it = PV.item;
  const img = $('partImg'), ph = $('partPlaceholder'), cv = $('cvPart');
  if (!it || !img || !ph) return;
  const is3d = PV.mode === '3d';

  if ($('btnPartMode')) $('btnPartMode').textContent = _t(is3d ? 'btnPhoto' : 'btn3d');
  if ($('partModeLabel')) $('partModeLabel').textContent = _t(is3d ? 'mode3d' : 'modePhoto');
  if ($('partHint')) $('partHint').textContent = is3d
    ? _t('hint3d')
    : _t('hintTap');

  if (is3d) {
    img.classList.add('hide');
    ph.classList.add('hide');
    PV.tok++;
    if (cv && initPV()) {
      cv.classList.remove('hide');
      build3DPart(it);
    } else {
      if (cv) cv.classList.add('hide');
      $('partPhText').textContent = _t('ph3dFail');
      ph.classList.remove('hide');
    }
    return;
  }

  if (cv) cv.classList.add('hide');
  const typeFolder = imageFolderFor(getForkliftModelType());
  const cands = partImageCandidates(it, partKeyFor(it, CUR.elec));
  PV.src = '';

  const showPh = msg => {
    img.classList.add('hide');
    ph.classList.remove('hide');
    $('partPhText').textContent = msg;
    PV.src = '';
  };

  if (!cands.length) {
    img.removeAttribute('src');
    showPh(_t('phHint', { folder: typeFolder }));
    return;
  }

  const tok = PV.tok = PV.tok + 1;
  const tryLoad = i => {
    const url = cands[i];
    const pre = new Image();
    pre.onload = () => {
      if (tok !== PV.tok) return;
      img.src = url;
      img.alt = it.point;
      ph.classList.add('hide');
      img.classList.remove('hide');
      PV.src = url;
    };
    pre.onerror = () => {
      if (tok !== PV.tok) return;
      if (i + 1 < cands.length) tryLoad(i + 1);
      else showPh(_t('phNoFile') + (cands[0].length > 80 ? cands[0].slice(0, 60) + '…' : cands[0]));
    };
    pre.src = url;
  };
  tryLoad(0);
}

function togglePartMode() {
  PV.mode = PV.mode === '3d' ? 'photo' : '3d';
  try { localStorage.setItem('fl_part_mode', PV.mode); } catch (e) {}
  if (PV.hidden) togglePartBox();
  applyPartMode();
}

function initPV() {
  if (PV.inited) return true;
  try {
    if (!window.THREE) return false;
    const cv = $('cvPart');
    if (!cv) return false;
    PV.st = makeStage(cv, 3);
    PV.st.sun.position.set(3, 6, 4);
    PV.st.camera.fov = 34;
    PV.st.camera.updateProjectionMatrix();

    cv.addEventListener('pointerdown', e => {
      PV.drag = { x: e.clientX, y: e.clientY };
      PV.auto = false;
      cv.setPointerCapture(e.pointerId);
    });
    cv.addEventListener('pointermove', e => {
      if (!PV.drag) return;
      PV.rotY -= (e.clientX - PV.drag.x) * 0.012;
      PV.rotX = Math.max(-0.15, Math.min(1.25, PV.rotX + (e.clientY - PV.drag.y) * 0.01));
      PV.drag.x = e.clientX;
      PV.drag.y = e.clientY;
    });
    const end = () => { PV.drag = null; };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    cv.addEventListener('dblclick', () => { PV.auto = true; PV.zoom = 5.2; PV.rotX = 0.35; });
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      PV.zoom = Math.max(3, Math.min(8, PV.zoom + (e.deltaY > 0 ? 0.4 : -0.4)));
    }, { passive: false });

    PV.inited = true;
    return true;
  } catch (err) {
    console.warn('Part viewer skipped:', err);
    return false;
  }
}

function build3DPart(it) {
  const isElec = isCurElectric();
  BODY_C = isElec ? 0xd23f0a : 0xf28200;
  const key = partKeyFor(it, isElec);
  const def = PART_DEFS[key] || PART_DEFS.generic;

  if (PV.pivot) { PV.st.scene.remove(PV.pivot); disposeObj(PV.pivot); }
  const part = def.build(true, { elec: isElec, subtype: CUR.forklift ? model3dOf(CUR.forklift) : '' });
  const box = new THREE.Box3().setFromObject(part);
  const size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
  const s = 2.0 / Math.max(size.x, size.y, size.z, 0.001);
  part.scale.setScalar(s);
  part.position.set(-ctr.x * s, -ctr.y * s, -ctr.z * s);

  const pivot = new THREE.Group();
  pivot.add(part);
  const floorY = -(size.y * s) / 2 - 0.04;
  put(pivot, new THREE.CylinderGeometry(1.68, 1.76, 0.07, 64), M(0x94a3b8, { roughness: 0.25, metalness: 0.85 }), 0, floorY - 0.05, 0);
  put(pivot, new THREE.CylinderGeometry(1.58, 1.62, 0.04, 64), M(0x1e293b, { roughness: 0.7, metalness: 0.3 }), 0, floorY - 0.01, 0);
  put(pivot, new THREE.TorusGeometry(1.56, 0.016, 12, 72), warningYellow(), 0, floorY + 0.005, 0, PI / 2);
  put(pivot, new THREE.TorusGeometry(1.0, 0.008, 8, 64), M(0x475569, { roughness: 0.5 }), 0, floorY + 0.004, 0, PI / 2);
  put(pivot, new THREE.TorusGeometry(0.5, 0.008, 8, 48), M(0x475569, { roughness: 0.5 }), 0, floorY + 0.004, 0, PI / 2);
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * PI * 2;
    const isMajor = k % 3 === 0;
    const tickLen = isMajor ? 0.22 : 0.12;
    const rMid = 1.44 - tickLen / 2;
    BX(pivot, 0.014, 0.004, tickLen, isMajor ? warningYellow() : M(0x64748b), Math.sin(a) * rMid, floorY + 0.006, Math.cos(a) * rMid, 0, a, 0);
  }
  shadowize(pivot);
  PV.st.scene.add(pivot);
  PV.pivot = pivot;
  PV.auto = true;
  PV.st.sun.target = pivot;
}

function renderPartStage() {
  if (PV.mode !== '3d' || !PV.inited || !PV.pivot) return;
  const cv = $('cvPart');
  if (!cv || !cv.offsetParent || !fitStage(PV.st, cv)) return;
  if (PV.auto) PV.rotY += 0.009;
  const cam = PV.st.camera;
  const Z = PV.zoom * Math.min(1.6, Math.max(1, 1.25 / cam.aspect));
  cam.position.set(Math.sin(PV.rotY) * Math.cos(PV.rotX) * Z, Math.sin(PV.rotX) * Z, Math.cos(PV.rotY) * Math.cos(PV.rotX) * Z);
  cam.lookAt(0, 0, 0);
  PV.st.renderer.render(PV.st.scene, cam);
}

function openPartImage() {
  if (!PV.src) return;
  $('imgModalPic').src = PV.src;
  $('imgModalCap').textContent = $('partName').textContent;
  $('imgModal').classList.remove('hide');
}

function closePartImage() {
  $('imgModal').classList.add('hide');
}

function togglePartBox() {
  PV.hidden = !PV.hidden;
  $('partStage').classList.toggle('hide', PV.hidden);
  $('btnPartToggle').textContent = _t(PV.hidden ? 'show' : 'hide');
}

async function loadDash() {
  const r = await apiPost('getDashboard', { token: TOKEN });
  if (!(r.ok && r.data)) {
    if (r.code !== 'AUTH') toast(_tr(r.error || _t('loadStatsFail')), 5000);
    return;
  }

  try {
    const d = r.data;
    const series = d.series || [];

    $('kTotal').textContent = d.total || 0;
    $('kNg').textContent = d.ngToday || 0;
    $('kPend').textContent = d.pending || 0;

    const okCount = series.reduce((a, s) => a + (s.ok || 0), 0);
    const ngCount = series.reduce((a, s) => a + (s.ng || 0), 0);
    const totalAll = okCount + ngCount;
    const rate = totalAll ? Math.round((okCount / totalAll) * 100) : 0;

    $('kRate').textContent = totalAll ? rate + '%' : '-';
    $('ringTxt').textContent = totalAll ? rate + '%' : '-';
    $('ring').style.setProperty('--p', rate);
    $('ring').style.background = totalAll ? '' : '#cbd5e1';

    const maxVal = Math.max(1, ...series.map(s => (s.ok || 0) + (s.ng || 0)));
    $('bars').innerHTML = series.map(s => {
      const sum = (s.ok || 0) + (s.ng || 0);
      return `
        <div class="bar">
          <span>${sum || ''}</span>
          <i class="n" style="height:${(s.ng || 0) / maxVal * 100}%" title="NG: ${s.ng || 0}"></i>
          <i class="o" style="height:${(s.ok || 0) / maxVal * 100}%" title="OK: ${s.ok || 0}"></i>
          ${esc(s.d)}
        </div>`;
    }).join('');

    const tag = s => `<span class="tag ${esc(s)}">${s === 'OK' ? _t('tagOk') : s === 'NG' ? _t('tagNg') : _t('tagPend')}</span>`;
    $('mgrid').innerHTML = (d.forklifts || []).map(m => {
      const ki = typeInfo(m);
      return `
        <div class="mc ${esc(m.status)}">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <h3>🚜 ${esc(_tr(m.name))}</h3>
            <span class="badge-tag ${esc(ki.badge)}">${esc(ki.icon)} ${esc(_tr(ki.label) || _t('noType'))}</span>
          </div>
          <small>${esc(m.id)} · ${esc(_tr(m.loc))}</small>
          <small>${esc(_t('ownerLbl'))}: ${esc(m.owner)}</small>
          <small>⚖️ ${esc(_t('capLbl'))}: ${esc(m.capacity || '-')}</small>
          <p>
            ${tag(m.status)}
            ${m.checkedToday ? '<span class="today">' + _t('checkedToday') + '</span>' : '<span class="today" style="color:var(--mute)">' + _t('notChecked') + '</span>'}
          </p>
          <p style="font-size:12px; color:var(--mute);">${esc(_t('lastLbl'))} ${esc(m.last || '-')}${m.by ? ' · ' + esc(m.by) : ''}</p>
          ${m.ng ? `<p style="color:var(--ng); font-weight:600; font-size:12.5px;">${esc(_t('ngPoints'))} ${esc(m.ng)}</p>` : ''}
        </div>`;
    }).join('');

    const recent = d.recent || [];
    $('tRecent').innerHTML = `
      <tr>
        <th>${_t('thTime')}</th>
        <th>${_t('thBy')}</th>
        <th>${_t('thFl')}</th>
        <th>${_t('thResult')}</th>
        <th>${_t('thNg')}</th>
      </tr>` + (recent.length ? recent.map(x => `
      <tr>
        <td>${esc(x.t)}</td>
        <td>${esc(x.by)}</td>
        <td><b>${esc(_tr(x.forklift))}</b></td>
        <td>${tag(x.status)}</td>
        <td>${x.ng ? `<b style="color:var(--ng)">[${esc(x.ng)}]</b> ` : ''}${esc(x.note || '-')}</td>
      </tr>`).join('') : `
      <tr><td colspan="5" style="text-align:center; padding:20px; color:var(--mute);">${_t('noHistory')}</td></tr>`);
  } catch (err) {
    console.error(err);
    toast(_t('showStatsFail'));
  }
}

function initCompactHeader() {
  const top = $('top');
  if (!top) return;
  const mq = window.matchMedia('(max-width: 820px)');
  let ticking = false;
  const update = () => {
    ticking = false;
    const y = window.scrollY || document.documentElement.scrollTop || 0;
    if (!mq.matches) { top.classList.remove('compact'); return; }
    if (y > 100) top.classList.add('compact');
    else if (y < 15) top.classList.remove('compact');
  };
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  window.addEventListener('resize', update);
  update();
}

function bindEvents() {
  $('keys').onclick = e => { const k = e.target.dataset.k; if (k) pressKey(k); };
  $('selDept').onchange = () => { loginMsg(''); fillNames(); };
  $('selName').onchange = () => {
    loginMsg('');
    const p = PEOPLE.find(x => x.id === $('selName').value);
    if (p && p.dept && !$('selDept').value) $('selDept').value = p.dept;
    if (pin.length === 4 && $('selName').value) doLogin();
  };
  $('selName').addEventListener('focus', () => { if (!PEOPLE.length) loadNames(); });
  $('selFormDept').onchange = populateForkliftSelect;
  $('selForklift').onchange = pickForklift;
  $('plist').onclick = e => {
    const btn = e.target.closest('button');
    if (btn) selectInspectionPoint(+btn.dataset.p);
  };
  $('boxFocusView').oninput = onNgInput;
  $('boxFocusView').onclick = e => {
    const b = e.target.closest('[data-act="res"]');
    if (b) setFocusResult(b.dataset.id, b.dataset.val);
  };
  $('boxFocusView').onchange = e => {
    const c = e.target.dataset.fc;
    if (c) cres[c] = e.target.checked;
  };
}

window.addEventListener('keydown', e => {
  if (e.key === 'Escape') closePartImage();
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
  const vLogin = $('vLogin');
  if (!vLogin || vLogin.classList.contains('hide')) return;
  if (/^[0-9]$/.test(e.key)) pressKey(e.key);
  else if (e.key === 'Backspace') pressKey('⌫');
  else if (e.key === 'Enter') { e.preventDefault(); doLogin(); }
});

window.addEventListener('DOMContentLoaded', () => {
  initCompactHeader();
  syncStaticLabels();
  buildKeys();
  drawDots();
  bindEvents();
  window.addEventListener('online', syncOfflineQueue);
  if (TOKEN) { enter(); syncOfflineQueue(); } else show('login');
});

function forkliftLabel(m) {
  const ki = typeInfo(m);
  const typeText = _tr(m.vehicleType || ki.label || _t('noType'));
  return `${m.id} - ${_tr(m.name)} [${ki.icon} ${typeText}]`;
}

function renderMinfo(m) {
  if (!m) return;
  const ki = typeInfo(m);
  const typeText = _tr(m.vehicleType || ki.label || _t('noType'));
  const badgeText = `${ki.icon} ${typeText} (${_t('itemsN', { n: CUR.items.length })})`;
  $('minfo').innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; flex-wrap:wrap; gap:6px;">
      <b>🚜 ${esc(_tr(m.name))} (${esc(m.id)})</b>
      <span class="badge-tag ${esc(ki.badge)}">${esc(badgeText)}</span>
    </div>
    <div style="font-size:13px; color:var(--mute); line-height:1.6;">
      <span>🚗 <b>${esc(_t('lblVehicleType') || 'ประเภทรถ')}:</b> ${esc(typeText)}</span> &nbsp;·&nbsp;
      <span>🏢 <b>${esc(_t('mDept'))}:</b> ${esc(_tr(m.dept) || '-')}</span><br>
      <span>📍 <b>${esc(_t('mLoc'))}:</b> ${esc(_tr(m.loc))}</span> &nbsp;·&nbsp;
      <span>👤 <b>${esc(_t('mOwner'))}:</b> ${esc(m.owner)}</span> &nbsp;·&nbsp;
      <span>⚖️ <b>${esc(_t('mCap'))}:</b> ${esc(m.capacity || '-')}</span>
    </div>`;
}

function renderDeptOptions() {
  const cur = $('selDept').value;
  const ds = [...new Set(PEOPLE.map(p => (p.dept || '').trim()).filter(Boolean))];
  $('selDept').innerHTML = '<option value="">' + _t('allDepts') + '</option>' +
    ds.map(d => `<option value="${esc(d)}">${esc(_tr(d))}</option>`).join('');
  $('selDept').value = cur;
}

function syncStaticLabels() {
  const is3d = PV.mode === '3d';
  if ($('btnLabels')) $('btnLabels').textContent = _t(V3.showLabels ? 'hideNum' : 'showNum');
  if ($('btnPartToggle')) $('btnPartToggle').textContent = _t(PV.hidden ? 'show' : 'hide');
  if ($('btnPartMode')) $('btnPartMode').textContent = _t(is3d ? 'btnPhoto' : 'btn3d');
  if ($('partModeLabel')) $('partModeLabel').textContent = _t(is3d ? 'mode3d' : 'modePhoto');
  if ($('partHint')) $('partHint').textContent = _t(is3d ? 'hint3d' : 'hintTap');
}

function refreshLangForm() {
  const d = $('selFormDept');
  if (d.options[0]) d.options[0].textContent = _t('allDeptsShow');
  [...d.options].slice(1).forEach(o => { o.textContent = _tr(o.value); });
  [...$('selForklift').options].forEach(o => {
    const m = FORM.forklifts.find(x => x.id === o.value);
    if (m) o.textContent = forkliftLabel(m);
  });
  renderMinfo(CUR.forklift);
  updateProgress();
  renderFocusView();
  showPartViewer(curFocusIdx);
}

window.addEventListener('langchange', () => {
  setApiStatus(window._apiState !== false);
  syncStaticLabels();
  if (PEOPLE.length) { renderDeptOptions(); fillNames(); }
  if (FORM && CUR.forklift) refreshLangForm();
  const vd = $('vDash');
  if (vd && !vd.classList.contains('hide')) loadDash();
});

let deferredInstall = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstall = e;
  const b = $('btnInstall');
  if (b) b.classList.remove('hide');
});

window.addEventListener('appinstalled', () => {
  deferredInstall = null;
  const b = $('btnInstall');
  if (b) b.classList.add('hide');
  toast('✓ ' + _t('installBtn').replace('📲 ', ''));
});

window.addEventListener('DOMContentLoaded', () => {
  const b = $('btnInstall');
  if (b) b.onclick = async () => {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    try { await deferredInstall.userChoice; } catch (e) {}
    deferredInstall = null;
    b.classList.add('hide');
  };
  
  const standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  if (/iphone|ipad|ipod/i.test(navigator.userAgent) && !standalone && $('iosHint')) $('iosHint').classList.remove('hide');
});

if ('serviceWorker' in navigator && (location.protocol === 'https:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname))) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('Service worker skipped:', err));
  });
}