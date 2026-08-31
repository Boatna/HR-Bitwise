# 🛒 Employee Marketplace - คู่มือการติดตั้งและใช้งาน

เว็บแอปพลิเคชันตลาดซื้อขายออนไลน์สำหรับพนักงานภายในองค์กร
- **Frontend**: HTML5, Tailwind CSS, Vanilla JavaScript (โฮสต์บน **GitHub Pages** ฟรี 100%)
- **Backend & Database**: **Google Sheets** + **Google Apps Script** (จัดการ Database, อัปโหลดรูปภาพลง Google Drive และระบบแชท)

---

## 📁 โครงสร้างโปรเจกต์ (Project Files)

```
employee-marketplace/
├── index.html        # หน้าเว็บหลัก (Responsive Design รองรับมือถือและคอมพิวเตอร์)
├── app.js            # ระบบจัดการหน้าบ้าน (Login, แสดงสินค้า, กรองหมวดหมู่, แชท, จัดการสินค้า)
├── style.css         # สไตล์และแอนิเมชัน
├── config.js         # ไฟล์ตั้งค่า URL ของ Google Apps Script
├── Code.gs           # โค้ด Backend API สำหรับนำไปวางใน Google Apps Script
└── README.md         # คู่มือการติดตั้งนี้
```

---

## 🚀 ขั้นตอนที่ 1: ตั้งค่า Google Sheets Database

