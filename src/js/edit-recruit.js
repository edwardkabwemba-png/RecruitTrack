let selectedSkills = new Set();
let selectedCerts = new Set();
let currentStage = 'Sourced';

document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const recruitId = urlParams.get('id');

  if (!recruitId) {
    alert("No Recruit ID specified.");
    window.location.href = "manage-recruits.html";
    return;
  }

  await loadDropdowns();
  await loadRecruitDetails(recruitId);
  setupFormSubmit();
  setupTagHandlers();
  setupLifecycleClick();
});

async function loadDropdowns() {
  try {
    const res = await fetch('/api/recruits?action=dropdowns');
    const data = await res.json();

    populateSelect('recruiterSelect', data.recruiters, 'UserID', 'FullName');
    populateSelect('sourceSelect', data.sources, 'SourceID', 'SourceName');
    populateSelect('roleSelect', data.roles, 'RoleID', 'RoleTitle');
    populateSelect('skillSelect', data.skills, 'SkillName', 'SkillName');
    populateSelect('certSelect', data.certifications, 'CertName', 'CertName');
  } catch (err) {
    console.error("Dropdown loading failed:", err);
  }
}

function populateSelect(elemId, items, valueKey, textKey) {
  const sel = document.getElementById(elemId);
  if (!sel || !items) return;
  sel.innerHTML = `<option value="">Select Option...</option>` + 
    items.map(i => `<option value="${i[valueKey]}">${i[textKey]}</option>`).join('');
}

async function loadRecruitDetails(id) {
  try {
    const res = await fetch(`/api/recruits?action=getOne&id=${id}`);
    const data = await res.json();

    document.getElementById('recruitId').value = data.RecruitID;
    document.getElementById('applicationId').value = data.ApplicationID || '';
    document.getElementById('displayCandidateName').textContent = `${data.FirstName || ''} ${data.Surname || ''}`;

    document.getElementById('recruiterSelect').value = data.RecruiterUserID || '';
    document.getElementById('dateSourced').value = data.DateSourced ? data.DateSourced.substring(0, 10) : '';
    document.getElementById('firstName').value = data.FirstName || '';
    document.getElementById('surname').value = data.Surname || '';
    document.getElementById('sourceSelect').value = data.SourceID || '';
    document.getElementById('noticePeriod').value = data.NoticePeriod || '30 Days';
    document.getElementById('currentRate').value = data.CurrentRate || '';
    document.getElementById('expectedRate').value = data.ExpectedRate || '';
    document.getElementById('email').value = data.Email || '';
    document.getElementById('countrySelect').value = data.CountryOfResidency || 'South Africa';
    document.getElementById('phone').value = data.Phone || '';
    document.getElementById('idType').value = data.IdType || 'ID';
    document.getElementById('idNumber').value = data.IdNumber || '';
    document.getElementById('roleSelect').value = data.RoleID || '';

    document.getElementById('senioritySelect').value = data.SeniorityLevel || '';
    document.getElementById('totalExperience').value = data.TotalYearsExperience || '';
    document.getElementById('otherSkills').value = data.OtherSkills || '';

    // Load Skills & Certifications as Tags
    if (data.Skills) {
      data.Skills.split(',').forEach(s => { if(s.trim()) selectedSkills.add(s.trim()); });
      renderTags('skillsContainer', selectedSkills);
    }
    if (data.Certifications) {
      data.Certifications.split(',').forEach(c => { if(c.trim()) selectedCerts.add(c.trim()); });
      renderTags('certsContainer', selectedCerts);
    }

    // Set Lifecycle Stage
    setLifecycleStage(data.Stage || 'Sourced');

    // Set Document Badges
    updateDocBadge('badgeCv', data.DocCvStatus);
    updateDocBadge('badgeId', data.DocIdStatus);
    updateDocBadge('badgePayslips', data.DocPaySlipsStatus ? 'Received' : 'Pending');
    updateDocBadge('badgeCerts', data.DocCertsStatus);
    updateDocBadge('badgeDegree', data.DocDegreesStatus);

  } catch (err) {
    console.error("Failed to load recruit data:", err);
  }
}

