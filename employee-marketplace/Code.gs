/**
 * =========================================================================
 * EMPLOYEE MARKETPLACE - BACKEND API (Google Apps Script)
 * =========================================================================
 * วางโค้ดนี้ใน Extensions > Apps Script บน Google Sheets ของคุณ
 * และทำการ Deploy as Web App (Execute as: Me, Who has access: Anyone)
 */

// ชื่อชีตต่างๆ ในระบบ
const SHEETS = {
  EMPLOYEE: 'Employee',
  PRODUCTS: 'Products',
  MESSAGES: 'Messages',
  LOGS: 'Logs',
  ADMIN: 'Admin'   // ชีตสำหรับกำหนดสิทธิ์แอดมิน (สามารถเพิ่ม/ลบ EmpID ในชีตนี้ได้เลย)
};

// ชื่อโฟลเดอร์ Google Drive สำหรับเก็บรูปสินค้า (ระบบจะสร้างให้อัตโนมัติใน My Drive หากไม่ระบุ ID)
const UPLOAD_FOLDER_NAME = 'Employee_Marketplace_Images';

// หากต้องการระบุ Folder ID เจาะจงจาก Google Drive สามารถนำ ID มาใส่ตรงนี้ได้ (หากเว้นว่างไว้จะใช้ชื่อโฟลเดอร์ด้านบน)
// ตัวอย่าง: const UPLOAD_FOLDER_ID = '1a2B3c4D5e...';
const UPLOAD_FOLDER_ID = '';

/**
 * --------------------------------------------------------------------------
 * HTTP GET Request Handler (ดึงข้อมูล)
 * --------------------------------------------------------------------------
 */
function doGet(e) {
  try {
    const action = e.parameter ? e.parameter.action : '';
    let result = { success: false, message: 'Action not specified' };

    switch (action) {
      case 'ping':
        result = { success: true, message: 'API is running successfully!' };
        break;

      case 'getProducts':
        result = getProductsHandler();
        break;

      case 'getMessages':
        const productId = e.parameter.productId;
        const buyerId = e.parameter.buyerId;
        const sellerId = e.parameter.sellerId;
        result = getMessagesHandler(productId, buyerId, sellerId);
        break;

      case 'getMyChats':
        const empId = e.parameter.empId;
        result = getMyChatsHandler(empId);
        break;

      case 'getAdminDashboard':
        const adminEmpId = e.parameter.adminEmpId;
        result = getAdminDashboardHandler(adminEmpId);
        break;

      default:
        result = { success: false, message: 'Invalid action: ' + action };
    }

    return createJsonResponse(result);
  } catch (error) {
    return createJsonResponse({ success: false, error: error.toString() });
  }
}

/**
 * --------------------------------------------------------------------------
 * HTTP POST Request Handler (เข้าสู่ระบบ / บันทึกข้อมูล / อัปโหลด / ส่งแชท)
 * --------------------------------------------------------------------------
 */
function doPost(e) {
  try {
    let postData;
    if (e.postData && e.postData.contents) {
      postData = JSON.parse(e.postData.contents);
    } else {
      postData = e.parameter;
    }

    const action = postData.action;
    let result = { success: false, message: 'Action not specified' };

    switch (action) {
      case 'login':
        result = loginHandler(postData.empId, postData.pin);
        break;

      case 'createProduct':
        result = createProductHandler(postData);
        break;

      case 'deleteProduct':
        result = deleteProductHandler(postData.productId, postData.empId);
        break;

      case 'adminDeleteProduct':
        result = adminDeleteProductHandler(postData.productId, postData.adminEmpId, postData.reason);
        break;

      case 'updateProductStatus':
        result = updateProductStatusHandler(postData.productId, postData.empId, postData.status);
        break;

      case 'sendMessage':
        result = sendMessageHandler(postData);
        break;

      default:
        result = { success: false, message: 'Invalid action: ' + action };
    }

    return createJsonResponse(result);
  } catch (error) {
    return createJsonResponse({ success: false, error: error.toString() });
  }
}

