let selectedRecruiters = [];
let selectedReqSkills = [];
let selectedNiceSkills = [];
let selectedCerts = [];
let matchedDuplicateRole = null;

document.addEventListener('DOMContentLoaded', async () => {
  await Promise.all([loadPositions(), loadClients()]);
  setCurrentUserDefault();

  document.getElementById('newRoleForm').addEventListener('submit', handleFormSubmit);
});

// Load Dropdowns
async function loadPositions() {
  const select = document.getElementById('positionSelect');
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
  } catch (err) { console.error("Error loading positions:", err); }
}

async function loadClients() {
  const select = document.getElementById('clientSelect');
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
  } catch (err) { console.error("Error loading clients:", err); }
}

function setCurrentUserDefault() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  if (user.fullName || user.email) {
    const initial = user.fullName ? user.fullName.split(' ').map(n=>n[0]).join('') : 'U';
    addTag('recruiter', `${user.fullName || 'Current User'}`, user.id);
  }
}

// Duplicate Detection Check
async function checkDuplicate() {
  const posId = document.getElementById('positionSelect').value;
  const clientId = document.getElementById('clientSelect').value;

  if (!posId || !clientId) return;

  try {
    const res = await fetch(`/api/roles?positionId=${posId}&clientId=${clientId}`);
    const roles = await res.json();

    const activeDup = Array.isArray(roles) ? roles.find(r => r.PositionID == posId && r.ClientID == clientId && r.Status !== 'Closed') : null;

    if (activeDup) {
      matchedDuplicateRole = activeDup;
      document.getElementById('dupDetails').innerText = `${activeDup.PositionTitle} @ ${activeDup.ClientName}, #RL-${String(activeDup.RoleID).padStart(4,'0')}`;
      document.getElementById('duplicateBanner').style.display = 'flex';
    } else {
      document.getElementById('duplicateBanner').style.display = 'none';
    }
  } catch (err) {
    console.error("Duplicate check error:", err);
  }
}

// Tag Management
function promptAddTag(type) {
  const name = prompt(`Enter ${type} name:`);
  if (name) addTag(type, name);
}

function addTag(type, label, value = null) {
  const item = { label, value: value || label };

  if (type === 'recruiter') selectedRecruiters.push(item);
  else if (type === 'reqSkill') selectedReqSkills.push(item);
  else if (type === 'niceSkill') selectedNiceSkills.push(item);
  else if (type === 'certification') selectedCerts.push(item);

  renderTags(type);
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
  const btnLabel = type === 'recruiter' ? '+ Add recruiter' : type.includes('Skill') ? '+ Add skill' : '+ Add certification';

  container.innerHTML = list.map((item, idx) => `
    <span class="tag">
      ${item.label}
      <span class="remove-btn" onclick="removeTag('${type}', ${idx})">×</span>
    </span>
  `).join('') + `<button type="button" class="btn-add-tag" onclick="promptAddTag('${type}')">${btnLabel}</button>`;
}

// Banner Action Buttons
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
  document.getElementById('duplicateBanner').style.display = 'none';
}

// Submit Form
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