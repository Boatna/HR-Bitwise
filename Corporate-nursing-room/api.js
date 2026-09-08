const ApiConfig = {
  STORAGE_KEY: 'nursing_station_api_url',
  DEFAULT_URL: 'https://script.google.com/macros/s/AKfycbwBu8TPYDoHLS9jYWm_s0PoLtccS6Y7A0aqTunOysF5vgXGyqUJ7zLL_sSCbHG88Oxl/exec',

  getUrl() {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    return (saved && saved.trim()) ? saved.trim() : this.DEFAULT_URL;
  },

  setUrl(url) {
    if (url && url.trim()) {
      localStorage.setItem(this.STORAGE_KEY, url.trim());
    } else {
      localStorage.removeItem(this.STORAGE_KEY);
    }
  }
};

const AppApi = {
  REQUEST_TIMEOUT_MS: 60000,

  isConfigured() {
    const url = ApiConfig.getUrl();
    return Boolean(url && url.startsWith('https://script.google.com/macros/s/'));
  },

  async get(action, params = {}) {
    const baseUrl = ApiConfig.getUrl();
    if (!baseUrl) {
      throw new Error("ยังไม่ได้ระบุ Google Apps Script Web App URL");
    }

    const url = new URL(baseUrl);
    url.searchParams.append('action', action);
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null) {
        url.searchParams.append(key, String(val));
      }
    });

    try {
      const response = await this._raceWithTimeout(
        fetch(url.toString(), { method: 'GET', redirect: 'follow' }),
        this.REQUEST_TIMEOUT_MS
      );

      const text = await response.text();
      try {
        return JSON.parse(text);
      } catch (e) {
        console.error("API Non-JSON Response:", text);
        throw new Error("ระบบตอบกลับข้อมูลที่ไม่ถูกต้อง กรุณาตรวจสอบสิทธิ์ของ Apps Script ว่าตั้งค่า 'Anyone' หรือยัง");
      }
    } catch (err) {
      console.error(`API GET [${action}] Error:`, err);
      if (err && err.message === 'CLAUDE_FETCH_TIMEOUT') {
        throw new Error(`การเชื่อมต่อใช้เวลานานเกิน ${this.REQUEST_TIMEOUT_MS / 1000} วินาที ระบบหยุดรอเพื่อไม่ให้หน้าค้าง กรุณาลองใหม่อีกครั้ง`);
      }
      throw err;
    }
  },
  _raceWithTimeout(promise, ms) {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('CLAUDE_FETCH_TIMEOUT')), ms);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
  },

  async post(action, payload = {}) {
    const baseUrl = ApiConfig.getUrl();
    if (!baseUrl) {
      throw new Error("ยังไม่ได้ระบุ Google Apps Script Web App URL");
    }

    try {
      const bodyData = JSON.stringify({ action, ...payload });
      const controller = new AbortController();
      const abortTimeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT_MS);

      let response;
      try {
        response = await this._raceWithTimeout(
          fetch(baseUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'text/plain;charset=utf-8'
            },
            body: bodyData,
            redirect: 'follow',
            signal: controller.signal
          }),
          this.REQUEST_TIMEOUT_MS
        );
      } finally {
        clearTimeout(abortTimeoutId);
      }

      const text = await response.text();
      try {
        return JSON.parse(text);
      } catch (e) {
        console.error("API Non-JSON Response:", text);
        throw new Error("บันทึกข้อมูลไม่สำเร็จ Google Apps Script ตอบกลับเป็น HTML");
      }
    } catch (err) {
      console.error(`API POST [${action}] Error:`, err);
      if ((err && err.name === 'AbortError') || (err && err.message === 'CLAUDE_FETCH_TIMEOUT')) {
        throw new Error(`การเชื่อมต่อใช้เวลานานเกิน ${this.REQUEST_TIMEOUT_MS / 1000} วินาที ระบบหยุดรอเพื่อไม่ให้หน้าค้าง หากกดบันทึกแล้ว กรุณาตรวจสอบข้อมูลใน Google Sheet ก่อนกดซ้ำ`);
      }
      throw err;
    }
  },

  async getInitialData() {
    return await this.get('getInitialData');
  },
  async getDashboardData(month, year, plant) {
    return await this.get('getDashboardData', { month, year, plant });
  },

  async getInventoryData() {
    return await this.get('getInventoryData');
  },

  async getDrugHistory(drugId) {
    return await this.get('getDrugHistory', { drugId });
  },

  async getAttendanceHistory(sid = '') {
    return await this.get('getAttendanceHistory', { sid });
  },

  async saveOutbound(form) {
    return await this.post('saveOutbound', { form });
  },

  async saveInbound(form) {
    return await this.post('saveInbound', { form });
  },

  async saveTimeAttendance(nurseId, nurseName, status) {
    return await this.post('saveTimeAttendance', { nurseId, nurseName, status });
  },

  async saveEmployee(employee) {
    return await this.post('saveEmployee', { employee });
  },

  async exportData(type, month, year) {
    const action = type === 'outbound' ? 'exportOutbound' : 'exportAttendance';
    return await this.get(action, { month, year });
  }
};