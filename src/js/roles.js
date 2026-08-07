document.addEventListener('DOMContentLoaded', async () => {
  const tbody = document.getElementById('roles-table-body');

  try {
    const res = await fetch('/api/roles');
    const roles = await res.json();

    if (!res.ok) throw new Error(roles.message || 'Failed to fetch');

    if (roles.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No roles found.</td></tr>`;
      return;
    }

    tbody.innerHTML = roles.map(role => {
      const formattedId = `#RL-${String(role.RoleID).padStart(4, '0')}`;
      const statusClass = `badge-${role.Status.toLowerCase()}`;
      
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
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">${err.message}</td></tr>`;
  }
});