/*************************************************************************
 * Magic Stamp Passport — Google Apps Script Backend
 *
 * Deploy as a Web App:
 *   Deploy > New deployment > type: Web app
 *   Execute as: Me
 *   Who has access: Anyone
 * Copy the resulting /exec URL into js/api.js (WEB_APP_URL).
 *
 * This script is built to match the REAL structure of the connected
 * Google Sheet (see README.md "Google Sheet Setup Guide" for the exact
 * headers). Column headers are in Thai to match the existing workbook;
 * this script reads sheets by header name, not fixed column index, so
 * reordering columns will not break it as long as header text matches.
 *************************************************************************/

// ---- Sheet names -------------------------------------------------------
const SHEET_EMPLOYEE = 'Employee';
const SHEET_MANAGERS = 'Managers';
const SHEET_DATA = 'Data';
const SHEET_REWARDS = 'Rewards';
const SHEET_REDEMPTIONS = 'Redemptions';

// ---- Achievement levels (must mirror js/employee.js LEVELS) -----------
const LEVELS = [
  { name: 'Explorer',   min: 0 },
  { name: 'Dreamer',    min: 10 },
  { name: 'Adventurer', min: 25 },
  { name: 'Hero',       min: 50 },
  { name: 'Legend',     min: 100 }
];

// =========================================================================
// Entry points
// =========================================================================

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
      getEmployee, getStampHistory, getRewards, redeemReward, addStamp,
      getEmployeeDashboard, getHrDashboard, approveRedemption, updateReward,
      createReward, disableReward, authenticateManager, searchEmployees,
      getAllRedemptions, getRedemptionHistory
    };

    if (!handlers[action]) throw new Error('ไม่รู้จัก action: ' + action);

    const result = handlers[action](params);
    return jsonResponse({ success: true, data: result });
  } catch (err) {
    return jsonResponse({ success: false, message: err.message });
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// =========================================================================
// Sheet helpers — read rows as arrays of objects keyed by header text
// =========================================================================

function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('ไม่พบชีต: ' + name);
  return sheet;
}

function sheetToObjects(sheetName) {
  const sheet = getSheet(sheetName);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (row.every(c => c === '' || c === null)) continue; // skip blank rows
    const obj = { __row: i + 1 };
    headers.forEach((h, idx) => { obj[h] = row[idx]; });
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
    if (String(values[i][col]).trim() === String(value).trim()) return i + 1; // 1-indexed sheet row
  }
  return -1;
}

