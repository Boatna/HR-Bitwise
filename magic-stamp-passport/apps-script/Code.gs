const SHEET_EMPLOYEE = 'Employee';
const SHEET_MANAGERS = 'Managers';
const SHEET_DATA = 'Data';
const SHEET_REWARDS = 'Rewards';
const SHEET_REDEMPTIONS = 'Redemptions';

const LEVELS = [
  { name: 'Beginner',   th: 'นักสะสมมือใหม่', min: 0 },
  { name: 'Collector',    th: 'นักสะสม',    min: 10 },
  { name: 'Curator', th: 'ภัณฑารักษ์', min: 25 },
  { name: 'Connoisseur',       th: 'ผู้เชี่ยวชาญ',   min: 50 },
  { name: 'Grandmaster',     th: 'ปรมาจารย์แห่งการสะสม',     min: 100 },
  { name: 'Luminary',      th: 'ผู้ทรงคุณวุฒิ',   min: 300 },
  { name: 'Legend',       th: 'ตำนาน',        min: 500 },
  { name: 'Mythic',       th: 'ผู้วิเศษ',       min: 1000 }
];

const LOCK_TIMEOUT_MS = 30000;


function doPost(e) {
  return handleRequest(e);
}

function doGet(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  try {
    let params = {};
    if (e.postData && e.postData.contents) {
      params = JSON.parse(e.postData.contents);
    } else if (e.parameter) {
      params = e.parameter;
    }

    const action = params.action;
    if (!action) throw new Error('ไม่ระบุ action');

    const handlers = {
      getEmployee: () => getEmployee(params),
      getStampHistory: () => getStampHistory(params),
      getRewards: () => getRewards(),
      redeemReward: () => redeemReward(params),
      addStamp: () => addStamp(params),
      getEmployeeDashboard: () => getEmployeeDashboard(params),
      getHrDashboard: () => getHrDashboard(),
      approveRedemption: () => approveRedemption(params),
      updateReward: () => updateReward(params),
      createReward: () => createReward(params),
      disableReward: () => disableReward(params),
      authenticateManager: () => authenticateManager(params),
      searchEmployees: () => searchEmployees(params),
      getAllRedemptions: () => getAllRedemptions(),
      getRedemptionHistory: () => getRedemptionHistory(params)
    };

    if (!handlers[action]) throw new Error('ไม่รู้จัก action: ' + action);

    const result = handlers[action]();
    return jsonResponse({ success: true, data: result });
  } catch (err) {
    console.error('Error in handleRequest:', err);
    return jsonResponse({ success: false, message: err.message });
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function withLock(fn) {
  const lock = LockService.getScriptLock();
  const gotLock = lock.tryLock(LOCK_TIMEOUT_MS);
  if (!gotLock) {
    throw new Error('ระบบกำลังประมวลผลรายการอื่นอยู่ กรุณาลองใหม่อีกครั้ง');
  }
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('ไม่พบชีต: ' + name);
  return sheet;
}

function getHeaders(sheetName) {
  const sheet = getSheet(sheetName);
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

function sheetToObjects(sheetName) {
  const sheet = getSheet(sheetName);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (row.every(c => c === '' || c === null || c === undefined)) continue;
    const obj = { __row: i + 1 };
    headers.forEach((h, idx) => { 
      if (h) obj[h] = row[idx] !== undefined ? row[idx] : '';
    });
    rows.push(obj);
  }
  return rows;
}

function findRowIndexByValue(sheetName, headerName, value) {
  const sheet = getSheet(sheetName);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const col = headers.indexOf(headerName);
  if (col === -1) throw new Error('ไม่พบคอลัมน์ ' + headerName + ' ในชีต ' + sheetName);
  
  for (let i = 1; i < values.length; i++) {
    const cellValue = values[i][col];
    if (String(cellValue).trim() === String(value).trim()) {
      return i + 1; // 1-indexed sheet row
    }
  }
  return -1;
}

function getColumnIndex(sheetName, headerName) {
  const headers = getHeaders(sheetName);
  const idx = headers.indexOf(headerName);
  if (idx === -1) return -1;
  return idx + 1; // 1-indexed
}

function getColumnIndexRequired(sheetName, headerName) {
  const idx = getColumnIndex(sheetName, headerName);
  if (idx === -1) throw new Error('ไม่พบคอลัมน์ ' + headerName + ' ในชีต ' + sheetName);
  return idx;
}

function ensureColumnExists(sheetName, headerName) {
  const sheet = getSheet(sheetName);
  const lastCol = sheet.getLastColumn();
  const headers = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
  const idx = headers.indexOf(headerName);
  if (idx !== -1) return idx + 1; // already exists
  const newCol = lastCol + 1;
  sheet.getRange(1, newCol).setValue(headerName);
  return newCol;
}

function normalizeId(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return String(Math.trunc(v));
  const s = String(v).trim();
  return s;
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (isNaN(date)) return String(value);
  try {
    const tz = Session.getScriptTimeZone() || 'GMT+7';
    return Utilities.formatDate(date, tz, 'dd/MM/yyyy HH:mm');
  } catch (e) {
    return date.toString();
  }
}

function getLevel(stamps) {
  let current = LEVELS[0];
  for (let i = 0; i < LEVELS.length; i++) {
    if (stamps >= LEVELS[i].min) current = LEVELS[i];
  }
  return current;
}

function getStampTotalsMap() {
  const data = sheetToObjects(SHEET_DATA);
  const totals = {};
  data.forEach(d => {
    const id = normalizeId(d['รหัสพนักงาน']);
    const amount = Number(d['จำนวนแสตมป์']) || 0;
    totals[id] = (totals[id] || 0) + amount;
  });
  return totals;
}

function computeTotalStamps(employeeId) {
  const totals = getStampTotalsMap();
  return totals[normalizeId(employeeId)] || 0;
}

function getEmployee(params) {
  const employeeId = normalizeId(params.employeeId);
  if (!employeeId) throw new Error('กรุณาระบุรหัสพนักงาน');

  const employees = sheetToObjects(SHEET_EMPLOYEE);
  const emp = employees.find(e => normalizeId(e['รหัสพนักงาน']) === employeeId);
  if (!emp) throw new Error('ไม่พบรหัสพนักงานนี้ในระบบ');

  const totalStamps = computeTotalStamps(employeeId);
  const level = getLevel(totalStamps);

  return {
    EmployeeID: employeeId,
    FullName: emp['ชื่อ-นามสกุล'] || '',
    Department: emp['แผนก'] || '',
    Position: emp['ตำแหน่ง'] || '',
    Plant: emp['Plant'] || '',
    TotalStamps: totalStamps,
    Level: level.name,
    LevelTH: level.th
  };
}

function searchEmployees(params) {
  const query = String(params.query || '').trim();
  const employees = sheetToObjects(SHEET_EMPLOYEE);
  
  let filtered = employees;
  if (query) {
    const lowerQuery = query.toLowerCase();
    filtered = employees.filter(e => {
      const id = normalizeId(e['รหัสพนักงาน']);
      const name = String(e['ชื่อ-นามสกุล'] || '').toLowerCase();
      return id.toLowerCase().includes(lowerQuery) || name.includes(lowerQuery);
    });
  }

  const totalsMap = getStampTotalsMap();

  return filtered.slice(0, 50).map(e => {
    const id = normalizeId(e['รหัสพนักงาน']);
    return {
      EmployeeID: id,
      FullName: e['ชื่อ-นามสกุล'] || '',
      Department: e['แผนก'] || '',
      Position: e['ตำแหน่ง'] || '',
      TotalStamps: totalsMap[id] || 0
    };
  });
}

function authenticateManager(params) {
  const managerId = normalizeId(params.managerId);
  const pin = String(params.pin || '').trim();
  if (!managerId || !pin) throw new Error('กรุณาระบุรหัสและ PIN');

  const managers = sheetToObjects(SHEET_MANAGERS);
  const mgr = managers.find(m => normalizeId(m['รหัสพนักงาน']) === managerId);
  if (!mgr) throw new Error('ไม่พบรหัสผู้ดูแลนี้');
  if (String(mgr['PIN']).trim() !== pin) throw new Error('PIN ไม่ถูกต้อง');
  
  const status = String(mgr['ActiveStatus'] || 'Active').trim();
  if (status === 'Inactive' || status === 'inactive') {
    throw new Error('บัญชีนี้ถูกระงับการใช้งาน');
  }

  return {
    ManagerID: managerId,
    FullName: mgr['ชื่อ-นามสกุล'] || '',
    Department: mgr['แผนก'] || '',
    ApproverType: mgr['ApproverType'] || 'Manager',
    Email: mgr['Email'] || ''
  };
}

function getStampHistory(params) {
  const employeeId = normalizeId(params.employeeId);
  const data = sheetToObjects(SHEET_DATA);
  return data
    .filter(d => normalizeId(d['รหัสพนักงาน']) === employeeId)
    .sort((a, b) => new Date(b['Timestamp']) - new Date(a['Timestamp']))
    .map(d => ({
      ActivityName: d['กิจกรรม'] || '',
      StampAmount: Number(d['จำนวนแสตมป์']) || 0,
      DateTime: formatDate(d['Timestamp']),
      GrantedBy: d['ผู้ให้แสตมป์'] || '',
      Remark: d['หมายเหตุ'] || ''
    }));
}

function addStamp(params) {
  const employeeId = normalizeId(params.employeeId);
  const activityName = String(params.activityName || '').trim();
  const stampAmount = Number(params.stampAmount);
  const remark = String(params.remark || '');
  const grantedById = normalizeId(params.grantedById);
  const grantedByName = String(params.grantedByName || '');

  if (!employeeId) throw new Error('กรุณาระบุรหัสพนักงาน');
  if (!activityName) throw new Error('กรุณาระบุชื่อกิจกรรม');
  if (!stampAmount || stampAmount <= 0) throw new Error('จำนวนแสตมป์ต้องมากกว่า 0');

  const employees = sheetToObjects(SHEET_EMPLOYEE);
  const emp = employees.find(e => normalizeId(e['รหัสพนักงาน']) === employeeId);
  if (!emp) throw new Error('ไม่พบรหัสพนักงานนี้ในระบบ');

  return withLock(() => {
    const sheet = getSheet(SHEET_DATA);
    const headers = getHeaders(SHEET_DATA);
    
    const row = headers.map(h => {
      switch (h) {
        case 'Timestamp': return new Date();
        case 'รหัสพนักงาน': return employeeId;
        case 'ชื่อ-นามสกุล': return emp['ชื่อ-นามสกุล'] || '';
        case 'แผนก': return emp['แผนก'] || '';
        case 'กิจกรรม': return activityName;
        case 'จำนวนแสตมป์': return stampAmount;
        case 'ผู้ให้แสตมป์': return grantedByName;
        case 'รหัสผู้ให้': return grantedById;
        case 'หมายเหตุ': return remark;
        default: return '';
      }
    });
    sheet.appendRow(row);

    return { 
      newTotal: computeTotalStamps(employeeId),
      message: 'เพิ่มแสตมป์สำเร็จ!'
    };
  });
}

function getRewards() {
  const rewards = sheetToObjects(SHEET_REWARDS);
  return rewards.map(r => ({
    RewardID: String(r['RewardID'] || ''),
    RewardName: r['ชื่อของรางวัล'] || '',
    Description: r['คำอธิบาย'] || r['Description'] || '',
    RequiredStamps: Number(r['แสตมป์ที่ใช้แลก']) || 0,
    RemainingQuantity: Number(r['จำนวนคงเหลือ']) || 0,
    Status: r['สถานะ'] || 'Active',
    RewardImage: r['รูปภาพ'] || '',
    RedemptionCode: r['รหัสของรางวัล'] || r['RedemptionCode'] || ''
  }));
}

function createReward(params) {
  const rewardName = String(params.rewardName || '').trim();
  const requiredStamps = Number(params.requiredStamps) || 0;
  const remainingQuantity = Number(params.remainingQuantity) || 0;
  const status = params.status || 'Active';
  const rewardImage = String(params.rewardImage || '');
  const description = String(params.description || '');
  const redemptionCode = String(params.redemptionCode || '').trim();

  if (!rewardName) throw new Error('กรุณาระบุชื่อรางวัล');
  if (requiredStamps <= 0) throw new Error('จำนวนแสตมป์ที่ใช้แลกต้องมากกว่า 0');

  return withLock(() => {
    const sheet = getSheet(SHEET_REWARDS);
    // Auto-create these columns if the underlying sheet doesn't have them
    // yet, so description / redemption-code values always have somewhere
    // to be written instead of silently vanishing.
    ensureColumnExists(SHEET_REWARDS, 'คำอธิบาย');
    ensureColumnExists(SHEET_REWARDS, 'รหัสของรางวัล');
    const headers = getHeaders(SHEET_REWARDS);
    const newId = 'R' + new Date().getTime();
    
    const row = headers.map(h => {
      switch (h) {
        case 'RewardID': return newId;
        case 'ชื่อของรางวัล': return rewardName;
        case 'แสตมป์ที่ใช้แลก': return requiredStamps;
        case 'จำนวนคงเหลือ': return remainingQuantity;
        case 'สถานะ': return status;
        case 'รูปภาพ': return rewardImage;
        case 'Description': return description;
        case 'คำอธิบาย': return description;
        case 'RedemptionCode': return redemptionCode;
        case 'รหัสของรางวัล': return redemptionCode;
        default: return '';
      }
    });
    sheet.appendRow(row);
    
    return { RewardID: newId, message: 'สร้างรางวัลสำเร็จ!' };
  });
}

function updateReward(params) {
  const rewardId = String(params.rewardId);
  const rewardName = String(params.rewardName || '').trim();
  const requiredStamps = Number(params.requiredStamps) || 0;
  const remainingQuantity = Number(params.remainingQuantity) || 0;
  const status = params.status || 'Active';
  const rewardImage = String(params.rewardImage || '');
  const description = String(params.description || '');
  const redemptionCode = String(params.redemptionCode || '').trim();

  if (!rewardId) throw new Error('กรุณาระบุรหัสรางวัล');
  if (!rewardName) throw new Error('กรุณาระบุชื่อรางวัล');
  if (requiredStamps <= 0) throw new Error('จำนวนแสตมป์ที่ใช้แลกต้องมากกว่า 0');

  return withLock(() => {
    const rowIdx = findRowIndexByValue(SHEET_REWARDS, 'RewardID', rewardId);
    if (rowIdx === -1) throw new Error('ไม่พบรางวัลนี้');
    
    const sheet = getSheet(SHEET_REWARDS);
    ensureColumnExists(SHEET_REWARDS, 'คำอธิบาย');
    ensureColumnExists(SHEET_REWARDS, 'รหัสของรางวัล');
    const headers = getHeaders(SHEET_REWARDS);
    
    headers.forEach((h, idx) => {
      const col = idx + 1;
      let value = '';
      switch (h) {
        case 'ชื่อของรางวัล': value = rewardName; break;
        case 'แสตมป์ที่ใช้แลก': value = requiredStamps; break;
        case 'จำนวนคงเหลือ': value = remainingQuantity; break;
        case 'สถานะ': value = status; break;
        case 'รูปภาพ': value = rewardImage; break;
        case 'Description': value = description; break;
        case 'คำอธิบาย': value = description; break;
        case 'RedemptionCode': value = redemptionCode; break;
        case 'รหัสของรางวัล': value = redemptionCode; break;
        default: return;
      }
      sheet.getRange(rowIdx, col).setValue(value);
    });

    return { RewardID: rewardId, message: 'อัปเดตรางวัลสำเร็จ!' };
  });
}

function disableReward(params) {
  const rewardId = String(params.rewardId);
  if (!rewardId) throw new Error('กรุณาระบุรหัสรางวัล');

  return withLock(() => {
    const rowIdx = findRowIndexByValue(SHEET_REWARDS, 'RewardID', rewardId);
    if (rowIdx === -1) throw new Error('ไม่พบรางวัลนี้');
    
    const sheet = getSheet(SHEET_REWARDS);
    const col = getColumnIndexRequired(SHEET_REWARDS, 'สถานะ');
    const current = String(sheet.getRange(rowIdx, col).getValue() || 'Active');
    const newStatus = current === 'Active' ? 'Disabled' : 'Active';
    sheet.getRange(rowIdx, col).setValue(newStatus);
    
    return { 
      RewardID: rewardId, 
      status: newStatus,
      message: newStatus === 'Active' ? 'เปิดใช้งานรางวัลสำเร็จ!' : 'ปิดใช้งานรางวัลสำเร็จ!'
    };
  });
}

function redeemReward(params) {
  const employeeId = normalizeId(params.employeeId);
  const rewardId = String(params.rewardId);

  if (!employeeId) throw new Error('กรุณาระบุรหัสพนักงาน');
  if (!rewardId) throw new Error('กรุณาระบุรางวัลที่ต้องการแลก');

  return withLock(() => {
    const emp = getEmployee({ employeeId });
    const rewards = getRewards();
    const reward = rewards.find(r => r.RewardID === rewardId);
    
    if (!reward) throw new Error('ไม่พบรางวัลนี้');
    if (reward.Status !== 'Active') throw new Error('รางวัลนี้ปิดใช้งานแล้ว');
    if (reward.RemainingQuantity <= 0) throw new Error('รางวัลนี้หมดแล้ว');
    if (emp.TotalStamps < reward.RequiredStamps) {
      throw new Error('แสตมป์สะสมไม่เพียงพอ (ต้องการ ' + reward.RequiredStamps + ' มี ' + emp.TotalStamps + ')');
    }

    const rewardRow = findRowIndexByValue(SHEET_REWARDS, 'RewardID', rewardId);
    if (rewardRow === -1) throw new Error('ไม่พบรางวัลในระบบ');
    
    const rewardSheet = getSheet(SHEET_REWARDS);
    const qtyCol = getColumnIndexRequired(SHEET_REWARDS, 'จำนวนคงเหลือ');
    rewardSheet.getRange(rewardRow, qtyCol).setValue(reward.RemainingQuantity - 1);
    const dataSheet = getSheet(SHEET_DATA);
    const dataHeaders = getHeaders(SHEET_DATA);
    const row = dataHeaders.map(h => {
      switch (h) {
        case 'Timestamp': return new Date();
        case 'รหัสพนักงาน': return employeeId;
        case 'ชื่อ-นามสกุล': return emp.FullName;
        case 'แผนก': return emp.Department;
        case 'กิจกรรม': return 'แลกรางวัล: ' + reward.RewardName;
        case 'จำนวนแสตมป์': return -reward.RequiredStamps;
        case 'ผู้ให้แสตมป์': return 'System (Redemption)';
        case 'รหัสผู้ให้': return '';
        case 'หมายเหตุ': return 'แลกรางวัล ' + reward.RewardName;
        default: return '';
      }
    });
    dataSheet.appendRow(row);

    // Create redemption record
    const redemptionSheet = getSheet(SHEET_REDEMPTIONS);
    const redemptionId = 'RD' + new Date().getTime();
    const rHeaders = getHeaders(SHEET_REDEMPTIONS);
    const rRow = rHeaders.map(h => {
      switch (h) {
        case 'RedemptionID': return redemptionId;
        case 'Timestamp': return new Date();
        case 'รหัสพนักงาน': return employeeId;
        case 'ชื่อพนักงาน': return emp.FullName;
        case 'RewardID': return rewardId;
        case 'ชื่อของรางวัล': return reward.RewardName;
        case 'แสตมป์ที่ใช้': return reward.RequiredStamps;
        case 'สถานะ': return 'Pending';
        case 'ผู้ดำเนินการ': return '';
        case 'หมายเหตุ': return '';
        default: return '';
      }
    });
    redemptionSheet.appendRow(rRow);

    return { 
      RedemptionID: redemptionId, 
      newTotal: computeTotalStamps(employeeId),
      message: 'แลกรางวัลสำเร็จ! กรุณารอการอนุมัติ'
    };
  });
}

function getSortedRedemptionRows() {
  const redemptions = sheetToObjects(SHEET_REDEMPTIONS);
  return redemptions.sort((a, b) => new Date(b['Timestamp']) - new Date(a['Timestamp']));
}

function mapRedemptionRow(r) {
  return {
    RedemptionID: String(r['RedemptionID'] || ''),
    EmployeeID: normalizeId(r['รหัสพนักงาน']),
    EmployeeName: r['ชื่อพนักงาน'] || '',
    RewardID: String(r['RewardID'] || ''),
    RewardName: r['ชื่อของรางวัล'] || '',
    UsedStamps: Number(r['แสตมป์ที่ใช้']) || 0,
    RedemptionDate: formatDate(r['Timestamp']),
    ApprovalStatus: r['สถานะ'] || 'Pending',
    ProcessedBy: r['ผู้ดำเนินการ'] || ''
  };
}

function mapRedemptions() {
  return getSortedRedemptionRows().map(mapRedemptionRow);
}

function getRedemptionHistory(params) {
  const employeeId = normalizeId(params.employeeId);
  return mapRedemptions().filter(r => r.EmployeeID === employeeId);
}

function getAllRedemptions() {
  return mapRedemptions();
}

function approveRedemption(params) {
  const redemptionId = String(params.redemptionId);
  const status = String(params.status || '').trim(); // 'Approved' | 'Rejected'
  const approverName = String(params.approverName || '');

  if (!redemptionId) throw new Error('กรุณาระบุรหัสคำขอ');
  if (!status || !['Approved', 'Rejected'].includes(status)) {
    throw new Error('สถานะต้องเป็น Approved หรือ Rejected');
  }

  return withLock(() => {
    const rowIdx = findRowIndexByValue(SHEET_REDEMPTIONS, 'RedemptionID', redemptionId);
    if (rowIdx === -1) throw new Error('ไม่พบคำขอแลกรางวัลนี้');
    
    const sheet = getSheet(SHEET_REDEMPTIONS);
    const statusCol = getColumnIndexRequired(SHEET_REDEMPTIONS, 'สถานะ');
    const currentStatus = String(sheet.getRange(rowIdx, statusCol).getValue() || 'Pending');
    
    if (currentStatus !== 'Pending') {
      throw new Error('คำขอนี้ถูกดำเนินการแล้ว (' + currentStatus + ')');
    }
    
    sheet.getRange(rowIdx, statusCol).setValue(status);
    
    const approverCol = getColumnIndex(SHEET_REDEMPTIONS, 'ผู้ดำเนินการ');
    if (approverCol !== -1) {
      sheet.getRange(rowIdx, approverCol).setValue(approverName);
    }

    if (status === 'Rejected') {
      const redemptions = sheetToObjects(SHEET_REDEMPTIONS);
      const redemption = redemptions.find(r => String(r['RedemptionID']) === redemptionId);
      
      if (redemption) {
        const employeeId = normalizeId(redemption['รหัสพนักงาน']);
        const usedStamps = Number(redemption['แสตมป์ที่ใช้']) || 0;
        const rewardId = String(redemption['RewardID'] || '');

        // Refund stamps
        const dataSheet = getSheet(SHEET_DATA);
        const dataHeaders = getHeaders(SHEET_DATA);
        const row = dataHeaders.map(h => {
          switch (h) {
            case 'Timestamp': return new Date();
            case 'รหัสพนักงาน': return employeeId;
            case 'ชื่อ-นามสกุล': return redemption['ชื่อพนักงาน'] || '';
            case 'แผนก': return '';
            case 'กิจกรรม': return 'คืนแสตมป์: คำขอแลกรางวัลถูกปฏิเสธ';
            case 'จำนวนแสตมป์': return usedStamps;
            case 'ผู้ให้แสตมป์': return 'System (Refund)';
            case 'รหัสผู้ให้': return '';
            case 'หมายเหตุ': return 'ปฏิเสธโดย ' + approverName;
            default: return '';
          }
        });
        dataSheet.appendRow(row);
        if (rewardId) {
          const rewardRowIdx = findRowIndexByValue(SHEET_REWARDS, 'RewardID', rewardId);
          if (rewardRowIdx !== -1) {
            const rewardSheet = getSheet(SHEET_REWARDS);
            const qtyCol = getColumnIndexRequired(SHEET_REWARDS, 'จำนวนคงเหลือ');
            const currentQty = Number(rewardSheet.getRange(rewardRowIdx, qtyCol).getValue()) || 0;
            rewardSheet.getRange(rewardRowIdx, qtyCol).setValue(currentQty + usedStamps);
          }
        }
      }
    }

    return { 
      RedemptionID: redemptionId, 
      status: status,
      message: status === 'Approved' ? 'อนุมัติการแลกรางวัลสำเร็จ!' : 'ปฏิเสธการแลกรางวัลสำเร็จ!'
    };
  });
}

function getEmployeeDashboard(params) {
  const employeeId = normalizeId(params.employeeId);
  const data = sheetToObjects(SHEET_DATA).filter(d => normalizeId(d['รหัสพนักงาน']) === employeeId);
  
  const totalStamps = data.reduce((sum, d) => sum + (Number(d['จำนวนแสตมป์']) || 0), 0);
  const totalActivities = data.filter(d => (Number(d['จำนวนแสตมป์']) || 0) > 0).length;
  
  const redemptions = getRedemptionHistory({ employeeId });
  const totalRedeemed = redemptions.filter(r => r.ApprovalStatus === 'Approved').length;

  return { totalStamps, totalActivities, totalRedeemed };
}

function getHrDashboard() {
  const employees = sheetToObjects(SHEET_EMPLOYEE);
  const data = sheetToObjects(SHEET_DATA);
  const redemptions = mapRedemptions();

  const totalEmployees = employees.length;
  const totalStampsIssued = data
    .filter(d => (Number(d['จำนวนแสตมป์']) || 0) > 0)
    .reduce((sum, d) => sum + (Number(d['จำนวนแสตมป์']) || 0), 0);
  const totalRedemptions = redemptions.length;
  const pendingRedemptions = redemptions.filter(r => r.ApprovalStatus === 'Pending').length;

  // Top employees by stamps earned
  const stampsByEmployee = {};
  data.forEach(d => {
    const id = normalizeId(d['รหัสพนักงาน']);
    const amount = Number(d['จำนวนแสตมป์']) || 0;
    if (amount <= 0) return;
    stampsByEmployee[id] = (stampsByEmployee[id] || 0) + amount;
  });
  
  const empNameById = {};
  employees.forEach(e => {
    empNameById[normalizeId(e['รหัสพนักงาน'])] = e['ชื่อ-นามสกุล'] || '';
  });
  
  const topEmployees = Object.keys(stampsByEmployee)
    .map(id => ({ 
      employeeId: id,
      name: empNameById[id] || id, 
      stamps: stampsByEmployee[id] 
    }))
    .sort((a, b) => b.stamps - a.stamps)
    .slice(0, 5);

  const countByReward = {};
  redemptions.forEach(r => {
    countByReward[r.RewardName] = (countByReward[r.RewardName] || 0) + 1;
  });
  
  const topRewards = Object.keys(countByReward)
    .map(name => ({ name, count: countByReward[name] }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const monthlyMap = {};
  data.forEach(d => {
    const amount = Number(d['จำนวนแสตมป์']) || 0;
    if (amount <= 0) return;
    const date = new Date(d['Timestamp']);
    if (isNaN(date)) return;
    const key = Utilities.formatDate(date, Session.getScriptTimeZone() || 'GMT+7', 'yyyy-MM');
    if (!monthlyMap[key]) monthlyMap[key] = { stamps: 0, activities: 0 };
    monthlyMap[key].stamps += amount;
    monthlyMap[key].activities += 1;
  });
  
  const monthlySummary = Object.keys(monthlyMap)
    .sort()
    .reverse()
    .slice(0, 12)
    .map(key => ({
      month: key,
      stamps: monthlyMap[key].stamps,
      activities: monthlyMap[key].activities
    }));

  return { 
    totalEmployees, 
    totalStampsIssued, 
    totalRedemptions, 
    pendingRedemptions, 
    topEmployees, 
    topRewards, 
    monthlySummary 
  };
}