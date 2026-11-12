/* js/3d/parts-powertrain.js — 3D ชิ้นส่วน: เครื่องยนต์, หม้อน้ำ, เบรคฟลูอิด, แบตเตอรี่, ขั้วแบต, ปลั๊กชาร์จ, ถังไฮดรอลิค */
function pEngine(solo) {
  const g = new THREE.Group();
  RB(g, 0.94, 0.64, 0.96, castIron(), 0, 0, 0, 0.07);
  RB(g, 0.86, 0.16, 0.9, M(0x1f242b, { metalness: 0.6, roughness: 0.4 }), 0, 0.4, 0, 0.04);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) CY(g, 0.024, 0.04, steel(), (i - 1.5) * 0.22, 0.49, j ? 0.32 : -0.32);

  RB(g, 0.76, 0.2, 0.84, dark(), 0, -0.42, 0, 0.05);
  HX(g, 0.03, 0.03, brass(), 0, -0.52, -0.3, 'y');
  CY(g, 0.016, 0.52, steel(), 0.52, 0.16, 0.22);
  TR(g, 0.048, 0.014, warningYellow(), 0.52, 0.43, 0.22, 0, PI / 2);
  CY(g, 0.09, 0.06, warningYellow(), -0.28, 0.5, -0.2);
  CY(g, 0.1, 0.02, dark(), -0.28, 0.46, -0.2);
  CY(g, 0.11, 0.22, brightRed(), -0.54, -0.1, 0.22, 'x');
  HX(g, 0.04, 0.04, steel(), -0.66, -0.1, 0.22, 'x');
  CY(g, 0.22, 0.06, steel(), 0, -0.06, 0.53, 'z');
  CY(g, 0.12, 0.05, steel(), -0.32, 0.22, 0.53, 'z');
  CY(g, 0.14, 0.05, steel(), 0.3, 0.18, 0.53, 'z');
  TR(g, 0.22, 0.02, rubber(), 0, -0.06, 0.53);
  TR(g, 0.12, 0.018, rubber(), -0.32, 0.22, 0.53);
  CY(g, 0.16, 0.26, steel(), -0.32, 0.22, 0.36, 'z');
  CY(g, 0.13, 0.16, copper(), -0.32, 0.22, 0.36, 'z');
  TB(g, [[-0.48, 0.22, 0.32], [-0.64, 0.2, 0.12], [-0.64, 0.1, -0.28], [-0.48, -0.02, -0.48]], 0.055, castIron());

  if (solo) {
    const ds = new THREE.Group();
    ds.position.set(0.72, 0, 0);
    ds.rotation.z = -0.15;
    BX(ds, 0.015, 0.9, 0.004, chrome(), 0, 0, 0);
    TR(ds, 0.045, 0.012, warningYellow(), 0, 0.48, 0, 0, PI / 2);
    CY(ds, 0.02, 0.08, warningYellow(), 0, 0.42, 0);
    BX(ds, 0.018, 0.26, 0.007, M(0xb45309, { roughness: 0.1, metalness: 0.3 }), 0, -0.28, 0);
    BX(ds, 0.028, 0.008, 0.008, brightRed(), 0, -0.17, 0);
    BX(ds, 0.028, 0.008, 0.008, dark(), 0, -0.38, 0);
    g.add(ds);
  }
  return g;
}

function pCoolant(solo) {
  const g = new THREE.Group();
  BX(g, 1.35, 0.9, 0.18, M(0x232830, { metalness: 0.65, roughness: 0.4 }), 0, 0, 0);
  const fin = M(0xb0bac5, { metalness: 0.9, roughness: 0.35 });
  for (let i = -32; i <= 32; i += 2) BX(g, 0.012, 0.82, 0.19, fin, i * 0.0195, 0, 0);
  for (let j = -4; j <= 4; j++) BX(g, 1.28, 0.016, 0.195, steel(), 0, j * 0.09, 0);
  RB(g, 1.42, 0.16, 0.26, castIron(), 0, 0.52, 0, 0.05);
  RB(g, 1.42, 0.16, 0.26, castIron(), 0, -0.52, 0, 0.05);
  CY(g, 0.09, 0.04, brass(), -0.42, 0.63, 0);
  CY(g, 0.06, 0.03, chrome(), -0.42, 0.66, 0);
  BX(g, 0.16, 0.02, 0.04, brass(), -0.42, 0.66, 0);
  TR(g, 0.42, 0.04, dark(), 0, 0, 0.18);
  CY(g, 0.1, 0.06, steel(), 0, 0, 0.18, 'z');
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * PI * 2 + 0.2;
    BX(g, 0.36, 0.1, 0.015, dark(), Math.cos(a) * 0.2, Math.sin(a) * 0.2, 0.18, 0, 0, a);
  }

  const resX = solo ? 0.68 : 0.54, resY = solo ? 0.1 : 0.85;
  RB(g, 0.32, 0.58, 0.24, GL(0xf1f5f9, 0.45), resX, resY, 0.05, 0.05);
  RB(g, 0.28, 0.36, 0.2, M(0x22c55e, { transparent: true, opacity: 0.88, emissive: 0x15803d, emissiveIntensity: 0.5, roughness: 0.2 }), resX, resY - 0.08, 0.05, 0.03);
  CY(g, 0.08, 0.06, warningYellow(), resX, resY + 0.32, 0.05);
  BX(g, 0.33, 0.015, 0.245, brightRed(), resX, resY + 0.12, 0.05);
  BX(g, 0.33, 0.015, 0.245, dark(), resX, resY - 0.18, 0.05);
  TB(g, [[-0.42, 0.6, 0], [-0.1, 0.68, 0.06], [resX, resY + 0.26, 0.05]], 0.022, rubber());
  TB(g, [[0.5, -0.45, 0], [0.65, -0.35, 0.2], [0.65, -0.05, 0.3]], 0.045, rubber());
  HX(g, 0.06, 0.04, steel(), 0.5, -0.45, 0, 'x');
  return g;
}

