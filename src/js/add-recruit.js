document.addEventListener('DOMContentLoaded', async () => {
  await Promise.all([
    loadRecruiters(),
    loadSources(),
    loadRoles()
  ]);
});

// 1. Fetch Recruiters from /api/users
async function loadRecruiters() {
  const select = document.getElementById('recruiterSelect') || document.querySelector('select[name="recruiter"]');
  if (!select) return;

  try {
    const res = await fetch('/api/users');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const users = await res.json();
    select.innerHTML = '<option value="">Select Recruiter...</option>';

    if (Array.isArray(users)) {
      users.forEach(u => {
        const name = u.FullName || u.fullName || u.Email || u.email;
        const id = u.UserID || u.id;
        select.appendChild(new Option(name, id));
      });
    }
  } catch (err) {
    console.error("Error loading recruiters:", err.message);
    select.innerHTML = '<option value="">Failed to load recruiters</option>';
  }
}

// 2. Fetch Sources from /api/sources
async function loadSources() {
  const select = document.getElementById('sourceSelect') || document.querySelector('select[name="source"]');
  if (!select) return;

  try {
    const res = await fetch('/api/sources');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const sources = await res.json();
    select.innerHTML = '<option value="">Select Source...</option>';

    if (Array.isArray(sources)) {
      sources.forEach(s => {
        const name = s.SourceName;
        const id = s.SourceID;
        select.appendChild(new Option(name, id));
      });
    }
  } catch (err) {
    console.error("Error loading sources:", err.message);
    select.innerHTML = '<option value="">Failed to load sources</option>';
  }
}

// 3. Fetch Roles from /api/roles
async function loadRoles() {
  const select = document.getElementById('roleSelect') || document.querySelector('select[name="role"]');
  if (!select) return;

  try {
    const res = await fetch('/api/roles');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const roles = await res.json();
    select.innerHTML = '<option value="">Select a Role...</option>';

    if (Array.isArray(roles)) {
      roles.forEach(r => {
        // Format display name as "PositionTitle @ ClientName (#RL-000X)"
        const roleLabel = `${r.PositionTitle || 'Role'} @ ${r.ClientName || 'Client'} (#RL-${String(r.RoleID).padStart(4, '0')})`;
        select.appendChild(new Option(roleLabel, r.RoleID));
      });
    }
  } catch (err) {
    console.error("Error loading roles:", err.message);
    select.innerHTML = '<option value="">Failed to load roles</option>';
  }
}