/* js/3d/parts-gas-controls.js — 3D ชิ้นส่วน: ระบบแก๊ส LPG และชุดควบคุม Walkie stacker */
function pGasTank(solo) {
  const g = new THREE.Group();
  const tankMat = M(0xc8d1da, { metalness: 0.65, roughness: 0.35 });
  CY(g, 0.28, 1.08, tankMat, 0, 0, 0, 'x');
  put(g, new THREE.SphereGeometry(0.28, 28, 18), tankMat, -0.54, 0, 0);
  put(g, new THREE.SphereGeometry(0.28, 28, 18), tankMat, 0.54, 0, 0);
  TR(g, 0.284, 0.012, steel(), -0.35, 0, 0, 0, PI / 2);
  TR(g, 0.284, 0.012, steel(), 0.35, 0, 0, 0, PI / 2);
  TR(g, 0.23, 0.038, steel(), 0.66, 0, 0, 0, PI / 2);
  BX(g, 0.08, 0.26, 0.04, steel(), 0.62, 0.16, 0);
  BX(g, 0.08, 0.26, 0.04, steel(), 0.62, -0.16, 0);
  TR(g, 0.23, 0.038, steel(), -0.66, 0, 0, 0, PI / 2);
  BX(g, 0.06, 0.08, 0.04, brightRed(), -0.66, 0.23, 0);
  CY(g, 0.048, 0.14, brass(), 0.64, 0.04, 0, 'x');
  TR(g, 0.055, 0.016, warningYellow(), 0.72, 0.04, 0, 0, PI / 2);
  HX(g, 0.032, 0.08, brass(), 0.58, 0.14, 0.08, 'x');
  CY(g, 0.02, 0.03, brightRed(), 0.63, 0.14, 0.08, 'x');
  CY(g, 0.065, 0.04, chrome(), 0.56, -0.08, 0.1, 'x');
  CY(g, 0.058, 0.01, M(0xffffff), 0.585, -0.08, 0.1, 'x');
  BX(g, 0.24, 0.24, 0.01, brightRed(), 0, 0.285, 0);
  BX(g, 0.18, 0.18, 0.012, M(0xffffff), 0, 0.286, 0);
  return g;
}

function pGasSecuring(solo) {
  const g = new THREE.Group();
  const tankMat = M(0x9ca3af, { metalness: 0.5, roughness: 0.5 });
  CY(g, 0.28, 1.05, tankMat, 0, 0, 0, 'x');
  [-0.34, 0.34].forEach(x => {
    BX(g, 0.08, 0.18, 0.72, dark(), x, -0.24, 0);
    TR(g, 0.288, 0.02, rubber(), x, 0, 0, 0, PI / 2);
    TR(g, 0.298, 0.028, warningYellow(), x, 0, 0, 0, PI / 2);
    BX(g, 0.09, 0.12, 0.09, chrome(), x, 0.28, 0.12);
    CY(g, 0.016, 0.18, chrome(), x, 0.34, 0.16);
    SP(g, 0.028, brightRed(), x, 0.44, 0.16);
    CY(g, 0.008, 0.1, chrome(), x, 0.28, 0.06, 'x');
    TR(g, 0.035, 0.008, chrome(), x + 0.05, 0.28, 0.06);
  });
  
  CY(g, 0.02, 0.12, steel(), -0.48, -0.12, 0, 'y');
  return g;
}

function pGasPipeline(solo) {
  const g = new THREE.Group();
  CY(g, 0.28, 0.6, M(0x9ca3af, { metalness: 0.4, roughness: 0.5 }), -0.25, 0, -0.3, 'x');
  const hosePts = [[0.35, 0.04, -0.3], [0.48, 0.12, -0.12], [0.44, 0.06, 0.22], [0.22, -0.12, 0.44]];
  TB(g, hosePts, 0.046, rubber());
  for (let k = 0; k < 12; k++) {
    const t = k / 12;
    const px = 0.35 * (1 - t) + 0.22 * t + Math.sin(t * PI) * 0.15;
    const py = 0.04 * (1 - t) - 0.12 * t;
    const pz = -0.3 * (1 - t) + 0.44 * t;
    TR(g, 0.052, 0.008, warningYellow(), px, py, pz, 0.4, 0.6, 0);
  }

  HX(g, 0.045, 0.08, brass(), 0.35, 0.04, -0.3, 'x');
  CY(g, 0.038, 0.06, brass(), 0.35, 0.04, -0.3, 'z');
  HX(g, 0.05, 0.09, brass(), 0.22, -0.12, 0.44, 'z');
  CY(g, 0.038, 0.08, chrome(), 0.22, -0.12, 0.48, 'z');
  return g;
}

