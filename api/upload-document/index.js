let uploadedDocumentUrl = null;
let editingRecruitId = null;

// Track selected files before submitting
const pendingFiles = {
  CV: [],
  ID_Visa: [],
  PaySlips: [],
  Certifications: [],
  Degrees: []
};

// Array of stages matching database values
const STAGES = [
  'Sourced',
  'In Discussion',
  'Screened',
  'CV Prepared',
  'Interviewed',
  'Offer Sent',
  'Hired'
];

let currentStageIndex = 0; // Default: 'Sourced'

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Check if we are editing an existing recruit via URL param (?id=X)
  const urlParams = new URLSearchParams(window.location.search);
  editingRecruitId = urlParams.get('id');

  // 2. Fetch dropdown options
  await loadDropdownData();

  // 3. Populate existing recruit details if in Edit mode
  if (editingRecruitId) {
    await loadExistingCandidateData(editingRecruitId);
  }

  // 4. Attach form submit event listener
  const form = document.getElementById('addRecruitForm');
  if (form) {
    form.addEventListener('submit', handleCandidateSubmit);
  }

  // 5. Keep candidate title in sync with UI inputs
  const firstNameInput = document.getElementById('firstName');
  const surnameInput = document.getElementById('surname');
  const displayTitle = document.getElementById('displayCandidateName');

  function updateDisplayName() {
    const fn = firstNameInput?.value.trim() || '';
    const sn = surnameInput?.value.trim() || '';
    if (displayTitle) {
      displayTitle.textContent = (fn || sn) ? `${fn} ${sn}`.trim() : 'Candidate Details';
    }
  }

  firstNameInput?.addEventListener('input', updateDisplayName);
  surnameInput?.addEventListener('input', updateDisplayName);

  // 6. Attach Dynamic Tag Handlers for Skills and Certifications
  setupSkillTagDropdown('skillSelect', 'skillsContainer');
  setupTagDropdown('certSelect', 'certsContainer');

  // 7. Attach File Input Event Listeners
  bindFileInput('fileCv', 'badgeCv', 'CV');
  bindFileInput('fileId', 'badgeId', 'ID_Visa');
  bindFileInput('filePayslips', 'badgePayslips', 'PaySlips');
  bindFileInput('fileCerts', 'badgeCerts', 'Certifications');
  bindFileInput('fileDegree', 'badgeDegree', 'Degrees');

  // 8. Interactive Stepper Selection via click
  document.querySelectorAll('#lifecycleContainer .lifecycle-item, .stage-node').forEach((el, index) => {
    el.style.cursor = 'pointer';
    el.addEventListener('click', (e) => {
      e.preventDefault();
      currentStageIndex = index;
      updateStageUI();
    });
  });

  // 9. Attach Stage Advance Button Listener
  const advanceBtn = getAdvanceBtn();
  if (advanceBtn) {
    advanceBtn.addEventListener('click', advanceStage);
  }

  updateStageUI();
});

// Helper to get advance stage button
function getAdvanceBtn() {
  return document.getElementById('btnAdvanceStage') || 
         document.querySelector('.btn-advance-stage') || 
         document.querySelector('button[onclick="advanceStage()"]');
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
  const stageNodes = document.querySelectorAll('.stage-node');
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

// Monitor file selections and update badge UI
function bindFileInput(elementId, badgeId, category) {
  const el = document.getElementById(elementId);
  const badge = document.getElementById(badgeId);
  if (!el) return;

  el.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    pendingFiles[category] = files;

    if (badge) {
      if (files.length > 0) {
        badge.className = 'status-badge badge-received';
        badge.style.backgroundColor = '#d1e7dd';
        badge.style.color = '#0f5132';
        
        if (category === 'PaySlips') {
          badge.textContent = `${files.length} Received`;
        } else {
          badge.textContent = files.length === 1 ? 'Received' : `${files.length} Files Received`;
        }
      } else {
        badge.className = 'status-badge badge-pending';
        badge.style.backgroundColor = '#fff3cd';
        badge.style.color = '#664d03';
        badge.textContent = 'Pending';
      }
    }
  });
}

