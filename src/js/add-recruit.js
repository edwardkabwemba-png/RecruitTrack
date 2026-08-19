let uploadedDocumentUrl = null;

document.addEventListener('DOMContentLoaded', () => {
  // 1. Fetch dropdown options on page load
  loadDropdownData();

  // 2. Attach form submit event listener
  const form = document.getElementById('addRecruitForm');
  if (form) {
    form.addEventListener('submit', handleCandidateSubmit);
  }

  // 3. Keep candidate title in sync with UI inputs
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

  // 4. Attach Dynamic Tag Handlers for Skills and Certifications
  setupTagDropdown('skillSelect', 'skillsContainer', 'Skill');
  setupTagDropdown('certSelect', 'certsContainer', 'Cert');

  // 5. Attach CV Upload Handler
  const fileCvInput = document.getElementById('fileCv');
  if (fileCvInput) {
    fileCvInput.addEventListener('change', handleFileUpload);
  }
});

// Load Dropdowns from Backend API
async function loadDropdownData() {
  try {
    const res = await fetch('/api/recruits?action=dropdowns');
    
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || errData.message || `Server error: ${res.status}`);
    }

    const data = await res.json();

    populateSelect('recruiterSelect', data.recruiters, 'UserID', 'FullName', 'Select Recruiter...');
    populateSelect('sourceSelect', data.sources, 'SourceID', 'SourceName', 'Select Source...');
    populateSelect('roleSelect', data.roles, 'RoleID', 'RoleTitle', 'Select a Role...');
    populateSelect('skillSelect', data.skills, 'SkillID', 'SkillName', 'Select Skill...');
    populateSelect('certSelect', data.certifications, 'CertID', 'CertName', 'Select Certification...');
  } catch (err) {
    console.error('Error loading dropdowns:', err.message);
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

// Interactive Skill/Cert Tag Management
function setupTagDropdown(selectId, containerId, labelType) {
  const selectEl = document.getElementById(selectId);
  const containerEl = document.getElementById(containerId);

  if (!selectEl || !containerEl) return;

  selectEl.addEventListener('change', () => {
    const selectedValue = selectEl.value;
    const selectedText = selectEl.options[selectEl.selectedIndex]?.text;

    if (!selectedValue) return;

    // Check if tag already added
    const existingTags = Array.from(containerEl.querySelectorAll('.tag-badge'));
    const isDuplicate = existingTags.some(tag => tag.dataset.value === selectedValue);

    if (isDuplicate) {
      selectEl.value = '';
      return;
    }

    // Create Badge Element
    const tag = document.createElement('span');
    tag.className = 'tag-badge';
    tag.dataset.value = selectedValue;
    tag.innerHTML = `${selectedText} <span class="remove-btn">&times;</span>`;

    tag.querySelector('.remove-btn').addEventListener('click', () => {
      tag.remove();
    });

    containerEl.appendChild(tag);
    selectEl.value = ''; // Reset dropdown after selection
  });
}

// Upload CV / Document File to Azure Function API
async function handleFileUpload(e) {
  const file = e.target.files[0];
  const inputEl = e.target;
  const statusBadge = inputEl.parentElement?.querySelector('.status-badge') || document.getElementById('statusCv');

  if (!file) return;

  if (statusBadge) {
    statusBadge.className = 'status-badge badge-pending';
    statusBadge.textContent = 'Uploading...';
  }

  try {
    // Read raw binary ArrayBuffer (matches function.json dataType: "binary")
    const arrayBuffer = await file.arrayBuffer();

    const res = await fetch('/api/upload-document', {
      method: 'POST',
      headers: {
        'Content-Type': file.type || 'application/pdf',
        'X-File-Name': encodeURIComponent(file.name)
      },
      body: arrayBuffer
    });

    const textResponse = await res.text();
    let data = {};
    try {
      data = textResponse ? JSON.parse(textResponse) : {};
    } catch (_) {
      throw new Error(`Server status ${res.status}: ${textResponse.slice(0, 100)}`);
    }

    if (!res.ok) {
      throw new Error(data.error || data.message || `Upload failed with status ${res.status}`);
    }

    uploadedDocumentUrl = data.fileUrl || null;

    if (statusBadge) {
      statusBadge.className = 'status-badge badge-received';
      statusBadge.textContent = 'Uploaded';
    }
  } catch (err) {
    console.error('File upload error:', err.message);
    if (statusBadge) {
      statusBadge.className = 'status-badge badge-pending';
      statusBadge.textContent = 'Upload Failed';
    }
    alert(`File upload failed: ${err.message}`);
  }
}

// Handle Candidate Form Submission
async function handleCandidateSubmit(e) {
  e.preventDefault();

  const recruiterSelect = document.getElementById('recruiterSelect');
  const sourceSelect = document.getElementById('sourceSelect');
  const roleSelect = document.getElementById('roleSelect');
  const firstName = document.getElementById('firstName')?.value?.trim();
  const surname = document.getElementById('surname')?.value?.trim();
  const email = document.getElementById('email')?.value?.trim();

  // Validate mandatory fields required by your SQL Schema
  if (!firstName || !surname || !email) {
    alert('Please fill in First Name, Surname, and Email Address.');
    return;
  }

  if (!recruiterSelect?.value || !sourceSelect?.value || !roleSelect?.value) {
    alert('Please select a Recruiter, Source, and Role before saving.');
    return;
  }

  const payload = {
    recruiterId: recruiterSelect.value,
    sourceId: sourceSelect.value,
    roleId: roleSelect.value,
    dateSourced: document.getElementById('dateSourced')?.value || new Date().toISOString().split('T')[0],
    firstName: firstName,
    surname: surname,
    countryOfResidence: document.getElementById('countrySelect')?.value || 'South Africa',
    noticePeriod: document.getElementById('noticePeriod')?.value || '30 Days',
    currentRate: document.getElementById('currentRate')?.value || null,
    expectedRate: document.getElementById('expectedRate')?.value || null,
    email: email,
    phone: document.getElementById('phone')?.value?.trim() || null,
    idType: document.getElementById('idType')?.value || null,
    idNumber: document.getElementById('idNumber')?.value?.trim() || null,
    documentUrl: uploadedDocumentUrl
  };

  try {
    const res = await fetch('/api/recruits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || data.message || 'Failed to save candidate.');
    }

    alert('Candidate successfully added!');
    window.location.href = '/recruits.html';

  } catch (err) {
    console.error('Submission error:', err);
    alert(`Error saving candidate: ${err.message}`);
  }
}

function advanceStage() {
  alert('Stage advancement initialized.');
}