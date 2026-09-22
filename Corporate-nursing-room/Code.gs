/**
 * =========================================================================
 * Corporate Nursing Room & EHS Management System
 * Backend Script: Google Apps Script (Code.gs)
 * =========================================================================
 */

const APP_CONFIG = {
  TIMEZONE: 'Asia/Bangkok',
  SERVICE_FEE: 0,
  LOW_STOCK_THRESHOLD: 10
};

/**
 * จัดการคำขอแบบ GET จาก Frontend (Web App)
 */
function doGet(e) {
  try {
    const params = (e && e.parameter) ? e.parameter : {};
    const action = params.action ? params.action : 'getInitialData';
    let result;

    switch (action) {
      case 'getInitialData':
        result = getInitialData();
        break;
      case 'getDashboardData':
        result = getAnalyticsStats(
          SpreadsheetApp.getActiveSpreadsheet(),
          params.month || null,
          params.year || null,
          params.plant || ""
        );
        break;
      case 'getInventoryData':
        result = getInventoryData();
        break;
      case 'getAttendanceHistory':
        result = getAttendanceHistory(params.sid || "");
        break;
      case 'getDrugHistory':
        result = getDrugHistory(params.drugId || "");
        break;
      case 'exportAttendance':
        result = exportAttendanceToExcel(parseInt(params.month, 10), parseInt(params.year, 10));
        break;
      case 'exportOutbound':
        result = exportOutboundToExcel(parseInt(params.month, 10), parseInt(params.year, 10));
        break;
      case 'ping':
        result = { 
          success: true, 
          message: "API connected successfully", 
          timestamp: Utilities.formatDate(new Date(), APP_CONFIG.TIMEZONE, "dd/MM/yyyy HH:mm:ss")
        };
        break;
      default:
        result = { success: false, message: "Unknown action: " + action };
    }

    return createJsonResponse(result);
  } catch (error) {
    console.error("doGet Error:", error);
    return createJsonResponse({ success: false, message: error.toString() });
  }
}

/**
 * จัดการคำขอแบบ POST จาก Frontend (Web App)
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({ success: false, message: "No post data received" });
    }

    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;
    let result;

    switch (action) {
      case 'saveOutbound':
        result = saveOutbound(payload.form);
        break;
      case 'saveInbound':
        result = saveInbound(payload.form);
        break;
      case 'saveTimeAttendance':
        result = saveTimeAttendance(payload.nurseId, payload.nurseName, payload.status);
        break;
      case 'saveEmployee':
        result = saveEmployee(payload.employee);
        break;
      default:
        result = { success: false, message: "Unknown action: " + action };
    }

    return createJsonResponse(result);
  } catch (error) {
    console.error("doPost Error:", error);
    return createJsonResponse({ success: false, message: error.toString() });
  }
}

/**
 * ส่งออกผลลัพธ์เป็น JSON สำหรับ REST API
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Helper ค้นหาแผ่นงานโดยรองรับชื่อหลายรูปแบบ (ป้องกันพิมพ์ผิด เช่น Employe / Employee)
 */
function getSheetSafe_(ss, names) {
  for (let i = 0; i < names.length; i++) {
    const sheet = ss.getSheetByName(names[i]);
    if (sheet) return sheet;
  }
  return null;
}

/**
 * โหลดข้อมูลเริ่มต้นสำหรับหน้าแรกและฟอร์มต่างๆ
 */
function getInitialData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let nurses = [];
  try {
    const sheet = getSheetSafe_(ss, ["Employe", "Employee", "Nurses", "Nurse"]);
    if (sheet && sheet.getLastRow() > 1) {
      nurses = sheet.getDataRange().getValues().slice(1).map(r => ({
        id: String(r[0] || "").trim(),
        name: String(r[1] || "").trim()
      })).filter(n => n.id && n.name);
    }
  } catch (e) {
    console.error("Error loading nurses:", e);
  }

  let drugs = [];
  try {
    const sheet = getSheetSafe_(ss, ["Drug Registration", "Drugs", "Drug"]);
    if (sheet && sheet.getLastRow() > 1) {
      drugs = sheet.getDataRange().getValues().slice(1).map(r => ({
        id: String(r[2] || "").trim(),
        name: String(r[3] || "").trim(),
        unit: String(r[5] || "").trim(),
        price: toNumber_(r[6])
      })).filter(d => d.id && d.name);
    }
  } catch (e) {
    console.error("Error loading drugs:", e);
  }

  let employees = [];
  try {
    const sheet = getSheetSafe_(ss, ["Add Employe", "Add Employee", "Employees", "Employee List"]);
    if (sheet && sheet.getLastRow() > 1) {
      employees = sheet.getDataRange().getValues().slice(1).map(r => ({
        id: String(r[0] || "").trim(),
        name: String(r[1] || "").trim(),
        dept: String(r[2] || "").trim(),
        position: String(r[3] || "").trim(),
        plant: String(r[4] || "").trim()
      })).filter(e => e.id && e.name);
    }
  } catch (e) {
    console.error("Error loading employees:", e);
  }

  const symptomList = [
    "ปวดศีรษะ/เวียนหัว",
    "เป็นไข้/ตัวร้อน",
    "ปวดท้อง/จุกเสียด",
    "ท้องเสีย/อาหารเป็นพิษ",
    "อุบัติเหตุจากการทำงาน",
    "ปวดกล้ามเนื้อ/ออฟฟิศซินโดรม",
    "แพ้/ผื่นคัน",
    "เจ็บคอ/ไอ/หวัด",
    "ความดันโลหิตสูง",
    "ทำแผลล้างแผล",
    "เบิกยา",
    "อื่นๆ"
  ];

  let dashboard = {
    recent: [],
    symptoms: {},
    depts: {},
    trend: {},
    drugs: {},
    positions: {},
    symptomCategories: { 'ทั่วไป': 0, 'โรคจากการทำงาน': 0, 'อุบัติเหตุจากการทำงาน': 0 },
    summary: { today: 0, month: 0, accidents: 0, referralCount: 0, referralRate: 0 }
  };
  try {
    dashboard = getAnalyticsStats(ss, null, null, "");
  } catch (e) {
    console.error("Error loading dashboard:", e);
  }

  return { nurses, drugs, employees, symptomList, dashboard };
}

