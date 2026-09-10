// app.js - สคริปต์สำหรับหน้ารับสมัครผู้เข้ารับการฝึกอบรม (index.html)
const STORAGE_KEYS = {
  APPLICANTS: 'bw_skill_applicants',
  CALENDAR_EVENTS: 'bw_calendar_events',
  GOOGLE_SHEET_URL: 'bw_google_sheet_url',
  ADMIN_PIN: 'bw_admin_pin',
  NOTIFICATIONS: 'bw_notifications'
};

const SAMPLE_AVATAR = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="150" viewBox="0 0 120 150"><rect width="120" height="150" fill="%23f1f5f9"/><circle cx="60" cy="50" r="25" fill="%230284c7"/><path d="M24 135 C24 95 96 95 96 135 Z" fill="%230f172a"/><circle cx="60" cy="48" r="21" fill="%23fed7aa"/><path d="M44 42 Q60 32 76 42 Q60 38 44 42 Z" fill="%231e293b"/><text x="60" y="144" font-family="sans-serif" font-size="8" fill="%2364748b" text-anchor="middle">HR Bitwise</text></svg>';

const DEFAULT_APPLICANTS = [
  {
    id: 'BW-202609-001',
    submittedAt: '2026-09-08 10:30',
    submittedAtDate: '08/09/2569',
    agency: 'กลุ่ม HR Bitwise Group',
    objectives: ['ฝึกยกระดับฝีมือแรงงาน'],
    tests: ['ทดสอบมาตรฐานฝีมือแรงงานแห่งชาติ'],
    course: 'ช่างเครื่องปรับอากาศในบ้านและการพาณิชย์ขนาดเล็ก',
    trainingHours: 30,
    branch: 'ช่างเครื่องปรับอากาศ',
    level: 'ระดับ 1',
    applicantTypes: ['บุคคลทั่วไป'],
    startDate: '2026-09-20',
    title: 'นาย',
    firstName: 'สมชาย',
    lastName: 'สายลมเย็น',
    gender: 'ชาย',
    fullNameEn: 'Somchai Sailomyen',
    idCard: '1-1002-34567-89-0',
    nationality: 'ไทย',
    birthDate: '1995-05-14',
    phone: '081-234-5678',
    email: 'somchai.s@email.com',
    addressNo: '99/12',
    moo: '3',
    street: 'สุขุมวิท',
    soi: 'สุขุมวิท 71',
    province: 'สมุทรปราการ',
    district: 'บางพลี',
    subdistrict: 'บางแก้ว',
    zipcode: '10540',
    education: 'ปวส./ปวท.',
    educationMajor: 'ช่างไฟฟ้ากำลัง',
    bodyCondition: 'ปกติ',
    disabilities: [],
    employmentStatus: 'employed',
    workSector: 'private',
    govtType: '',
    freelanceType: '',
    monthlyIncome: '18,500',
    occupation: 'ช่างบริการ',
    position: 'ช่างเทคนิค',
    workExperienceYears: '3',
    workplaceName: 'บริษัท สยามเซอร์วิส จำกัด',
    workplaceProvince: 'สมุทรปราการ',
    workplacePhone: '02-765-4321',
    industryGroup: 'อิเล็กทรอนิกส์อัจฉริยะ',
    unemployedReason: '',
    infoSource: 'สื่อออนไลน์ต่างๆ',
    pdpaConsent: true,
    jobAssist: 'not_needed',
    photoDataUrl: SAMPLE_AVATAR,
    hasPhoto: true,
    hasIdCardFile: true,
    hasEducationFile: true,
    hasTranscriptFile: false,
    hasWorkCertFile: true,
    attended: true
  },
  {
    id: 'BW-202609-002',
    submittedAt: '2026-09-09 14:15',
    submittedAtDate: '09/09/2569',
    agency: 'กลุ่ม HR Bitwise Group',
    objectives: ['ฝึกเตรียมเข้าทำงาน'],
    tests: ['ทดสอบมาตรฐานฝีมือแรงงานแห่งชาติ'],
    course: 'เทคนิคการติดตั้งระบบปรับอากาศ VRV/VRF',
    trainingHours: 60,
    branch: 'ช่างเครื่องทำความเย็น',
    level: 'ระดับ 2',
    applicantTypes: ['จากสถานศึกษา', 'บุคคลทั่วไป'],
    startDate: '2026-09-20',
    title: 'นางสาว',
    firstName: 'วรรณา',
    lastName: 'ทองประเสริฐ',
    gender: 'หญิง',
    fullNameEn: 'Wanna Thongprasert',
    idCard: '3-1004-98765-43-2',
    nationality: 'ไทย',
    birthDate: '2001-08-22',
    phone: '089-876-5432',
    email: 'wanna.th@email.com',
    addressNo: '45/8',
    moo: '2',
    street: 'ศรีนครินทร์',
    soi: 'วัดด่านสำโรง',
    province: 'สมุทรปราการ',
    district: 'เมืองสมุทรปราการ',
    subdistrict: 'สำโรงเหนือ',
    zipcode: '10270',
    education: 'ปริญญาตรีขึ้นไป',
    educationMajor: 'วิศวกรรมเครื่องกล',
    bodyCondition: 'ปกติ',
    disabilities: [],
    employmentStatus: 'unemployed',
    workSector: '',
    govtType: '',
    freelanceType: '',
    monthlyIncome: '',
    occupation: '',
    position: '',
    workExperienceYears: '',
    workplaceName: '',
    workplaceProvince: '',
    workplacePhone: '',
    industryGroup: '',
    unemployedReason: 'นักเรียน/นักศึกษา',
    infoSource: 'สื่อออนไลน์ต่างๆ',
    pdpaConsent: true,
    jobAssist: 'domestic',
    photoDataUrl: '',
    hasPhoto: true,
    hasIdCardFile: true,
    hasEducationFile: true,
    hasTranscriptFile: true,
    hasWorkCertFile: false,
    attended: false
  }
];