// Load Candidate Details when editing
async function loadExistingCandidateData(id) {
  try {
    const res = await fetch(`/api/recruits?action=getOne&id=${id}`);
    if (!res.ok) return;

    const data = await res.json();
    if (!data || !data.RecruitID) return;

    if (document.getElementById('firstName')) document.getElementById('firstName').value = data.FirstName || '';
    if (document.getElementById('surname')) document.getElementById('surname').value = data.Surname || '';
    if (document.getElementById('email')) document.getElementById('email').value = data.Email || '';
    if (document.getElementById('phone')) document.getElementById('phone').value = data.Phone || '';
    if (document.getElementById('recruiterSelect')) document.getElementById('recruiterSelect').value = data.RecruiterUserID || '';
    if (document.getElementById('sourceSelect')) document.getElementById('sourceSelect').value = data.SourceID || '';
    if (document.getElementById('roleSelect')) document.getElementById('roleSelect').value = data.RoleID || '';

    // Set Lifecycle stage matching logic
    const matchedIndex = STAGES.findIndex(s => s.toLowerCase() === (data.Stage || '').toLowerCase());
    if (matchedIndex !== -1) {
      currentStageIndex = matchedIndex;
      updateStageUI();
    }
  } catch (err) {
    console.error("Failed to fetch candidate details:", err);
  }
}

// Load Dropdowns from Backend API
async function loadDropdownData() {
  try {
    const res = await fetch('/api/recruits?action=dropdowns');
    if (!res.ok) throw new Error(`Server status: ${res.status}`);

    const data = await res.json();

    populateSelect('recruiterSelect', data.recruiters, 'UserID', 'FullName', 'Select Recruiter...');
    populateSelect('sourceSelect', data.sources, 'SourceID', 'SourceName', 'Select Source...');
    populateSelect('roleSelect', data.roles, 'RoleID', 'RoleTitle', 'Select a Role...');
    populateSelect('skillSelect', data.skills, 'SkillName', 'SkillName', 'Select Skill...');
    populateSelect('certSelect', data.certifications, 'CertName', 'CertName', 'Select Certification...');
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
      const val = item[valueKey] !== undefined ? item[valueKey] : item['SkillID'] || item['CertID'];
      const text = item[textKey] !== undefined ? item[textKey] : val;
      
      opt.value = val;
      opt.textContent = text;
      select.appendChild(opt);
    });
  }
}

function setupSkillTagDropdown(selectId, containerId) {
  const selectEl = document.getElementById(selectId);
  const containerEl = document.getElementById(containerId);
  if (!selectEl || !containerEl) return;

  selectEl.addEventListener('change', () => {
    const selectedValue = selectEl.value;
    const selectedText = selectEl.options[selectEl.selectedIndex]?.text;
    if (!selectedValue) return;

    const yrsInput = prompt(`Enter years of experience for ${selectedText}:`, "1");
    if (yrsInput === null) {
      selectEl.value = '';
      return;
    }

    const years = parseFloat(yrsInput) || 0;
    const fullText = `${selectedText} (${years} yrs)`;

    const tag = document.createElement('span');
    tag.className = 'tag-badge';
    tag.dataset.formatted = fullText;
    tag.innerHTML = `${fullText} <span class="remove-btn" style="cursor:pointer;margin-left:5px;">&times;</span>`;

    tag.querySelector('.remove-btn').addEventListener('click', () => tag.remove());
    containerEl.appendChild(tag);
    selectEl.value = '';
  });
}

function setupTagDropdown(selectId, containerId) {
  const selectEl = document.getElementById(selectId);
  const containerEl = document.getElementById(containerId);
  if (!selectEl || !containerEl) return;

  selectEl.addEventListener('change', () => {
    const selectedValue = selectEl.value;
    const selectedText = selectEl.options[selectEl.selectedIndex]?.text;
    if (!selectedValue) return;

    const tag = document.createElement('span');
    tag.className = 'tag-badge';
    tag.dataset.text = selectedText;
    tag.innerHTML = `${selectedText} <span class="remove-btn" style="cursor:pointer;margin-left:5px;">&times;</span>`;

    tag.querySelector('.remove-btn').addEventListener('click', () => tag.remove());
    containerEl.appendChild(tag);
    selectEl.value = '';
  });
}

