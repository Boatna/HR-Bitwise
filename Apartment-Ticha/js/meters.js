/* meters.js — มิเตอร์น้ำ-ไฟ / บิล / ใบเสร็จ (v2.4) */

const TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const TH_DIGIT = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
const TH_POS = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน'];

function thReadInt(s) {
  if (s.length > 6) {
    const hi = s.slice(0, -6), lo = s.slice(-6);
    return thReadInt(hi) + 'ล้าน' + (Number(lo) ? thReadInt(lo) : '');
  }
  let out = '';
  const L = s.length;
  for (let i = 0; i < L; i++) {
    const d = Number(s[i]), p = L - i - 1;
    if (d === 0) continue;
    if (p === 0 && d === 1 && L > 1) out += 'เอ็ด';
    else if (p === 1 && d === 2) out += 'ยี่สิบ';
    else if (p === 1 && d === 1) out += 'สิบ';
    else out += TH_DIGIT[d] + TH_POS[p];
  }
  return out;
}

/** จำนวนเงินเป็นตัวอักษรไทย เช่น 1,234.50 → หนึ่งพันสองร้อยสามสิบสี่บาทห้าสิบสตางค์ */
function bahtText(amount) {
  const n = Math.round((Number(amount) || 0) * 100) / 100;
  const baht = Math.floor(n);
  const satang = Math.round((n - baht) * 100);
  if (baht === 0 && satang === 0) return 'ศูนย์บาทถ้วน';
  let out = baht > 0 ? thReadInt(String(baht)) + 'บาท' : '';
  out += satang > 0 ? thReadInt(String(satang)) + 'สตางค์' : 'ถ้วน';
  return out;
}

function thDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
  if (!m) return '-';
  return `${Number(m[3])} ${TH_MONTHS[Number(m[2]) - 1]} ${Number(m[1]) + 543}`;
}
function thPeriod(p) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(p || ''));
  return m ? `${TH_MONTHS[Number(m[2]) - 1]} ${Number(m[1]) + 543}` : '-';
}
function money(v) {
  return (Number(v) || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function num(v) { const x = Number(v); return isFinite(x) ? x : 0; }

const RATE_KEYS = ['ELEC_RATE', 'WATER_RATE', 'ELEC_MIN_CHARGE', 'WATER_MIN_CHARGE', 'BILL_INCLUDE_RENT', 'VAT_RATE',
  'BILL_DUE_DAY', 'METER_MAX_ELEC', 'METER_MAX_WATER', 'COMPANY_ADDRESS', 'COMPANY_TAXID', 'PAY_INFO'];

const Meters = {
  period: '',
  rows: [],
  bills: [],
  settings: {},
  extras: {},      // roomId -> { otherFee, otherFeeNote, discount }
  drafts: {},      // roomId -> { ep, ec, wp, wc } เลขที่พิมพ์ค้างไว้ (กันหายตอนค้นหา/กรองแล้ววาดตารางใหม่)
  _seq: 0,

  open() {
    if (this._inited) { this.loadSheet(); if (this.currentTab === 'bills') this.loadBills(); return; }
    this._inited = true;
    this.init();
  },

  init() {
    const now = new Date();
    this.period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const picker = document.getElementById('period-picker');
    picker.value = this.period;
    picker.addEventListener('change', () => {
      if (!picker.value) return;
      this.period = picker.value;
      this.extras = {};
      this.drafts = {};
      this.loadSheet();
      if (this.currentTab === 'bills') this.loadBills();
    });
    document.querySelectorAll('#meterTabs [data-tab]').forEach(b =>
      b.addEventListener('click', () => this.switchTab(b.dataset.tab)));
    document.getElementById('search-meter').addEventListener('input', () => this.renderSheet());
    document.getElementById('filter-meter-state').addEventListener('change', () => this.renderSheet());
    document.getElementById('search-bill').addEventListener('input', () => this.renderBills());
    document.getElementById('filter-bill-status').addEventListener('change', () => this.renderBills());
    this.currentTab = 'read';
    this.loadSheet();
  },

  switchTab(tab) {
    this.currentTab = tab;
    document.querySelectorAll('#meterTabs [data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    ['read', 'bills', 'rates'].forEach(t => document.getElementById('mt-' + t).classList.toggle('d-none', t !== tab));
    if (tab === 'bills') this.loadBills();
    if (tab === 'rates') this.fillRates();
  },

  // ======================= จดมิเตอร์ =======================
  async loadSheet() {
    const seq = ++this._seq;
    const body = document.getElementById('meter-table-body');
    body.innerHTML = '<tr><td colspan="11" class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary me-2"></div>กำลังโหลดข้อมูลมิเตอร์...</td></tr>';
    try {
      const data = await API.getMeterSheet(this.period);
      if (seq !== this._seq) return;
      this.settings = data.settings || {};
      this.showRateBanner();
      this.rows = (data.rows || []).slice().sort((a, b) =>
        String(a.buildingName).localeCompare(String(b.buildingName), 'th') ||
        String(a.roomNumber).localeCompare(String(b.roomNumber), 'th', { numeric: true }));
      this.renderSheet();
    } catch (e) {
      if (seq !== this._seq) return;
      body.innerHTML = `<tr><td colspan="11" class="text-danger text-center py-4">${App.escHtml(e.message)}</td></tr>`;
    }
  },

  showRateBanner() {
    let el = document.getElementById('rate-banner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'rate-banner';
      el.className = 'alert alert-danger d-flex align-items-center justify-content-between gap-2';
      document.getElementById('mt-read').prepend(el);
    }
    const ok = num(this.settings.ELEC_RATE) > 0 && num(this.settings.WATER_RATE) > 0;
    el.classList.toggle('d-none', ok);
    el.innerHTML = '<span><i class="bi bi-exclamation-triangle-fill me-2"></i>ยังไม่ได้ตั้งอัตราค่าไฟ/ค่าน้ำ จึงออกบิลไม่ได้</span><button class="btn btn-sm btn-danger" onclick="Meters.switchTab(\'rates\')">ตั้งค่าอัตรา</button>';
  },

  renderSheet() {
    const body = document.getElementById('meter-table-body');
    const kw = (document.getElementById('search-meter').value || '').trim().toLowerCase();
    const state = document.getElementById('filter-meter-state').value;

    const done = this.rows.filter(r => r.reading).length;
    document.getElementById('meter-progress').textContent = `จดแล้ว ${done} / ${this.rows.length} ห้อง`;

    const list = this.rows.map((r, i) => ({ r, i })).filter(({ r }) => {
      if (state === 'pending' && r.reading) return false;
      if (state === 'done' && !r.reading) return false;
      if (state === 'occupied' && !r.occupiedCount) return false;
      if (!kw) return true;
      return App.lc(r.roomNumber).includes(kw) || App.lc(r.buildingName).includes(kw) ||
        r.tenants.some(t => App.lc(t).includes(kw));
    });

    if (list.length === 0) {
      body.innerHTML = '<tr><td colspan="11" class="text-center text-muted py-4">ไม่พบห้องที่ตรงกับเงื่อนไข</td></tr>';
      return;
    }

    body.innerHTML = list.map(({ r, i }) => {
      const rd = r.reading;
      const paid = r.bill && r.bill.Status === 'Paid';
      const dr = paid ? null : this.drafts[r.roomId];
      const ep = dr ? dr.ep : (rd ? rd.ElecPrev : r.prevElec), wp = dr ? dr.wp : (rd ? rd.WaterPrev : r.prevWater);
      const ec = dr ? dr.ec : (rd ? rd.ElecCurr : ''), wc = dr ? dr.wc : (rd ? rd.WaterCurr : '');
      const dis = paid ? 'disabled' : '';
      const billBadge = !r.bill ? '<span class="badge bg-light text-muted border">ยังไม่ออกบิล</span>'
        : (paid ? '<span class="badge bg-success">ชำระแล้ว</span>' : '<span class="badge bg-warning text-dark">รอชำระ</span>') +
          `<div class="small text-muted">${App.escHtml(r.bill.BillNo)}</div>`;
      return `
        <tr>
          <td><strong class="text-dark">ห้อง ${App.escHtml(r.roomNumber)}</strong><div class="small text-muted">${App.escHtml(r.buildingName)}</div></td>
          <td class="small">${r.tenants.length ? App.escHtml(r.tenants.join(', ')) : '<span class="text-muted">ห้องว่าง</span>'}</td>
          <td class="group-elec"><input type="number" min="0" step="1" class="form-control form-control-sm meter-input" id="ep-${i}" value="${ep}" ${dis} oninput="Meters.recalc(${i})"></td>
          <td class="group-elec"><input type="number" min="0" step="1" class="form-control form-control-sm meter-input" id="ec-${i}" value="${ec}" ${dis} oninput="Meters.recalc(${i})"></td>
          <td class="group-elec unit-cell" id="eu-${i}">-</td>
          <td class="group-water"><input type="number" min="0" step="1" class="form-control form-control-sm meter-input" id="wp-${i}" value="${wp}" ${dis} oninput="Meters.recalc(${i})"></td>
          <td class="group-water"><input type="number" min="0" step="1" class="form-control form-control-sm meter-input" id="wc-${i}" value="${wc}" ${dis} oninput="Meters.recalc(${i})"></td>
          <td class="group-water unit-cell" id="wu-${i}">-</td>
          <td class="text-end fw-semibold" id="est-${i}">${r.bill ? money(r.bill.TotalAmount) : '-'}</td>
          <td>${billBadge}</td>
          <td class="text-nowrap">
            <button class="btn btn-sm btn-primary me-1" ${dis} onclick="Meters.save(${i})" title="บันทึกและออกบิล"><i class="bi bi-save me-1"></i>บันทึก</button>
            <button class="btn btn-sm btn-outline-secondary" ${dis} onclick="Meters.editExtras(${i})" title="ค่าอื่น ๆ / ส่วนลด"><i class="bi bi-plus-slash-minus"></i></button>
          </td>
        </tr>`;
    }).join('');
    list.forEach(({ i }) => this.recalc(i, true));
  },

  _val(id) { const el = document.getElementById(id); return el ? el.value : ''; },

  _calcUnits(prev, curr, max) {
    if (curr === '' || prev === '') return null;
    const p = num(prev), c = num(curr);
    return c >= p ? { u: Math.round((c - p) * 100) / 100, wrap: false } : { u: Math.round((max + 1 - p + c) * 100) / 100, wrap: true };
  },

  _extrasOf(r) {
    return this.extras[r.roomId] || (r.bill ? { otherFee: r.bill.OtherFee, otherFeeNote: r.bill.OtherFeeNote, discount: r.bill.Discount } : {});
  },

  recalc(i, keepBill) {
    const st = this.settings, r = this.rows[i];
    if (!keepBill) {
      this.drafts[r.roomId] = { ep: this._val('ep-' + i), ec: this._val('ec-' + i), wp: this._val('wp-' + i), wc: this._val('wc-' + i) };
    }
    const e = this._calcUnits(this._val('ep-' + i), this._val('ec-' + i), num(st.METER_MAX_ELEC));
    const w = this._calcUnits(this._val('wp-' + i), this._val('wc-' + i), num(st.METER_MAX_WATER));
    const fmt = (x) => x ? `<span class="${x.wrap ? 'unit-warn' : ''}" title="${x.wrap ? 'เลขลดลง: ระบบจะถามยืนยันมิเตอร์ครบรอบตอนบันทึก' : ''}">${x.u}${x.wrap ? ' ↺' : ''}</span>` : '-';
    document.getElementById('eu-' + i).innerHTML = fmt(e);
    document.getElementById('wu-' + i).innerHTML = fmt(w);
    if (e && w) {
      const x = this._extrasOf(r);
      const eAmt = Math.max(e.u * num(st.ELEC_RATE), num(st.ELEC_MIN_CHARGE));
      const wAmt = Math.max(w.u * num(st.WATER_RATE), num(st.WATER_MIN_CHARGE));
      const taxable = eAmt + wAmt + num(x.otherFee) - num(x.discount);
      const rent = String(st.BILL_INCLUDE_RENT) === 'Yes' ? num(r.monthlyRate) : 0;
      document.getElementById('est-' + i).textContent = money(taxable + rent + taxable * num(st.VAT_RATE) / 100);
    } else if (!keepBill) {
      document.getElementById('est-' + i).textContent = '-';
    }
  },

  async editExtras(i) {
    const r = this.rows[i];
    const cur = this._extrasOf(r);
    const res = await Swal.fire({
      title: `ห้อง ${r.roomNumber}: ค่าอื่น ๆ / ส่วนลด`,
      html: `
        <div class="text-start">
          <label class="form-label fw-semibold mb-1">ค่าอื่น ๆ (บาท)</label>
          <input id="x-fee" type="number" min="0" step="0.01" class="form-control mb-2" value="${num(cur.otherFee)}">
          <label class="form-label fw-semibold mb-1">รายละเอียดค่าอื่น ๆ</label>
          <input id="x-note" type="text" class="form-control mb-2" value="${App.escHtml(cur.otherFeeNote || '')}" placeholder="เช่น ค่าปรับกุญแจหาย">
          <label class="form-label fw-semibold mb-1">ส่วนลด (บาท)</label>
          <input id="x-disc" type="number" min="0" step="0.01" class="form-control" value="${num(cur.discount)}">
        </div>`,
      showCancelButton: true, confirmButtonText: 'ตกลง', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#1e3a8a',
      preConfirm: () => ({
        otherFee: num(document.getElementById('x-fee').value),
        otherFeeNote: document.getElementById('x-note').value.trim(),
        discount: num(document.getElementById('x-disc').value)
      })
    });
    if (res.isConfirmed) {
      this.extras[r.roomId] = res.value;
      this.recalc(i);
      App.showToast('บันทึกค่าอื่น ๆ แล้ว กด "บันทึก" ที่แถวห้องเพื่อออกบิล', 'info');
    }
  },

  async save(i) {
    const r = this.rows[i];
    const ep = this._val('ep-' + i), ec = this._val('ec-' + i), wp = this._val('wp-' + i), wc = this._val('wc-' + i);
    if (ep === '' || wp === '') { App.showError('กรอกเลขมิเตอร์ไม่ครบ', 'ห้องนี้ยังไม่มีเลขครั้งก่อน กรุณากรอกเลขมิเตอร์ครั้งก่อน (เลขเริ่มต้น) ด้วย'); return; }
    if (ec === '' || wc === '') { App.showError('กรอกเลขมิเตอร์ไม่ครบ', 'กรุณากรอกเลขมิเตอร์ไฟและน้ำครั้งนี้'); return; }
    let elecRollover = false, waterRollover = false;
    if (num(ec) < num(ep)) {
      if (!(await App.confirm('มิเตอร์ไฟครบรอบ?', `เลขครั้งนี้ (${ec}) น้อยกว่าครั้งก่อน (${ep}) ใช่มิเตอร์วนกลับ 0 หรือไม่? หากเปลี่ยนมิเตอร์ใหม่ให้กดยกเลิกแล้วแก้เลขครั้งก่อน`, 'ใช่ ครบรอบ'))) return;
      elecRollover = true;
    }
    if (num(wc) < num(wp)) {
      if (!(await App.confirm('มิเตอร์น้ำครบรอบ?', `เลขครั้งนี้ (${wc}) น้อยกว่าครั้งก่อน (${wp}) ใช่มิเตอร์วนกลับ 0 หรือไม่? หากเปลี่ยนมิเตอร์ใหม่ให้กดยกเลิกแล้วแก้เลขครั้งก่อน`, 'ใช่ ครบรอบ'))) return;
      waterRollover = true;
    }
    const x = this._extrasOf(r);
    try {
      App.showLoading('กำลังบันทึกมิเตอร์และออกบิล...');
      const res = await API.saveMeterReading({
        roomId: r.roomId, period: this.period,
        elecPrev: ep, elecCurr: ec, waterPrev: wp, waterCurr: wc,
        elecRollover, waterRollover,
        otherFee: x.otherFee || 0, otherFeeNote: x.otherFeeNote || '', discount: x.discount || 0
      });
      App.closeLoading();
      App.showToast(`ห้อง ${r.roomNumber}: ออกบิล ${res.billNo} ยอด ${money(res.totalAmount)} บาท`, 'success');
      delete this.extras[r.roomId];
      delete this.drafts[r.roomId];
      await this.loadSheet();
    } catch (e) {
      App.closeLoading();
      App.showError('บันทึกไม่สำเร็จ', e.message);
    }
  },

  // ======================= บิลและใบเสร็จ =======================
  async loadBills() {
    const body = document.getElementById('bill-table-body');
    body.innerHTML = '<tr><td colspan="8" class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary me-2"></div>กำลังโหลดบิล...</td></tr>';
    try {
      this.bills = (await API.getBills({ period: this.period })) || [];
      this.renderBills();
    } catch (e) {
      body.innerHTML = `<tr><td colspan="8" class="text-danger text-center py-4">${App.escHtml(e.message)}</td></tr>`;
    }
  },

  renderBills() {
    const kw = (document.getElementById('search-bill').value || '').trim().toLowerCase();
    const st = document.getElementById('filter-bill-status').value;
    const live = this.bills.filter(b => b.Status !== 'Cancelled');
    const sum = (list) => list.reduce((s, b) => s + num(b.TotalAmount), 0);
    const paid = live.filter(b => b.Status === 'Paid'), unpaid = live.filter(b => b.Status === 'Unpaid');
    const box = (label, val, cls, sub) => `<div class="col-6 col-md-3"><div class="parking-kpi"><small class="text-muted d-block">${label}</small><div class="fs-5 fw-bold ${cls}">${val}</div><small class="text-muted">${sub}</small></div></div>`;
    document.getElementById('bill-summary').innerHTML =
      box('จำนวนบิล', live.length, 'text-dark', 'รอบ ' + thPeriod(this.period)) +
      box('ยอดรวมทั้งหมด (บาท)', money(sum(live)), 'text-dark', '') +
      box('ชำระแล้ว (บาท)', money(sum(paid)), 'text-success', paid.length + ' บิล') +
      box('ค้างชำระ (บาท)', money(sum(unpaid)), unpaid.length ? 'text-danger' : 'text-success', unpaid.length + ' บิล');

    const list = this.bills.filter(b => {
      if (st ? b.Status !== st : b.Status === 'Cancelled') return false;
      if (!kw) return true;
      return [b.BillNo, b.ReceiptNo, b.RoomNumber, b.TenantNames, b.BuildingName].some(v => App.lc(v).includes(kw));
    });
    const body = document.getElementById('bill-table-body');
    if (list.length === 0) {
      body.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">ยังไม่มีบิลในรอบนี้ ไปที่แท็บ "จดมิเตอร์" เพื่อบันทึกเลขมิเตอร์และออกบิล</td></tr>';
      return;
    }
    body.innerHTML = list.map(b => {
      const id = App.escAttr(b.BillID);
      const badge = b.Status === 'Paid' ? '<span class="badge bg-success">ชำระแล้ว</span>'
        : b.Status === 'Cancelled' ? '<span class="badge bg-secondary">ยกเลิก</span>' : '<span class="badge bg-warning text-dark">รอชำระ</span>';
      const actions = b.Status === 'Unpaid'
        ? `<button class="btn btn-sm btn-success me-1" onclick="Meters.openPay('${id}')"><i class="bi bi-cash-coin me-1"></i>รับชำระ</button>
           <button class="btn btn-sm btn-outline-danger" onclick="Meters.cancelBill('${id}')" title="ยกเลิกบิล"><i class="bi bi-x-circle"></i></button>`
        : b.Status === 'Paid'
          ? `<button class="btn btn-sm btn-outline-primary me-1" onclick="Meters.printDoc('${id}', 'receipt')"><i class="bi bi-printer me-1"></i>ใบเสร็จ</button>
             <button class="btn btn-sm btn-outline-secondary" onclick="Meters.voidPayment('${id}')" title="ยกเลิกการรับชำระ"><i class="bi bi-arrow-counterclockwise"></i></button>`
          : '';
      return `
        <tr>
          <td><strong class="text-primary">${App.escHtml(b.BillNo)}</strong>${b.ReceiptNo ? `<div class="small text-muted">${App.escHtml(b.ReceiptNo)}</div>` : ''}</td>
          <td><strong>ห้อง ${App.escHtml(b.RoomNumber)}</strong><div class="small text-muted">${App.escHtml(b.TenantNames || 'ไม่มีผู้พัก')}</div></td>
          <td class="text-end">${num(b.ElecUnits)} <small class="text-muted">หน่วย</small><div class="small text-muted">${money(b.ElecAmount)}</div></td>
          <td class="text-end">${num(b.WaterUnits)} <small class="text-muted">หน่วย</small><div class="small text-muted">${money(b.WaterAmount)}</div></td>
          <td class="text-end fw-bold">${money(b.TotalAmount)}</td>
          <td>${thDate(b.DueDate)}</td>
          <td>${badge}</td>
          <td class="text-nowrap">
            <button class="btn btn-sm btn-outline-primary me-1" onclick="Meters.printDoc('${id}', 'invoice')" title="พิมพ์ใบแจ้งหนี้"><i class="bi bi-file-earmark-text"></i></button>
            ${actions}
          </td>
        </tr>`;
    }).join('');
  },

  async openPay(billId) {
    const b = this.bills.find(x => String(x.BillID) === String(billId));
    if (!b) return;
    const today = App.todayStr();
    const res = await Swal.fire({
      title: `รับชำระ ${b.BillNo}`,
      html: `
        <div class="text-start">
          <div class="alert alert-secondary py-2">ห้อง ${App.escHtml(b.RoomNumber)} · ยอด <strong>${money(b.TotalAmount)}</strong> บาท</div>
          <label class="form-label fw-semibold mb-1">วันที่รับชำระ</label>
          <input id="p-date" type="date" class="form-control mb-2" value="${today}">
          <label class="form-label fw-semibold mb-1">ช่องทางชำระ</label>
          <select id="p-method" class="form-select mb-2"><option>เงินสด</option><option>โอนเงิน</option><option>หักเงินเดือน</option><option>อื่น ๆ</option></select>
          <label class="form-label fw-semibold mb-1">ชื่อผู้ชำระ</label>
          <input id="p-payer" type="text" class="form-control" value="${App.escHtml(b.TenantNames || '')}">
        </div>`,
      showCancelButton: true, confirmButtonText: 'บันทึกการรับชำระ', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#16a34a',
      preConfirm: () => {
        const date = document.getElementById('p-date').value;
        if (!date) { Swal.showValidationMessage('กรุณาระบุวันที่รับชำระ'); return false; }
        return { paidDate: date, payMethod: document.getElementById('p-method').value, payerName: document.getElementById('p-payer').value.trim() };
      }
    });
    if (!res.isConfirmed) return;
    try {
      App.showLoading('กำลังบันทึกการรับชำระ...');
      const out = await API.payBill({ billId, ...res.value });
      App.closeLoading();
      await this.loadBills();
      const go = await App.confirm('รับชำระสำเร็จ', `ออกใบเสร็จเลขที่ ${out.receiptNo} แล้ว ต้องการพิมพ์ใบเสร็จตอนนี้หรือไม่?`, 'พิมพ์ใบเสร็จ', 'ภายหลัง');
      if (go) this.printDoc(billId, 'receipt');
    } catch (e) {
      App.closeLoading();
      App.showError('บันทึกการรับชำระไม่สำเร็จ', e.message);
    }
  },

  async voidPayment(billId) {
    if (!(await App.confirm('ยกเลิกการรับชำระ?', 'ใบเสร็จเดิมจะถูกยกเลิก และบิลกลับเป็นสถานะรอชำระ', 'ยกเลิกการรับชำระ'))) return;
    try {
      App.showLoading('กำลังดำเนินการ...');
      await API.voidPayment(billId);
      App.closeLoading();
      App.showToast('ยกเลิกการรับชำระแล้ว', 'success');
      this.loadBills();
    } catch (e) { App.closeLoading(); App.showError('ทำรายการไม่สำเร็จ', e.message); }
  },

  async cancelBill(billId) {
    if (!(await App.confirm('ยกเลิกบิลนี้?', 'หากต้องการออกบิลใหม่ให้กลับไปบันทึกมิเตอร์ของห้องนั้นอีกครั้ง', 'ยกเลิกบิล'))) return;
    try {
      App.showLoading('กำลังยกเลิกบิล...');
      await API.cancelBill(billId);
      App.closeLoading();
      App.showToast('ยกเลิกบิลแล้ว', 'success');
      this.loadBills();
    } catch (e) { App.closeLoading(); App.showError('ยกเลิกไม่สำเร็จ', e.message); }
  },

  // ======================= พิมพ์ใบแจ้งหนี้ / ใบเสร็จ =======================
  printDoc(billId, type) {
    const b = this.bills.find(x => String(x.BillID) === String(billId));
    if (!b) return;
    const s = this.settings || {};
    const isReceipt = type === 'receipt';
    const E = (v) => App.escHtml(v);
    const company = s.COMPANY_NAME || s.SYSTEM_NAME || 'หอพักพนักงาน';
    const tenants = b.TenantCount ? Number(b.TenantCount) : 0;

    const lines = [];
    if (num(b.RoomRent) > 0) lines.push(['ค่าเช่าห้องพัก', `ห้อง ${b.RoomNumber}`, '', '', num(b.RoomRent)]);
    lines.push([
      'ค่าไฟฟ้า',
      `เลขมิเตอร์ ${num(b.ElecPrev)} → ${num(b.ElecCurr)}`,
      `${num(b.ElecUnits)} หน่วย`, `${money(b.ElecRate)} /หน่วย`, num(b.ElecAmount)
    ]);
    lines.push([
      'ค่าน้ำประปา',
      `เลขมิเตอร์ ${num(b.WaterPrev)} → ${num(b.WaterCurr)}`,
      `${num(b.WaterUnits)} หน่วย`, `${money(b.WaterRate)} /หน่วย`, num(b.WaterAmount)
    ]);
    if (num(b.OtherFee) > 0) lines.push(['ค่าอื่น ๆ', b.OtherFeeNote || '', '', '', num(b.OtherFee)]);
    if (num(b.Discount) > 0) lines.push(['ส่วนลด', '', '', '', -num(b.Discount)]);
    if (num(b.VatAmount) > 0) lines.push([`ภาษีมูลค่าเพิ่ม ${num(b.VatRate)}%`, '', '', '', num(b.VatAmount)]);

    const rowsHtml = lines.map(l => `
      <tr><td>${E(l[0])}</td><td class="muted">${E(l[1])}</td><td class="r">${E(l[2])}</td><td class="r">${E(l[3])}</td>
      <td class="r">${l[4] < 0 ? '-' : ''}${money(Math.abs(l[4]))}</td></tr>`).join('');

    const docNo = isReceipt ? b.ReceiptNo : b.BillNo;
    const html = `<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><title>${isReceipt ? 'ใบเสร็จรับเงิน' : 'ใบแจ้งหนี้'} ${E(docNo)}</title>
<link href="https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
  @page { size: A5 landscape; margin: 10mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Prompt', sans-serif; color: #1e293b; font-size: 12px; margin: 0; padding: 14px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1e3a8a; padding-bottom: 8px; margin-bottom: 10px; }
  .co { font-size: 15px; font-weight: 700; color: #1e3a8a; }
  .doc { text-align: right; }
  .doc h1 { margin: 0; font-size: 18px; color: #1e3a8a; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; margin-bottom: 10px; }
  .muted { color: #64748b; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #eff6ff; text-align: left; padding: 5px 6px; border-bottom: 1px solid #bfdbfe; font-weight: 600; }
  td { padding: 5px 6px; border-bottom: 1px solid #e2e8f0; }
  .r { text-align: right; font-variant-numeric: tabular-nums; }
  .total td { font-weight: 700; font-size: 14px; border-top: 2px solid #1e3a8a; border-bottom: none; }
  .words { margin: 8px 0; padding: 6px 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; }
  .sign { display: flex; justify-content: space-around; margin-top: 22px; text-align: center; }
  .sign div { width: 40%; border-top: 1px solid #94a3b8; padding-top: 4px; }
  .note { margin-top: 8px; font-size: 11px; }
  .stamp { display: inline-block; border: 2px solid #16a34a; color: #16a34a; padding: 1px 10px; border-radius: 4px; font-weight: 700; transform: rotate(-4deg); }
</style></head><body>
  <div class="head">
    <div><div class="co">${E(company)}</div>
      ${s.COMPANY_ADDRESS ? `<div class="muted">${E(s.COMPANY_ADDRESS)}</div>` : ''}
      ${s.COMPANY_TAXID ? `<div class="muted">เลขประจำตัวผู้เสียภาษี ${E(s.COMPANY_TAXID)}</div>` : ''}</div>
    <div class="doc"><h1>${isReceipt ? 'ใบเสร็จรับเงิน' : 'ใบแจ้งหนี้ค่าเช่าและสาธารณูปโภค'}</h1>
      <div>เลขที่ ${E(docNo)}</div>
      ${isReceipt ? `<div class="stamp">ชำระแล้ว</div>` : ''}</div>
  </div>
  <div class="grid">
    <div>ห้อง: <strong>${E(b.RoomNumber)}</strong> ${E(b.BuildingName)}</div>
    <div>รอบบิล: <strong>${E(thPeriod(b.Period))}</strong></div>
    <div>ผู้พัก: ${E(b.TenantNames || '-')}</div>
    ${isReceipt
      ? `<div>วันที่รับชำระ: ${E(thDate(b.PaidDate))} (${E(b.PayMethod || '-')})</div>`
      : `<div>ครบกำหนดชำระ: <strong>${E(thDate(b.DueDate))}</strong></div>`}
    ${isReceipt ? `<div>ผู้ชำระ: ${E(b.PayerName || '-')}</div><div>อ้างอิงใบแจ้งหนี้: ${E(b.BillNo)}</div>` : ''}
  </div>
  <table>
    <thead><tr><th>รายการ</th><th>รายละเอียด</th><th class="r">จำนวน</th><th class="r">อัตรา</th><th class="r">จำนวนเงิน (บาท)</th></tr></thead>
    <tbody>${rowsHtml}
      <tr class="total"><td colspan="4" class="r">รวมสุทธิ</td><td class="r">${money(b.TotalAmount)}</td></tr>
    </tbody>
  </table>
  <div class="words">( ${E(bahtText(b.TotalAmount))} )</div>
  ${tenants > 1 ? `<div class="muted">หาร ${tenants} คน เฉลี่ยคนละ ${money(num(b.TotalAmount) / tenants)} บาท</div>` : ''}
  ${!isReceipt && s.PAY_INFO ? `<div class="note"><strong>ช่องทางชำระเงิน:</strong> ${E(s.PAY_INFO)}</div>` : ''}
  <div class="sign"><div>${isReceipt ? 'ผู้รับเงิน' : 'ผู้ออกบิล'}</div><div>${isReceipt ? 'ผู้ชำระเงิน' : 'ผู้รับบิล'}</div></div>
  <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 500); };<\/script>
</body></html>`;

    const w = window.open('', '_blank');
    if (!w) { App.showError('เบราว์เซอร์บล็อกหน้าต่างพิมพ์', 'กรุณาอนุญาต pop-up สำหรับเว็บไซต์นี้แล้วลองใหม่'); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
  },

  // ======================= ตั้งค่าอัตรา =======================
  fillRates() {
    RATE_KEYS.forEach(k => {
      const el = document.getElementById('set-' + k);
      if (el && this.settings[k] !== undefined) el.value = this.settings[k];
    });
  },

  async saveRates() {
    const data = {};
    RATE_KEYS.forEach(k => {
      const el = document.getElementById('set-' + k);
      if (el) data[k] = el.value;
    });
    if (num(data.ELEC_RATE) <= 0 || num(data.WATER_RATE) <= 0) {
      App.showError('อัตราไม่ถูกต้อง', 'ค่าไฟและค่าน้ำต่อหน่วยต้องมากกว่า 0');
      return;
    }
    try {
      App.showLoading('กำลังบันทึกอัตรา...');
      await API.saveSettings(data);
      App.closeLoading();
      App.showToast('บันทึกอัตราแล้ว (มีผลกับบิลที่ออกหรือแก้ไขหลังจากนี้)', 'success');
      await this.loadSheet();
    } catch (e) {
      App.closeLoading();
      App.showError('บันทึกไม่สำเร็จ', e.message);
    }
  }
};