function formatThaiDateDisplay(dateStr) {
  if (!dateStr) return '';
  const str = String(dateStr).trim();
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const y = parseInt(match[1], 10) + 543;
    const m = match[2];
    const d = match[3];
    return `${d}/${m}/${y}`;
  }
  return str;
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

function matchIndustryGroup(selected, target) {
  if (!selected || !target) return false;
  const s = selected.replace(/[\s\/-]/g, '').toLowerCase();
  const t = target.replace(/[\s\/-]/g, '').toLowerCase();
  if (s === t) return true;
  if (s.includes('ดิจิ') && t.includes('ดิจิ')) return true;
  if (s.includes('เกษตร') && t.includes('เกษตร')) return true;
  if (s.includes('เชื้อเพลิง') && t.includes('เชื้อเพลิง')) return true;
  if (s.includes('อิเล็กทรอนิกส์') && t.includes('อิเล็กทรอนิกส์')) return true;
  if (s.includes('ยานยนต์') && t.includes('ยานยนต์')) return true;
  if (s.includes('อาหาร') && t.includes('อาหาร')) return true;
  if (s.includes('ท่องเที่ยว') && t.includes('ท่องเที่ยว')) return true;
  if (s.includes('ขนส่ง') && t.includes('ขนส่ง')) return true;
  if (s.includes('แพทย์') && t.includes('แพทย์')) return true;
  if (s.includes('หุ่นยนต์') && t.includes('หุ่นยนต์')) return true;
  return false;
}