/**
 * --------------------------------------------------------------------------
 * HELPER: สร้าง JSON Response พร้อม CORS Header
 * --------------------------------------------------------------------------
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * --------------------------------------------------------------------------
 * 0. ADMIN HELPER: ตรวจสอบสิทธิ์ Admin จากชีต Admin
 * --------------------------------------------------------------------------
 */
function checkIsAdminInSheet(empId) {
  if (!empId) return false;
  const targetId = String(empId).trim().toUpperCase();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let adminSheet = ss.getSheetByName(SHEETS.ADMIN);

  // ถ้ายังไม่มีชีต Admin ให้สร้างขึ้นพร้อม Headers
  if (!adminSheet) {
    adminSheet = ss.insertSheet(SHEETS.ADMIN);
    adminSheet.appendRow(['EmpID', 'Name', 'Role', 'CreatedAt', 'Note']);
    // เพิ่มตัวอย่างแอดมินแถวแรก
    adminSheet.appendRow(['EMP001', 'ผู้ดูแลระบบ', 'SuperAdmin', new Date(), 'แอดมินเริ่มต้น']);
  }

  const data = adminSheet.getDataRange().getValues();
  if (data.length <= 1) return false;

  const headers = data[0].map(h => String(h).trim());
  const idxEmpId = headers.indexOf('EmpID');
  if (idxEmpId === -1) return false;

  for (let i = 1; i < data.length; i++) {
    const rowId = String(data[i][idxEmpId]).trim().toUpperCase();
    if (rowId === targetId) {
      return true;
    }
  }

  return false;
}

/**
 * --------------------------------------------------------------------------
 * 0. LOGGING: บันทึกประวัติกิจกรรมลงในชีต Logs
 * --------------------------------------------------------------------------
 */
function writeLog(empId, action, details) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEETS.LOGS);

    if (!sheet) {
      sheet = ss.insertSheet(SHEETS.LOGS);
      sheet.appendRow(['LogID', 'Timestamp', 'EmpID', 'Action', 'Details']);
    }

    const logId = 'LOG-' + new Date().getTime();
    const timestamp = new Date();

    sheet.appendRow([
      logId,
      timestamp,
      String(empId || 'SYSTEM').trim().toUpperCase(),
      String(action || '').trim(),
      String(details || '').trim()
    ]);
  } catch (err) {
    Logger.log('Write Log Error: ' + err.toString());
  }
}

/**
 * --------------------------------------------------------------------------
 * 1. AUTH: ระบบ Login ตรวจสอบ EmpID + PIN
 * --------------------------------------------------------------------------
 */
