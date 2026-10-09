const API = {
  DEFAULT_API_URL: 'https://script.google.com/macros/s/AKfycbz4vZdRlsjjnpYUJ--u2VmxVxx8c0LTdlIdBr7ifKtnKQVxMXBIP7_mAWldY7DiWu1TLA/exec',
  STORAGE_URL_KEY: 'DORM_API_URL',
  USER_STORAGE_KEY: 'DORM_CURRENT_USER',
  STORAGE_TOKEN_KEY: 'DORM_API_TOKEN',
  TIMEOUT_MS: 60000,

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

  getToken() {
    return localStorage.getItem(this.STORAGE_TOKEN_KEY) || '';
  },

  setToken(token) {
    const t = (token || '').trim();
    if (t) {
      localStorage.setItem(this.STORAGE_TOKEN_KEY, t);
    } else {
      localStorage.removeItem(this.STORAGE_TOKEN_KEY);
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
      token: this.getToken(),
      ...payload
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

    try {
      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
      }

      let result;
      try {
        result = await response.json();
      } catch (parseErr) {
        // มักเกิดเมื่อ Web App ไม่ได้ตั้ง "Anyone" หรือ URL ผิด → Google ส่งหน้า HTML (หน้าล็อกอิน) กลับมาแทน JSON
        throw new Error('Web App ตอบกลับไม่ใช่ JSON กรุณาตรวจสอบ URL (ต้องลงท้าย /exec), สิทธิ์ "Anyone" และว่า Deploy เวอร์ชันล่าสุดแล้ว');
      }

      if (!result.success) {
        throw new Error(result.message || 'เกิดข้อผิดพลาดในการประมวลผลที่ Backend');
      }

      return result.data !== undefined ? result.data : result;
    } catch (error) {
      console.error(`API Call failed [${action}]:`, error);
      if (error && error.name === 'AbortError') {
        throw new Error('หมดเวลาการเชื่อมต่อ (เกิน ' + (this.TIMEOUT_MS / 1000) + ' วินาที) กรุณาลองใหม่อีกครั้ง');
      }
      if (error instanceof TypeError) {
        throw new Error('เชื่อมต่อ Web App ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ต หรือ URL ในหน้าตั้งค่า');
      }
      throw error;
    } finally {
      clearTimeout(timer);
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

  // ---------- ที่จอดรถ (Parking) ----------
  getParking() {
    return this.call('getParking');
  },
  saveParkingSlot(data) {
    return this.call('saveParkingSlot', { data });
  },
  assignParking(data) {
    return this.call('assignParking', { data });
  },
  releaseParking(data) {
    return this.call('releaseParking', { data });
  },
  deleteParkingSlot(slotId) {
    return this.call('deleteParkingSlot', { slotId });
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