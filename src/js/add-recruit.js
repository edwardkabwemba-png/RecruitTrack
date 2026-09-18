// Global stage tracking
const STAGES = [
  'Sourced',
  'In Discussion',
  'Screened',
  'CV Prepared',
  'Interviewed',
  'Offer Sent',
  'Hired'
];
let currentStageIndex = 0;

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Fetch dropdown options (recruiters, sources, roles, skills, certs)
  await loadDropdowns();

  // 2. Check for URL candidate ID (e.g., add-recruit.html?id=123)
  const urlParams = new URLSearchParams(window.location.search);
  const editingRecruitId = urlParams.get('id');

  if (editingRecruitId) {
    document.title = "Edit Recruit";
    const headerTitle = document.querySelector('h1');
    if (headerTitle) headerTitle.textContent = "Edit Recruit";
    
    await loadExistingCandidateData(editingRecruitId);
  }

  // 3. Attach submit handler
  const form = document.getElementById('recruitForm');
  if (form) {
    form.addEventListener('submit', (e) => handleFormSubmit(e, editingRecruitId));
  }
});

async function loadDropdowns() {
  try {
    const res = await fetch('/api/recruits?action=dropdowns');
    const data = await res.json();

    populateSelect('recruiterSelect', data.recruiters, 'UserID', 'FullName');
    populateSelect('sourceSelect', data.sources, 'SourceID', 'SourceName');
    populateSelect('roleSelect', data.roles, 'RoleID', 'RoleTitle');
    populateSelect('skillsSelect', data.skills, 'SkillName', 'SkillName');
    populateSelect('certsSelect', data.certifications, 'CertName', 'CertName');
  } catch (err) {
    console.error("Error loading dropdown options:", err);
  }
}

function populateSelect(elementId, items, valueKey, textKey) {
  const select = document.getElementById(elementId);
  if (!select || !items) return;
  
  items.forEach(item => {
    const opt = document.createElement('option');
    opt.value = item[valueKey];
    opt.textContent = item[textKey];
    select.appendChild(opt);
  });
}

async function loadExistingCandidateData(recruitId) {
  try {
    const res = await fetch(`/api/recruits?action=getOne&id=${recruitId}`);
    if (!res.ok) return;

    const data = await res.json();
    if (!data || !data.RecruitID) return;

    // --- Standard Text Inputs ---
    setInputValue('firstName', data.FirstName);
    setInputValue('surname', data.Surname);
    setInputValue('email', data.Email);
    setInputValue('phone', data.Phone);
    setInputValue('countryOfResidence', data.CountryOfResidency);
    setInputValue('seniorityLevel', data.SeniorityLevel);
    setInputValue('totalYearsExperience', data.TotalYearsExperience);
    setInputValue('idType', data.IdType);
    setInputValue('idNumber', data.IdNumber);
    setInputValue('noticePeriod', data.NoticePeriod);

    // --- Rates Formatting (Strips trailing zeros from SQL decimals) ---
    setInputValue('currentRate', data.CurrentRate !== null && data.CurrentRate !== undefined ? parseFloat(data.CurrentRate) : '');
    setInputValue('expectedRate', data.ExpectedRate !== null && data.ExpectedRate !== undefined ? parseFloat(data.ExpectedRate) : '');

    // --- Date Sourced Formatting (ISO to YYYY-MM-DD) ---
    const dateInput = document.getElementById('dateSourced');
    if (dateInput && data.DateSourced) {
      dateInput.value = new Date(data.DateSourced).toISOString().split('T')[0];
    }

    // --- Dropdowns ---
    setInputValue('recruiterSelect', data.RecruiterUserID);
    setInputValue('sourceSelect', data.SourceID);
    setInputValue('roleSelect', data.RoleID);

    // --- Skills, Certifications & Other Skills ---
    setInputValue('otherSkills', data.OtherSkills);
    
    // Select multi-select or comma-separated options for skills
    if (data.Skills) {
      setMultiSelectValues('skillsSelect', data.Skills);
    }
    if (data.Certifications) {
      setMultiSelectValues('certsSelect', data.Certifications);
    }

    // --- Stepper UI Update ---
    const stageName = data.Stage || data.LifecycleStage || 'Sourced';
    const stageIndex = STAGES.indexOf(stageName);
    if (stageIndex !== -1) {
      currentStageIndex = stageIndex;
      updateStageUI();
    }

  } catch (err) {
    console.error("Error loading recruit details:", err);
  }
}

// Utility to set input value safely
function setInputValue(id, val) {
  const el = document.getElementById(id);
  if (el && val !== undefined && val !== null) {
    el.value = val;
  }
}

// Utility to set selected values for multi-select dropdowns or comma strings
function setMultiSelectValues(elementId, valuesString) {
  const select = document.getElementById(elementId);
  if (!select) return;

  const valuesArray = typeof valuesString === 'string' 
    ? valuesString.split(',').map(s => s.trim()) 
    : valuesString;

  Array.from(select.options).forEach(option => {
    if (valuesArray.includes(option.value)) {
      option.selected = true;
    }
  });
}

function updateStageUI() {
  const steps = document.querySelectorAll('.stepper-item');
  steps.forEach((step, idx) => {
    if (idx <= currentStageIndex) {
      step.classList.add('active');
    } else {
      step.classList.remove('active');
    }
  });
}

async function handleFormSubmit(e, editingRecruitId) {
  e.preventDefault();

  const getVal = (id) => {
    const el = document.getElementById(id);
    return el ? el.value : null;
  };

  // Get selected items from multi-select dropdowns
  const getMultiVal = (id) => {
    const el = document.getElementById(id);
    if (!el) return null;
    return Array.from(el.selectedOptions).map(opt => opt.value).join(', ');
  };

  const payload = {
    recruitId: editingRecruitId || null,
    firstName: getVal('firstName'),
    surname: getVal('surname'),
    email: getVal('email'),
    phone: getVal('phone'),
    countryOfResidence: getVal('countryOfResidence'),
    seniorityLevel: getVal('seniorityLevel'),
    totalYearsExperience: getVal('totalYearsExperience'),
    idType: getVal('idType'),
    idNumber: getVal('idNumber'),
    currentRate: getVal('currentRate'),
    expectedRate: getVal('expectedRate'),
    noticePeriod: getVal('noticePeriod'),
    dateSourced: getVal('dateSourced'),
    recruiterId: getVal('recruiterSelect'),
    sourceId: getVal('sourceSelect'),
    roleId: getVal('roleSelect'),
    skills: getMultiVal('skillsSelect') || getVal('skillsInput'),
    certifications: getMultiVal('certsSelect') || getVal('certsInput'),
    otherSkills: getVal('otherSkills'),
    stage: STAGES[currentStageIndex]
  };

  const url = editingRecruitId ? `/api/recruits/${editingRecruitId}` : '/api/recruits';
  const method = editingRecruitId ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      window.location.href = 'manage-recruits.html';
    } else {
      const errData = await res.json();
      alert(`Error saving candidate: ${errData.message || 'Unknown error'}`);
    }
  } catch (err) {
    console.error("Submission failed:", err);
    alert("Network error while trying to save candidate.");
  }
}