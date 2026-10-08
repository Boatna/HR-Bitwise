const OFFICIAL_FORM_PADDING = '8mm 12mm 7mm 12mm';
const OFFICIAL_FORM_FONT_MAX_PX = 14;
const OFFICIAL_FORM_FONT_MIN_PX = 9;
const OFFICIAL_FORM_LINE_HEIGHT = 1.55;

const PDF_THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

function formatThaiDateDisplay(dateStr) {
  if (!dateStr) return '';
  const str = String(dateStr).trim();
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const y = parseInt(match[1], 10) + 543;
    return `${match[3]}/${match[2]}/${y}`;
  }
  return str;
}

function formatThaiDateLong(dateStr) {
  if (!dateStr) return '';
  const str = String(dateStr).trim();
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return str;
  return `${parseInt(m[3], 10)} ${PDF_THAI_MONTHS[parseInt(m[2], 10) - 1]} ${parseInt(m[1], 10) + 543}`;
}

function matchIncomeRange(incVal, rangeKey, rangeLabel) {
  if (!incVal) return false;
  const str = String(incVal).trim();
  if (str === rangeKey || str === rangeLabel) return true;
  const num = parseInt(str.replace(/,/g, ''), 10);
  if (!isNaN(num)) {
    if (rangeKey === '1-5000' && num >= 1 && num <= 5000) return true;
    if (rangeKey === '5001-9000' && num >= 5001 && num <= 9000) return true;
    if (rangeKey === '9001-15000' && num >= 9001 && num <= 15000) return true;
    if (rangeKey === '15001-20000' && num >= 15001 && num <= 20000) return true;
    if (rangeKey === '20001-30000' && num >= 20001 && num <= 30000) return true;
    if (rangeKey === '30001-40000' && num >= 30001 && num <= 40000) return true;
    if (rangeKey === '40001+' && num >= 40001) return true;
  }
  return false;
}

const PDF_INDUSTRY_GROUPS = [
  { label: 'การแปรรูปอาหาร', kw: ['อาหาร'] },
  { label: 'การเกษตรและเทคโนโลยีชีวภาพ', kw: ['เกษตร'] },
  { label: 'ท่องเที่ยวกลุ่มรายได้ดีและท่องเที่ยวเชิงสุขภาพ', kw: ['ท่องเที่ยว'] },
  { label: 'อิเล็กทรอนิกส์อัจฉริยะ', kw: ['อิเล็กทรอนิกส์'] },
  { label: 'ยานยนต์สมัยใหม่', kw: ['ยานยนต์'] },
  { label: 'ดิจิตอล', kw: ['ดิจิ'] },
  { label: 'เชื้อเพลิง/เคมีชีวภาพ', kw: ['เชื้อเพลิง', 'เคมีชีวภาพ'] },
  { label: 'ขนส่งและการบิน', kw: ['ขนส่ง', 'การบิน'] },
  { label: 'การแพทย์ครบวงจร', kw: ['แพทย์'] },
  { label: 'หุ่นยนต์เพื่ออุตสาหกรรม', kw: ['หุ่นยนต์'] }
];

function matchIndustryGroup(selected, targetLabel) {
  if (!selected) return false;
  const sel = String(selected).trim();
  const entry = PDF_INDUSTRY_GROUPS.find(g => g.label === targetLabel);
  if (!entry) return false;
  return sel === entry.label || entry.kw.some(k => sel.includes(k));
}

function pdfAbsoluteUrl(path) {
  try { return new URL(path, document.baseURI).href; } catch (e) { return path; }
}

