const API = {
  DEFAULT_API_URL: 'https://script.google.com/macros/s/AKfycbzQGeVjUehCPoY-9P2Rg3VRFSCnmOeo_sz9OG1-Y6T096Etw7_L4zYkTrBe1HZ506Ud8g/exec',
  STORAGE_URL_KEY: 'DORM_API_URL',
  USER_STORAGE_KEY: 'DORM_CURRENT_USER',

  get API_URL() {
    return localStorage.getItem(this.STORAGE_URL_KEY) || this.DEFAULT_API_URL;
  },

  setApiUrl(url) {
    if (url) {
      localStorage.setItem(this.STORAGE_URL_KEY, url.trim());
    } else {
      localStorage.removeItem(this.STORAGE_URL_KEY);
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
          'Content-Type': 'text/plain;charset=utf-8'
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

  // ---------- แดชบอร์ด ----------
  getDashboardData() {
    return this.call('getDashboardData');
  },

  // ---------- ห้องพัก ----------
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
  toggleRoomMaintenance(roomId) {
    return this.call('toggleRoomMaintenance', { roomId });
  },

  // ---------- พนักงาน ----------
  getEmployees() {
    return this.call('getEmployees');
  },
  saveEmployee(data) {
    return this.call('saveEmployee', { data });
  },
  deleteEmployee(employeeId) {
    return this.call('deleteEmployee', { employeeId });
  },

  // ---------- อาคาร / ชั้น ----------
  getBuildings() {
    return this.call('getBuildings');
  },
  saveBuilding(data) {
    return this.call('saveBuilding', { data });
  },
  getFloors() {
    return this.call('getFloors');
  },

  // ---------- การเข้าพัก (Occupancy) ----------
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

  // ---------- การตั้งค่าและ Audit ----------
  getAuditLogs() {
    return this.call('getAuditLogs');
  },
  getSettings() {
    return this.call('getSettings');
  },
  saveSettings(data) {
    return this.call('saveSettings', { data });
  },

  // Backward compatibility placeholders
  getBeds() { return this.call('getBeds'); },
  saveBed(data) { return this.call('saveBed', { data }); },
  getRoomRequests() { return this.call('getRoomRequests'); },
  createRoomRequest(data) { return this.call('createRoomRequest', { data }); },
  updateRequestStatus(data) { return this.call('updateRequestStatus', { data }); },
  getMaintenance() { return this.call('getMaintenance'); },
  saveMaintenance(data) { return this.call('saveMaintenance', { data }); },
  completeMaintenance(maintenanceId) { return this.call('completeMaintenance', { maintenanceId }); },
  getRepairRequests() { return this.call('getRepairRequests'); },
  saveRepairRequest(data) { return this.call('saveRepairRequest', { data }); },
  updateRepairStatus(data) { return this.call('updateRepairStatus', { data }); },
  getRoomAssets() { return this.call('getRoomAssets'); },
  saveAsset(data) { return this.call('saveAsset', { data }); },
  deleteAsset(assetId) { return this.call('deleteAsset', { assetId }); },
  getKeys() { return this.call('getKeys'); },
  saveKey(data) { return this.call('saveKey', { data }); },
  getAdminUsers() { return this.call('getAdminUsers'); },
  saveAdminUser(data) { return this.call('saveAdminUser', { data }); }
};