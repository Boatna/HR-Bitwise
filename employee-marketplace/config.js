const CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycbyK_2XPau3q-l6iv8lWLkz7dGp6CmojjEbLMLYqaGHG2wjRApWBk7GSycH8NfxfqF8s/exec",

  // หมวดหมู่สินค้าในระบบ
  CATEGORIES: [
    { id: "all", name: "ทั้งหมด", icon: "squares-four" },
    { id: "electronics", name: "อิเล็กทรอนิกส์ & มือถือ", icon: "device-mobile" },
    { id: "fashion", name: "เสื้อผ้า & แฟชั่น", icon: "t-shirt" },
    { id: "home", name: "ของใช้ในบ้าน & เฟอร์นิเจอร์", icon: "house-line" },
    { id: "food", name: "อาหาร & ขนม", icon: "cookie" },
    { id: "vehicles", name: "ยานยนต์ & อะไหล่", icon: "car" },
    { id: "beauty", name: "สุขภาพ & ความงาม", icon: "heartbeat" },
    { id: "books", name: "หนังสือ & อุปกรณ์สำนักงาน", icon: "book-open" },
    { id: "other", name: "เบ็ดเตล็ด", icon: "dots-three-circle" }
  ],

  APP_NAME: "Employee Marketplace",
  APP_SUBTITLE: "ตลาดนัดออนไลน์สำหรับเพื่อนพนักงาน",

  CHAT_POLL_INTERVAL: 4000,

  // รายชื่อรหัสพนักงานที่มีสิทธิ์เป็นแอดมิน (สามารถดู Dashboard และลบโพสต์แปลกๆ/ไม่เหมาะสมได้)
  ADMIN_EMP_IDS: ['EMP001', 'ADMIN', 'ADMIN001', 'IT001']
};
