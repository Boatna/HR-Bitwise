/* js/utils.js — ฟังก์ชันช่วยเหลือ: DOM, escape, toast, สถานะ API, โหมดวันจันทร์ */

const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const stripNo = t => String(t == null ? '' : t).replace(/^\s*\d+\s*[.)]\s*/, '');
const fixTh = t => String(t == null ? '' : t).replace(/เเ/g, '\u0E41');
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
