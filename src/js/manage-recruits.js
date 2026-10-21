let searchDebounceTimer = null;

// Helper: Safely retrieve logged-in User ID from storage
function getStoredUserId() {
  const storedUser = JSON.parse(localStorage.getItem("user") || sessionStorage.getItem("user") || "{}");
  return storedUser.userId || storedUser.UserID || storedUser.id || localStorage.getItem('userId') || sessionStorage.getItem('userId') || window.currentUserId || '';
}

document.addEventListener("DOMContentLoaded", async () => {
  // --- ROUTE GUARD: Verify user credentials before running any logic ---
  const currentUserId = getStoredUserId();
  if (!currentUserId) {
    window.location.href = "index.html";
    return;
  }

  setupFilterListeners();
  await fetchRecentRecruits();
});

function setupFilterListeners() {
  const searchInput = document.getElementById('searchInput');
  const stageFilter = document.getElementById('stageFilter');

  // Debounced live database query on typing
  searchInput?.addEventListener('input', () => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      fetchRecentRecruits();
    }, 300);
  });

  // Query database immediately on dropdown change
  stageFilter?.addEventListener('change', () => {
    fetchRecentRecruits();
  });
}

async function fetchRecentRecruits() {
  const tbody = document.getElementById('recruitsTableBody');
  if (!tbody) return;

  const searchValue = document.getElementById('searchInput')?.value.trim() || '';
  const stageValue = document.getElementById('stageFilter')?.value || '';

  try {
    const queryParams = new URLSearchParams({ action: 'recent' });
    if (searchValue) queryParams.append('search', searchValue);
    if (stageValue && stageValue !== 'All') queryParams.append('stage', stageValue);

    const response = await fetch(`/api/recruits?${queryParams.toString()}`, {
      headers: {
        'x-user-id': getStoredUserId()
      }
    });

    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem("user");
      sessionStorage.removeItem("user");
      window.location.href = "index.html";
      return;
    }

    const data = await response.json();

    if (!data || data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #64748b; padding: 30px;">No recruits found matching your search criteria.</td></tr>`;
      return;
    }

    tbody.innerHTML = data.map(r => {
      const rawStage = r.Stage || r.LifecycleStage;
      const stageName = getStageLabel(rawStage);
      const badgeClass = getStageBadgeClass(stageName);

      return `
        <tr>
          <td><strong>${r.FirstName || ''} ${r.Surname || ''}</strong></td>
          <td>
            ${r.Email || 'N/A'}<br>
            <small style="color: #64748b;">${r.Phone || r.PhoneNumber || ''}</small>
          </td>
          <td>${r.PositionTitle ? `${r.PositionTitle} @${r.ClientName || ''}` : 'Unassigned'}</td>
          <td>${r.RecruiterName || 'Unassigned'}</td>
          <td>
            <span class="badge ${badgeClass}">${stageName}</span>
          </td>
          <td>${r.CreatedDate ? new Date(r.CreatedDate).toLocaleDateString() : 'N/A'}</td>
          <td>
            <a href="add-recruit.html?id=${r.RecruitID}" 
               style="padding: 5px 12px; background: #2b6cb0; color: #fff; text-decoration: none; border-radius: 4px; font-size: 0.8rem; font-weight: 600; display: inline-block;">
              Edit
            </a>
          </td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    console.error("Error loading recruits:", err);
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #ef4444; padding: 30px;">Failed to load recruits list.</td></tr>`;
  }
}

// Convert numeric stages, string stages, or fallback to 'Sourced'
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

// Map lifecycle stage to matching CSS badge styles
function getStageBadgeHtml(stage, isFailed) {
  const stageStr = String(stage || 'Sourced').trim();
  
  if (isFailed || stageStr.includes('Not Successful') || stageStr.includes('Failed')) {
    return `<span class="stage-badge badge-failed">${stageStr}</span>`;
  }
  
  return `<span class="stage-badge badge-active">${stageStr}</span>`;
}