function updateDocBadge(elemId, status) {
  const badge = document.getElementById(elemId);
  if (!badge) return;
  if (status && (status === 'Received' || status === 'Uploaded' || status === 1 || status === '1')) {
    badge.className = 'status-badge badge-received';
    badge.textContent = 'Received';
  } else {
    badge.className = 'status-badge badge-pending';
    badge.textContent = 'Pending';
  }
}

function setLifecycleStage(stage) {
  currentStage = stage;
  const stages = ['Sourced', 'In Discussion', 'Screened', 'CV Prepared', 'Interviewed', 'Offer Sent', 'Hired'];
  const targetIndex = stages.indexOf(stage);

  document.querySelectorAll('#lifecycleContainer .lifecycle-item').forEach((item, idx) => {
    const node = item.querySelector('.stage-node');
    node.className = 'stage-node';
    if (idx < targetIndex) node.classList.add('completed');
    if (idx === targetIndex) node.classList.add('active');
  });
}

function setupLifecycleClick() {
  document.querySelectorAll('#lifecycleContainer .lifecycle-item').forEach(item => {
    item.addEventListener('click', () => {
      const stage = item.getAttribute('data-stage');
      setLifecycleStage(stage);
    });
  });
}

function setupTagHandlers() {
  document.getElementById('skillSelect').addEventListener('change', (e) => {
    if (e.target.value) {
      selectedSkills.add(e.target.value);
      renderTags('skillsContainer', selectedSkills);
      e.target.value = '';
    }
  });

  document.getElementById('certSelect').addEventListener('change', (e) => {
    if (e.target.value) {
      selectedCerts.add(e.target.value);
      renderTags('certsContainer', selectedCerts);
      e.target.value = '';
    }
  });
}

function renderTags(containerId, setRef) {
  const container = document.getElementById(containerId);
  container.innerHTML = Array.from(setRef).map(val => `
    <span class="tag-badge">
      ${val}
      <span class="remove-btn" onclick="removeTag('${containerId}', '${val}')">&times;</span>
    </span>
  `).join('');
}

window.removeTag = function(containerId, val) {
  if (containerId === 'skillsContainer') selectedSkills.delete(val);
  if (containerId === 'certsContainer') selectedCerts.delete(val);
  renderTags(containerId, containerId === 'skillsContainer' ? selectedSkills : selectedCerts);
};

function setupFormSubmit() {
  document.getElementById('editRecruitForm').onsubmit = async (e) => {
    e.preventDefault();

    const id = document.getElementById('recruitId').value;
    const bodyPayload = {
      recruitId: id,
      applicationId: document.getElementById('applicationId').value,
      recruiterId: document.getElementById('recruiterSelect').value,
      dateSourced: document.getElementById('dateSourced').value,
      firstName: document.getElementById('firstName').value,
      surname: document.getElementById('surname').value,
      sourceId: document.getElementById('sourceSelect').value,
      noticePeriod: document.getElementById('noticePeriod').value,
      currentRate: document.getElementById('currentRate').value,
      expectedRate: document.getElementById('expectedRate').value,
      email: document.getElementById('email').value,
      countryOfResidence: document.getElementById('countrySelect').value,
      phone: document.getElementById('phone').value,
      idType: document.getElementById('idType').value,
      idNumber: document.getElementById('idNumber').value,
      roleId: document.getElementById('roleSelect').value,
      seniorityLevel: document.getElementById('senioritySelect').value,
      totalYearsExperience: document.getElementById('totalExperience').value,
      skills: Array.from(selectedSkills).join(', '),
      certifications: Array.from(selectedCerts).join(', '),
      otherSkills: document.getElementById('otherSkills').value,
      stage: currentStage
    };

    try {
      const res = await fetch(`/api/recruits/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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