function loginHandler(empId, pin) {
  if (!empId || !pin) {
    return { success: false, message: 'กรุณากรอกรหัสพนักงานและ PIN' };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.EMPLOYEE);
  if (!sheet) {
    return { success: false, message: 'ไม่พบชีต ' + SHEETS.EMPLOYEE };
  }

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return { success: false, message: 'ไม่มีข้อมูลพนักงานในระบบ' };
  }

  const headers = data[0].map(h => String(h).trim());
  const idxEmpId = headers.indexOf('EmpID');
  const idxName = headers.indexOf('Name');
  const idxDept = headers.indexOf('Department');
  const idxPos = headers.indexOf('Position');
  const idxPlant = headers.indexOf('Plant');
  const idxPrefix = headers.indexOf('Prefix');
  const idxFirstName = headers.indexOf('FirstName');
  const idxLastName = headers.indexOf('LastName');
  const idxPIN = headers.indexOf('PIN');

  if (idxEmpId === -1 || idxPIN === -1) {
    return { success: false, message: 'โครงสร้างคอลัมน์ชีต Employee ไม่ถูกต้อง (ต้องมี EmpID และ PIN)' };
  }

  const inputEmpId = String(empId).trim().toUpperCase();
  const inputPin = String(pin).trim().replace(/\.0+$/, '');

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowEmpId = String(row[idxEmpId]).trim().toUpperCase();
    const rowPin = String(row[idxPIN]).trim().replace(/\.0+$/, '');

    if (rowEmpId === inputEmpId) {
      if (rowPin === inputPin) {
        // Login สำเร็จ - รวมชื่อแสดงผล
        let fullName = '';
        if (idxName !== -1 && row[idxName]) {
          fullName = String(row[idxName]);
        } else {
          const p = idxPrefix !== -1 ? String(row[idxPrefix]) : '';
          const fn = idxFirstName !== -1 ? String(row[idxFirstName]) : '';
          const ln = idxLastName !== -1 ? String(row[idxLastName]) : '';
          fullName = `${p}${fn} ${ln}`.trim();
        }

        const dept = idxDept !== -1 ? String(row[idxDept]) : '';
        const pos = idxPos !== -1 ? String(row[idxPos]) : '';
        
        // ตรวจสอบสิทธิ์ Admin จากชีต Admin โดยตรง
        const isAdmin = checkIsAdminInSheet(rowEmpId);

        // บันทึก Log เข้าสู่ระบบ
        writeLog(rowEmpId, 'LOGIN', `เข้าสู่ระบบสำเร็จ (${fullName}, ${dept}) ${isAdmin ? '[ADMIN]' : ''}`);

        return {
          success: true,
          message: 'เข้าสู่ระบบสำเร็จ',
          user: {
            empId: rowEmpId,
            name: fullName || rowEmpId,
            department: dept,
            position: pos,
            plant: idxPlant !== -1 ? String(row[idxPlant]) : '',
            prefix: idxPrefix !== -1 ? String(row[idxPrefix]) : '',
            firstName: idxFirstName !== -1 ? String(row[idxFirstName]) : '',
            lastName: idxLastName !== -1 ? String(row[idxLastName]) : '',
            isAdmin: isAdmin
          }
        };
      } else {
        writeLog(inputEmpId, 'LOGIN_FAILED', 'กรอก PIN ผิด');
        return { success: false, message: 'PIN ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง' };
      }
    }
  }

  writeLog(inputEmpId, 'LOGIN_FAILED', 'ไม่พบรหัสพนักงานในระบบ');
  return { success: false, message: 'ไม่พบรหัสพนักงานนี้ในระบบ' };
}

/**
 * --------------------------------------------------------------------------
 * 2. PRODUCTS: ดึงรายการสินค้าทั้งหมด (พร้อมข้อมูลผู้ขาย)
 * --------------------------------------------------------------------------
 */
