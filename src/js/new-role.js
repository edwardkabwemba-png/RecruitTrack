let selectedRecruiters = [];
let selectedReqSkills = [];
let selectedNiceSkills = [];
let selectedCerts = [];

let dbSkills = [];
let dbCertifications = [];
let matchedDuplicateRole = null;
let dbUsers = [];

// Helper: Safely retrieve logged-in User ID from storage
function getStoredUserId() {
  const storedUser = JSON.parse(localStorage.getItem("user") || sessionStorage.getItem("user") || "{}");
  return storedUser.userId || storedUser.UserID || storedUser.id || localStorage.getItem('userId') || sessionStorage.getItem('userId') || window.currentUserId || '';
}

document.addEventListener('DOMContentLoaded', async () => {
  // --- ROUTE GUARD: Verify user credentials before running any logic ---
  const currentUserId = getStoredUserId();
  if (!currentUserId) {
    window.location.href = "index.html";
    return;
  }

  await Promise.all([
    loadPositions(),
    loadClients(),
    loadDatabaseSkills(),
    loadDatabaseCertifications(),
    loadDatabaseUsers()
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
    const res = await fetch('/api/positions', {
      headers: { 'x-user-id': getStoredUserId() }
    });

    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem("user");
      sessionStorage.removeItem("user");
      window.location.href = "index.html";
      return;
    }

    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    
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
    console.error("Error loading positions:", err.message); 
  }
}

async function loadClients() {
  const select = document.getElementById('clientSelect');
  if (!select) return;

  try {
    const res = await fetch('/api/clients', {
      headers: { 'x-user-id': getStoredUserId() }
    });

    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem("user");
      sessionStorage.removeItem("user");
      window.location.href = "index.html";
      return;
    }

    if (!res.ok) throw new Error(`HTTP error ${res.status}`);

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
    console.error("Error loading clients:", err.message); 
  }
}

async function loadDatabaseSkills() {
  try {
    const res = await fetch('/api/skills', {
      headers: { 'x-user-id': getStoredUserId() }
    });

    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem("user");
      sessionStorage.removeItem("user");
      window.location.href = "index.html";
      return;
    }

    if (!res.ok) throw new Error(`HTTP error ${res.status}`);

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
    console.error("Error loading skills from DB:", err.message);
  }
}

async function loadDatabaseCertifications() {
  try {
    const res = await fetch('/api/certifications', {
      headers: { 'x-user-id': getStoredUserId() }
    });

    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem("user");
      sessionStorage.removeItem("user");
      window.location.href = "index.html";
      return;
    }

    if (!res.ok) throw new Error(`HTTP error ${res.status}`);

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
    console.error("Error loading certifications from DB:", err.message);
  }
}

async function loadDatabaseUsers() {
  try {
    const res = await fetch('/api/users', {
      headers: { 'x-user-id': getStoredUserId() }
    });

    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem("user");
      sessionStorage.removeItem("user");
      window.location.href = "index.html";
      return;
    }

    if (!res.ok) throw new Error(`HTTP error ${res.status}`);

    dbUsers = await res.json();
    const select = document.getElementById('recruitersDropdown');

    if (Array.isArray(dbUsers) && select) {
      dbUsers.forEach(u => {
        const name = u.FullName || u.fullName || u.Email || u.email;
        const id = u.UserID || u.id;
        select.appendChild(new Option(name, id));
      });
    }
  } catch (err) {
    console.error("Error loading users/recruiters from DB:", err.message);
  }
}

function setCurrentUserDefault() {
  const user = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}');
  const userId = getStoredUserId();
  if (user.fullName || user.FullName || user.email || user.Email) {
    addTag('recruiter', user.fullName || user.FullName || user.email || 'Current User', userId || null);
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
    const res = await fetch(`/api/roles?positionId=${posId}&clientId=${clientId}`, {
      headers: { 'x-user-id': getStoredUserId() }
    });

    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem("user");
      sessionStorage.removeItem("user");
      window.location.href = "index.html";
      return;
    }

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
  let years = null;

  if (type === 'reqSkill') {
    const yrsInput = document.getElementById('skillYearsInput');
    yrs = yrsInput ? parseInt(yrsInput.value, 10) : null;
    if (yrs && !isNaN(yrs)) {
      label += ` — ${yrs} yrs`;
      years = yrs;
    }
  }

  // Include years property in the object
  const skillItem = { id: skillId, label: label, years: years };

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

