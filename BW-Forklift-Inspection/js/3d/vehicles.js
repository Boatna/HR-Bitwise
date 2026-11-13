function labelTex(txt, color, italic, w, h, fs) {
  return decalTex((c, W, H) => {
    c.clearRect(0, 0, W, H);
    c.font = (italic ? 'bold italic ' : 'bold ') + (fs || 84) + 'px Kanit, Arial, sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = color || '#ffffff';
    c.fillText(txt, W / 2, H / 2 + 4);
  }, w || 384, h || 128);
}

function newCover(g) {
  const c = new THREE.Group();
  c.userData.cover = true;
  g.add(c);
  return c;
}

function buildBaseCB(g, elec, subtype, has) {
  const frame = () => M(0x2b323a, { metalness: 0.6, roughness: 0.5 });
  const trim = () => M(0x3a4048, { roughness: 0.8, metalness: 0.5 });
  const gray = () => M(0x4a5057, { roughness: 0.55, metalness: 0.3 });
  const gm = () => M(0x383e45, { metalness: 0.55, roughness: 0.5 });
  const fx = elec ? 1.02 : 1.0;

  RB(g, 1.5, 0.42, 1.55, frame(), 0, 0.62, 0.38, 0.05);
  RB(g, 1.2, 0.42, 1.5, frame(), 0, 0.62, -1.15, 0.05);
  CY(g, 0.1, 2.0, dark(), 0, 0.5, 0.9, 'x');
  CY(g, 0.07, 1.6, dark(), 0, 0.42, -1.3, 'x');
  RB(g, 1.3, 0.3, 0.7, frame(), 0, 0.42, 1.3, 0.05);
  RB(g, 1.46, 0.07, 0.5, trim(), 0, 0.81, 0.18, 0.02);
  for (let i = 0; i < 6; i++) BX(g, 1.3, 0.012, 0.03, M(0x555d66), 0, 0.85, -0.02 + i * 0.075);

  RB(g, 2.0, 0.92, 1.1, bodyMat(), 0, 1.26, -1.7, 0.3);
  RB(g, 1.2, 0.5, 0.9, bodyMat(), 0, 0.55, -1.8, 0.1);
  RB(g, 1.0, 0.16, 0.08, rubber(), 0, 0.4, -2.3, 0.02);
  RB(g, 0.3, 0.18, 0.1, steel(), 0, 0.62, -2.32, 0.02);
  decalPlane(g, hazardTex(), 1.2, 0.16, 0, 0.98, -2.258, 0).rotation.y = PI;
  const capTex = capPlateTex(elec ? '2 ตัน' : '2.5 ตัน');
  [-1, 1].forEach(s => decalPlane(g, capTex, 0.62, 0.25, s * 1.005, 1.42, -1.82, s));

  const cover = newCover(g);
  RB(cover, 1.6, 0.4, 1.14, bodyMat(), 0, 1.03, -0.62, 0.1);
  RB(cover, 1.56, 0.5, 1.12, gray(), 0, 1.46, -0.62, 0.1);
  RB(cover, 1.4, 0.04, 1.0, M(0x20262d, { roughness: 0.7, metalness: 0.3 }), 0, 1.71, -0.62, 0.015);
  [-1, 1].forEach(s => {
    for (let i = 0; i < 6; i++) BX(cover, 0.02, 0.28, 0.035, dark(), s * 0.785, 1.4, -1.0 + i * 0.15);
    BX(cover, 0.02, 0.05, 0.9, M(0xfacc15, { roughness: 0.5 }), s * 0.815, 0.9, -0.62);
    CY(cover, 0.085, 0.03, dark(), s * 0.82, 1.0, -0.2, 'x');
  });

  const numTx = labelTex(elec ? '20' : '25', '#ffffff', false, 256, 128, 92);
  [-1, 1].forEach(s => decalPlane(cover, numTx, 0.42, 0.21, s * 0.792, 1.5, -0.45, s));
  RB(g, 1.4, 0.92, 0.55, bodyMat(), 0, 1.04, 0.72, 0.14);
  RB(g, 1.3, 0.06, 0.5, M(0x20262d, { roughness: 0.6, metalness: 0.3 }), 0, 1.53, 0.72, 0.02);
  CY(g, 0.12, 0.1, rubber(), 0, 1.57, 0.5);
  RB(g, 1.1, 0.4, 0.04, dark(), 0, 0.85, 1.0, 0.02);
  for (let i = 0; i < 5; i++) BX(g, 0.9, 0.025, 0.02, M(0x555d66), 0, 0.72 + i * 0.07, 1.025);
  [-1, 1].forEach(s => {
    RB(g, 0.62, 0.1, 1.2, gray(), s * fx, 1.1, 0.9, 0.04);
    RB(g, 0.05, 0.38, 1.2, bodyMat(), s * (fx + 0.3), 0.92, 0.9, 0.02);
    RB(g, 0.55, 0.07, 0.35, trim(), s * 1.0, 0.62, 0.18, 0.02);
    for (let i = 0; i < 4; i++) BX(g, 0.5, 0.012, 0.03, M(0x555d66), s * 1.0, 0.66, 0.06 + i * 0.08);
    RB(g, 0.3, 0.1, 0.3, frame(), s * 0.78, 0.6, 0.18, 0.02);
  });
  if (!elec) {
    RB(g, 0.5, 0.06, 0.9, frame(), -1.25, 0.74, -0.45, 0.02);
    RB(g, 0.7, 0.08, 0.35, frame(), -0.95, 0.74, -0.45, 0.02);
  }

  [-1, 1].forEach(s => {
    RB(g, 0.08, 2.55, 0.08, gm(), s * 0.86, 2.27, 0.6, 0.02, 0.09);
    RB(g, 0.08, 1.83, 0.08, gm(), s * 0.86, 2.64, -1.3, 0.02);
    RB(g, 0.08, 0.08, 1.95, gm(), s * 0.86, 3.55, -0.25, 0.02);
    strap(g, [s * 0.86, 2.2, -1.3], [s * 0.86, 3.5, -0.5], 0.05, 0.05, gm());
  });
  RB(g, 1.82, 0.1, 0.1, gm(), 0, 3.55, 0.8, 0.02);
  RB(g, 1.82, 0.1, 0.1, gm(), 0, 3.55, -1.3, 0.02);
  RB(g, 1.84, 0.05, 2.05, gm(), 0, 3.6, -0.25, 0.02);
  for (let i = 0; i < 5; i++) BX(g, 1.5, 0.012, 0.07, dark(), 0, 3.636, -0.9 + i * 0.35);
  TB(g, [[-0.86, 1.6, 0.55], [-1.02, 1.95, 0.5], [-0.86, 2.5, 0.45]], 0.03, chrome());

  const sUp = String(subtype || '').toLowerCase();
  const isLPG = sUp.includes('lpg') || sUp.includes('petrol');
  if (isLPG) {
    RB(g, 1.3, 0.04, 0.78, dark(), 0, 1.73, -1.75, 0.01);
    if (!has.has('gasTank')) {
      const tankMat = M(0x3f7a57, { metalness: 0.5, roughness: 0.45 });
      CY(g, 0.28, 1.05, tankMat, 0, 2.0, -1.75, 'x');
      SP(g, 0.28, tankMat, -0.525, 2.0, -1.75);
      SP(g, 0.28, tankMat, 0.525, 2.0, -1.75);
      [-0.32, 0.32].forEach(x => {
        BX(g, 0.06, 0.22, 0.68, dark(), x, 1.82, -1.75);
        TR(g, 0.295, 0.024, steel(), x, 2.0, -1.75, 0, PI / 2);
      });
      TR(g, 0.23, 0.035, steel(), 0.64, 2.0, -1.75, 0, PI / 2);
      CY(g, 0.045, 0.12, brass(), 0.62, 2.03, -1.75, 'x');
      TB(g, [[0.58, 2.03, -1.75], [0.68, 1.9, -1.5], [0.65, 1.6, -1.2], [0.45, 1.45, -0.9]], 0.038, rubber());
    }
  } else if (!elec) {
    TB(g, [[0.82, 1.0, -1.7], [1.0, 1.8, -1.55], [1.0, 3.7, -1.45]], 0.048, castIron());
    CY(g, 0.052, 0.06, castIron(), 1.0, 3.72, -1.45);
    BX(g, 0.09, 0.012, 0.08, steel(), 1.0, 3.76, -1.43, 0.25, 0, 0);
    CY(g, 0.065, 0.04, M(0x16a34a, { roughness: 0.4 }), -1.02, 1.35, -1.9, 'x');
    CY(g, 0.045, 2.0, dark(), -1.0, 2.72, -1.45);
    put(g, new THREE.CylinderGeometry(0.11, 0.07, 0.18, 20), GL(0xffffff, 0.6), -1.0, 3.8, -1.45);
    CY(g, 0.12, 0.04, dark(), -1.0, 3.9, -1.45);
  }
}