function getProductsHandler() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const prodSheet = ss.getSheetByName(SHEETS.PRODUCTS);
  const empSheet = ss.getSheetByName(SHEETS.EMPLOYEE);

  if (!prodSheet) {
    return { success: true, products: [] };
  }

  // ดึง Map พนักงานเพื่อนำชื่อ/แผนกไปแสดง
  const empMap = {};
  if (empSheet) {
    const empData = empSheet.getDataRange().getValues();
    if (empData.length > 1) {
      const empHeaders = empData[0].map(h => String(h).trim());
      const eIdxEmpId = empHeaders.indexOf('EmpID');
      const eIdxName = empHeaders.indexOf('Name');
      const eIdxDept = empHeaders.indexOf('Department');
      const eIdxPlant = empHeaders.indexOf('Plant');
      const eIdxPrefix = empHeaders.indexOf('Prefix');
      const eIdxFirstName = empHeaders.indexOf('FirstName');
      const eIdxLastName = empHeaders.indexOf('LastName');

      for (let i = 1; i < empData.length; i++) {
        const row = empData[i];
        const id = String(row[eIdxEmpId]).trim().toUpperCase();

        let sName = '';
        if (eIdxName !== -1 && row[eIdxName]) {
          sName = String(row[eIdxName]);
        } else {
          const p = eIdxPrefix !== -1 ? String(row[eIdxPrefix]) : '';
          const fn = eIdxFirstName !== -1 ? String(row[eIdxFirstName]) : '';
          const ln = eIdxLastName !== -1 ? String(row[eIdxLastName]) : '';
          sName = `${p}${fn} ${ln}`.trim();
        }

        empMap[id] = {
          name: sName || id,
          department: eIdxDept !== -1 ? String(row[eIdxDept]) : '',
          plant: eIdxPlant !== -1 ? String(row[eIdxPlant]) : ''
        };
      }
    }
  }

  const data = prodSheet.getDataRange().getValues();
  if (data.length <= 1) {
    return { success: true, products: [] };
  }

  const headers = data[0].map(h => String(h).trim());
  const idxId = headers.indexOf('ProductID');
  const idxEmpId = headers.indexOf('EmpID');
  const idxTitle = headers.indexOf('Title');
  const idxCat = headers.indexOf('Category');
  const idxPrice = headers.indexOf('Price');
  const idxDesc = headers.indexOf('Description');
  const idxPhone = headers.indexOf('Phone');
  const idxImg = headers.indexOf('ImageURL');
  const idxStatus = headers.indexOf('Status');
  const idxCreated = headers.indexOf('CreatedAt');

  const products = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const status = idxStatus !== -1 ? String(row[idxStatus]).trim().toUpperCase() : 'ACTIVE';
    
    // ข้ามสินค้าที่ถูกลบ
    if (status === 'DELETED' || status === 'DELETED_BY_ADMIN') continue;

    const sellerEmpId = idxEmpId !== -1 ? String(row[idxEmpId]).trim().toUpperCase() : '';
    const sellerInfo = empMap[sellerEmpId] || { name: sellerEmpId, department: '', plant: '' };

    products.push({
      productId: idxId !== -1 ? String(row[idxId]) : '',
      empId: sellerEmpId,
      sellerName: sellerInfo.name,
      sellerDept: sellerInfo.department,
      sellerPlant: sellerInfo.plant,
      title: idxTitle !== -1 ? String(row[idxTitle]) : '',
      category: idxCat !== -1 ? String(row[idxCat]) : 'ทั่วไป',
      price: idxPrice !== -1 ? Number(row[idxPrice]) || 0 : 0,
      description: idxDesc !== -1 ? String(row[idxDesc]) : '',
      phone: idxPhone !== -1 ? String(row[idxPhone]) : '',
      imageUrl: idxImg !== -1 ? String(row[idxImg]) : '',
      status: status,
      createdAt: idxCreated !== -1 && row[idxCreated] ? formatDateTime(new Date(row[idxCreated])) : ''
    });
  }

  // เรียงลำดับจากใหม่สุดไปเก่าสุด
  products.reverse();

  return { success: true, products: products };
}

/**
 * --------------------------------------------------------------------------
 * 3. PRODUCTS: ลงประกาศขายสินค้าใหม่ + บันทึกภาพลง Google Drive
 * --------------------------------------------------------------------------
 */
