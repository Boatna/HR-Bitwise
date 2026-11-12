/* js/3d/parts-chassis.js — 3D ชิ้นส่วน: เสา/งา, ล้อ, สายไฮดรอลิค, ไฟ/แตร, เบรค, กระจก, พวงมาลัย, เข็มขัด, โซ่ */
function pMast(solo, ctx) {
  const g = new THREE.Group();
  const sub = ctx && ctx.subtype;
  const P = sub === 'walkie_stacker' ? { S: 0.36, H: 3.2, F: 1.05, tilt: false, lbr: 0.95 }
    : sub === 'reach_truck' ? { S: 0.6, H: 3.8, F: 1.15, tilt: false, lbr: 1.15 }
    : { S: 0.72, H: 3.4, F: 1.55, tilt: true, lbr: 1.35 };
  const S = P.S, H = P.H;
  const dkm = sub === 'walkie_stacker' || sub === 'reach_truck';
  const st = () => M(dkm ? 0x1c2025 : 0x1f262e, { metalness: dkm ? 0.25 : 0.4, roughness: dkm ? 0.55 : 0.5, envMapIntensity: dkm ? 0.35 : 1 });
  const lt = () => M(dkm ? 0x555c65 : 0x59636f, { metalness: dkm ? 0.4 : 0.5, roughness: 0.45 });
  const cm = () => M(0x192028, { metalness: 0.65, roughness: 0.45 });

  [-1, 1].forEach(s => {
    RB(g, 0.22, H, 0.28, st(), s * S, H / 2, 0, 0.03);
    RB(g, 0.16, H - 0.2, 0.2, lt(), s * (S - 0.2), H / 2 + 0.05, 0.08, 0.02);
    [0.6, H / 2 + 0.1, H - 0.4].forEach(ry => CY(g, 0.065, 0.08, steel(), s * (S - 0.1), ry, 0.08, 'x'));
    if (P.tilt) {
      CY(g, 0.08, 0.82, st(), s * (S + 0.14), 0.95, -0.62, 'z');
      CY(g, 0.04, 0.65, chrome(), s * (S + 0.14), 0.95, -0.16, 'z');
    }
  });
  BX(g, 2 * S + 0.22, 0.12, 0.16, st(), 0, H - 0.02, 0);
  BX(g, 2 * S + 0.14, 0.14, 0.22, st(), 0, 0.22, 0);
  BX(g, 2 * S + 0.14, 0.1, 0.16, st(), 0, H / 2 + 0.1, -0.06);
  CY(g, 0.12, 1.6, st(), 0, 0.98, -0.22);
  CY(g, 0.08, H * 0.56, chrome(), 0, 0.81 + H * 0.28, -0.22);
  const cw = 2 * S + 0.12;
  RB(g, cw, 0.14, 0.14, cm(), 0, 0.44, 0.22, 0.02);
  RB(g, cw, 0.14, 0.14, cm(), 0, 1.08, 0.22, 0.02);
  const k = Math.max(1, Math.floor((S - 0.03) / 0.17));
  const bt = 0.475;
  for (let i = -k; i <= k; i++) RB(g, 0.05, P.lbr, 0.05, cm(), i * 0.17, bt + P.lbr / 2, 0.24, 0.015);
  RB(g, 2 * S + 0.08, 0.08, 0.08, cm(), 0, bt + P.lbr, 0.24, 0.02);
  RB(g, 2 * S + 0.08, 0.06, 0.06, cm(), 0, bt + P.lbr * 0.73, 0.24, 0.02);
  [-S * 0.625, S * 0.625].forEach(x => {
    const f = new THREE.Group();
    f.position.set(x, 0.06, 0.29);
    const fm = () => M(dkm ? 0x2a2e34 : 0x39414a, { metalness: dkm ? 0.3 : 0.3, roughness: 0.55, envMapIntensity: dkm ? 0.4 : 1 });
    RB(f, 0.2, 0.88, 0.1, fm(), 0, 0.44, 0, 0.02);
    const sh = new THREE.Shape();
    sh.moveTo(0, 0); sh.lineTo(P.F, 0); sh.lineTo(P.F, 0.035); sh.lineTo(P.F * 0.72, 0.1); sh.lineTo(0.3, 0.125); sh.lineTo(0, 0.125); sh.lineTo(0, 0);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.25, bevelEnabled: false });
    geo.translate(0, 0, -0.125);
    const b = new THREE.Mesh(geo, fm());
    b.rotation.y = -PI / 2;
    b.position.z = -0.04;
    f.add(b);
    BX(f, 0.14, 0.04, 0.14, warningYellow(), 0, 0.9, 0);
    BX(f, 0.182, 0.03, 0.35, warningYellow(), 0, 0.015, P.F - 0.17);
    g.add(f);
  });
  return g;
}

