document.addEventListener("DOMContentLoaded", async () => {
  await loadDashboardData();
  setupSearch();
});

let allCandidates = [];

async function loadDashboardData() {
  try {
    const res = await fetch('/api/dashboard');
    if (!res.ok) throw new Error('Failed to load dashboard data.');
    const data = await res.json();

    // Safe extraction of user details with fallbacks
    const userName = (data.currentUser && data.currentUser.name) ? data.currentUser.name : 'Jigyasa K.';
    const userRole = (data.currentUser && data.currentUser.role) ? data.currentUser.role : 'Recruiter';

    document.getElementById('userPill').textContent = `Signed in as: ${userName} (${userRole})`;

    // Render Sections
    renderRoles(data.roles || []);
    allCandidates = data.candidates || [];
    renderCandidates(allCandidates);

  } catch (err) {
    console.error(err);
    document.getElementById('userPill').textContent = 'Signed in as: Jigyasa K. (Recruiter)';
    document.getElementById('rolesContainer').innerHTML = `<p style="color: #ef4444;">Error loading roles.</p>`;
    document.getElementById('candidatesContainer').innerHTML = `<p style="color: #ef4444;">Error loading candidates.</p>`;
  }
}

function renderRoles(roles) {
  const container = document.getElementById('rolesContainer');
  if (roles.length === 0) {
    container.innerHTML = `<p style="color: #64748b; font-size: 0.85rem;">No active roles currently assigned to you.</p>`;
    return;
  }

  container.innerHTML = roles.map(r => {
    const total = r.TotalCandidates || 1;
    const sourcedPct = ((r.SourcedCount || 0) / total) * 100;
    const screenedPct = (((r.ScreenedCount || 0) + (r.CvPreparedCount || 0)) / total) * 100;
    const interviewPct = (((r.InterviewedCount || 0) + (r.OfferSentCount || 0)) / total) * 100;
    const hiredPct = ((r.HiredCount || 0) / total) * 100;

    return `
      <div class="role-card">
        <div class="role-header">
          <div class="role-title-group">
            <button class="toggle-btn" onclick="toggleDetails('role-desc-${r.RoleID}', this)">+</button>
            <span>${r.PositionTitle}</span>
            <span style="font-weight: normal; color: #64748b;">— Client: ${r.ClientName}</span>
            <span class="badge badge-code">#RL-0${r.RoleID}</span>
            <span class="badge ${r.Status === 'Active' ? 'badge-active' : 'badge-frozen'}">${r.Status}</span>
          </div>
          <a href="add-recruit.html?roleId=${r.RoleID}" class="btn-sm">+ Add Recruit</a>
        </div>

        <div id="role-desc-${r.RoleID}" class="role-details" style="display: none;">
          <strong>Skills required:</strong> ${r.RequiredSkills || 'N/A'} &mdash; 
          <strong>Education:</strong> ${r.Education || 'Degree Required'} &mdash; 
          <strong>Seniority:</strong> ${r.Seniority || 'Mid-Senior'}
        </div>

        <div class="progress-group">
          <div style="display: flex; justify-content: space-between;">
            <span>Role total (${r.TotalCandidates} candidates)</span>
            <span>${r.ScreenedCount || 0} Screened · ${r.InterviewedCount || 0} Interview · ${r.HiredCount || 0} Hired</span>
          </div>
          <div class="progress-bar-container">
            <div class="progress-segment bg-sourced" style="width: ${sourcedPct}%"></div>
            <div class="progress-segment bg-screened" style="width: ${screenedPct}%"></div>
            <div class="progress-segment bg-interview" style="width: ${interviewPct}%"></div>
            <div class="progress-segment bg-hired" style="width: ${hiredPct}%"></div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function toggleDetails(elemId, btn) {
  const el = document.getElementById(elemId);
  if (el.style.display === 'none') {
    el.style.display = 'block';
    btn.textContent = '–';
  } else {
    el.style.display = 'none';
    btn.textContent = '+';
  }
}

function renderCandidates(candidates) {
  const container = document.getElementById('candidatesContainer');
  if (candidates.length === 0) {
    container.innerHTML = `<p style="color: #64748b; font-size: 0.85rem;">No candidates sourced yet.</p>`;
    return;
  }

  const stagePercentages = {
    'Sourced': 14,
    'In Discussion': 28,
    'Screened': 43,
    'CV Prepared': 57,
    'Interviewed': 71,
    'Offer Sent': 85,
    'Hired': 100
  };

  container.innerHTML = candidates.map(c => {
    const pct = stagePercentages[c.Stage] || 14;
    return `
      <div class="candidate-row">
        <div class="candidate-info">
          <a href="edit-recruit.html?id=${c.RecruitID}" style="font-weight: bold; color: #1d4ed8; text-decoration: none;">
            ${c.FirstName} ${c.Surname}
          </a>
        </div>
        <div class="candidate-role">${c.PositionTitle} @ ${c.ClientName}</div>
        <div class="candidate-role">Sourced ${c.DateSourced ? new Date(c.DateSourced).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'N/A'}</div>
        <div class="candidate-stage">
          <span class="badge badge-code">${c.Stage || 'Sourced'}</span>
        </div>
        <div class="candidate-progress">
          <div class="progress-bar-container" style="flex: 1; margin: 0;">
            <div class="progress-segment ${pct === 100 ? 'bg-hired' : 'bg-screened'}" style="width: ${pct}%"></div>
          </div>
          <span style="font-size: 0.75rem; color: #64748b; width: 30px;">${pct}%</span>
        </div>
        <div class="candidate-docs">${c.DocsCompleted || 0}/5 docs</div>
      </div>
    `;
  }).join('');
}

function setupSearch() {
  document.getElementById('candidateSearch').addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const filtered = allCandidates.filter(c => 
      `${c.FirstName} ${c.Surname}`.toLowerCase().includes(query) ||
      `${c.PositionTitle} ${c.ClientName}`.toLowerCase().includes(query)
    );
    renderCandidates(filtered);
  });
}