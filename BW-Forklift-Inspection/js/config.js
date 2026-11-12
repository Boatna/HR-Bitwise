/* js/config.js — ค่าคงที่ตั้งค่าระบบ (API_URL, timezone, asset dir) */
const API_URL = 'https://script.google.com/macros/s/AKfycbzqerRUYtl58ezSIF_jK9wkQus1EeNso5dM_bAVaofJUJyBOGzlQWnTcx4MQM0u4-vH/exec';
const API_TIMEOUT_MS = 30000;
const TIMEZONE = 'Asia/Bangkok';
const ASSET_DIR = 'asset/';
const SIM_ENABLED = new URLSearchParams(location.search).has('sim');