function buildBaseReachTruck(g, has) {
  const red = () => M(0xe0261b, { roughness: 0.34, metalness: 0.1, envMapIntensity: 0.45 });
  const redDark = () => M(0xb01a12, { roughness: 0.48, metalness: 0.12 });
  const black = () => M(0x171b20, { roughness: 0.62, metalness: 0.22 });
  const black2 = () => M(0x2a3038, { roughness: 0.58, metalness: 0.35 });
  const gray = () => M(0x4a5056, { roughness: 0.55, metalness: 0.35 });
  const steelDark = () => M(0x424b55, { roughness: 0.48, metalness: 0.72 });
  const yellow = () => M(0xf4c928, { roughness: 0.55 });

  RB(g, 1.55, 0.34, 2.85, red(), 0, 0.34, -0.42, 0.11);
  RB(g, 1.64, 0.12, 0.72, black2(), 0, 0.19, 0.73, 0.035);
  RB(g, 1.48, 0.12, 0.62, black2(), 0, 0.19, -1.75, 0.035);
  [-1, 1].forEach(side => {
    RB(g, 0.24, 0.28, 2.75, red(), side * 0.79, 0.31, 0.94, 0.07);
    RB(g, 0.28, 0.18, 0.48, redDark(), side * 0.79, 0.27, 2.15, 0.07);
    RB(g, 0.075, 0.045, 2.25, steelDark(), side * 0.79, 0.49, 0.92, 0.018);
    wheelAt(g, 0.205, 0.15, true, side, side * 0.79, 0.205, 1.82);
    RB(g, 0.19, 0.025, 0.18, yellow(), side * 0.79, 0.455, 2.18, 0.012);
  });

  RB(g, 0.92, 0.38, 0.56, black2(), 0, 0.43, -1.58, 0.08);
  wheelAt(g, 0.39, 0.31, false, 1, 0, 0.39, -1.45);
  RB(g, 1.2, 0.09, 0.08, black(), 0, 0.68, -1.43, 0.025);

  const cover = newCover(g);
  RB(cover, 1.62, 1.48, 1.28, red(), 0, 1.18, -0.42, 0.22);
  RB(cover, 1.48, 0.055, 1.12, redDark(), 0, 1.94, -0.42, 0.025);
  RB(cover, 1.52, 0.16, 1.18, redDark(), 0, 0.47, -0.42, 0.055);
  [-1, 1].forEach(side => {
    RB(cover, 0.035, 1.08, 0.88, redDark(), side * 0.817, 1.14, -0.48, 0.025);
    RB(cover, 0.025, 0.78, 0.62, red(), side * 0.838, 1.23, -0.48, 0.02);
    for (let i = 0; i < 5; i++) CY(cover, 0.045, 0.02, black(), side * 0.848, 0.78 + i * 0.16, -0.9, 'x');
    RB(cover, 0.022, 0.3, 0.3, M(0xf1f5f9, { roughness: 0.6 }), side * 0.85, 1.1, 0.08, 0.008);
    for (let i = 0; i < 3; i++) RB(cover, 0.02, 0.025, 0.3, black2(), side * 0.85, 1.52 + i * 0.07, 0.08, 0.008);
  });

  const numTx = labelTex('20', '#ffffff', true, 256, 128, 96);
  const brandTx = labelTex('MAXUP', '#ffffff', false, 512, 128, 92);
  [-1, 1].forEach(side => {
    decalPlane(cover, numTx, 0.4, 0.2, side * 0.862, 1.62, 0.1, side);
    decalPlane(g, brandTx, 1.0, 0.25, side * 0.915, 0.34, 0.5, side);
  });

  RB(g, 1.0, 0.12, 0.82, black2(), 0, 0.78, 0.38, 0.035);
  RB(g, 0.72, 0.055, 0.58, M(0x3b424a, { roughness: 0.78 }), 0, 0.88, 0.34, 0.02);
  RB(g, 0.52, 0.12, 0.5, black(), 0, 1.0, 0.9, 0.045);
  RB(g, 0.62, 0.18, 0.16, black2(), 0, 1.34, 0.88, 0.045);
  RB(g, 0.62, 0.62, 0.18, black(), 0, 1.67, 0.78, 0.06);
  RB(g, 0.5, 0.08, 0.12, M(0x3c4650, { roughness: 0.75 }), 0, 1.99, 0.78, 0.025);
  RB(g, 0.58, 0.16, 0.58, M(0x111418, { roughness: 0.94 }), 0, 1.34, -0.02, 0.07);
  RB(g, 0.58, 0.66, 0.16, M(0x171b20, { roughness: 0.9 }), 0, 1.72, -0.27, 0.065);
  RB(g, 0.5, 0.035, 0.045, M(0x353c45), 0, 1.95, -0.27, 0.012);
  const col = CY(g, 0.035, 0.48, steelDark(), 0.42, 1.24, 0.42);
  col.rotation.x = -0.38;
  const sw = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.025, 10, 28), black());
  sw.position.set(0.42, 1.48, 0.58); sw.rotation.x = 0.9; g.add(sw);
  CY(g, 0.045, 0.08, steelDark(), 0.42, 1.48, 0.58);
  RB(g, 0.34, 0.1, 0.32, black2(), -0.48, 1.06, 0.2, 0.025);
  [-1, 1].forEach(side => RB(g, 0.035, 0.5, 0.38, steelDark(), side * 0.67, 1.1, 0.25, 0.012));

  const roofY = 3.82;
  [-1, 1].forEach(side => {
    RB(g, 0.095, 2.45, 0.11, gray(), side * 0.79, 2.55, 0.48, 0.025);
    RB(g, 0.095, 2.3, 0.11, gray(), side * 0.79, 2.62, -1.12, 0.025);
    strap(g, [side * 0.79, 1.55, 0.48], [side * 0.79, 3.72, -0.95], 0.045, 0.045, gray());
  });
  RB(g, 1.78, 0.1, 2.02, gray(), 0, roofY, -0.32, 0.06);
  for (let i = 0; i < 9; i++) RB(g, 1.58, 0.02, 0.05, black(), 0, roofY + 0.065, -1.12 + i * 0.22, 0.006);
  [-1, 1].forEach(side => {
    RB(g, 0.075, 2.7, 0.09, black(), side * 0.69, 2.25, -1.72, 0.018);
    RB(g, 0.08, 0.08, 0.12, yellow(), side * 0.69, 3.58, -1.72, 0.012);
  });
  RB(g, 1.42, 0.12, 0.12, black2(), 0, 3.58, -1.72, 0.02);
  [-1, 1].forEach(side => {
    RB(g, 0.11, 0.18, 0.045, M(0xef4444, { emissive: 0x7f1d1d, emissiveIntensity: 0.25 }), side * 0.68, 0.86, -1.78, 0.012);
    RB(g, 0.16, 0.1, 0.12, black(), side * 0.66, 0.36, -1.92, 0.02);
  });
}