function addSelectedRecruiter() {
  const select = document.getElementById('recruitersDropdown');
  if (!select) return;

  const userId = select.value;
  const userName = select.options[select.selectedIndex]?.text;

  if (!userId) return;

  if (!selectedRecruiters.some(r => r.id === userId)) {
    selectedRecruiters.push({ id: userId, label: userName });
  }

  select.value = '';
  renderTags('recruiter');
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

  container.innerHTML = list.map((item, idx) => `
    <span class="tag">
      ${item.label}
      <span class="remove-btn" onclick="removeTag('${type}', ${idx})">×</span>
    </span>
  `).join('');
}

// --- BANNER ACTIONS ---

function viewDuplicate() {
  if (matchedDuplicateRole) window.location.href = `/roles.html?id=${matchedDuplicateRole.RoleID}`;
}

async function joinAsCoRecruiter() {
  if (!matchedDuplicateRole) return;
  const activeUserId = getStoredUserId();
  
  const res = await fetch('/api/roles-action', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'x-user-id': activeUserId
    },
    body: JSON.stringify({ action: 'Join', roleId: matchedDuplicateRole.RoleID, userId: activeUserId })
  });

  if (res.status === 401 || res.status === 403) {
    localStorage.removeItem("user");
    sessionStorage.removeItem("user");
    window.location.href = "index.html";
    return;
  }

  window.location.href = '/roles.html';
}

function ignoreDuplicate() {
  const banner = document.getElementById('duplicateBanner');
  if (banner) banner.style.display = 'none';
}

// --- FORM SUBMISSION ---

async function handleFormSubmit(e) {
  e.preventDefault();

  const activeUserId = getStoredUserId();

  if (!activeUserId) {
    alert("Session invalid or missing User ID. Please log in again.");
    window.location.href = "index.html";
    return;
  }

  // Find Submit Button & Trigger Loading UI
  const submitBtn = e.target.querySelector('button[type="submit"]') || document.getElementById('submitRoleBtn');
  const originalBtnContent = submitBtn ? submitBtn.innerHTML : 'Create Role';

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true" style="margin-right: 6px;"></span>
      Creating Role...
    `;
  }

  const payload = {
    positionId: document.getElementById('positionSelect')?.value,
    clientId: document.getElementById('clientSelect')?.value,
    seniority: document.getElementById('seniority')?.value,
    education: document.getElementById('education')?.value,
    fieldOfStudy: document.getElementById('fieldOfStudy')?.value,
    minExperience: document.getElementById('minExperience')?.value,
    location: document.getElementById('location')?.value,
    workModel: document.getElementById('workModel')?.value,
    rateMin: document.getElementById('rateMin')?.value,
    rateMax: document.getElementById('rateMax')?.value,
    recruiters: selectedRecruiters,
    reqSkills: selectedReqSkills,
    niceSkills: selectedNiceSkills,
    certifications: selectedCerts,
    otherSkills: document.getElementById('otherSkills')?.value,
    createdByUserId: activeUserId
  };

  try {
    const res = await fetch('/api/roles', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-user-id': activeUserId.toString()
      },
      body: JSON.stringify(payload)
    });

    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem("user");
      sessionStorage.removeItem("user");
      window.location.href = "index.html";
      return;
    }

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || 'Failed to create role');
    }

    window.location.href = '/roles.html';
  } catch (err) {
    console.error("Form Submit Error:", err);
    alert(err.message || 'Error creating role.');

    // Reset button state on failure so user can try again
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnContent;
    }
  }
}