const OFFICIAL_FORM_CSS = `
#official-form-printable{font-family:'Sarabun','TH Sarabun PSK','Angsana New',sans-serif;font-size:13px;line-height:1.55;color:#000;background:#fff;display:flex;flex-direction:column;box-sizing:border-box;overflow:hidden;text-align:left;}
#official-form-printable *{box-sizing:border-box;}
#official-form-printable .of-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:.45em;}
#official-form-printable .of-side{flex:none;width:27mm;height:31mm;display:flex;align-items:center;}
#official-form-printable .of-side-r{justify-content:flex-end;}
#official-form-printable .of-logo{height:25mm;width:auto;max-width:27mm;object-fit:contain;display:block;}
#official-form-printable .of-title{flex:1 1 auto;text-align:center;font-weight:700;font-size:1.32em;line-height:1.4;padding:0 2mm;}
#official-form-printable .of-photo{width:25mm;height:31mm;border:1px solid #333;overflow:hidden;display:flex;align-items:center;justify-content:center;text-align:center;font-size:.72em;line-height:1.3;color:#555;}
#official-form-printable .of-photo-empty{border:1px dashed #777;}
#official-form-printable .of-photo img{width:100%;height:100%;object-fit:cover;display:block;}
#official-form-printable .of-b{font-weight:700;}
#official-form-printable .of-row{display:flex;align-items:baseline;}
#official-form-printable .of-l{flex:none;white-space:nowrap;margin-right:.35em;}
#official-form-printable .of-v{flex:1 1 auto;min-width:2em;border-bottom:1px dotted #222;padding:0 .3em;margin-right:.5em;font-weight:600;line-height:1.2;overflow-wrap:anywhere;}
#official-form-printable .of-v:last-child{margin-right:0;}
#official-form-printable .of-b .of-v{font-weight:700;}
#official-form-printable .of-i{display:inline-block;border-bottom:1px dotted #222;padding:0 .3em;font-weight:600;line-height:1.2;vertical-align:baseline;text-align:left;}
#official-form-printable .of-hang{display:flex;align-items:flex-start;}
#official-form-printable .of-opts{flex:1 1 0;min-width:0;}
#official-form-printable .of-ind{padding-left:5mm;}
#official-form-printable .of-ind2{padding-left:13mm;}
#official-form-printable .of-opt{display:inline-block;white-space:nowrap;margin-right:.85em;}
#official-form-printable .of-opt.w{display:inline;white-space:normal;}
#official-form-printable .of-cb{display:inline-block;width:.78em;height:.78em;border:.09em solid #000;border-radius:.05em;box-shadow:.07em .07em 0 #000;position:relative;vertical-align:-.05em;margin-right:.4em;}
#official-form-printable .of-rb{margin-right:.3em;}
#official-form-printable .of-rbm{display:inline-block;width:.78em;height:.78em;position:relative;vertical-align:-.1em;}
#official-form-printable .of-cb.on::after,#official-form-printable .of-rbm.on::after{content:'';position:absolute;left:.22em;top:-.14em;width:.3em;height:.6em;border:solid #000;border-width:0 .13em .13em 0;transform:rotate(45deg);}
#official-form-printable .of-spacer{flex:1 1 auto;min-height:2mm;}
#official-form-printable .of-sign{display:flex;border:1px solid #000;}
#official-form-printable .of-sign>div{padding:2.2mm 3mm;}
#official-form-printable .of-sign>div:first-child{width:48%;border-right:1px solid #000;}
#official-form-printable .of-sign>div:last-child{width:52%;}
`;

