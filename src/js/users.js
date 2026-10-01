// Helper: Safely retrieve logged-in User ID from storage
function getStoredUserId() {
  const storedUser = JSON.parse(localStorage.getItem("user") || sessionStorage.getItem("user") || "{}");
  return storedUser.userId || storedUser.UserID || storedUser.id || localStorage.getItem('userId') || sessionStorage.getItem('userId') || window.currentUserId || '';
}

document.addEventListener('DOMContentLoaded', () => {
  // --- ROUTE GUARD: Verify user credentials before running any logic ---
  const currentUserId = getStoredUserId();
  if (!currentUserId) {
    window.location.href = "index.html";
    return;
  }

  fetchUsers();

  document.getElementById('addUserForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const activeUserId = getStoredUserId();
    if (!activeUserId) {
      alert("Session invalid or expired. Please log in again.");
      window.location.href = "index.html";
      return;
    }

    const fullName = document.getElementById('fullName').value.trim();
    const email = document.getElementById('email').value.trim();
    const role = document.getElementById('userRole').value;
    const password = document.getElementById('password').value; // Read password input

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': activeUserId.toString()
        },
        body: JSON.stringify({ fullName, email, role, password }) // Send password in payload
      });

      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem("user");
        sessionStorage.removeItem("user");
        window.location.href = "index.html";
        return;
      }

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
  const activeUserId = getStoredUserId();

  try {
    const res = await fetch('/api/users', {
      headers: { 
        'x-user-id': activeUserId.toString() 
      }
    });

    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem("user");
      sessionStorage.removeItem("user");
      window.location.href = "index.html";
      return;
    }

    const text = await res.text();
    const users = text ? JSON.parse(text) : [];

    if (!res.ok) throw new Error(users.message || `Error ${res.status}`);

    if (!Array.isArray(users) || users.length === 0) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 20px;">No users found.</td></tr>`;
      return;
    }

    if (tbody) {
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
    }

  } catch (err) {
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:red; padding:20px;">${err.message}</td></tr>`;
    }
  }
}

function openUserModal() {
  const modal = document.getElementById('userModal');
  if (modal) modal.style.display = 'flex';
}

function closeUserModal() {
  const modal = document.getElementById('userModal');
  if (modal) modal.style.display = 'none';
}

// Bind modal control functions globally for inline HTML click events
window.openUserModal = openUserModal;
window.closeUserModal = closeUserModal;