/**
 * ฟังก์ชันแปลงและตรวจสอบวันที่อย่างครอบคลุม
 * รองรับ: Date object (พ.ศ./ค.ศ.), DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY
 */
function parseDateRobust(val) {
  if (!val) return null;
  
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    let y = val.getFullYear();
    if (y > 2400) {
      return new Date(y - 543, val.getMonth(), val.getDate(), val.getHours(), val.getMinutes(), val.getSeconds());
    }
    return val;
  }

  const str = String(val).trim();
  if (!str) return null;

  // 1) DD/MM/YYYY หรือ DD-MM-YYYY (พร้อมเวลาตัวเลือก)
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    let year = parseInt(dmyMatch[3], 10);
    if (year > 2400) year -= 543;

    const hour = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
    const min = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
    const sec = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;
    const d = new Date(year, month, day, hour, min, sec);
    return isNaN(d.getTime()) ? null : d;
  }

  // 2) YYYY-MM-DD หรือ YYYY/MM/DD (ISO Format จาก date picker)
  const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (ymdMatch) {
    let year = parseInt(ymdMatch[1], 10);
    if (year > 2400) year -= 543;
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);

    const hour = ymdMatch[4] ? parseInt(ymdMatch[4], 10) : 0;
    const min = ymdMatch[5] ? parseInt(ymdMatch[5], 10) : 0;
    const sec = ymdMatch[6] ? parseInt(ymdMatch[6], 10) : 0;
    const d = new Date(year, month, day, hour, min, sec);
    return isNaN(d.getTime()) ? null : d;
  }

  // 3) Fallback แปลงตรง
  const parsed = new Date(str);
  if (isNaN(parsed.getTime())) return null;
  if (parsed.getFullYear() > 2400) {
    return new Date(parsed.getFullYear() - 543, parsed.getMonth(), parsed.getDate(), parsed.getHours(), parsed.getMinutes(), parsed.getSeconds());
  }
  return parsed;
}

function getSymptomCategory_(symptom) {
  const s = String(symptom || "").trim();
  if (!s) return "ทั่วไป";

  if (s.indexOf("อุบัติเหตุ") !== -1) {
    return "อุบัติเหตุจากการทำงาน";
  }

  const occupationalKeywords = ["ออฟฟิศซินโดรม", "ปวดกล้ามเนื้อ", "จากการทำงาน", "ฝุ่น", "สารเคมี", "การได้ยิน"];
  for (let i = 0; i < occupationalKeywords.length; i++) {
    if (s.indexOf(occupationalKeywords[i]) !== -1) {
      return "โรคจากการทำงาน";
    }
  }

  return "ทั่วไป";
}

function getAnalyticsCacheVersion_() {
  return PropertiesService.getScriptProperties().getProperty('analyticsCacheVersion') || '0';
}

function bumpAnalyticsCacheVersion_() {
  try {
    const props = PropertiesService.getScriptProperties();
    const current = parseInt(props.getProperty('analyticsCacheVersion') || '0', 10);
    props.setProperty('analyticsCacheVersion', String(current + 1));
  } catch (e) {
    console.error("bumpAnalyticsCacheVersion_ Error:", e);
  }
}

