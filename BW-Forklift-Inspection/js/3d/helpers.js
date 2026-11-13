const PI = Math.PI;
let BODY_C = 0xf28200;

const V3 = {
  inited: false, st: null, root: null, drag: null,
  theta: 0.75, phi: 1.15, dist: 10.5, autoRotate: true,
  parts: [], selectedPart: -1, target: null, tgoal: null, showLabels: true, covers: [], internal: null
};

const PV = {
  hidden: false, src: '', tok: 0, item: null,
  mode: (function () { try { return localStorage.getItem('fl_part_mode') === '3d' ? '3d' : 'photo'; } catch (e) { return 'photo'; } })(),
  inited: false, st: null, pivot: null, drag: null,
  rotY: 0.7, rotX: 0.35, zoom: 5.2, auto: true
};

function M(c, o) {
  const m = new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.55, metalness: 0.25 }, o || {}));
  m.userData.e0 = m.emissive.getHex();
  m.userData.i0 = m.emissiveIntensity;
  return m;
}
const GL = (c, op) => M(c, { transparent: true, opacity: op, roughness: 0.08, metalness: 0, depthWrite: false });
const steel = () => M(0x9aa5b1, { metalness: 0.85, roughness: 0.35 });
const chrome = () => M(0xdfe6ed, { metalness: 1, roughness: 0.12 });
const dark = () => M(0x1f2630, { roughness: 0.6, metalness: 0.3 });
const rubber = () => M(0x14171c, { roughness: 0.95, metalness: 0 });
const bodyMat = () => M(BODY_C, { roughness: 0.42, metalness: 0.1, envMapIntensity: 0.6 });
const brass = () => M(0xd4af37, { metalness: 0.85, roughness: 0.28 });
const copper = () => M(0xb87333, { metalness: 0.9, roughness: 0.25 });
const brightRed = () => M(0xdc2626, { roughness: 0.3, metalness: 0.15 });
const warningYellow = () => M(0xfacc15, { roughness: 0.35, metalness: 0.2 });
const castIron = () => M(0x282c34, { metalness: 0.75, roughness: 0.6 });

function rrPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function decalTex(draw, w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  t.anisotropy = 4;
  return t;
}

function decalPlane(g, tex, w, h, x, y, z, side) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
  );
  m.position.set(x, y, z);
  m.rotation.y = (side || 0) * PI / 2;
  g.add(m);
  return m;
}

// แถบเตือนลายเฉียงเหลือง-ดำ
function hazardTex() {
  return decalTex((c, w, h) => {
    c.clearRect(0, 0, w, h);
    const nS = 8, sw = w / nS;
    for (let i = 0; i < nS; i++) {
      c.fillStyle = i % 2 === 0 ? '#facc15' : '#1a1a1a';
      c.beginPath(); c.moveTo(i * sw, 0); c.lineTo((i + 1) * sw, 0);
      c.lineTo((i + 1) * sw - h * 0.6, h); c.lineTo(i * sw - h * 0.6, h); c.closePath(); c.fill();
    }
  }, 320, 48);
}

// ป้ายพิกัดน้ำหนักสีเหลือง Toyota (เช่น "2.5 ตัน")
function capPlateTex(txt) {
  return decalTex((c, w, h) => {
    c.clearRect(0, 0, w, h);
    rrPath(c, 8, 8, w - 16, h - 16, 20);
    c.fillStyle = '#facc15'; c.fill();
    c.lineWidth = 6; c.strokeStyle = '#1a1a1a'; c.stroke();
    c.fillStyle = '#111827';
    c.font = 'bold 82px Kanit, Arial, sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(txt || '2.5 ตัน', w / 2, h / 2 + 5);
  }, 320, 128);
}

// ข้อความ TOYOTA ตัวอักษรสีขาวแนวตั้งสำหรับติดเสาโฟล์คลิฟท์ (ตามรูปรถจริง Toyota 2.5 ตัน)
function toyotaMastTex() {
  return decalTex((c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.fillStyle = '#ffffff';
    c.font = '900 50px Kanit, Arial, sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    const letters = ['T', 'O', 'Y', 'O', 'T', 'A'];
    const startY = 50, endY = h - 50;
    const step = (endY - startY) / (letters.length - 1);
    letters.forEach((ch, idx) => {
      c.fillText(ch, w / 2, startY + idx * step);
    });
  }, 128, 512);
}

// สติกเกอร์ฝาครอบข้างเครื่อง Toyota ("25" + "TOYOTA" ตัวขาวบนพื้นเทาเข้ม)
function toyotaHoodTex(modelNum) {
  return decalTex((c, w, h) => {
    c.clearRect(0, 0, w, h);
    // เลขรุ่น "25" ตัวหนาสีขาว
    c.fillStyle = '#ffffff';
    c.font = '900 86px Kanit, Arial, sans-serif';
    c.textAlign = 'left'; c.textBaseline = 'middle';
    c.fillText(modelNum || '25', 26, h / 2 - 2);

    // โลโก้/ชื่อ "TOYOTA" สีขาว
    c.font = 'bold 36px Kanit, Arial, sans-serif';
    c.fillText('TOYOTA', 165, h / 2 - 14);

    // เส้นขีดตกแต่งสีส้มสไตล์ Toyota
    c.fillStyle = '#e05020';
    c.fillRect(165, h / 2 + 12, 138, 7);
  }, 440, 140);
}

