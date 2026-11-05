const API_URL = 'https://script.google.com/macros/s/AKfycbzbQznbfx7OxvAr0MwQc-wdWOG0UdTNepOsenOGoj3ZsFx-v1kyDR-3XI96bbtoqYtT/exec';
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
  if (!m) return { group: 'engine', icon: '🚜', badge: 'badge-other', label: '' };
  const label = String(m.model || '').trim();
  if (m.group) return { group: m.group, icon: m.icon || '🚜', badge: m.badge || 'badge-other', label };
  return /ไฟฟ้า|electric/i.test(label || m.name || '')
    ? { group: 'electric', icon: '⚡', badge: 'badge-elec', label }
    : { group: 'engine', icon: '⛽', badge: 'badge-gas', label };
};
const forkliftKind = m => typeInfo(m).group;
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

function getCleaningForPoint(item) {
  const list = CUR.clean;
  if (!list.length) return [];
  const point = (item.point || '').toLowerCase();
  const matched = list.filter(c => {
    const text = ((c.area || '') + ' ' + (c.task || '')).toLowerCase();
    if (/ล้อ|ยาง/.test(point) && /ล้อ|เพลา/.test(text)) return true;
    if (/เสา|งา|โซ่|ไฮดรอลิค/.test(point) && /เสา|ชุดยก/.test(text)) return true;
    if (/หม้อพักน้ำ|น้ำมันเครื่อง|เครื่องยนต์/.test(point) && /ระบายความร้อน|เครื่องยนต์/.test(text)) return true;
    if (/แบตเตอร์รี่|ปลั๊กชาร์จ|น้ำกลั่น/.test(point) && /แบตเตอรี่|ความปลอดภัยก่อนเริ่ม/.test(text)) return true;
    if (/พวงมาลัย|เบรค|กระจก|เข็มขัด|ไฟ|แตร/.test(point) && /ห้องคนขับ|เบาะนั่ง/.test(text)) return true;
    return false;
  });
  return matched.length ? matched : [list[0]];
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
    const r = await apiGet('getFormData', { token: TOKEN });
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
  if (!V3.inited) showPartViewer(curFocusIdx);   // 3D โหลดไม่ได้ ก็ยังแสดงรูปชิ้นส่วนได้
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

/* ---------- Focus view (ตรวจทีละจุด) ---------- */
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

async function saveInspection() {
  const its = CUR.items;
  const m = CUR.forklift;
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
    const r = await apiPost('submitCheck', {
      token: TOKEN,
      data: {
        submitId,
        forkliftId: m.id,
        results: res,
        ngDetails,
        cleaning: cres,
        cleaningRequired: isMondayCleaningDay(),
        note: $('note').value.trim()
      }
    });

    if (!r.ok) {
      if (r.code === 'AUTH') return;
      toast(r.network ? _t('netNotSaved', { err: r.error }) : _tr(r.error || r.msg || _t('saveFail')), 6000);
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
let BODY_C = 0xff8a1c;

const V3 = {
  inited: false, st: null, root: null, drag: null,
  theta: 0.75, phi: 1.15, dist: 13, autoRotate: true,
  parts: [], selectedPart: -1, target: null, tgoal: null, showLabels: true
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
const bodyMat = () => M(BODY_C, { roughness: 0.32, metalness: 0.4 });

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

function pEngine() {
  const g = new THREE.Group();
  RB(g, 0.9, 0.62, 0.95, M(0x5b6672, { metalness: 0.7, roughness: 0.42 }), 0, 0, 0, 0.07);
  RB(g, 0.84, 0.14, 0.9, M(0x2b3138, { metalness: 0.5, roughness: 0.5 }), 0, 0.38, 0, 0.04);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) CY(g, 0.028, 0.04, steel(), (i - 1) * 0.28, 0.46, j ? 0.3 : -0.3);
  RB(g, 0.72, 0.18, 0.82, dark(), 0, -0.4, 0, 0.05);
  CY(g, 0.02, 0.5, steel(), 0.5, 0.12, 0.2);
  TR(g, 0.045, 0.012, M(0xfacc15, { roughness: 0.4 }), 0.5, 0.4, 0.2, 0, PI / 2);
  CY(g, 0.09, 0.07, M(0xdc2626, { roughness: 0.5 }), -0.38, 0.47, -0.2);
  CY(g, 0.1, 0.02, dark(), -0.38, 0.43, -0.2);
  TB(g, [[-0.46, 0.2, 0.3], [-0.62, 0.2, 0.12], [-0.62, 0.1, -0.28], [-0.46, 0, -0.46]], 0.05, M(0x7c5a47, { metalness: 0.8, roughness: 0.65 }));
  CY(g, 0.2, 0.07, steel(), 0, -0.05, 0.52, 'z');
  TR(g, 0.2, 0.02, rubber(), 0, -0.05, 0.52);
  CY(g, 0.1, 0.28, M(0xea580c, { metalness: 0.4, roughness: 0.5 }), -0.52, -0.12, 0.2, 'x');
  return g;
}

function pCoolant() {
  const g = new THREE.Group();
  BX(g, 1.3, 0.85, 0.16, M(0x2a2f36, { metalness: 0.6 }), 0, 0, 0);
  const fin = M(0xaeb7c2, { metalness: 0.9, roughness: 0.4 });
  for (let i = -30; i <= 30; i++) BX(g, 0.012, 0.8, 0.17, fin, i * 0.0205, 0, 0);
  RB(g, 1.4, 0.14, 0.24, M(0x3a424c, { metalness: 0.6 }), 0, 0.5, 0, 0.05);
  RB(g, 1.4, 0.14, 0.24, M(0x3a424c, { metalness: 0.6 }), 0, -0.5, 0, 0.05);
  TR(g, 0.4, 0.035, dark(), 0, 0, 0.18);
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * PI * 2 + 0.3;
    BX(g, 0.34, 0.09, 0.015, dark(), Math.cos(a) * 0.19, Math.sin(a) * 0.19, 0.18, 0, 0, a);
  }
  CY(g, 0.07, 0.06, steel(), 0, 0, 0.18, 'z');
  RB(g, 0.26, 0.5, 0.2, GL(0xe8f1f8, 0.35), 0.5, 0.85, 0, 0.04);
  RB(g, 0.23, 0.28, 0.17, M(0x4ade80, { transparent: true, opacity: 0.85, emissive: 0x0f5132, emissiveIntensity: 0.4, roughness: 0.2 }), 0.5, 0.74, 0, 0.03);
  BX(g, 0.27, 0.014, 0.205, dark(), 0.5, 0.96, 0);
  BX(g, 0.27, 0.014, 0.205, dark(), 0.5, 0.72, 0);
  CY(g, 0.07, 0.07, M(0xdc2626, { roughness: 0.5 }), 0.5, 1.13, 0);
  TB(g, [[0.5, 0.6, 0], [0.55, 0.52, 0.04], [0.6, 0.45, 0.08]], 0.025, rubber());
  return g;
}

function pBrakeFluid() {
  const g = new THREE.Group();
  RB(g, 0.7, 0.06, 0.3, dark(), 0, -0.18, 0, 0.02);
  CY(g, 0.07, 0.5, M(0x7b8794, { metalness: 0.8, roughness: 0.4 }), 0, -0.06, 0, 'x');
  CY(g, 0.02, 0.35, chrome(), 0.42, -0.06, 0, 'x');
  [-0.18, 0.18].forEach((x, i) => {
    RB(g, 0.2, 0.3, 0.16, GL(0xf1f5f9, 0.4), x, 0.12, 0, 0.03);
    RB(g, 0.17, 0.17, 0.13, M(i ? 0xfbbf24 : 0xf59e0b, { transparent: true, opacity: 0.85, emissive: 0x7c4a03, emissiveIntensity: 0.3, roughness: 0.2 }), x, 0.05, 0, 0.02);
    CY(g, 0.075, 0.06, rubber(), x, 0.3, 0);
    BX(g, 0.2, 0.01, 0.165, dark(), x, 0.2, 0);
  });
  TB(g, [[-0.3, -0.06, 0], [-0.45, -0.2, 0.1], [-0.5, -0.4, 0.3]], 0.02, steel());
  TB(g, [[-0.25, -0.1, 0.05], [-0.4, -0.3, -0.05], [-0.48, -0.5, 0.1]], 0.02, steel());
  return g;
}

function pBattery(solo) {
  const g = new THREE.Group();
  RB(g, 0.62, 0.4, 0.34, M(0x1e3a5f, { roughness: 0.7, metalness: 0.1 }), 0, 0, 0, 0.03);
  RB(g, 0.64, 0.06, 0.36, M(0x0f2742, { roughness: 0.7, metalness: 0.1 }), 0, 0.2, 0, 0.02);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) CY(g, 0.032, 0.045, M(0xf1f5f9, { roughness: 0.6 }), (i - 1) * 0.18, 0.25, (j - 0.5) * 0.16);
  CY(g, 0.028, 0.09, M(0x9ca3af, { metalness: 0.9 }), -0.26, 0.26, -0.1);
  CY(g, 0.028, 0.09, M(0x9ca3af, { metalness: 0.9 }), 0.26, 0.26, -0.1);
  RB(g, 0.08, 0.05, 0.08, M(0xdc2626), -0.26, 0.3, -0.1, 0.01);
  RB(g, 0.08, 0.05, 0.08, M(0x111827), 0.26, 0.3, -0.1, 0.01);
  BX(g, 0.3, 0.12, 0.006, M(0xfacc15), 0, 0, 0.172);
  TR(g, 0.08, 0.012, dark(), 0, 0.24, 0.14, PI / 2);
  if (solo) {
    CY(g, 0.1, 0.3, GL(0xffffff, 0.55), 0.7, -0.05, 0);
    CY(g, 0.088, 0.2, M(0x7dd3fc, { transparent: true, opacity: 0.75, roughness: 0.1 }), 0.7, -0.1, 0);
    CY(g, 0.045, 0.05, M(0x2563eb), 0.7, 0.13, 0);
  }
  return g;
}

function pBatteryElec() {
  const g = new THREE.Group();
  RB(g, 1.6, 0.82, 1.4, M(0x3b4a5a, { metalness: 0.6, roughness: 0.5 }), 0, 0, 0, 0.06);
  RB(g, 1.64, 0.08, 1.44, M(0x1b222b, { metalness: 0.4, roughness: 0.6 }), 0, 0.45, 0, 0.03);
  for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) {
    const x = (i - 2.5) * 0.26, z = (j - 0.5) * 0.5;
    CY(g, 0.06, 0.07, M(0xf1f5f9, { roughness: 0.6 }), x, 0.52, z);
    CY(g, 0.018, 0.05, M(0x22c55e, { emissive: 0x16a34a, emissiveIntensity: 0.5 }), x, 0.58, z);
  }
  [-0.5, 0.5].forEach(z => BX(g, 1.7, 0.05, 0.08, M(0xfacc15, { roughness: 0.5 }), 0, 0.5, z * 1.2));
  TB(g, [[0.55, 0.5, -0.6], [0.7, 0.7, -0.55], [0.9, 0.65, -0.3], [0.95, 0.3, -0.1]], 0.05, M(0xdc2626, { roughness: 0.6 }));
  RB(g, 0.12, 0.2, 0.2, M(0xdc2626), 0.95, 0.1, -0.1, 0.03);
  return g;
}

