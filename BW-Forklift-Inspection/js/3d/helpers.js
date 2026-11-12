/* js/3d/helpers.js — 3D: state (V3/PV), วัสดุ, ฟังก์ชันสร้างรูปทรง, ล้อ */
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
  put(w, new THREE.LatheGeometry(prof, 44), M(solid ? 0x2b2f36 : 0x15181d, { roughness: 0.9, metalness: 0, side: THREE.DoubleSide }), 0, 0, 0, 0, 0, PI / 2);
  if (!solid) {
    const lug = M(0x0d0f12, { roughness: 0.95, metalness: 0 });
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * PI * 2;
      put(w, new THREE.BoxGeometry(W * 0.82, 0.045, R * 0.2), lug, 0, Math.cos(a) * R, Math.sin(a) * R, a);
    }
  } else {
    CY(w, ri + 0.02, W * 0.9, M(0x9ca3af, { metalness: 0.8, roughness: 0.4 }), 0, 0, 0, 'x');
    [-1, 1].forEach(k => TR(w, R - 0.02, 0.012, M(0x0d0f12), k * W * 0.2, 0, 0, 0, PI / 2));
  }
  CY(w, ri * 0.98, W * 0.62, M(0xc9d1d9, { metalness: 0.8, roughness: 0.35 }), 0, 0, 0, 'x');
  [-1, 1].forEach(k => TR(w, ri * 0.98, 0.02, steel(), k * W * 0.31, 0, 0, 0, PI / 2));
  CY(w, ri * 0.72, 0.05, M(0x7b8794, { metalness: 0.7, roughness: 0.45 }), side * W * 0.3, 0, 0, 'x');
  CY(w, ri * 0.3, 0.1, steel(), side * W * 0.34, 0, 0, 'x');
  CY(w, ri * 0.14, 0.12, M(BODY_C, { metalness: 0.5, roughness: 0.4 }), side * W * 0.38, 0, 0, 'x');
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * PI * 2;
    HX(w, 0.03, 0.06, chrome(), side * W * 0.34, Math.cos(a) * ri * 0.55, Math.sin(a) * ri * 0.55, 'x');
  }
  g.add(w);
  return w;
}