function wheelSet(g, elec, sub) {
  if (sub === 'reach_truck') {
    [-1, 1].forEach(s => {
      wheelAt(g, 0.26, 0.26, true, s, s * 0.95, 0.26, 2.0);
      wheelAt(g, 0.17, 0.16, true, s, s * 0.7, 0.17, -2.0);
    });
    wheelAt(g, 0.4, 0.34, false, 1, 0, 0.4, -1.2);
    return;
  }
  if (sub === 'walkie_stacker') {
    [-1, 1].forEach(s => {
      wheelAt(g, 0.08, 0.1, true, s, s * 0.23, 0.08, 1.5);
      wheelAt(g, 0.1, 0.1, true, s, s * 0.36, 0.1, -0.85);
    });
    wheelAt(g, 0.3, 0.26, false, 1, 0, 0.3, -0.45);
    return;
  }
  const fx = elec ? 1.02 : 1.0, rx = elec ? 0.86 : 0.82;
  [-1, 1].forEach(s => {
    wheelAt(g, 0.5, elec ? 0.4 : 0.38, false, s, s * fx, 0.5, 0.9);
    wheelAt(g, 0.42, 0.32, false, s, s * rx, 0.42, -1.3);
  });
}

function pWheel(solo, ctx) {
  const g = new THREE.Group(), el = ctx && ctx.elec;
  if (solo) {
    const w = new THREE.Group();
    wheelAt(w, 0.52, 0.38, false, 1, 0, 0, 0);
    TR(w, 0.46, 0.024, rubber(), 0.16, 0, 0, 0, PI / 2);
    TR(w, 0.46, 0.024, rubber(), -0.16, 0, 0, 0, PI / 2);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * PI * 2;
      HX(w, 0.026, 0.06, chrome(), 0.19, Math.cos(a) * 0.22, Math.sin(a) * 0.22, 'x');
      CY(w, 0.012, 0.08, steel(), 0.21, Math.cos(a) * 0.22, Math.sin(a) * 0.22, 'x');
    }
    CY(w, 0.12, 0.12, castIron(), 0.18, 0, 0, 'x');
    CY(w, 0.03, 0.04, brass(), 0.25, 0, 0, 'x');
    CY(w, 0.065, 0.6, steel(), -0.32, 0, 0, 'x');
    g.add(w);
    return g;
  }
  wheelSet(g, el, ctx && ctx.subtype);
  return g;
}

function pHoses(solo) {
  const g = new THREE.Group();
  const hoseMat = () => M(0x1a1e24, { roughness: 0.75, metalness: 0.15 });
  RB(g, 0.94, 0.3, 0.24, brass(), 0, 1.3, -0.8, 0.03);
  [-0.24, -0.08, 0.08, 0.24].forEach((x, idx) => {
    CY(g, 0.016, 0.32, chrome(), x, 1.52, -0.8);
    SP(g, 0.042, M(idx === 0 ? 0xdc2626 : idx === 1 ? 0x2563eb : 0x16a34a, { roughness: 0.35 }), x, 1.68, -0.8);
  });

  [-1, 1].forEach(s => {
    CY(g, 0.14, 0.08, castIron(), s * 0.38, 3.12, -0.22, 'x');
    TR(g, 0.14, 0.02, steel(), s * 0.38, 3.12, -0.22, 0, PI / 2);
  });

  [-1, 1].forEach(s => {
    const a = [[s * 0.42, 1.3, -0.74], [s * 0.48, 1.22, -0.42], [s * 0.44, 1.65, -0.26], [s * 0.42, 2.35, -0.25], [s * 0.38, 3.12, -0.22]];
    const b = [[s * 0.29, 1.3, -0.74], [s * 0.32, 1.12, -0.46], [s * 0.32, 1.55, -0.3], [s * 0.32, 2.35, -0.3], [s * 0.38, 3.12, -0.22]];
    TB(g, a, 0.036, hoseMat());
    TB(g, b, 0.03, hoseMat());
    [a, b].forEach((p, i) => {
      HX(g, 0.058, 0.11, chrome(), p[0][0], p[0][1], p[0][2] - 0.03, 'z');
      HX(g, 0.058, 0.11, chrome(), p[4][0], p[4][1] + 0.03, p[4][2]);
      CY(g, 0.045, 0.09, M(i ? 0x2563eb : 0xfacc15, { roughness: 0.4 }), p[3][0], p[3][1], p[3][2]);
    });
  });
  return g;
}