function createProductHandler(postData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEETS.PRODUCTS);

  // ถ้ายังไม่มีชีต ให้สร้างขึ้นพร้อม Headers
  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.PRODUCTS);
    sheet.appendRow(['ProductID', 'EmpID', 'Title', 'Category', 'Price', 'Description', 'Phone', 'ImageURL', 'Status', 'CreatedAt']);
  }

  const productId = 'PROD-' + new Date().getTime();
  let imageUrl = '';

  // ตรวจสอบว่ามีการส่งรูปภาพแบบ Base64 มาหรือไม่
  if (postData.imageBase64 && postData.imageName) {
    try {
      imageUrl = saveImageToDrive(postData.imageBase64, postData.imageName, productId);
    } catch (err) {
      Logger.log('Drive Upload Error: ' + err.toString());
      imageUrl = '';
    }
  } else if (postData.imageUrl) {
    imageUrl = postData.imageUrl;
  }

  const empId = String(postData.empId).trim().toUpperCase();
  const title = String(postData.title || '');
  const price = Number(postData.price) || 0;
  const category = String(postData.category || 'ทั่วไป');

  const rowData = [
    productId,
    empId,
    title,
    category,
    price,
    String(postData.description || ''),
    String(postData.phone || ''),
    imageUrl,
    'ACTIVE',
    new Date()
  ];

  sheet.appendRow(rowData);

  // บันทึก Log
  writeLog(empId, 'POST_PRODUCT', `ลงขายสินค้า [${productId}] "${title}" (ราคา: ฿${price.toLocaleString()}, หมวด: ${category})`);

  return {
    success: true,
    message: 'ลงประกาศสินค้าสำเร็จ!',
    productId: productId,
    imageUrl: imageUrl
  };
}

/**
 * --------------------------------------------------------------------------
 * 4. PRODUCTS: ลบ หรือ เปลี่ยนสถานะสินค้า (User & Admin)
 * --------------------------------------------------------------------------
 */
function deleteProductHandler(productId, empId) {
  const res = updateProductStatusHandler(productId, empId, 'DELETED');
  if (res.success) {
    writeLog(empId, 'DELETE_PRODUCT_USER', `พนักงานลบสินค้าของตนเอง [${productId}]`);
  }
  return res;
}

function adminDeleteProductHandler(productId, adminEmpId, reason) {
  // ตรวจสอบว่าผู้สั่งลบเป็น Admin จากชีต Admin หรือไม่
  if (!checkIsAdminInSheet(adminEmpId)) {
    return { success: false, message: 'คุณไม่มีสิทธิ์ผู้ดูแลระบบในการลบโพสต์นี้' };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.PRODUCTS);
  if (!sheet) return { success: false, message: 'ไม่พบชีตสินค้า' };

  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const idxId = headers.indexOf('ProductID');
  const idxTitle = headers.indexOf('Title');
  const idxEmpId = headers.indexOf('EmpID');
  const idxStatus = headers.indexOf('Status');

  if (idxId === -1 || idxStatus === -1) {
    return { success: false, message: 'โครงสร้างชีต Products ไม่ถูกต้อง' };
  }

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[idxId]) === String(productId)) {
      const ownerEmpId = String(row[idxEmpId]);
      const prodTitle = String(row[idxTitle]);

      sheet.getRange(i + 1, idxStatus + 1).setValue('DELETED_BY_ADMIN');

      // บันทึก Log การลบโพสต์ที่ไม่เหมาะสมโดย Admin
      writeLog(
        adminEmpId,
        'ADMIN_DELETE_PRODUCT',
        `แอดมินลบโพสต์ [${productId}] "${prodTitle}" ของพนักงาน ${ownerEmpId} (เหตุผล: ${reason || 'เนื้อหาไม่เหมาะสม'})`
      );

      return {
        success: true,
        message: 'แอดมินลบโพสต์ที่ไม่เหมาะสมเรียบร้อยแล้ว'
      };
    }
  }

  return { success: false, message: 'ไม่พบรหัสสินค้านี้' };
}

