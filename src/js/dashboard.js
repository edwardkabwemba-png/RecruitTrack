document.addEventListener("DOMContentLoaded", async () => {
  await loadDashboardData();
  setupSearch();
});

let allCandidates = [];
let searchDebounceTimeout = null;

async function loadDashboardData(searchTerm = '') {
  try {
    // Read user details stored during login
    const storedUser = JSON.parse(localStorage.getItem("user") || sessionStorage.getItem("user") || "{}");
    const currentUserId = storedUser.userId || storedUser.UserID || storedUser.id || '';

    // Build URL with optional search parameter
    let url = `/api/dashboard?userId=${currentUserId}`;
    if (searchTerm.trim()) {
      url += `&search=${encodeURIComponent(searchTerm.trim())}`;
    }

    // Pass the userId in both query param and headers
    const res = await fetch(url, {
      headers: {
        "x-user-id": currentUserId
      }
    });

    if (!res.ok) throw new Error('Failed to load dashboard data.');
    const data = await res.json();

    // Update user display pill
    if (data.currentUser && data.currentUser.name) {
      document.getElementById('userPill').textContent = `Signed in as: ${data.currentUser.name} (${data.currentUser.role || 'Recruiter'})`;
    }

    renderRoles(data.roles || []);
    allCandidates = data.candidates || [];
    renderCandidates(allCandidates);

  } catch (err) {
    console.error(err);
    document.getElementById('rolesContainer').innerHTML = `<p style="color: #ef4444;">Error loading roles.</p>`;
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
    // Extract and normalize stage values
    const rawStage = c.Stage || c.LifecycleStage;
    const stageName = getStageLabel(rawStage);
    const badgeClass = getStageBadgeClass(stageName);
    const bgClass = getStageBgClass(stageName);

    const pct = stagePercentages[stageName] || 14;

    return `
      <div class="candidate-row">
        <div class="candidate-info">
          <a href="edit-recruit.html?id=${c.RecruitID}" style="font-weight: bold; color: #1d4ed8; text-decoration: none;">
            ${c.FirstName || ''} ${c.Surname || ''}
          </a>
        </div>
        <div class="candidate-role">${c.PositionTitle ? `${c.PositionTitle} @${c.ClientName || ''}` : 'Unassigned'}</div>
        <div class="candidate-role">Sourced ${c.DateSourced ? new Date(c.DateSourced).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'N/A'}</div>
        <div class="candidate-stage">
          <span class="badge ${badgeClass}">${stageName}</span>
        </div>
        <div class="candidate-progress">
          <div class="progress-bar-container" style="flex: 1; margin: 0;">
            <div class="progress-segment ${bgClass}" style="width: ${pct}%"></div>
          </div>
          <span style="font-size: 0.75rem; color: #64748b; width: 30px;">${pct}%</span>
        </div>
        <div class="candidate-docs">${c.DocsCompleted || 0}/5 docs</div>
      </div>
    `;
  }).join('');
}

function setupSearch() {
  const searchInput = document.getElementById('candidateSearch') || document.getElementById('searchInput');
  if (!searchInput) return;

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value;

    // Debounce database query by 300ms so database isn't hit on every single keypress
    clearTimeout(searchDebounceTimeout);
    searchDebounceTimeout = setTimeout(() => {
      loadDashboardData(query);
    }, 300);
  });
}

// Helper: Convert numeric stage IDs or strings to normalized label
function getStageLabel(stage) {
  if (!stage) return 'Sourced';

  const map = {
    1: 'Sourced',
    2: 'In Discussion',
    3: 'Screened',
    4: 'CV Prepared',
    5: 'Interviewed',
    6: 'Offer Sent',
    7: 'Hired'
  };

  return map[stage] || stage;
}

// Helper: Map lifecycle stage label to CSS badge class
function getStageBadgeClass(stageName) {
  switch (stageName) {
    case 'Sourced': return 'badge-sourced';
    case 'In Discussion': return 'badge-discussion';
    case 'Screened': return 'badge-screened';
    case 'CV Prepared': return 'badge-cv';
    case 'Interviewed': return 'badge-interviewed';
    case 'Offer Sent': return 'badge-offer';
    case 'Hired': return 'badge-hired';
    default: return 'badge-sourced';
  }
}

// Helper: Map lifecycle stage label to progress bar background class
function getStageBgClass(stageName) {
  switch (stageName) {
    case 'Sourced': return 'bg-sourced';
    case 'In Discussion': return 'bg-discussion';
    case 'Screened': return 'bg-screened';
    case 'CV Prepared': return 'bg-cv';
    case 'Interviewed': return 'bg-interview';
    case 'Offer Sent': return 'bg-offer';
    case 'Hired': return 'bg-hired';
    default: return 'bg-sourced';
  }
}