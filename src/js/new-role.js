let selectedRecruiters = [];
let selectedReqSkills = [];
let selectedNiceSkills = [];
let selectedCerts = [];

let dbSkills = [];
let dbCertifications = [];
let matchedDuplicateRole = null;

document.addEventListener('DOMContentLoaded', async () => {
  await Promise.all([
    loadPositions(),
    loadClients(),
    loadDatabaseSkills(),
    loadDatabaseCertifications()
  ]);

  setCurrentUserDefault();

  const form = document.getElementById('newRoleForm');
  if (form) {
    form.addEventListener('submit', handleFormSubmit);
  }
});

// --- LOAD DROPDOWNS & DB DATA ---

async function loadPositions() {
  const select = document.getElementById('positionSelect');
  if (!select) return;

  try {
    const res = await fetch('/api/positions');
    const positions = await res.json();
    if (Array.isArray(positions)) {
      positions.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.PositionID || p.id;
        opt.textContent = p.PositionTitle || p.title;
        select.appendChild(opt);
      });
    }
  } catch (err) { 
    console.error("Error loading positions:", err); 
  }
}

async function loadClients() {
  const select = document.getElementById('clientSelect');
  if (!select) return;

  try {
    const res = await fetch('/api/clients');
    const clients = await res.json();
    if (Array.isArray(clients)) {
      clients.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.ClientID || c.id;
        opt.textContent = c.ClientName || c.name;
        select.appendChild(opt);
      });
    }
  } catch (err) { 
    console.error("Error loading clients:", err); 
  }
}

async function loadDatabaseSkills() {
  try {
    const res = await fetch('/api/skills');
    dbSkills = await res.json();

    const reqSelect = document.getElementById('skillsDropdown');
    const niceSelect = document.getElementById('niceSkillsDropdown');

    if (Array.isArray(dbSkills)) {
      dbSkills.forEach(s => {
        const name = s.SkillName || s.name;
        const id = s.SkillID || s.id;

        if (reqSelect) reqSelect.appendChild(new Option(name, id));
        if (niceSelect) niceSelect.appendChild(new Option(name, id));
      });
    }
  } catch (err) {
    console.error("Error loading skills from DB:", err);
  }
}

async function loadDatabaseCertifications() {
  try {
    const res = await fetch('/api/certifications');
    dbCertifications = await res.json();

    const certSelect = document.getElementById('certsDropdown');

    if (Array.isArray(dbCertifications)) {
      dbCertifications.forEach(c => {
        const name = c.CertName || c.CertificationName;
        const id = c.CertID || c.CertificationID;

        if (certSelect) certSelect.appendChild(new Option(name, id));
      });
    }
  } catch (err) {
    console.error("Error loading certifications from DB:", err);
  }
}

function setCurrentUserDefault() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  if (user.fullName || user.email) {
    addTag('recruiter', user.fullName || 'Current User', user.id || null);
  }
}

// --- DUPLICATE CHECKING ---

async function checkDuplicate() {
  const posSelect = document.getElementById('positionSelect');
  const clientSelect = document.getElementById('clientSelect');
  if (!posSelect || !clientSelect) return;

  const posId = posSelect.value;
  const clientId = clientSelect.value;

  if (!posId || !clientId) return;

  try {
    const res = await fetch(`/api/roles?positionId=${posId}&clientId=${clientId}`);
    const roles = await res.json();

    const activeDup = Array.isArray(roles) ? roles.find(r => r.PositionID == posId && r.ClientID == clientId && r.Status !== 'Closed') : null;

    const banner = document.getElementById('duplicateBanner');
    if (activeDup && banner) {
      matchedDuplicateRole = activeDup;
      document.getElementById('dupDetails').innerText = `${activeDup.PositionTitle} @ ${activeDup.ClientName}, #RL-${String(activeDup.RoleID).padStart(4,'0')}`;
      banner.style.display = 'flex';
    } else if (banner) {
      banner.style.display = 'none';
    }
  } catch (err) {
    console.error("Duplicate check error:", err);
  }
}

// --- TAG MANAGEMENT & ADDING ---

function promptAddTag(type) {
  const name = prompt(`Enter ${type} name:`);
  if (name) addTag(type, name);
}

function addTag(type, label, id = null) {
  const item = { id: id || label, label: label };

  if (type === 'recruiter') selectedRecruiters.push(item);
  else if (type === 'reqSkill') selectedReqSkills.push(item);
  else if (type === 'niceSkill') selectedNiceSkills.push(item);
  else if (type === 'certification') selectedCerts.push(item);

  renderTags(type);
}

