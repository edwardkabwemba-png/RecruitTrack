document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const roleId = urlParams.get('id');

  if (!roleId) {
    alert('No Role ID provided in URL.');
    window.location.href = 'roles.html';
    return;
  }

  // Load Initial Role Details
  await loadRoleDetails(roleId);
});

async function loadRoleDetails(roleId) {
  try {
    const res = await fetch(`/api/roles?id=${roleId}`);
    if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
    
    const data = await res.json();
    const role = Array.isArray(data) ? data.find(r => r.RoleID == roleId) || data[0] : data;

    if (!role) throw new Error('Role not found.');

    renderRoleDetails(role);
    setupActionButtons(role);

  } catch (err) {
    console.error('Error fetching role details:', err);
    document.getElementById('role-title-text').innerText = 'Error Loading Role';
  }
}

function renderRoleDetails(role) {
  const roleIdNum = role.RoleID || 0;
  const formattedId = `#RL-${String(roleIdNum).padStart(4, '0')}`;
  const status = role.Status || 'Active';

  // Title and Header Tags
  document.getElementById('role-title-text').innerText = role.PositionTitle || 'Role Details';
  document.getElementById('role-id-tag').innerText = formattedId;

  // Status Badge
  const statusBadge = document.getElementById('role-status-badge');
  if (statusBadge) {
    statusBadge.innerText = status.toUpperCase();
    statusBadge.className = `status-badge badge-${status.toLowerCase()}`;
  }

  // Job Details Grid
  document.getElementById('val-position').innerText = role.PositionTitle || 'N/A';
  document.getElementById('val-client').innerText = role.ClientName || 'N/A';
  document.getElementById('val-seniority').innerText = role.SeniorityLevel || 'N/A';
  document.getElementById('val-education').innerText = role.MinEducation || 'N/A';
  document.getElementById('val-experience').innerText = role.MinYearsExperience ? `${role.MinYearsExperience} Years` : '0 Years';
  document.getElementById('val-model').innerText = role.WorkModel || 'N/A';

  const rateMin = role.RateBudgetMin ? `$${parseFloat(role.RateBudgetMin).toLocaleString()}` : 'N/A';
  const rateMax = role.RateBudgetMax ? `$${parseFloat(role.RateBudgetMax).toLocaleString()}` : 'N/A';
  document.getElementById('val-budget').innerText = `${rateMin} - ${rateMax}`;

  // Skills & Certifications
  document.getElementById('val-skills').innerText = role.RequiredSkills || 'None Specified';
  document.getElementById('val-nice-skills').innerText = role.NiceToHaveSkills || 'None Specified';
  document.getElementById('val-certs').innerText = role.RequiredCertifications || 'None Specified';

  // Recruiters Tag Container
  const recruitersContainer = document.getElementById('recruiters-container');
  if (recruitersContainer) {
    const initialsList = role.RecruiterInitials ? role.RecruiterInitials.split(',').filter(Boolean) : [];
    
    if (initialsList.length > 0) {
      recruitersContainer.innerHTML = initialsList.map(init => `
        <span class="user-tag">
          <strong>${init}</strong>
        </span>
      `).join('');
    } else {
      recruitersContainer.innerHTML = `<span style="font-size:0.8rem; color:#94a3b8;">No recruiters assigned</span>`;
    }
  }
}

function setupActionButtons(role) {
  const roleId = role.RoleID;
  const status = role.Status || 'Active';

  const editBtn = document.getElementById('btn-edit');
  const freezeBtn = document.getElementById('btn-freeze');
  const closeBtn = document.getElementById('btn-close');

  // Configure Freeze / Unfreeze Label
  if (freezeBtn) {
    freezeBtn.innerText = status === 'Frozen' ? 'Unfreeze' : 'Freeze';
    freezeBtn.onclick = () => {
      const nextAction = status === 'Frozen' ? 'Unfreeze' : 'Freeze';
      executeRoleAction(nextAction, roleId);
    };
  }

  // Configure Close Button with Confirmation
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

  // Configure Edit Button
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

    // Reload page details after successful action execution
    await loadRoleDetails(roleId);

  } catch (err) {
    console.error(`Error executing action ${action}:`, err);
    alert('An error occurred executing this action.');
  }
}