function headlight(g, x, y, z, s) {
  const h = new THREE.Group();
  h.position.set(x, y, z);
  if (s) h.scale.setScalar(s);
  RB(h, 0.32, 0.26, 0.18, dark(), 0, 0, -0.02, 0.04);
  for (let k = -2; k <= 2; k++) BX(h, 0.28, 0.015, 0.06, dark(), 0, k * 0.04, -0.12);
  CY(h, 0.11, 0.05, chrome(), 0, 0, 0.06, 'z');
  SP(h, 0.035, M(0xffffff, { emissive: 0xffedd5, emissiveIntensity: 1.0 }), 0, 0, 0.07);
  CY(h, 0.095, 0.025, GL(0xfffbeb, 0.55), 0, 0, 0.09, 'z');
  CY(h, 0.02, 0.1, steel(), 0, -0.16, 0);
  HX(h, 0.025, 0.04, chrome(), 0, -0.16, 0.03, 'z');
  g.add(h);
}

function taillight(g, x, y, z, s, ry) {
  const h = new THREE.Group();
  h.position.set(x, y, z);
  if (s) h.scale.setScalar(s);
  if (ry) h.rotation.y = ry;
  RB(h, 0.34, 0.16, 0.09, dark(), 0, 0, 0, 0.02);
  RB(h, 0.1, 0.12, 0.095, M(0xdc2626, { emissive: 0xef4444, emissiveIntensity: 0.6, roughness: 0.2 }), -0.1, 0, 0.01, 0.015);
  RB(h, 0.1, 0.12, 0.095, M(0xf59e0b, { emissive: 0xf59e0b, emissiveIntensity: 0.55, roughness: 0.2 }), 0, 0, 0.01, 0.015);
  RB(h, 0.1, 0.12, 0.095, M(0xf8fafc, { emissive: 0xffffff, emissiveIntensity: 0.5, roughness: 0.2 }), 0.1, 0, 0.01, 0.015);
  g.add(h);
}

function beacon(g, x, y, z, s) {
  const h = new THREE.Group();
  h.position.set(x, y, z);
  if (s) h.scale.setScalar(s);
  CY(h, 0.12, 0.06, dark(), 0, 0, 0);
  put(h, new THREE.CylinderGeometry(0.12, 0.14, 0.2, 28), M(0xf59e0b, { emissive: 0xd97706, emissiveIntensity: 0.85, transparent: true, opacity: 0.88 }), 0, 0.12, 0);
  put(h, new THREE.SphereGeometry(0.12, 24, 14, 0, PI * 2, 0, PI / 2), M(0xf59e0b, { emissive: 0xd97706, emissiveIntensity: 0.85, transparent: true, opacity: 0.88 }), 0, 0.22, 0);
  CY(h, 0.05, 0.14, chrome(), 0, 0.12, 0);
  SP(h, 0.025, M(0xfff7ed, { emissive: 0xffffff, emissiveIntensity: 1.2 }), 0, 0.16, 0);
  g.add(h);
}

function horn(g, x, y, z, s) {
  const h = new THREE.Group();
  h.position.set(x, y, z);
  if (s) h.scale.setScalar(s);
  CY(h, 0.11, 0.06, castIron(), 0, 0, -0.06, 'z');
  CN(h, 0.16, 0.07, 0.18, chrome(), 0, 0, 0.06, 'z');
  SP(h, 0.045, chrome(), 0, 0, 0.08);
  BX(h, 0.03, 0.18, 0.012, steel(), 0, -0.12, -0.08);
  g.add(h);
}

function pLights(solo, ctx) {
  const g = new THREE.Group(), sub = ctx && ctx.subtype;
  if (solo) {
    headlight(g, -0.65, 0, 0, 1.4);
    taillight(g, -0.15, 0, 0, 1.4);
    beacon(g, 0.38, -0.1, 0, 1.25);
    horn(g, 0.92, 0, 0, 1.25);
    return g;
  }
  if (sub === 'walkie_stacker') {
    [-1, 1].forEach(s => { headlight(g, s * 0.3, 3.0, 0.62, 0.5); taillight(g, s * 0.28, 0.8, -0.97, 0.9, PI); });
    beacon(g, -0.5, 2.45, 0.4, 0.6);
    horn(g, 0.3, 1.45, -0.1, 0.6);
    return g;
  }
  if (sub === 'reach_truck') {
    [-1, 1].forEach(s => { headlight(g, s * 0.6, 3.72, 0.7, 0.8); taillight(g, s * 0.5, 0.95, -1.8, 0.9, PI); });
    beacon(g, 0, 4.04, -1.0);
    horn(g, 0, 1.0, 0.5, 0.8);
    return g;
  }
  [-1, 1].forEach(s => { headlight(g, s * 0.8, 3.05, 0.68); taillight(g, s * 0.75, 1.3, -2.29, 1, PI); });
  beacon(g, 0, 3.6, -0.3);
  horn(g, 0.45, 1.0, 1.02);
  return g;
}

