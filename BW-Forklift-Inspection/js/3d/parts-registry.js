/* js/3d/parts-registry.js — 3D: PART_DEFS, placePart, จับคู่จุดตรวจกับชิ้นส่วน */
const WK = 'walkie_stacker', RT = 'reach_truck';
const PART_DEFS = {
  engine:      { build: pEngine,      pos: () => [0, 1.25, -0.55], scale: 0.85 },
  coolant:     { build: pCoolant,     pos: () => [0, 1.17, -1.12], scale: 0.85 },
  brakeFluid:  { build: pBrakeFluid,  pos: () => [0.5, 1.68, 0.62], scale: 0.6 },
  battery:     { build: pBattery,     pos: () => [-1.25, 0.98, -0.45], rot: [0, PI / 2, 0] },
  batteryElec: { build: pBatteryElec,
    pos: (e, sub) => sub === WK ? [-0.1, 1.0, -0.28] : sub === RT ? [-0.3, 1.1, -0.1] : [0, 1.17, -0.62],
    scale: (e, sub) => sub === WK ? 0.5 : sub === RT ? 0.6 : 0.8 },
  terminals:   { build: pTerminals,
    pos: (e, sub) => sub === WK ? [-0.1, 1.35, -0.28] : sub === RT ? [-0.3, 1.5, -0.1] : [0.4, 1.45, -0.62],
    scale: (e, sub) => sub === WK ? 0.5 : sub === RT ? 0.6 : 0.8 },
  chargePlug:  { build: pChargePlug,
    pos: (e, sub) => sub === WK ? [-0.32, 1.2, -0.82] : sub === RT ? [0.78, 1.15, -0.25] : [0.8, 1.05, -0.85],
    rot: (e, sub) => sub === WK ? [0, PI, 0] : [0, PI / 2, 0],
    scale: (e, sub) => sub === WK ? 0.55 : 0.6 },
  hydTank:     { build: pHydTank,
    pos: (e, sub) => sub === WK ? [0.3, 1.0, -0.28] : sub === RT ? [0.4, 1.1, -0.1] : [1.2, 1.12, -0.15],
    scale: (e, sub) => sub === WK ? 0.55 : sub === RT ? 0.6 : 1 },
  mast:        { build: pMast,        pos: (e, sub) => [0, 0, sub === WK ? 0.52 : sub === RT ? 1.0 : 1.65] },
  wheel:       { build: pWheel,       pos: () => [0, 0, 0] },
  hoses:       { build: pHoses,       pos: (e, sub) => [0, 0, sub === WK ? 0.42 : sub === RT ? 1.0 : 1.65],
    scale: (e, sub) => sub === WK ? [0.75, 0.9, 1] : sub === RT ? [0.84, 1.15, 1] : 1 },
  lights:      { build: pLights,      pos: () => [0, 0, 0] },
  brake:       { build: pBrake,       pos: (e, sub) => sub === WK ? [0, 0.62, -0.9] : [0, 0.85, 0.22], scale: (e, sub) => sub === WK ? 0.7 : 1 },
  mirror:      { build: pMirror,      pos: (e, sub) => sub === RT ? [0, 3.0, 0.42] : [0, 2.6, 0.55] },
  steering:    { build: pSteering,    pos: (e, sub) => sub === RT ? [-0.45, 1.72, -0.6] : [0, 1.55, 0.5] },
  seatbelt:    { build: pSeatbelt,    pos: (e, sub) => sub === RT ? [0, 1.7, -1.3] : [0, 2.02, -0.4] },
  chain:       { build: pChain,       pos: (e, sub) => sub === WK ? [0, 0.8, 0.64] : sub === RT ? [0, 1.45, 1.22] : [0, 1.1, 1.9] },
  gasTank:     { build: pGasTank,     pos: () => [0, 2.0, -1.75] },
  gasSecuring: { build: pGasSecuring, pos: () => [-0.45, 2.0, -1.75] },
  gasPipeline: { build: pGasPipeline, pos: () => [0.45, 1.73, -1.35] },
  gasFittings: { build: pGasFittings, pos: () => [0.65, 2.0, -1.75] },
  gasLeak:     { build: pGasLeak,     pos: () => [0.78, 2.0, -1.75] },
  gasGauge:    { build: pGasGauge,    pos: () => [0.35, 2.2, -1.75] },
  bellyButton:   { build: pBellyButton,   pos: () => [0, 1.93, -1.22], rot: [0, PI, 0], scale: 0.6 },
  emergencyStop: { build: pEmergencyStop, pos: () => [0.3, 1.5, -0.55] },
  tiller:        { build: pTiller,        pos: () => [0, 0.6, -0.92], rot: [0, PI, 0] },
  tillerBrake:   { build: pTillerBrake,   pos: () => [0, 0.62, -0.95], rot: [0, PI, 0] },
  generic:     { build: pGeneric,     pos: () => [0, 1.5, 0] }
};

