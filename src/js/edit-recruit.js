let selectedSkills = new Set();
let selectedCerts = new Set();
let currentStage = 'Sourced';

// Document state tracking
let docStates = {
  DocCvStatus: 'Pending',
  DocIdStatus: 'Pending',
  DocPaySlipsStatus: 0,
  DocCertsStatus: 'Pending',
  DocDegreesStatus: 'Pending'
};

document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const recruitId = urlParams.get('id');

  if (!recruitId) {
    alert("No Recruit ID specified.");
    window.location.href = "manage-recruits.html";
    return;
  }

  // Ensure dropdowns are fully loaded before setting candidate values
  await loadDropdowns();
  await loadRecruitDetails(recruitId);
  setupFormSubmit();
  setupTagHandlers();
  setupLifecycleClick();
  setupDocumentHandlers();
});

async function loadDropdowns() {
  try {
    const res = await fetch('/api/add-recruit?action=dropdowns');
    const data = await res.json();

    populateSelect('recruiterSelect', data.recruiters, 'UserID', 'FullName');
    populateSelect('sourceSelect', data.sources, 'SourceID', 'SourceName');
    populateSelect('roleSelect', data.roles, 'RoleID', 'RoleTitle', 'PositionTitle');
    populateSelect('skillSelect', data.skills, 'SkillName', 'SkillName');
    populateSelect('certSelect', data.certifications, 'CertName', 'CertName');
  } catch (err) {
    console.error("Dropdown loading failed:", err);
  }
}

function populateSelect(elemId, items, valueKey, primaryTextKey, secondaryTextKey) {
  const sel = document.getElementById(elemId);
  if (!sel || !items) return;
  sel.innerHTML = `<option value="">Select Option...</option>` + 
    items.map(i => {
      const label = i[primaryTextKey] || i[secondaryTextKey] || 'Option';
      return `<option value="${i[valueKey]}">${label}</option>`;
    }).join('');
}

