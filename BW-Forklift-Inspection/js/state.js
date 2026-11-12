/* js/state.js — ตัวแปรสถานะส่วนกลาง (session, ฟอร์ม, ผลตรวจ, PIN) */

let TOKEN = sessionStorage.getItem('fl_token') || '';
let USER_NAME = sessionStorage.getItem('fl_user_name') || '';
let USER_ID = sessionStorage.getItem('fl_user_id') || '';
let USER_DEPT = sessionStorage.getItem('fl_user_dept') || '';

let FORM = null;
let formLoading = false;
const CUR = { forklift: null, elec: false, kind: 'engine', items: [], clean: [] };

let res = {};
let ngd = {};
let cres = {};
let submitId = '';
let autoNextTimer = null;

let pin = '';
let PEOPLE = [];
let loginBusy = false;
let namesLoading = false;

let curFocusIdx = 0;