function renderOfficialFormHTML(data) {
  const d = data || {};
  const esc = escapeHtml;
  const txt = v => (v === undefined || v === null) ? '' : String(v).trim();
  const arr = v => Array.isArray(v) ? v : (v ? String(v).split(',').map(s => s.trim()).filter(Boolean) : []);
  const L = (t, style) => `<span class="of-l"${style ? ` style="${style}"` : ''}>${t}</span>`;
  const V = (v, grow, minEm, nowrap) => {
    const s = txt(v);
    return `<span class="of-v" style="flex-grow:${grow || 1};min-width:${minEm || 2}em;${nowrap ? 'white-space:nowrap;' : ''}">${s ? esc(s) : '&nbsp;'}</span>`;
  };
  const I = (v, em) => {
    const s = txt(v);
    return `<span class="of-i" style="min-width:${em || 8}em;">${s ? esc(s) : '&nbsp;'}</span>`;
  };
  const ROW = (...p) => `<div class="of-row">${p.join('')}</div>`;
  const CB = on => `<span class="of-cb${on ? ' on' : ''}"></span>`;
  const OPT = (on, t, cls) => `<span class="of-opt${cls ? ' ' + cls : ''}">${CB(on)}${t}</span>`;
  const RB = (on, t) => `<span class="of-opt"><span class="of-rb">(<span class="of-rbm${on ? ' on' : ''}"></span>)</span>${t}</span>`;
  const objectives = arr(d.objectives);
  const tests = arr(d.tests);
  const applicantTypes = arr(d.applicantTypes);
  const disabilities = arr(d.disabilities);
  const photoSrc = d.photoDataUrl || d.photoUrl || '';

  const isEmployed = d.employmentStatus === 'employed';
  const isUnemployed = d.employmentStatus === 'unemployed';
  const sector = isEmployed ? d.workSector : '';
  const isPrivate = sector === 'private';
  const isStateEnt = sector === 'state_enterprise';
  const isGovt = sector === 'government';
  const isBusiness = sector === 'business';
  const govtType = txt(d.govtType);
  const freelanceType = txt(d.freelanceType);

  const fullName = [d.title, d.firstName, d.lastName].map(txt).filter(Boolean).join(' ');
  const startLong = formatThaiDateLong(d.startDate);
  const endLong = formatThaiDateLong(d.endDate);
  const period = (startLong && endLong) ? `${startLong} ถึง ${endLong}` : startLong;

  const incRanges = [
    { label: '1 - 5,000', val: '1-5000' },
    { label: '5,001 - 9,000', val: '5001-9000' },
    { label: '9,001 - 15,000', val: '9001-15000' },
    { label: '15,001 - 20,000', val: '15001-20000' },
    { label: '20,001 - 30,000', val: '20001-30000' },
    { label: '30,001 - 40,000', val: '30001-40000' },
    { label: '40,001 บาทขึ้นไป', val: '40001+' }
  ];
  const incOpt = r => OPT(isEmployed && matchIncomeRange(d.monthlyIncome, r.val, r.label),
    r.val === '40001+' ? r.label : `${r.label} บาท`);

  const industryOpt = g => OPT(isEmployed && matchIndustryGroup(d.industryGroup, g.label), g.label);

  const disabilityList = [
    'การเห็น',
    'การได้ยินหรือสื่อความหมาย',
    'การเคลื่อนไหวหรือทางร่างกาย',
    'ทางจิตใจหรือพฤติกรรม',
    'ทางสติปัญญา',
    'การเรียนรู้',
    'ทางออทิสติก'
  ];

  const knownUnemployed = ['อยู่ระหว่างหางาน', 'อยู่ในระหว่างหางาน', 'นักเรียน/นักศึกษา', 'ผู้ประกันตนที่ถูกเลิกจ้าง', 'ผู้ต้องขัง', 'ทหารก่อนปลด'];
  const unReason = isUnemployed ? txt(d.unemployedReason) : '';
  const unOther = unReason && !knownUnemployed.includes(unReason) ? unReason : '';

  const infoSrc = txt(d.infoSource);
  const srcTv = infoSrc === 'โทรทัศน์';
  const srcRadio = infoSrc === 'วิทยุ';
  const srcPaper = infoSrc === 'หนังสือพิมพ์';
  const srcOnline = infoSrc.includes('ออนไลน์');
  const srcOther = infoSrc && !(srcTv || srcRadio || srcPaper || srcOnline) ? infoSrc : '';

  const consentYes = d.pdpaConsent === true || d.pdpaConsent === 'ยินยอม' || d.pdpaConsent === 'yes' || d.pdpaConsent === 'true';
  const consentNo = d.pdpaConsent === false || d.pdpaConsent === 'ไม่ยินยอม' || d.pdpaConsent === 'no';

  let sd = String(d.submittedAtDate || '').split('/');
  if (sd.length !== 3) {
    const alt = formatThaiDateDisplay(String(d.submittedAt || '').slice(0, 10));
    sd = alt && alt.split('/').length === 3 ? alt.split('/') : ['', '', ''];
  }

  const logoUrl = esc(pdfAbsoluteUrl('assets/dsd-logo.png'));
  const logoFallback = esc(pdfAbsoluteUrl('assets/BW-HR.png'));
  const photoBox = photoSrc
    ? `<div class="of-photo"><img src="${esc(photoSrc)}" alt="" onerror="this.style.display='none'"></div>`
    : `<div class="of-photo of-photo-empty">รูปถ่าย<br>1-1.5 นิ้ว</div>`;

  const c1 = 'width:36mm;';
  const c2 = 'width:34mm;';

  return `
  <div id="official-form-printable" style="width:210mm;height:297mm;padding:${OFFICIAL_FORM_PADDING};">
    <style>${OFFICIAL_FORM_CSS}</style>

    <div class="of-head">
      <div class="of-side"><img class="of-logo" src="${logoUrl}" alt="" onerror="if(!this.dataset.fb){this.dataset.fb='1';this.src='${logoFallback}';}else{this.style.visibility='hidden';}"></div>
      <div class="of-title">ใบสมัครเข้ารับการฝึกอบรมฝีมือแรงงาน/ทดสอบมาตรฐานฝีมือแรงงาน</div>
      <div class="of-side of-side-r">${photoBox}</div>
    </div>

    <div class="of-row of-b">${L('กรมพัฒนาฝีมือแรงงาน กระทรวงแรงงาน หน่วยงาน:')}${V(d.agency || 'ศูนย์ทดสอบมาตรฐานฝีมือแรงงาน ทาซากิ เทรนนิ่ง เซ็นเตอร์', 1, 6)}</div>

    <div class="of-hang">
      ${L('ข้าพเจ้ามีความประสงค์เข้ารับ', c1)}${L('การฝึกอบรมฝีมือแรงงาน', c2)}
      <div class="of-opts">
        ${OPT(objectives.includes('ฝึกเตรียมเข้าทำงาน'), 'ฝึกเตรียมเข้าทำงาน')}${OPT(objectives.includes('ฝึกยกระดับฝีมือแรงงาน'), 'ฝึกยกระดับฝีมือแรงงาน')}${OPT(objectives.includes('ฝึกอาชีพเสริม'), 'ฝึกอาชีพเสริม')}${OPT(objectives.includes('ฝึกคนครัวบนเรือ'), 'ฝึกคนครัวบนเรือ')}
      </div>
    </div>
    <div class="of-hang">
      ${L('&nbsp;', c1)}${L('การทดสอบฝีมือแรงงาน', c2)}
      <div class="of-opts">${OPT(tests.includes('ทดสอบมาตรฐานฝีมือแรงงานแห่งชาติ'), 'ทดสอบมาตรฐานฝีมือแรงงานแห่งชาติ')}</div>
    </div>

    ${ROW(L('หลักสูตร (ฝึกอบรม)'), V(d.course, 6, 8), L('จำนวนชั่วโมงฝึก'), V(d.trainingHours, 1, 3), L('ชั่วโมง'))}
    ${ROW(L('สาขา (ทดสอบ)'), V(d.branch, 4, 8), L('ระดับ (ทดสอบ)'), V(d.level, 2, 5))}
    <div class="of-hang">
      ${L('ประเภทผู้สมัคร (ทดสอบ)')}
      <div class="of-opts">
        ${OPT(applicantTypes.includes('ผู้รับการฝึกจาก กพร.'), 'ผู้รับการฝึกจาก กพร.')}${OPT(applicantTypes.includes('จากสถานศึกษา'), 'จากสถานศึกษา')}${OPT(applicantTypes.includes('จากภาครัฐ'), 'จากภาครัฐ')}${OPT(applicantTypes.includes('จากเอกชน') || applicantTypes.includes('จากภาคเอกชน'), 'จากภาคเอกชน')}${OPT(applicantTypes.includes('บุคคลทั่วไป'), 'บุคคลทั่วไป')}
      </div>
    </div>
    ${ROW(L('ระหว่างวันที่'), `<span class="of-v" style="flex:0 1 60%;min-width:8em;">${period ? esc(period) : '&nbsp;'}</span>`)}

    <div class="of-b" style="margin-top:.2em;">1. ข้อมูลส่วนบุคคล</div>
    ${ROW(L('ชื่อ-สกุล ภาษาไทย (นาย/นาง/นางสาว)'), V(fullName, 6, 8), L('เพศ'), V(d.gender, 1.2, 3))}
    ${ROW(L('ชื่อ-สกุล ภาษาอังกฤษ'), V(d.fullNameEn, 1, 8))}
    ${ROW(L('เลขบัตรประชาชน'), V(d.idCard, 2.2, 9.5, true), L('สัญชาติ'), V(d.nationality || 'ไทย', 0.6, 2.5, true), L('วัน/เดือน/ปีเกิด'), V(formatThaiDateDisplay(d.birthDate), 1.2, 6, true), L('โทรศัพท์'), V(formatPhoneNumber(d.phone), 1.2, 6, true), L('อีเมล (ถ้ามี)'), V(d.email, 2, 5))}
    ${ROW(L('ที่อยู่ตามทะเบียนบ้าน/ที่อยู่ตามบัตรประชาชน เลขที่'), V(cleanAddressNo(d.addressNo), 1, 3), L('หมู่'), V(d.moo, 0.6, 2), L('ถนน'), V(d.street, 2, 4), L('ซอย'), V(d.soi, 2, 4))}
    ${ROW(L('แขวง/ตำบล'), V(d.subdistrict, 2, 5), L('เขต/อำเภอ'), V(d.district, 2, 5), L('จังหวัด'), V(d.province, 2, 5), L('รหัสไปรษณีย์'), V(d.zipcode, 1, 3.5))}
    <div class="of-hang">
      ${L('วุฒิการศึกษาสูงสุด')}
      <div class="of-opts">
        ${['ประถมศึกษา', 'มัธยมต้น', 'มัธยมปลาย', 'อนุปริญญา', 'ปวช.', 'ปวส./ปวท.', 'ปริญญาตรีขึ้นไป', 'ไม่จบการศึกษา'].map(e => OPT(d.education === e, e)).join('')}
      </div>
    </div>
    ${ROW(L('สาขา'), V(d.educationMajor, 1, 10))}
    <div class="of-hang">
      ${L('สภาพร่างกาย', 'width:22mm;')}${OPT(d.bodyCondition === 'ปกติ', 'ปกติ')}${OPT(d.bodyCondition === 'พิการ', 'พิการ (')}
      <div class="of-opts">
        ${disabilityList.map((x, i) => OPT(d.bodyCondition === 'พิการ' && disabilities.includes(x), x + (i === disabilityList.length - 1 ? ')' : ''))).join('')}
      </div>
    </div>

    <div class="of-hang" style="margin-top:.1em;">
      ${L('<span class="of-b">2. สถานภาพแรงงาน</span>')}
      <div class="of-opts">${OPT(isEmployed, 'ทำงาน (กรอกข้อ 2.1)')}<span style="display:inline-block;width:1.2em;"></span>${OPT(isUnemployed, 'ไม่ทำงานหรือว่างงาน (กรอกข้อ 2.2)')}</div>
    </div>

    <div class="of-hang of-ind">
      ${L('<span class="of-b">2.1 ผู้มีงานทำ</span>')}
      <div class="of-opts">
        <div>${OPT(isPrivate, 'ภาคเอกชน')}${OPT(isStateEnt, 'รัฐวิสาหกิจ')}${OPT(isGovt, 'ภาครัฐ')}${RB(isGovt && govtType === 'ข้าราชการพลเรือน', 'ข้าราชการพลเรือน')}${RB(isGovt && govtType === 'ข้าราชการตำรวจ', 'ข้าราชการตำรวจ')}${RB(isGovt && govtType === 'ข้าราชการทหาร', 'ข้าราชการทหาร')}${RB(isGovt && govtType === 'ข้าราชการครู', 'ข้าราชการครู')}</div>
        <div>${OPT(isBusiness, 'ประกอบธุรกิจส่วนตัว/ประกอบอาชีพอิสระ')}${RB(isBusiness && freelanceType === 'วิสาหกิจชุมชน', 'วิสาหกิจชุมชน')}${RB(isBusiness && freelanceType === 'เกษตรกร', 'เกษตรกร')}${RB(isBusiness && Boolean(freelanceType) && (freelanceType.includes('Freelance') || freelanceType.includes('ผู้รับจ้าง') || freelanceType.includes('ผู้จ้าง')), 'ผู้รับจ้างทั่วไปโดยไม่มีนายจ้าง (Freelance)')}</div>
      </div>
    </div>
    <div class="of-hang of-ind">
      ${L('รายได้เฉลี่ยต่อเดือน')}
      <div class="of-opts">
        <div>${incRanges.slice(0, 5).map(incOpt).join('')}</div>
        <div>${incRanges.slice(5).map(incOpt).join('')}</div>
      </div>
    </div>
    <div class="of-ind">${ROW(L('อาชีพ'), V(isEmployed ? d.occupation : '', 3, 6), L('ตำแหน่ง'), V(isEmployed ? d.position : '', 3, 6), L('อายุงาน'), V(isEmployed ? d.workExperienceYears : '', 1, 3), L('ปี'))}</div>
    <div class="of-ind">${ROW(L('สถานที่ทำงาน ชื่อหน่วยงาน'), V(isEmployed ? d.workplaceName : '', 3, 8), L('จังหวัด'), V(isEmployed ? d.workplaceProvince : '', 2, 5), L('โทรศัพท์'), V(isEmployed ? formatPhoneNumber(d.workplacePhone) : '', 2, 6))}</div>
    <div class="of-ind">
      <div>${L('กลุ่มอุตสาหกรรมที่ทำงาน')}${PDF_INDUSTRY_GROUPS.slice(0, 3).map(industryOpt).join('')}</div>
      <div>${PDF_INDUSTRY_GROUPS.slice(3).map(industryOpt).join('')}</div>
    </div>
    <div class="of-hang of-ind">
      ${L('<span class="of-b">2.2 ผู้ที่ไม่มีงานทำ</span>')}
      <div class="of-opts">
        ${OPT(unReason === 'อยู่ระหว่างหางาน' || unReason === 'อยู่ในระหว่างหางาน', 'อยู่ระหว่างหางาน')}${OPT(unReason === 'นักเรียน/นักศึกษา', 'นักเรียน/นักศึกษา')}${OPT(unReason === 'ผู้ประกันตนที่ถูกเลิกจ้าง', 'ผู้ประกันตนที่ถูกเลิกจ้าง')}${OPT(unReason === 'ผู้ต้องขัง', 'ผู้ต้องขัง')}${OPT(unReason === 'ทหารก่อนปลด', 'ทหารก่อนปลด')}${OPT(Boolean(unOther), `อื่น ๆ ระบุ ${I(unOther, 9)}`, 'w')}
      </div>
    </div>

    <div class="of-hang">
      ${L('<span class="of-b">3. แหล่งที่ทราบการฝึก</span>')}
      <div class="of-opts">
        ${OPT(srcTv, 'โทรทัศน์')}${OPT(srcRadio, 'วิทยุ')}${OPT(srcPaper, 'หนังสือพิมพ์')}${OPT(srcOnline, 'สื่อออนไลน์ของหนังสือพิมพ์ วิทยุ หรือ โทรทัศน์ ทั้งสื่อส่วนกลางและสื่อท้องถิ่น', 'w')}${srcOther ? OPT(true, `อื่น ๆ ระบุ ${I(srcOther, 6)}`, 'w') : ''}
      </div>
    </div>

    <div><span class="of-b">4. การเปิดเผยข้อมูลส่วนบุคคล</span> ข้าพเจ้าได้อ่านและรับทราบนโยบายการคุ้มครองข้อมูลส่วนบุคคลของกรมพัฒนาฝีมือแรงงานแล้วและ</div>
    <div class="of-ind2">${OPT(consentYes, 'ยินยอมเปิดเผยข้อมูลส่วนบุคคลเพื่อใช้ประโยชน์ในการเชื่อมโยงและบูรณาการข้อมูลกับหน่วยงานภาครัฐ', 'w')}</div>
    <div class="of-ind2">${OPT(consentNo, 'ไม่ยินยอมเปิดเผยข้อมูลส่วนบุคคล')}</div>
    <div>ท่านมีความประสงค์จะให้กรมการจัดหางาน หางานให้เมื่อผ่านการฝึกอบรมฝีมือแรงงาน/การทดสอบมาตรฐานฝีมือแรงงาน</div>
    <div class="of-ind2">${OPT(d.jobAssist === 'not_needed', 'ไม่ต้องการ')}${OPT(d.jobAssist === 'domestic', `ต้องการจัดหางานในประเทศ ตำแหน่ง ${I(d.jobAssist === 'domestic' ? d.jobPosition : '', 11)} ของอุตสาหกรรม ${I(d.jobAssist === 'domestic' ? d.jobIndustry : '', 11)}`, 'w')}</div>
    <div class="of-ind2">${OPT(d.jobAssist === 'overseas', `ต้องการจัดหางานในต่างประเทศ ประเทศที่จะไปทำงาน ${I(d.jobAssist === 'overseas' ? d.jobCountry : '', 14)}`, 'w')}</div>

    <div class="of-spacer"></div>

    <div class="of-sign">
      <div>
        <div>(เฉพาะเจ้าหน้าที่) ตรวจสอบข้อมูลข้างต้นจากฐานข้อมูลในระบบ</div>
        <div>และหลักฐานตัวจริงเรียบร้อยแล้ว</div>
        ${ROW(L('เจ้าหน้าที่รับสมัคร'), V('', 1, 6))}
        ${ROW(L('วันที่รับสมัคร'), V('', 1, 2), L('/'), V('', 1, 2), L('/'), V('', 1.3, 3))}
      </div>
      <div>
        <div>ข้าพเจ้าขอรับรองว่าข้อความข้างต้นเป็นจริงทุกประการ</div>
        <div>&nbsp;</div>
        ${ROW(L('ลงชื่อ'), V('', 1, 8), L('ผู้สมัคร'))}
        ${ROW(L('วันที่'), V(sd[0], 1, 2), L('/'), V(sd[1], 1, 2), L('/'), V(sd[2], 1.3, 3))}
      </div>
    </div>
  </div>
  `;
}

