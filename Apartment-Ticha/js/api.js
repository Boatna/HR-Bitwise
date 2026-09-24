const API = {
  STORAGE_KEY: 'DORM_API_URL',
  USER_STORAGE_KEY: 'DORM_CURRENT_USER',

  getApiUrl() {
    return localStorage.getItem(this.STORAGE_KEY) || '';
  },

  setApiUrl(url) {
    if (url) {
      localStorage.setItem(this.STORAGE_KEY, url.trim());
    } else {
      localStorage.removeItem(this.STORAGE_KEY);
    }
  },

  getCurrentUser() {
    const saved = localStorage.getItem(this.USER_STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      email: 'admin@company.com',
      name: 'ผู้ดูแลระบบ',
      role: 'SuperAdmin'
    };
  },

  setCurrentUser(user) {
    localStorage.setItem(this.USER_STORAGE_KEY, JSON.stringify(user));
  },

  /**
   * ส่งคำขอไปยัง Google Apps Script Web App
   */
  async call(action, payload = {}) {
    const apiUrl = this.getApiUrl();
    if (!apiUrl) {
      console.warn('Google Apps Script API URL ยังไม่ได้ตั้งค่า');
      this.promptSetApiUrl();
      throw new Error('กรุณาตั้งค่า Google Apps Script Web App URL ก่อนใช้งาน');
    }

    const currentUser = this.getCurrentUser();
    const body = {
      action: action,
      userEmail: currentUser.email,
      ...payload
    };

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8' // ป้องกัน CORS Preflight Options บน Google Apps Script
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || 'เกิดข้อผิดพลาดในการประมวลผลที่ Backend');
      }

      return result.data !== undefined ? result.data : result;
    } catch (error) {
      console.error(`API Call failed [${action}]:`, error);
      throw error;
    }
  },

  promptSetApiUrl() {
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        title: 'ตั้งค่า Google Apps Script Web App URL',
        text: 'กรุณากรอก Web App Executable URL ที่ได้จากการ Deploy ใน Google Apps Script',
        input: 'text',
        inputValue: this.getApiUrl(),
        inputPlaceholder: 'https://script.google.com/macros/s/AKfycbyn9Mh9wIkcU2r-AiEihOXeBeGuQoD4C_-adNao7oVuS6be6dQg71mPDbMCN5yxFDCnLg/exec',
        showCancelButton: true,
        confirmButtonText: 'บันทึก URL',
        cancelButtonText: 'ยกเลิก',
        inputValidator: (value) => {
          if (!value || !value.startsWith('https://script.google.com/macros/s/')) {
            return 'กรุณากรอก URL ที่ถูกต้องของ Google Apps Script Web App!';
          }
        }
      }).then((result) => {
        if (result.isConfirmed && result.value) {
          this.setApiUrl(result.value);
          Swal.fire({
            icon: 'success',
            title: 'บันทึกเรียบร้อย',
            text: 'กำลังโหลดข้อมูลใหม่...',
            timer: 1500,
            showConfirmButton: false
          }).then(() => {
            window.location.reload();
          });
        }
      });
    }
  },

  getDashboardData() {
    return this.call('getDashboardData');
  },
  getRooms() {
    return this.call('getRooms');
  },
  getRoomById(roomId) {
    return this.call('getRoomById', { roomId });
  },
  saveRoom(data) {
    return this.call('saveRoom', { data });
  },
  deleteRoom(roomId) {
    return this.call('deleteRoom', { roomId });
  },
  getEmployees() {
    return this.call('getEmployees');
  },
  saveEmployee(data) {
    return this.call('saveEmployee', { data });
  },
  deleteEmployee(employeeId) {
    return this.call('deleteEmployee', { employeeId });
  },
  getBuildings() {
    return this.call('getBuildings');
  },
  saveBuilding(data) {
    return this.call('saveBuilding', { data });
  },
  getFloors() {
    return this.call('getFloors');
  },
  getBeds() {
    return this.call('getBeds');
  },
  saveBed(data) {
    return this.call('saveBed', { data });
  },
  getOccupancy() {
    return this.call('getOccupancy');
  },
  checkIn(data) {
    return this.call('checkIn', { data });
  },
  checkOut(data) {
    return this.call('checkOut', { data });
  },
  transferRoom(data) {
    return this.call('transferRoom', { data });
  },
  getRoomRequests() {
    return this.call('getRoomRequests');
  },
  createRoomRequest(data) {
    return this.call('createRoomRequest', { data });
  },
  updateRequestStatus(data) {
    return this.call('updateRequestStatus', { data });
  },
  getMaintenance() {
    return this.call('getMaintenance');
  },
  saveMaintenance(data) {
    return this.call('saveMaintenance', { data });
  },
  getRepairRequests() {
    return this.call('getRepairRequests');
  },
  saveRepairRequest(data) {
    return this.call('saveRepairRequest', { data });
  },
  updateRepairStatus(data) {
    return this.call('updateRepairStatus', { data });
  },
  getRoomAssets() {
    return this.call('getRoomAssets');
  },
  saveAsset(data) {
    return this.call('saveAsset', { data });
  },
  deleteAsset(assetId) {
    return this.call('deleteAsset', { assetId });
  },
  getKeys() {
    return this.call('getKeys');
  },
  saveKey(data) {
    return this.call('saveKey', { data });
  },
  getAdminUsers() {
    return this.call('getAdminUsers');
  },
  saveAdminUser(data) {
    return this.call('saveAdminUser', { data });
  },
  getAuditLogs() {
    return this.call('getAuditLogs');
  },
  getSettings() {
    return this.call('getSettings');
  },
  saveSettings(data) {
    return this.call('saveSettings', { data });
  }
};