function pTerminals() {
  const g = new THREE.Group();
  RB(g, 0.7, 0.1, 0.35, dark(), 0, -0.15, 0, 0.03);
  [[-0.2, 0xdc2626], [0.2, 0x111827]].forEach(([x, col]) => {
    CY(g, 0.05, 0.22, M(0x9ca3af, { metalness: 0.9, roughness: 0.3 }), x, 0, 0);
    RB(g, 0.16, 0.1, 0.14, M(col, { roughness: 0.5 }), x, 0.1, 0, 0.03);
    HX(g, 0.025, 0.06, chrome(), x, 0.1, 0.09, 'z');
    CY(g, 0.07, 0.1, M(col, { roughness: 0.6 }), x, 0.2, 0);
    TB(g, [[x, 0.1, -0.08], [x, 0.0, -0.3], [x * 1.4, -0.1, -0.6]], 0.035, M(col, { roughness: 0.6 }));
  });
  return g;
}

function pChargePlug() {
  const g = new THREE.Group();
  RB(g, 0.34, 0.24, 0.42, M(0xdc2626, { roughness: 0.5, metalness: 0.1 }), 0, 0, 0, 0.05);
  RB(g, 0.2, 0.14, 0.3, M(0x374151, { roughness: 0.7 }), 0, 0.17, -0.05, 0.04);
  [-0.07, 0.07].forEach(x => CY(g, 0.045, 0.22, M(0xb87333, { metalness: 1, roughness: 0.25 }), x, 0, 0.3, 'z'));
  CY(g, 0.1, 0.12, dark(), 0, 0, -0.26, 'z');
  TB(g, [[0, 0, -0.3], [0, -0.1, -0.55], [0.2, -0.3, -0.8], [0.4, -0.4, -1.0]], 0.07, rubber());
  RB(g, 0.5, 0.4, 0.12, dark(), 0, 0, 0.62, 0.04);
  [-0.07, 0.07].forEach(x => CY(g, 0.05, 0.04, M(0x0b0e12), x, 0, 0.56, 'z'));
  return g;
}

