# โครงสร้างระบบความปลอดภัยและทะเบียนกฎหมาย (Bitwise Safety System)

ระบบบริหารจัดการความปลอดภัย อาชีวอนามัย สภาพแวดล้อมในการทำงาน และทะเบียนกฎหมายความปลอดภัย
เชื่อมต่อฐานข้อมูล Google Sheets และจัดเก็บไฟล์เอกสาร PDF บน Google Drive แบบอัตโนมัติ

---

## 📁 โครงสร้างไฟล์ในโครงการ (File Organization)

```text
Safety-Bitwise/
├── safety-DB.html            # หน้า Executive Safety Dashboard & ฟอร์มบันทึก/แก้ไขข้อมูลความปลอดภัย
├── registration-laws.html     # หน้าทะเบียนกฎหมายความปลอดภัย (Registration Laws and Safety)
├── Code.gs                   # Backend Google Apps Script (ประมวลผลบน Google Sheets/Drive)
└── README.md                 # คู่มือโครงสร้างระบบ วิธี Deploy และการเชื่อมต่อ
```

---

## 🛠️ ขั้นตอนการนำโค้ดไปใช้งาน (Deployment Guide)

### 1. นำโค้ด Google Apps Script (`Code.gs`) ไปทับของเดิม
1. เปิด Google Sheets ฐานข้อมูลความปลอดภัย
2. ไปที่เมนู **ส่วนขยาย (Extensions)** > **Apps Script**
3. คัดลอกโค้ดทั้งหมดจากไฟล์ [`Code.gs`](file:///c:/Users/patipol.p/AppData/Local/Programs/Python/Python310/Scripts/HR-Bitwise/Safety-Bitwise/Code.gs) ไปวางทับโค้ดเดิมในโปรเจกต์ Apps Script
4. กดบันทึก (Ctrl + S)
5. กดปุ่ม **การทำให้ใช้งานได้ (Deploy)** > **จัดการการทำให้ใช้งานได้ (Manage deployments)**
6. กดรูป **ดินสอ (Edit)** ที่ Deployment เดิม เลือกเวอร์ชันเป็น **เวอร์ชันใหม่ (New version)** แล้วกด **ทำให้ใช้งานได้ (Deploy)**

### 2. นำไฟล์ HTML ไปเปิดใช้งานใน VS Code
- [`safety-DB.html`](file:///c:/Users/patipol.p/AppData/Local/Programs/Python/Python310/Scripts/HR-Bitwise/Safety-Bitwise/safety-DB.html) สามารถเปิดผ่าน Live Server หรือ Double Click ใช้งานได้ทันที
- [`registration-laws.html`](file:///c:/Users/patipol.p/AppData/Local/Programs/Python/Python310/Scripts/HR-Bitwise/Safety-Bitwise/registration-laws.html) ใช้งานร่วมกัน สามารถคลิกลิงก์สลับหน้าไป-มาได้สะดวกรวดเร็ว