// สติกเกอร์ข้างขารีชทรัค MAXUP ตัวอักษรสีขาวหนา
function maxupBrandTex() {
  return decalTex((c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.fillStyle = '#ffffff';
    c.font = '900 92px Kanit, Arial, sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('MAXUP', w / 2, h / 2 + 4);
  }, 512, 128);
}

// สติกเกอร์รุ่น "20" ของ Reach Truck MAXUP พร้อมรอยตัดเส้นสเตนซิล
function maxupModelTex(num) {
  return decalTex((c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.fillStyle = '#ffffff';
    c.font = '900 110px Kanit, Arial, sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(num || '20', w / 2, h / 2);
    // ร่องตัดแนวนอน 2 แถบเลียนแบบสเตนซิลของ MAXUP
    c.clearRect(20, h / 2 - 18, w - 40, 10);
    c.clearRect(20, h / 2 + 10, w - 40, 10);
  }, 256, 160);
}

// แผ่นป้ายสเปค/เตือนความปลอดภัยสีขาวแถบแดง (สำหรับ Reach Truck & Walkie Stacker)
function specSheetTex() {
  return decalTex((c, w, h) => {
    c.clearRect(0, 0, w, h);
    rrPath(c, 4, 4, w - 8, h - 8, 12);
    c.fillStyle = '#ffffff'; c.fill();
    c.lineWidth = 4; c.strokeStyle = '#94a3b8'; c.stroke();
    // แถบแดงด้านบน WARNING / CAUTION
    c.fillStyle = '#dc2626';
    c.fillRect(10, 10, w - 20, 36);
    c.fillStyle = '#ffffff';
    c.font = 'bold 20px Kanit, Arial, sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('WARNING', w / 2, 28);
    // เส้นข้อความจำลอง
    c.fillStyle = '#64748b';
    for (let y = 60; y < h - 20; y += 18) {
      c.fillRect(16, y, w - 32, 7);
    }
  }, 240, 300);
}

// สติกเกอร์ป้ายรุ่น CBD30-460 สีดำสำหรับ Walkie Stacker (T'Shandlift)
function cbdModelTex(txt) {
  return decalTex((c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.fillStyle = '#111827';
    c.font = '900 80px Kanit, Arial, sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(txt || 'CBD30-460', w / 2, h / 2 + 4);
  }, 512, 128);
}

function rbox(w, h, d, r) {
  r = r == null ? Math.min(w, h, d) * 0.18 : r;
  const b = Math.max(0.002, Math.min(r * 0.6, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
  const rr = Math.max(0.001, Math.min(r - b, w / 2 - b - 0.001, h / 2 - b - 0.001));
  const W = w - 2 * b, H = h - 2 * b, x = -W / 2, y = -H / 2;
  const s = new THREE.Shape();
  s.moveTo(x + rr, y); s.lineTo(x + W - rr, y); s.quadraticCurveTo(x + W, y, x + W, y + rr);
  s.lineTo(x + W, y + H - rr); s.quadraticCurveTo(x + W, y + H, x + W - rr, y + H);
  s.lineTo(x + rr, y + H); s.quadraticCurveTo(x, y + H, x, y + H - rr);
  s.lineTo(x, y + rr); s.quadraticCurveTo(x, y, x + rr, y);
  const depth = Math.max(0.002, d - 2 * b);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 4 });
  g.translate(0, 0, -depth / 2);
  return g;
}

function put(g, geo, mat, x, y, z, rx, ry, rz) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x || 0, y || 0, z || 0);
  if (rx) m.rotation.x = rx;
  if (ry) m.rotation.y = ry;
  if (rz) m.rotation.z = rz;
  g.add(m);
  return m;
}
const RB = (g, w, h, d, mat, x, y, z, r, rx, ry, rz) => put(g, rbox(w, h, d, r), mat, x, y, z, rx, ry, rz);
const BX = (g, w, h, d, mat, x, y, z, rx, ry, rz) => put(g, new THREE.BoxGeometry(w, h, d), mat, x, y, z, rx, ry, rz);
const CY = (g, r, h, mat, x, y, z, ax, seg) => {
  const m = put(g, new THREE.CylinderGeometry(r, r, h, seg || 28), mat, x, y, z);
  if (ax === 'x') m.rotation.z = PI / 2;
  if (ax === 'z') m.rotation.x = PI / 2;
  return m;
};
const HX = (g, r, h, mat, x, y, z, ax) => CY(g, r, h, mat, x, y, z, ax, 6);
const CN = (g, rt, rb, h, mat, x, y, z, ax) => {
  const m = put(g, new THREE.CylinderGeometry(rt, rb, h, 28), mat, x, y, z);
  if (ax === 'x') m.rotation.z = -PI / 2;
  if (ax === 'z') m.rotation.x = PI / 2;
  return m;
};
const SP = (g, r, mat, x, y, z) => put(g, new THREE.SphereGeometry(r, 20, 14), mat, x, y, z);
const TR = (g, R, t, mat, x, y, z, rx, ry, rz) => put(g, new THREE.TorusGeometry(R, t, 10, 40), mat, x, y, z, rx, ry, rz);
function TB(g, pts, r, mat) {
  const c = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2])));
  return put(g, new THREE.TubeGeometry(c, Math.max(14, pts.length * 12), r, 10, false), mat);
}
function strap(g, a, b, w, t, mat) {
  const A = new THREE.Vector3(a[0], a[1], a[2]), B = new THREE.Vector3(b[0], b[1], b[2]);
  const d = B.clone().sub(A), len = d.length();
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, t, len), mat);
  m.position.copy(A.clone().add(B).multiplyScalar(0.5));
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d.normalize());
  g.add(m);
  return m;
}
function disposeObj(o) {
  if (!o) return;
  o.traverse(n => {
    if (n.geometry) n.geometry.dispose();
    if (n.material) {
      (Array.isArray(n.material) ? n.material : [n.material]).forEach(m => {
        if (m.map) m.map.dispose();
        m.dispose();
      });
    }
  });
}