function pBrakeFluid(solo) {
  const g = new THREE.Group();
  RB(g, 0.72, 0.08, 0.32, castIron(), 0, -0.18, 0, 0.02);
  CY(g, 0.085, 0.58, castIron(), 0, -0.06, 0, 'x');
  CY(g, 0.024, 0.38, chrome(), 0.44, -0.06, 0, 'x');
  for (let k = 0; k < 5; k++) TR(g, 0.045, 0.012, rubber(), 0.28 + k * 0.04, -0.06, 0, 0, PI / 2);
  [-0.19, 0.19].forEach((x, i) => {
    RB(g, 0.24, 0.36, 0.18, GL(0xf8fafc, 0.45), x, 0.14, 0, 0.04);
    RB(g, 0.21, 0.22, 0.15, M(i ? 0xf59e0b : 0xd97706, { transparent: true, opacity: 0.86, emissive: 0x7c2d12, emissiveIntensity: 0.35, roughness: 0.2 }), x, 0.07, 0, 0.03);
    CY(g, 0.088, 0.06, dark(), x, 0.34, 0);
    CY(g, 0.07, 0.01, warningYellow(), x, 0.37, 0);
    BX(g, 0.245, 0.012, 0.185, brightRed(), x, 0.23, 0);
    BX(g, 0.245, 0.012, 0.185, dark(), x, -0.02, 0);
  });

  HX(g, 0.03, 0.04, brass(), -0.32, 0.02, 0.06, 'y');
  HX(g, 0.03, 0.04, brass(), -0.15, 0.02, 0.06, 'y');
  TB(g, [[-0.3, -0.06, 0], [-0.46, -0.22, 0.12], [-0.52, -0.42, 0.32]], 0.022, steel());
  TB(g, [[-0.25, -0.1, 0.05], [-0.42, -0.32, -0.06], [-0.5, -0.52, 0.12]], 0.022, steel());
  return g;
}

