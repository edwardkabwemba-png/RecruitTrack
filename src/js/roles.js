document.addEventListener('DOMContentLoaded', async () => {
  const tbody = document.getElementById('roles-table-body');

  try {
    const res = await fetch('/api/roles');
    
    // Read text first to safely check for empty responses
    const text = await res.text();
    const roles = text ? JSON.parse(text) : [];

    if (!res.ok) {
      throw new Error(roles.message || `Server returned status ${res.status}`);
    }

    if (!Array.isArray(roles) || roles.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px; color: #64748b;">No roles found in database. Click "+ New Role" to create one.</td></tr>`;
      return;
    }

    tbody.innerHTML = roles.map(role => {
      const formattedId = `#RL-${String(role.RoleID).padStart(4, '0')}`;
      const statusClass = `badge-${(role.Status || 'active').toLowerCase()}`;
      
      const recruitersHtml = role.RecruiterInitials 
        ? role.RecruiterInitials.split(',').map(i => `<span class="avatar">${i}</span>`).join('') 
        : '-';

      return `
        <tr>
          <td><strong>${formattedId}</strong></td>
          <td>${role.PositionName || 'N/A'}</td>
          <td>${role.ClientName || 'N/A'}</td>
          <td><span class="badge ${statusClass}">${role.Status}</span></td>
          <td>${recruitersHtml}</td>
          <td>
            <a href="#" style="color: #2563eb; margin-right: 8px;">View</a>
            <a href="#" style="color: #64748b;">Freeze</a>
          </td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    console.error("Roles fetch error:", err);
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red; padding:20px;">${err.message}</td></tr>`;
  }
});