function pBrake(solo) {
  const g = new THREE.Group();
  CY(g, 0.028, 0.96, steel(), 0, 0.52, -0.1, 'x');
  [[-0.26, 0.14, 0.12, 0], [0, 0.24, 0.15, 1], [0.26, 0.12, 0.18, 2]].forEach(([x, w, d, type]) => {
    const arm = CY(g, 0.022, 0.52, steel(), x, 0.28, -0.04);
    arm.rotation.x = -0.35;
    TR(g, 0.045, 0.012, steel(), x, 0.52, -0.1, 0, PI / 2);
    const pad = RB(g, w, 0.045, d, rubber(), x, 0.0, 0.06, 0.012);
    pad.rotation.x = -0.4;

    if (type === 1) {
      for (let k = -2; k <= 2; k++) {
        const tr = BX(g, w * 0.9, 0.014, 0.014, M(0x3a424c), x, 0.026, 0.06 + k * 0.026);
        tr.rotation.x = -0.4;
      }
    }
  });

  RB(g, 0.12, 0.18, 0.22, dark(), 0.6, 0.05, -0.1, 0.02);
  CY(g, 0.08, 0.015, steel(), 0.58, 0.12, -0.1, 'x');
  const lev = CY(g, 0.02, 0.54, steel(), 0.6, 0.32, -0.2);
  lev.rotation.x = -0.5;
  const grip = CY(g, 0.038, 0.2, M(0x111827, { roughness: 0.85 }), 0.6, 0.54, -0.32);
  grip.rotation.x = -0.5;
  CY(g, 0.02, 0.04, brightRed(), 0.6, 0.64, -0.37);
  return g;
}

function mirrorUnit(g, s, x) {
  const u = new THREE.Group();
  u.position.set(x, 0, 0);
  TB(u, [[0, 0, 0], [s * 0.14, 0.05, -0.02], [s * 0.34, 0.12, -0.06]], 0.02, dark());
  SP(u, 0.038, steel(), s * 0.35, 0.12, -0.06);
  CY(u, 0.03, 0.05, chrome(), s * 0.35, 0.12, -0.08, 'z');
  RB(u, 0.34, 0.42, 0.07, dark(), s * 0.44, 0.15, -0.1, 0.04);
  put(u, new THREE.CylinderGeometry(0.18, 0.18, 0.015, 32), M(0xe0f2fe, { metalness: 0.98, roughness: 0.03 }), s * 0.44, 0.15, -0.14, PI / 2);
  TR(u, 0.182, 0.012, rubber(), s * 0.44, 0.15, -0.14);
  g.add(u);
}

function pMirror(solo) {
  const g = new THREE.Group();
  if (solo) { mirrorUnit(g, 1, 0); return g; }
  mirrorUnit(g, -1, -0.88);
  mirrorUnit(g, 1, 0.88);
  return g;
}

