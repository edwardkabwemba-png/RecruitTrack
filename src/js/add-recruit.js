let uploadedDocumentUrl = null;
let editingRecruitId = null;

const pendingFiles = {
  CV: [],
  ID_Visa: [],
  PaySlips: [],
  Certifications: [],
  Degrees: []
};

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
let existingDocStatuses = {};

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  editingRecruitId = urlParams.get('id');

  await loadDropdownData();

  if (editingRecruitId) {
    document.title = "Edit Recruit";
    const headerTitle = document.querySelector('h1');
    if (headerTitle) headerTitle.textContent = "Edit Recruit";

    await loadExistingCandidateData(editingRecruitId);
  }

  const form = document.getElementById('addRecruitForm') || document.getElementById('recruitForm');
  if (form) {
    form.addEventListener('submit', handleCandidateSubmit);
  }

  const firstNameInput = getElem('firstName');
  const surnameInput = getElem('surname');
  const displayTitle = getElem('displayCandidateName');

  function updateDisplayName() {
    const fn = firstNameInput?.value.trim() || '';
    const sn = surnameInput?.value.trim() || '';
    if (displayTitle) {
      displayTitle.textContent = (fn || sn) ? `${fn} ${sn}`.trim() : 'Candidate Details';
    }
  }

  firstNameInput?.addEventListener('input', updateDisplayName);
  surnameInput?.addEventListener('input', updateDisplayName);

  // Auto-fill Role Classification when Current Role selection changes
  setupCurrentRoleAutoFill();

  setupSkillTagDropdown('skillSelect', 'skillsContainer');
  setupTagDropdown('certSelect', 'certsContainer');

  bindFileInput('fileCv', 'badgeCv', 'CV');
  bindFileInput('fileId', 'badgeId', 'ID_Visa');
  bindFileInput('filePayslips', 'badgePayslips', 'PaySlips');
  bindFileInput('fileCerts', 'badgeCerts', 'Certifications');
  bindFileInput('fileDegree', 'badgeDegree', 'Degrees');

  document.querySelectorAll('.stage-node').forEach((node, index) => {
    node.style.cursor = 'pointer';
    node.addEventListener('click', () => {
      currentStageIndex = index;
      updateStageUI();
    });
  });

  const advanceBtn = getAdvanceBtn();
  if (advanceBtn) {
    advanceBtn.addEventListener('click', advanceStage);
  }

  updateStageUI();
});

function getElem(id) {
  return document.getElementById(id);
}

function getAdvanceBtn() {
  return document.getElementById('btnAdvanceStage') || 
         document.querySelector('.btn-advance-stage') || 
         document.querySelector('button[onclick="advanceStage()"]');
}

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

