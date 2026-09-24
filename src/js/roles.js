document.addEventListener('DOMContentLoaded', async () => {
  await fetchAndRenderRoles();
});

// Helper function to safely extract active user object and ID
function getActiveUser() {
  try {
    const rawUser = localStorage.getItem('user');
    if (!rawUser) return null;
    
    const user = JSON.parse(rawUser);
    // Check common ID properties (id, userId, UserID, sub)
    const userId = user.id || user.userId || user.UserID || user.sub || null;
    
    return userId ? { ...user, id: Number(userId) } : null;
  } catch (e) {
    console.error("Error reading user from localStorage:", e);
    return null;
  }
}

async function fetchAndRenderRoles() {
  const tbody = document.getElementById('roles-table-body');
  if (!tbody) return;

  const user = getActiveUser();

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (user && user.id) {
      headers['x-user-id'] = user.id.toString();
    }

    const res = await fetch('/api/roles', { headers });
    
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

      const isUserAssigned = user && user.id ? idList.includes(Number(user.id)) : false;
      const canJoin = !isUserAssigned && idList.length < 2 && status !== 'Closed';

      let actionsHtml = '';
      if (status === 'Closed') {
        actionsHtml = `<a href="role-details.html?id=${roleIdNum}" style="color: #94a3b8; font-style: italic; text-decoration: none;">View (archived)</a>`;
      } else {
        const freezeAction = status === 'Frozen' ? 'Unfreeze' : 'Freeze';

        actionsHtml = `
          <a href="role-details.html?id=${roleIdNum}" style="color: #2563eb; margin-right: 8px; font-weight: 500;">View</a>
          <a href="#" onclick="handleRoleAction('${freezeAction}', ${roleIdNum}); return false;" style="color: #475569; margin-right: 8px;">${freezeAction}</a>
          <a href="#" onclick="handleRoleAction('Close', ${roleIdNum}); return false;" style="color: #dc2626; margin-right: 8px;">Close</a>
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
  const user = getActiveUser();

  if (!user || !user.id) {
    alert('User session not found. Please log out and sign in again.');
    return;
  }

  // Confirm with user if attempting to close the ticket/role
  if (action === 'Close') {
    const formattedId = `#RL-${String(roleId).padStart(4, '0')}`;
    const confirmed = confirm(`Are you sure you want to close ticket ${formattedId}? This will archive the role.`);
    if (!confirmed) return;
  }

  try {
    const res = await fetch('/api/roles-action', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-user-id': user.id.toString()
      },
      body: JSON.stringify({ 
        action, 
        roleId, 
        userId: user.id 
      })
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