function cleanTagItems(rawInput) {
  if (!rawInput) return [];
  try {
    const parsed = JSON.parse(rawInput);
    if (Array.isArray(parsed)) return parsed.map(s => String(s).replace(/[\[\]"']/g, '').trim());
  } catch (e) {
    // Treat as comma-delimited text if not JSON
  }
  return String(rawInput).split(',').map(s => s.replace(/[\[\]"']/g, '').trim()).filter(Boolean);
}

async function loadRecruitDetails(id) {
  try {
    const res = await fetch(`/api/add-recruit?action=getOne&id=${id}`);
    const data = await res.json();

    document.getElementById('recruitId').value = data.RecruitID || id;
    if (document.getElementById('applicationId')) {
      document.getElementById('applicationId').value = data.ApplicationID || '';
    }
    document.getElementById('displayCandidateName').textContent = `${data.FirstName || ''} ${data.Surname || ''}`;

    document.getElementById('dateSourced').value = data.DateSourced ? data.DateSourced.substring(0, 10) : '';
    document.getElementById('firstName').value = data.FirstName || '';
    document.getElementById('surname').value = data.Surname || '';
    document.getElementById('sourceSelect').value = data.SourceID || '';
    document.getElementById('noticePeriod').value = data.NoticePeriod || '30 Days';
    document.getElementById('currentRate').value = data.CurrentRate || '';
    document.getElementById('expectedRate').value = data.ExpectedRate || '';
    document.getElementById('email').value = data.Email || '';
    if (document.getElementById('countrySelect')) {
      document.getElementById('countrySelect').value = data.CountryOfResidency || 'South Africa';
    }
    document.getElementById('phone').value = data.Phone || '';
    document.getElementById('idType').value = data.IdType || 'ID';
    document.getElementById('idNumber').value = data.IdNumber || '';
    
    // Set Role drop down value
    const roleSel = document.getElementById('roleSelect');
    if (roleSel) {
      roleSel.value = data.RoleID || '';
    }

    // Set Recruiter drop down value
    const recruiterSel = document.getElementById('recruiterSelect');
    if (recruiterSel) {
      recruiterSel.value = data.RecruiterUserID || '';
    }

    if (document.getElementById('senioritySelect')) {
      document.getElementById('senioritySelect').value = data.SeniorityLevel || '';
    }
    if (document.getElementById('totalExperience')) {
      document.getElementById('totalExperience').value = data.TotalYearsExperience || '';
    }
    document.getElementById('otherSkills').value = data.OtherSkills || '';

    // Clean up & Parse Skills & Certifications Tags
    cleanTagItems(data.Skills).forEach(s => selectedSkills.add(s));
    renderTags('skillsContainer', selectedSkills);

    cleanTagItems(data.Certifications).forEach(c => selectedCerts.add(c));
    renderTags('certsContainer', selectedCerts);

    // Lifecycle Stage
    const stageVal = data.LifecycleStage || data.Stage || 'Sourced';
    setLifecycleStage(stageVal);

    // Save initial document states
    docStates.DocCvStatus = data.DocCvStatus || 'Pending';
    docStates.DocIdStatus = data.DocIdStatus || 'Pending';
    docStates.DocPaySlipsStatus = data.DocPaySlipsStatus || 0;
    docStates.DocCertsStatus = data.DocCertsStatus || 'Pending';
    docStates.DocDegreesStatus = data.DocDegreesStatus || 'Pending';

    // Set Document Badges
    updateDocBadge('badgeCv', docStates.DocCvStatus);
    updateDocBadge('badgeId', docStates.DocIdStatus);
    updateDocBadge('badgePayslips', docStates.DocPaySlipsStatus);
    updateDocBadge('badgeCerts', docStates.DocCertsStatus);
    updateDocBadge('badgeDegree', docStates.DocDegreesStatus);

  } catch (err) {
    console.error("Failed to load recruit data:", err);
  }
}

function updateDocBadge(elemId, status) {
  const badge = document.getElementById(elemId);
  if (!badge) return;
  if (status && (status === 'Received' || status === 'Uploaded' || status === 1 || status === '1' || status > 0)) {
    badge.className = 'status-badge badge-received';
    badge.textContent = 'Received';
  } else {
    badge.className = 'status-badge badge-pending';
    badge.textContent = 'Pending';
  }
}

function setLifecycleStage(stage) {
  const stages = ['Sourced', 'In Discussion', 'Screened', 'CV Prepared', 'Interviewed', 'Offer Sent', 'Hired'];
  let targetIndex = -1;
  const stageLower = String(stage).toLowerCase().trim();

  stages.forEach((s, idx) => {
    if (s.toLowerCase() === stageLower || (s === 'Interviewed' && stageLower === 'interview')) {
      targetIndex = idx;
      currentStage = s;
    }
  });

  if (targetIndex === -1) {
    targetIndex = typeof stage === 'number' ? stage - 1 : 0;
    currentStage = stages[targetIndex] || 'Sourced';
  }

  document.querySelectorAll('#lifecycleContainer .lifecycle-item').forEach((item, idx) => {
    const node = item.querySelector('.stage-node');
    if (!node) return;

    node.classList.remove('active', 'completed', 'pending');

    if (idx < targetIndex) {
      node.classList.add('completed');
    } else if (idx === targetIndex) {
      node.classList.add('active');
    } else {
      node.classList.add('pending');
    }
  });
}

function setupLifecycleClick() {
  document.querySelectorAll('#lifecycleContainer .lifecycle-item').forEach(item => {
    item.addEventListener('click', () => {
      const stage = item.getAttribute('data-stage');
      if (stage) setLifecycleStage(stage);
    });
  });
}

function setupDocumentHandlers() {
  const docMap = [
    { inputId: 'fileCv', badgeId: 'badgeCv', key: 'DocCvStatus' },
    { inputId: 'fileId', badgeId: 'badgeId', key: 'DocIdStatus' },
    { inputId: 'filePayslips', badgeId: 'badgePayslips', key: 'DocPaySlipsStatus', isNum: true },
    { inputId: 'fileCerts', badgeId: 'badgeCerts', key: 'DocCertsStatus' },
    { inputId: 'fileDegree', badgeId: 'badgeDegree', key: 'DocDegreesStatus' }
  ];

  docMap.forEach(item => {
    const el = document.getElementById(item.inputId);
    if (!el) return;
    el.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        docStates[item.key] = item.isNum ? 1 : 'Uploaded';
        updateDocBadge(item.badgeId, docStates[item.key]);
      } else if (e.target.type === 'checkbox') {
        docStates[item.key] = e.target.checked ? (item.isNum ? 1 : 'Uploaded') : (item.isNum ? 0 : 'Pending');
        updateDocBadge(item.badgeId, docStates[item.key]);
      }
    });
  });
}

function setupTagHandlers() {
  const skillSel = document.getElementById('skillSelect');
  if (skillSel) {
    skillSel.addEventListener('change', (e) => {
      if (e.target.value) {
        selectedSkills.add(e.target.value);
        renderTags('skillsContainer', selectedSkills);
        e.target.value = '';
      }
    });
  }

  const certSel = document.getElementById('certSelect');
  if (certSel) {
    certSel.addEventListener('change', (e) => {
      if (e.target.value) {
        selectedCerts.add(e.target.value);
        renderTags('certsContainer', selectedCerts);
        e.target.value = '';
      }
    });
  }
}

function renderTags(containerId, setRef) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = Array.from(setRef).map(val => `
    <span class="tag-badge">
      ${val}
      <span class="remove-btn" onclick="removeTag('${containerId}', '${val.replace(/'/g, "\\'")}')">&times;</span>
    </span>
  `).join('');
}

window.removeTag = function(containerId, val) {
  if (containerId === 'skillsContainer') selectedSkills.delete(val);
  if (containerId === 'certsContainer') selectedCerts.delete(val);
  renderTags(containerId, containerId === 'skillsContainer' ? selectedSkills : selectedCerts);
};

function setupFormSubmit() {
  const form = document.getElementById('editRecruitForm');
  if (!form) return;

  const roleSel = document.getElementById('roleSelect');
  if (roleSel) roleSel.required = true;

  form.onsubmit = async (e) => {
    e.preventDefault();

    const selectedRoleId = document.getElementById('roleSelect').value;

    if (!selectedRoleId) {
      alert("Please select a target Role before saving candidate updates.");
      if (roleSel) {
        roleSel.focus();
        roleSel.style.borderColor = '#ef4444';
      }
      return;
    } else if (roleSel) {
      roleSel.style.borderColor = '';
    }

    // Retrieve active logged-in user ID from browser storage
    const storedUser = JSON.parse(localStorage.getItem("user") || sessionStorage.getItem("user") || "{}");
    const currentUserId = storedUser.userId || storedUser.UserID || storedUser.id || '';

    const id = document.getElementById('recruitId').value;
    const bodyPayload = {
      recruitId: id,
      applicationId: document.getElementById('applicationId') ? document.getElementById('applicationId').value : '',
      recruiterId: document.getElementById('recruiterSelect').value || currentUserId,
      dateSourced: document.getElementById('dateSourced').value,
      firstName: document.getElementById('firstName').value,
      surname: document.getElementById('surname').value,
      sourceId: document.getElementById('sourceSelect').value,
      noticePeriod: document.getElementById('noticePeriod').value,
      currentRate: document.getElementById('currentRate').value,
      expectedRate: document.getElementById('expectedRate').value,
      email: document.getElementById('email').value,
      countryOfResidence: document.getElementById('countrySelect') ? document.getElementById('countrySelect').value : 'South Africa',
      phone: document.getElementById('phone').value,
      idType: document.getElementById('idType').value,
      idNumber: document.getElementById('idNumber').value,
      roleId: selectedRoleId,
      seniorityLevel: document.getElementById('senioritySelect') ? document.getElementById('senioritySelect').value : '',
      totalYearsExperience: document.getElementById('totalExperience') ? document.getElementById('totalExperience').value : '',
      skills: Array.from(selectedSkills).join(', '),
      certifications: Array.from(selectedCerts).join(', '),
      otherSkills: document.getElementById('otherSkills').value,
      stage: currentStage,
      
      docCvStatus: docStates.DocCvStatus,
      docIdStatus: docStates.DocIdStatus,
      docPaySlipsStatus: docStates.DocPaySlipsStatus,
      docCertsStatus: docStates.DocCertsStatus,
      docDegreesStatus: docStates.DocDegreesStatus
    };

    try {
      const res = await fetch(`/api/add-recruit?id=${id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': currentUserId
        },
        body: JSON.stringify(bodyPayload)
      });

      if (!res.ok) throw new Error('Failed to update candidate details.');

      alert("Candidate updated successfully!");
      window.location.href = "manage-recruits.html";
    } catch (err) {
      alert(err.message);
    }
  };
}