function renderOfficialFormHTML(data) {
  const chk = (cond) => cond ? '☑' : '☐';
  const dot = (val, width) => {
    const v = (val !== undefined && val !== null && String(val).trim() !== '') ? String(val).trim() : '';
    const style = `display:inline-block;min-width:${width || 60}px;border-bottom:1px dotted #333;padding:0 3px 1px 3px;`;
    return v ? `<span style="${style}font-weight:600;">${escapeHtml(v)}</span>` : `<span style="${style}">&nbsp;</span>`;
  };
  const d = data || {};
  const objectives = d.objectives || [];
  const tests = d.tests || [];
  const applicantTypes = d.applicantTypes || [];
  const disabilities = d.disabilities || [];
  const photoSrc = d.photoDataUrl || d.photoUrl || '';
  const isEmployed = d.employmentStatus === 'employed';
  const isUnemployed = d.employmentStatus === 'unemployed';
  const isGovt = d.workSector === 'government';
  const isBusiness = d.workSector === 'business';
  const isPrivate = d.workSector === 'private';
  const isStateEnt = d.workSector === 'state_enterprise';

  const inc = d.monthlyIncome || '';
  const incRanges = [
    { label: '1 - 5,000', val: '1-5000' },
    { label: '5,001 - 9,000', val: '5001-9000' },
    { label: '9,001 - 15,000', val: '9001-15000' },
    { label: '15,001 - 20,000', val: '15001-20000' },
    { label: '20,001 - 30,000', val: '20001-30000' },
    { label: '30,001 - 40,000', val: '30001-40000' },
    { label: '40,001 บาทขึ้นไป', val: '40001+' },
  ];

  const indGroups = [
    'การแปรรูปอาหาร', 'การเกษตรและเทคโนโลยีชีวภาพ', 'ท่องเที่ยวกลุ่มรายได้ดีและท่องเที่ยวเชิงสุขภาพ',
    'อิเล็กทรอนิกส์อัจฉริยะ', 'ยานยนต์สมัยใหม่', 'ดิจิทัล', 'เชื้อเพลิง/เคมีชีวภาพ',
    'ขนส่งและการบิน', 'การแพทย์ครบวงจร', 'หุ่นยนต์เพื่ออุตสาหกรรม'
  ];

  const selInd = d.industryGroup || '';
  const infoSrc = d.infoSource || '';
  return `
  <div id="official-form-printable" style="width:210mm;height:297mm;max-height:297mm;box-sizing:border-box;overflow:hidden;padding:9mm 13mm 6mm 13mm;background:#fff;font-family:'Sarabun','TH Sarabun PSK',sans-serif;font-size:10.4px;line-height:1.7;letter-spacing:0.25px;color:#111;">

    <!-- ===== HEADER (โลโก้ซ้าย + ชื่อฟอร์มกึ่งกลาง + รูปถ่ายขวา เหมือนแบบฟอร์มต้นฉบับ) ===== -->
    <!-- [แก้ไข] ขยายขนาดตราหน่วยงาน (โลโก้) และรูปถ่ายผู้สมัครให้ใหญ่ขึ้น ตามที่ขอ -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:5px;">
      <tr>
        <td style="width:76px;vertical-align:top;padding-top:2px;">
          <img src="assets/dsd-logo.png" alt="DSD" style="height:66px;width:auto;object-fit:contain;" onerror="this.src='assets/BW-HR.png';">
        </td>
        <td style="vertical-align:middle;text-align:center;padding:0 6px;">
          <div style="font-size:16.5px;font-weight:700;line-height:1.35;">ใบสมัครเข้ารับการฝึกอบรมฝีมือแรงงาน/ทดสอบมาตรฐานฝีมือแรงงาน</div>
        </td>
        <td style="width:84px;vertical-align:top;text-align:center;">
          ${photoSrc
            ? `<div style="width:76px;height:96px;border:1px solid #555;overflow:hidden;margin:0 auto;"><img src="${escapeHtml(photoSrc)}" style="width:100%;height:100%;object-fit:cover;" onerror="this.outerHTML='<div style=\\'width:76px;height:96px;border:1px solid #555;display:flex;align-items:center;justify-content:center;font-size:8.5px;color:#999;\\'>ไม่พบรูป</div>'"></div>`
            : `<div style="width:76px;height:96px;border:1px dashed #888;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:8.5px;color:#666;margin:0 auto;">📷<br>รูปถ่าย<br>1-1.5 นิ้ว</div>`
          }
        </td>
      </tr>
    </table>
    <div style="font-weight:700;font-size:11.5px;border-bottom:1.5px solid #222;padding-bottom:4px;margin-bottom:6px;">
      กรมพัฒนาฝีมือแรงงาน กระทรวงแรงงาน&nbsp; หน่วยงาน:&nbsp;${dot(d.agency || 'ศูนย์ทดสอบมาตรฐานฝีมือแรงงาน ทาซากิ เทรนนิ่ง เซ็นเตอร์', 250)}
    </div>

    <!-- ===== ความประสงค์ ===== -->
    <div style="margin-bottom:2px;">
      ข้าพเจ้ามีความประสงค์เข้ารับ&nbsp; การฝึกอบรมฝีมือแรงงาน&nbsp;
      ${chk(objectives.includes('ฝึกเตรียมเข้าทำงาน'))} ฝึกเตรียมเข้าทำงาน&nbsp;&nbsp;
      ${chk(objectives.includes('ฝึกยกระดับฝีมือแรงงาน'))} ฝึกยกระดับฝีมือแรงงาน&nbsp;&nbsp;
      ${chk(objectives.includes('ฝึกอาชีพเสริม'))} ฝึกอาชีพเสริม&nbsp;&nbsp;
      ${chk(objectives.includes('ฝึกคนครัวบนเรือ'))} ฝึกคนครัวบนเรือ
    </div>
    <div style="padding-left:96px;margin-bottom:2px;">
      การทดสอบฝีมือแรงงาน&nbsp;
      ${chk(tests.includes('ทดสอบมาตรฐานฝีมือแรงงานแห่งชาติ'))} ทดสอบมาตรฐานฝีมือแรงงานแห่งชาติ
    </div>
    <div style="margin-bottom:2px;">
      หลักสูตร (ฝึกอบรม) ${dot(d.course, 200)}&nbsp;&nbsp; จำนวนชั่วโมงฝึก ${dot(d.trainingHours, 40)} ชั่วโมง
    </div>
    <div style="margin-bottom:2px;">
      สาขา (ทดสอบ) ${dot(d.branch, 170)}&nbsp;&nbsp; ระดับ (ทดสอบ) ${dot(d.level, 70)}
    </div>
    <div style="margin-bottom:2px;">
      ประเภทผู้สมัคร (ทดสอบ)&nbsp;
      ${chk(applicantTypes.includes('ผู้รับการฝึกจาก กพร.'))} ผู้รับการฝึกจาก กพร.&nbsp;
      ${chk(applicantTypes.includes('จากสถานศึกษา'))} จากสถานศึกษา&nbsp;
      ${chk(applicantTypes.includes('จากภาครัฐ'))} จากภาครัฐ&nbsp;
      ${chk(applicantTypes.includes('จากเอกชน'))} จากภาคเอกชน&nbsp;
      ${chk(applicantTypes.includes('บุคคลทั่วไป'))} บุคคลทั่วไป
    </div>
    <div style="margin-bottom:3px;">
      ระหว่างวันที่ ${dot(formatThaiDateDisplay(d.startDate), 180)}
    </div>

    <!-- ===== 1. ข้อมูลส่วนบุคคล ===== -->
    <!-- [แก้ไข] ขยายขนาดตัวอักษรหัวข้อหลัก (1./2./3./4.) ให้ใหญ่และเด่นขึ้น เหมาะกับหนังสือราชการ -->
    <div style="font-weight:700;font-size:12.5px;margin:4px 0 2px 0;">1. ข้อมูลส่วนบุคคล</div>
    <div style="margin-bottom:2px;">
      ชื่อ-สกุล ภาษาไทย (นาย/นาง/นางสาว) ${dot((d.title||'') + ' ' + (d.firstName||'') + ' ' + (d.lastName||''), 210)}&nbsp;&nbsp; เพศ ${dot(d.gender, 45)}
    </div>
    <div style="margin-bottom:2px;">
      ชื่อ-สกุล ภาษาอังกฤษ ${dot(d.fullNameEn, 300)}
    </div>
    <div style="margin-bottom:2px;">
      เลขบัตรประชาชน ${dot(d.idCard, 115)}&nbsp;&nbsp; สัญชาติ ${dot(d.nationality||'ไทย', 45)}&nbsp;&nbsp; วัน/เดือน/ปีเกิด ${dot(formatThaiDateDisplay(d.birthDate), 75)}&nbsp;&nbsp; โทรศัพท์ ${dot(formatPhoneNumber(d.phone), 80)}
    </div>
    <div style="margin-bottom:2px;">
      อีเมล (ถ้ามี) ${dot(d.email, 260)}
    </div>
    <div style="margin-bottom:2px;">
      ที่อยู่ตามทะเบียนบ้าน/ที่อยู่ตามบัตรประชาชน เลขที่ ${dot(cleanAddressNo(d.addressNo), 45)}&nbsp; หมู่ ${dot(d.moo, 24)}&nbsp; ถนน ${dot(d.street, 80)}&nbsp; ซอย ${dot(d.soi, 70)}
    </div>
    <div style="margin-bottom:2px;">
      แขวง/ตำบล ${dot(d.subdistrict, 90)}&nbsp; เขต/อำเภอ ${dot(d.district, 90)}&nbsp; จังหวัด ${dot(d.province, 90)}&nbsp; รหัสไปรษณีย์ ${dot(d.zipcode, 55)}
    </div>
    <div style="margin-bottom:2px;">
      วุฒิการศึกษาสูงสุด&nbsp;
      ${chk(d.education==='ประถมศึกษา')} ประถมศึกษา&nbsp;
      ${chk(d.education==='มัธยมต้น')} มัธยมต้น&nbsp;
      ${chk(d.education==='มัธยมปลาย')} มัธยมปลาย&nbsp;
      ${chk(d.education==='อนุปริญญา')} อนุปริญญา&nbsp;
      ${chk(d.education==='ปวช.')} ปวช.&nbsp;
      ${chk(d.education==='ปวส./ปวท.')} ปวส./ปวท.&nbsp;
      ${chk(d.education==='ปริญญาตรีขึ้นไป')} ปริญญาตรีขึ้นไป&nbsp;
      ${chk(d.education==='ไม่จบการศึกษา')} ไม่จบการศึกษา
    </div>
    <div style="margin-bottom:2px;">
      สาขา ${dot(d.educationMajor, 220)}
    </div>
    <div style="margin-bottom:3px;">
      สภาพร่างกาย&nbsp;${chk(d.bodyCondition==='ปกติ')} ปกติ&nbsp;&nbsp;
      ${chk(d.bodyCondition==='พิการ')} พิการ (&nbsp;
      ${chk(disabilities.includes('การเห็น'))} การเห็น&nbsp;
      ${chk(disabilities.includes('การได้ยินหรือสื่อความหมาย'))} การได้ยินหรือสื่อความหมาย&nbsp;
      ${chk(disabilities.includes('การเคลื่อนไหวหรือทางร่างกาย'))} การเคลื่อนไหวหรือทางร่างกาย&nbsp;
      ${chk(disabilities.includes('ทางจิตใจหรือพฤติกรรม'))} ทางจิตใจหรือพฤติกรรม&nbsp;
      ${chk(disabilities.includes('ทางสติปัญญา'))} ทางสติปัญญา&nbsp;
      ${chk(disabilities.includes('การเรียนรู้'))} การเรียนรู้&nbsp;
      ${chk(disabilities.includes('ทางออทิสติก'))} ทางออทิสติก )
    </div>

    <!-- ===== 2. สถานภาพแรงงาน ===== -->
    <div style="margin-bottom:2px;">
      <span style="font-weight:700;font-size:12.5px;">2. สถานภาพแรงงาน</span>&nbsp;&nbsp;
      ${chk(isEmployed)} ทำงาน (กรอกข้อ 2.1)&nbsp;&nbsp;&nbsp;&nbsp;
      ${chk(isUnemployed)} ไม่ทำงานหรือว่างงาน (กรอกข้อ 2.2)
    </div>

    ${isEmployed || (!isEmployed && !isUnemployed) ? `
    <!-- 2.1 ผู้มีงานทำ -->
    <div style="padding-left:10px;margin-bottom:2px;">
      <span style="font-weight:600;">2.1 ผู้มีงานทำ</span>&nbsp;
      ${chk(isPrivate)} ภาคเอกชน&nbsp;&nbsp;
      ${chk(isStateEnt)} รัฐวิสาหกิจ&nbsp;&nbsp;
      ${chk(isGovt)} ภาครัฐ (&nbsp;${chk(isGovt && d.govtType==='ข้าราชการพลเรือน')} ข้าราชการพลเรือน&nbsp;
      ${chk(isGovt && d.govtType==='ข้าราชการตำรวจ')} ข้าราชการตำรวจ&nbsp;
      ${chk(isGovt && d.govtType==='ข้าราชการทหาร')} ข้าราชการทหาร&nbsp;
      ${chk(isGovt && d.govtType==='ข้าราชการครู')} ข้าราชการครู )
    </div>
    <div style="padding-left:10px;margin-bottom:2px;">
      ${chk(isBusiness)} ประกอบธุรกิจส่วนตัว/ประกอบอาชีพอิสระ (&nbsp;
      ${chk(isBusiness && d.freelanceType==='วิสาหกิจชุมชน')} วิสาหกิจชุมชน&nbsp;
      ${chk(isBusiness && d.freelanceType==='เกษตรกร')} เกษตรกร&nbsp;
      ${chk(isBusiness && (d.freelanceType==='ผู้รับจ้างทั่วไปโดยไม่มีนายจ้าง'||d.freelanceType==='ผู้รับจ้างทั่วไปโดยการจ้าง (Freelance)'||Boolean(d.freelanceType && d.freelanceType.includes('Freelance'))))} ผู้รับจ้างทั่วไปโดยไม่มีนายจ้าง (Freelance) )
    </div>
    <div style="padding-left:10px;margin-bottom:2px;">
      รายได้เฉลี่ยต่อเดือน&nbsp;
      ${incRanges.map(r => `${chk(matchIncomeRange(inc, r.val, r.label))} ${r.label} บาท`).join('&nbsp;&nbsp;')}
    </div>
    <div style="padding-left:10px;margin-bottom:2px;">
      อาชีพ ${dot(d.occupation, 110)}&nbsp;&nbsp; ตำแหน่ง ${dot(d.position, 110)}&nbsp;&nbsp; อายุงาน ${dot(d.workExperienceYears, 35)} ปี
    </div>
    <div style="padding-left:10px;margin-bottom:2px;">
      สถานที่ทำงาน ชื่อหน่วยงาน ${dot(d.workplaceName, 140)}&nbsp;&nbsp; จังหวัด ${dot(d.workplaceProvince, 85)}&nbsp;&nbsp; โทรศัพท์ ${dot(formatPhoneNumber(d.workplacePhone), 80)}
    </div>
    <div style="padding-left:10px;margin-bottom:3px;">
      กลุ่มอุตสาหกรรมที่ทำงาน&nbsp;
      ${indGroups.map(g => `${chk(matchIndustryGroup(selInd, g))} ${g}`).join('&nbsp;&nbsp;')}
    </div>
    ` : ''}

    ${isUnemployed ? `
    <!-- 2.2 ผู้ที่ไม่มีงานทำ -->
    <div style="padding-left:10px;margin-bottom:3px;">
      <span style="font-weight:600;">2.2 ผู้ที่ไม่มีงานทำ</span>&nbsp;
      ${chk(d.unemployedReason==='อยู่ระหว่างหางาน'||d.unemployedReason==='อยู่ในระหว่างหางาน')} อยู่ระหว่างหางาน&nbsp;
      ${chk(d.unemployedReason==='นักเรียน/นักศึกษา')} นักเรียน/นักศึกษา&nbsp;
      ${chk(d.unemployedReason==='ผู้ประกันตนที่ถูกเลิกจ้าง')} ผู้ประกันตนที่ถูกเลิกจ้าง&nbsp;
      ${chk(d.unemployedReason==='ผู้ต้องขัง')} ผู้ต้องขัง&nbsp;
      ${chk(d.unemployedReason==='ทหารก่อนปลด')} ทหารก่อนปลด&nbsp;
      ${chk(!['อยู่ระหว่างหางาน','อยู่ในระหว่างหางาน','นักเรียน/นักศึกษา','ผู้ประกันตนที่ถูกเลิกจ้าง','ผู้ต้องขัง','ทหารก่อนปลด',''].includes(d.unemployedReason||''))} อื่น ๆ ระบุ ${dot(d.unemployedReason, 90)}
    </div>
    ` : ''}

    <!-- ===== 3. แหล่งที่ทราบการฝึก ===== -->
    <div style="margin-bottom:2px;">
      <span style="font-weight:700;font-size:12.5px;">3. แหล่งที่ทราบการฝึก</span>&nbsp;
      ${chk(infoSrc==='โทรทัศน์')} โทรทัศน์&nbsp;
      ${chk(infoSrc==='วิทยุ')} วิทยุ&nbsp;
      ${chk(infoSrc==='หนังสือพิมพ์')} หนังสือพิมพ์&nbsp;
      ${chk(infoSrc.includes('ออนไลน์'))} สื่อออนไลน์ของหนังสือพิมพ์ วิทยุ หรือโทรทัศน์&nbsp;
      ${chk(infoSrc.includes('เจ้าหน้าที่') || infoSrc.includes('สถาบัน') || (!['โทรทัศน์','วิทยุ','หนังสือพิมพ์'].includes(infoSrc) && !infoSrc.includes('ออนไลน์') && Boolean(infoSrc)))} อื่นๆ ${dot(infoSrc.includes('เจ้าหน้าที่') || infoSrc.includes('สถาบัน') ? infoSrc : (!infoSrc.includes('ออนไลน์') && !['โทรทัศน์','วิทยุ','หนังสือพิมพ์'].includes(infoSrc) ? infoSrc : ''), 110)}
    </div>

    <!-- ===== 4. การเปิดเผยข้อมูลส่วนบุคคล ===== -->
    <div style="margin-bottom:2px;">
      <span style="font-weight:700;font-size:12.5px;">4. การเปิดเผยข้อมูลส่วนบุคคล</span>&nbsp;
      ข้าพเจ้าได้อ่านและรับทราบนโยบายการคุ้มครองข้อมูลส่วนบุคคลของกรมพัฒนาฝีมือแรงงานแล้วและ
    </div>
    <div style="padding-left:10px;margin-bottom:2px;">
      ${chk(d.pdpaConsent===true||d.pdpaConsent==='ยินยอม'||d.pdpaConsent==='yes')} ยินยอมเปิดเผยข้อมูลส่วนบุคคลเพื่อใช้ประโยชน์ในการเชื่อมโยงและบูรณาการข้อมูลกับหน่วยงานภาครัฐ&nbsp;&nbsp;
      ${chk(d.pdpaConsent===false||d.pdpaConsent==='ไม่ยินยอม'||d.pdpaConsent==='no')} ไม่ยินยอมเปิดเผยข้อมูลส่วนบุคคล
    </div>
    <div style="margin-bottom:2px;">
      ท่านมีความประสงค์จะให้กรมฯจัดหางาน หางานให้เมื่อผ่านการฝึกอบรมฝีมือแรงงาน/ทดสอบมาตรฐานหรือไม่
    </div>
    <div style="padding-left:10px;margin-bottom:3px;">
      ${chk(d.jobAssist==='not_needed')} ไม่ต้องการ&nbsp;&nbsp;&nbsp;
      ${chk(d.jobAssist==='domestic')} ต้องการจัดหางานในประเทศ ตำแหน่ง ${dot('',80)} ของอุตสาหกรรม ${dot('',80)}&nbsp;&nbsp;&nbsp;
      ${chk(d.jobAssist==='overseas')} ต้องการจัดหางานในต่างประเทศ ประเทศที่จะไปทำงาน ${dot('',90)}
    </div>

    <!-- ===== เอกสารแนบ ===== -->
    <div style="font-size:9.3px;color:#333;margin-bottom:3px;">
      <span style="font-weight:600;">เอกสารแนบ:</span>&nbsp;
      ${chk(d.hasPhoto || Boolean(photoSrc))} ภาพถ่ายหน้าตรง&nbsp;&nbsp;
      ${chk(d.hasIdCardFile || Boolean(d.idCardFileUrl))} บัตรประชาชน&nbsp;&nbsp;
      ${chk(d.hasEducationFile || Boolean(d.educationFileUrl))} วุฒิการศึกษา&nbsp;&nbsp;
      ${chk(d.hasTranscriptFile || Boolean(d.transcriptFileUrl))} ทรานสคริปต์&nbsp;&nbsp;
      ${chk(d.hasWorkCertFile || Boolean(d.workCertFileUrl))} ใบรับรองงาน
    </div>

    <!-- ===== กรอบลงชื่อด้านล่าง (เหมือนแบบฟอร์มต้นฉบับ) ===== -->
    <table style="width:100%;border-collapse:collapse;border:1px solid #444;margin-top:2px;font-size:9.6px;">
      <tr>
        <td style="width:50%;border-right:1px solid #444;padding:6px 8px;vertical-align:top;">
          <div style="font-weight:700;">(เฉพาะเจ้าหน้าที่) ตรวจสอบข้อมูลข้างต้นจากฐานข้อมูลในระบบ</div>
          <div>และหลักฐานตัวจริงเรียบร้อยแล้ว</div>
          <div style="margin-top:14px;">เจ้าหน้าที่รับสมัคร .............................................</div>
          <div style="margin-top:8px;">วันที่รับสมัคร .......... / .......... / ....................</div>
        </td>
        <td style="width:50%;padding:6px 8px;vertical-align:top;">
          <div style="font-weight:700;">ข้าพเจ้าขอรับรองว่าข้อความข้างต้นเป็นจริงทุกประการ</div>
          <div style="margin-top:14px;text-align:center;">
            ลงชื่อ .................................................. ผู้สมัคร
          </div>
          <div style="margin-top:4px;text-align:center;">
            ( ${escapeHtml(((d.title||'')+' '+(d.firstName||'')+' '+(d.lastName||'')).trim()) || '........................................'} )
          </div>
          <div style="margin-top:4px;text-align:center;">
            วันที่ ${dot(d.submittedAtDate || formatThaiDateDisplay(d.submittedAt ? d.submittedAt.slice(0,10) : ''), 100)}
          </div>
        </td>
      </tr>
    </table>
  </div>
  `;
}

