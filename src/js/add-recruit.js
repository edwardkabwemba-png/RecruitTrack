// Store uploaded document URLs globally so they can be attached on submit
let uploadedDocumentUrl = null;

// Add form submit listener inside DOMContentLoaded
document.addEventListener('DOMContentLoaded', async () => {
  await Promise.all([
    loadRecruiters(),
    loadSources(),
    loadRoles(),
    loadSkills(),
    loadCertifications()
  ]);

  const candidateForm = document.getElementById('addCandidateForm') || document.getElementById('addRecruitForm') || document.querySelector('form');
  if (candidateForm) {
    candidateForm.addEventListener('submit', handleCandidateSubmit);
  }
});

// Add or update handleCandidateSubmit
async function handleCandidateSubmit(e) {
  e.preventDefault();

  const payload = {
    recruiterId: document.getElementById('recruiterSelect')?.value,
    dateSourced: document.getElementById('dateSourced')?.value,
    firstName: document.getElementById('firstName')?.value,
    surname: document.getElementById('surname')?.value,
    sourceId: document.getElementById('sourceSelect')?.value,
    countryOfResidence: document.getElementById('countrySelect')?.value,
    noticePeriod: document.getElementById('noticePeriod')?.value,
    currentRate: document.getElementById('currentRate')?.value,
    expectedRate: document.getElementById('expectedRate')?.value,
    email: document.getElementById('email')?.value,
    phone: document.getElementById('phone')?.value,
    idType: document.getElementById('idType')?.value,
    idNumber: document.getElementById('idNumber')?.value,
    roleId: document.getElementById('roleSelect')?.value,
    // Step 4: Pass uploaded file URL to database API
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
      throw new Error(data.message || 'Failed to save recruit');
    }

    alert('Candidate saved successfully!');
    window.location.href = '/recruits.html';
  } catch (err) {
    console.error("Submission error:", err);
    alert(`Error: ${err.message}`);
  }
}

// 1. Fetch Recruiters from /api/users
async function loadRecruiters() {
  const select = document.getElementById('recruiterSelect') || document.querySelector('select[name="recruiter"]');
  if (!select) return;

  try {
    const res = await fetch('/api/users');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const users = await res.json();
    select.innerHTML = '<option value="">Select Recruiter...</option>';

    if (Array.isArray(users)) {
      users.forEach(u => {
        const name = u.FullName || u.fullName || u.Email || u.email;
        const id = u.UserID || u.id;
        select.appendChild(new Option(name, id));
      });
    }
  } catch (err) {
    console.error("Error loading recruiters:", err.message);
    select.innerHTML = '<option value="">Failed to load recruiters</option>';
  }
}

// 2. Fetch Sources from /api/sources
async function loadSources() {
  const select = document.getElementById('sourceSelect') || document.querySelector('select[name="source"]');
  if (!select) return;

  try {
    const res = await fetch('/api/sources');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const sources = await res.json();
    select.innerHTML = '<option value="">Select Source...</option>';

    if (Array.isArray(sources)) {
      sources.forEach(s => {
        const name = s.SourceName;
        const id = s.SourceID;
        select.appendChild(new Option(name, id));
      });
    }
  } catch (err) {
    console.error("Error loading sources:", err.message);
    select.innerHTML = '<option value="">Failed to load sources</option>';
  }
}

// 3. Fetch Roles from /api/roles
async function loadRoles() {
  const select = document.getElementById('roleSelect') || document.querySelector('select[name="role"]');
  if (!select) return;

  try {
    const res = await fetch('/api/roles');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const roles = await res.json();
    select.innerHTML = '<option value="">Select a Role...</option>';

    if (Array.isArray(roles)) {
      roles.forEach(r => {
        const roleLabel = `${r.PositionTitle || 'Role'} @ ${r.ClientName || 'Client'} (#RL-${String(r.RoleID).padStart(4, '0')})`;
        select.appendChild(new Option(roleLabel, r.RoleID));
      });
    }
  } catch (err) {
    console.error("Error loading roles:", err.message);
    select.innerHTML = '<option value="">Failed to load roles</option>';
  }
}

