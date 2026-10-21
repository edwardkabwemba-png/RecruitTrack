document.addEventListener("DOMContentLoaded", async () => {
  // --- ROUTE GUARD: Check for logged-in user credentials ---
  const storedUser = JSON.parse(localStorage.getItem("user") || sessionStorage.getItem("user") || "{}");
  const currentUserId = storedUser.userId || storedUser.UserID || storedUser.id || '';

  if (!currentUserId) {
    window.location.href = "index.html";
    return;
  }

  await loadDashboardData(currentUserId);
  setupSearch();
});

let allCandidates = [];
let searchDebounceTimeout = null;

function getStoredUserId() {
  const storedUser = JSON.parse(localStorage.getItem("user") || sessionStorage.getItem("user") || "{}");
  return storedUser.userId || storedUser.UserID || storedUser.id || '';
}

async function loadDashboardData(userId, searchTerm = '') {
  try {
    const currentUserId = userId || getStoredUserId();

    if (!currentUserId) {
      window.location.href = "index.html";
      return;
    }

    let url = `/api/dashboard?userId=${currentUserId}`;
    if (searchTerm.trim()) {
      url += `&search=${encodeURIComponent(searchTerm.trim())}`;
    }

    const res = await fetch(url, {
      headers: { "x-user-id": currentUserId }
    });

    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem("user");
      sessionStorage.removeItem("user");
      window.location.href = "index.html";
      return;
    }

    if (!res.ok) throw new Error('Failed to load dashboard data.');
    const data = await res.json();

    if (data.currentUser && data.currentUser.name) {
      const userPill = document.getElementById('userPill');
      if (userPill) {
        userPill.textContent = `Signed in as: ${data.currentUser.name} (${data.currentUser.role || 'Recruiter'})`;
      }
    }

    renderRoles(data.roles || []);
    allCandidates = data.candidates || [];
    renderCandidates(allCandidates);

  } catch (err) {
    console.error(err);
    const container = document.getElementById('rolesContainer');
    if (container) {
      container.innerHTML = `<p style="color: #ef4444; padding: 20px;">Error loading roles data.</p>`;
    }
  }
}