function getAnalyticsStats(ss, filterMonth, filterYear, filterPlant) {
  const cache = CacheService.getScriptCache();
  const cacheKey = "analytics_v" + getAnalyticsCacheVersion_() + "_" +
    String(filterMonth) + "_" + String(filterYear) + "_" + String(filterPlant || "");

  try {
    const cached = cache.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (e) {
    console.error("Analytics cache read error:", e);
  }

  const result = computeAnalyticsStats_(ss, filterMonth, filterYear, filterPlant);

  try {
    cache.put(cacheKey, JSON.stringify(result), 30);
  } catch (e) {
    console.error("Analytics cache write notice:", e);
  }

  return result;
}

function computeAnalyticsStats_(ss, filterMonth, filterYear, filterPlant) {
  const outboundSheet = getSheetSafe_(ss, ["Outbound", "Treatments"]);

  let summary = {
    today: 0,
    month: 0,
    prevMonth: 0,
    monthGrowth: 0,
    accidents: 0,
    prevAccidents: 0,
    totalCostMonth: 0,
    prevTotalCostMonth: 0,
    costPerCase: 0,
    referralCount: 0,
    prevReferralCount: 0,
    referralRate: 0
  };

  let symptomCounts = {};
  let deptCounts = {};
  let deptCosts = {};
  let dailyTrend = {};
  let accidentTrend = {};
  let drugUsage = {};
  let positionCounts = {};
  let accidentCases = [];
  let symptomCategoryCounts = { 'ทั่วไป': 0, 'โรคจากการทำงาน': 0, 'อุบัติเหตุจากการทำงาน': 0 };

  const now = new Date();
  const rawMonthParam = String(filterMonth || "").trim().toLowerCase();
  const isAllMonths = (rawMonthParam === 'all' || rawMonthParam === 'ทั้งหมด');

  const hasMonthFilter = (!isAllMonths && filterMonth !== null && filterMonth !== undefined && filterMonth !== "" && !isNaN(filterMonth));
  const hasYearFilter = (filterYear !== null && filterYear !== undefined && filterYear !== "" && !isNaN(filterYear));

  const currentMonth = hasMonthFilter ? (parseInt(filterMonth, 10) - 1) : now.getMonth();
  const currentYear = hasYearFilter ? parseInt(filterYear, 10) : now.getFullYear();
  const todayDate = now.getDate();

  const isRealCurrentMonth = (!isAllMonths && currentMonth === now.getMonth() && currentYear === now.getFullYear());
  const plantFilter = String(filterPlant || "").trim();
  const applyPlantFilter = plantFilter !== "" && plantFilter.toLowerCase() !== "all" && plantFilter !== "ทั้งหมด";

  let prevMonth = null;
  let prevYear;
  if (isAllMonths) {
    prevYear = currentYear - 1;
  } else {
    const prevDate = new Date(currentYear, currentMonth - 1, 1);
    prevMonth = prevDate.getMonth();
    prevYear = prevDate.getFullYear();
  }

  let filteredMonthRowsDisplay = [];
  let data = [];
  if (outboundSheet && outboundSheet.getLastRow() > 1) {
    data = outboundSheet.getDataRange().getValues().slice(1);

    data.forEach((r) => {
      const rowDate = parseDateRobust(r[1]);
      if (!rowDate) return;
      const rowPlant = String(r[16] || "ไม่ระบุ").trim();
      if (applyPlantFilter && rowPlant !== plantFilter) return;

      const rMonth = rowDate.getMonth();
      const rYear = rowDate.getFullYear();
      const rDay = rowDate.getDate();

      const drugCost = parseFloat(r[13]) || 0;
      const serviceFee = parseFloat(r[12]) || 0;
      const cost = drugCost + serviceFee;

      let sym = String(r[4] || "").trim();
      let isAccident = false;
      if (sym) {
        const symLower = sym.toLowerCase();
        if (symLower.includes("อุบัติเหตุ")) {
          isAccident = true;
        }
      }

      const isReferred = String(r[22] || "").trim() === "ส่งตัว";
      const inCurrentPeriod = isAllMonths
        ? (rYear === currentYear)
        : (rMonth === currentMonth && rYear === currentYear);

      if (inCurrentPeriod) {
        const trendKey = isAllMonths ? (rMonth + 1) : rDay;
        const displayDateTime = Utilities.formatDate(rowDate, APP_CONFIG.TIMEZONE, "dd/MM/yyyy HH:mm:ss");

        summary.month++;
        summary.totalCostMonth += cost;
        filteredMonthRowsDisplay.push({
          dateTime: displayDateTime,
          patient: r[18] || "-",
          dept: r[20] || "-",
          symptom: r[4] || "-",
          drug: r[7] || "-"
        });

        if (isAccident) {
          summary.accidents++;
          accidentTrend[trendKey] = (accidentTrend[trendKey] || 0) + 1;
          accidentCases.push({
            date: displayDateTime,
            patient: r[18] || "-",
            dept: r[20] || "-",
            symptom: r[4] || "-",
            remarks: r[5] || "-"
          });
        }

        if (isReferred) {
          summary.referralCount++;
        }

        dailyTrend[trendKey] = (dailyTrend[trendKey] || 0) + 1;
        if (!isAllMonths && isRealCurrentMonth && rDay === todayDate) {
          summary.today++;
        }

        if (sym && sym !== "-") {
          symptomCounts[sym] = (symptomCounts[sym] || 0) + 1;
        }

        const symCategory = getSymptomCategory_(sym);
        symptomCategoryCounts[symCategory] = (symptomCategoryCounts[symCategory] || 0) + 1;

        let dept = String(r[20] || "ไม่ระบุ").trim();
        if (dept) {
          deptCounts[dept] = (deptCounts[dept] || 0) + 1;
          deptCosts[dept] = (deptCosts[dept] || 0) + cost;
        }

        let pos = String(r[19] || "ไม่ระบุ").trim();
        if (pos) {
          positionCounts[pos] = (positionCounts[pos] || 0) + 1;
        }

        let drugNameStr = String(r[7] || "").trim();
        if (drugNameStr) {
          let names = drugNameStr.split(", ");
          names.forEach(nameWithQty => {
            let cleanName = nameWithQty.replace(/\s*\([^)]*\)$/, '').trim();
            if (cleanName) {
              drugUsage[cleanName] = (drugUsage[cleanName] || 0) + 1;
            }
          });
        }
      }

      const inPrevPeriod = isAllMonths
        ? (rYear === prevYear)
        : (rMonth === prevMonth && rYear === prevYear);

      if (inPrevPeriod) {
        summary.prevMonth++;
        summary.prevTotalCostMonth += cost;
        if (isAccident) {
          summary.prevAccidents++;
        }
        if (isReferred) {
          summary.prevReferralCount++;
        }
      }
    });
  }

  if (summary.prevMonth > 0) {
    summary.monthGrowth = Math.round(((summary.month - summary.prevMonth) / summary.prevMonth) * 100);
  } else {
    summary.monthGrowth = 0;
  }

  if (summary.month > 0) {
    summary.costPerCase = Math.round(summary.totalCostMonth / summary.month);
    summary.referralRate = Math.round((summary.referralCount / summary.month) * 1000) / 10;
  } else {
    summary.costPerCase = 0;
    summary.referralRate = 0;
  }

  let stockHealth = {
    totalItems: 0,
    normalStock: 0,
    lowStock: 0,
    outOfStock: 0,
    readinessRate: 100,
    urgentProcureList: []
  };

  try {
    const stockMap = calculateCurrentStock(ss, data);
    for (let id in stockMap) {
      stockHealth.totalItems++;
      const item = stockMap[id];
      if (item.balance <= 0) {
        stockHealth.outOfStock++;
        stockHealth.urgentProcureList.push({ id: item.id, name: item.name, balance: item.balance, unit: item.unit, status: "หมด" });
      } else if (item.balance < APP_CONFIG.LOW_STOCK_THRESHOLD) {
        stockHealth.lowStock++;
        stockHealth.urgentProcureList.push({ id: item.id, name: item.name, balance: item.balance, unit: item.unit, status: "ใกล้หมด" });
      } else {
        stockHealth.normalStock++;
      }
    }
    if (stockHealth.totalItems > 0) {
      stockHealth.readinessRate = Math.round(((stockHealth.totalItems - stockHealth.outOfStock) / stockHealth.totalItems) * 100);
    }
  } catch (e) {
    console.error("stockHealth calculation error:", e);
  }

  const getTop5 = (obj) =>
    Object.entries(obj)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .reduce((o, [k, v]) => ({ ...o, [k]: v }), {});

  let recent = filteredMonthRowsDisplay
    .slice(-8)
    .reverse()
    .map(row => {
      let parts = (row.dateTime || "").split(" ");
      let dateStr = parts[0] || "-";
      let timeStr = parts[1] ? parts[1].substring(0, 5) : "-";

      return {
        date: dateStr,
        time: timeStr,
        patient: row.patient,
        dept: row.dept,
        symptom: row.symptom,
        drug: row.drug
      };
    });

  return {
    recent,
    symptoms: getTop5(symptomCounts),
    depts: getTop5(deptCounts),
    deptCosts,
    drugs: getTop5(drugUsage),
    positions: getTop5(positionCounts),
    trend: dailyTrend,
    accidentTrend,
    accidentCases: accidentCases.slice(-5).reverse(),
    symptomCategories: symptomCategoryCounts,
    summary,
    stockHealth,
    isAllMonths: isAllMonths,
    reportPeriod: isAllMonths ? `ทุกเดือน (ทั้งปี) ${currentYear}` : `${currentMonth + 1}/${currentYear}`,
    filterPlant: applyPlantFilter ? plantFilter : "ทั้งหมด"
  };
}