function pHydTank() {
  const g = new THREE.Group();
  RB(g, 0.38, 0.8, 0.9, M(0x0d5c82, { metalness: 0.5, roughness: 0.45 }), 0, 0, 0, 0.05);
  [-0.2, 0.15].forEach(y => BX(g, 0.4, 0.035, 0.92, M(0x0a4a69, { metalness: 0.5 }), 0, y, 0));
  CY(g, 0.1, 0.04, chrome(), 0.2, 0.1, 0.2, 'x');
  CY(g, 0.08, 0.05, GL(0xf59e0b, 0.8), 0.215, 0.1, 0.2, 'x');
  BX(g, 0.02, 0.2, 0.05, dark(), 0.22, 0.1, 0.34);
  CY(g, 0.09, 0.1, dark(), 0, 0.45, -0.2);
  CY(g, 0.05, 0.12, steel(), 0, 0.55, -0.2);
  HX(g, 0.04, 0.06, steel(), 0.2, -0.36, 0.3, 'x');
  TB(g, [[0, 0.3, 0.45], [0.05, 0.5, 0.5], [-0.1, 0.65, 0.65]], 0.04, M(0x16191f));
  return g;
}

function pMast() {
  const g = new THREE.Group();
  const st = () => M(0x2f3944, { metalness: 0.7, roughness: 0.45 });
  const lt = () => M(0x7b8794, { metalness: 0.8, roughness: 0.38 });
  const cm = () => M(0x1f2630, { metalness: 0.6, roughness: 0.5 });
  [-1, 1].forEach(s => {
    RB(g, 0.2, 3.3, 0.26, st(), s * 0.7, 1.65, 0, 0.03);
    RB(g, 0.15, 3.1, 0.18, lt(), s * 0.5, 1.7, 0.1, 0.02);
    CY(g, 0.07, 0.75, st(), s * 0.84, 0.95, -0.6, 'z');
    CY(g, 0.035, 0.6, chrome(), s * 0.84, 0.95, -0.15, 'z');
  });
  BX(g, 1.6, 0.1, 0.14, st(), 0, 3.3, 0);
  BX(g, 1.5, 0.12, 0.2, st(), 0, 0.2, 0);
  CY(g, 0.11, 1.5, st(), 0, 0.95, -0.2);
  CY(g, 0.075, 1.8, chrome(), 0, 1.7, -0.2);
  RB(g, 1.52, 0.12, 0.12, cm(), 0, 0.42, 0.2, 0.02);
  RB(g, 1.52, 0.12, 0.12, cm(), 0, 1.05, 0.2, 0.02);
  for (let i = -3; i <= 3; i++) RB(g, 0.06, 1.3, 0.06, cm(), i * 0.2, 1.1, 0.22, 0.02);
  RB(g, 1.4, 0.07, 0.07, cm(), 0, 1.75, 0.22, 0.02);
  RB(g, 1.4, 0.06, 0.06, cm(), 0, 1.4, 0.22, 0.02);
  [-0.45, 0.45].forEach(x => {
    const f = new THREE.Group();
    f.position.set(x, 0.06, 0.27);
    const fm = () => M(0x8b95a1, { metalness: 0.85, roughness: 0.38 });
    RB(f, 0.17, 0.85, 0.07, fm(), 0, 0.43, 0, 0.02);
    const sh = new THREE.Shape();
    sh.moveTo(0, 0); sh.lineTo(1.5, 0); sh.lineTo(1.5, 0.03); sh.lineTo(0.3, 0.075); sh.lineTo(0, 0.075); sh.lineTo(0, 0);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.17, bevelEnabled: false });
    geo.translate(0, 0, -0.085);
    const b = new THREE.Mesh(geo, fm());
    b.rotation.y = -PI / 2;
    b.position.z = -0.035;
    f.add(b);
    BX(f, 0.12, 0.03, 0.12, M(0xfacc15), 0, 0.88, 0);
    g.add(f);
  });
  return g;
}

function pWheel(solo, ctx) {
  const g = new THREE.Group(), el = ctx && ctx.elec;
  if (solo) {
    wheelAt(g, el ? 0.42 : 0.5, el ? 0.34 : 0.38, el, 1, 0, 0, 0);
    CY(g, 0.07, 0.5, steel(), -0.35, 0, 0, 'x');
    return g;
  }
  [-1, 1].forEach(s => {
    wheelAt(g, 0.5, 0.38, el, s, s * 1.0, 0.5, 0.9);
    wheelAt(g, 0.42, 0.32, el, s, s * 0.82, 0.42, -1.3);
  });
  return g;
}