function updateProductStatusHandler(productId, empId, newStatus) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.PRODUCTS);
  if (!sheet) return { success: false, message: 'ไม่พบชีตสินค้า' };

  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const idxId = headers.indexOf('ProductID');
  const idxEmpId = headers.indexOf('EmpID');
  const idxStatus = headers.indexOf('Status');

  if (idxId === -1 || idxStatus === -1) {
    return { success: false, message: 'โครงสร้างชีต Products ไม่ถูกต้อง' };
  }

  const reqEmpId = String(empId).trim().toUpperCase();
  const isAdmin = checkIsAdminInSheet(reqEmpId);

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[idxId]) === String(productId)) {
      const ownerEmpId = String(row[idxEmpId]).trim().toUpperCase();
      if (ownerEmpId !== reqEmpId && !isAdmin) {
        return { success: false, message: 'คุณไม่มีสิทธิ์แก้ไขสินค้านี้' };
      }
      sheet.getRange(i + 1, idxStatus + 1).setValue(newStatus);
      writeLog(reqEmpId, 'UPDATE_STATUS', `เปลี่ยนสถานะสินค้า [${productId}] เป็น ${newStatus}`);
      return { success: true, message: 'อัปเดตสถานะสินค้าสำเร็จ' };
    }
  }

  return { success: false, message: 'ไม่พบรหัสสินค้านี้' };
}

/**
 * --------------------------------------------------------------------------
 * 5. CHAT & MESSAGING: ระบบแชทสนทนาระหว่างผู้ซื้อและผู้ขาย
 * --------------------------------------------------------------------------
 */
function sendMessageHandler(postData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEETS.MESSAGES);

  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.MESSAGES);
    sheet.appendRow(['MessageID', 'ProductID', 'SenderEmpID', 'ReceiverEmpID', 'Message', 'Timestamp', 'IsRead']);
  }

  const messageId = 'MSG-' + new Date().getTime();
  const timestamp = new Date();

  const senderId = String(postData.senderEmpID).trim().toUpperCase();
  const receiverId = String(postData.receiverEmpID).trim().toUpperCase();
  const productId = String(postData.productId || '');
  const messageText = String(postData.message || '').trim();

  if (!messageText) {
    return { success: false, message: 'ข้อความว่างเปล่า' };
  }

  sheet.appendRow([
    messageId,
    productId,
    senderId,
    receiverId,
    messageText,
    timestamp,
    false
  ]);

  writeLog(senderId, 'SEND_MESSAGE', `ส่งข้อความถึง ${receiverId} (สินค้า: ${productId})`);

  return {
    success: true,
    message: 'ส่งข้อความสำเร็จ',
    data: {
      messageId: messageId,
      productId: productId,
      senderEmpID: senderId,
      receiverEmpID: receiverId,
      message: messageText,
      timestamp: formatDateTime(timestamp)
    }
  };
}

function getMessagesHandler(productId, buyerId, sellerId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.MESSAGES);
  if (!sheet) return { success: true, messages: [] };

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { success: true, messages: [] };

  const headers = data[0].map(h => String(h).trim());
  const idxId = headers.indexOf('MessageID');
  const idxProd = headers.indexOf('ProductID');
  const idxSender = headers.indexOf('SenderEmpID');
  const idxReceiver = headers.indexOf('ReceiverEmpID');
  const idxMsg = headers.indexOf('Message');
  const idxTime = headers.indexOf('Timestamp');

  const pId = String(productId || '');
  const u1 = String(buyerId || '').trim().toUpperCase();
  const u2 = String(sellerId || '').trim().toUpperCase();

  const messages = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowProd = String(row[idxProd]);
    const rowSender = String(row[idxSender]).trim().toUpperCase();
    const rowReceiver = String(row[idxReceiver]).trim().toUpperCase();

    const isSameProduct = !pId || rowProd === pId;
    const isChatParticipant = (rowSender === u1 && rowReceiver === u2) || (rowSender === u2 && rowReceiver === u1);

    if (isSameProduct && isChatParticipant) {
      messages.push({
        messageId: String(row[idxId]),
        productId: rowProd,
        senderEmpID: rowSender,
        receiverEmpID: rowReceiver,
        message: String(row[idxMsg]),
        timestamp: row[idxTime] ? formatDateTime(new Date(row[idxTime])) : ''
      });
    }
  }

  return { success: true, messages: messages };
}

