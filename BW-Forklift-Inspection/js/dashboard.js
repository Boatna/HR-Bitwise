/* js/dashboard.js — หน้า Dashboard */
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
        <td><b>${esc(x.forkliftId || '')}</b>${x.forkliftId ? '<br>' : ''}<span style="font-size:12px;color:var(--mute)">${esc(_tr(x.forklift))}</span></td>
        <td>${tag(x.status)}</td>
        <td>${x.ng ? `<b style="color:var(--ng)">[${esc(x.ng)}]</b> ` : ''}${esc(x.note || '-')}</td>
      </tr>`).join('') : `
      <tr><td colspan="5" style="text-align:center; padding:20px; color:var(--mute);">${_t('noHistory')}</td></tr>`);
  } catch (err) {
    console.error(err);
    toast(_t('showStatsFail'));
  }
}
