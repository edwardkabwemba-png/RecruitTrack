document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const roleId = urlParams.get('id');

  if (!roleId) {
    alert('No Role ID provided in URL.');
    window.location.href = 'roles.html';
    return;
  }

  await loadRoleDetails(roleId);
});

async function loadRoleDetails(roleId) {
  try {
    // Standard query string parameter for Azure Functions
    const res = await fetch(`/api/role-details?id=${roleId}`);
    if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
    
    const data = await res.json();
    const role = data.role;

    if (!role) throw new Error('Role not found.');

    renderRoleDetails(role, data.recruiters);
    setupActionButtons(role);
    renderCandidatesPipeline(data.candidates || []);

  } catch (err) {
    console.error('Error fetching role details:', err);
    const titleElement = document.getElementById('role-title-text');
    if (titleElement) titleElement.innerText = 'Error Loading Role';
  }
}

function renderRoleDetails(role, recruiters) {
  const roleIdNum = role.RoleID || 0;
  const formattedId = `#RL-${String(roleIdNum).padStart(4, '0')}`;
  const status = role.Status || 'Active';

  const titleElem = document.getElementById('role-title-text');
  if (titleElem) titleElem.innerText = role.PositionTitle || 'Role Details';
  
  const idTag = document.getElementById('role-id-tag');
  if (idTag) idTag.innerText = formattedId;

  const statusBadge = document.getElementById('role-status-badge');
  if (statusBadge) {
    statusBadge.innerText = status.toUpperCase();
    statusBadge.className = `status-badge badge-${status.toLowerCase()}`;
  }

  if (document.getElementById('val-position')) document.getElementById('val-position').innerText = role.PositionTitle || 'N/A';
  if (document.getElementById('val-client')) document.getElementById('val-client').innerText = role.ClientName || 'N/A';
  if (document.getElementById('val-seniority')) document.getElementById('val-seniority').innerText = role.SeniorityLevel || 'N/A';
  if (document.getElementById('val-education')) document.getElementById('val-education').innerText = role.MinEducation || 'N/A';
  if (document.getElementById('val-experience')) document.getElementById('val-experience').innerText = role.MinYearsExperience ? `${role.MinYearsExperience} Years` : '0 Years';
  if (document.getElementById('val-model')) document.getElementById('val-model').innerText = role.WorkModel || 'N/A';

  const rateMin = role.RateBudgetMin ? `R ${parseFloat(role.RateBudgetMin).toLocaleString()}` : 'N/A';
  const rateMax = role.RateBudgetMax ? `R ${parseFloat(role.RateBudgetMax).toLocaleString()}` : 'N/A';
  if (document.getElementById('val-budget')) document.getElementById('val-budget').innerText = `${rateMin} - ${rateMax}`;

  if (document.getElementById('val-skills')) document.getElementById('val-skills').innerText = role.RequiredSkills || 'None Specified';
  if (document.getElementById('val-nice-skills')) document.getElementById('val-nice-skills').innerText = role.NiceToHaveSkills || 'None Specified';
  if (document.getElementById('val-certs')) document.getElementById('val-certs').innerText = role.RequiredCertifications || 'None Specified';

  const recruitersContainer = document.getElementById('recruiters-container');
  if (recruitersContainer) {
    if (recruiters && recruiters.length > 0) {
      recruitersContainer.innerHTML = recruiters.map(u => `
        <span class="user-tag">
          <strong>${u.AvatarInitials || u.FullName || 'NA'}</strong>
        </span>
      `).join('');
    } else {
      recruitersContainer.innerHTML = `<span style="font-size:0.8rem; color:#94a3b8;">No recruiters assigned</span>`;
    }
  }
}

function renderCandidatesPipeline(candidates) {
  // Target multiple possible container IDs used across wireframe versions
  const tbody = document.getElementById('candidatesTableBody') || document.querySelector('#candidatesTable tbody') || document.querySelector('tbody');
  const countHeader = document.getElementById('candidateCountHeader') || document.querySelector('.candidates-header h3');
  const metricsText = document.getElementById('pipelineMetricsText');

  if (countHeader) countHeader.textContent = `Candidates on this Role (${candidates.length})`;

  if (!tbody) return;

  if (candidates.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #64748b; padding: 25px;">No candidates on this role yet.</td></tr>`;
    if (metricsText) metricsText.textContent = '';
    return;
  }

  // Aggregate breakdown metrics
  const stageCounts = {};
  candidates.forEach(c => {
    const stageLabel = c.IsFailed ? `Not Successful` : c.Stage;
    stageCounts[stageLabel] = (stageCounts[stageLabel] || 0) + 1;
  });

  if (metricsText) {
    metricsText.textContent = Object.entries(stageCounts)
      .map(([stage, count]) => `${count} ${stage}`)
      .join(' · ');
  }

  // Render Table Rows
  tbody.innerHTML = candidates.map(c => {
    const stageName = c.IsFailed ? `Not Successful — ${c.Stage}` : c.Stage;
    const progressDisplay = c.IsFailed ? '—' : `${c.ProgressPercentage}%`;
    const badgeClass = getStageBadgeClass(c.Stage, c.IsFailed);

    return `
      <tr>
        <td><strong>${c.CandidateName}</strong></td>
        <td><span class="avatar-chip">${c.RecruiterInitials || 'NA'}</span></td>
        <td><span class="badge ${badgeClass}">${stageName}</span></td>
        <td>${progressDisplay}</td>
        <td>${c.UploadedDocCount}/6</td>
      </tr>
    `;
  }).join('');
}

function getStageBadgeClass(stage, isFailed) {
  if (isFailed) return 'badge-rejected';
  switch (stage) {
    case 'Hired': return 'badge-hired';
    case 'Interviewed': return 'badge-interviewed';
    case 'CV Prepared': return 'badge-cv';
    case 'Screened': return 'badge-screened';
    default: return 'badge-discussion';
  }
}

function setupActionButtons(role) {
  const roleId = role.RoleID;
  const status = role.Status || 'Active';

  const editBtn = document.getElementById('btn-edit');
  const freezeBtn = document.getElementById('btn-freeze');
  const closeBtn = document.getElementById('btn-close');

  if (freezeBtn) {
    freezeBtn.innerText = status === 'Frozen' ? 'Unfreeze' : 'Freeze';
    freezeBtn.onclick = () => {
      const nextAction = status === 'Frozen' ? 'Unfreeze' : 'Freeze';
      executeRoleAction(nextAction, roleId);
    };
  }

  if (closeBtn) {
    if (status === 'Closed') {
      closeBtn.disabled = true;
      closeBtn.style.opacity = '0.5';
      closeBtn.style.cursor = 'not-allowed';
    } else {
      closeBtn.onclick = () => {
        const formattedId = `#RL-${String(roleId).padStart(4, '0')}`;
        const confirmed = confirm(`Are you sure you want to close ticket ${formattedId}? This will archive the role.`);
        if (confirmed) {
          executeRoleAction('Close', roleId);
        }
      };
    }
  }

  if (editBtn) {
    editBtn.onclick = () => {
      window.location.href = `edit-role.html?id=${roleId}`;
    };
  }
}

async function executeRoleAction(action, roleId) {
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  try {
    const res = await fetch('/api/roles-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, roleId, userId: user.id || null })
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.message || 'Action failed.');
      return;
    }

    await loadRoleDetails(roleId);

  } catch (err) {
    console.error(`Error executing action ${action}:`, err);
    alert('An error occurred executing this action.');
  }
}