function buildBaseWalkieStacker(g, has) {
  const yel = () => M(0xf2b705, { roughness: 0.38, metalness: 0.12, envMapIntensity: 0.35 });
  const yelDark = () => M(0xc99400, { roughness: 0.5, metalness: 0.12, envMapIntensity: 0.35 });
  const blk = () => M(0x16191d, { metalness: 0.15, roughness: 0.6, envMapIntensity: 0.35 });
  const dgray = () => M(0x23282e, { metalness: 0.15, roughness: 0.65, envMapIntensity: 0.35 });
  const pad = () => M(0x0f1216, { roughness: 0.9, metalness: 0 });

  RB(g, 1.0, 0.42, 1.3, blk(), 0, 0.3, -0.28, 0.1);
  RB(g, 0.98, 0.34, 0.12, M(0x14171c, { roughness: 0.9, envMapIntensity: 0.35 }), 0, 0.28, -0.96, 0.04);
  RB(g, 0.9, 0.5, 0.26, blk(), 0, 0.4, 0.42, 0.05);
  RB(g, 0.96, 0.62, 0.08, blk(), 0, 0.74, -0.9, 0.02);

  const cover = newCover(g);
  RB(cover, 0.96, 0.9, 1.1, yel(), 0, 0.97, -0.3, 0.2);
  RB(cover, 0.9, 0.06, 1.0, yelDark(), 0, 1.45, -0.3, 0.02);
  RB(cover, 0.5, 0.06, 0.36, dgray(), 0.2, 1.49, -0.55, 0.01);
  for (let i = 0; i < 4; i++) BX(cover, 0.44, 0.012, 0.03, M(0x555d66), 0.2, 1.525, -0.66 + i * 0.09);
  RB(cover, 0.3, 0.05, 0.2, dark(), -0.22, 1.5, -0.05, 0.01);
  BX(cover, 0.22, 0.01, 0.11, M(0x064e3b, { emissive: 0x059669, emissiveIntensity: 0.6 }), -0.22, 1.53, -0.05);
  CY(cover, 0.035, 0.05, chrome(), 0.2, 1.5, -0.02);
  const modelTx = labelTex('CBD30-460', '#14171c', false, 512, 128, 74);
  [-1, 1].forEach(s => {
    RB(cover, 0.03, 0.55, 0.14, blk(), s * 0.485, 0.9, -0.82, 0.01);
    decalPlane(cover, modelTx, 0.5, 0.125, s * 0.484, 1.1, -0.22, s);
    BX(cover, 0.02, 0.2, 0.2, M(0xf1f5f9, { roughness: 0.6 }), s * 0.485, 0.7, 0.0);
  });
  RB(g, 0.5, 0.22, 0.04, dgray(), 0, 0.62, 0.3, 0.01);
  BX(g, 0.98, 0.03, 1.3, M(0x2d333a, { roughness: 0.6 }), 0, 0.5, -0.28);

  RB(g, 0.8, 0.05, 0.58, blk(), 0, 0.2, -1.26, 0.015);
  for (let i = 0; i < 7; i++) BX(g, 0.7, 0.012, 0.025, M(0x2f353c), 0, 0.235, -1.5 + i * 0.075);
  [-1, 1].forEach(s => RB(g, 0.05, 0.07, 0.12, dgray(), s * 0.34, 0.2, -0.95, 0.01));

  [-1, 1].forEach(s => {
    RB(g, 0.05, 0.05, 0.35, dgray(), s * 0.36, 1.1, -0.98, 0.012);
    RB(g, 0.12, 0.1, 0.62, pad(), s * 0.36, 1.12, -1.4, 0.04);
    CY(g, 0.02, 0.4, dgray(), s * 0.36, 0.92, -0.98);
  });
}

const ESSENTIAL_PARTS = {
  walkie_stacker: ['wheel', 'mast', 'tiller', 'tillerBrake', 'bellyButton', 'emergencyStop', 'lights'],
  reach_truck: ['wheel', 'mast', 'seatbelt', 'steering', 'brake', 'lights'],
  cb: ['wheel', 'mast', 'seatbelt', 'steering', 'brake', 'lights']
};

function buildBase(g, elec, noSeat, subtype, has) {
  has = has || new Set();
  if (subtype === 'reach_truck') buildBaseReachTruck(g, has);
  else if (subtype === 'walkie_stacker') buildBaseWalkieStacker(g, has);
  else buildBaseCB(g, elec, subtype, has);
  const list = ESSENTIAL_PARTS[subtype] || ESSENTIAL_PARTS.cb;
  list.forEach(k => { if (!has.has(k)) placePart(g, k, elec, subtype); });
}