function pHoses() {
  const g = new THREE.Group();
  const hose = () => M(0x16191f, { roughness: 0.7, metalness: 0.1 });
  RB(g, 0.9, 0.28, 0.22, M(0xd9a406, { metalness: 0.6, roughness: 0.4 }), 0, 1.3, -0.8, 0.03);
  [-0.2, 0.2].forEach(x => {
    CY(g, 0.015, 0.3, steel(), x, 1.5, -0.8);
    SP(g, 0.04, M(0xdc2626, { roughness: 0.4 }), x, 1.66, -0.8);
  });
  [-1, 1].forEach(s => {
    const a = [[s * 0.4, 1.3, -0.72], [s * 0.46, 1.2, -0.4], [s * 0.42, 1.6, -0.26], [s * 0.4, 2.3, -0.25], [s * 0.38, 3.05, -0.25]];
    const b = [[s * 0.28, 1.3, -0.72], [s * 0.3, 1.1, -0.45], [s * 0.3, 1.5, -0.3], [s * 0.3, 2.3, -0.3], [s * 0.3, 3.0, -0.3]];
    TB(g, a, 0.034, hose());
    TB(g, b, 0.028, hose());
    [a, b].forEach((p, i) => {
      HX(g, 0.055, 0.1, chrome(), p[0][0], p[0][1], p[0][2] - 0.03, 'z');
      HX(g, 0.055, 0.1, chrome(), p[4][0], p[4][1] + 0.02, p[4][2]);
      CY(g, 0.04, 0.08, M(i ? 0x2563eb : 0xdc2626, { roughness: 0.5 }), p[3][0], p[3][1], p[3][2]);
    });
  });
  return g;
}

function headlight(g, x, y, z, s) {
  const h = new THREE.Group();
  h.position.set(x, y, z);
  if (s) h.scale.setScalar(s);
  RB(h, 0.3, 0.24, 0.16, dark(), 0, 0, -0.02, 0.04);
  CY(h, 0.1, 0.04, chrome(), 0, 0, 0.07, 'z');
  CY(h, 0.085, 0.03, M(0xfff4c2, { emissive: 0xffe9a0, emissiveIntensity: 0.8, roughness: 0.1 }), 0, 0, 0.09, 'z');
  g.add(h);
}
function taillight(g, x, y, z, s) {
  const h = new THREE.Group();
  h.position.set(x, y, z);
  if (s) h.scale.setScalar(s);
  RB(h, 0.3, 0.14, 0.08, M(0xb91c1c, { emissive: 0xff2020, emissiveIntensity: 0.35, roughness: 0.2 }), 0, 0, 0, 0.03);
  RB(h, 0.1, 0.1, 0.085, M(0xf8fafc, { emissive: 0xffffff, emissiveIntensity: 0.3 }), 0.1, 0, 0, 0.02);
  g.add(h);
}
function beacon(g, x, y, z, s) {
  const h = new THREE.Group();
  h.position.set(x, y, z);
  if (s) h.scale.setScalar(s);
  CY(h, 0.1, 0.06, dark(), 0, 0, 0);
  put(h, new THREE.SphereGeometry(0.15, 24, 14, 0, PI * 2, 0, PI / 2), M(0xf59e0b, { emissive: 0xf59e0b, emissiveIntensity: 0.7, transparent: true, opacity: 0.9, side: THREE.DoubleSide }), 0, 0.03, 0);
  g.add(h);
}
function horn(g, x, y, z, s) {
  const h = new THREE.Group();
  h.position.set(x, y, z);
  if (s) h.scale.setScalar(s);
  CY(h, 0.07, 0.1, M(0x374151, { metalness: 0.7 }), 0, 0, -0.1, 'z');
  CN(h, 0.15, 0.05, 0.22, M(0x6b7280, { metalness: 0.9, roughness: 0.3 }), 0, 0, 0.05, 'z');
  g.add(h);
}
function pLights(solo) {
  const g = new THREE.Group();
  if (solo) {
    headlight(g, -0.55, 0, 0, 1.4);
    taillight(g, -0.05, 0, 0, 1.4);
    beacon(g, 0.45, -0.05, 0, 1.2);
    horn(g, 0.95, 0, 0, 1.2);
    return g;
  }
  [-1, 1].forEach(s => { headlight(g, s * 0.8, 3.05, 0.68); taillight(g, s * 0.8, 1.3, -2.24); });
  beacon(g, 0, 3.55, -0.3);
  horn(g, 0.45, 1.0, 1.0);
  return g;
}

function pBrake() {
  const g = new THREE.Group();
  CY(g, 0.025, 0.9, dark(), 0, 0.52, -0.1, 'x');
  [[-0.25, 0.14, 0.12], [0, 0.22, 0.14], [0.25, 0.14, 0.12]].forEach(([x, w, d], i) => {
    const arm = CY(g, 0.02, 0.5, steel(), x, 0.28, -0.04);
    arm.rotation.x = -0.35;
    const pad = RB(g, w, 0.04, d, rubber(), x, 0.0, 0.06, 0.01);
    pad.rotation.x = -0.4;
    if (i === 1) for (let k = -2; k <= 2; k++) BX(g, w * 0.9, 0.012, 0.012, M(0x3a424c), x, 0.025, 0.06 + k * 0.025).rotation.x = -0.4;
  });
  RB(g, 0.1, 0.16, 0.2, dark(), 0.6, 0.05, -0.1, 0.02);
  const lev = CY(g, 0.018, 0.5, steel(), 0.6, 0.3, -0.2);
  lev.rotation.x = -0.5;
  const grip = CY(g, 0.035, 0.18, M(0x111827, { roughness: 0.8 }), 0.6, 0.52, -0.3);
  grip.rotation.x = -0.5;
  CY(g, 0.018, 0.03, M(0xdc2626), 0.6, 0.6, -0.34);
  return g;
}