function mmToPx(mm) {
  return mm * 96 / 25.4;
}

function fitOfficialFormToA4(element, opts) {
  if (!element) return;
  const options = opts || {};
  const minFontPx = options.minFontPx || 7.8;
  const maxFontPx = options.maxFontPx || 10.4;
  const step = options.step || 0.15;
  const lineHeight = options.lineHeight || 1.7;
  const letterSpacingPx = (options.letterSpacingPx !== undefined) ? options.letterSpacingPx : 0.25;
  const targetHeightPx = mmToPx(297);

  const prevHeight = element.style.height;
  const prevMaxHeight = element.style.maxHeight;
  const prevOverflow = element.style.overflow;
  element.style.height = 'auto';
  element.style.maxHeight = 'none';
  element.style.overflow = 'visible';
  element.style.letterSpacing = letterSpacingPx + 'px';

  let fontPx = maxFontPx;
  for (let i = 0; i < 40; i++) {
    element.style.fontSize = fontPx + 'px';
    element.style.lineHeight = String(lineHeight);
    const actualHeightPx = element.getBoundingClientRect().height;
    if (actualHeightPx <= targetHeightPx || fontPx <= minFontPx) break;
    fontPx = Math.max(minFontPx, Math.round((fontPx - step) * 10) / 10);
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
  element.style.display = 'block';
  element.style.width = '210mm';
  element.style.maxWidth = '210mm';
  element.style.height = '297mm';
  element.style.maxHeight = '297mm';
  element.style.margin = '0';
  element.style.boxShadow = 'none';
  element.style.padding = '9mm 13mm 6mm 13mm';
  element.style.fontSize = '10.4px';
  element.style.lineHeight = '1.7';
  element.style.letterSpacing = '0.25px';
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
    scale: 2.5,
    useCORS: true,
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
        }
      }
    } catch (err) {
      console.warn('ไม่สามารถดึงรูปถ่ายจาก Google Drive มาฝังใน PDF ได้ จะลองใช้ลิงก์ตรงแทน (อาจไม่ขึ้นรูปใน PDF):', err);
    }
  }

  return d;
}

