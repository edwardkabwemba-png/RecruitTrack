let uploadedDocumentUrl = null;

// Track selected files before submitting
const pendingFiles = {
  CV: [],
  ID_Visa: [],
  PaySlips: [],
  Certifications: [],
  Degrees: []
};

// Array of stages in order matching SQL database schema
const STAGES = [
  'Sourced',
  'In Discussion',
  'Screened',
  'CV Prepared',
  'Interviewed',
  'Offer Sent',
  'Hired'
];

let currentStageIndex = 1; // Default: 'In Discussion'

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
    if (displayTitle) {
      displayTitle.textContent = (fn || sn) ? `${fn} ${sn}`.trim() : 'New Candidate';
    }
  }

  firstNameInput?.addEventListener('input', updateDisplayName);
  surnameInput?.addEventListener('input', updateDisplayName);

  // 4. Attach Dynamic Tag Handlers for Skills and Certifications
  setupTagDropdown('skillSelect', 'skillsContainer', 'Skill');
  setupTagDropdown('certSelect', 'certsContainer', 'Cert');

  // 5. Attach File Input Event Listeners for Partitioned Uploads
  bindFileInput('fileCv', 'CV');
  bindFileInput('fileId', 'ID_Visa');
  bindFileInput('filePayslips', 'PaySlips');
  bindFileInput('fileCerts', 'Certifications');
  bindFileInput('fileDegree', 'Degrees');

  // 6. Attach Lifecycle Stage Advance Listener
  const advanceBtn = getAdvanceBtn();
  if (advanceBtn) {
    advanceBtn.addEventListener('click', advanceStage);
  }

  // 7. Initialize Stepper UI
  updateStageUI();
});

// Helper to select the advance stage button across varying class/id conventions
function getAdvanceBtn() {
  return document.getElementById('btnAdvanceStage') || 
         document.querySelector('.btn-advance-stage') || 
         document.querySelector('button[onclick="advanceStage()"]') ||
         Array.from(document.querySelectorAll('button')).find(btn => btn.textContent.toLowerCase().includes('advance'));
}

// Lifecycle Stepper Logic
function advanceStage(e) {
  if (e) e.preventDefault();

  if (currentStageIndex < STAGES.length - 1) {
    currentStageIndex++;
    updateStageUI();
  } else {
    alert('Candidate has reached the final stage (Hired)!');
  }
}

function updateStageUI() {
  // Target dots/steps by node class or parent elements
  const stageNodes = document.querySelectorAll('.stage-node, .stage-step, .lifecycle-step');
  const advanceBtn = getAdvanceBtn();

  stageNodes.forEach((node, index) => {
    node.classList.remove('completed', 'active', 'pending');

    if (index < currentStageIndex) {
      node.classList.add('completed');
    } else if (index === currentStageIndex) {
      node.classList.add('active');
    } else {
      node.classList.add('pending');
    }
  });

  // Update button label to reflect next step
  if (advanceBtn) {
    if (currentStageIndex < STAGES.length - 1) {
      const nextStageName = STAGES[currentStageIndex + 1];
      advanceBtn.textContent = `Advance to ${nextStageName}`;
      advanceBtn.disabled = false;
    } else {
      advanceBtn.textContent = 'Candidate Hired';
      advanceBtn.disabled = true;
    }
  }
}

// Helper to monitor file selections and update badge UI
function bindFileInput(elementId, category) {
  const el = document.getElementById(elementId);
  if (!el) return;

  el.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    pendingFiles[category] = files;

    const badge = el.parentElement?.querySelector('.status-badge');
    if (badge) {
      if (files.length > 0) {
        badge.className = 'status-badge badge-received';
        badge.textContent = files.length === 1 ? 'Ready' : `${files.length} Files Ready`;
      } else {
        badge.className = 'status-badge badge-pending';
        badge.textContent = 'Pending';
      }
    }
  });
}

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

    const existingTags = Array.from(containerEl.querySelectorAll('.tag-badge'));
    const isDuplicate = existingTags.some(tag => tag.dataset.value === selectedValue);

    if (isDuplicate) {
      selectEl.value = '';
      return;
    }

    const tag = document.createElement('span');
    tag.className = 'tag-badge';
    tag.dataset.value = selectedValue;
    tag.innerHTML = `${selectedText} <span class="remove-btn">&times;</span>`;

    tag.querySelector('.remove-btn').addEventListener('click', () => {
      tag.remove();
    });

    containerEl.appendChild(tag);
    selectEl.value = '';
  });
}

// Helper: Upload single file to storage with dynamic folder header
async function uploadSingleFile(file, folderPath) {
  if (!file) return null;

  const buffer = await file.arrayBuffer();
  const uint8Data = new Uint8Array(buffer);

  const res = await fetch('/api/upload-document', {
    method: 'POST',
    headers: {
      'Content-Type': file.type || 'application/pdf',
      'X-File-Name': encodeURIComponent(file.name),
      'X-Folder-Path': encodeURIComponent(folderPath)
    },
    body: uint8Data
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

  return data.fileUrl;
}

// Upload all selected documents partitioned under CandidateName/Category
async function processAllDocumentUploads(candidateFolderName) {
  let mainCvUrl = null;

  for (const [category, files] of Object.entries(pendingFiles)) {
    for (const file of files) {
      const folderPath = `${candidateFolderName}/${category}`;
      const fileUrl = await uploadSingleFile(file, folderPath);

      if (category === 'CV' && !mainCvUrl) {
        mainCvUrl = fileUrl;
      }
    }
  }

  return mainCvUrl;
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

  if (!firstName || !surname || !email) {
    alert('Please fill in First Name, Surname, and Email Address.');
    return;
  }

  if (!recruiterSelect?.value || !sourceSelect?.value || !roleSelect?.value) {
    alert('Please select a Recruiter, Source, and Role before saving.');
    return;
  }

  const saveBtn = e.target.querySelector('button[type="submit"]') || document.querySelector('.btn-primary');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving Candidate & Uploading Files...';
  }

  try {
    // 1. Define candidate folder name and upload all pending files into partitioned folders
    const candidateFolderName = `${firstName}_${surname}`;
    await processAllDocumentUploads(candidateFolderName);

    // 2. Build full Azure Storage folder URL path
    const storageAccountName = 'strgcandidatetracker'; 
    const folderUrl = `https://${storageAccountName}.blob.core.windows.net/documents/${candidateFolderName}/`;

    // 3. Assemble payload
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
      stage: STAGES[currentStageIndex],
      documentUrl: folderUrl,
      docCvStatus: pendingFiles.CV.length > 0 ? 'Uploaded' : 'Pending',
      docIdStatus: pendingFiles.ID_Visa.length > 0 ? 'Uploaded' : 'Pending',
      docPaySlipsStatus: pendingFiles.PaySlips.length,
      docCertsStatus: pendingFiles.Certifications.length > 0 ? 'Uploaded' : 'Pending',
      docDegreesStatus: pendingFiles.Degrees.length > 0 ? 'Uploaded' : 'Pending'
    };

    // 4. Save Candidate in DB
    const res = await fetch('/api/recruits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || data.message || 'Failed to save candidate.');
    }

    alert('Candidate and documents successfully uploaded!');
    window.location.href = '/recruits.html';

  } catch (err) {
    console.error('Submission error:', err);
    alert(`Error saving candidate: ${err.message}`);
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Recruit';
    }
  }
}