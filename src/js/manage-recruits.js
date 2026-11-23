let selectedRoles = [];
let selectedClassifications = [];
let selectedSkills = [];
let activeRolesList = [];
let nameSearchTimer = null;

// Helper: Safely retrieve logged-in User ID from storage
function getStoredUserId() {
  const storedUser = JSON.parse(localStorage.getItem("user") || sessionStorage.getItem("user") || "{}");
  return storedUser.userId || storedUser.UserID || storedUser.id || localStorage.getItem('userId') || sessionStorage.getItem('userId') || window.currentUserId || '';
}

document.addEventListener('DOMContentLoaded', async () => {
  const currentUserId = getStoredUserId();
  if (!currentUserId) {
    window.location.href = "index.html";
    return;
  }

  await loadTalentPoolDropdowns();
  setupTalentPoolListeners();
  await fetchTalentPool();
});

async function loadTalentPoolDropdowns() {
  try {
    const res = await fetch('/api/recruits?action=dropdowns', {
      headers: { 'x-user-id': getStoredUserId().toString() }
    });

    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem("user");
      sessionStorage.removeItem("user");
      window.location.href = "index.html";
      return;
    }

    if (!res.ok) return;

    const data = await res.json();

    const roleSelect = document.getElementById('roleDropdownSelect');
    const classSelect = document.getElementById('classificationDropdownSelect');
    const uniqueClassifications = new Set();

    if (Array.isArray(data.positions)) {
      data.positions.forEach(p => {
        if (roleSelect && p.PositionTitle) {
          roleSelect.appendChild(new Option(p.PositionTitle, p.PositionTitle));
        }
        if (p.classification) {
          uniqueClassifications.add(p.classification.trim());
        }
      });
    }

    if (classSelect) {
      Array.from(uniqueClassifications).sort().forEach(cls => {
        classSelect.appendChild(new Option(cls, cls));
      });
    }

    const skillSelect = document.getElementById('skillDropdownSelect');
    if (skillSelect && Array.isArray(data.skills)) {
      data.skills.forEach(s => {
        skillSelect.appendChild(new Option(s.SkillName, s.SkillName));
      });
    }

    activeRolesList = data.roles || [];
    const targetRoleSelect = document.getElementById('targetRoleSelect');
    if (targetRoleSelect) {
      activeRolesList.forEach(r => {
        const formattedId = `#RL-${String(r.RoleID).padStart(4, '0')}`;
        targetRoleSelect.appendChild(new Option(`${formattedId} — ${r.RoleTitle}`, r.RoleID));
      });
    }
  } catch (err) {
    console.error("Error loading Talent Pool dropdowns:", err);
  }
}

function setupTalentPoolListeners() {
  // Live debounced search by candidate name & surname
  document.getElementById('candidateNameSearch')?.addEventListener('input', () => {
    clearTimeout(nameSearchTimer);
    nameSearchTimer = setTimeout(() => {
      fetchTalentPool();
    }, 300);
  });

  // Multi-select Role pills
  document.getElementById('roleDropdownSelect')?.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val && !selectedRoles.includes(val)) {
      selectedRoles.push(val);
      renderFilterPills('role');
      fetchTalentPool();
    }
    e.target.value = '';
  });

  // Multi-select Classification pills
  document.getElementById('classificationDropdownSelect')?.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val && !selectedClassifications.includes(val)) {
      selectedClassifications.push(val);
      renderFilterPills('classification');
      fetchTalentPool();
    }
    e.target.value = '';
  });

  // Multi-select Skill pills
  document.getElementById('skillDropdownSelect')?.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val && !selectedSkills.includes(val)) {
      selectedSkills.push(val);
      renderFilterPills('skill');
      fetchTalentPool();
    }
    e.target.value = '';
  });

  // Refine filters, Search, Clear, and Sort
  document.getElementById('seniorityFilter')?.addEventListener('change', fetchTalentPool);
  document.getElementById('minExperienceFilter')?.addEventListener('change', fetchTalentPool);
  document.getElementById('hideActivePipelineCheckbox')?.addEventListener('change', fetchTalentPool);
  document.getElementById('sortOrderSelect')?.addEventListener('change', fetchTalentPool);
  document.getElementById('btnSearchTalentPool')?.addEventListener('click', fetchTalentPool);

  document.getElementById('btnClearTalentPool')?.addEventListener('click', () => {
    selectedRoles = [];
    selectedClassifications = [];
    selectedSkills = [];
    renderFilterPills('role');
    renderFilterPills('classification');
    renderFilterPills('skill');

    const nameSearchEl = document.getElementById('candidateNameSearch');
    const seniorityEl = document.getElementById('seniorityFilter');
    const minExpEl = document.getElementById('minExperienceFilter');
    const hideEl = document.getElementById('hideActivePipelineCheckbox');
    if (nameSearchEl) nameSearchEl.value = '';
    if (seniorityEl) seniorityEl.value = '';
    if (minExpEl) minExpEl.value = '';
    if (hideEl) hideEl.checked = false;

    fetchTalentPool();
  });

  // Submit to Role Modal handlers
  document.getElementById('closeSubmitRoleModal')?.addEventListener('click', closeSubmitToRoleModal);
  document.getElementById('cancelSubmitRoleBtn')?.addEventListener('click', closeSubmitToRoleModal);
  document.getElementById('submitToRoleForm')?.addEventListener('submit', handleSubmitToRole);
}