function mmToPx(mm) {
  return mm * 96 / 25.4;
}

function fitOfficialFormToA4(element, opts) {
  if (!element) return;
  const options = opts || {};
  const minFontPx = options.minFontPx || OFFICIAL_FORM_FONT_MIN_PX;
  const maxFontPx = options.maxFontPx || OFFICIAL_FORM_FONT_MAX_PX;
  const step = options.step || 0.1;
  const lineHeight = options.lineHeight || OFFICIAL_FORM_LINE_HEIGHT;
  const targetHeightPx = mmToPx(297) - 1;

  element.style.height = 'auto';
  element.style.maxHeight = 'none';
  element.style.overflow = 'visible';

  let fontPx = maxFontPx;
  for (let i = 0; i < 120; i++) {
    element.style.fontSize = fontPx + 'px';
    element.style.lineHeight = String(lineHeight);
    const h = element.getBoundingClientRect().height;
    const fitsWidth = element.scrollWidth <= element.clientWidth + 1;
    if ((h <= targetHeightPx && fitsWidth) || fontPx <= minFontPx) break;
    fontPx = Math.max(minFontPx, Math.round((fontPx - step) * 100) / 100);
  }

  element.style.height = '297mm';
  element.style.maxHeight = '297mm';
  element.style.overflow = 'hidden';
  return fontPx;
}

