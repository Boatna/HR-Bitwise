const API = (() => {
  // TODO: replace with your deployed Apps Script Web App URL
  const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxOcsFA-0RbqIhTANIw5A2nPNr3mj64AojPOnaXqCg7ZpOPtISXXocfaBsBGd0oC7xqxQ/exec';

  async function call(action, payload = {}) {
    if (WEB_APP_URL.indexOf('YOUR_DEPLOYMENT_ID') !== -1) {
      throw new Error('ยังไม่ได้ตั้งค่า WEB_APP_URL ใน js/api.js กรุณาใส่ URL ของ Apps Script Web App ที่ deploy แล้ว (ดู README.md ข้อ 3)');
    }
    const body = JSON.stringify({ action, ...payload });

    let response;
    try {
      response = await fetch(WEB_APP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body
      });
    } catch (err) {
      throw new Error('ไม่สามารถเชื่อมต่อกับระบบได้ กรุณาตรวจสอบอินเทอร์เน็ต หรือ URL ของ Apps Script');
    }

    if (!response.ok) {
      throw new Error('เซิร์ฟเวอร์ตอบกลับผิดพลาด (HTTP ' + response.status + ')');
    }

    let data;
    try {
      data = await response.json();
    } catch (err) {
      throw new Error('รูปแบบข้อมูลที่ได้รับไม่ถูกต้อง');
    }

    if (!data.success) {
      throw new Error(data.message || 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ');
    }
    return data.data;
  }

  return {
    // ---- Auth ----
    loginEmployee: (employeeId) => call('getEmployee', { employeeId }),
    loginManager: (managerId, pin) => call('authenticateManager', { managerId, pin }),

    // ---- Employee portal ----
    getEmployee: (employeeId) => call('getEmployee', { employeeId }),
    getStampHistory: (employeeId) => call('getStampHistory', { employeeId }),
    getRewards: () => call('getRewards'),
    redeemReward: (employeeId, rewardId) => call('redeemReward', { employeeId, rewardId }),
    getEmployeeDashboard: (employeeId) => call('getEmployeeDashboard', { employeeId }),
    getRedemptionHistory: (employeeId) => call('getRedemptionHistory', { employeeId }),

    // ---- HR / Manager portal ----
    searchEmployees: (query) => call('searchEmployees', { query }),
    addStamp: (payload) => call('addStamp', payload),
    getAllRedemptions: () => call('getAllRedemptions'),
    approveRedemption: (redemptionId, approverName, status) =>
      call('approveRedemption', { redemptionId, approverName, status }),
    createReward: (reward) => call('createReward', reward),
    updateReward: (reward) => call('updateReward', reward),
    disableReward: (rewardId) => call('disableReward', { rewardId }),
    getHrDashboard: () => call('getHrDashboard')
  };
})();