function addSelectedSkill(type) {
  const dropdownId = type === 'reqSkill' ? 'skillsDropdown' : 'niceSkillsDropdown';
  const select = document.getElementById(dropdownId);
  if (!select) return;

  const skillId = select.value;
  const skillText = select.options[select.selectedIndex]?.text;

  if (!skillId) return;

  let label = skillText;
  if (type === 'reqSkill') {
    const yrsInput = document.getElementById('skillYearsInput');
    const yrs = yrsInput ? yrsInput.value : '';
    if (yrs) label += ` — ${yrs} yrs`;
  }

  const skillItem = { id: skillId, label: label };

  if (type === 'reqSkill') {
    if (!selectedReqSkills.some(s => s.id === skillId)) selectedReqSkills.push(skillItem);
  } else {
    if (!selectedNiceSkills.some(s => s.id === skillId)) selectedNiceSkills.push(skillItem);
  }

  select.value = '';
  const yrsInput = document.getElementById('skillYearsInput');
  if (yrsInput) yrsInput.value = '';

  renderTags(type);
}

function addSelectedCert() {
  const select = document.getElementById('certsDropdown');
  if (!select) return;

  const certId = select.value;
  const certText = select.options[select.selectedIndex]?.text;

  if (!certId) return;

  if (!selectedCerts.some(c => c.id === certId)) {
    selectedCerts.push({ id: certId, label: certText });
  }

  select.value = '';
  renderTags('certification');
}

function removeTag(type, index) {
  if (type === 'recruiter') selectedRecruiters.splice(index, 1);
  else if (type === 'reqSkill') selectedReqSkills.splice(index, 1);
  else if (type === 'niceSkill') selectedNiceSkills.splice(index, 1);
  else if (type === 'certification') selectedCerts.splice(index, 1);

  renderTags(type);
}

function renderTags(type) {
  let list = [];
  let containerId = '';

  if (type === 'recruiter') { list = selectedRecruiters; containerId = 'recruitersContainer'; }
  else if (type === 'reqSkill') { list = selectedReqSkills; containerId = 'reqSkillsContainer'; }
  else if (type === 'niceSkill') { list = selectedNiceSkills; containerId = 'niceSkillsContainer'; }
  else if (type === 'certification') { list = selectedCerts; containerId = 'certificationsContainer'; }

  const container = document.getElementById(containerId);
  if (!container) return;

  const tagsHtml = list.map((item, idx) => `
    <span class="tag">
      ${item.label}
      <span class="remove-btn" onclick="removeTag('${type}', ${idx})">×</span>
    </span>
  `).join('');

  if (type === 'recruiter') {
    const btnLabel = '+ Add recruiter';
    container.innerHTML = tagsHtml + `<button type="button" class="btn-add-tag" onclick="promptAddTag('${type}')">${btnLabel}</button>`;
  } else {
    container.innerHTML = tagsHtml;
  }
}

// --- BANNER ACTIONS ---

function viewDuplicate() {
  if (matchedDuplicateRole) window.location.href = `/roles.html?id=${matchedDuplicateRole.RoleID}`;
}

async function joinAsCoRecruiter() {
  if (!matchedDuplicateRole) return;
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  
  await fetch('/api/roles-action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'Join', roleId: matchedDuplicateRole.RoleID, userId: user.id })
  });
  window.location.href = '/roles.html';
}

function ignoreDuplicate() {
  const banner = document.getElementById('duplicateBanner');
  if (banner) banner.style.display = 'none';
}

// --- FORM SUBMISSION ---

async function handleFormSubmit(e) {
  e.preventDefault();

  const payload = {
    positionId: document.getElementById('positionSelect').value,
    clientId: document.getElementById('clientSelect').value,
    seniority: document.getElementById('seniority').value,
    education: document.getElementById('education').value,
    fieldOfStudy: document.getElementById('fieldOfStudy').value,
    minExperience: document.getElementById('minExperience').value,
    location: document.getElementById('location').value,
    workModel: document.getElementById('workModel').value,
    rateMin: document.getElementById('rateMin').value,
    rateMax: document.getElementById('rateMax').value,
    recruiters: selectedRecruiters,
    reqSkills: selectedReqSkills,
    niceSkills: selectedNiceSkills,
    certifications: selectedCerts,
    otherSkills: document.getElementById('otherSkills').value
  };

  try {
    const res = await fetch('/api/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error('Failed to create role');
    window.location.href = '/roles.html';
  } catch (err) {
    alert(err.message);
  }
}