function bindFileInput(elementId, badgeId, category) {
  const el = getElem(elementId);
  const badge = getElem(badgeId);
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

function setupCurrentRoleAutoFill() {
  const currentRoleSelect = getElem('currentRoleSelect') || getElem('currentRole');
  const roleClassificationSelect = getElem('roleClassification');

  if (!currentRoleSelect || !roleClassificationSelect) return;

  currentRoleSelect.addEventListener('change', () => {
    const selectedOption = currentRoleSelect.options[currentRoleSelect.selectedIndex];
    const classification = selectedOption?.dataset?.classification || '';
    
    if (classification) {
      roleClassificationSelect.value = classification;
    } else if (!currentRoleSelect.value) {
      roleClassificationSelect.value = '';
    }
  });
}

async function loadExistingCandidateData(recruitId) {
  try {
    const res = await fetch(`/api/recruits?action=getOne&id=${recruitId}`);
    if (!res.ok) return;

    const data = await res.json();
    if (!data || !data.RecruitID) return;

    existingDocStatuses = {
      docCvStatus: data.DocCvStatus || 'Pending',
      docIdStatus: data.DocIdStatus || 'Pending',
      docPaySlipsStatus: data.DocPaySlipsStatus || 0,
      docCertsStatus: data.DocCertsStatus || 'Pending',
      docDegreesStatus: data.DocDegreesStatus || 'Pending'
    };

    if (data.DocCvStatus === 'Uploaded') updateBadgeUI('badgeCv', 'Received');
    if (data.DocIdStatus === 'Uploaded') updateBadgeUI('badgeId', 'Received');
    if (data.DocPaySlipsStatus > 0) updateBadgeUI('badgePayslips', `${data.DocPaySlipsStatus} Received`);
    if (data.DocCertsStatus === 'Uploaded') updateBadgeUI('badgeCerts', 'Received');
    if (data.DocDegreesStatus === 'Uploaded') updateBadgeUI('badgeDegree', 'Received');

    setVal('firstName', data.FirstName);
    setVal('surname', data.Surname);
    setVal('email', data.Email);
    setVal('phone', data.Phone);
    
    // Set Current Role & Role Classification
    const currentRoleElem = getElem('currentRoleSelect') || getElem('currentRole');
    if (currentRoleElem) {
      currentRoleElem.value = data.CurrentRole || '';
      // Dispatch change event so Role Classification auto-fills if configured
      currentRoleElem.dispatchEvent(new Event('change'));
    }
    
    // Override classification if explicit value exists in DB
    if (data.RoleClassification) {
      setVal('roleClassification', data.RoleClassification);
    }
    
    setVal('countrySelect', data.CountryOfResidency);
    setVal('countryOfResidence', data.CountryOfResidency);
    setVal('senioritySelect', data.SeniorityLevel);
    setVal('seniorityLevel', data.SeniorityLevel);
    setVal('totalExperience', data.TotalYearsExperience);
    setVal('totalYearsExperience', data.TotalYearsExperience);
    setVal('idType', data.IdType);
    setVal('idNumber', data.IdNumber);
    setVal('noticePeriod', data.NoticePeriod);

    setVal('currentRate', data.CurrentRate !== null && data.CurrentRate !== undefined ? parseFloat(data.CurrentRate) : '');
    setVal('expectedRate', data.ExpectedRate !== null && data.ExpectedRate !== undefined ? parseFloat(data.ExpectedRate) : '');

    const dateSourcedInput = getElem('dateSourced');
    if (dateSourcedInput && data.DateSourced) {
      dateSourcedInput.value = new Date(data.DateSourced).toISOString().split('T')[0];
    }

    setVal('recruiterSelect', data.RecruiterUserID);
    setVal('sourceSelect', data.SourceID);
    setVal('roleSelect', data.RoleID);
    setVal('otherSkills', data.OtherSkills);

    if (data.Skills) restoreTagBadges('skillsContainer', data.Skills, true);
    if (data.Certifications) restoreTagBadges('certsContainer', data.Certifications, false);

    const displayTitle = getElem('displayCandidateName');
    if (displayTitle && (data.FirstName || data.Surname)) {
      displayTitle.textContent = `${data.FirstName || ''} ${data.Surname || ''}`.trim();
    }

    const stageName = data.Stage || data.LifecycleStage || 'Sourced';
    const stageIndex = STAGES.indexOf(stageName);
    if (stageIndex !== -1) {
      currentStageIndex = stageIndex;
      updateStageUI();
    }

  } catch (err) {
    console.error("Error loading candidate data:", err);
  }
}

function updateBadgeUI(badgeId, text) {
  const badge = getElem(badgeId);
  if (badge) {
    badge.className = 'status-badge badge-received';
    badge.style.backgroundColor = '#d1e7dd';
    badge.style.color = '#0f5132';
    badge.textContent = text;
  }
}

function setVal(id, value) {
  const el = getElem(id);
  if (el && value !== undefined && value !== null) {
    el.value = value;
  }
}

function restoreTagBadges(containerId, dataString, isFormatted) {
  const container = getElem(containerId);
  if (!container || !dataString) return;

  container.innerHTML = '';
  let items = [];

  try {
    items = JSON.parse(dataString);
  } catch (e) {
    items = dataString.split(',').map(s => s.trim());
  }

  if (Array.isArray(items)) {
    items.forEach(text => {
      if (!text) return;
      const tag = document.createElement('span');
      tag.className = 'tag-badge';
      if (isFormatted) {
        tag.dataset.formatted = text;
      } else {
        tag.dataset.text = text;
      }
      tag.innerHTML = `${text} <span class="remove-btn" style="cursor:pointer;margin-left:5px;">&times;</span>`;
      tag.querySelector('.remove-btn').addEventListener('click', () => tag.remove());
      container.appendChild(tag);
    });
  }
}

async function loadDropdownData() {
  try {
    const res = await fetch('/api/recruits?action=dropdowns');
    if (!res.ok) throw new Error(`Server error: ${res.status}`);

    const data = await res.json();

    populateSelect('recruiterSelect', data.recruiters, 'UserID', 'FullName', 'Select Recruiter...');
    populateSelect('sourceSelect', data.sources, 'SourceID', 'SourceName', 'Select Source...');
    populateSelect('roleSelect', data.roles, 'RoleID', 'RoleTitle', 'Select a Role...');
    populateSelect('skillSelect', data.skills, 'SkillName', 'SkillName', 'Select Skill...');
    populateSelect('certSelect', data.certifications, 'CertName', 'CertName', 'Select Certification...');

    // Populate Current Role Dropdown from Positions Table
    populatePositionSelect('currentRoleSelect', data.positions, 'Select Current Role...');
  } catch (err) {
    console.error('Error loading dropdowns:', err.message);
  }
}

function populateSelect(elementId, items, valueKey, textKey, defaultText) {
  const select = getElem(elementId);
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

// Populate positions dropdown and attach classification as a dataset attribute
function populatePositionSelect(elementId, items, defaultText) {
  const select = getElem(elementId) || getElem('currentRole');
  if (!select) return;

  select.innerHTML = `<option value="">${defaultText}</option>`;
  if (Array.isArray(items)) {
    items.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item.PositionTitle || '';
      opt.textContent = item.PositionTitle || '';
      if (item.Classification) {
        opt.dataset.classification = item.Classification;
      }
      select.appendChild(opt);
    });
  }
}