function getHeaderIndex(sheetName, headerName) {
  const sheet = getSheet(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const idx = headers.indexOf(headerName);
  if (idx === -1) throw new Error('ไม่พบคอลัมน์ ' + headerName + ' ในชีต ' + sheetName);
  return idx + 1; // 1-indexed
}

function normalizeId(v) {
  // Employee/Manager IDs are stored as numbers in the sheet; normalize both
  // numeric and string input to a comparable trimmed string.
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return String(Math.trunc(v));
  const s = String(v).trim();
  return s;
}

// =========================================================================
// Employee helpers (columns: รหัสพนักงาน, ชื่อ-นามสกุล, แผนก, ตำแหน่ง, Plant, ...)
// =========================================================================

function getLevel(stamps) {
  let current = LEVELS[0];
  for (let i = 0; i < LEVELS.length; i++) {
    if (stamps >= LEVELS[i].min) current = LEVELS[i];
  }
  return current.name;
}

function computeTotalStamps(employeeId) {
  const data = sheetToObjects(SHEET_DATA);
  const id = normalizeId(employeeId);
  return data
    .filter(d => normalizeId(d['รหัสพนักงาน']) === id)
    .reduce((sum, d) => sum + (Number(d['จำนวนแสตมป์']) || 0), 0);
}

function getEmployee(params) {
  const employeeId = normalizeId(params.employeeId);
  if (!employeeId) throw new Error('กรุณาระบุรหัสพนักงาน');

  const employees = sheetToObjects(SHEET_EMPLOYEE);
  const emp = employees.find(e => normalizeId(e['รหัสพนักงาน']) === employeeId);
  if (!emp) throw new Error('ไม่พบรหัสพนักงานนี้ในระบบ');

  const totalStamps = computeTotalStamps(employeeId);

  return {
    EmployeeID: employeeId,
    FullName: emp['ชื่อ-นามสกุล'],
    Department: emp['แผนก'],
    Position: emp['ตำแหน่ง'],
    Plant: emp['Plant'],
    TotalStamps: totalStamps,
    Level: getLevel(totalStamps)
  };
}

function searchEmployees(params) {
  const query = String(params.query || '').trim().toLowerCase();
  const employees = sheetToObjects(SHEET_EMPLOYEE);
  const filtered = !query ? employees.slice(0, 25) : employees.filter(e =>
    normalizeId(e['รหัสพนักงาน']).toLowerCase().includes(query) ||
    String(e['ชื่อ-นามสกุล'] || '').toLowerCase().includes(query)
  );
  return filtered.slice(0, 50).map(e => {
    const id = normalizeId(e['รหัสพนักงาน']);
    return {
      EmployeeID: id,
      FullName: e['ชื่อ-นามสกุล'],
      Department: e['แผนก'],
      Position: e['ตำแหน่ง'],
      TotalStamps: computeTotalStamps(id)
    };
  });
}

// =========================================================================
// Manager auth (columns include PIN, ApproverType: 'HR' | 'Manager')
// =========================================================================

function authenticateManager(params) {
  const managerId = normalizeId(params.managerId);
  const pin = String(params.pin || '').trim();
  if (!managerId || !pin) throw new Error('กรุณาระบุรหัสและ PIN');

  const managers = sheetToObjects(SHEET_MANAGERS);
  const mgr = managers.find(m => normalizeId(m['รหัสพนักงาน']) === managerId);
  if (!mgr) throw new Error('ไม่พบรหัสผู้ดูแลนี้');
  if (String(mgr['PIN']).trim() !== pin) throw new Error('PIN ไม่ถูกต้อง');
  if (mgr['ActiveStatus'] && String(mgr['ActiveStatus']).trim() === 'Inactive') {
    throw new Error('บัญชีนี้ถูกระงับการใช้งาน');
  }

  return {
    ManagerID: managerId,
    FullName: mgr['ชื่อ-นามสกุล'],
    Department: mgr['แผนก'],
    ApproverType: mgr['ApproverType'] || 'Manager',
    Email: mgr['Email']
  };
}

// =========================================================================
// Stamp history + granting
// =========================================================================

function getStampHistory(params) {
  const employeeId = normalizeId(params.employeeId);
  const data = sheetToObjects(SHEET_DATA);
  return data
    .filter(d => normalizeId(d['รหัสพนักงาน']) === employeeId)
    .sort((a, b) => new Date(b['Timestamp']) - new Date(a['Timestamp']))
    .map(d => ({
      ActivityName: d['กิจกรรม'],
      StampAmount: Number(d['จำนวนแสตมป์']) || 0,
      DateTime: formatDate(d['Timestamp']),
      GrantedBy: d['ผู้ให้แสตมป์'],
      Remark: d['หมายเหตุ']
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

  const sheet = getSheet(SHEET_DATA);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = headers.map(h => {
    switch (h) {
      case 'Timestamp': return new Date();
      case 'รหัสพนักงาน': return employeeId;
      case 'ชื่อ-นามสกุล': return emp['ชื่อ-นามสกุล'];
      case 'แผนก': return emp['แผนก'];
      case 'กิจกรรม': return activityName;
      case 'จำนวนแสตมป์': return stampAmount;
      case 'ผู้ให้แสตมป์': return grantedByName;
      case 'รหัสผู้ให้': return grantedById;
      case 'หมายเหตุ': return remark;
      default: return '';
    }
  });
  sheet.appendRow(row);

  return { newTotal: computeTotalStamps(employeeId) };
}

// =========================================================================
// Rewards
// =========================================================================

function getRewards() {
  const rewards = sheetToObjects(SHEET_REWARDS);
  return rewards.map(r => ({
    RewardID: String(r['RewardID']),
    RewardName: r['ชื่อของรางวัล'],
    Description: r['Description'] || r['คำอธิบาย'] || '',
    RequiredStamps: Number(r['แสตมป์ที่ใช้แลก']) || 0,
    RemainingQuantity: Number(r['จำนวนคงเหลือ']) || 0,
    Status: r['สถานะ'] || 'Active',
    RewardImage: r['รูปภาพ'] || ''
  }));
}

function createReward(params) {
  const sheet = getSheet(SHEET_REWARDS);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const newId = 'R' + new Date().getTime();
  const row = headers.map(h => {
    switch (h) {
      case 'RewardID': return newId;
      case 'ชื่อของรางวัล': return params.rewardName || '';
      case 'แสตมป์ที่ใช้แลก': return Number(params.requiredStamps) || 0;
      case 'จำนวนคงเหลือ': return Number(params.remainingQuantity) || 0;
      case 'สถานะ': return params.status || 'Active';
      case 'รูปภาพ': return params.rewardImage || '';
      case 'Description': case 'คำอธิบาย': return params.description || '';
      default: return '';
    }
  });
  sheet.appendRow(row);
  return { RewardID: newId };
}

function updateReward(params) {
  const rewardId = String(params.rewardId);
  const rowIdx = findRowIndexByValue(SHEET_REWARDS, 'RewardID', rewardId);
  if (rowIdx === -1) throw new Error('ไม่พบรางวัลนี้');
  const sheet = getSheet(SHEET_REWARDS);

  setCellByHeader(sheet, rowIdx, 'ชื่อของรางวัล', params.rewardName);
  setCellByHeader(sheet, rowIdx, 'แสตมป์ที่ใช้แลก', Number(params.requiredStamps));
  setCellByHeader(sheet, rowIdx, 'จำนวนคงเหลือ', Number(params.remainingQuantity));
  setCellByHeader(sheet, rowIdx, 'สถานะ', params.status);
  setCellByHeader(sheet, rowIdx, 'รูปภาพ', params.rewardImage);
  trySetCellByHeader(sheet, rowIdx, 'Description', params.description);
  trySetCellByHeader(sheet, rowIdx, 'คำอธิบาย', params.description);

  return { RewardID: rewardId };
}

function disableReward(params) {
  const rewardId = String(params.rewardId);
  const rowIdx = findRowIndexByValue(SHEET_REWARDS, 'RewardID', rewardId);
  if (rowIdx === -1) throw new Error('ไม่พบรางวัลนี้');
  const sheet = getSheet(SHEET_REWARDS);
  const col = getHeaderIndex(SHEET_REWARDS, 'สถานะ');
  const current = sheet.getRange(rowIdx, col).getValue();
  sheet.getRange(rowIdx, col).setValue(current === 'Active' ? 'Disabled' : 'Active');
  return { RewardID: rewardId };
}

function setCellByHeader(sheet, rowIdx, headerName, value) {
  if (value === undefined || value === null || value === '') return;
  const col = getHeaderIndex(sheet.getName(), headerName);
  sheet.getRange(rowIdx, col).setValue(value);
}
function trySetCellByHeader(sheet, rowIdx, headerName, value) {
  try { setCellByHeader(sheet, rowIdx, headerName, value); } catch (e) { /* header may not exist, ignore */ }
}

// =========================================================================
// Redemption
// =========================================================================

function redeemReward(params) {
  const employeeId = normalizeId(params.employeeId);
  const rewardId = String(params.rewardId);

  const emp = getEmployee({ employeeId });
  const rewards = getRewards();
  const reward = rewards.find(r => r.RewardID === rewardId);
  if (!reward) throw new Error('ไม่พบรางวัลนี้');
  if (reward.Status !== 'Active') throw new Error('รางวัลนี้ปิดใช้งานแล้ว');
  if (reward.RemainingQuantity <= 0) throw new Error('รางวัลนี้หมดแล้ว');
  if (emp.TotalStamps < reward.RequiredStamps) throw new Error('แสตมป์สะสมไม่เพียงพอ');

  // Deduct stock
  const rewardRow = findRowIndexByValue(SHEET_REWARDS, 'RewardID', rewardId);
  const rewardSheet = getSheet(SHEET_REWARDS);
  const qtyCol = getHeaderIndex(SHEET_REWARDS, 'จำนวนคงเหลือ');
  rewardSheet.getRange(rewardRow, qtyCol).setValue(reward.RemainingQuantity - 1);

  // Log a negative stamp transaction so TotalStamps reflects the redemption
  const dataSheet = getSheet(SHEET_DATA);
  const headers = dataSheet.getRange(1, 1, 1, dataSheet.getLastColumn()).getValues()[0];
  const row = headers.map(h => {
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
  const rHeaders = redemptionSheet.getRange(1, 1, 1, redemptionSheet.getLastColumn()).getValues()[0];
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

  return { RedemptionID: redemptionId, newTotal: computeTotalStamps(employeeId) };
}

function getRedemptionHistory(params) {
  const employeeId = normalizeId(params.employeeId);
  return mapRedemptions().filter(r => r.EmployeeID === employeeId);
}

function getAllRedemptions() {
  return mapRedemptions().sort((a, b) => new Date(b.RedemptionDate) - new Date(a.RedemptionDate));
}

function mapRedemptions() {
  const redemptions = sheetToObjects(SHEET_REDEMPTIONS);
  return redemptions.map(r => ({
    RedemptionID: String(r['RedemptionID']),
    EmployeeID: normalizeId(r['รหัสพนักงาน']),
    EmployeeName: r['ชื่อพนักงาน'],
    RewardID: String(r['RewardID']),
    RewardName: r['ชื่อของรางวัล'],
    UsedStamps: Number(r['แสตมป์ที่ใช้']) || 0,
    RedemptionDate: formatDate(r['Timestamp']),
    ApprovalStatus: r['สถานะ'] || 'Pending',
    ProcessedBy: r['ผู้ดำเนินการ'] || ''
  }));
}

function approveRedemption(params) {
  const redemptionId = String(params.redemptionId);
  const status = String(params.status); // 'Approved' | 'Rejected'
  const approverName = String(params.approverName || '');

  const rowIdx = findRowIndexByValue(SHEET_REDEMPTIONS, 'RedemptionID', redemptionId);
  if (rowIdx === -1) throw new Error('ไม่พบคำขอแลกรางวัลนี้');
  const sheet = getSheet(SHEET_REDEMPTIONS);
  setCellByHeader(sheet, rowIdx, 'สถานะ', status);
  setCellByHeader(sheet, rowIdx, 'ผู้ดำเนินการ', approverName);

  // If rejected, refund the stamps and restock the reward
  if (status === 'Rejected') {
    const redemptions = sheetToObjects(SHEET_REDEMPTIONS);
    const redemption = redemptions.find(r => String(r['RedemptionID']) === redemptionId);
    if (redemption) {
      const employeeId = normalizeId(redemption['รหัสพนักงาน']);
      const usedStamps = Number(redemption['แสตมป์ที่ใช้']) || 0;
      const rewardId = String(redemption['RewardID']);

      const dataSheet = getSheet(SHEET_DATA);
      const headers = dataSheet.getRange(1, 1, 1, dataSheet.getLastColumn()).getValues()[0];
      const row = headers.map(h => {
        switch (h) {
          case 'Timestamp': return new Date();
          case 'รหัสพนักงาน': return employeeId;
          case 'ชื่อ-นามสกุล': return redemption['ชื่อพนักงาน'];
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

      const rewardRowIdx = findRowIndexByValue(SHEET_REWARDS, 'RewardID', rewardId);
      if (rewardRowIdx !== -1) {
        const rewardSheet = getSheet(SHEET_REWARDS);
        const qtyCol = getHeaderIndex(SHEET_REWARDS, 'จำนวนคงเหลือ');
        const currentQty = Number(rewardSheet.getRange(rewardRowIdx, qtyCol).getValue()) || 0;
        rewardSheet.getRange(rewardRowIdx, qtyCol).setValue(currentQty + 1);
      }
    }
  }

  return { RedemptionID: redemptionId, status };
}

// =========================================================================
// Dashboards
// =========================================================================

function getEmployeeDashboard(params) {
  const employeeId = normalizeId(params.employeeId);
  const data = sheetToObjects(SHEET_DATA).filter(d => normalizeId(d['รหัสพนักงาน']) === employeeId);
  const totalStamps = data.reduce((sum, d) => sum + (Number(d['จำนวนแสตมป์']) || 0), 0);
  const totalActivities = data.filter(d => (Number(d['จำนวนแสตมป์']) || 0) > 0).length;
  const totalRedeemed = getRedemptionHistory({ employeeId }).filter(r => r.ApprovalStatus !== 'Rejected').length;

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
  employees.forEach(e => { empNameById[normalizeId(e['รหัสพนักงาน'])] = e['ชื่อ-นามสกุล']; });
  const topEmployees = Object.keys(stampsByEmployee)
    .map(id => ({ name: empNameById[id] || id, stamps: stampsByEmployee[id] }))
    .sort((a, b) => b.stamps - a.stamps)
    .slice(0, 5);

  // Top rewards by redemption count
  const countByReward = {};
  redemptions.forEach(r => {
    countByReward[r.RewardName] = (countByReward[r.RewardName] || 0) + 1;
  });
  const topRewards = Object.keys(countByReward)
    .map(name => ({ name, count: countByReward[name] }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Monthly activity summary
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
  const monthlySummary = Object.keys(monthlyMap).sort().reverse().slice(0, 12).map(key => ({
    month: key, stamps: monthlyMap[key].stamps, activities: monthlyMap[key].activities
  }));

  return { totalEmployees, totalStampsIssued, totalRedemptions, pendingRedemptions, topEmployees, topRewards, monthlySummary };
}

// =========================================================================
// Utils
// =========================================================================

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (isNaN(date)) return String(value);
  try {
    return Utilities.formatDate(date, Session.getScriptTimeZone() || 'GMT+7', 'dd/MM/yyyy HH:mm');
  } catch (e) {
    return date.toString();
  }
}