function pBattery(solo) {
  const g = new THREE.Group();
  RB(g, 0.66, 0.42, 0.36, M(0x16202e, { roughness: 0.6, metalness: 0.15 }), 0, 0, 0, 0.03);
  for (let k = -2; k <= 2; k++) BX(g, 0.67, 0.36, 0.015, M(0x0f172a), 0, 0, k * 0.065);
  RB(g, 0.68, 0.08, 0.38, M(0x0f172a, { roughness: 0.5, metalness: 0.2 }), 0, 0.23, 0, 0.02);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
    const cx = (i - 1) * 0.18, cz = (j - 0.5) * 0.16;
    CY(g, 0.034, 0.04, warningYellow(), cx, 0.28, cz);
    BX(g, 0.055, 0.015, 0.018, dark(), cx, 0.3, cz);
  }

  CY(g, 0.025, 0.02, chrome(), 0.09, 0.28, 0);
  CY(g, 0.018, 0.022, M(0x22c55e, { emissive: 0x16a34a, emissiveIntensity: 0.6 }), 0.09, 0.285, 0);
  CY(g, 0.03, 0.09, steel(), -0.26, 0.28, -0.1);
  CY(g, 0.03, 0.09, steel(), 0.26, 0.28, -0.1);
  RB(g, 0.085, 0.06, 0.085, brightRed(), -0.26, 0.33, -0.1, 0.015);
  RB(g, 0.085, 0.06, 0.085, dark(), 0.26, 0.33, -0.1, 0.015);
  TB(g, [[-0.34, 0.18, 0], [-0.34, 0.38, 0], [0, 0.44, 0], [0.34, 0.38, 0], [0.34, 0.18, 0]], 0.014, dark());
  if (solo) {
    const hyd = new THREE.Group();
    hyd.position.set(0.68, 0, 0);
    CY(hyd, 0.06, 0.45, GL(0xffffff, 0.6), 0, 0.05, 0);
    put(hyd, new THREE.SphereGeometry(0.09, 18, 14), brightRed(), 0, 0.35, 0);
    CY(hyd, 0.018, 0.28, rubber(), 0, -0.26, 0);
    SP(hyd, 0.022, M(0x22c55e, { emissive: 0x15803d, emissiveIntensity: 0.4 }), 0, 0.12, 0);
    SP(hyd, 0.022, M(0xf8fafc, { emissive: 0x64748b, emissiveIntensity: 0.2 }), 0, 0.04, 0);
    SP(hyd, 0.022, brightRed(), 0, -0.04, 0);

    const bot = new THREE.Group();
    bot.position.set(-0.68, -0.05, 0);
    CY(bot, 0.12, 0.45, GL(0xe0f2fe, 0.7), 0, 0, 0);
    CN(bot, 0.05, 0.12, 0.1, GL(0xe0f2fe, 0.7), 0, 0.27, 0);
    CY(bot, 0.055, 0.05, M(0x0284c7), 0, 0.34, 0);
    TB(bot, [[0, 0.35, 0], [0.05, 0.46, 0], [0.18, 0.42, 0]], 0.014, M(0x0284c7));
    g.add(hyd);
    g.add(bot);
  }
  return g;
}

function pBatteryElec(solo) {
  const g = new THREE.Group();
  RB(g, 1.62, 0.84, 1.42, M(0x232d38, { metalness: 0.7, roughness: 0.4 }), 0, 0, 0, 0.06);
  [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sz]) => {
    BX(g, 0.08, 0.18, 0.08, steel(), sx * 0.76, 0.46, sz * 0.66);
    CY(g, 0.025, 0.1, steel(), sx * 0.76, 0.49, sz * 0.66, 'x');
  });

  RB(g, 1.66, 0.08, 1.46, dark(), 0, 0.44, 0, 0.03);
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 4; j++) {
      const cx = (i - 2.5) * 0.25, cz = (j - 1.5) * 0.32;
      RB(g, 0.23, 0.04, 0.3, M(0x1a202c, { roughness: 0.6 }), cx, 0.46, cz, 0.02);
      CY(g, 0.042, 0.05, M(0xf1f5f9, { roughness: 0.4 }), cx, 0.5, cz);
      CY(g, 0.016, 0.04, M(0x22c55e, { emissive: 0x16a34a, emissiveIntensity: 0.6 }), cx, 0.53, cz);
    }
  }

  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 4; j++) {
      const bx = (i - 2.0) * 0.25, bz = (j - 1.5) * 0.32;
      BX(g, 0.12, 0.022, 0.05, copper(), bx, 0.485, bz);
      BX(g, 0.13, 0.026, 0.055, dark(), bx, 0.49, bz);
    }
  }

  for (let j = 0; j < 4; j++) {
    const tz = (j - 1.5) * 0.32;
    CY(g, 0.012, 1.35, GL(0x38bdf8, 0.6), 0, 0.51, tz, 'x');
  }

  TB(g, [[0.55, 0.48, -0.5], [0.72, 0.68, -0.45], [0.88, 0.62, -0.2], [0.95, 0.3, -0.05]], 0.052, brightRed());
  TB(g, [[0.55, 0.48, -0.2], [0.72, 0.65, -0.2], [0.88, 0.58, 0.0], [0.95, 0.26, 0.1]], 0.052, dark());
  RB(g, 0.16, 0.24, 0.26, brightRed(), 0.98, 0.16, 0.02, 0.04);
  HX(g, 0.04, 0.14, copper(), 1.05, 0.16, 0.08, 'x');
  HX(g, 0.04, 0.14, copper(), 1.05, 0.16, -0.04, 'x');
  BX(g, 0.4, 0.18, 0.01, warningYellow(), 0, 0.2, 0.72);
  return g;
}