function getMyChatsHandler(empId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.MESSAGES);
  if (!sheet || !empId) return { success: true, conversations: [] };

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { success: true, conversations: [] };

  const headers = data[0].map(h => String(h).trim());
  const idxProd = headers.indexOf('ProductID');
  const idxSender = headers.indexOf('SenderEmpID');
  const idxReceiver = headers.indexOf('ReceiverEmpID');
  const idxMsg = headers.indexOf('Message');
  const idxTime = headers.indexOf('Timestamp');

  const myId = String(empId).trim().toUpperCase();
  const convMap = {};

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowProd = String(row[idxProd]);
    const rowSender = String(row[idxSender]).trim().toUpperCase();
    const rowReceiver = String(row[idxReceiver]).trim().toUpperCase();

    if (rowSender === myId || rowReceiver === myId) {
      const partnerId = rowSender === myId ? rowReceiver : rowSender;
      const key = `${rowProd}_${partnerId}`;

      convMap[key] = {
        productId: rowProd,
        partnerId: partnerId,
        lastMessage: String(row[idxMsg]),
        timestamp: row[idxTime] ? formatDateTime(new Date(row[idxTime])) : ''
      };
    }
  }

  return { success: true, conversations: Object.values(convMap) };
}

/**
 * --------------------------------------------------------------------------
 * 6. ADMIN DASHBOARD: ดึงสถิติภาพรวม ข้อมูลสินค้า และ Logs
 * --------------------------------------------------------------------------
 */
