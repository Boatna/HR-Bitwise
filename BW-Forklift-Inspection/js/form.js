function setCurrent(m) {
  CUR.forklift = m || null;
  CUR.elec = isElecForklift(m);
  CUR.kind = forkliftKind(m);
  CUR.items = m && FORM ? FORM.items.filter(i => i.forkliftId === m.id).map(i => ({ ...i, point: fixTh(stripNo(i.point)) })) : [];
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
  if (/แบตเตอร์?รี่|ปลั๊กชาร์จ|น้ำกลั่น/.test(point) && /แบตเตอรี่|ความปลอดภัยก่อนเริ่ม/.test(text)) return true;
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