function lockA4Layout(element) {
  if (!element) return;
  element.style.position = 'relative';
  element.style.left = '0';
  element.style.top = '0';
  element.style.width = '210mm';
  element.style.maxWidth = '210mm';
  element.style.height = '297mm';
  element.style.maxHeight = '297mm';
  element.style.margin = '0';
  element.style.boxShadow = 'none';
  element.style.padding = OFFICIAL_FORM_PADDING;
  element.style.fontSize = OFFICIAL_FORM_FONT_MAX_PX + 'px';
  element.style.lineHeight = String(OFFICIAL_FORM_LINE_HEIGHT);
  element.style.boxSizing = 'border-box';
  element.style.overflow = 'hidden';
}

const A4_WIDTH_PX = Math.round(mmToPx(210));
const A4_HEIGHT_PX = Math.round(mmToPx(297));
function buildHtml2CanvasOptions(element, extra) {
  const rect = element ? element.getBoundingClientRect() : null;
  const widthPx = (rect && Math.ceil(rect.width)) || A4_WIDTH_PX;
  const heightPx = (rect && Math.ceil(rect.height)) || A4_HEIGHT_PX;
  return Object.assign({
    scale: 3,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    width: widthPx,
    height: heightPx,
    windowWidth: widthPx,
    windowHeight: heightPx,
    scrollX: 0,
    scrollY: 0
  }, extra || {});
}

