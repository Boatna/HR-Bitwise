const STORAGE_KEYS = {
  APPLICANTS: 'bw_skill_applicants',
  CALENDAR_EVENTS: 'bw_calendar_events',
  ADMIN_PIN: 'bw_admin_pin',
  NOTIFICATIONS: 'bw_notifications'
};

function escapeHtml(str) {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

let applicants = [];

document.addEventListener('DOMContentLoaded', async () => {
  await initApplicantsData();
  setupFormDynamicControls();
  setupAddressDropdowns();
});

function loadLocalApplicants() {
  const saved = localStorage.getItem(STORAGE_KEYS.APPLICANTS);
  if (saved) {
    try { return JSON.parse(saved); } catch (e) { return []; }
  }
  return [];
}

async function initApplicantsData() {
  applicants = loadLocalApplicants();
  try {
    const result = await fetchGasApi(GAS_WEB_APP_URL + '?action=getApplicants');
    if (result && result.status === 'success' && Array.isArray(result.data)) {
      const byId = new Map();
      applicants.forEach(a => byId.set(a.id, a));
      result.data.forEach(a => byId.set(a.id, Object.assign({}, byId.get(a.id) || {}, a)));
      applicants = Array.from(byId.values());
      localStorage.setItem(STORAGE_KEYS.APPLICANTS, JSON.stringify(applicants));
    } else if (result && result.status === 'error') {
      console.warn('ไม่สามารถซิงค์ข้อมูลผู้สมัครจาก Google Sheet ได้:', result.message);
    }
  } catch (err) {
    console.warn('ไม่สามารถซิงค์ข้อมูลผู้สมัครจาก Google Sheet ได้ (จะใช้ข้อมูลในเครื่องแทน):', err);
  }
}

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

// [FIX บั๊ก #1] เดิม "เขต/อำเภอ" และ "แขวง/ตำบล" เป็น <select> ที่บังคับกรอก (required)
// แต่ THAI_DISTRICT_MAP มีข้อมูลแค่ ~6 จังหวัด จาก 77 จังหวัด ทำให้จังหวัดอื่นๆ ที่เหลือ
// dropdown ตำบลจะไม่มีตัวเลือกให้เลือกเลย และส่งฟอร์มไม่ได้ตลอดกาล
// ตอนนี้เปลี่ยนเป็น <input type="text" list="..."> (combobox) แทน:
//   - ถ้ามีข้อมูลในระบบ จะมีตัวเลือกให้กด autocomplete เหมือนเดิม
//   - ถ้าไม่มีข้อมูล ผู้ใช้ยังพิมพ์ชื่ออำเภอ/ตำบลเองได้ตามปกติ ไม่ติดบล็อกฟอร์ม
function setupAddressDropdowns() {
  const provSelect = document.getElementById('address-province');
  const distInput = document.getElementById('address-district');
  const subdistInput = document.getElementById('address-subdistrict');
  const distDatalist = document.getElementById('district-options');
  const subdistDatalist = document.getElementById('subdistrict-options');
  const zipInput = document.getElementById('address-zipcode');

  if (!provSelect || typeof THAI_PROVINCES === 'undefined') return;

  provSelect.innerHTML = '<option value="">-- เลือกจังหวัด --</option>';
  THAI_PROVINCES.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p;
    opt.textContent = p;
    provSelect.appendChild(opt);
  });

  function fillDistrictDatalist(prov) {
    if (!distDatalist) return;
    distDatalist.innerHTML = '';
    if (typeof THAI_DISTRICT_MAP !== 'undefined' && THAI_DISTRICT_MAP[prov]) {
      THAI_DISTRICT_MAP[prov].forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.district;
        distDatalist.appendChild(opt);
      });
    }
  }

  function fillSubdistrictDatalist(prov, distName) {
    if (!subdistDatalist) return;
    subdistDatalist.innerHTML = '';
    if (typeof THAI_DISTRICT_MAP !== 'undefined' && THAI_DISTRICT_MAP[prov]) {
      const found = THAI_DISTRICT_MAP[prov].find(d => d.district === distName);
      if (found) {
        found.subdistricts.forEach(s => {
          const opt = document.createElement('option');
          opt.value = s;
          subdistDatalist.appendChild(opt);
        });
      }
    }
  }

  if (!distInput || !subdistInput) return;

  provSelect.addEventListener('change', () => {
    const prov = provSelect.value;
    distInput.value = '';
    subdistInput.value = '';
    zipInput.value = '';
    fillDistrictDatalist(prov);
    if (subdistDatalist) subdistDatalist.innerHTML = '';
  });

  function handleDistrictInput() {
    const prov = provSelect.value;
    const distName = distInput.value.trim();
    subdistInput.value = '';
    fillSubdistrictDatalist(prov, distName);

    if (typeof THAI_DISTRICT_MAP !== 'undefined' && THAI_DISTRICT_MAP[prov]) {
      const found = THAI_DISTRICT_MAP[prov].find(d => d.district === distName);
      if (found && found.zip) {
        zipInput.value = found.zip;
      }
    }
  }

  distInput.addEventListener('input', handleDistrictInput);
  distInput.addEventListener('change', handleDistrictInput);
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

  const sheetUrl = GAS_WEB_APP_URL;
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
  const newId = `BW-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getTime()).slice(-6)}`;

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
    photoUrl: '',
    idCardFileUrl: '',
    educationFileUrl: '',
    transcriptFileUrl: '',
    workCertFileUrl: '',
    hasPhoto: Boolean(photoDataUrl),
    hasIdCardFile: Boolean(document.getElementById('fileIdCard')?.files?.[0]),
    hasEducationFile: Boolean(document.getElementById('fileEdu')?.files?.[0]),
    hasTranscriptFile: Boolean(document.getElementById('fileTranscript')?.files?.[0]),
    hasWorkCertFile: Boolean(document.getElementById('fileWorkCert')?.files?.[0]),
    attended: false
  };
  if (sheetUrl) {
    try {
      const subfolder = newApplicant.id;
      const [photoUrl, idCardUrl, eduUrl, transcriptUrl, workCertUrl] = await Promise.all([
        uploadFileToDrive(sheetUrl, document.getElementById('filePhoto')?.files?.[0], `รูปถ่าย_${newApplicant.id}`, subfolder),
        uploadFileToDrive(sheetUrl, document.getElementById('fileIdCard')?.files?.[0], `บัตรประชาชน_${newApplicant.id}`, subfolder),
        uploadFileToDrive(sheetUrl, document.getElementById('fileEdu')?.files?.[0], `วุฒิการศึกษา_${newApplicant.id}`, subfolder),
        uploadFileToDrive(sheetUrl, document.getElementById('fileTranscript')?.files?.[0], `ทรานสคริปต์_${newApplicant.id}`, subfolder),
        uploadFileToDrive(sheetUrl, document.getElementById('fileWorkCert')?.files?.[0], `ใบรับรองงาน_${newApplicant.id}`, subfolder)
      ]);
      newApplicant.photoUrl = photoUrl;
      newApplicant.idCardFileUrl = idCardUrl;
      newApplicant.educationFileUrl = eduUrl;
      newApplicant.transcriptFileUrl = transcriptUrl;
      newApplicant.workCertFileUrl = workCertUrl;
    } catch (err) {
      console.warn('อัปโหลดไฟล์ขึ้น Google Drive ไม่สำเร็จ (ข้อมูลยังถูกบันทึกในเครื่องได้ตามปกติ):', err);
    }
  }

  applicants.unshift(newApplicant);
  localStorage.setItem(STORAGE_KEYS.APPLICANTS, JSON.stringify(applicants));
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
  if (sheetUrl) {
    try {
      const payloadForSheet = Object.assign({}, newApplicant);
      delete payloadForSheet.photoDataUrl;
      const result = await callGasApi(sheetUrl, { action: 'addApplicant', data: payloadForSheet });
      if (!result || result.status !== 'success') {
        console.warn('บันทึกลง Google Sheet ไม่สำเร็จ:', result && result.message);
      }
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
          ${applicant.photoDataUrl ? `<img src="${escapeHtml(applicant.photoDataUrl)}" class="w-12 h-14 object-cover rounded border border-blue-300 shadow-sm">` : ''}
          <div>
            <div class="text-xs text-blue-600 font-semibold">รหัสผู้สมัคร</div>
            <div class="text-blue-900 font-bold text-base">${escapeHtml(applicant.id)}</div>
          </div>
        </div>
        <div><strong>ชื่อ-นามสกุล:</strong> ${escapeHtml(applicant.title)} ${escapeHtml(applicant.firstName)} ${escapeHtml(applicant.lastName)}</div>
        <div><strong>หลักสูตร:</strong> ${escapeHtml(applicant.course) || '-'}</div>
        <div><strong>เบอร์โทรศัพท์:</strong> ${escapeHtml(applicant.phone)}</div>
        <div><strong>วันที่สมัคร:</strong> ${escapeHtml(applicant.submittedAtDate)}</div>
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

    const saveDriveBtn = document.getElementById('btn-savedrive-immediate');
    if (saveDriveBtn) {
      saveDriveBtn.onclick = () => saveApplicantPdfToDrive(applicant);
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