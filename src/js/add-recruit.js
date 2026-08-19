document.addEventListener('DOMContentLoaded', () => {
  // 1. Fetch dropdown options on page load
  loadDropdownData();

  // 2. Attach form submit event listener
  const form = document.getElementById('addRecruitForm');
  if (form) {
    form.addEventListener('submit', handleCandidateSubmit);
  }

  // 3. Keep candidate name in sync with UI
  const firstNameInput = document.getElementById('firstName');
  const surnameInput = document.getElementById('surname');
  const displayTitle = document.getElementById('displayCandidateName');

  function updateDisplayName() {
    const fn = firstNameInput?.value.trim() || '';
    const sn = surnameInput?.value.trim() || '';
    displayTitle.textContent = (fn || sn) ? `${fn} ${sn}`.trim() : 'New Candidate';
  }

  firstNameInput?.addEventListener('input', updateDisplayName);
  surnameInput?.addEventListener('input', updateDisplayName);
});

// Load Dropdowns from Backend API
async function loadDropdownData() {
  try {
    const res = await fetch('/api/recruits?action=dropdowns');
    if (!res.ok) throw new Error('Failed to fetch dropdown options');
    
    const data = await res.json();

    populateSelect('recruiterSelect', data.recruiters, 'UserID', 'FullName', 'Select Recruiter...');
    populateSelect('sourceSelect', data.sources, 'SourceID', 'SourceName', 'Select Source...');
    populateSelect('roleSelect', data.roles, 'RoleID', 'RoleTitle', 'Select a Role...');
    populateSelect('skillSelect', data.skills, 'SkillID', 'SkillName', 'Select Skill...');
    populateSelect('certSelect', data.certifications, 'CertID', 'CertName', 'Select Certification...');
  } catch (err) {
    console.error('Error loading dropdowns:', err);
  }
}

function populateSelect(elementId, items, valueKey, textKey, defaultText) {
  const select = document.getElementById(elementId);
  if (!select) return;

  select.innerHTML = `<option value="">${defaultText}</option>`;
  if (Array.isArray(items)) {
    items.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item[valueKey];
      opt.textContent = item[textKey];
      select.appendChild(opt);
    });
  }
}

// Handle Form Submission
async function handleCandidateSubmit(e) {
  e.preventDefault(); // Prevent standard browser POST / page refresh

  // Gather values safely from the DOM
  const payload = {
    recruiterId: document.getElementById('recruiterSelect')?.value || null,
    dateSourced: document.getElementById('dateSourced')?.value || null,
    firstName: document.getElementById('firstName')?.value?.trim() || '',
    surname: document.getElementById('surname')?.value?.trim() || '',
    sourceId: document.getElementById('sourceSelect')?.value || null,
    countryOfResidence: document.getElementById('countrySelect')?.value || 'South Africa',
    noticePeriod: document.getElementById('noticePeriod')?.value || '30 Days',
    currentRate: document.getElementById('currentRate')?.value || null,
    expectedRate: document.getElementById('expectedRate')?.value || null,
    email: document.getElementById('email')?.value?.trim() || '',
    phone: document.getElementById('phone')?.value?.trim() || null,
    idType: document.getElementById('idType')?.value || null,
    idNumber: document.getElementById('idNumber')?.value?.trim() || null,
    roleId: document.getElementById('roleSelect')?.value || null,
    documentUrl: null
  };

  // Pre-submission validation
  if (!payload.firstName || !payload.surname || !payload.email) {
    alert('Please complete all required fields: First Name, Surname, and Email Address.');
    return;
  }

  try {
    const response = await fetch('/api/recruits', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Server returned an error while saving.');
    }

    alert('Candidate successfully added!');
    window.location.href = '/recruits.html';

  } catch (err) {
    console.error('Submission error:', err);
    alert(`Error saving recruit: ${err.message}`);
  }
}

// Placeholder for Stage Tracker Button
function advanceStage() {
  alert('Stage advancement logic ready.');
}