function renderFilterPills(type) {
  if (type === 'role') {
    const container = document.getElementById('selectedRolesContainer');
    const select = document.getElementById('roleDropdownSelect');
    if (!container || !select) return;
    container.querySelectorAll('.tp-tag-pill').forEach(el => el.remove());
    selectedRoles.forEach((role, idx) => {
      const pill = document.createElement('span');
      pill.className = 'tp-tag-pill';
      pill.innerHTML = `${role} <span class="tp-tag-remove" onclick="removeFilterPill('role', ${idx})">×</span>`;
      container.insertBefore(pill, select);
    });
  } else if (type === 'classification') {
    const container = document.getElementById('selectedClassificationsContainer');
    const select = document.getElementById('classificationDropdownSelect');
    if (!container || !select) return;
    container.querySelectorAll('.tp-tag-pill').forEach(el => el.remove());
    selectedClassifications.forEach((cls, idx) => {
      const pill = document.createElement('span');
      pill.className = 'tp-tag-pill';
      pill.innerHTML = `${cls} <span class="tp-tag-remove" onclick="removeFilterPill('classification', ${idx})">×</span>`;
      container.insertBefore(pill, select);
    });
  } else if (type === 'skill') {
    const container = document.getElementById('selectedSkillsContainer');
    if (!container) return;
    container.innerHTML = selectedSkills.map((sk, idx) => `
      <span class="tp-tag-pill">${sk} <span class="tp-tag-remove" onclick="removeFilterPill('skill', ${idx})">×</span></span>
    `).join('');
  }
}

function removeFilterPill(type, index) {
  if (type === 'role') selectedRoles.splice(index, 1);
  else if (type === 'classification') selectedClassifications.splice(index, 1);
  else if (type === 'skill') selectedSkills.splice(index, 1);

  renderFilterPills(type);
  fetchTalentPool();
}

function formatMonthsAgo(dateValue) {
  if (!dateValue) return { text: 'confirmed recently', isStale: false };
  const d = new Date(dateValue);
  if (isNaN(d.getTime())) return { text: 'confirmed recently', isStale: false };

  const now = new Date();
  const months = Math.max(0, (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth()));
  const text = months === 0 ? 'confirmed this month' : `confirmed ${months} month${months === 1 ? '' : 's'} ago`;
  return { text, isStale: months >= 12 };
}

function formatSkillsDisplay(skillsRaw, otherSkillsRaw) {
  const parts = [];
  [skillsRaw, otherSkillsRaw].forEach(val => {
    if (!val) return;
    if (Array.isArray(val)) {
      parts.push(...val);
    } else if (typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) {
            parts.push(...parsed);
            return;
          }
        } catch (_) {}
      }
      parts.push(trimmed);
    }
  });
  return parts.filter(Boolean).join(', ') || '-';
}

function formatExpectedRate(c) {
  const freqLabel = (c.ExpectedRateFrequency || 'Monthly').toLowerCase().startsWith('hour') ? '/ hr' : '/ mo';
  const currency = (c.ExpectedRateCurrency || 'ZAR').toUpperCase();
  const zarVal = c.ExpectedRate ? Number(c.ExpectedRate).toLocaleString('en-ZA') : null;
  const rawVal = c.ExpectedRateRaw ? Number(c.ExpectedRateRaw).toLocaleString('en-US') : null;

  if (!zarVal && !rawVal) return '-';

  if (currency !== 'ZAR' && rawVal) {
    const symbol = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : currency;
    return `
      <div>${symbol} ${rawVal} ${freqLabel}</div>
      ${zarVal ? `<span class="tp-subtext">≈ R ${zarVal}</span>` : ''}
    `;
  }

  return `R ${zarVal || rawVal} ${freqLabel}`;
}

