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
