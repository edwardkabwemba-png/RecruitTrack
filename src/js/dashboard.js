let globalCandidates = [];

// Fetch data from Azure Function API on load
async function loadDashboard() {
  const rolesContainer = document.getElementById('rolesContainer');
  const candidateRows = document.getElementById('candidateRows');

  try {
    // Updated route to match api/dashboard folder
    const response = await fetch('/api/dashboard');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Failed to fetch dashboard data`);
    }

    const data = await response.json();
    
    renderRoles(data.roles || []);
    globalCandidates = data.candidates || [];
    renderCandidates(globalCandidates);
  } catch (err) {
    if (rolesContainer) {
      rolesContainer.innerHTML = `<p style="font-size: 0.85rem; color: #ef4444;">Error loading roles: ${err.message}</p>`;
    }
    if (candidateRows) {
      candidateRows.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #ef4444;">Error loading candidates.</td></tr>`;
    }
  }
}

// Render Section 1: Active Roles
function renderRoles(roles) {
  const container = document.getElementById('rolesContainer');
  if (!container) return;

  if (!roles.length) {
    container.innerHTML = '<p style="font-size: 0.85rem; color: #64748b;">No active sourcing roles assigned.</p>';
    return;
  }

  container.innerHTML = roles.map(role => `
    <div class="role-card">
      <div class="role-card-header">
        <div class="role-card-title">
          ${role.PositionName} — <span style="color: #64748b; font-weight: 400;">${role.ClientName || 'Internal'}</span>
          <span class="badge ${role.IsActive ? 'badge-active' : 'badge-frozen'}">
            ${role.IsActive ? 'Active' : 'Frozen'}
          </span>
        </div>
        <button onclick="window.location.href='add-recruit.html?jobId=${role.PositionID}'" class="btn-primary" style="padding: 4px 10px; font-size: 0.75rem;">+ Add Recruit</button>
      </div>
      <div style="font-size: 0.8rem; color: #475569; margin-top: 6px;">
        <strong>Required Skills:</strong> ${role.RequiredSkills || 'N/A'}
      </div>
      <div style="font-size: 0.75rem; color: #64748b; margin-top: 6px;">
        Total Candidates Sourced: <strong>${role.TotalCandidates || 0}</strong>
      </div>
    </div>
  `).join('');
}

// Render Section 2: Candidate Table Rows
function renderCandidates(candidates) {
  const tbody = document.getElementById('candidateRows');
  if (!tbody) return;

  if (!candidates.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #64748b;">No candidates found.</td></tr>';
    return;
  }

  tbody.innerHTML = candidates.map(c => {
    // Process comma-separated document URLs
    const urls = c.cvUrl ? c.cvUrl.split(',').map(u => u.trim()).filter(Boolean) : [];
    
    const docLinks = urls.map((url, idx) => 
      `<a href="${url}" target="_blank" class="doc-link">Doc ${idx + 1}</a>`
    ).join('') || '<span style="color: #94a3b8;">No documents</span>';

    return `
      <tr>
        <td><strong>${c.FirstName} ${c.Surname}</strong></td>
        <td>${c.PositionName || 'Unassigned'}</td>
        <td>${c.DateSourced || 'N/A'}</td>
        <td><span class="badge badge-active">${c.OutcomeName || 'In Progress'}</span></td>
        <td>${docLinks} <span style="font-size: 0.75rem; color: #64748b;">(${urls.length})</span></td>
      </tr>
    `;
  }).join('');
}

// Search Filter Listener
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      const filtered = globalCandidates.filter(c => 
        `${c.FirstName} ${c.Surname}`.toLowerCase().includes(query) ||
        (c.PositionName && c.PositionName.toLowerCase().includes(query))
      );
      renderCandidates(filtered);
    });
  }

  loadDashboard();
});