const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxcdLlZBuw9rT1MFVQjl4EgKcnHF2JoPcnBBPvTObHO0MwxUfelNoUFukg8S8iNKli9/exec';

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

async function uploadFileToDrive(sheetUrl, file, fileName, subfolder) {
  if (!file || !sheetUrl) return '';
  try {
    const base64Data = await fileToBase64(file);
    const result = await callGasApi(sheetUrl, {
      action: 'uploadFile',
      fileName: fileName || file.name,
      mimeType: file.type || 'application/octet-stream',
      base64Data,
      subfolder: subfolder || ''
    });
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

async function fetchFileAsDataUri(sheetUrl, fileId) {
  if (!fileId || !sheetUrl) return '';
  try {
    const result = await fetchGasApi(sheetUrl + '?action=getFileBase64&fileId=' + encodeURIComponent(fileId));
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