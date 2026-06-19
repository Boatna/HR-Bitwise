// sw.js — Service Worker สำหรับ HR Dashboard (Bitwise Group)
// จำเป็นสำหรับให้ Chrome/Edge แสดงปุ่ม "ติดตั้งแอป" (PWA installability requirement)
// ทำหน้าที่: cache ไฟล์หน้าเว็บไว้ใช้งานต่อได้แม้เน็ตหลุดชั่วคราว (ไม่ได้ cache ข้อมูลจาก Apps Script API)

const CACHE_NAME = 'hr-dashboard-v1';
const CORE_ASSETS = [
  './index.html',
  './dashboard.html',
  './employees.html',
  './form.html',
  './leave.html',
  './config.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS).catch(() => {
      // ถ้าไฟล์ใดไฟล์หนึ่งใน list โหลดไม่ได้ (เช่น path ไม่ตรง) ไม่ให้ install ทั้งหมด fail ไปด้วย
    }))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // ไม่ cache request ไปยัง Google Apps Script API เด็ดขาด — ข้อมูล HR ต้องสดใหม่เสมอ ไม่ใช่ข้อมูลเก่าจาก cache
  if (event.request.url.includes('script.google.com')) return;

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