const pv_ = (v, e, sub) => typeof v === 'function' ? v(e, sub) : v;
function placePart(parent, key, elec, sub) {
  const def = PART_DEFS[key] || PART_DEFS.generic;
  const g = def.build(false, { elec, subtype: sub });
  const p = def.pos(elec, sub);
  g.position.set(p[0], p[1], p[2]);
  const r = pv_(def.rot, elec, sub);
  if (r) g.rotation.set(r[0], r[1], r[2]);
  const s = pv_(def.scale, elec, sub);
  if (s) { if (Array.isArray(s)) g.scale.set(s[0], s[1], s[2]); else g.scale.setScalar(s); }
  parent.add(g);
  return g;
}

function internalKeys(elec, sub) {
  if (sub === WK) return new Set(['batteryElec', 'terminals', 'hydTank']);
  if (sub === RT) return new Set(['batteryElec', 'terminals', 'hydTank']);
  return new Set(elec ? ['batteryElec', 'terminals'] : ['engine', 'coolant']);
}

function partKeyFor(it, elec) {
  const t = (it && it.point) || '';
  if (/belly|ป้องกันการชน|ฉุกเฉินกันชน|กันชน/i.test(t)) return 'bellyButton';
  if (/หยุดฉุกเฉิน|emergency.*stop/i.test(t)) return 'emergencyStop';
  if (/คันบังคับ|ด้ามจับ|ปุ่มเดินหน้า|แฮนด์|ปุ่มควบคุม|tiller/i.test(t)) return 'tiller';
  if (/dead-?man/i.test(t)) return 'tillerBrake';
  if (/ขั้วแบต/.test(t)) return 'terminals';
  if (/ปลั๊ก|ชาร์จ/.test(t)) return 'chargePlug';
  if (/น้ำมันเบรค|น้ำมันเบรก|คลัตช์|คลัช|ครัช|คลัทช์/.test(t)) return 'brakeFluid';
  if (/น้ำมันเครื่อง/.test(t)) return 'engine';
  if (/หม้อพักน้ำ|หม้อน้ำ|น้ำยาหล่อเย็น/.test(t)) return 'coolant';
  if (/น้ำกลั่น|แบตเตอรี่|เเบตเตอรี่|แบตเตอร์รี่|เเบตเตอร์รี่/.test(t)) return elec ? 'batteryElec' : 'battery';
  if (/ล้อ.*ไฮดรอลิ[คก]/.test(t)) return 'wheel';
  if (/สายไฮ/.test(t)) return 'hoses';
  if (/ไฮดรอลิค|ไฮดรอลิก/.test(t)) return 'hydTank';
  if (/เสา|งา/.test(t)) return 'mast';
  if (/ล้อ|ยาง/.test(t)) return 'wheel';
  if (/ไฟ|แตร/.test(t)) return 'lights';
  if (/กระจก/.test(t)) return 'mirror';
  if (/พวงมาลัย/.test(t)) return 'steering';
  if (/เข็มขัด|เบาะ/.test(t)) return 'seatbelt';
  if (/โซ่/.test(t)) return 'chain';
  if (/เบรค|เบรก/.test(t)) return 'brake';
  if (/รั่วซึม.*ก๊าซ|รั่วซึม.*แก๊ส/.test(t)) return 'gasLeak';
  if (/มาตรวัด.*ก๊าซ|เกจ.*แก๊ส|เกจ.*ก๊าซ/.test(t)) return 'gasGauge';
  if (/สายส่งก๊าซ|สายส่งแก๊ส|ท่อ.*แก๊ส/.test(t)) return 'gasPipeline';
  if (/ยึดถังก๊าซ|ยึดถังแก๊ส|ล็อกถัง/.test(t)) return 'gasSecuring';
  if (/ข้อต่อ.*ก๊าซ|ข้อต่อ.*แก๊ส|อุปกรณ์เชื่อมต่อ/.test(t)) return 'gasFittings';
  if (/ถังก๊าซ|ถังแก๊ส/.test(t)) return 'gasTank';
  return 'generic';
}
