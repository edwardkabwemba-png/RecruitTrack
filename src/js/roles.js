document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const roleId = urlParams.get('id');

  if (!roleId) {
    alert("No Role ID specified.");
    window.location.href = "roles.html";
    return;
  }

  await loadRoleDetails(roleId);
});

async function loadRoleDetails(roleId) {
  try {
    const res = await fetch(`/api/role-details/${roleId}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch role details (Status ${res.status})`);
    }

    const { role, recruiters, candidates } = await res.json();

    // 1. Populate Headers & Badges
    document.getElementById('role-title-text').textContent = `${role.PositionTitle || 'Unknown Role'} @ ${role.ClientName || 'Unknown Client'}`;
    document.getElementById('role-id-tag').textContent = `#RL-${String(role.RoleID).padStart(4, '0')}`;
    
    const statusBadge = document.getElementById('role-status-badge');
    if (statusBadge) {
      statusBadge.textContent = role.Status || 'ACTIVE';
      statusBadge.className = `status-badge badge-${(role.Status || 'active').toLowerCase()}`;
    }

    // 2. Populate Job Description Fields
    document.getElementById('val-position').textContent = role.PositionTitle || 'N/A';
    document.getElementById('val-client').textContent = role.ClientName || 'N/A';
    document.getElementById('val-seniority').textContent = role.Seniority || 'N/A';
    document.getElementById('val-education').textContent = role.MinEducation || 'N/A';
    document.getElementById('val-experience').textContent = role.MinExperienceYears ? `${role.MinExperienceYears} years` : 'N/A';
    document.getElementById('val-model').textContent = role.WorkModel || 'N/A';

    const salaryText = (role.MinSalary && role.MaxSalary)
      ? `R${Number(role.MinSalary).toLocaleString()} – R${Number(role.MaxSalary).toLocaleString()} / month`
      : 'N/A';
    document.getElementById('val-budget').textContent = salaryText;

    document.getElementById('val-skills').textContent = role.RequiredSkills || 'None listed';
    document.getElementById('val-nice-skills').textContent = role.NiceToHaveSkills || 'None listed';
    document.getElementById('val-certs').textContent = role.RequiredCertifications || 'None required';

    // 3. Populate Recruiters List
    const recruitersContainer = document.getElementById('recruiters-container');
    if (recruitersContainer) {
      if (recruiters.length === 0) {
        recruitersContainer.innerHTML = '<span style="font-size:0.8rem; color:#94a3b8;">No recruiters assigned</span>';
      } else {
        recruitersContainer.innerHTML = recruiters.map(r => `
          <span class="user-tag">
            ${escapeHtml(r.FirstName)} ${escapeHtml(r.LastName ? r.LastName[0] + '.' : '')}
            <span class="remove-tag" onclick="removeRecruiter(${r.UserID})">&times;</span>
          </span>
        `).join('') + `<button class="btn-add-tag">+ Add recruiter</button>`;
      }
    }

    // 4. Populate Candidates Table
    const candidatesBody = document.getElementById('candidates-table-body');
    const candidateCountEl = document.getElementById('candidate-count');

    if (candidateCountEl) candidateCountEl.textContent = candidates.length;

    if (!candidatesBody) return;

    if (candidates.length === 0) {
      candidatesBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 20px; color: #64748b;">No candidates associated with this role.</td></tr>`;
      return;
    }

    candidatesBody.innerHTML = candidates.map(c => {
      const stagePillClass = getStagePillClass(c.Stage);
      const docsText = c.TotalDocumentsRequired ? `${c.DocumentsCount}/${c.TotalDocumentsRequired}` : '—';
      const progressText = c.ProgressPercentage ? `${c.ProgressPercentage}%` : '—';

      return `
        <tr>
          <td style="font-weight: 600;">${escapeHtml(c.CandidateName)}</td>
          <td>${escapeHtml(c.RecruiterInitials || '-')}</td>
          <td><span class="pill ${stagePillClass}">${escapeHtml(c.Stage)}</span></td>
          <td>${progressText}</td>
          <td>${docsText}</td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    console.error("Error loading role details:", err);
    alert("Unable to load role details. Returning to role list.");
  }
}

function getStagePillClass(stage = '') {
  const lower = stage.toLowerCase();
  if (lower.includes('screen')) return 'pill-screened';
  if (lower.includes('cv')) return 'pill-cv';
  if (lower.includes('interview')) return 'pill-interview';
  if (lower.includes('hire')) return 'pill-hired';
  if (lower.includes('not successful') || lower.includes('reject')) return 'pill-rejected';
  return 'pill-screened';
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}