function escapeHtml(str) {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderOfficialFormHTML(data) {
  const check = (val) => val ? '☑' : '☐';
  const valOrDot = (val, minDots = 15) => {
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      return `<span class="font-semibold text-blue-900 px-1 border-b border-dotted border-gray-600">${escapeHtml(val)}</span>`;
    }
    return `<span class="dotted-line inline-block" style="min-width: ${minDots * 5}px;">&nbsp;</span>`;
  };

  const d = data || {};
  const objectives = d.objectives || [];
  const tests = d.tests || [];
  const applicantTypes = d.applicantTypes || [];
  const disabilities = d.disabilities || [];
  const photoSrc = d.photoDataUrl || d.photoUrl || '';

  return `
  <div id="official-form-printable" class="a4-page font-sarabun text-gray-900 bg-white leading-relaxed text-[12px] p-6 max-w-[210mm] mx-auto">
    
    <!-- Header with Garuda / DSD Logo and Applicant Photo Box (รูปถ่ายหน้าตรง 1 - 1.5 นิ้ว) -->
    <div class="flex items-start justify-between border-b pb-3 mb-2">
      <div class="flex items-start gap-3">
        <img src="assets/dsd-logo.png" alt="DSD Logo" class="h-16 w-auto object-contain" onerror="this.src='assets/BW-HR.png';">
        <div>
          <div class="text-xs text-gray-500 font-medium">กรมพัฒนาฝีมือแรงงาน กระทรวงแรงงาน</div>
          <div class="font-bold text-sm text-gray-800">ศูนย์ทดสอบมาตรฐานฝีมือแรงงาน ทาซากิ เทรนนิ่ง เซนต์เตอร์</div>
          <div class="text-[11px] text-gray-500 mt-1">แบบฟอร์ม กพร. สมัครฝึกอบรม/ทดสอบฯ | รหัส: <span class="font-bold text-blue-900">${escapeHtml(d.id) || '-'}</span></div>
        </div>
      </div>

      <!-- กล่องรูปถ่ายหน้าตรงของผู้สมัคร ขนาด 1 - 1.5 นิ้ว
           [FIX] เดิมมี crossorigin="anonymous" ติดอยู่ที่ <img> เสมอ ซึ่งถ้า photoSrc เป็นลิงก์ Google Drive
           (photoUrl) และ Drive ไม่ได้ตอบ header CORS ที่ครบถ้วน เบราว์เซอร์จะปฏิเสธโหลดรูปทันที (รูปไม่ขึ้นเลย
           ไม่ใช่แค่ตอนแปลงเป็น PDF) จึงเอา crossorigin ออกจากการแสดงผลปกติ ให้โหลดรูปได้ตามปกติเสมอ
           ส่วนตอนแปลงเป็น PDF จริงๆ ตอนนี้ resolveApplicantPhotoForRender() จะดึงรูปมาฝังเป็น data URI
           (Base64) ก่อนเรียก renderOfficialFormHTML เสมอ เมื่อรูปต้นทางเป็นลิงก์ Google Drive
           ทำให้ไม่มีปัญหา CORS/canvas tainted อีกต่อไป (ดูบั๊ก #2 ในสรุปการแก้ไข) -->
      <div class="flex-shrink-0 ml-4">
        ${photoSrc 
          ? `<div class="w-[84px] h-[108px] border-2 border-gray-400 rounded-sm overflow-hidden bg-white shadow-sm flex items-center justify-center">
              <img src="${escapeHtml(photoSrc)}" alt="รูปถ่ายหน้าตรง" class="w-full h-full object-cover"
                   onerror="this.parentElement.innerHTML='&lt;span style=&quot;font-size:10px;color:#999;text-align:center;padding:4px;&quot;&gt;ไม่พบรูปภาพ&lt;/span&gt;'">
             </div>`
          : `<div class="w-[84px] h-[108px] border-2 border-dashed border-gray-400 rounded-sm flex flex-col items-center justify-center text-center p-1 bg-gray-50 text-gray-400 text-[10px] leading-tight">
              <span class="text-base mb-1">📷</span>
              <span class="font-semibold text-gray-600">รูปถ่ายหน้าตรง</span>
              <span>1 - 1.5 นิ้ว</span>
             </div>`
        }
      </div>
    </div>

    <!-- Title -->
    <div class="text-center my-1.5">
      <h1 class="text-[15px] font-bold text-gray-900">ใบสมัครเข้ารับการฝึกอบรมฝีมือแรงงาน/ทดสอบมาตรฐานฝีมือแรงงาน</h1>
      <div class="text-[12.5px] font-semibold text-gray-800 mt-0.5">
        กรมพัฒนาฝีมือแรงงาน กระทรวงแรงงาน หน่วยงาน: ${valOrDot(d.agency || 'HR Bitwise Group / สพร. / สนพ.', 35)}
      </div>
    </div>

    <!-- Section: ความประสงค์ -->
    <div class="my-2 space-y-1">
      <div class="flex flex-wrap items-center gap-2">
        <span class="font-medium">ข้าพเจ้ามีความประสงค์เข้ารับ</span>
        <span class="font-semibold">การฝึกอบรมฝีมือแรงงาน</span>
        <span>${check(objectives.includes('ฝึกเตรียมเข้าทำงาน'))} ฝึกเตรียมเข้าทำงาน</span>
        <span>${check(objectives.includes('ฝึกยกระดับฝีมือแรงงาน'))} ฝึกยกระดับฝีมือแรงงาน</span>
        <span>${check(objectives.includes('ฝึกอาชีพเสริม'))} ฝึกอาชีพเสริม</span>
        <span>${check(objectives.includes('ฝึกคนครัวบนเรือ'))} ฝึกคนครัวบนเรือ</span>
      </div>
      <div class="flex flex-wrap items-center gap-2 pl-40">
        <span class="font-semibold">การทดสอบฝีมือแรงงาน</span>
        <span>${check(tests.includes('ทดสอบมาตรฐานฝีมือแรงงานแห่งชาติ'))} ทดสอบมาตรฐานฝีมือแรงงานแห่งชาติ</span>
      </div>
      <div class="flex flex-wrap items-center gap-2 mt-0.5">
        <span>หลักสูตร (ฝึกอบรม) ${valOrDot(d.course, 30)}</span>
        <span>จำนวนชั่วโมงฝึก ${valOrDot(d.trainingHours, 8)} ชั่วโมง</span>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <span>สาขา (ทดสอบ) ${valOrDot(d.branch, 25)}</span>
        <span>ระดับ (ทดสอบ) ${valOrDot(d.level, 10)}</span>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <span>ประเภทผู้สมัคร (ทดสอบ)</span>
        <span>${check(applicantTypes.includes('ผู้รับการฝึกจาก กพร.'))} ผู้รับการฝึกจาก กพร.</span>
        <span>${check(applicantTypes.includes('จากสถานศึกษา'))} จากสถานศึกษา</span>
        <span>${check(applicantTypes.includes('จากภาครัฐ'))} จากภาครัฐ</span>
        <span>${check(applicantTypes.includes('จากเอกชน'))} จากเอกชน</span>
        <span>${check(applicantTypes.includes('บุคคลทั่วไป'))} บุคคลทั่วไป</span>
      </div>
      <div>ระหว่างวันที่ ${valOrDot(d.startDate, 30)}</div>
    </div>

    <!-- 1. ข้อมูลส่วนบุคคล -->
    <div class="border-t border-gray-300 pt-1.5 mt-1.5">
      <div class="font-bold text-gray-900 mb-1">1. ข้อมูลส่วนบุคคล</div>
      <div class="grid grid-cols-1 gap-1">
        <div class="flex flex-wrap items-center gap-2">
          <span>ชื่อ-สกุล ภาษาไทย: ${valOrDot((d.title || '') + ' ' + (d.firstName || '') + ' ' + (d.lastName || ''), 35)}</span>
          <span>เพศ: ${valOrDot(d.gender, 10)}</span>
        </div>
        <div>ชื่อ-สกุล ภาษาอังกฤษ: ${valOrDot(d.fullNameEn, 40)}</div>
        <div class="flex flex-wrap items-center gap-2">
          <span>เลขบัตรประชาชน: ${valOrDot(d.idCard, 20)}</span>
          <span>สัญชาติ: ${valOrDot(d.nationality || 'ไทย', 10)}</span>
          <span>วัน/เดือน/ปีเกิด: ${valOrDot(d.birthDate, 15)}</span>
          <span>โทรศัพท์: ${valOrDot(d.phone, 15)}</span>
        </div>
        <div>อีเมล (ถ้ามี): ${valOrDot(d.email, 30)}</div>
        <div class="flex flex-wrap items-center gap-2">
          <span>ที่อยู่ตามทะเบียนบ้าน/ตามบัตรประชาชน เลขที่: ${valOrDot(d.addressNo, 8)}</span>
          <span>หมู่: ${valOrDot(d.moo, 4)}</span>
          <span>ถนน: ${valOrDot(d.street, 12)}</span>
          <span>ซอย: ${valOrDot(d.soi, 12)}</span>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <span>แขวง/ตำบล: ${valOrDot(d.subdistrict, 15)}</span>
          <span>เขต/อำเภอ: ${valOrDot(d.district, 15)}</span>
          <span>จังหวัด: ${valOrDot(d.province, 15)}</span>
          <span>รหัสไปรษณีย์: ${valOrDot(d.zipcode, 10)}</span>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <span>วุฒิการศึกษาสูงสุด:</span>
          <span>${check(d.education === 'ประถมศึกษา')} ประถมศึกษา</span>
          <span>${check(d.education === 'มัธยมต้น')} มัธยมต้น</span>
          <span>${check(d.education === 'มัธยมปลาย')} มัธยมปลาย</span>
          <span>${check(d.education === 'อนุปริญญา')} อนุปริญญา</span>
          <span>${check(d.education === 'ปวช.')} ปวช.</span>
          <span>${check(d.education === 'ปวส./ปวท.')} ปวส./ปวท.</span>
          <span>${check(d.education === 'ปริญญาตรีขึ้นไป')} ปริญญาตรีขึ้นไป</span>
          <span>${check(d.education === 'ไม่จบการศึกษา')} ไม่จบการศึกษา</span>
        </div>
        <div>สาขาที่เรียน: ${valOrDot(d.educationMajor, 30)}</div>
        <div class="flex flex-wrap items-center gap-2">
          <span>สภาพร่างกาย:</span>
          <span>${check(d.bodyCondition === 'ปกติ')} ปกติ</span>
          <span>${check(d.bodyCondition === 'พิการ')} พิการ (</span>
          <span>${check(disabilities.includes('การเห็น'))} การเห็น</span>
          <span>${check(disabilities.includes('การได้ยินหรือสื่อความหมาย'))} การได้ยินฯ</span>
          <span>${check(disabilities.includes('การเคลื่อนไหวหรือทางร่างกาย'))} การเคลื่อนไหวฯ</span>
          <span>${check(disabilities.includes('ทางจิตใจหรือพฤติกรรม'))} ทางจิตใจฯ</span>
          <span>${check(disabilities.includes('ทางสติปัญญา'))} ทางสติปัญญา</span>
          <span>${check(disabilities.includes('การเรียนรู้'))} การเรียนรู้</span>
          <span>${check(disabilities.includes('ทางออทิสติก'))} ทางออทิสติก )</span>
        </div>
      </div>
    </div>

    <!-- 2. สถานภาพแรงงาน -->
    <div class="border-t border-gray-300 pt-1.5 mt-1.5">
      <div class="font-bold text-gray-900 mb-1">
        2. สถานภาพแรงงาน: 
        <span class="ml-2 font-normal">${check(d.employmentStatus === 'employed')} ทำงาน (กรอกข้อ 2.1)</span>
        <span class="ml-4 font-normal">${check(d.employmentStatus === 'unemployed')} ไม่ทำงานหรือว่างงาน (กรอกข้อ 2.2)</span>
      </div>

      <!-- 2.1 ผู้มีงานทำ -->
      <div class="pl-4 my-1 space-y-1 ${d.employmentStatus === 'employed' ? '' : 'opacity-60'}">
        <div class="flex flex-wrap items-center gap-2">
          <span class="font-semibold">2.1 ผู้มีงานทำ:</span>
          <span>${check(d.workSector === 'private')} ภาคเอกชน</span>
          <span>${check(d.workSector === 'state_enterprise')} รัฐวิสาหกิจ</span>
          <span>${check(d.workSector === 'government')} ภาครัฐ ( ${valOrDot(d.govtType, 15)} )</span>
          <span>${check(d.workSector === 'business')} ประกอบธุรกิจส่วนตัว/อิสระ ( ${valOrDot(d.freelanceType, 15)} )</span>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <span>รายได้เฉลี่ยต่อเดือน: ${valOrDot(d.monthlyIncome, 15)} บาท</span>
          <span>อาชีพ: ${valOrDot(d.occupation, 15)}</span>
          <span>ตำแหน่ง: ${valOrDot(d.position, 15)}</span>
          <span>อายุงาน: ${valOrDot(d.workExperienceYears, 5)} ปี</span>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <span>สถานที่ทำงาน: ${valOrDot(d.workplaceName, 25)}</span>
          <span>จังหวัด: ${valOrDot(d.workplaceProvince, 15)}</span>
          <span>โทรศัพท์: ${valOrDot(d.workplacePhone, 12)}</span>
        </div>
        <div>กลุ่มอุตสาหกรรมที่ทำงาน: ${valOrDot(d.industryGroup, 35)}</div>
      </div>

      <!-- 2.2 ผู้ไม่มีงานทำ -->
      <div class="pl-4 my-1 flex flex-wrap items-center gap-2 ${d.employmentStatus === 'unemployed' ? '' : 'opacity-60'}">
        <span class="font-semibold">2.2 ผู้ที่ไม่มีงานทำ:</span>
        <span>สถานะ: ${valOrDot(d.unemployedReason, 25)}</span>
      </div>
    </div>

    <!-- 3. แหล่งที่ทราบการฝึก -->
    <div class="border-t border-gray-300 pt-1.5 mt-1.5">
      <div class="font-bold text-gray-900 mb-1">
        3. แหล่งที่ทราบการฝึก: ${valOrDot(d.infoSource, 30)}
      </div>
    </div>

    <!-- 4. การเปิดเผยข้อมูลส่วนบุคคล -->
    <div class="border-t border-gray-300 pt-1.5 mt-1.5">
      <div class="font-bold text-gray-900 mb-1">4. การเปิดเผยข้อมูลส่วนบุคคล</div>
      <div class="text-[11.5px] text-gray-700">
        ข้าพเจ้าได้อ่านและรับทราบนโยบายการคุ้มครองข้อมูลส่วนบุคคลของบริษัท/กรมพัฒนาฝีมือแรงงานแล้วและ
      </div>
      <div class="pl-2 mt-0.5 space-y-0.5">
        <div>${check(d.pdpaConsent === true || d.pdpaConsent === 'yes')} ยินยอมเปิดเผยข้อมูลส่วนบุคคลเพื่อใช้ประโยชน์ในการเชื่อมโยงและบูรณาการข้อมูลกับหน่วยงานภาครัฐ</div>
        <div class="flex flex-wrap items-center gap-2">
          <span>ความประสงค์จัดหางาน:</span>
          <span>${check(d.jobAssist === 'not_needed')} ไม่ต้องการ</span>
          <span>${check(d.jobAssist === 'domestic')} ต้องการจัดหางานในประเทศ</span>
          <span>${check(d.jobAssist === 'overseas')} ต้องการจัดหางานต่างประเทศ</span>
        </div>
      </div>
    </div>

    <!-- Signature Boxes -->
    <div class="grid grid-cols-2 gap-4 border border-gray-400 mt-3 text-[11.5px]">
      <div class="p-2.5 border-r border-gray-400 bg-gray-50 flex flex-col justify-between">
        <div>
          <div class="font-bold underline text-gray-800">(เฉพาะเจ้าหน้าที่)</div>
          <div class="mt-1">ตรวจสอบข้อมูลข้างต้นจากฐานข้อมูลในระบบ</div>
          <div>และหลักฐานตัวจริงเรียบร้อยแล้ว</div>
        </div>
        <div class="mt-4 space-y-2">
          <div>เจ้าหน้าที่รับสมัคร: .....................................................</div>
          <div>วันที่รับสมัคร: .......... / .......... / ....................</div>
        </div>
      </div>

      <div class="p-2.5 flex flex-col justify-between">
        <div>
          <div class="font-bold">ข้าพเจ้าขอรับรองว่าข้อความข้างต้นเป็นจริงทุกประการ</div>
        </div>
        <div class="mt-5 space-y-1.5 text-center">
          <div>ลงชื่อ .............................................................. ผู้สมัคร</div>
          <div>( ${valOrDot((d.title || '') + ' ' + (d.firstName || '') + ' ' + (d.lastName || ''), 25)} )</div>
          <div>วันที่: ${valOrDot(d.submittedAtDate || '......./......./..........', 15)}</div>
        </div>
      </div>
    </div>

    <!-- Attached Files Summary -->
    <div class="mt-2.5 pt-1.5 border-t border-gray-300 text-[10.5px] text-gray-600 flex flex-wrap gap-4">
      <span class="font-semibold text-gray-700">เอกสารแนบประกอบการสมัคร:</span>
      <span>${check(d.hasPhoto || Boolean(photoSrc))} ภาพถ่ายหน้าตรง</span>
      <span>${check(d.hasIdCardFile || Boolean(d.idCardFileUrl))} บัตรประชาชน (ด้านหน้า)</span>
      <span>${check(d.hasEducationFile || Boolean(d.educationFileUrl))} วุฒิการศึกษา</span>
      <span>${check(d.hasTranscriptFile || Boolean(d.transcriptFileUrl))} ทรานสคริปต์</span>
      <span>${check(d.hasWorkCertFile || Boolean(d.workCertFileUrl))} ใบรับรองการทำงาน</span>
    </div>
  </div>
  `;
}