function mirrorUnit(g, s, x) {
  const u = new THREE.Group();
  u.position.set(x, 0, 0);
  TB(u, [[0, 0, 0], [s * 0.12, 0.04, -0.02], [s * 0.3, 0.1, -0.05]], 0.018, dark());
  RB(u, 0.3, 0.36, 0.06, dark(), s * 0.4, 0.14, -0.08, 0.04);
  BX(u, 0.25, 0.3, 0.012, M(0xd8ecf8, { metalness: 1, roughness: 0.04 }), s * 0.4, 0.14, -0.115);
  g.add(u);
}
function pMirror(solo) {
  const g = new THREE.Group();
  if (solo) { mirrorUnit(g, 1, 0); return g; }
  mirrorUnit(g, -1, -0.88);
  mirrorUnit(g, 1, 0.88);
  return g;
}

function pSteering() {
  const g = new THREE.Group();
  const tg = new THREE.Group();
  tg.rotation.x = -0.5;
  CY(tg, 0.045, 0.7, dark(), 0, 0.35, 0);
  const vin = M(0x20252c, { roughness: 0.85, metalness: 0 });
  TR(tg, 0.27, 0.03, vin, 0, 0.72, 0, -PI / 2);
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * PI * 2 + PI / 2;
    BX(tg, 0.27, 0.025, 0.04, vin, Math.cos(a) * 0.135, 0.72, Math.sin(a) * 0.135, 0, -a);
  }
  CY(tg, 0.07, 0.06, dark(), 0, 0.72, 0);
  CY(tg, 0.045, 0.03, M(0x7b8794, { metalness: 0.8 }), 0.27, 0.77, 0);
  CY(tg, 0.03, 0.14, M(0x111827, { roughness: 0.8 }), 0.27, 0.85, 0);
  g.add(tg);
  RB(g, 0.5, 0.18, 0.12, dark(), 0, 0.2, -0.12, 0.03);
  [-0.15, 0, 0.15].forEach(x => CY(g, 0.045, 0.012, M(0xe2e8f0, { emissive: 0x334155, emissiveIntensity: 0.4 }), x, 0.2, -0.185, 'z'));
  return g;
}

function pSeatbelt() {
  const g = new THREE.Group();
  const vin = M(0x20252c, { roughness: 0.9, metalness: 0 });
  RB(g, 0.62, 0.18, 0.56, dark(), 0, -0.28, 0, 0.04);
  RB(g, 0.8, 0.16, 0.74, vin, 0, 0, 0, 0.07);
  [-1, 1].forEach(s => RB(g, 0.1, 0.12, 0.6, vin, s * 0.4, 0.07, 0, 0.04));
  RB(g, 0.78, 0.9, 0.14, vin, 0, 0.5, -0.38, 0.07, -0.15);
  RB(g, 0.5, 0.28, 0.12, vin, 0, 1.08, -0.43, 0.05, -0.15);
  const belt = M(0xf97316, { roughness: 0.75, metalness: 0 });
  strap(g, [-0.3, 0.95, -0.31], [0.2, 0.12, 0.12], 0.07, 0.012, belt);
  strap(g, [-0.42, 0.08, -0.15], [0.2, 0.12, 0.12], 0.07, 0.012, belt);
  RB(g, 0.07, 0.14, 0.03, chrome(), 0.2, 0.13, 0.13, 0.01);
  BX(g, 0.04, 0.05, 0.012, M(0xdc2626), 0.2, 0.17, 0.15);
  RB(g, 0.1, 0.2, 0.1, dark(), -0.44, 0.55, -0.4, 0.02);
  return g;
}

function pChain() {
  const g = new THREE.Group();
  const mat = M(0x6b7280, { metalness: 0.9, roughness: 0.35 });
  [-0.28, 0.28].forEach(x => {
    for (let i = 0; i < 30; i++) {
      const t = put(g, new THREE.TorusGeometry(0.05, 0.013, 8, 14), mat, x, i * 0.072, 0, 0, (i % 2) * PI / 2, 0);
      t.scale.set(1, 1.55, 1);
    }
    CY(g, 0.2, 0.06, steel(), x, 2.22, -0.06, 'x');
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * PI * 2;
      BX(g, 0.06, 0.06, 0.05, steel(), x, 2.22 + Math.cos(a) * 0.21, -0.06 + Math.sin(a) * 0.21, a);
    }
    BX(g, 0.1, 0.12, 0.08, dark(), x, -0.08, 0);
    CY(g, 0.02, 0.14, chrome(), x, -0.08, 0, 'x');
  });
  BX(g, 0.8, 0.06, 0.1, steel(), 0, 2.22, -0.14);
  return g;
}

function pGasTank() {
  const g = new THREE.Group();
  CY(g, 0.28, 1.1, M(0xd1d5db, { metalness: 0.5, roughness: 0.4 }), 0, 0, 0, 'x');
  put(g, new THREE.SphereGeometry(0.28, 24, 16), M(0xd1d5db, { metalness: 0.5, roughness: 0.4 }), -0.55, 0, 0);
  put(g, new THREE.SphereGeometry(0.28, 24, 16), M(0xd1d5db, { metalness: 0.5, roughness: 0.4 }), 0.55, 0, 0);
  TR(g, 0.22, 0.04, steel(), 0.65, 0, 0, 0, PI / 2);
  CY(g, 0.045, 0.12, M(0xd97706, { metalness: 0.8, roughness: 0.3 }), 0.62, 0, 0, 'x');
  TR(g, 0.05, 0.015, M(0xdc2626), 0.68, 0, 0, 0, PI / 2);
  TR(g, 0.22, 0.04, steel(), -0.65, 0, 0, 0, PI / 2);
  BX(g, 0.4, 0.1, 0.58, M(0xea580c, { roughness: 0.5 }), 0, 0, 0);
  return g;
}