function setupSkillTagDropdown(selectId, containerId) {
  const selectEl = getElem(selectId);
  const containerEl = getElem(containerId);
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
  const selectEl = getElem(selectId);
  const containerEl = getElem(containerId);
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

async function uploadSingleFile(file, folderPath) {
  if (!file) return null;

  const sanitizedFolderPath = folderPath.replace(/\s+/g, '_');
  const buffer = await file.arrayBuffer();

  const res = await fetch('/api/upload-document', {
    method: 'POST',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'X-File-Name': encodeURIComponent(file.name),
      'X-Folder-Path': encodeURIComponent(sanitizedFolderPath)
    },
    body: buffer
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(`Upload failed (${res.status}): ${errorData.error || res.statusText}`);
  }

  const data = await res.json();
  return data.fileUrl;
}

async function processAllDocumentUploads(candidateFolderName) {
  for (const [category, files] of Object.entries(pendingFiles)) {
    if (files && files.length > 0) {
      for (const file of files) {
        const folderPath = `${candidateFolderName}/${category}`;
        await uploadSingleFile(file, folderPath);
      }
    }
  }
}

async function handleCandidateSubmit(e) {
  e.preventDefault();

  const recruiterSelect = getElem('recruiterSelect');
  const sourceSelect = getElem('sourceSelect');
  const roleSelect = getElem('roleSelect');
  const firstName = getElem('firstName')?.value?.trim();
  const surname = getElem('surname')?.value?.trim();
  const email = getElem('email')?.value?.trim();

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

    const countryVal = getElem('countrySelect')?.value || getElem('countryOfResidence')?.value || 'South Africa';
    const seniorityVal = getElem('senioritySelect')?.value || getElem('seniorityLevel')?.value || null;
    const expVal = getElem('totalExperience')?.value || getElem('totalYearsExperience')?.value || null;
    const currentRoleVal = getElem('currentRoleSelect')?.value || getElem('currentRole')?.value?.trim() || null;

    const payload = {
      recruitId: editingRecruitId,
      recruiterId: recruiterSelect?.value || null,
      sourceId: sourceSelect?.value || null,
      roleId: roleSelect?.value || null,
      dateSourced: getElem('dateSourced')?.value || new Date().toISOString().split('T')[0],
      firstName: firstName,
      surname: surname,
      currentRole: currentRoleVal,
      roleClassification: getElem('roleClassification')?.value?.trim() || null,
      countryOfResidence: countryVal,
      seniorityLevel: seniorityVal,
      totalYearsExperience: expVal,
      skills: JSON.stringify(Array.from(document.querySelectorAll('#skillsContainer .tag-badge')).map(b => b.dataset.formatted)),
      certifications: JSON.stringify(Array.from(document.querySelectorAll('#certsContainer .tag-badge')).map(b => b.dataset.text)),
      otherSkills: getElem('otherSkills')?.value?.trim() || null,
      noticePeriod: getElem('noticePeriod')?.value || '30 Days',
      currentRate: getElem('currentRate')?.value || null,
      expectedRate: getElem('expectedRate')?.value || null,
      email: email,
      phone: getElem('phone')?.value?.trim() || null,
      idType: getElem('idType')?.value || null,
      idNumber: getElem('idNumber')?.value?.trim() || null,
      stage: STAGES[currentStageIndex],
      docCvStatus: pendingFiles.CV.length > 0 ? 'Uploaded' : (existingDocStatuses.docCvStatus || 'Pending'),
      docIdStatus: pendingFiles.ID_Visa.length > 0 ? 'Uploaded' : (existingDocStatuses.docIdStatus || 'Pending'),
      docPaySlipsStatus: pendingFiles.PaySlips.length > 0 ? pendingFiles.PaySlips.length : (existingDocStatuses.docPaySlipsStatus || 0),
      docCertsStatus: pendingFiles.Certifications.length > 0 ? 'Uploaded' : (existingDocStatuses.docCertsStatus || 'Pending'),
      docDegreesStatus: pendingFiles.Degrees.length > 0 ? 'Uploaded' : (existingDocStatuses.docDegreesStatus || 'Pending')
    };

    const targetUrl = editingRecruitId ? `/api/recruits?id=${editingRecruitId}` : '/api/recruits';
    const method = editingRecruitId ? 'PUT' : 'POST';

    const res = await fetch(targetUrl, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || data.message || 'Failed to save candidate.');

    alert(`Candidate successfully ${editingRecruitId ? 'updated' : 'created'}!`);
    window.location.href = 'manage-recruits.html';

  } catch (err) {
    console.error('Submission error:', err);
    alert(`Error saving candidate: ${err.message}`);
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = editingRecruitId ? 'Update Candidate' : 'Save Recruit';
    }
  }
}