1. ไปที่ [Google Sheets](https://sheets.new) เพื่อสร้างสเปรดชีตใหม่ (ตั้งชื่อเช่น `Employee_Marketplace_DB`)
2. สร้าง Sheet ทั้งหมด **3 แถบ (Tabs)** และตั้งชื่อให้ตรงตามนี้:

### แถบที่ 1: `Employee` (ข้อมูลพนักงานสำหรับเข้าสู่ระบบ)
ตั้งชื่อแถวที่ 1 (Headers) ดังนี้:
| A | B | C | D | E | F | G | H | I |
|---|---|---|---|---|---|---|---|---|
| **EmpID** | **Name** | **Department** | **Position** | **Plant** | **Prefix** | **FirstName** | **LastName** | **PIN** |

*ตัวอย่างข้อมูลทดสอบ:*
- `EMP001` | สมชาย ใจดี | IT | Developer | Plant 1 | นาย | สมชาย | ใจดี | `1234`
- `EMP002` | สมศรี มีสุข | HR | Specialist | Plant 2 | นางสาว | สมศรี | มีสุข | `5678`

---

### แถบที่ 2: `Products` (ข้อมูลสินค้าที่ลงขาย)
ตั้งชื่อแถวที่ 1 (Headers) ดังนี้:
| A | B | C | D | E | F | G | H | I | J |
|---|---|---|---|---|---|---|---|---|---|
| **ProductID** | **EmpID** | **Title** | **Category** | **Price** | **Description** | **Phone** | **ImageURL** | **Status** | **CreatedAt** |

---

### แถบที่ 3: `Messages` (ระบบแชทสอบถามสินค้า)
ตั้งชื่อแถวที่ 1 (Headers) ดังนี้:
| A | B | C | D | E | F | G |
|---|---|---|---|---|---|---|
| **MessageID** | **ProductID** | **SenderEmpID** | **ReceiverEmpID** | **Message** | **Timestamp** | **IsRead** |

---

### แถบที่ 4: `Logs` (บันทึกประวัติการใช้งานและกิจกรรมของระบบ)
ตั้งชื่อแถวที่ 1 (Headers) ดังนี้:
| A | B | C | D | E |
|---|---|---|---|---|
| **LogID** | **Timestamp** | **EmpID** | **Action** | **Details** |

*(ระบบจะสร้างชีต `Logs` ให้อัตโนมัติหากยังไม่มี โดยจะบันทึกการ Login, การลงขาย, การส่งข้อความ, และการลบโพสต์ของแอดมิน)*

---

### แถบที่ 5: `Admin` (กำหนดสิทธิ์ผู้ดูแลระบบ)
ตั้งชื่อแถวที่ 1 (Headers) ดังนี้:
| A | B | C | D | E |
|---|---|---|---|---|
| **EmpID** | **Name** | **Role** | **CreatedAt** | **Note** |

*ตัวอย่างข้อมูล:*
- `EMP001` | สมชาย ใจดี | SuperAdmin | 2026-08-31 | ผู้ดูแลระบบหลัก
- `EMP005` | นพดล แอดมิน | Admin | 2026-08-31 | ฝ่าย IT ตรวจสอบโพสต์

> 💡 **สะดวกมาก**: คุณสามารถเพิ่มหรือลบสิทธิ์แอดมินให้พนักงานคนใดก็ได้ เพียงแค่พิมพ์รหัสพนักงาน (`EmpID`) ลงในชีต `Admin` นี้ โดยไม่ต้องแก้ไขโค้ดใดๆ เลยครับ!

---

## ⚙️ ขั้นตอนที่ 2: ติดตั้ง Google Apps Script Backend

1. ในหน้า Google Sheets ให้ไปที่เมนูด้านบน: **ส่วนขยาย (Extensions)** > **Apps Script**
2. ลบโค้ดเดิมทั้งหมดในไฟล์ `Code.gs` แล้วนำโค้ดจากไฟล์ **`Code.gs`** ในโปรเจกต์นี้ไปวางแทนที่
3. กดบันทึก (Ctrl + S หรือรูปแผ่นดิสก์)
4. ทำการ **Deploy Web App**:
   - กดปุ่มสีน้ำเงิน **Deploy (ทำให้ใช้งานได้)** > **New deployment (การทำให้ใช้งานได้ใหม่)**
   - กดที่ไอคอนฟันเฟือง ⚙️ ด้านซ้าย เลือกประเภทเป็น **Web app (เว็บแอป)**
   - ตั้งค่าดังนี้:
     - **Description**: `Employee Marketplace API v1`
     - **Execute as (ดำเนินการในฐานะ)**: `Me (ฉัน / อีเมลของคุณ)`
     - **Who has access (ผู้มีสิทธิ์เข้าถึง)**: `Anyone (ทุกคน)` *(สำคัญมาก ต้องเลือก Anyone เพื่อให้หน้าเว็บเรียก API ได้)*
   - กดปุ่ม **Deploy**
   - ในครั้งแรก Google จะขอสิทธิ์เข้าถึง (Authorize Access) ให้เลือกบัญชีของคุณ > กด **Advanced** > กด **Go to ... (unsafe)** > กด **Allow**
5. คัดลอก **Web App URL** (ที่ลงท้ายด้วย `/exec`) เก็บไว้

---

## 🔗 ขั้นตอนที่ 3: นำ URL ไปเชื่อมต่อในหน้าเว็บ

1. เปิดไฟล์ `config.js` ใน VS Code
2. นำ Web App URL ที่ได้จากขั้นตอนที่ 2 มาใส่ใน `API_URL`:
   ```javascript
   const CONFIG = {
     API_URL: "https://script.google.com/macros/s/AKfycbx.../exec",
     ...
   };
   ```
3. บันทึกไฟล์ `config.js`

---

## 🌐 ขั้นตอนที่ 4: นำขึ้นโฮสติ้ง GitHub Pages ฟรี

1. สร้าง Repository ใหม่บน [GitHub](https://github.com/new) (เช่นชื่อ `employee-marketplace`)
2. เปิด Terminal ในโฟลเดอร์โปรเจกต์นี้ใน VS Code แล้วรันคำสั่ง:
   ```bash
   git init
   git add .
   git commit -m "Initial commit for Employee Marketplace"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/employee-marketplace.git
   git push -u origin main
   ```
3. ไปที่หน้า GitHub Repository ของคุณ:
   - ไปที่แท็บ **Settings** > เมนูด้านซ้ายเลือก **Pages**
   - ในหัวข้อ **Build and deployment**:
     - Source: เลือก **Deploy from a branch**
     - Branch: เลือก **main** และโฟลเดอร์ **/(root)**
   - กด **Save**
4. รอประมาณ 1-2 นาที คุณจะได้ลิงก์หน้าเว็บ เช่น:  
   `https://YOUR_USERNAME.github.io/employee-marketplace/`

---

## 📁 การจัดเก็บรูปภาพสินค้า (Google Drive Folder)

- เมื่อพนักงานลงประกาศขายสินค้าและแนบรูปภาพ ระบบจะทำการย่อขนาดภาพและส่งไปเก็บใน Google Drive ของคุณโดยอัตโนมัติ
- โดยค่าเริ่มต้น ระบบจะสร้างโฟลเดอร์ชื่อ **`Employee_Marketplace_Images`** ใน Google Drive ของคุณ
- หากคุณต้องการระบุโฟลเดอร์ที่มีอยู่แล้ว ให้เปิดโฟลเดอร์นั้นใน Google Drive > คัดลอก ID จาก URL (เช่น `https://drive.google.com/drive/folders/1a2B3c4D5e...`) แล้วนำไปวางในตัวแปร `UPLOAD_FOLDER_ID` ในไฟล์ `Code.gs`:
  ```javascript
  const UPLOAD_FOLDER_ID = '1a2B3c4D5e...';
  ```

---

## 🛡️ แผงควบคุมผู้ดูแลระบบ (Admin Dashboard & Moderation)

- **การเข้าใช้งาน Admin Dashboard**:
  - พนักงานที่มี EmpID อยู่ใน `CONFIG.ADMIN_EMP_IDS` (เช่น `EMP001`, `ADMIN`, `IT001`) หรือมีตำแหน่ง/แผนก Admin จะมีเมนู **"แผงควบคุมผู้ดูแลระบบ (Admin)"** ปรากฏขึ้นในเมนูโปรไฟล์
- **สถิติภาพรวม**:
  - ดูจำนวนสินค้าที่กำลังขาย, สินค้าที่ขายแล้ว, โพสต์ที่ถูกลบ, และจำนวนพนักงานทั้งหมดในระบบ
- **การจัดการลบโพสต์แปลกๆ/ไม่เหมาะสม (Post Moderation)**:
  - แอดมินสามารถค้นหาและกดปุ่ม **"ลบโพสต์นี้"** เพื่อนำโพสต์ที่ไม่เกี่ยวข้องหรือผิดระเบียบออกจากหน้าเว็บได้ทันที
  - ระบบจะให้เลือกเหตุผลในการลบ (เช่น เนื้อหาไม่เกี่ยวข้อง, สินค้าผิดระเบียบ, สแปม) และบันทึกประวัติการลบลงชีต `Logs` โดยอัตโนมัติ
- **ตรวจสอบประวัติกิจกรรม (System Logs)**:
  - ตรวจสอบประวัติการเข้าสู่ระบบ, การลงขายสินค้า, การส่งข้อความ และการจัดการของแอดมินแบบ Real-time & Memory Optimization)

---

## 🧹 การล้างข้อมูลแชทเมื่อออกจากระบบ (Logout & Memory Optimization)

- เมื่อพนักงานกด **"ออกจากระบบ"** ระบบจะทำการ:
  1. ล้างประวัติแชทที่แสดงในหน้าต่างสนทนา (DOM) ทันที
  2. ล้างข้อมูลการเข้าสู่ระบบ, ข้อมูลแคช และ Session ในเบราว์เซอร์ (`localStorage` และ `sessionStorage`)
  3. ปิดการเชื่อมต่อ Polling ตรวจสอบข้อความใหม่ทันที เพื่อไม่ให้กินทรัพยากรเครื่องและป้องกันไม่ให้ผู้อื่นที่มาใช้เครื่องต่อมองเห็นข้อความสนทนา

- สามารถเปิดไฟล์ `index.html` ด้วยเบราว์เซอร์ได้ทันที หรือใช้ส่วนเสริม **Live Server** ใน VS Code เพื่อเปิดทดสอบ
- ระบบมี **Demo Mode** ในตัว หากยังไม่ได้ระบุ `API_URL` ใน `config.js` ระบบจะจำลองข้อมูลสินค้าและแชทให้ทดสอบได้ทันที

---

## ✨ ฟีเจอร์เด่น
- 🔒 **ปลอดภัย**: ตรวจสอบสิทธิ์ด้วยรหัสพนักงาน + PIN จากชีต `Employee` โดยไม่เปิดเผย PIN ของผู้อื่นกลับมายังหน้าบ้าน
- 📷 **ประหยัดเน็ต & พื้นที่**: มีระบบย่อขนาดและบีบอัดภาพ (Image Compression) ก่อนส่งเข้า Google Drive อัตโนมัติ
- 💬 **แชทในตัว (In-App Chat)**: ผู้ซื้อและผู้ขายสามารถพิมพ์คุยต่อรองราคาสินค้าได้โดยตรง
- 📱 **Mobile Friendly**: ออกแบบ Responsive เต็มรูปแบบ สามารถเปิดใช้งานบนมือถือของพนักงานได้สะดวก