async function fetchTalentPool() {
  const tbody = document.getElementById('recruitsTableBody');
  const countLabel = document.getElementById('resultsCountLabel');
  if (!tbody) return;

  try {
    const params = new URLSearchParams({ action: 'talentPool' });

    const searchVal = document.getElementById('candidateNameSearch')?.value.trim();
    if (searchVal) params.append('search', searchVal);

    if (selectedRoles.length > 0) params.append('roles', selectedRoles.join(','));
    if (selectedClassifications.length > 0) params.append('classifications', selectedClassifications.join(','));
    if (selectedSkills.length > 0) params.append('skills', selectedSkills.join(','));

    const seniority = document.getElementById('seniorityFilter')?.value;
    const minExp = document.getElementById('minExperienceFilter')?.value;
    const hideActive = document.getElementById('hideActivePipelineCheckbox')?.checked;
    const sortOrder = document.getElementById('sortOrderSelect')?.value;

    if (seniority) params.append('seniority', seniority);
    if (minExp) params.append('minExp', minExp);
    if (hideActive) params.append('hideActive', 'true');
    if (sortOrder) params.append('sort', sortOrder);

    const res = await fetch(`/api/recruits?${params.toString()}`, {
      headers: { 'x-user-id': getStoredUserId().toString() }
    });

    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem("user");
      sessionStorage.removeItem("user");
      window.location.href = "index.html";
      return;
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText || `HTTP ${res.status}`);
    }

    const candidates = await res.json();
    const list = Array.isArray(candidates) ? candidates : [];

    if (countLabel) {
      countLabel.textContent = `Results (${list.length} candidate${list.length === 1 ? '' : 's'})`;
    }

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted">No candidates found matching your filter criteria.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(c => {
      const fullName = `${c.FirstName || ''} ${c.Surname || ''}`.trim() || 'Unknown Candidate';
      const cid = `CID-${String(c.RecruitID).padStart(5, '0')}`;
      const confirmedInfo = formatMonthsAgo(c.DateSourced || c.CreatedDate);

      const seniorityPart = c.SeniorityLevel || '';
      const expPart = (c.TotalYearsExperience !== null && c.TotalYearsExperience !== undefined && c.TotalYearsExperience !== '')
        ? `${c.TotalYearsExperience} yrs`
        : '';
      const seniorityYrs = [seniorityPart, expPart].filter(Boolean).join(' / ') || '-';

      const keySkills = formatSkillsDisplay(c.Skills, c.OtherSkills);
      const rateHtml = formatExpectedRate(c);

      const inPipeline = Number(c.IsInActivePipeline) === 1;
      const statusHtml = inPipeline
        ? `
          <span class="tp-status-pill tp-status-pipeline">In pipeline</span>
          <span class="tp-subtext">#RL-${String(c.ActiveRoleID || 0).padStart(4, '0')} — ${c.ActiveRecruiterName || 'Recruiter'}</span>
        `
        : `
          <span class="tp-status-pill tp-status-available">Available</span>
          ${c.PositionTitle ? `<span class="tp-subtext">last applied: ${c.PositionTitle}</span>` : ''}
        `;

      const actionsHtml = inPipeline
        ? `<a href="add-recruit.html?id=${c.RecruitID}" class="nav-link-inline">View</a>`
        : `
          <a href="add-recruit.html?id=${c.RecruitID}" class="nav-link-inline">View</a>
          <span class="text-muted"> · </span>
          <a href="javascript:void(0)" onclick="openSubmitToRoleModal(${c.RecruitID}, '${fullName.replace(/'/g, "\\'")}')" class="nav-link-inline">Submit to Role</a>
        `;

      return `
        <tr>
          <td>
            <a href="add-recruit.html?id=${c.RecruitID}" class="tp-candidate-name">${fullName}</a>
            <span class="tp-candidate-id">${cid}</span>
          </td>
          <td>
            <div>${c.CurrentRole || '-'}</div>
            ${confirmedInfo.isStale
              ? `<span class="tp-stale-badge">${confirmedInfo.text}</span>`
              : `<span class="tp-subtext">${confirmedInfo.text}</span>`}
          </td>
          <td>${c.RoleClassification || '-'}</td>
          <td>${seniorityYrs}</td>
          <td>${keySkills}</td>
          <td>${rateHtml}</td>
          <td>${statusHtml}</td>
          <td>${actionsHtml}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error("Error loading Talent Pool:", err);
    tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="color: #dc2626;">Failed to load candidates: ${err.message}</td></tr>`;
  }
}

function openSubmitToRoleModal(recruitId, fullName) {
  const modal = document.getElementById('submitToRoleModal');
  document.getElementById('submitCandidateId').value = recruitId;
  document.getElementById('submitCandidateNameDisplay').value = fullName;
  if (modal) modal.style.display = 'flex';
}

function closeSubmitToRoleModal() {
  const modal = document.getElementById('submitToRoleModal');
  if (modal) modal.style.display = 'none';
}

async function handleSubmitToRole(e) {
  e.preventDefault();
  const recruitId = document.getElementById('submitCandidateId').value;
  const roleId = document.getElementById('targetRoleSelect').value;
  if (!recruitId || !roleId) return;

  try {
    const res = await fetch('/api/recruits', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': getStoredUserId().toString()
      },
      body: JSON.stringify({
        action: 'submitToRole',
        recruitId: parseInt(recruitId, 10),
        roleId: parseInt(roleId, 10),
        recruiterId: parseInt(getStoredUserId(), 10)
      })
    });

    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem("user");
      sessionStorage.removeItem("user");
      window.location.href = "index.html";
      return;
    }

    const data = await res.json();
    if (!res.ok) {
      alert(data.message || 'Failed to submit candidate to role.');
      return;
    }

    closeSubmitToRoleModal();
    await fetchTalentPool();
  } catch (err) {
    console.error("Submit to role error:", err);
    alert('An error occurred submitting the candidate.');
  }
}