function pSteering(solo) {
  const g = new THREE.Group();
  const tg = new THREE.Group();
  tg.rotation.x = -0.52;
  CY(tg, 0.052, 0.74, dark(), 0, 0.36, 0);
  CY(tg, 0.016, 0.18, chrome(), -0.12, 0.22, 0, 'x');
  SP(tg, 0.03, dark(), -0.22, 0.22, 0);
  for (let k = 0; k < 4; k++) TR(tg, 0.065, 0.012, rubber(), 0, 0.12 + k * 0.04, 0, PI / 2, 0, 0);
  CY(tg, 0.014, 0.22, dark(), -0.16, 0.52, 0, 'x');
  CY(tg, 0.024, 0.06, brightRed(), -0.26, 0.52, 0, 'x');
  const vin = M(0x181c22, { roughness: 0.85, metalness: 0.1 });
  TR(tg, 0.28, 0.034, vin, 0, 0.74, 0, -PI / 2);
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * PI * 2 + PI / 2;
    BX(tg, 0.28, 0.028, 0.045, vin, Math.cos(a) * 0.14, 0.74, Math.sin(a) * 0.14, 0, -a);
  }
  CY(tg, 0.08, 0.065, dark(), 0, 0.74, 0);
  CY(tg, 0.06, 0.01, warningYellow(), 0, 0.775, 0);
  CY(tg, 0.048, 0.035, steel(), 0.28, 0.79, 0);
  CY(tg, 0.035, 0.15, M(0x0f172a, { roughness: 0.7 }), 0.28, 0.87, 0);
  SP(tg, 0.038, M(0x0f172a, { roughness: 0.7 }), 0.28, 0.94, 0);
  tg.position.set(0, 0, 0);
  g.add(tg);
  RB(g, 0.54, 0.22, 0.14, dark(), 0, 0.22, -0.14, 0.03);
  BX(g, 0.24, 0.12, 0.01, M(0x064e3b, { emissive: 0x059669, emissiveIntensity: 0.5 }), 0, 0.24, -0.215);
  [-0.18, -0.12, 0.12, 0.18].forEach((x, idx) => {
    CY(g, 0.022, 0.01, M(idx === 0 ? 0xef4444 : idx === 1 ? 0xf59e0b : 0x22c55e, { emissive: idx === 0 ? 0xef4444 : idx === 1 ? 0xf59e0b : 0x22c55e, emissiveIntensity: 0.7 }), x, 0.24, -0.212, 'z');
  });
  return g;
}

function pSeatbelt(solo) {
  const g = new THREE.Group();
  const vin = M(0x181c22, { roughness: 0.9, metalness: 0.05 });
  RB(g, 0.64, 0.18, 0.58, dark(), 0, -0.28, 0, 0.04);
  CY(g, 0.045, 0.06, chrome(), 0, -0.28, 0.3, 'z');
  RB(g, 0.82, 0.18, 0.76, vin, 0, 0, 0, 0.08);
  [-1, 1].forEach(s => RB(g, 0.12, 0.14, 0.62, vin, s * 0.41, 0.08, 0, 0.04));
  RB(g, 0.8, 0.92, 0.16, vin, 0, 0.52, -0.38, 0.08, -0.15);
  RB(g, 0.52, 0.28, 0.12, vin, 0, 1.1, -0.45, 0.05, -0.15);
  RB(g, 0.12, 0.22, 0.12, dark(), -0.46, 0.56, -0.42, 0.02);
  const belt = M(0xf97316, { roughness: 0.7, metalness: 0.1 });
  strap(g, [-0.32, 0.98, -0.32], [0.22, 0.12, 0.14], 0.075, 0.014, belt);
  strap(g, [-0.44, 0.08, -0.15], [0.22, 0.12, 0.14], 0.075, 0.014, belt);
  RB(g, 0.075, 0.15, 0.035, chrome(), 0.22, 0.14, 0.14, 0.01);
  CY(g, 0.018, 0.2, steel(), 0.22, 0.04, 0.16);
  RB(g, 0.06, 0.12, 0.08, dark(), 0.22, 0.16, 0.16, 0.02);
  BX(g, 0.045, 0.045, 0.014, brightRed(), 0.22, 0.21, 0.16);
  BX(g, 0.58, 0.38, 0.02, dark(), 0, 0.5, -0.47);
  return g;
}

function pChain(solo) {
  const g = new THREE.Group();
  const chainMat = M(0x525c68, { metalness: 0.92, roughness: 0.32 });
  BX(g, 0.86, 0.08, 0.12, steel(), 0, 2.22, -0.14);
  [-0.28, 0.28].forEach(x => {
    CY(g, 0.22, 0.08, castIron(), x, 2.22, -0.06, 'x');
    TR(g, 0.22, 0.02, steel(), x, 2.22, -0.06, 0, PI / 2);
    CY(g, 0.04, 0.14, chrome(), x, 2.22, -0.06, 'x');
    for (let i = 0; i < 34; i++) {
      const y = i * 0.068 - 0.05;
      const t = put(g, new THREE.TorusGeometry(0.048, 0.014, 8, 14), chainMat, x, y, 0, 0, (i % 2) * PI / 2, 0);
      t.scale.set(1, 1.48, 1);
      CY(g, 0.008, 0.05, chrome(), x, y, 0, 'x');
    }

    BX(g, 0.12, 0.16, 0.09, dark(), x, -0.1, 0);
    CY(g, 0.024, 0.22, chrome(), x, -0.12, 0);
    HX(g, 0.04, 0.035, brass(), x, -0.18, 0, 'y');
    HX(g, 0.04, 0.035, brass(), x, -0.22, 0, 'y');
    CY(g, 0.006, 0.06, steel(), x, -0.25, 0, 'x');
  });
  return g;
}
