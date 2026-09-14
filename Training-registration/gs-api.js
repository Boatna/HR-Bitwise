function escapeHtml(str) {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatPhoneNumber(phone) {
  if (phone === undefined || phone === null) return '';
  let str = String(phone).trim();
  if (str.startsWith("'")) {
    str = str.substring(1).trim();
  }
  if (!str) return '';
  const digits = str.replace(/\D/g, '');
  if (digits.length === 9 && !str.startsWith('0')) {
    if (digits.startsWith('8') || digits.startsWith('9') || digits.startsWith('6')) {
      str = '0' + str;
    }
  } else if (digits.length === 8 && !str.startsWith('0')) {
    str = '0' + str;
  }
  return str;
}

function cleanAddressNo(val) {
  if (val === undefined || val === null) return '';
  if (val instanceof Date || Object.prototype.toString.call(val) === '[object Date]') {
    return `${val.getDate()}/${val.getMonth() + 1}`;
  }
  let str = String(val).trim();
  if (str.startsWith("'")) {
    str = str.substring(1).trim();
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const parts = str.split('T')[0].split('-');
    return `${parseInt(parts[2], 10)}/${parseInt(parts[1], 10)}`;
  }
  return str;
}

const DEFAULT_GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzeFJjibVAJEfoTU0oYB1iQ3RqqwCPP8Vvn81pJj54vr83PlGvqvOP9qQnESbZiHguh/exec';

function getGasWebAppUrl() {
  try {
    const custom = localStorage.getItem('bw_gas_web_app_url');
    if (custom && custom.trim()) return custom.trim();
  } catch (e) { }
  return DEFAULT_GAS_WEB_APP_URL;
}

function setGasWebAppUrl(url) {
  try {
    if (url && url.trim()) {
      localStorage.setItem('bw_gas_web_app_url', url.trim());
      GAS_WEB_APP_URL = url.trim();
    } else {
      localStorage.removeItem('bw_gas_web_app_url');
      GAS_WEB_APP_URL = DEFAULT_GAS_WEB_APP_URL;
    }
  } catch (e) { }
}

let GAS_WEB_APP_URL = getGasWebAppUrl();

async function pingGasApi(url, timeoutMs = 15000) {
  const targetUrl = (url || getGasWebAppUrl()).trim();
  const startTime = Date.now();
  try {
    const sep = targetUrl.includes('?') ? '&' : '?';
    const res = await fetchGasApi(targetUrl + sep + 'action=ping', timeoutMs);
    const latency = Date.now() - startTime;
    if (res && res.status === 'success') {
      return { ok: true, latency, message: res.message || 'เชื่อมต่อสำเร็จ', timestamp: res.timestamp || new Date().toISOString() };
    }
    return { ok: false, latency, message: (res && res.message) || 'ตอบกลับไม่ถูกต้อง' };
  } catch (err) {
    return { ok: false, latency: Date.now() - startTime, message: (err && err.message) || String(err) };
  }
}

async function callGasApi(url, payload, timeoutMs = 25000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const text = await resp.text();
    try {
      return JSON.parse(text);
    } catch (parseErr) {
      return { status: 'error', message: 'ไม่สามารถแปลงผลลัพธ์จาก Apps Script เป็น JSON ได้: ' + text.slice(0, 300) };
    }
  } catch (err) {
    return {
      status: 'error',
      message: (err && err.name === 'AbortError') ? 'หมดเวลาเชื่อมต่อ (timeout)' : ((err && err.message) || String(err))
    };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchGasApi(url, timeoutMs = 25000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    const text = await resp.text();
    try {
      return JSON.parse(text);
    } catch (parseErr) {
      return { status: 'error', message: 'ไม่สามารถแปลงผลลัพธ์จาก Apps Script เป็น JSON ได้: ' + text.slice(0, 300) };
    }
  } catch (err) {
    return {
      status: 'error',
      message: (err && err.name === 'AbortError') ? 'หมดเวลาเชื่อมต่อ (timeout)' : ((err && err.message) || String(err))
    };
  } finally {
    clearTimeout(timer);
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    if (!file) { resolve(''); return; }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('อ่านไฟล์ไม่สำเร็จ: ' + file.name));
    reader.readAsDataURL(file);
  });
}

async function uploadFileToDrive(sheetUrl, file, fileName, subfolder, timeoutMs = 60000) {
  if (!file || !sheetUrl) return '';
  try {
    const base64Data = await fileToBase64(file);
    const result = await callGasApi(sheetUrl, {
      action: 'uploadFile',
      fileName: fileName || file.name,
      mimeType: file.type || 'application/octet-stream',
      base64Data,
      subfolder: subfolder || ''
    }, timeoutMs);
    if (result && result.status === 'success') {
      return result.directUrl || result.url || '';
    }
    console.warn('อัปโหลดไฟล์ไม่สำเร็จ:', result && result.message);
    return '';
  } catch (err) {
    console.warn('อัปโหลดไฟล์เกิดข้อผิดพลาด:', err);
    return '';
  }
}

function extractDriveFileId(url) {
  if (!url) return '';
  const byQueryParam = String(url).match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (byQueryParam) return byQueryParam[1];
  const byPath = String(url).match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (byPath) return byPath[1];
  return '';
}

async function fetchFileAsDataUri(sheetUrl, fileId, timeoutMs = 45000) {
  if (!fileId || !sheetUrl) return '';
  try {
    const result = await fetchGasApi(sheetUrl + '?action=getFileBase64&fileId=' + encodeURIComponent(fileId), timeoutMs);
    if (result && result.status === 'success' && result.dataUri) {
      return result.dataUri;
    }
    console.warn('ไม่สามารถดึงไฟล์ภาพจาก Google Drive เป็น Base64 ได้:', result && result.message);
    return '';
  } catch (err) {
    console.warn('เกิดข้อผิดพลาดขณะดึงไฟล์ภาพจาก Google Drive:', err);
    return '';
  }
}