function pGasSecuring() {
  const g = new THREE.Group();
  CY(g, 0.28, 1.1, M(0x9ca3af, { metalness: 0.5, roughness: 0.6 }), 0, 0, 0, 'x');
  [-0.32, 0.32].forEach(x => {
    BX(g, 0.06, 0.15, 0.7, dark(), x, -0.22, 0);
    TR(g, 0.295, 0.025, M(0xfacc15, { metalness: 0.6, roughness: 0.3 }), x, 0, 0, 0, PI / 2);
    BX(g, 0.08, 0.1, 0.08, chrome(), x, 0.28, 0.12);
  });
  return g;
}

function pGasPipeline() {
  const g = new THREE.Group();
  CY(g, 0.28, 0.7, M(0x9ca3af, { metalness: 0.4, roughness: 0.5 }), -0.2, 0, -0.3, 'x');
  TB(g, [[0.35, 0, -0.3], [0.45, 0.1, -0.1], [0.4, 0.05, 0.2], [0.2, -0.1, 0.4]], 0.045, rubber());
  CY(g, 0.05, 0.1, M(0xd97706, { metalness: 0.8 }), 0.35, 0, -0.3, 'x');
  CY(g, 0.05, 0.1, M(0xd97706, { metalness: 0.8 }), 0.2, -0.1, 0.4, 'z');
  return g;
}

function pGasFittings() {
  const g = new THREE.Group();
  CY(g, 0.07, 0.2, M(0xd97706, { metalness: 0.85, roughness: 0.25 }), 0, 0, 0, 'x');
  CY(g, 0.09, 0.08, M(0xb45309, { metalness: 0.9, roughness: 0.2 }), -0.05, 0, 0, 'x');
  CY(g, 0.06, 0.16, chrome(), 0.14, 0, 0, 'x');
  TR(g, 0.07, 0.018, M(0xdc2626, { roughness: 0.4 }), -0.05, 0.1, 0);
  TB(g, [[0.22, 0, 0], [0.35, -0.1, 0.1], [0.45, -0.2, 0.2]], 0.04, rubber());
  return g;
}

function pGasLeak() {
  const g = new THREE.Group();
  CY(g, 0.07, 0.22, M(0xd97706, { metalness: 0.85 }), 0, 0, 0, 'x');
  TR(g, 0.08, 0.02, M(0xdc2626, { roughness: 0.3 }), 0, 0.12, 0);
  put(g, new THREE.SphereGeometry(0.06, 16, 12), GL(0x38bdf8, 0.4), 0.1, 0.08, 0.05);
  put(g, new THREE.SphereGeometry(0.04, 16, 12), GL(0x38bdf8, 0.4), 0.14, 0.12, 0.02);
  return g;
}

function pGasGauge() {
  const g = new THREE.Group();
  CY(g, 0.14, 0.07, chrome(), 0, 0, 0, 'y');
  CY(g, 0.125, 0.015, M(0xffffff, { roughness: 0.2 }), 0, 0.038, 0, 'y');
  BX(g, 0.015, 0.02, 0.09, dark(), 0.02, 0.042, 0.02);
  BX(g, 0.08, 0.005, 0.03, M(0x22c55e), -0.04, 0.045, -0.04);
  BX(g, 0.05, 0.005, 0.03, M(0xef4444), 0.04, 0.045, -0.04);
  CY(g, 0.13, 0.02, GL(0xf8fafc, 0.25), 0, 0.05, 0, 'y');
  return g;
}

function pGeneric() {
  const g = new THREE.Group();
  RB(g, 0.6, 0.4, 0.4, dark(), 0, 0, 0, 0.05);
  CY(g, 0.08, 0.1, M(0xf08a1c), 0, 0.25, 0);
  return g;
}

const PART_DEFS = {
  engine:      { build: pEngine,      pos: () => [0, 1.1, -0.4] },
  coolant:     { build: pCoolant,     pos: () => [0, 1.3, -1.14] },
  brakeFluid:  { build: pBrakeFluid,  pos: () => [0.38, 1.22, 0.2] },
  battery:     { build: pBattery,     pos: () => [-1.2, 0.98, -0.45], rot: [0, PI / 2, 0] },
  batteryElec: { build: pBatteryElec, pos: () => [0, 1.1, -0.45] },
  terminals:   { build: pTerminals,   pos: () => [0.55, 1.62, -1.0] },
  chargePlug:  { build: pChargePlug,  pos: () => [1.2, 1.0, -1.1], rot: [0, PI / 2, 0] },
  hydTank:     { build: pHydTank,     pos: () => [1.2, 1.05, -0.15] },
  mast:        { build: pMast,        pos: () => [0, 0, 1.65] },
  wheel:       { build: pWheel,       pos: () => [0, 0, 0] },
  hoses:       { build: pHoses,       pos: () => [0, 0, 1.65] },
  lights:      { build: pLights,      pos: () => [0, 0, 0] },
  brake:       { build: pBrake,       pos: () => [0, 0.85, 0.22] },
  mirror:      { build: pMirror,      pos: () => [0, 2.6, 0.55] },
  steering:    { build: pSteering,    pos: () => [0, 1.55, 0.5] },
  seatbelt:    { build: pSeatbelt,    pos: e => [0, e ? 2.08 : 2.0, -0.4] },
  chain:       { build: pChain,       pos: () => [0, 1.1, 1.9] },
  gasTank:     { build: pGasTank,     pos: () => [0, 1.62, -1.75] },
  gasSecuring: { build: pGasSecuring, pos: () => [-0.45, 1.62, -1.75] },
  gasPipeline: { build: pGasPipeline, pos: () => [0.45, 1.35, -1.35] },
  gasFittings: { build: pGasFittings, pos: () => [0.65, 1.62, -1.75] },
  gasLeak:     { build: pGasLeak,     pos: () => [0.78, 1.62, -1.75] },
  gasGauge:    { build: pGasGauge,    pos: () => [0.35, 1.82, -1.75] },
  generic:     { build: pGeneric,     pos: () => [0, 1.5, 0] }
};