let applicants = [];

document.addEventListener('DOMContentLoaded', () => {
  initApplicantsData();
  setupFormDynamicControls();
  setupAddressDropdowns();
});

function initApplicantsData() {
  const saved = localStorage.getItem(STORAGE_KEYS.APPLICANTS);
  if (saved) {
    try { applicants = JSON.parse(saved); }
    catch (e) { applicants = DEFAULT_APPLICANTS; }
  } else {
    applicants = DEFAULT_APPLICANTS;
    localStorage.setItem(STORAGE_KEYS.APPLICANTS, JSON.stringify(applicants));
  }
}

// ฟังก์ชันแปลงไฟล์เป็น Base64 Data URL
function readFileAsDataUrl(file) {
  return new Promise((resolve) => {
    if (!file) {
      resolve('');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

function setupFormDynamicControls() {
  // สภาพร่างกาย
  const bodyNormal = document.getElementById('body-normal');
  const bodyDisability = document.getElementById('body-disability');
  const disabilityContainer = document.getElementById('disability-details-container');

  if (bodyNormal && bodyDisability && disabilityContainer) {
    bodyNormal.addEventListener('change', () => {
      if (bodyNormal.checked) {
        bodyDisability.checked = false;
        disabilityContainer.classList.add('hidden');
      }
    });

    bodyDisability.addEventListener('change', () => {
      if (bodyDisability.checked) {
        bodyNormal.checked = false;
        disabilityContainer.classList.remove('hidden');
      } else {
        disabilityContainer.classList.add('hidden');
      }
    });
  }

  // สถานภาพแรงงาน (ข้อ 2)
  const empWorking = document.getElementById('emp-working');
  const empUnemployed = document.getElementById('emp-unemployed');
  const section21 = document.getElementById('section-2-1');
  const section22 = document.getElementById('section-2-2');

  function updateEmploymentView() {
    if (empWorking && empWorking.checked) {
      section21.classList.remove('hidden');
      section22.classList.add('hidden');
    } else if (empUnemployed && empUnemployed.checked) {
      section21.classList.add('hidden');
      section22.classList.remove('hidden');
    }
  }

  if (empWorking && empUnemployed) {
    empWorking.addEventListener('change', updateEmploymentView);
    empUnemployed.addEventListener('change', updateEmploymentView);
  }

  // ตัวเลือกย่อยภาครัฐ / ธุรกิจส่วนตัว
  const sectorGovt = document.getElementById('sector-govt');
  const govtSub = document.getElementById('govt-sub-select');
  const freelanceSub = document.getElementById('freelance-sub-select');
  const sectorBusiness = document.getElementById('sector-business');

  document.querySelectorAll('input[name="workSector"]').forEach(radio => {
    radio.addEventListener('change', () => {
      if (govtSub && sectorGovt) govtSub.disabled = !sectorGovt.checked;
      if (freelanceSub && sectorBusiness) freelanceSub.disabled = !sectorBusiness.checked;
    });
  });

  // จัดรูปแบบเลขบัตรประชาชน
  const idCardInput = document.getElementById('idCard');
  if (idCardInput) {
    idCardInput.addEventListener('input', (e) => {
      let val = e.target.value.replace(/\D/g, '').substring(0, 13);
      let formatted = '';
      if (val.length > 0) formatted += val.substring(0, 1);
      if (val.length > 1) formatted += '-' + val.substring(1, 5);
      if (val.length > 5) formatted += '-' + val.substring(5, 10);
      if (val.length > 10) formatted += '-' + val.substring(10, 12);
      if (val.length > 12) formatted += '-' + val.substring(12, 13);
      e.target.value = formatted;
    });
  }

  // พรีวิวไฟล์รูปภาพและเอกสาร
  const photoInput = document.getElementById('filePhoto');
  const photoLabel = document.getElementById('filePhotoLabel');
  if (photoInput && photoLabel) {
    photoInput.addEventListener('change', () => {
      if (photoInput.files && photoInput.files[0]) {
        const file = photoInput.files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
          photoLabel.innerHTML = `
            <div class="flex items-center justify-center gap-1.5 mt-1 text-emerald-600 font-semibold">
              <img src="${e.target.result}" class="w-8 h-10 rounded border border-emerald-400 object-cover shadow-sm">
              <span>✓ ${file.name.substring(0, 12)}...</span>
            </div>
          `;
        };
        reader.readAsDataURL(file);
      }
    });
  }

  const otherFileInputs = ['fileIdCard', 'fileEdu', 'fileTranscript', 'fileWorkCert'];
  otherFileInputs.forEach(inputId => {
    const input = document.getElementById(inputId);
    const label = document.getElementById(inputId + 'Label');
    if (input && label) {
      input.addEventListener('change', () => {
        if (input.files && input.files[0]) {
          label.innerHTML = `✓ ${input.files[0].name.substring(0, 18)}...`;
          label.classList.add('text-green-600', 'font-semibold');
        }
      });
    }
  });

  const regForm = document.getElementById('registration-form');
  if (regForm) {
    regForm.addEventListener('submit', handleFormSubmit);
  }
}

function setupAddressDropdowns() {
  const provSelect = document.getElementById('address-province');
  const distSelect = document.getElementById('address-district');
  const subdistSelect = document.getElementById('address-subdistrict');
  const zipInput = document.getElementById('address-zipcode');

  if (!provSelect || typeof THAI_PROVINCES === 'undefined') return;

  provSelect.innerHTML = '<option value="">-- เลือกจังหวัด --</option>';
  THAI_PROVINCES.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p;
    opt.textContent = p;
    provSelect.appendChild(opt);
  });

  provSelect.addEventListener('change', () => {
    const prov = provSelect.value;
    distSelect.innerHTML = '<option value="">-- เลือกเขต/อำเภอ --</option>';
    subdistSelect.innerHTML = '<option value="">-- เลือกแขวง/ตำบล --</option>';
    zipInput.value = '';

    if (typeof THAI_DISTRICT_MAP !== 'undefined' && THAI_DISTRICT_MAP[prov]) {
      THAI_DISTRICT_MAP[prov].forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.district;
        opt.textContent = d.district;
        distSelect.appendChild(opt);
      });
    } else {
      const opt = document.createElement('option');
      opt.value = 'เมือง' + prov;
      opt.textContent = 'อำเภอเมือง' + prov;
      distSelect.appendChild(opt);
    }
  });

  distSelect.addEventListener('change', () => {
    const prov = provSelect.value;
    const distName = distSelect.value;
    subdistSelect.innerHTML = '<option value="">-- เลือกแขวง/ตำบล --</option>';

    if (typeof THAI_DISTRICT_MAP !== 'undefined' && THAI_DISTRICT_MAP[prov]) {
      const found = THAI_DISTRICT_MAP[prov].find(d => d.district === distName);
      if (found) {
        zipInput.value = found.zip || '';
        found.subdistricts.forEach(s => {
          const opt = document.createElement('option');
          opt.value = s;
          opt.textContent = s;
          subdistSelect.appendChild(opt);
        });
      }
    }
  });
}

