/* js/submit.js — บันทึกผลการตรวจเช็คไปยัง Google Sheets */
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