function partKeyFor(it, elec) {
  const t = (it && it.point) || '';
  if (/ขั้วแบต/.test(t)) return 'terminals';
  if (/ปลั๊ก|ชาร์จ/.test(t)) return 'chargePlug';
  if (/น้ำมันเบรค|น้ำมันเบรก|คลัตช์|คลัช|ครัช|คลัทช์/.test(t)) return 'brakeFluid';
  if (/น้ำมันเครื่อง/.test(t)) return 'engine';
  if (/หม้อพักน้ำ|หม้อน้ำ|น้ำยาหล่อเย็น/.test(t)) return 'coolant';
  if (/น้ำกลั่น|แบตเตอรี่|เเบตเตอรี่|แบตเตอร์รี่|เเบตเตอร์รี่/.test(t)) return elec ? 'batteryElec' : 'battery';
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

function buildBase(g, elec) {
  const gm = () => M(0x20262d, { metalness: 0.6, roughness: 0.45 });
  RB(g, 1.85, 0.14, 2.2, M(0x3a4048, { roughness: 0.8, metalness: 0.5 }), 0, 0.72, 0.15, 0.03);
  for (let i = 0; i < 9; i++) BX(g, 1.7, 0.012, 0.04, M(0x555d66), 0, 0.8, -0.85 + i * 0.24);
  [-1, 1].forEach(s => RB(g, 0.26, 0.5, 3.2, bodyMat(), s * 0.97, 0.6, -0.4, 0.08));
  RB(g, 2.1, 1.35, 1.05, bodyMat(), 0, 1.02, -1.7, 0.28);
  RB(g, 2.05, 0.2, 0.08, rubber(), 0, 0.5, -2.25, 0.03);
  RB(g, 1.5, 0.95, 0.5, bodyMat(), 0, 1.05, 0.55, 0.12);
  RB(g, 1.3, 0.06, 0.46, dark(), 0, 1.55, 0.55, 0.02);
  [-1, 1].forEach(s => {
    RB(g, 0.62, 0.1, 1.15, bodyMat(), s * 1.02, 1.12, 0.9, 0.04);
    RB(g, 0.36, 0.06, 0.5, M(0x2a2f36, { roughness: 0.8 }), s * 1.2, 0.62, 0.05, 0.02);
  });
  CY(g, 0.09, 2.0, dark(), 0, 0.5, 0.9, 'x');
  CY(g, 0.07, 1.6, dark(), 0, 0.42, -1.3, 'x');
  [-1, 1].forEach(s => {
    CY(g, 0.04, 2.7, gm(), s * 0.86, 2.15, 0.55);
    CY(g, 0.04, 2.7, gm(), s * 0.86, 2.15, -1.15);
    CY(g, 0.035, 1.8, gm(), s * 0.86, 3.5, -0.3, 'z');
  });
  CY(g, 0.035, 1.76, gm(), 0, 3.5, 0.55, 'x');
  CY(g, 0.035, 1.76, gm(), 0, 3.5, -1.15, 'x');
  for (let i = 0; i < 9; i++) CY(g, 0.016, 1.7, gm(), -0.7 + i * 0.175, 3.5, -0.3, 'z');
  TB(g, [[-0.86, 1.6, 0.55], [-1.05, 1.9, 0.45], [-0.86, 2.5, 0.4]], 0.025, chrome());
  if (!elec) {
    CY(g, 0.27, 0.95, M(0xb8c0c8, { metalness: 0.8, roughness: 0.3 }), 0, 2.0, -1.75, 'x');
    SP(g, 0.27, M(0xb8c0c8, { metalness: 0.8, roughness: 0.3 }), -0.475, 2.0, -1.75);
    SP(g, 0.27, M(0xb8c0c8, { metalness: 0.8, roughness: 0.3 }), 0.475, 2.0, -1.75);
    [-0.25, 0.25].forEach(x => BX(g, 0.05, 0.6, 0.6, dark(), x, 1.85, -1.75));
    CY(g, 0.06, 0.35, M(0x4b3b32, { metalness: 0.6, roughness: 0.7 }), 0.6, 0.8, -2.4, 'z');
  } else {
    RB(g, 0.8, 0.12, 0.03, M(0x111827), 0, 1.2, -2.24, 0.01);
  }
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
  renderer.toneMappingExposure = 1.0;
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
  const sun = new THREE.DirectionalLight(0xffffff, hasEnv ? 0.9 : 0.85);
  sun.position.set(6, 12, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -shadowR; sc.right = shadowR; sc.top = shadowR; sc.bottom = -shadowR; sc.near = 1; sc.far = 40;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
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

// กระพริบชิ้นส่วนที่เลือก (เรียกทุกเฟรมจาก renderMain) k = 0..1
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
  V3.dist = Math.max(6, Math.min(22, V3.dist + d));
}

function v3reset() {
  V3.theta = 0.75;
  V3.phi = 1.15;
  V3.dist = 13;
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
  BODY_C = isElec ? 0x1b7fd9 : 0xff8a1c;

  const base = new THREE.Group();
  buildBase(base, isElec);
  V3.root.add(base);

  const placed = {};
  getCurItems().forEach((it, idx) => {
    const key = partKeyFor(it, isElec);
    let g = placed[key];
    if (!g) {
      const def = PART_DEFS[key] || PART_DEFS.generic;
      g = def.build(false, { elec: isElec });
      const p = def.pos(isElec);
      g.position.set(p[0], p[1], p[2]);
      if (def.rot) g.rotation.set(def.rot[0], def.rot[1], def.rot[2]);
      V3.root.add(g);
      placed[key] = g;
    }
    V3.parts.push({ group: g, sprite: null, center: new THREE.Vector3(), idx });
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
  const raw = String(m.model || '').trim();
  if (/electric|ไฟฟ้า/i.test(raw)) return 'electric';
  if (/petrol|gasoline|lpg|gas|แก๊ส|แก๊ซ/i.test(raw)) return 'petrol+LPG';
  if (/diesel|ดีเซล/i.test(raw)) return 'diesel';
  return CUR.elec ? 'electric' : 'diesel';
}

const PART_IMAGES = {
  electric: {
    batteryElec: 'electric/electric-battery-water.jpg',
    battery:     'electric/electric-battery-water.jpg',
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

// ค้นหารูปภาพชิ้นส่วนตาม Model_Type ในชีต Forklift (electric, diesel, petrol+LPG)
function partImageCandidates(it, key) {
  const modelType = getForkliftModelType();
  const typeMap = PART_IMAGES[modelType] || PART_IMAGES.electric;
  const out = [];
  const add = p => {
    if (!p) return;
    const u = (/^(https?:|data:)/i.test(p)) ? p : (p.startsWith(ASSET_DIR) ? p : ASSET_DIR + p);
    if (!out.includes(u)) out.push(u);
  };

  // 1. ให้ priority สูงสุดกับรูปที่ตรงกับ key ของจุดตรวจและ Model_Type แน่นอน 100%
  if (typeMap && typeMap[key]) {
    add(typeMap[key]);
  }

  // 2. เผื่อกรณีมีการระบุรูปเฉพาะใน it.img
  if (it && it.img) {
    const raw = String(it.img).trim();
    if (raw) {
      if (/^(https?:|data:)/i.test(raw)) add(raw);
      else {
        const rel = raw.startsWith(ASSET_DIR) ? raw.slice(ASSET_DIR.length) : raw;
        add(rel);
        if (rel.includes('/')) {
          const parts = rel.split('/'), name = parts.slice(1).join('/');
          add(modelType + '/' + name);
          if (modelType === 'electric' && !name.startsWith('electric-')) add('electric/electric-' + name);
        } else {
          add(modelType + '/' + rel);
          if (modelType === 'electric' && !rel.startsWith('electric-')) add('electric/electric-' + rel);
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
  const typeFolder = CUR.elec ? 'electric' : 'engine';
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
  BODY_C = isElec ? 0x1b7fd9 : 0xff8a1c;
  const key = partKeyFor(it, isElec);
  const def = PART_DEFS[key] || PART_DEFS.generic;

  if (PV.pivot) { PV.st.scene.remove(PV.pivot); disposeObj(PV.pivot); }
  const part = def.build(true, { elec: isElec });
  const box = new THREE.Box3().setFromObject(part);
  const size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
  const s = 2.0 / Math.max(size.x, size.y, size.z, 0.001);
  part.scale.setScalar(s);
  part.position.set(-ctr.x * s, -ctr.y * s, -ctr.z * s);

  const pivot = new THREE.Group();
  pivot.add(part);
  const floorY = -(size.y * s) / 2 - 0.04;
  put(pivot, new THREE.CylinderGeometry(1.55, 1.6, 0.06, 56), M(0xdfe5eb, { roughness: 0.85, metalness: 0.05 }), 0, floorY - 0.03, 0);
  put(pivot, new THREE.TorusGeometry(1.5, 0.014, 8, 72), M(0xfacc15, { roughness: 0.5 }), 0, floorY + 0.002, 0, PI / 2);
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
  const r = await apiGet('getDashboard', { token: TOKEN });
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
            <span class="badge-tag ${ki.badge}">${ki.icon} ${esc(_tr(ki.label) || _t('noType'))}</span>
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
  else if (e.key === 'Enter') { e.preventDefault(); doLogin(); }   // กันปุ่มที่โฟกัสอยู่ถูกคลิกซ้ำ
});

window.addEventListener('DOMContentLoaded', () => {
  initCompactHeader();
  syncStaticLabels();
  buildKeys();
  drawDots();
  bindEvents();
  if (TOKEN) enter(); else show('login');
});

/* ======================================================================
   ภาษา (i18n) : ฟังก์ชันช่วยแสดงผลตามภาษาที่เลือก — คำแปลอยู่ในไฟล์ i18n.js
   ====================================================================== */
function forkliftLabel(m) {
  const ki = typeInfo(m);
  return `${m.id} - ${_tr(m.name)} [${ki.icon} ${_tr(ki.label) || _t('noType')}]`;
}

function renderMinfo(m) {
  if (!m) return;
  const ki = typeInfo(m);
  const badgeText = `${ki.icon} ${_tr(ki.label) || _t('noType')} (${_t('itemsN', { n: CUR.items.length })})`;
  $('minfo').innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
      <b>🚜 ${esc(_tr(m.name))} (${esc(m.id)})</b>
      <span class="badge-tag ${ki.badge}">${esc(badgeText)}</span>
    </div>
    <div style="font-size:13px; color:var(--mute); line-height:1.6;">
      <span>🏢 <b>${esc(_t('mDept'))}:</b> ${esc(_tr(m.dept) || '-')}</span> &nbsp;·&nbsp;
      <span>📍 <b>${esc(_t('mLoc'))}:</b> ${esc(_tr(m.loc))}</span><br>
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

// เปลี่ยนภาษาโดยไม่ล้างผลที่ตรวจไปแล้ว
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

/* ======================================================================
   PWA : ติดตั้งลงหน้าจอโฮม + Service Worker (sw.js)
   ====================================================================== */
let deferredInstall = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();                       // เก็บไว้ใช้กับปุ่ม "ติดตั้งแอป" (Android / Chrome / Edge)
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
  // iOS ไม่มีหน้าต่างติดตั้งอัตโนมัติ จึงแสดงคำแนะนำ (เฉพาะตอนยังไม่ได้เปิดจากไอคอนบนหน้าจอโฮม)
  const standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  if (/iphone|ipad|ipod/i.test(navigator.userAgent) && !standalone && $('iosHint')) $('iosHint').classList.remove('hide');
});

if ('serviceWorker' in navigator && (location.protocol === 'https:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname))) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('Service worker skipped:', err));
  });
}