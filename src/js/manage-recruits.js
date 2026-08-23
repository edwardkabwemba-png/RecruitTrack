document.addEventListener("DOMContentLoaded", async () => {
  await fetchRecentRecruits();
});

async function fetchRecentRecruits() {
  const tbody = document.getElementById('recruitsTableBody');
  if (!tbody) return;

  try {
    const response = await fetch('/api/recruits?action=recent');
    const data = await response.json();

    if (!data || data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #64748b; padding: 30px;">No recruits found. Click "+ Add Recruit" to create one.</td></tr>`;
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
          <td>${r.PositionTitle ? `${r.PositionTitle} @ ${r.ClientName}` : 'Unassigned'}</td>
          <td>${r.RecruiterName || 'Unassigned'}</td>
          <td>
            <span class="badge ${badgeClass}">${stageName}</span>
          </td>
          <td>${r.CreatedDate ? new Date(r.CreatedDate).toLocaleDateString() : 'N/A'}</td>
          <td>
            <a href="edit-recruit.html?id=${r.RecruitID}" 
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

// Convert numeric stages or stage codes into human-readable labels
function getStageLabel(stage) {
  const map = {
    1: 'Sourced',
    2: 'In Discussion',
    3: 'Screened',
    4: 'CV Prepared',
    5: 'Interviewed',
    6: 'Offer Sent',
    7: 'Hired'
  };

  return map[stage] || stage || 'In Discussion';
}

// Map lifecycle stage to matching CSS badge styles
function getStageBadgeClass(stageName) {
  switch (stageName) {
    case 'Sourced': return 'badge-sourced';
    case 'In Discussion': return 'badge-discussion';
    case 'Screened': return 'badge-screened';
    case 'CV Prepared': return 'badge-cv';
    case 'Interviewed': return 'badge-interviewed';
    case 'Offer Sent': return 'badge-offer';
    case 'Hired': return 'badge-hired';
    default: return 'badge-discussion';
  }
}