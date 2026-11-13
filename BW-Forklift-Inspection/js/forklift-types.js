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
  diesel: { family:'รถเครื่องยนต์สันดาป', title:'Counterbalance · Toyota 2.5t', thai:'โฟล์คลิฟท์เครื่องยนต์ดีเซล (Toyota 2.5 ตัน)', detail:'ตัวถังส้ม-เทา · เสาดำติดโลโก้ Toyota · กระทะล้อเงินเจาะรู', color:0xe05020 },
  'petrol+LPG': { family:'รถเครื่องยนต์สันดาป', title:'Counterbalance · Toyota 2.5t (LPG)', thai:'โฟล์คลิฟท์เบนซิน / LPG (Toyota 2.5 ตัน)', detail:'ถังแก๊สเขียวแนวนอน · ตัวถังส้ม-เทา · เสาดำติดโลโก้ Toyota', color:0xe05020 },
  electric_cb: { family:'รถไฟฟ้า', title:'Counterbalance · Electric 2t', thai:'โฟล์คลิฟท์ไฟฟ้าแบบนั่งขับ (Toyota 2 ตัน)', detail:'แบตเตอรี่ไฟฟ้า · แบบนั่งขับ · ตัวถังส้ม-เทา · เสายกด้านหน้า', color:0xe05020 },
  reach_truck: { family:'รถไฟฟ้า', title:'Reach Truck · MAXUP 20', thai:'รถรีชทรัคไฟฟ้า (MAXUP 2.0 ตัน)', detail:'ตัวถังแดง MAXUP · ขาค้ำยาวด้านหน้า · ล้อโพลียูรีเทน · ช่องระบายข้างตัวถัง', color:0xcc1824 },
  walkie_stacker: { family:'รถไฟฟ้า', title:'Walkie Stacker · T\'Shandlift', thai:'รถยก/ลากพาเลทไฟฟ้า (CBD30-460)', detail:'ตัวถังเหลือง T\'Shandlift · แท่นยืนพับได้ · แขนกันตกพร้อมเบาะรอง · ปุ่มถอยฉุกเฉินแดง', color:0xf59e0b }
};
const forklift3DMeta = m => FORKLIFT_3D_META[model3dOf(m)] || FORKLIFT_3D_META.diesel;