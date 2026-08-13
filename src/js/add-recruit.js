let currentStage = 2; // Default: 'In Discussion'
const stages = ["Sourced", "In Discussion", "Screened", "CV Prepared", "Interviewed", "Offer Sent", "Hired"];
let selectedSkills = [];
let selectedCerts = [];
let uploadedUrls = {};

document.addEventListener("DOMContentLoaded", async () => {
  // Set default Sourced Date to Today (YYYY-MM-DD)
  document.getElementById("dateSourced").value = new Date().toISOString().split('T')[0];

  // Load Dropdowns
  await loadDropdowns();

  // Set initial Advance Stage button text
  updateStageUI();
});

async function loadDropdowns() {
  try {
    const res = await fetch('/api/recruits?action=dropdowns');
    const data = await res.json();

    // Populate Recruiters
    const recSelect = document.getElementById('recruiterSelect');
    recSelect.innerHTML = '<option value="">Select Recruiter...</option>' + 
      data.recruiters.map(u => `<option value="${u.UserID}">${u.FullName}</option>`).join('');

    // Populate Sources
    const srcSelect = document.getElementById('sourceSelect');
    srcSelect.innerHTML = '<option value="">Select Source...</option>' + 
      data.sources.map(s => `<option value="${s.SourceID}">${s.SourceName}</option>`).join('');

    // Populate Roles
    const roleSelect = document.getElementById('roleSelect');
    roleSelect.innerHTML = '<option value="">Select Role...</option>' + 
      data.roles.map(r => `<option value="${r.RoleID}">${r.RoleTitle}</option>`).join('');

    // Populate Skills Dropdown
    const skillSelect = document.getElementById('skillDropdown');
    skillSelect.innerHTML = data.skills.map(s => `<option value="${s.SkillName}">${s.SkillName}</option>`).join('');

    // Populate Certifications Dropdown
    const certSelect = document.getElementById('certDropdown');
    certSelect.innerHTML = data.certifications.map(c => `<option value="${c.CertName}">${c.CertName}</option>`).join('');

  } catch (err) {
    console.error("Error loading dropdowns:", err);
  }
}

// Add Skill Tag
function addSkillTag() {
  const skill = document.getElementById('skillDropdown').value;
  const yrs = document.getElementById('skillYears').value || 1;
  const tagStr = `${skill} — ${yrs} yrs`;

  if (!selectedSkills.includes(tagStr)) {
    selectedSkills.push(tagStr);
    renderTags('skillsContainer', selectedSkills, removeSkillTag);
  }
}

function removeSkillTag(index) {
  selectedSkills.splice(index, 1);
  renderTags('skillsContainer', selectedSkills, removeSkillTag);
}

// Add Certification Tag
function addCertTag() {
  const cert = document.getElementById('certDropdown').value;
  if (!selectedCerts.includes(cert)) {
    selectedCerts.push(cert);
    renderTags('certsContainer', selectedCerts, removeCertTag);
  }
}

function removeCertTag(index) {
  selectedCerts.splice(index, 1);
  renderTags('certsContainer', selectedCerts, removeCertTag);
}

function renderTags(containerId, list, removeCallback) {
  const container = document.getElementById(containerId);
  container.innerHTML = list.map((item, idx) => `
    <span class="tag-badge">${item} <span class="remove-btn" onclick="${removeCallback.name}(${idx})">×</span></span>
  `).join('');
}

// Section D Stage Advance Button
function updateStageUI() {
  const btn = document.getElementById("advanceStageBtn");
  if (currentStage < stages.length) {
    btn.innerText = `Advance to ${stages[currentStage]}`;
  } else {
    btn.innerText = "Completed (Hired)";
    btn.disabled = true;
  }
}

function advanceStage() {
  if (currentStage < stages.length) {
    currentStage++;
    updateStageUI();
  }
}

// Section E Upload Files to Azure Blob
async function uploadDoc(docType, inputId, statusSpanId) {
  const fileInput = document.getElementById(inputId);
  if (!fileInput.files.length) return;

  const fname = `${document.getElementById('firstName').value} ${document.getElementById('surname').value}`.trim() || 'Candidate';
  const formData = new FormData();
  formData.append('file', fileInput.files[0]);

  const span = document.getElementById(statusSpanId);
  span.innerText = "Uploading...";

  try {
    const res = await fetch(`/api/upload-document?fullName=${encodeURIComponent(fname)}&docType=${docType}`, {
      method: 'POST',
      body: formData
    });

    const result = await res.json();
    if (res.ok) {
      span.innerText = "Received";
      span.className = "status-badge badge-received";
      uploadedUrls[docType] = result.blobUrl;
    } else {
      span.innerText = "Upload Failed";
    }
  } catch (err) {
    console.error("Upload Error:", err);
    span.innerText = "Error";
  }
}

async function uploadMultiDocs(docType, inputId, statusSpanId, maxLimit) {
  const fileInput = document.getElementById(inputId);
  const count = fileInput.files.length;
  if (count === 0) return;

  if (count > maxLimit) {
    alert(`Maximum ${maxLimit} files allowed.`);
    return;
  }

  const span = document.getElementById(statusSpanId);
  span.innerText = `${count} of ${maxLimit} Received`;
  span.className = "status-badge badge-received";
}