function pGasFittings(solo) {
  const g = new THREE.Group();
  CY(g, 0.075, 0.22, brass(), 0, 0, 0, 'x');
  CY(g, 0.096, 0.09, brass(), -0.05, 0, 0, 'x');
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * PI * 2;
    BX(g, 0.088, 0.012, 0.012, dark(), -0.05, Math.cos(a) * 0.096, Math.sin(a) * 0.096, 0, 0, a);
  }

  TR(g, 0.065, 0.012, rubber(), 0.06, 0, 0, 0, PI / 2);
  for (let t = -2; t <= 2; t++) TR(g, 0.075, 0.007, brass(), t * 0.02, 0, 0, 0, PI / 2);
  CY(g, 0.025, 0.16, steel(), -0.05, 0.12, 0, 'y');
  TR(g, 0.075, 0.018, brightRed(), -0.05, 0.2, 0);
  CY(g, 0.06, 0.05, rubber(), 0.22, 0.12, 0.08, 'x');
  TB(g, [[-0.05, 0.08, 0], [0.1, 0.16, 0.05], [0.22, 0.12, 0.08]], 0.006, steel());
  TB(g, [[0.16, 0, 0], [0.32, -0.08, 0.1], [0.44, -0.18, 0.2]], 0.046, rubber());
  HX(g, 0.062, 0.08, chrome(), 0.14, 0, 0, 'x');
  return g;
}

function pGasLeak(solo) {
  const g = new THREE.Group();
  CY(g, 0.075, 0.24, brass(), 0, 0, 0, 'x');
  HX(g, 0.095, 0.08, brass(), -0.04, 0, 0, 'x');
  CY(g, 0.065, 0.16, chrome(), 0.14, 0, 0, 'x');
  CY(g, 0.02, 0.14, steel(), -0.04, 0.1, 0, 'y');
  TR(g, 0.082, 0.018, brightRed(), -0.04, 0.17, 0);
  const soapMat = GL(0x7dd3fc, 0.45);
  const bubbles = [
    [0.08, 0.08, 0.06, 0.055],
    [0.12, 0.11, 0.03, 0.042],
    [0.06, 0.12, -0.04, 0.048],
    [0.02, 0.09, 0.08, 0.038],
    [0.15, 0.06, 0.07, 0.032],
    [0.1, -0.07, 0.06, 0.045],
    [0.05, -0.09, -0.05, 0.05],
    [-0.02, -0.08, 0.07, 0.035]
  ];
  bubbles.forEach(([bx, by, bz, br]) => {
    put(g, new THREE.SphereGeometry(br, 18, 14), soapMat, bx, by, bz);
    SP(g, br * 0.25, M(0xffffff, { transparent: true, opacity: 0.8 }), bx + br * 0.35, by + br * 0.4, bz + br * 0.4);
  });

  if (solo) {
    const bot = new THREE.Group();
    bot.position.set(-0.45, -0.05, 0.15);
    CY(bot, 0.08, 0.32, GL(0x38bdf8, 0.65), 0, 0, 0);
    CN(bot, 0.035, 0.08, 0.08, GL(0x38bdf8, 0.65), 0, 0.2, 0);
    RB(bot, 0.06, 0.1, 0.14, dark(), 0, 0.28, 0.04, 0.02);
    CY(bot, 0.012, 0.12, dark(), 0, 0.3, 0.15, 'z');
    CY(bot, 0.008, 0.08, brightRed(), 0, 0.24, 0.06, 'y');
    g.add(bot);
  }
  return g;
}

function pGasGauge(solo) {
  const g = new THREE.Group();
  CY(g, 0.16, 0.08, brass(), 0, 0, 0, 'y');
  CY(g, 0.175, 0.04, chrome(), 0, 0.025, 0, 'y');
  CY(g, 0.155, 0.015, M(0xffffff, { roughness: 0.18 }), 0, 0.045, 0, 'y');
  BX(g, 0.06, 0.005, 0.025, brightRed(), 0.06, 0.052, -0.06);
  BX(g, 0.05, 0.005, 0.025, warningYellow(), 0.03, 0.052, -0.08);
  BX(g, 0.09, 0.005, 0.025, M(0x16a34a), -0.04, 0.052, -0.07);
  BX(g, 0.015, 0.006, 0.025, brightRed(), -0.08, 0.052, -0.04);

  const needle = new THREE.Group();
  needle.rotation.y = 0.55;
  BX(needle, 0.012, 0.006, 0.11, dark(), 0, 0.054, -0.045);
  SP(needle, 0.02, dark(), 0, 0.054, 0);
  g.add(needle);
  put(g, new THREE.CylinderGeometry(0.16, 0.16, 0.02, 32), GL(0xf8fafc, 0.3), 0, 0.06, 0);
  TR(g, 0.162, 0.008, rubber(), 0, 0.06, 0, PI / 2);
  return g;
}