function pTerminals(solo) {
  const g = new THREE.Group();
  RB(g, 0.8, 0.12, 0.45, dark(), 0, -0.18, 0, 0.03);
  [[-0.24, 0xdc2626, '+'], [0.24, 0x111827, '-']].forEach(([x, col, sign]) => {
    CY(g, 0.052, 0.22, steel(), x, -0.02, 0);
    RB(g, 0.18, 0.08, 0.16, brass(), x, 0.06, 0, 0.02);
    HX(g, 0.03, 0.05, chrome(), x, 0.06, 0.1, 'z');
    CY(g, 0.016, 0.22, chrome(), x, 0.06, 0, 'z');
    HX(g, 0.03, 0.05, chrome(), x, 0.06, -0.1, 'z');
    RB(g, 0.22, 0.14, 0.2, M(col, { roughness: 0.6 }), x, 0.14, -0.02, 0.04);
    BX(g, 0.06, 0.018, 0.015, M(0xffffff), x, 0.215, -0.02);
    if (sign === '+') BX(g, 0.018, 0.018, 0.06, M(0xffffff), x, 0.215, -0.02);
    CY(g, 0.045, 0.12, copper(), x, 0.06, -0.16, 'z');
    TB(g, [[x, 0.06, -0.22], [x, -0.02, -0.45], [x * 1.3, -0.15, -0.7]], 0.042, M(col, { roughness: 0.7 }));
  });
  return g;
}

function pChargePlug(solo) {
  const g = new THREE.Group();
  RB(g, 0.38, 0.28, 0.48, brightRed(), 0, 0, 0, 0.06);
  TB(g, [[0, 0.14, -0.05], [0, 0.26, -0.05], [0, 0.26, 0.12], [0, 0.14, 0.12]], 0.024, dark());
  [-0.08, 0.08].forEach(x => {
    CY(g, 0.048, 0.28, copper(), x, 0, 0.28, 'z');
    CY(g, 0.032, 0.08, chrome(), x, 0, 0.42, 'z');
  });

  [-0.03, 0.03].forEach(x => CY(g, 0.016, 0.2, brass(), x, 0.06, 0.28, 'z'));
  CY(g, 0.12, 0.16, rubber(), 0, 0, -0.3, 'z');
  TB(g, [[-0.04, 0, -0.35], [-0.08, -0.15, -0.65], [-0.15, -0.35, -0.95]], 0.052, brightRed());
  TB(g, [[0.04, 0, -0.35], [0.08, -0.15, -0.65], [0.15, -0.35, -0.95]], 0.052, dark());
  if (solo) {
    const soc = new THREE.Group();
    soc.position.set(0, 0, 0.82);
    RB(soc, 0.48, 0.38, 0.18, dark(), 0, 0, 0, 0.04);
    [-0.08, 0.08].forEach(x => {
      CY(soc, 0.055, 0.12, M(0x0f172a), x, 0, -0.04, 'z');
      TR(soc, 0.052, 0.01, brass(), x, 0, -0.09);
    });
    CY(soc, 0.022, 0.03, M(0x22c55e, { emissive: 0x16a34a, emissiveIntensity: 0.7 }), 0, 0.13, -0.09, 'z');
    g.add(soc);
  }
  return g;
}

function pHydTank(solo) {
  const g = new THREE.Group();
  RB(g, 0.42, 0.88, 0.94, M(0x0f4c6e, { metalness: 0.6, roughness: 0.38 }), 0, 0, 0, 0.06);
  [-0.24, 0.18].forEach(y => BX(g, 0.44, 0.04, 0.96, M(0x082f49, { metalness: 0.5 }), 0, y, 0));
  const sgX = 0.22, sgY = 0.04, sgZ = 0.22;
  RB(g, 0.06, 0.44, 0.1, steel(), sgX, sgY, sgZ, 0.015);
  CY(g, 0.032, 0.38, GL(0xffffff, 0.65), sgX + 0.02, sgY, sgZ);
  CY(g, 0.026, 0.26, M(0xd97706, { transparent: true, opacity: 0.88, emissive: 0x78350f, emissiveIntensity: 0.4, roughness: 0.2 }), sgX + 0.02, sgY - 0.05, sgZ);
  BX(g, 0.02, 0.008, 0.08, brightRed(), sgX + 0.035, sgY + 0.1, sgZ);
  BX(g, 0.02, 0.008, 0.08, dark(), sgX + 0.035, sgY - 0.12, sgZ);
  CY(g, 0.1, 0.08, dark(), 0, 0.48, -0.2);
  CY(g, 0.08, 0.06, chrome(), 0, 0.55, -0.2);
  BX(g, 0.02, 0.12, 0.12, chrome(), 0, 0.58, -0.2);
  HX(g, 0.04, 0.05, brass(), 0.22, -0.4, 0.28, 'x');
  CY(g, 0.06, 0.1, castIron(), 0, 0.32, 0.45);
  TB(g, [[0, 0.32, 0.45], [0.08, 0.52, 0.52], [-0.1, 0.68, 0.68]], 0.046, rubber());
  return g;
}