function waitForLayoutSettle() {
  return new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

async function resolveApplicantPhotoForRender(applicantData) {
  const d = Object.assign({}, applicantData);
  if (d.photoDataUrl) return d;

  const webAppUrl = (typeof getGasWebAppUrl === 'function' ? getGasWebAppUrl() : '') || (typeof GAS_WEB_APP_URL !== 'undefined' ? GAS_WEB_APP_URL : '');

  if (!d.photoUrl) {
    d.photoLoadError = 'ไม่พบลิงก์รูปถ่ายในข้อมูลผู้สมัคร (การอัปโหลดรูปขึ้น Google Drive ไม่สำเร็จตอนสมัคร)';
    return d;
  }

  if (d.photoUrl &&
      webAppUrl &&
      typeof extractDriveFileId === 'function' &&
      typeof fetchFileAsDataUri === 'function') {
    try {
      const fileId = extractDriveFileId(d.photoUrl);
      if (fileId) {
        const dataUri = await fetchFileAsDataUri(webAppUrl, fileId);
        if (dataUri) {
          d.photoDataUrl = dataUri;
        } else {
          d.photoLoadError = (typeof lastFileFetchError !== 'undefined' && lastFileFetchError) || 'ดึงรูปจาก Google Drive ไม่สำเร็จ';
        }
      }
    } catch (err) {
      console.warn('ไม่สามารถดึงรูปถ่ายจาก Google Drive มาฝังใน PDF ได้ จะลองใช้ลิงก์ตรงแทน (อาจไม่ขึ้นรูปใน PDF):', err);
    }
  }

  return d;
}

function waitForElementReady(element, timeoutMs = 5000) {
  const fontLoads = (document.fonts && document.fonts.load)
    ? ['400', '600', '700'].map(w => document.fonts.load(`${w} 14px Sarabun`, 'กขค').catch(() => {}))
    : [];
  const fontsReady = (document.fonts && document.fonts.ready)
    ? document.fonts.ready.catch(() => {})
    : Promise.resolve();

  const images = element ? Array.from(element.querySelectorAll('img')) : [];
  const imagePromises = images.map(img => {
    if (img.complete) return Promise.resolve();
    return new Promise(resolve => {
      img.addEventListener('load', resolve, { once: true });
      img.addEventListener('error', resolve, { once: true });
    });
  });

  const readyPromise = Promise.all([fontsReady, ...fontLoads, ...imagePromises]);
  const timeoutGuard = new Promise(resolve => setTimeout(resolve, timeoutMs));

  return Promise.race([readyPromise, timeoutGuard]);
}

function printApplicantForm(applicantData) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('เบราว์เซอร์บล็อกหน้าต่างพิมพ์ กรุณาอนุญาต Pop-up สำหรับเว็บไซต์นี้ แล้วลองใหม่อีกครั้ง');
    return;
  }
  const a = applicantData || {};
  const formHtml = renderOfficialFormHTML(a);
  const pageTitle = escapeHtml(('ใบสมัคร - ' + (a.firstName || '') + ' ' + (a.lastName || '')).trim());
  const printScript = [
    'function mmToPxLocal(mm){return mm*96/25.4;}',
    'function fitLocal(el){',
    '  if(!el)return;',
    '  var target=mmToPxLocal(297)-1,font=' + OFFICIAL_FORM_FONT_MAX_PX + ',minF=' + OFFICIAL_FORM_FONT_MIN_PX + ',step=0.1;',
    "  el.style.height='auto';el.style.maxHeight='none';el.style.overflow='visible';",
    '  for(var i=0;i<120;i++){',
    "    el.style.fontSize=font+'px';el.style.lineHeight='" + OFFICIAL_FORM_LINE_HEIGHT + "';",
    '    var h=el.getBoundingClientRect().height;',
    '    if((h<=target&&el.scrollWidth<=el.clientWidth+1)||font<=minF)break;',
    '    font=Math.max(minF,Math.round((font-step)*100)/100);',
    '  }',
    "  el.style.height='297mm';el.style.maxHeight='297mm';el.style.overflow='hidden';",
    '}',
    'window.onload=function(){',
    "  var el=document.getElementById('official-form-printable');",
    '  var jobs=[];',
    "  if(document.fonts&&document.fonts.load){['400','600','700'].forEach(function(w){jobs.push(document.fonts.load(w+' 14px Sarabun','กขค').catch(function(){}));});}",
    '  Array.prototype.forEach.call(document.images,function(img){if(!img.complete){jobs.push(new Promise(function(r){img.onload=r;img.onerror=r;}));}});',
    '  Promise.race([Promise.all(jobs),new Promise(function(r){setTimeout(r,5000);})]).then(function(){',
    '    fitLocal(el);',
    '    setTimeout(function(){window.print();},300);',
    '  });',
    '};'
  ].join('\n');

  printWindow.document.write(`<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <title>${pageTitle}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    @page { size: A4 portrait; margin: 0; }
    html, body { width: 210mm; height: 297mm; margin: 0; padding: 0; background: #fff; overflow: hidden;
      -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  </style>
</head>
<body>
  ${formHtml}
  <script>${printScript}<\/script>
</body>
</html>`);
  printWindow.document.close();
}