function getAdminDashboardHandler(adminEmpId) {
  // ตรวจสอบสิทธิ์ Admin จากชีต Admin
  if (!checkIsAdminInSheet(adminEmpId)) {
    return { success: false, message: 'คุณไม่มีสิทธิ์เข้าถึงข้อมูลผู้ดูแลระบบ' };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const prodSheet = ss.getSheetByName(SHEETS.PRODUCTS);
  const empSheet = ss.getSheetByName(SHEETS.EMPLOYEE);
  const msgSheet = ss.getSheetByName(SHEETS.MESSAGES);
  const logSheet = ss.getSheetByName(SHEETS.LOGS);
  const adminSheet = ss.getSheetByName(SHEETS.ADMIN);

  // 1. ตรวจสอบพนักงาน
  const totalEmployees = empSheet ? Math.max(0, empSheet.getLastRow() - 1) : 0;
  const totalMessages = msgSheet ? Math.max(0, msgSheet.getLastRow() - 1) : 0;
  const totalAdmins = adminSheet ? Math.max(0, adminSheet.getLastRow() - 1) : 0;

  // 2. ดึงสินค้าทั้งหมด
  const allProducts = [];
  let countActive = 0;
  let countSold = 0;
  let countDeleted = 0;

  if (prodSheet) {
    const pData = prodSheet.getDataRange().getValues();
    if (pData.length > 1) {
      const headers = pData[0].map(h => String(h).trim());
      const idxId = headers.indexOf('ProductID');
      const idxEmp = headers.indexOf('EmpID');
      const idxTitle = headers.indexOf('Title');
      const idxCat = headers.indexOf('Category');
      const idxPrice = headers.indexOf('Price');
      const idxPhone = headers.indexOf('Phone');
      const idxImg = headers.indexOf('ImageURL');
      const idxStatus = headers.indexOf('Status');
      const idxCreated = headers.indexOf('CreatedAt');

      for (let i = 1; i < pData.length; i++) {
        const row = pData[i];
        const status = idxStatus !== -1 ? String(row[idxStatus]).trim().toUpperCase() : 'ACTIVE';
        
        if (status === 'ACTIVE') countActive++;
        else if (status === 'SOLD') countSold++;
        else countDeleted++;

        allProducts.push({
          productId: idxId !== -1 ? String(row[idxId]) : '',
          empId: idxEmp !== -1 ? String(row[idxEmp]) : '',
          title: idxTitle !== -1 ? String(row[idxTitle]) : '',
          category: idxCat !== -1 ? String(row[idxCat]) : 'ทั่วไป',
          price: idxPrice !== -1 ? Number(row[idxPrice]) || 0 : 0,
          phone: idxPhone !== -1 ? String(row[idxPhone]) : '',
          imageUrl: idxImg !== -1 ? String(row[idxImg]) : '',
          status: status,
          createdAt: idxCreated !== -1 && row[idxCreated] ? formatDateTime(new Date(row[idxCreated])) : ''
        });
      }
    }
  }

  allProducts.reverse();

  // 3. ดึงประวัติ Logs ล่าสุด (100 รายการล่าสุด)
  const recentLogs = [];
  if (logSheet) {
    const lData = logSheet.getDataRange().getValues();
    if (lData.length > 1) {
      const lHeaders = lData[0].map(h => String(h).trim());
      const lIdxId = lHeaders.indexOf('LogID');
      const lIdxTime = lHeaders.indexOf('Timestamp');
      const lIdxEmp = lHeaders.indexOf('EmpID');
      const lIdxAct = lHeaders.indexOf('Action');
      const lIdxDet = lHeaders.indexOf('Details');

      for (let i = 1; i < lData.length; i++) {
        const row = lData[i];
        recentLogs.push({
          logId: lIdxId !== -1 ? String(row[lIdxId]) : '',
          timestamp: lIdxTime !== -1 && row[lIdxTime] ? formatDateTime(new Date(row[lIdxTime])) : '',
          empId: lIdxEmp !== -1 ? String(row[lIdxEmp]) : '',
          action: lIdxAct !== -1 ? String(row[lIdxAct]) : '',
          details: lIdxDet !== -1 ? String(row[lIdxDet]) : ''
        });
      }
    }
  }

  recentLogs.reverse();

  return {
    success: true,
    stats: {
      totalEmployees: totalEmployees,
      totalAdmins: totalAdmins,
      totalProducts: allProducts.length,
      activeProducts: countActive,
      soldProducts: countSold,
      deletedProducts: countDeleted,
      totalMessages: totalMessages,
      totalLogs: recentLogs.length
    },
    products: allProducts,
    logs: recentLogs.slice(0, 100)
  };
}

/**
 * --------------------------------------------------------------------------
 * 7. HELPER: บันทึกรูป Base64 ลงใน Google Drive โฟลเดอร์เฉพาะ
 * --------------------------------------------------------------------------
 */
function saveImageToDrive(base64Data, filename, prefix) {
  let folder;

  if (UPLOAD_FOLDER_ID && UPLOAD_FOLDER_ID.trim() !== '') {
    try {
      folder = DriveApp.getFolderById(UPLOAD_FOLDER_ID.trim());
    } catch (e) {
      Logger.log('Folder ID not found, creating/getting by name instead: ' + e.toString());
    }
  }

  if (!folder) {
    const folders = DriveApp.getFoldersByName(UPLOAD_FOLDER_NAME);
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder(UPLOAD_FOLDER_NAME);
      folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    }
  }

  const contentTypeMatch = base64Data.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,/);
  let contentType = 'image/jpeg';
  let cleanBase64 = base64Data;

  if (contentTypeMatch) {
    contentType = contentTypeMatch[1];
    cleanBase64 = base64Data.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
  }

  const decoded = Utilities.base64Decode(cleanBase64);
  const safeFilename = `${prefix}_${new Date().getTime()}_${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const blob = Utilities.newBlob(decoded, contentType, safeFilename);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  const fileId = file.getId();
  return 'https://lh3.googleusercontent.com/d/' + fileId;
}

/**
 * --------------------------------------------------------------------------
 * UTILITY: จัดรูปแบบวันที่ให้อ่านง่าย
 * --------------------------------------------------------------------------
 */
function formatDateTime(d) {
  try {
    return Utilities.formatDate(d, 'Asia/Bangkok', 'dd/MM/yyyy HH:mm');
  } catch(e) {
    return d.toLocaleString('th-TH');
  }
}