function lockA4Layout(element) {
  if (!element) return;
  element.style.width = '210mm';
  element.style.maxWidth = '210mm';
  element.style.minHeight = '297mm';
  element.style.margin = '0';
  element.style.boxShadow = 'none';
  element.style.padding = '12mm 16mm';
  element.style.fontSize = '12.5px';
  element.style.lineHeight = '1.45';
  element.style.boxSizing = 'border-box';
}

// [FIX บั๊ก #2] ถ้าข้อมูลผู้สมัครมีแค่ "photoUrl" (ลิงก์ Google Drive จากการ sync กับ Sheet)
// และไม่มี "photoDataUrl" (Base64 ในเครื่อง) ให้ไปดึงไฟล์จาก Drive มาเป็น data URI ก่อน
// เพื่อป้องกันปัญหา html2canvas วาดรูปข้าม origin ไม่ได้ (canvas tainted) ตอนสร้าง PDF
async function resolveApplicantPhotoForRender(applicantData) {
  const d = Object.assign({}, applicantData);

  // มี Base64 อยู่แล้ว (เช่น เพิ่งสมัครใหม่ในเครื่องนี้) ใช้ได้เลย ไม่ต้องดึงซ้ำ
  if (d.photoDataUrl) return d;

  if (d.photoUrl &&
      typeof GAS_WEB_APP_URL !== 'undefined' && GAS_WEB_APP_URL &&
      typeof extractDriveFileId === 'function' &&
      typeof fetchFileAsDataUri === 'function') {
    try {
      const fileId = extractDriveFileId(d.photoUrl);
      if (fileId) {
        const dataUri = await fetchFileAsDataUri(GAS_WEB_APP_URL, fileId);
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

// [FIX บั๊ก #4] รอให้ฟอนต์ (Sarabun) และรูปภาพทั้งหมดในองค์ประกอบที่จะ capture โหลดเสร็จก่อน
// ป้องกันปัญหา html2canvas จับภาพตอนฟอนต์/รูปยังโหลดไม่เสร็จ ทำให้ตัวอักษรเพี้ยนหรือรูปว่างเปล่า
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
        /* margin ของหน้ากระดาษกำหนดเป็น 0 เพราะ .a4-page มี padding 12mm/16mm
           อยู่แล้ว (กำหนดผ่าน styles.css) — ถ้าตั้ง margin ที่ @page ซ้ำอีกชั้น
           จะกลายเป็นระยะขอบสองเท่า ทำให้พื้นที่เนื้อหาเหลือน้อยเกินไป */
        @page { size: A4 portrait; margin: 0; }
        body { font-family: 'Sarabun', sans-serif; background: #fff; }
      </style>
    </head>
    <body class="p-0">
      ${formHtml}
      <script>
        window.onload = function() {
          var el = document.getElementById('official-form-printable');
          if (el) {
            el.style.width = '210mm';
            el.style.maxWidth = '210mm';
            el.style.margin = '0';
            el.style.boxShadow = 'none';
            el.style.boxSizing = 'border-box';
          }
          // รอฟอนต์ให้พร้อมก่อนสั่งพิมพ์ (กันข้อความเพี้ยนเวลาเน็ตช้า/ฟอนต์ยังโหลดไม่เสร็จ)
          var fontsReady = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
          fontsReady.then(function() {
            setTimeout(function() {
              window.print();
            }, 400);
          });
        };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

// [FIX บั๊ก #2 + #4] เปลี่ยนเป็น async: ดึงรูปจาก Drive มาฝังก่อน (ถ้าจำเป็น)
// แล้วรอฟอนต์/รูปโหลดเสร็จก่อนค่อย capture เป็น PDF
async function downloadApplicantPDF(applicantData) {
  const container = document.getElementById('pdf-render-scratch');
  if (!container) return;

  const dataForRender = await resolveApplicantPhotoForRender(applicantData);

  container.innerHTML = renderOfficialFormHTML(dataForRender);
  const element = document.getElementById('official-form-printable');
  lockA4Layout(element);

  await waitForElementReady(element);

  const opt = {
    margin: 0,
    filename: `ใบสมัคร_${applicantData.firstName || 'applicant'}_${applicantData.lastName || ''}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      windowWidth: 900,
      scrollX: 0,
      scrollY: 0
    },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['css', 'legacy'] }
  };

  if (typeof html2pdf !== 'undefined') {
    html2pdf().set(opt).from(element).save();
  } else {
    printApplicantForm(dataForRender);
  }
}

async function saveApplicantPdfToDrive(applicantData) {
  if (typeof GAS_WEB_APP_URL === 'undefined' || !GAS_WEB_APP_URL) {
    alert('ไม่พบการตั้งค่า Google Apps Script Web App URL (GAS_WEB_APP_URL) กรุณาตั้งค่าในไฟล์ gs-api.js ก่อน');
    return;
  }
  if (typeof html2pdf === 'undefined') {
    alert('ไม่พบไลบรารี html2pdf ไม่สามารถสร้างไฟล์ PDF ได้');
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

    // [FIX บั๊ก #2] ดึงรูปจาก Google Drive มาฝังเป็น Base64 ก่อน ถ้าไม่มี Base64 ในเครื่องอยู่แล้ว
    const dataForRender = await resolveApplicantPhotoForRender(applicantData);

    scratch.innerHTML = renderOfficialFormHTML(dataForRender);
    const element = document.getElementById('official-form-printable');
    lockA4Layout(element);

    // [FIX บั๊ก #4] รอฟอนต์/รูปโหลดเสร็จก่อน capture
    await waitForElementReady(element);

    const opt = {
      margin: 0,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        windowWidth: 900,
        scrollX: 0,
        scrollY: 0
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'] }
    };

    const pdfDataUri = await html2pdf().set(opt).from(element).outputPdf('datauristring');

    const fileName = `ใบสมัคร_${applicantData.firstName || 'applicant'}_${applicantData.lastName || ''}_${applicantData.id || Date.now()}.pdf`;

    const result = await callGasApi(GAS_WEB_APP_URL, {
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