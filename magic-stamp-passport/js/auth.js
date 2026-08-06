/* ==========================================================================
   Magic Stamp Passport — Auth
   Handles role toggle + login submission on login.html
   ========================================================================== */

const Session = {
  KEY: 'msp_session',
  save(session) { sessionStorage.setItem(this.KEY, JSON.stringify(session)); },
  get() {
    const raw = sessionStorage.getItem(this.KEY);
    return raw ? JSON.parse(raw) : null;
  },
  clear() { sessionStorage.removeItem(this.KEY); },
  requireEmployee() {
    const s = this.get();
    if (!s || s.role !== 'employee') { window.location.href = 'login.html'; return null; }
    return s;
  },
  requireManager() {
    const s = this.get();
    if (!s || s.role !== 'manager') { window.location.href = 'login.html'; return null; }
    return s;
  }
};

function showLoading(msg) {
  let el = document.getElementById('loadingOverlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'loadingOverlay';
    el.className = 'loading-overlay';
    el.innerHTML = `<div class="spinner-magic"></div><div id="loadingMsg"></div>`;
    document.body.appendChild(el);
  }
  document.getElementById('loadingMsg').textContent = msg || 'กำลังเปิดสมุดเวทมนตร์...';
  el.style.display = 'flex';
}
function hideLoading() {
  const el = document.getElementById('loadingOverlay');
  if (el) el.style.display = 'none';
}
function showAlert(containerId, message, type = 'danger') {
  const box = document.getElementById(containerId);
  if (!box) { alert(message); return; }
  box.innerHTML = `<div class="alert alert-${type} py-2 mb-3" role="alert">${message}</div>`;
}

document.addEventListener('DOMContentLoaded', () => {
  const roleEmployeeBtn = document.getElementById('roleEmployeeBtn');
  const roleManagerBtn = document.getElementById('roleManagerBtn');
  const employeeForm = document.getElementById('employeeLoginForm');
  const managerForm = document.getElementById('managerLoginForm');

  if (!roleEmployeeBtn) return; // not on login page

  function setRole(role) {
    const isEmployee = role === 'employee';
    roleEmployeeBtn.classList.toggle('btn-magic-gold', isEmployee);
    roleEmployeeBtn.classList.toggle('btn-magic-outline', !isEmployee);
    roleManagerBtn.classList.toggle('btn-magic-gold', !isEmployee);
    roleManagerBtn.classList.toggle('btn-magic-outline', isEmployee);
    employeeForm.classList.toggle('d-none', !isEmployee);
    managerForm.classList.toggle('d-none', isEmployee);
  }
  roleEmployeeBtn.addEventListener('click', () => setRole('employee'));
  roleManagerBtn.addEventListener('click', () => setRole('manager'));
  setRole('employee');

  employeeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const employeeId = document.getElementById('employeeIdInput').value.trim();
    if (!employeeId) return;
    const submitBtn = employeeForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    showLoading('กำลังตรวจสอบรหัสพนักงาน...');
    try {
      const employee = await API.loginEmployee(employeeId);
      Session.save({ role: 'employee', employeeId: employee.EmployeeID, name: employee.FullName });
      window.location.href = 'employee.html';
    } catch (err) {
      hideLoading();
      if (submitBtn) submitBtn.disabled = false;
      showAlert('employeeAlertBox', err.message, 'danger');
    }
  });

  managerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const managerId = document.getElementById('managerIdInput').value.trim();
    const pin = document.getElementById('managerPinInput').value.trim();
    if (!managerId || !pin) return;
    const submitBtn = managerForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    showLoading('กำลังตรวจสอบสิทธิ์ผู้ดูแล...');
    try {
      const manager = await API.loginManager(managerId, pin);
      Session.save({
        role: 'manager',
        managerId: manager.ManagerID,
        name: manager.FullName,
        approverType: manager.ApproverType
      });
      window.location.href = 'hr.html';
    } catch (err) {
      hideLoading();
      if (submitBtn) submitBtn.disabled = false;
      showAlert('managerAlertBox', err.message, 'danger');
    }
  });
});

function logout() {
  Session.clear();
  window.location.href = 'login.html';
}