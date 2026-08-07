document.addEventListener('DOMContentLoaded', async () => {
  await fetchAndRenderRoles();
});

async function fetchAndRenderRoles() {
  const tbody = document.getElementById('roles-table-body');
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  try {
    const res = await fetch('/api/roles');
    const text = await res.text();
    const roles = text ? JSON.parse(text) : [];

    if (!res.ok) throw new Error(roles.message || `Error ${res.status}`);

    if (!Array.isArray(roles) || roles.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px;">No roles found.</td></tr>`;
      return;
    }

    tbody.innerHTML = roles.map(role => {
      const formattedId = `#RL-${String(role.RoleID).padStart(4, '0')}`;
      const statusClass = `badge-${(role.Status || 'active').toLowerCase()}`;
      
      const initialsList = role.RecruiterInitials ? role.RecruiterInitials.split(',') : [];
      const idList = role.RecruiterIDs ? role.RecruiterIDs.split(',').map(Number) : [];

      const recruitersHtml = initialsList.length > 0 
        ? initialsList.map(i => `<span class="avatar">${i}</span>`).join('') 
        : '-';

      const isUserAssigned = idList.includes(Number(user.id));
      const canJoin = !isUserAssigned && idList.length < 2 && role.Status !== 'Closed';

      // Dynamic Action Buttons
      let actionsHtml = '';
      if (role.Status === 'Closed') {
        actionsHtml = `<span style="color: #94a3b8; font-style: italic;">View (archived)</span>`;
      } else {
        const freezeBtnText = role.Status === 'Frozen' ? 'Unfreeze' : 'Freeze';
        const freezeAction = role.Status === 'Frozen' ? 'Unfreeze' : 'Freeze';

        actionsHtml = `
          <a href="#" style="color: #2563eb; margin-right: 8px;">View</a>
          <a href="#" onclick="handleRoleAction('${freezeAction}', ${role.RoleID}); return false;" style="color: #475569; margin-right: 8px;">${freezeBtnText}</a>
          <a href="#" onclick="handleRoleAction('Close', ${role.RoleID}); return false;" style="color: #475569; margin-right: 8px;">Close</a>
        `;

        if (canJoin) {
          actionsHtml += `<a href="#" onclick="handleRoleAction('Join', ${role.RoleID}); return false;" style="color: #1d4ed8; font-weight: bold;">Join as Co-Recruiter</a>`;
        }
      }

      return `
        <tr>
          <td><strong>${formattedId}</strong></td>
          <td>${role.PositionTitle || 'N/A'}</td>
          <td>${role.ClientName || 'N/A'}</td>
          <td><span class="badge ${statusClass}">${role.Status}</span></td>
          <td>${recruitersHtml}</td>
          <td>${actionsHtml}</td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    console.error("Fetch error:", err);
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red; padding:20px;">${err.message}</td></tr>`;
  }
}

async function handleRoleAction(action, roleId) {
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  try {
    const res = await fetch('/api/roles-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, roleId, userId: user.id })
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.message || 'Action failed.');
      return;
    }

    // Refresh table immediately on success
    await fetchAndRenderRoles();

  } catch (err) {
    console.error("Action error:", err);
    alert('An error occurred executing this action.');
  }
}