// Upload single file binary directly to upload-document endpoint
async function uploadSingleFile(file, folderPath) {
  if (!file) return null;

  const buffer = await file.arrayBuffer();

  const res = await fetch('/api/upload-document', {
    method: 'POST',
    headers: {
      'Content-Type': file.type || 'application/pdf',
      'X-File-Name': encodeURIComponent(file.name),
      'X-Folder-Path': encodeURIComponent(folderPath)
    },
    body: new Uint8Array(buffer)
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Upload failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return data.fileUrl;
}

// Process pending document uploads
async function processAllDocumentUploads(candidateFolderName) {
  for (const [category, files] of Object.entries(pendingFiles)) {
    for (const file of files) {
      const folderPath = `${candidateFolderName}/${category}`;
      await uploadSingleFile(file, folderPath);
    }
  }
}

// Handle Form Submission
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

  const saveBtn = e.target.querySelector('button[type="submit"]') || document.querySelector('.btn-primary');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Uploading Documents & Saving...';
  }

  try {
    const candidateFolderName = `${firstName}_${surname}`;
    await processAllDocumentUploads(candidateFolderName);

    const skillsList = Array.from(document.querySelectorAll('#skillsContainer .tag-badge')).map(b => b.dataset.formatted || b.textContent.replace('×', '').trim());
    const certsList = Array.from(document.querySelectorAll('#certsContainer .tag-badge')).map(b => b.dataset.text || b.textContent.replace('×', '').trim());

    const payload = {
      recruitId: editingRecruitId,
      recruiterId: recruiterSelect?.value || null,
      sourceId: sourceSelect?.value || null,
      roleId: roleSelect?.value || null,
      dateSourced: document.getElementById('dateSourced')?.value || new Date().toISOString().split('T')[0],
      firstName: firstName,
      surname: surname,
      countryOfResidence: document.getElementById('countrySelect')?.value || 'South Africa',
      seniorityLevel: document.getElementById('senioritySelect')?.value || null,
      totalYearsExperience: document.getElementById('totalExperience')?.value || null,
      skills: JSON.stringify(skillsList),
      certifications: JSON.stringify(certsList),
      otherSkills: document.getElementById('otherSkills')?.value?.trim() || null,
      noticePeriod: document.getElementById('noticePeriod')?.value || '30 Days',
      currentRate: document.getElementById('currentRate')?.value || null,
      expectedRate: document.getElementById('expectedRate')?.value || null,
      email: email,
      phone: document.getElementById('phone')?.value?.trim() || null,
      idType: document.getElementById('idType')?.value || null,
      idNumber: document.getElementById('idNumber')?.value?.trim() || null,
      stage: STAGES[currentStageIndex],
      docCvStatus: pendingFiles.CV.length > 0 ? 'Uploaded' : 'Pending',
      docIdStatus: pendingFiles.ID_Visa.length > 0 ? 'Uploaded' : 'Pending',
      docPaySlipsStatus: pendingFiles.PaySlips.length,
      docCertsStatus: pendingFiles.Certifications.length > 0 ? 'Uploaded' : 'Pending',
      docDegreesStatus: pendingFiles.Degrees.length > 0 ? 'Uploaded' : 'Pending'
    };

    const targetUrl = editingRecruitId ? `/api/recruits?id=${editingRecruitId}` : '/api/recruits';
    const method = editingRecruitId ? 'PUT' : 'POST';

    const res = await fetch(targetUrl, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || data.message || 'Failed to save candidate.');
    }

    alert(`Candidate successfully ${editingRecruitId ? 'updated' : 'created'}!`);
    window.location.href = 'manage-recruits.html';

  } catch (err) {
    console.error('Submission error:', err);
    alert(`Error: ${err.message}`);
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = editingRecruitId ? 'Update Candidate' : 'Save Recruit';
    }
  }
}