/**
 * บันทึกรายการตรวจรักษาและจ่ายยา (Outbound)
 */
function saveOutbound(form) {
  if (!form) return { success: false, message: "ไม่พบข้อมูลการจ่ายยา" };

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let ws = getSheetSafe_(ss, ["Outbound", "Treatments"]);
  const REFERRAL_HEADER = "ส่งตัว รพ.ภายนอก (Refer)";

  if (!ws) {
    ws = ss.insertSheet("Outbound");
    ws.appendRow([
      "Treatment ID", "วัน-เวลาที่เข้ารับบริการ", "รหัสพยาบาล", "ชื่อพยาบาล", "อาการหลัก",
      "รายละเอียดเพิ่มเติม", "รหัสยาที่จ่าย", "รายการยาที่จ่าย", "คอลัมน์ 1", "จำนวนยาที่จ่าย",
      "หน่วยยา", "ราคายาต่อหน่วย", "ค่าบริการ", "รวมค่ายาทั้งหมด", "คอลัมน์ 2",
      "สรุปอาการและการรักษา", "Plant", "รหัสพนักงาน", "ชื่อพนักงาน", "ตำแหน่ง", "แผนก", "Timestamp ปรับปรุง",
      REFERRAL_HEADER
    ]);
  } else {
    try {
      const headerCell = ws.getRange(1, 23);
      if (!headerCell.getValue()) {
        headerCell.setValue(REFERRAL_HEADER);
      }
    } catch (e) {
      console.error("ensure referral header error:", e);
    }
  }

  const validItems = (Array.isArray(form.items) ? form.items : [])
    .filter(i => i && i.drugId && Number(i.quantity) > 0);

  if (!validItems.length) {
    return { success: false, message: "กรุณาเลือกยาและระบุจำนวนอย่างน้อย 1 รายการ" };
  }

  const regSheet = getSheetSafe_(ss, ["Drug Registration", "Drugs", "Drug"]);
  const drugMap = {};
  if (regSheet && regSheet.getLastRow() > 1) {
    regSheet.getDataRange().getValues().slice(1).forEach(r => {
      const id = String(r[2] || '').trim();
      if (id) {
        drugMap[id] = {
          id,
          name: String(r[3] || '').trim(),
          unit: String(r[5] || '').trim(),
          price: toNumber_(r[6])
        };
      }
    });
  }

  const normalizedItems = [];
  for (const item of validItems) {
    const id = String(item.drugId).trim();
    const master = drugMap[id];
    if (!master) {
      return { success: false, message: `ไม่พบรหัสยา ${id} ในทะเบียนยา` };
    }
    const qty = Number(item.quantity);
    const unitPrice = (master.price >= 0) ? master.price : 0;
    normalizedItems.push({
      drugId: id,
      drugName: master.name,
      quantity: qty,
      unit: master.unit,
      price: unitPrice,
      total: round2_(qty * unitPrice)
    });
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (lockError) {
    console.error("saveOutbound Lock Error:", lockError);
    return {
      success: false,
      message: "ระบบกำลังบันทึกข้อมูลรายการอื่นอยู่ กรุณารอสักครู่แล้วลองใหม่อีกครั้ง"
    };
  }

  try {
    const stockCheck = checkStockAvailability(normalizedItems);
    if (!stockCheck.success) return stockCheck;

    const now = new Date();
    const ts = Utilities.formatDate(now, APP_CONFIG.TIMEZONE, "dd/MM/yyyy HH:mm:ss");
    const treatmentId = "TRT-" + Utilities.getUuid().replace(/-/g, '').slice(0, 10).toUpperCase();

    const drugIds = normalizedItems.map(i => i.drugId).join(",");
    const drugNames = normalizedItems.map(i => `${i.drugName} (${i.quantity} ${i.unit})`).join(", ");
    const quantities = normalizedItems.map(i => i.quantity).join(",");
    const units = normalizedItems.map(i => i.unit).join(",");
    const prices = normalizedItems.map(i => i.price.toFixed(2)).join(",");
    const totalDrugCost = round2_(normalizedItems.reduce((sum, i) => sum + i.total, 0));
    const serviceFee = APP_CONFIG.SERVICE_FEE;
    const grandTotal = round2_(totalDrugCost + serviceFee);
    const summary = String(form.symptom || "") + (form.remarks ? " (" + String(form.remarks) + ")" : "");

    const isReferred = (form.referral === true || form.referral === "true" || form.referral === "yes" || form.referral === 1 || form.referral === "1");
    const referralStatus = isReferred ? "ส่งตัว" : "ไม่ส่งตัว";

    ws.appendRow([
      treatmentId, ts, form.nurseId || "", form.nurseName || "", form.symptom || "",
      form.remarks || "", drugIds, drugNames, "", quantities, units, prices, serviceFee, totalDrugCost,
      "", summary, form.plant || "", form.patientId || "", form.patientName || "",
      form.position || "", form.dept || "", ts, referralStatus
    ]);

    SpreadsheetApp.flush();
    bumpAnalyticsCacheVersion_();
    return {
      success: true,
      message: `บันทึกการรักษาและจ่ายยาเรียบร้อยแล้ว • รวมค่ายา ฿${totalDrugCost.toFixed(2)} • ค่าบริการ ฿${serviceFee.toFixed(2)} • รวม ฿${grandTotal.toFixed(2)}${isReferred ? ' • ส่งตัว รพ.ภายนอก' : ''}`,
      treatmentId,
      totalDrugCost,
      serviceFee,
      grandTotal,
      referral: isReferred,
      items: normalizedItems
    };
  } catch (error) {
    console.error("saveOutbound Error:", error);
    return {
      success: false,
      message: "ไม่สามารถบันทึกข้อมูลได้: " + error.toString()
    };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

/**
 * ตรวจสอบความเพียงพอของสต็อกยาคงคลัง
 */
function checkStockAvailability(items) {
  if (!items || items.length === 0) return { success: true };

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const currentStock = calculateCurrentStock(ss);

  const aggregated = {};
  items.forEach(item => {
    const drugId = String(item.drugId).trim();
    if (!drugId) return;
    const qty = parseFloat(item.quantity) || 0;
    if (!aggregated[drugId]) {
      aggregated[drugId] = {
        name: item.drugName || (currentStock[drugId] ? currentStock[drugId].name : drugId),
        quantity: 0
      };
    }
    aggregated[drugId].quantity += qty;
  });

  let insufficientItems = [];
  for (const drugId in aggregated) {
    const requestedQty = aggregated[drugId].quantity;
    const availableQty = currentStock[drugId] ? currentStock[drugId].balance : 0;

    if (availableQty < requestedQty) {
      insufficientItems.push({
        drugName: aggregated[drugId].name,
        requested: requestedQty,
        available: availableQty
      });
    }
  }

  if (insufficientItems.length > 0) {
    let msg = "⚠️ สต็อกยาไม่เพียงพอ:\n";
    insufficientItems.forEach(item => {
      msg += `• ${item.drugName}: มีคงเหลือ ${item.available} (เบิกรวม ${item.requested})\n`;
    });
    return { success: false, message: msg };
  }

  return { success: true };
}

/**
 * บันทึกการรับยาเข้าคลัง (Inbound)
 */
function saveInbound(form) {
  if (!form) return { success: false, message: "ไม่พบข้อมูลรับยาเข้าคลัง" };

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let wsInbound = getSheetSafe_(ss, ["Inbound", "Receive"]);
  if (!wsInbound) {
    wsInbound = ss.insertSheet("Inbound");
    wsInbound.appendRow(["Transaction ID", "วัน-เวลาที่บันทึก", "รหัสยา", "ชื่อยา", "ล็อตที่ผลิต", "จำนวน", "หน่วยนับ", "ราคาต่อหน่วย", "วันผลิต (MFG)", "หมายเหตุ", "วันหมดอายุ (EXP)", "รหัสพยาบาลผู้รับ", "ชื่อพยาบาลผู้รับ"]);
  }

  const drugId = String(form.drugId || '').trim();
  const qty = Number(form.quantity);
  const nurseId = String(form.nurseId || '').trim();
  if (!drugId || !(qty > 0) || !nurseId) {
    return { success: false, message: "กรุณาระบุยา จำนวนที่มากกว่า 0 และพยาบาลผู้รับเข้า" };
  }

  const reg = getSheetSafe_(ss, ["Drug Registration", "Drugs", "Drug"]);
  let master = null;
  if (reg && reg.getLastRow() > 1) {
    reg.getDataRange().getValues().slice(1).some(r => {
      if (String(r[2] || '').trim() === drugId) {
        master = { name: String(r[3] || '').trim(), unit: String(r[5] || '').trim(), price: toNumber_(r[6]) };
        return true;
      }
      return false;
    });
  }
  if (!master) return { success: false, message: `ไม่พบรหัสยา ${drugId} ในทะเบียนยา` };

  const now = new Date();
  const ts = Utilities.formatDate(now, APP_CONFIG.TIMEZONE, "dd/MM/yyyy HH:mm:ss");
  const fmtDate = value => {
    if (!value) return "";
    const d = parseDateRobust(value);
    return d ? Utilities.formatDate(d, APP_CONFIG.TIMEZONE, "dd/MM/yyyy") : "";
  };

  wsInbound.appendRow([
    "IN-" + Utilities.getUuid().replace(/-/g, '').slice(0, 10).toUpperCase(),
    ts, drugId, master.name, "", qty, master.unit, master.price,
    fmtDate(form.prodDate), "", fmtDate(form.expireDate), nurseId, form.nurseName || ""
  ]);
  SpreadsheetApp.flush();
  bumpAnalyticsCacheVersion_();

  return {
    success: true,
    message: `บันทึกรับยาเข้าคลังสำเร็จ • ${master.name} ${qty} ${master.unit} • ฿${round2_(qty * master.price).toFixed(2)}`,
    totalCost: round2_(qty * master.price)
  };
}

/**
 * บันทึกเวลาปฏิบัติงานของพยาบาล (Time Attendance)
 */
function saveTimeAttendance(nId, nName, st) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let ws = getSheetSafe_(ss, ["Time Attendance", "Attendance"]);
  if (!ws) {
    ws = ss.insertSheet("Time Attendance");
    ws.appendRow(["วันที่", "เวลา", "รหัส", "ชื่อ", "สถานะ"]);
  }

  ws.appendRow([
    Utilities.formatDate(new Date(), APP_CONFIG.TIMEZONE, "dd/MM/yyyy"),
    Utilities.formatDate(new Date(), APP_CONFIG.TIMEZONE, "HH:mm:ss"),
    nId, nName, st
  ]);

  SpreadsheetApp.flush();
  return { success: true, message: `✅ บันทึกเวลา (${st}) สำเร็จ` };
}

/**
 * บันทึกข้อมูลพนักงานใหม่ หรืออัปเดตถ้ามีอยู่แล้ว
 */
function saveEmployee(employee) {
  if (!employee) {
    return { success: false, message: "ไม่พบข้อมูลพนักงานที่ส่งมา" };
  }

  const id = String(employee.id || "").trim();
  const name = String(employee.name || "").trim();
  const dept = String(employee.dept || "").trim();
  const position = String(employee.position || "").trim();
  const plant = String(employee.plant || "").trim();

  if (!id || !name) {
    return { success: false, message: "กรุณาระบุรหัสพนักงานและชื่อ-นามสกุลให้ครบถ้วน" };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let ws = getSheetSafe_(ss, ["Add Employe", "Add Employee", "Employees"]);
  if (!ws) {
    ws = ss.insertSheet("Add Employe");
    ws.appendRow(["รหัสพนักงาน", "ชื่อ-นามสกุล", "แผนก", "ตำแหน่ง", "โรงงาน/สาขา"]);
    ws.setFrozenRows(1);
  }

  if (ws.getLastRow() > 1) {
    const ids = ws.getRange(2, 1, ws.getLastRow() - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      if (String(ids[i][0]).trim() === id) {
        ws.getRange(i + 2, 1, 1, 5).setValues([[id, name, dept, position, plant]]);
        SpreadsheetApp.flush();
        return {
          success: true,
          message: "✅ ปรับปรุงข้อมูลพนักงานเรียบร้อยแล้ว (รหัสพนักงานนี้มีอยู่แล้วในระบบ)",
          employee: { id, name, dept, position, plant }
        };
      }
    }
  }

  ws.appendRow([id, name, dept, position, plant]);
  SpreadsheetApp.flush();

  return {
    success: true,
    message: "✅ เพิ่มข้อมูลพนักงานใหม่เรียบร้อยแล้ว",
    employee: { id, name, dept, position, plant }
  };
}

function toNumber_(value) {
  if (typeof value === 'number') return isFinite(value) ? value : 0;
  const n = parseFloat(String(value || '').replace(/,/g, '').replace(/฿/g, '').trim());
  return isFinite(n) ? n : 0;
}

function round2_(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/**
 * คำนวณสต็อกยาคงคลังปัจจุบัน (รับเข้า - จ่ายออก)
 */
function calculateCurrentStock(ss, preloadedOutboundData) {
  try {
    const regSheet = getSheetSafe_(ss, ["Drug Registration", "Drugs", "Drug"]);
    const inboundSheet = getSheetSafe_(ss, ["Inbound", "Receive"]);
    const outboundSheet = getSheetSafe_(ss, ["Outbound", "Treatments"]);
    let stock = {};

    if (regSheet && regSheet.getLastRow() > 1) {
      regSheet.getDataRange().getValues().slice(1).forEach(row => {
        const drugId = String(row[2] || "").trim();
        if (drugId) {
          stock[drugId] = {
            id: drugId,
            name: String(row[3] || "").trim(),
            unit: String(row[5] || "").trim(),
            price: toNumber_(row[6]),
            balance: 0
          };
        }
      });
    }

    if (inboundSheet && inboundSheet.getLastRow() > 1) {
      inboundSheet.getDataRange().getValues().slice(1).forEach(row => {
        const drugId = String(row[2] || "").trim();
        const qty = parseFloat(row[5]) || 0;
        if (drugId) {
          if (!stock[drugId]) {
            stock[drugId] = {
              id: drugId,
              name: String(row[3] || "").trim(),
              unit: String(row[6] || "").trim(),
              price: toNumber_(row[7]),
              balance: 0
            };
          }
          stock[drugId].balance = Math.round((stock[drugId].balance + qty) * 100) / 100;
        }
      });
    }

    const outboundRows = preloadedOutboundData
      ? preloadedOutboundData
      : (outboundSheet && outboundSheet.getLastRow() > 1 ? outboundSheet.getDataRange().getValues().slice(1) : []);

    outboundRows.forEach(row => {
      const idStr = String(row[6] || "");
      const qtyStr = String(row[9] || "");
      if (idStr && qtyStr) {
        const ids = idStr.split(",").map(s => s.trim());
        const qtys = qtyStr.split(",").map(s => s.trim());
        ids.forEach((dId, index) => {
          const q = parseFloat(qtys[index]) || 0;
          if (stock[dId]) {
            stock[dId].balance = Math.round((stock[dId].balance - q) * 100) / 100;
          }
        });
      }
    });

    return stock;
  } catch (e) {
    console.error("calculateCurrentStock Error:", e);
    return {};
  }
}

function getInventoryData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const stock = calculateCurrentStock(ss);
  let result = [];

  for (let drugId in stock) {
    const item = stock[drugId];
    let status = item.balance <= 0 ? 'หมด' : (item.balance < APP_CONFIG.LOW_STOCK_THRESHOLD ? 'ใกล้หมด' : 'ปกติ');
    result.push([item.id, item.name, item.unit, item.balance, status]);
  }

  return result.sort((a, b) => a[3] - b[3]);
}

function getDrugHistory(drugId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const inboundSheet = getSheetSafe_(ss, ["Inbound", "Receive"]);
  const outboundSheet = getSheetSafe_(ss, ["Outbound", "Treatments"]);
  let history = [];
  const searchId = String(drugId).trim();

  if (inboundSheet && inboundSheet.getLastRow() > 1) {
    const inVals = inboundSheet.getDataRange().getValues().slice(1);
    const inDisp = inboundSheet.getDataRange().getDisplayValues().slice(1);
    inVals.forEach((r, idx) => {
      if (String(r[2] || "").trim() === searchId) {
        history.push({
          rawDate: parseDateRobust(r[1]) || new Date(0),
          displayDate: inDisp[idx][1] || "-",
          type: 'รับเข้า',
          qty: parseFloat(r[5] || 0),
          by: r[12] || "-",
          note: `ผลิต: ${inDisp[idx][8] || "-"}`
        });
      }
    });
  }

  if (outboundSheet && outboundSheet.getLastRow() > 1) {
    const outVals = outboundSheet.getDataRange().getValues().slice(1);
    const outDisp = outboundSheet.getDataRange().getDisplayValues().slice(1);
    outVals.forEach((r, idx) => {
      const idStr = String(r[6] || "");
      const qtyStr = String(r[9] || "");
      if (idStr) {
        const ids = idStr.split(",").map(id => id.trim());
        const qtys = qtyStr.split(",").map(qty => qty.trim());
        ids.forEach((id, index) => {
          if (id === searchId) {
            history.push({
              rawDate: parseDateRobust(r[1]) || new Date(0),
              displayDate: outDisp[idx][1] || "-",
              type: 'จ่ายออก',
              qty: -parseFloat(qtys[index] || 0),
              by: r[3] || "-",
              note: `ให้: ${r[18] || "-"} (${r[20] || "-"})`
            });
          }
        });
      }
    });
  }

  history.sort((a, b) => b.rawDate - a.rawDate);

  return history.map(h => ({
    date: h.displayDate,
    type: h.type,
    qty: h.qty,
    by: h.by,
    note: h.note
  }));
}

function getAttendanceHistory(sid) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ws = getSheetSafe_(ss, ["Time Attendance", "Attendance"]);
  if (!ws || ws.getLastRow() <= 1) return [];

  let displayData = ws.getDataRange().getDisplayValues().slice(1);
  const filterSid = String(sid || "").trim();
  if (filterSid) {
    displayData = displayData.filter(r => String(r[2]).trim() === filterSid);
  }

  return displayData.slice().reverse().slice(0, 10).map(r => ({
    date: r[0],
    time: r[1],
    id: r[2],
    name: r[3],
    status: r[4]
  }));
}

function exportAttendanceToExcel(month, year) {
  const now = new Date();
  const m = (!month || isNaN(month)) ? (now.getMonth() + 1) : month;
  const y = (!year || isNaN(year)) ? now.getFullYear() : year;
  return generateExport(["Time Attendance", "Attendance"], `Export_Time_${m}_${y}`, m, y, [0]);
}

function exportOutboundToExcel(month, year) {
  const now = new Date();
  const m = (!month || isNaN(month)) ? (now.getMonth() + 1) : month;
  const y = (!year || isNaN(year)) ? now.getFullYear() : year;
  return generateExport(["Outbound", "Treatments"], `Export_Treat_${m}_${y}`, m, y, [1]);
}

/**
 * สร้างไฟล์ .xlsx (Office Open XML) แท้และคืนค่า Base64 สำหรับดาวน์โหลดทันที
 */
function generateExport(sheetNames, targetName, month, year, dateCols) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const targetArray = Array.isArray(sheetNames) ? sheetNames : [sheetNames];
  const ws = getSheetSafe_(ss, targetArray);
  if (!ws) return { success: false, message: `ไม่พบแผ่นงาน ${targetArray.join(" หรือ ")}` };

  const lastRow = ws.getLastRow();
  if (lastRow <= 1) {
    return { success: false, message: "ไม่มีข้อมูลให้ Export" };
  }

  let targetYear = year;
  if (targetYear > 2400) targetYear -= 543;

  const displayData = ws.getDataRange().getDisplayValues();
  const rawData = ws.getDataRange().getValues();
  const headers = displayData[0];

  const mergeRowForExport = (rawRow, displayRow) =>
    rawRow.map((rawVal, idx) => (typeof rawVal === 'number' && isFinite(rawVal)) ? rawVal : displayRow[idx]);

  const filteredRows = [];
  for (let i = 1; i < rawData.length; i++) {
    const row = rawData[i];
    let matched = false;
    for (const col of dateCols) {
      const d = parseDateRobust(row[col]);
      if (d && (d.getMonth() + 1) === month && d.getFullYear() === targetYear) {
        matched = true;
        break;
      }
    }
    if (matched) {
      filteredRows.push(mergeRowForExport(row, displayData[i]));
    }
  }

  if (filteredRows.length === 0) {
    return { success: false, message: `ไม่พบข้อมูลในเดือน ${month}/${year}` };
  }

  try {
    const base64 = buildXlsxBase64_(ws.getName(), headers, filteredRows);
    const fileName = `${targetName}.xlsx`;

    return {
      success: true,
      message: `Export สำเร็จ (${filteredRows.length} รายการ)`,
      fileName: fileName,
      base64: base64
    };
  } catch (error) {
    console.error("generateExport Error:", error);
    return { success: false, message: "เกิดข้อผิดพลาดขณะสร้างไฟล์ Export: " + error.toString() };
  }
}

/**
 * ประกอบโครงสร้างไฟล์ .xlsx (Office Open XML / Zip) ที่สมบูรณ์ตามมาตรฐาน ISO/IEC 29500
 */
function buildXlsxBase64_(sheetName, headers, rows) {
  const safeSheetName = String(sheetName || "Sheet1").replace(/[\\/?*\[\]:]/g, "").substring(0, 31) || "Sheet1";

  const contentTypesXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    '</Types>';

  const rootRelsXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '</Relationships>';

  const workbookXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<sheets><sheet name="' + escapeXml_(safeSheetName) + '" sheetId="1" r:id="rId1"/></sheets>' +
    '</workbook>';

  const workbookRelsXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    '</Relationships>';

  const stylesXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="2">' +
    '<font><sz val="11"/><name val="Calibri"/></font>' +
    '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>' +
    '</fonts>' +
    '<fills count="3">' +
    '<fill><patternFill patternType="none"/></fill>' +
    '<fill><patternFill patternType="gray125"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FF0284C7"/><bgColor indexed="64"/></patternFill></fill>' +
    '</fills>' +
    '<borders count="1">' +
    '<border><left/><right/><top/><bottom/><diagonal/></border>' +
    '</borders>' +
    '<cellStyleXfs count="1">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>' +
    '</cellStyleXfs>' +
    '<cellXfs count="2">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
    '</cellXfs>' +
    '</styleSheet>';

  const sheetXml = buildSheetXml_(headers, rows);

  const files = [
    Utilities.newBlob(contentTypesXml, 'application/xml', '[Content_Types].xml'),
    Utilities.newBlob(rootRelsXml, 'application/xml', '_rels/.rels'),
    Utilities.newBlob(workbookXml, 'application/xml', 'xl/workbook.xml'),
    Utilities.newBlob(workbookRelsXml, 'application/xml', 'xl/_rels/workbook.xml.rels'),
    Utilities.newBlob(stylesXml, 'application/xml', 'xl/styles.xml'),
    Utilities.newBlob(sheetXml, 'application/xml', 'xl/worksheets/sheet1.xml')
  ];

  const zipBlob = Utilities.zip(files, 'export.xlsx');
  return Utilities.base64Encode(zipBlob.getBytes());
}

function buildSheetXml_(headers, rows) {
  let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>';

  xml += buildRowXml_(1, headers, 1);
  for (let i = 0; i < rows.length; i++) {
    xml += buildRowXml_(i + 2, rows[i], 0);
  }

  xml += '</sheetData></worksheet>';
  return xml;
}

function buildRowXml_(rowIndex, values, styleIndex) {
  let rowXml = '<row r="' + rowIndex + '">';
  const sAttr = (styleIndex !== undefined && styleIndex > 0) ? ' s="' + styleIndex + '"' : '';

  for (let c = 0; c < values.length; c++) {
    const cellRef = columnLetter_(c + 1) + rowIndex;
    const val = values[c];
    if (val === null || val === undefined || val === '') {
      continue;
    }
    if (typeof val === 'number' && isFinite(val)) {
      rowXml += '<c r="' + cellRef + '"' + sAttr + '><v>' + val + '</v></c>';
    } else {
      rowXml += '<c r="' + cellRef + '"' + sAttr + ' t="inlineStr"><is><t xml:space="preserve">' + escapeXml_(String(val)) + '</t></is></c>';
    }
  }
  rowXml += '</row>';
  return rowXml;
}

function columnLetter_(colIndex) {
  let letter = '';
  while (colIndex > 0) {
    const rem = (colIndex - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    colIndex = Math.floor((colIndex - 1) / 26);
  }
  return letter;
}

function escapeXml_(str) {
  return String(str)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