// =========================================================================
// SECTION 1 — Roles We're Currently Sourcing For (Always includes Unsuccessful)
// =========================================================================
function renderRoles(roles) {
  const container = document.getElementById('rolesContainer');
  if (!container) return;

  if (roles.length === 0) {
    container.innerHTML = `<p style="color: #64748b; font-size: 0.85rem; padding: 15px;">No active roles currently assigned to you.</p>`;
    return;
  }

  container.innerHTML = roles.map(r => {
    const sourced = r.SourcedCount || 0;
    const discussion = r.InDiscussionCount || r.DiscussionCount || 0;
    const screened = r.ScreenedCount || 0;
    const cv = r.CvPreparedCount || 0;
    const interviewed = r.InterviewedCount || r.InterviewCount || 0;
    const offer = r.OfferSentCount || r.OfferCount || 0;
    const hired = r.HiredCount || 0;
    
    // Read unsuccessful count from any possible API field name
    const unsuccessful = r.UnsuccessfulCount || r.NotSuccessfulCount || r.FailedCount || 0;

    const total = r.TotalCandidates || (sourced + discussion + screened + cv + interviewed + offer + hired + unsuccessful) || 1;

    const sourcedPct = (sourced / total) * 100;
    const discussionPct = (discussion / total) * 100;
    const screenedPct = (screened / total) * 100;
    const cvPct = (cv / total) * 100;
    const interviewPct = (interviewed / total) * 100;
    const offerPct = (offer / total) * 100;
    const hiredPct = (hired / total) * 100;
    const unsuccessfulPct = (unsuccessful / total) * 100;

    return `
      <div class="role-card" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
        <div class="role-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
          <div class="role-title-group" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <button class="toggle-btn" onclick="toggleDetails('role-desc-${r.RoleID}', this)" style="padding: 2px 8px; cursor: pointer; border: 1px solid #cbd5e1; border-radius: 4px; background: #f8fafc; font-weight: bold;">+</button>
            <span style="font-weight: 700; font-size: 1.05rem; color: #0f172a;">${r.PositionTitle || 'Untitled Position'}</span>
            <span style="font-weight: normal; color: #64748b;">— Client: ${r.ClientName || 'N/A'}</span>
            <span class="badge badge-code" style="background: #f1f5f9; color: #475569; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">#RL-0${r.RoleID}</span>
            <span class="badge ${r.Status === 'Active' ? 'badge-active' : 'badge-frozen'}">${r.Status || 'ACTIVE'}</span>
          </div>
          <a href="add-recruit.html?roleId=${r.RoleID}" class="btn-sm" style="padding: 6px 12px; background: #1d4ed8; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 0.8rem; font-weight: 600;">+ Add Recruit</a>
        </div>

        <div id="role-desc-${r.RoleID}" class="role-details" style="display: none; margin-top: 12px; padding: 10px; background: #f8fafc; border-radius: 6px; font-size: 0.85rem; color: #334155;">
          <strong>Skills required:</strong> ${r.RequiredSkills || 'N/A'} &mdash; 
          <strong>Education:</strong> ${r.Education || 'Degree Required'} &mdash; 
          <strong>Seniority:</strong> ${r.Seniority || 'Mid-Senior'}
        </div>

        <div class="progress-group" style="margin-top: 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; font-size: 0.8rem; color: #475569; margin-bottom: 6px;">
            <span><strong>Role total:</strong> ${r.TotalCandidates || (total === 1 && (sourced + discussion + screened + cv + interviewed + offer + hired + unsuccessful) === 0 ? 0 : total)} candidate(s)</span>
            
            <!-- All Stage Counts ALWAYS including Unsuccessful -->
            <div class="role-stage-counts" style="display: flex; gap: 6px; flex-wrap: wrap; font-size: 0.8rem; font-weight: 600;">
              <span style="color: #0369a1;">${sourced} Sourced</span> •
              <span style="color: #1d4ed8;">${discussion} Discussion</span> •
              <span style="color: #92400e;">${screened} Screened</span> •
              <span style="color: #6b21a8;">${cv} CV Prepared</span> •
              <span style="color: #3730a3;">${interviewed} Interview</span> •
              <span style="color: #9a3412;">${offer} Offer</span> •
              <span style="color: #166534;">${hired} Hired</span> •
              <span style="color: #dc2626; font-weight: 700;">${unsuccessful} Unsuccessful</span>
            </div>
          </div>

          <!-- Multi-Segmented Progress Bar -->
          <div class="progress-bar-container" style="display: flex; width: 100%; height: 8px; background-color: #e2e8f0; border-radius: 4px; overflow: hidden;">
            <div class="progress-segment bg-sourced" style="width: ${sourcedPct}%; height: 100%;"></div>
            <div class="progress-segment bg-discussion" style="width: ${discussionPct}%; height: 100%;"></div>
            <div class="progress-segment bg-screened" style="width: ${screenedPct}%; height: 100%;"></div>
            <div class="progress-segment bg-cv" style="width: ${cvPct}%; height: 100%;"></div>
            <div class="progress-segment bg-interview" style="width: ${interviewPct}%; height: 100%;"></div>
            <div class="progress-segment bg-offer" style="width: ${offerPct}%; height: 100%;"></div>
            <div class="progress-segment bg-hired" style="width: ${hiredPct}%; height: 100%;"></div>
            <div class="progress-segment bg-failed" style="width: ${unsuccessfulPct}%; height: 100%; background-color: #ef4444;"></div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function toggleDetails(elemId, btn) {
  const el = document.getElementById(elemId);
  if (!el) return;
  if (el.style.display === 'none') {
    el.style.display = 'block';
    btn.textContent = '–';
  } else {
    el.style.display = 'none';
    btn.textContent = '+';
  }
}

// =========================================================================
// SECTION 2 — My Candidates: Pending & In Progress (Guaranteed Red Badge & Bar)
// =========================================================================
function renderCandidates(candidates) {
  const container = document.getElementById('candidatesContainer');
  if (!container) return;

  if (candidates.length === 0) {
    container.innerHTML = `<p style="color: #64748b; font-size: 0.85rem; padding: 15px;">No candidates sourced yet.</p>`;
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
    const rawStageStr = String(c.Stage || c.LifecycleStage || 'Sourced').trim();

    // Direct check for failed / not successful status
    const isFailed = !!(
      c.IsFailed || 
      c.isFailed || 
      rawStageStr.toUpperCase().includes('NOT SUCCESSFUL') || 
      rawStageStr.toUpperCase().includes('FAILED') ||
      rawStageStr.toUpperCase().includes('UNSUCCESSFUL')
    );

    const normalizedStageLabel = getStageLabel(rawStageStr);

    const badgeClass = isFailed ? 'badge-failed' : getStageBadgeClass(normalizedStageLabel);
    const bgClass = isFailed ? 'bg-failed' : getStageBgClass(normalizedStageLabel);

    const pct = stagePercentages[normalizedStageLabel] || 14;

    const displayBadgeText = isFailed 
      ? (rawStageStr.toUpperCase().includes('NOT SUCCESSFUL') ? rawStageStr.toUpperCase() : `NOT SUCCESSFUL — ${normalizedStageLabel.toUpperCase()}`)
      : normalizedStageLabel.toUpperCase();

    // Explicit red styling applied directly to element to ensure override
    const redBadgeInlineStyle = isFailed 
      ? 'background-color: #fee2e2 !important; color: #991b1b !important; border: 1px solid #fca5a5 !important; font-weight: 700 !important; padding: 4px 10px; border-radius: 12px; display: inline-block; font-size: 0.75rem;'
      : 'padding: 4px 10px; border-radius: 12px; display: inline-block; font-size: 0.75rem;';

    const redBarInlineStyle = isFailed 
      ? 'width: ' + pct + '%; height: 100%; background-color: #ef4444 !important;' 
      : 'width: ' + pct + '%; height: 100%;';

    return `
      <div class="candidate-row" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid #f1f5f9; gap: 12px; flex-wrap: wrap;">
        <div class="candidate-info" style="min-width: 140px; flex: 1;">
          <a href="add-recruit.html?id=${c.RecruitID}" style="font-weight: 700; color: #1d4ed8; text-decoration: none;">
            ${c.FirstName || ''} ${c.Surname || ''}
          </a>
        </div>
        <div class="candidate-role" style="min-width: 180px; flex: 1.5; color: #334155; font-size: 0.85rem;">
          ${c.PositionTitle ? `${c.PositionTitle} @${c.ClientName || ''}` : 'Unassigned'}
        </div>
        <div class="candidate-role" style="min-width: 120px; color: #64748b; font-size: 0.8rem;">
          Sourced ${c.DateSourced ? new Date(c.DateSourced).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'N/A'}
        </div>
        <div class="candidate-stage" style="min-width: 180px;">
          <span class="badge ${badgeClass}" style="${redBadgeInlineStyle}">${displayBadgeText}</span>
        </div>
        <div class="candidate-progress" style="display: flex; align-items: center; gap: 8px; min-width: 140px; flex: 1;">
          <div class="progress-bar-container" style="flex: 1; margin: 0; background-color: #e2e8f0; height: 8px; border-radius: 4px; overflow: hidden;">
            <div class="progress-segment ${bgClass}" style="${redBarInlineStyle}"></div>
          </div>
          <span style="font-size: 0.75rem; color: #64748b; width: 35px; text-align: right;">${pct}%</span>
        </div>
        <div class="candidate-docs" style="min-width: 60px; font-size: 0.8rem; color: #64748b; text-align: right;">
          ${c.DocsCompleted !== undefined ? c.DocsCompleted : (c.DocsReceivedCount || 0)}/5 docs
        </div>
      </div>
    `;
  }).join('');
}

function setupSearch() {
  const searchInput = document.getElementById('candidateSearch') || document.getElementById('searchInput');
  if (!searchInput) return;

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value;

    clearTimeout(searchDebounceTimeout);
    searchDebounceTimeout = setTimeout(() => {
      loadDashboardData(getStoredUserId(), query);
    }, 300);
  });
}

function getStageLabel(stage) {
  if (!stage) return 'Sourced';

  let stageStr = String(stage).trim();
  if (stageStr.toUpperCase().includes('NOT SUCCESSFUL') || stageStr.toUpperCase().includes('UNSUCCESSFUL')) {
    stageStr = stageStr.split('—').pop().split('-').pop().trim();
  }

  const map = {
    1: 'Sourced',
    2: 'In Discussion',
    3: 'Screened',
    4: 'CV Prepared',
    5: 'Interviewed',
    6: 'Offer Sent',
    7: 'Hired'
  };

  return map[stageStr] || stageStr;
}

function getStageBadgeClass(stageName) {
  switch (stageName) {
    case 'Sourced':       return 'badge-sourced';
    case 'In Discussion': return 'badge-discussion';
    case 'Screened':      return 'badge-screened';
    case 'CV Prepared':   return 'badge-cv';
    case 'Interviewed':   return 'badge-interviewed';
    case 'Offer Sent':    return 'badge-offer';
    case 'Hired':         return 'badge-hired';
    default:              return 'badge-sourced';
  }
}

function getStageBgClass(stageName) {
  switch (stageName) {
    case 'Sourced':       return 'bg-sourced';
    case 'In Discussion': return 'bg-discussion';
    case 'Screened':      return 'bg-screened';
    case 'CV Prepared':   return 'bg-cv';
    case 'Interviewed':   return 'bg-interview';
    case 'Offer Sent':    return 'bg-offer';
    case 'Hired':         return 'bg-hired';
    default:              return 'bg-sourced';
  }
}