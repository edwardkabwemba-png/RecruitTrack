document.addEventListener("DOMContentLoaded", async () => {
  await fetchRecentRecruits();
  setupModalEvents();
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

      // Escape JSON payload for inline onclick handler
      const recruitDataStr = JSON.stringify(r).replace(/'/g, "&apos;").replace(/"/g, "&quot;");

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
            <button type="button" onclick="openEditRecruitModal(${recruitDataStr})" 
                    style="padding: 4px 10px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">
              Edit
            </button>
          </td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    console.error("Error loading recruits:", err);
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #ef4444; padding: 30px;">Failed to load recruits list.</td></tr>`;
  }
}

// Open modal and populate input fields
function openEditRecruitModal(r) {
  const modal = document.getElementById('editRecruitModal');
  if (!modal) return;

  document.getElementById('editRecruitId').value = r.RecruitID || r.id || '';
  document.getElementById('editApplicationId').value = r.ApplicationID || '';
  document.getElementById('editFirstName').value = r.FirstName || '';
  document.getElementById('editSurname').value = r.Surname || '';
  document.getElementById('editEmail').value = r.Email || '';
  document.getElementById('editPhone').value = r.Phone || r.PhoneNumber || '';

  // Clear previous file inputs
  ['uploadMainCv', 'uploadDocId', 'uploadPayslips', 'uploadCerts'].forEach(id => {
    const fileElem = document.getElementById(id);
    if (fileElem) fileElem.value = '';
  });

  modal.style.display = 'flex';
}

// Set up close and form submit listeners
function setupModalEvents() {
  const modal = document.getElementById('editRecruitModal');
  const closeBtn = document.getElementById('closeEditRecruitModal');
  const cancelBtn = document.getElementById('cancelEditRecruitBtn');
  const form = document.getElementById('editRecruitForm');

  if (!modal) return;

  const closeModal = () => { modal.style.display = 'none'; };

  if (closeBtn) closeBtn.onclick = closeModal;
  if (cancelBtn) cancelBtn.onclick = closeModal;

  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();

      const recruitId = document.getElementById('editRecruitId').value;
      const formData = new FormData();

      formData.append('recruitId', recruitId);
      formData.append('applicationId', document.getElementById('editApplicationId').value);
      formData.append('firstName', document.getElementById('editFirstName').value);
      formData.append('surname', document.getElementById('editSurname').value);
      formData.append('email', document.getElementById('editEmail').value);
      formData.append('phoneNumber', document.getElementById('editPhone').value);

      // Append selected document files
      const mainCv = document.getElementById('uploadMainCv')?.files[0];
      const docId = document.getElementById('uploadDocId')?.files[0];
      const payslips = document.getElementById('uploadPayslips')?.files[0];
      const certs = document.getElementById('uploadCerts')?.files[0];

      if (mainCv) formData.append('mainCv', mainCv);
      if (docId) formData.append('docId', docId);
      if (payslips) formData.append('payslips', payslips);
      if (certs) formData.append('certs', certs);

      try {
        const res = await fetch(`/api/recruits/${recruitId}`, {
          method: 'PUT',
          body: formData
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.message || 'Failed to update recruit details.');

        closeModal();
        await fetchRecentRecruits();
      } catch (err) {
        alert(err.message);
      }
    };
  }
}

// Convert numbers or string stages into uniform labels
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

// Select matching CSS badge class
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