// 4. Fetch Skills from /api/skills
async function loadSkills() {
  const select = document.getElementById('skillSelect') || document.querySelector('select[name="skills"]');
  if (!select) return;

  try {
    const res = await fetch('/api/skills');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const skills = await res.json();
    select.innerHTML = '<option value="">Select Skill...</option>';

    if (Array.isArray(skills)) {
      skills.forEach(s => {
        const name = s.SkillName || s.name;
        const id = s.SkillID || s.id;
        select.appendChild(new Option(name, id));
      });
    }
  } catch (err) {
    console.error("Error loading skills:", err.message);
    select.innerHTML = '<option value="">Failed to load skills</option>';
  }
}

// 5. Fetch Certifications from /api/certifications
async function loadCertifications() {
  const select = document.getElementById('certSelect') || document.querySelector('select[name="certifications"]');
  if (!select) return;

  try {
    const res = await fetch('/api/certifications');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const certs = await res.json();
    select.innerHTML = '<option value="">Select Certification...</option>';

    if (Array.isArray(certs)) {
      certs.forEach(c => {
        const name = c.CertName || c.CertificationName || c.name;
        const id = c.CertID || c.CertificationID || c.id;
        select.appendChild(new Option(name, id));
      });
    }
  } catch (err) {
    console.error("Error loading certifications:", err.message);
    select.innerHTML = '<option value="">Failed to load certifications</option>';
  }
}

// Step 3: Upload single document (CV, ID) & capture output URL
async function uploadDoc(docType, inputId, statusId) {
  const inputEl = document.getElementById(inputId);
  const statusEl = document.getElementById(statusId);
  const file = inputEl?.files[0];

  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('docType', docType);

  try {
    if (statusEl) {
      statusEl.textContent = 'Uploading...';
      statusEl.className = 'status-badge badge-pending';
    }

    const res = await fetch('/api/upload-document', {
      method: 'POST',
      body: formData
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.message || 'Upload failed');

    // Store the returned file URL globally
    if (data.fileUrl) {
      uploadedDocumentUrl = data.fileUrl;
    }

    if (statusEl) {
      statusEl.textContent = 'Uploaded';
      statusEl.className = 'status-badge badge-success';
    }
  } catch (err) {
    console.error(`Error uploading ${docType}:`, err);
    if (statusEl) {
      statusEl.textContent = 'Error';
      statusEl.className = 'status-badge badge-error';
    }
    alert(`Failed to upload ${docType}.`);
  }
}

// Step 3: Upload multiple documents (Payslips, Certs, Degrees) & capture output URLs
async function uploadMultiDocs(docType, inputId, statusId, maxFiles) {
  const inputEl = document.getElementById(inputId);
  const statusEl = document.getElementById(statusId);
  const files = inputEl?.files || [];

  if (!files.length) return;

  if (maxFiles && files.length > maxFiles) {
    alert(`You can only upload a maximum of ${maxFiles} files for ${docType}.`);
    inputEl.value = '';
    return;
  }

  const formData = new FormData();
  formData.append('docType', docType);
  for (let i = 0; i < files.length; i++) {
    formData.append('files', files[i]);
  }

  try {
    if (statusEl) {
      statusEl.textContent = 'Uploading...';
      statusEl.className = 'status-badge badge-pending';
    }

    const res = await fetch('/api/upload-document', {
      method: 'POST',
      body: formData
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.message || 'Upload failed');

    // Store returned document URL (or array of URLs)
    if (data.fileUrl) {
      uploadedDocumentUrl = data.fileUrl;
    }

    if (statusEl) {
      statusEl.textContent = `${files.length} Received`;
      statusEl.className = 'status-badge badge-success';
    }
  } catch (err) {
    console.error(`Error uploading ${docType}:`, err);
    if (statusEl) {
      statusEl.textContent = 'Error';
      statusEl.className = 'status-badge badge-error';
    }
    alert(`Failed to upload ${docType}.`);
  }
}

// Expose handlers globally for HTML onchange attributes
window.uploadDoc = uploadDoc;
window.uploadMultiDocs = uploadMultiDocs;