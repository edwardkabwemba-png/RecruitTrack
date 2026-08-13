document.addEventListener('DOMContentLoaded', async () => {
  await fetchAndRenderRoles();
});

async function fetchAndRenderRoles() {
  const tbody = document.getElementById('roles-table-body');
  if (!tbody) return;

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  try {
    const res = await fetch('/api/roles');
    
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || `Server error (Status: ${res.status})`);
    }

    const roles = await res.json();

    if (!Array.isArray(roles) || roles.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px; color: #64748b;">No roles found in database. Click "+ New Role" to create one.</td></tr>`;
      return;
    }

    tbody.innerHTML = roles.map(role => {
      const roleIdNum = role.RoleID || 0;
      const formattedId = `#RL-${String(roleIdNum).padStart(4, '0')}`;
      const status = role.Status || 'Active';
      const statusClass = `badge-${status.toLowerCase()}`;
      
      const initialsList = role.RecruiterInitials ? role.RecruiterInitials.split(',').filter(Boolean) : [];
      const idList = role.RecruiterIDs ? role.RecruiterIDs.split(',').map(Number).filter(Boolean) : [];

      const recruitersHtml = initialsList.length > 0 
        ? initialsList.map(i => `<span class="avatar">${i}</span>`).join('') 
        : '-';

      const isUserAssigned = user.id ? idList.includes(Number(user.id)) : false;
      const canJoin = !isUserAssigned && idList.length < 2 && status !== 'Closed';

      let actionsHtml = '';
      if (status === 'Closed') {
        actionsHtml = `<a href="role-details.html?id=${roleIdNum}" style="color: #94a3b8; font-style: italic; text-decoration: none;">View (archived)</a>`;
      } else {
        const freezeAction = status === 'Frozen' ? 'Unfreeze' : 'Freeze';

        actionsHtml = `
          <a href="role-details.html?id=${roleIdNum}" style="color: #2563eb; margin-right: 8px; font-weight: 500;">View</a>
          <a href="#" onclick="handleRoleAction('${freezeAction}', ${roleIdNum}); return false;" style="color: #475569; margin-right: 8px;">${freezeAction}</a>
          <a href="#" onclick="handleRoleAction('Close', ${roleIdNum}); return false;" style="color: #475569; margin-right: 8px;">Close</a>
        `;

        if (canJoin) {
          actionsHtml += `<a href="#" onclick="handleRoleAction('Join', ${roleIdNum}); return false;" style="color: #1d4ed8; font-weight: bold;">Join as Co-Recruiter</a>`;
        }
      }

      return `
        <tr>
          <td><strong>${formattedId}</strong></td>
          <td>${role.PositionTitle || 'N/A'}</td>
          <td>${role.ClientName || 'N/A'}</td>
          <td><span class="badge ${statusClass}">${status}</span></td>
          <td>${recruitersHtml}</td>
          <td>${actionsHtml}</td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    console.error("Roles table render error:", err);
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red; padding:20px;">Failed to load roles: ${err.message}</td></tr>`;
  }
}

async function handleRoleAction(action, roleId) {
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

    await fetchAndRenderRoles();

  } catch (err) {
    console.error("Action error:", err);
    alert('An error occurred executing this action.');
  }
}