function waitForElementReady(element, timeoutMs = 4000) {
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

  const readyPromise = Promise.all([fontsReady, ...imagePromises]);
  const timeoutGuard = new Promise(resolve => setTimeout(resolve, timeoutMs));

  return Promise.race([readyPromise, timeoutGuard]);
}

function printApplicantForm(applicantData) {
  const printWindow = window.open('', '_blank');
  const formHtml = renderOfficialFormHTML(applicantData);

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="th">
    <head>
      <meta charset="UTF-8">
      <title>พิมพ์ใบสมัคร - ${escapeHtml(applicantData.firstName || '')} ${escapeHtml(applicantData.lastName || '')}</title>
      <link rel="stylesheet" href="styles.css">
      <script src="https://cdn.tailwindcss.com"></script>
      <style>
        @page { size: A4 portrait; margin: 0; }
        html, body {
          width: 210mm;
          height: 297mm;
          margin: 0;
          padding: 0;
          background: #fff;
          font-family: 'Sarabun', sans-serif;
          overflow: hidden;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        #official-form-printable {
          width: 210mm !important;
          max-width: 210mm !important;
          height: 297mm !important;
          max-height: 297mm !important;
          margin: 0 !important;
          padding: 9mm 13mm 6mm 13mm !important;
          box-sizing: border-box !important;
          overflow: hidden !important;
          page-break-inside: avoid !important;
          page-break-after: avoid !important;
        }
      </style>
    </head>
    <body class="p-0 m-0">
      ${formHtml}
      <script>
        // [แก้ไข] หน้าต่างพิมพ์นี้เป็นเอกสารแยก (window.open) ไม่ได้แชร์ฟังก์ชันกับหน้าเว็บหลัก
        // จึงคัดลอกตรรกะ "ย่อฟอนต์ให้พอดี A4" มาไว้ในสคริปต์นี้โดยตรง (เทียบเท่า fitOfficialFormToA4 ในไฟล์ pdf-generator.js)
        function mmToPxLocal(mm) { return mm * 96 / 25.4; }
        function fitToA4Local(el) {
          if (!el) return;
          var targetHeightPx = mmToPxLocal(297);
          var minFontPx = 7.8, fontPx = 10.4, step = 0.15;
          el.style.height = 'auto';
          el.style.maxHeight = 'none';
          el.style.overflow = 'visible';
          el.style.letterSpacing = '0.25px';
          for (var i = 0; i < 40; i++) {
            el.style.fontSize = fontPx + 'px';
            el.style.lineHeight = '1.7';
            var h = el.getBoundingClientRect().height;
            if (h <= targetHeightPx || fontPx <= minFontPx) break;
            fontPx = Math.max(minFontPx, Math.round((fontPx - step) * 10) / 10);
          }
          el.style.height = '297mm';
          el.style.maxHeight = '297mm';
          el.style.overflow = 'hidden';
        }
        window.onload = function() {
          var el = document.getElementById('official-form-printable');
          if (el) {
            el.style.width = '210mm';
            el.style.maxWidth = '210mm';
            el.style.height = '297mm';
            el.style.maxHeight = '297mm';
            el.style.margin = '0';
            el.style.padding = '9mm 13mm 6mm 13mm';
            el.style.letterSpacing = '0.25px';
            el.style.boxShadow = 'none';
            el.style.boxSizing = 'border-box';
            el.style.overflow = 'hidden';
          }
          var fontsReady = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
          fontsReady.then(function() {
            fitToA4Local(el);
            setTimeout(function() {
              window.print();
            }, 300);
          });
        };
      </script>
    </body>
    </html>
  `);
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
  const imgData = canvas.toDataURL('image/jpeg', 0.98);

  const pdf = new JsPdfCtor({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
  return pdf;
}

async function downloadApplicantPDF(applicantData) {
  const container = document.getElementById('pdf-render-scratch');
  if (!container) return;

  const dataForRender = await resolveApplicantPhotoForRender(applicantData);
  window.scrollTo(0, 0);

  container.innerHTML = renderOfficialFormHTML(dataForRender);
  const element = document.getElementById('official-form-printable');
  lockA4Layout(element);

  await waitForElementReady(element);
  fitOfficialFormToA4(element);
  await waitForLayoutSettle();

  try {
    const pdf = await renderElementToA4Pdf(element);
    pdf.save(`ใบสมัคร_${applicantData.firstName || 'applicant'}_${applicantData.lastName || ''}.pdf`);
  } catch (err) {
    console.error(err);
    alert('เกิดข้อผิดพลาดขณะสร้างไฟล์ PDF: ' + (err && err.message ? err.message : err));
  }
}

async function saveApplicantPdfToDrive(applicantData) {
  const webAppUrl = (typeof getGasWebAppUrl === 'function' ? getGasWebAppUrl() : '') || (typeof GAS_WEB_APP_URL !== 'undefined' ? GAS_WEB_APP_URL : '');
  if (!webAppUrl) {
    alert('ไม่พบการตั้งค่า Google Apps Script Web App URL กรุณาตั้งค่าในไฟล์ gs-api.js หรือหน้าแอดมินก่อน');
    return;
  }
  if (typeof callGasApi !== 'function') {
    alert('ไม่พบฟังก์ชันเชื่อมต่อ Google Apps Script (gs-api.js) กรุณาตรวจสอบว่าโหลดสคริปต์ gs-api.js แล้ว');
    return;
  }

  if (typeof showLoading === 'function') showLoading(true);
  const scratch = document.getElementById('pdf-render-scratch');
  try {
    if (!scratch) throw new Error('ไม่พบพื้นที่สร้าง PDF ชั่วคราว (#pdf-render-scratch)');
    const dataForRender = await resolveApplicantPhotoForRender(applicantData);
    window.scrollTo(0, 0);

    scratch.innerHTML = renderOfficialFormHTML(dataForRender);
    const element = document.getElementById('official-form-printable');
    lockA4Layout(element);
    await waitForElementReady(element);
    fitOfficialFormToA4(element);
    await waitForLayoutSettle();

    const pdf = await renderElementToA4Pdf(element);
    const pdfDataUri = pdf.output('datauristring');

    const fileName = `ใบสมัคร_${applicantData.firstName || 'applicant'}_${applicantData.lastName || ''}_${applicantData.id || Date.now()}.pdf`;

    const result = await callGasApi(webAppUrl, {
      action: 'savePdfToDrive',
      fileName,
      base64Data: pdfDataUri,
      subfolder: applicantData.id || ''
    });

    if (result && result.status === 'success') {
      alert('บันทึก PDF ลง Google Drive สำเร็จ!\nลิงก์ไฟล์: ' + result.url);
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