function wheelAt(g, R, W, solid, side, x, y, z) {
  const w = new THREE.Group();
  w.position.set(x, y, z);
  const ri = R * 0.58, h = W / 2, c = solid ? R * 0.03 : R * 0.07;
  const prof = [[ri, -h], [R - c, -h], [R - 0.01, -h + c * 0.9], [R, -h + c * 2], [R, h - c * 2], [R - 0.01, h - c * 0.9], [R - c, h], [ri, h]]
    .map(p => new THREE.Vector2(p[0], p[1]));
  
  if (solid) {
    // ล้อโพลียูรีเทนสีอำพัน/เหลืองส้ม สำหรับ Reach truck / Walkie stacker
    const polyMat = M(0xcf8b3c, { roughness: 0.38, metalness: 0.1, envMapIntensity: 0.5 });
    put(w, new THREE.LatheGeometry(prof, 36), polyMat, 0, 0, 0, 0, 0, PI / 2);
    CY(w, ri + 0.015, W * 0.92, steel(), 0, 0, 0, 'x');
    CY(w, ri * 0.65, W + 0.02, dark(), 0, 0, 0, 'x');
    CY(w, ri * 0.32, W + 0.04, chrome(), 0, 0, 0, 'x');
    [-1, 1].forEach(k => TR(w, R - 0.015, 0.008, M(0xa86820), k * W * 0.45, 0, 0, 0, PI / 2));
  } else {
    // ยางลม/ยางตันสีดำพร้อมดอกยาง สำหรับ Counterbalance (ตามรูป Toyota 2.5 ตัน)
    put(w, new THREE.LatheGeometry(prof, 44), rubber(), 0, 0, 0, 0, 0, PI / 2);
    const lug = M(0x0d0f12, { roughness: 0.95, metalness: 0 });
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * PI * 2;
      put(w, new THREE.BoxGeometry(W * 0.82, 0.045, R * 0.2), lug, 0, Math.cos(a) * R, Math.sin(a) * R, a);
    }

    // กระทะล้อเหล็กสีเงินเมทัลลิกพร้อมรูกลมระบายอากาศ 6 รู (ตามรูปรถจริง Toyota)
    const rimSilver = M(0xd1d5db, { metalness: 0.88, roughness: 0.28 });
    CY(w, ri * 0.98, W * 0.68, rimSilver, 0, 0, 0, 'x');
    [-1, 1].forEach(k => TR(w, ri * 0.98, 0.02, steel(), k * W * 0.31, 0, 0, 0, PI / 2));

    // แผ่นกระทะล้อด้านนอกสีเงิน + รูเจาะกลม 6 รูรอบวง
    CY(w, ri * 0.95, 0.04, rimSilver, side * W * 0.32, 0, 0, 'x');
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * PI * 2;
      CY(w, ri * 0.12, 0.06, dark(), side * W * 0.325, Math.cos(a) * ri * 0.72, Math.sin(a) * ri * 0.72, 'x');
      TR(w, ri * 0.12, 0.012, steel(), side * W * 0.33, Math.cos(a) * ri * 0.72, Math.sin(a) * ri * 0.72, 0, PI / 2);
    }

    // ดุมล้อตรงกลางสีเข้ม + ฝาครอบดุมเพลา + น็อตล้อ 6 ตัว
    CY(w, ri * 0.52, 0.055, dark(), side * W * 0.33, 0, 0, 'x');
    CY(w, ri * 0.25, 0.11, steel(), side * W * 0.36, 0, 0, 'x');
    CY(w, ri * 0.12, 0.13, chrome(), side * W * 0.39, 0, 0, 'x');
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * PI * 2 + PI / 6;
      HX(w, 0.028, 0.06, chrome(), side * W * 0.355, Math.cos(a) * ri * 0.38, Math.sin(a) * ri * 0.38, 'x');
    }
  }
  g.add(w);
  return w;
}
