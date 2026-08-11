document.addEventListener('DOMContentLoaded', () => {
  fetchUsers();

  document.getElementById('addUserForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fullName = document.getElementById('fullName').value.trim();
    const email = document.getElementById('email').value.trim();
    const role = document.getElementById('userRole').value;

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, role })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create user');

      closeUserModal();
      document.getElementById('addUserForm').reset();
      fetchUsers();
    } catch (err) {
      alert(err.message);
    }
  });
});

async function fetchUsers() {
  const tbody = document.getElementById('users-table-body');
  try {
    const res = await fetch('/api/users');
    const text = await res.text();
    const users = text ? JSON.parse(text) : [];

    if (!res.ok) throw new Error(users.message || `Error ${res.status}`);

    if (!Array.isArray(users) || users.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 20px;">No users found.</td></tr>`;
      return;
    }

    tbody.innerHTML = users.map(user => {
      const roleBadgeClass = user.Role === 'Admin' ? 'badge-admin' : 'badge-recruiter';
      return `
        <tr>
          <td>
            <span class="avatar">${user.AvatarInitials || 'U'}</span>
            <strong>${user.FullName}</strong>
          </td>
          <td>${user.Email}</td>
          <td><span class="badge ${roleBadgeClass}">${user.Role || 'Recruiter'}</span></td>
          <td><span style="color: ${user.IsActive ? '#16a34a' : '#dc2626'}; font-weight: 600;">${user.IsActive ? 'Active' : 'Inactive'}</span></td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:red; padding:20px;">${err.message}</td></tr>`;
  }
}

function openUserModal() {
  document.getElementById('userModal').style.display = 'flex';
}

function closeUserModal() {
  document.getElementById('userModal').style.display = 'none';
}