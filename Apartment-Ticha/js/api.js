const API = {
  API_URL: 'https://script.google.com/macros/s/AKfycbxsJ_N1BfWVishsxlXxkoGHuvPdLB7aIjTrdJfjmrUSHhAeJXppyNRVEgMcXlxwOwCLzg/exec',

  USER_STORAGE_KEY: 'DORM_CURRENT_USER',

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
    const currentUser = this.getCurrentUser();
    const body = {
      action: action,
      userEmail: currentUser.email,
      ...payload
    };

    try {
      const response = await fetch(this.API_URL, {
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