async function handleFormSubmit(e) {
  e.preventDefault();

  const pdpaCheck = document.getElementById('pdpa-consent');
  if (!pdpaCheck || !pdpaCheck.checked) {
    alert('กรุณาทำเครื่องหมายยินยอมเปิดเผยข้อมูลส่วนบุคคล (PDPA) เพื่อดำเนินการต่อ');
    pdpaCheck.focus();
    return;
  }

  showLoading(true);

  // อ่านรูปถ่ายหน้าตรงเป็น Base64
  let photoDataUrl = '';
  const photoInput = document.getElementById('filePhoto');
  if (photoInput && photoInput.files && photoInput.files[0]) {
    try {
      photoDataUrl = await readFileAsDataUrl(photoInput.files[0]);
    } catch (err) {
      console.warn('Error reading photo:', err);
    }
  }

  const getChecked = (selector) => Array.from(document.querySelectorAll(selector + ':checked')).map(el => el.value);

  const now = new Date();
  const thaiYear = now.getFullYear() + 543;
  const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${thaiYear}`;
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const newId = `BW-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${String(applicants.length + 1).padStart(3, '0')}`;

  const newApplicant = {
    id: newId,
    submittedAt: `${now.toISOString().split('T')[0]} ${timeStr}`,
    submittedAtDate: dateStr,
    agency: document.getElementById('agency')?.value || 'กลุ่ม HR Bitwise Group',
    objectives: getChecked('input[name="objectives"]'),
    tests: getChecked('input[name="tests"]'),
    course: document.getElementById('course')?.value || '',
    trainingHours: document.getElementById('trainingHours')?.value || '',
    branch: document.getElementById('branch')?.value || '',
    level: document.getElementById('level')?.value || '',
    applicantTypes: getChecked('input[name="applicantTypes"]'),
    startDate: document.getElementById('startDate')?.value || '',
    title: document.getElementById('title')?.value || '',
    firstName: document.getElementById('firstName')?.value || '',
    lastName: document.getElementById('lastName')?.value || '',
    gender: document.getElementById('gender')?.value || '',
    fullNameEn: document.getElementById('fullNameEn')?.value || '',
    idCard: document.getElementById('idCard')?.value || '',
    nationality: document.getElementById('nationality')?.value || 'ไทย',
    birthDate: document.getElementById('birthDate')?.value || '',
    phone: document.getElementById('phone')?.value || '',
    email: document.getElementById('email')?.value || '',
    addressNo: document.getElementById('addressNo')?.value || '',
    moo: document.getElementById('moo')?.value || '',
    street: document.getElementById('street')?.value || '',
    soi: document.getElementById('soi')?.value || '',
    province: document.getElementById('address-province')?.value || '',
    district: document.getElementById('address-district')?.value || '',
    subdistrict: document.getElementById('address-subdistrict')?.value || '',
    zipcode: document.getElementById('address-zipcode')?.value || '',
    education: document.getElementById('education')?.value || '',
    educationMajor: document.getElementById('educationMajor')?.value || '',
    bodyCondition: document.getElementById('body-disability')?.checked ? 'พิการ' : 'ปกติ',
    disabilities: getChecked('input[name="disabilities"]'),
    employmentStatus: document.getElementById('emp-working')?.checked ? 'employed' : 'unemployed',
    workSector: document.querySelector('input[name="workSector"]:checked')?.value || '',
    govtType: document.getElementById('govt-sub-select')?.value || '',
    freelanceType: document.getElementById('freelance-sub-select')?.value || '',
    monthlyIncome: document.getElementById('monthlyIncome')?.value || '',
    occupation: document.getElementById('occupation')?.value || '',
    position: document.getElementById('position')?.value || '',
    workExperienceYears: document.getElementById('workExperienceYears')?.value || '',
    workplaceName: document.getElementById('workplaceName')?.value || '',
    workplaceProvince: document.getElementById('workplaceProvince')?.value || '',
    workplacePhone: document.getElementById('workplacePhone')?.value || '',
    industryGroup: document.getElementById('industryGroup')?.value || '',
    unemployedReason: document.getElementById('unemployedReason')?.value || '',
    infoSource: document.getElementById('infoSource')?.value || '',
    pdpaConsent: true,
    jobAssist: document.querySelector('input[name="jobAssist"]:checked')?.value || 'not_needed',
    photoDataUrl: photoDataUrl,
    hasPhoto: Boolean(photoDataUrl),
    hasIdCardFile: Boolean(document.getElementById('fileIdCard')?.files?.[0]),
    hasEducationFile: Boolean(document.getElementById('fileEdu')?.files?.[0]),
    hasTranscriptFile: Boolean(document.getElementById('fileTranscript')?.files?.[0]),
    hasWorkCertFile: Boolean(document.getElementById('fileWorkCert')?.files?.[0]),
    attended: false
  };

  applicants.unshift(newApplicant);
  localStorage.setItem(STORAGE_KEYS.APPLICANTS, JSON.stringify(applicants));

  // บันทึกการแจ้งเตือน
  let list = [];
  try { list = JSON.parse(localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS) || '[]'); } catch (e) { list = []; }
  list.unshift({
    id: 'notif-' + Date.now(),
    title: 'มีผู้สมัครใหม่เข้ามา!',
    message: `${newApplicant.title} ${newApplicant.firstName} ${newApplicant.lastName} สมัครหลักสูตร ${newApplicant.course}`,
    time: dateStr + ' ' + timeStr,
    applicantId: newApplicant.id
  });
  if (list.length > 20) list = list.slice(0, 20);
  localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(list));

  // ซิงค์เข้า Google Sheet
  const sheetUrl = localStorage.getItem(STORAGE_KEYS.GOOGLE_SHEET_URL);
  if (sheetUrl) {
    try {
      await fetch(sheetUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'addApplicant', data: newApplicant })
      });
    } catch (err) {
      console.warn('Google Sheet Sync note:', err);
    }
  }

  showLoading(false);
  showSubmitSuccessModal(newApplicant);
}

function showSubmitSuccessModal(applicant) {
  const modal = document.getElementById('success-modal');
  const details = document.getElementById('success-modal-details');
  if (modal && details) {
    details.innerHTML = `
      <div class="bg-blue-50 border border-blue-200 rounded-xl p-4 text-left text-sm space-y-2">
        <div class="flex items-center gap-3 border-b border-blue-200 pb-2 mb-2">
          ${applicant.photoDataUrl ? `<img src="${applicant.photoDataUrl}" class="w-12 h-14 object-cover rounded border border-blue-300 shadow-sm">` : ''}
          <div>
            <div class="text-xs text-blue-600 font-semibold">รหัสผู้สมัคร</div>
            <div class="text-blue-900 font-bold text-base">${applicant.id}</div>
          </div>
        </div>
        <div><strong>ชื่อ-นามสกุล:</strong> ${applicant.title} ${applicant.firstName} ${applicant.lastName}</div>
        <div><strong>หลักสูตร:</strong> ${applicant.course || '-'}</div>
        <div><strong>เบอร์โทรศัพท์:</strong> ${applicant.phone}</div>
        <div><strong>วันที่สมัคร:</strong> ${applicant.submittedAtDate}</div>
      </div>
    `;

    const printBtn = document.getElementById('btn-print-immediate');
    if (printBtn) {
      printBtn.onclick = () => printApplicantForm(applicant);
    }

    const downloadBtn = document.getElementById('btn-download-immediate');
    if (downloadBtn) {
      downloadBtn.onclick = () => downloadApplicantPDF(applicant);
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

function closeSuccessModal() {
  const modal = document.getElementById('success-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    const form = document.getElementById('registration-form');
    if (form) form.reset();
  }
}

function showLoading(show) {
  const spinner = document.getElementById('global-spinner-overlay');
  if (spinner) {
    if (show) {
      spinner.classList.remove('hidden');
      spinner.classList.add('flex');
    } else {
      spinner.classList.add('hidden');
      spinner.classList.remove('flex');
    }
  }
}