async function renderElementToA4Pdf(element) {
  if (typeof html2canvas === 'undefined') {
    throw new Error('ไม่พบไลบรารี html2canvas กรุณาตรวจสอบว่าไฟล์ index.html/admin.html โหลดสคริปต์ html2canvas แล้ว');
  }
  const JsPdfCtor = (window.jspdf && window.jspdf.jsPDF) ? window.jspdf.jsPDF : window.jsPDF;
  if (!JsPdfCtor) {
    throw new Error('ไม่พบไลบรารี jsPDF กรุณาตรวจสอบว่าไฟล์ index.html/admin.html โหลดสคริปต์ jsPDF แล้ว');
  }

  const canvas = await html2canvas(element, buildHtml2CanvasOptions(element));
  const imgData = canvas.toDataURL('image/jpeg', 0.95);

  const pdf = new JsPdfCtor({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
  return pdf;
}

async function buildApplicantPdf(applicantData) {
  const scratch = document.getElementById('pdf-render-scratch');
  if (!scratch) throw new Error('ไม่พบพื้นที่สร้าง PDF ชั่วคราว (#pdf-render-scratch)');

  const dataForRender = await resolveApplicantPhotoForRender(applicantData);
  window.scrollTo(0, 0);

  scratch.innerHTML = renderOfficialFormHTML(dataForRender);
  try {
    const element = scratch.querySelector('#official-form-printable');
    lockA4Layout(element);
    await waitForElementReady(element);
    fitOfficialFormToA4(element);
    await waitForLayoutSettle();
    return await renderElementToA4Pdf(element);
  } finally {
    scratch.innerHTML = '';
  }
}

function safeFileNamePart(s) {
  return String(s || '').replace(/[\\/:*?"<>|]/g, '').trim();
}

async function downloadApplicantPDF(applicantData) {
  const a = applicantData || {};
  if (typeof showLoading === 'function') showLoading(true);
  try {
    const pdf = await buildApplicantPdf(a);
    const name = `ใบสมัคร_${safeFileNamePart(a.firstName) || 'applicant'}_${safeFileNamePart(a.lastName)}.pdf`;
    pdf.save(name);
  } catch (err) {
    console.error(err);
    alert('เกิดข้อผิดพลาดขณะสร้างไฟล์ PDF: ' + (err && err.message ? err.message : err));
  } finally {
    if (typeof showLoading === 'function') showLoading(false);
  }
}

async function saveApplicantPdfToDrive(applicantData) {
  const a = applicantData || {};
  const webAppUrl = (typeof getGasWebAppUrl === 'function' ? getGasWebAppUrl() : '') || (typeof GAS_WEB_APP_URL !== 'undefined' ? GAS_WEB_APP_URL : '');
  if (!webAppUrl) {
    alert('ไม่พบการตั้งค่า Google Apps Script Web App URL กรุณาตั้งค่าในไฟล์ gs-api.js ก่อน');
    return;
  }
  if (typeof callGasApi !== 'function') {
    alert('ไม่พบฟังก์ชันเชื่อมต่อ Google Apps Script (gs-api.js) กรุณาตรวจสอบว่าโหลดสคริปต์ gs-api.js แล้ว');
    return;
  }

  if (typeof showLoading === 'function') showLoading(true);
  try {
    const pdf = await buildApplicantPdf(a);
    const pdfDataUri = pdf.output('datauristring');
    const fileName = `ใบสมัคร_${safeFileNamePart(a.firstName) || 'applicant'}_${safeFileNamePart(a.lastName)}_${a.id || Date.now()}.pdf`;

    const result = await callGasApi(webAppUrl, {
      action: 'savePdfToDrive',
      fileName,
      base64Data: pdfDataUri,
      subfolder: (typeof buildApplicantFolderName === 'function') ? buildApplicantFolderName(a) : (a.id || '')
    }, 60000);

    if (result && result.status === 'success') {
      alert('บันทึก PDF ลง Google Drive สำเร็จ!' + (result.url ? '\nลิงก์ไฟล์ (เปิดได้เฉพาะผู้ดูแลที่มีสิทธิ์): ' + result.url : ''));
    } else {
      alert('ไม่สามารถบันทึกลง Google Drive ได้: ' + (result && result.message ? result.message : 'ไม่ทราบสาเหตุ'));
    }
  } catch (err) {
    console.error(err);
    alert('เกิดข้อผิดพลาดขณะสร้าง/บันทึก PDF ลง Google Drive: ' + (err && err.message ? err.message : err));
  } finally {
    if (typeof showLoading === 'function') showLoading(false);
  }
}