function pGeneric() {
  const g = new THREE.Group();
  RB(g, 0.6, 0.4, 0.4, dark(), 0, 0, 0, 0.05);
  CY(g, 0.08, 0.1, M(0xf08a1c), 0, 0.25, 0);
  return g;
}

function pBellyButton(solo) {
  const g = new THREE.Group();
  RB(g, 0.32, 0.28, 0.16, dark(), 0, 0, 0, 0.04);
  RB(g, 0.28, 0.24, 0.02, warningYellow(), 0, 0.04, 0.08, 0.03);
  put(g, new THREE.SphereGeometry(0.095, 24, 14, 0, PI * 2, 0, PI * 0.6), M(0xdc2626, { roughness: 0.2, metalness: 0.15, emissive: 0xef4444, emissiveIntensity: 0.6 }), 0, 0.07, 0.09);
  CY(g, 0.08, 0.04, M(0x991b1b), 0, 0.03, 0.09);
  CY(g, 0.05, 0.12, steel(), 0, -0.16, 0);
  return g;
}

function pEmergencyStop(solo) {
  const g = new THREE.Group();
  RB(g, 0.26, 0.16, 0.2, dark(), 0, 0, 0, 0.04);
  CY(g, 0.03, 0.09, chrome(), 0, 0.06, 0.04);
  CY(g, 0.08, 0.015, warningYellow(), 0, 0.085, 0.04);
  TR(g, 0.078, 0.012, warningYellow(), 0, 0.085, 0.04, PI / 2, 0, 0);
  put(g,
    new THREE.SphereGeometry(0.08, 24, 14, 0, PI * 2, 0, PI * 0.65),
    brightRed(),
    0, 0.12, 0.04
  );
  TR(g, 0.055, 0.008, M(0xffffff), 0, 0.155, 0.04, PI / 2, 0, 0);
  return g;
}

function pTiller(solo) {
  const g = new THREE.Group();
  const arm = M(0x2b3036, { metalness: 0.6, roughness: 0.45 });
  TB(g, [[0, 0, 0], [0, 0.55, 0.1], [0, 1.0, 0.2], [0, 1.2, 0.26]], 0.05, arm);
  RB(g, 0.22, 0.14, 0.3, arm, 0, 1.27, 0.26, 0.05);
  [-1, 1].forEach(s => {
    TR(g, 0.11, 0.026, rubber(), s * 0.15, 1.3, 0.34, PI / 2, 0, 0);
    CY(g, 0.034, 0.16, rubber(), s * 0.15, 1.26, 0.2, 'z');
    SP(g, 0.022, warningYellow(), s * 0.15, 1.36, 0.22);
    BX(g, 0.035, 0.02, 0.06, M(0x2563eb), s * 0.07, 1.35, 0.3);
  });
  [-1, 1].forEach(s => RB(g, 0.05, 0.04, 0.1, brightRed(), s * 0.05, 1.35, 0.14, 0.01));
  CY(g, 0.07, 0.12, castIron(), 0, 0.04, 0.02);
  CY(g, 0.015, 0.03, brass(), 0.07, 0.04, 0.02, 'x');
  return g;
}

function pTillerBrake(solo) {
  const g = new THREE.Group();
  RB(g, 0.28, 0.18, 0.22, castIron(), 0, 0, 0, 0.03);
  CY(g, 0.028, 0.32, chrome(), 0, 0.04, 0, 'x');
  CY(g, 0.008, 0.03, brass(), 0.17, 0.04, 0, 'x');
  const arm = new THREE.Group();
  arm.rotation.x = -0.32;
  CY(arm, 0.026, 0.46, steel(), 0, 0.23, 0);
  for (let k = 0; k < 8; k++) TR(arm, 0.038, 0.008, steel(), 0, 0.1 + k * 0.024, 0, PI / 2, 0, 0);
  CY(arm, 0.14, 0.022, steel(), 0, 0.04, 0, 'x');
  RB(arm, 0.12, 0.08, 0.1, dark(), 0.08, 0.14, 0, 0.02);
  BX(arm, 0.04, 0.06, 0.04, warningYellow(), -0.1, 0.08, 0);
  g.add(arm);
  if (solo) {
    const arc = new THREE.Group();
    arc.position.set(-0.16, 0.04, 0);
    arc.rotation.y = -PI / 2;
    BX(arc, 0.12, 0.28, 0.01, M(0x22c55e, { roughness: 0.4 }), 0, 0.18, 0);
    BX(arc, 0.12, 0.08, 0.012, brightRed(), 0, 0.32, 0);
    BX(arc, 0.12, 0.08, 0.012, brightRed(), 0, 0.04, 0);
    g.add(arc);
  }
  return g;
}
