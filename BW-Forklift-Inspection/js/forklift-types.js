const typeInfo = m => {
  if (!m) return { group: 'engine', subtype: 'diesel', icon: '🚜', badge: 'badge-other', label: '' };
  const vt = String(m.vehicleType || '').trim();
  const label = vt || String(m.model || '').trim() || String(m.label || '').trim();
  if (m.group) {
    return {
      group: m.group,
      subtype: m.subtype || (m.group === 'electric' ? 'electric' : 'diesel'),
      icon: m.icon || '🚜',
      badge: m.badge || 'badge-other',
      label
    };
  }

  const combined = (vt + ' ' + (m.model || '') + ' ' + (m.name || '')).toLowerCase();
  if (/walkie|stacker|สแต็กเกอร์|วอล์คกี้/i.test(combined)) {
    return { group: 'electric', subtype: 'walkie_stacker', icon: '⚡', badge: 'badge-walkie', label: label || 'Walkie Stacker (ไฟฟ้า)' };
  }
  if (/reach|รีช/i.test(combined)) {
    return { group: 'electric', subtype: 'reach_truck', icon: '⚡', badge: 'badge-reach', label: label || 'Reach Truck (ไฟฟ้า)' };
  }
  return /ไฟฟ้า|electric/i.test(combined)
    ? { group: 'electric', subtype: 'electric', icon: '⚡', badge: 'badge-elec', label }
    : { group: 'engine', subtype: 'diesel', icon: '⛽', badge: 'badge-gas', label };
};
const forkliftKind = m => typeInfo(m).group;
const model3dOf = m => {
  if (!m) return 'diesel';
  const ki = typeInfo(m);
  if (m.model3d) return m.model3d;
  if (ki.subtype === 'walkie_stacker') return 'walkie_stacker';
  if (ki.group === 'electric') {
    const txt = ((m.vehicleType || '') + ' ' + (m.model || '') + ' ' + (m.name || '')).toLowerCase();
    return (ki.subtype === 'reach_truck' && /reach|รีช/.test(txt)) ? 'reach_truck' : 'electric_cb';
  }
  return ki.subtype || 'diesel';
};
const isElecForklift = m => ['electric_cb', 'reach_truck', 'walkie_stacker'].includes(model3dOf(m));
const FORKLIFT_3D_META = {
  diesel: { family:'รถเครื่องยนต์สันดาป', title:'Counterbalance · Diesel', thai:'โฟล์คลิฟท์เครื่องยนต์ดีเซล', detail:'ถ่วงน้ำหนักท้ายสีส้ม · ฝาครอบเบาะสีเทา · เสายกด้านหน้า', color:0xe8561a },
  'petrol+LPG': { family:'รถเครื่องยนต์สันดาป', title:'Counterbalance · Petrol / LPG', thai:'โฟล์คลิฟท์เบนซิน / LPG', detail:'ถังแก๊ส LPG หลังเบาะ · ถ่วงน้ำหนักท้ายสีส้ม · เสายกด้านหน้า', color:0xe8561a },
  electric_cb: { family:'รถไฟฟ้า', title:'Counterbalance · Electric', thai:'โฟล์คลิฟท์ไฟฟ้าแบบนั่งขับ', detail:'แบตเตอรี่ไฟฟ้า · แบบนั่งขับ · เสายกด้านหน้า', color:0x1686c9 },
  reach_truck: { family:'รถไฟฟ้า', title:'Reach Truck', thai:'รถรีชทรัคไฟฟ้า', detail:'ตัวถังแดง · ขาค้ำยาวด้านหน้า · หลังคาแบนเทา', color:0xe0261b },
  walkie_stacker: { family:'รถไฟฟ้า', title:'Walkie Stacker', thai:'รถแฮนด์พาเลทไฟฟ้าแบบยกสูง', detail:'ตัวถังเหลือง · คันบังคับ · แท่นยืนพับได้ · ชุดยกด้านหน้า', color:0xf2b705 }
};
const forklift3DMeta = m => FORKLIFT_3D_META[model3dOf(m)] || FORKLIFT_3D_META.diesel;