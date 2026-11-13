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
function renderDeptOptions() {
  const cur = $('selDept').value;
  const ds = [...new Set(PEOPLE.map(p => (p.dept || '').trim()).filter(Boolean))];
  $('selDept').innerHTML = '<option value="">' + _t('allDepts') + '</option>' +
    ds.map(d => `<option value="${esc(d)}">${esc(_tr(d))}</option>`).join('');
  $('selDept').value = cur;
}
