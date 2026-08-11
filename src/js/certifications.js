let allCertifications = [];

document.addEventListener('DOMContentLoaded', () => {
  fetchCertifications();

  document.getElementById('addCertForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const certName = document.getElementById('certName').value.trim();
    const issuer = document.getElementById('certIssuer').value.trim();
    const category = document.getElementById('certCategory').value.trim();

    try {
      const res = await fetch('/api/certifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ certName, issuer, category })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to save certification');

      closeCertModal();
      document.getElementById('addCertForm').reset();
      fetchCertifications();
    } catch (err) {
      alert(err.message);
    }
  });
});

async function fetchCertifications() {
  const tbody = document.getElementById('cert-table-body');
  try {
    const res = await fetch('/api/certifications');
    const text = await res.text();
    allCertifications = text ? JSON.parse(text) : [];

    if (!res.ok) throw new Error(allCertifications.message || `Error ${res.status}`);

    renderCertTable(allCertifications);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:red; padding:20px;">${err.message}</td></tr>`;
  }
}

function renderCertTable(certs) {
  const tbody = document.getElementById('cert-table-body');

  if (!Array.isArray(certs) || certs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 20px;">No certifications found.</td></tr>`;
    return;
  }

  tbody.innerHTML = certs.map(cert => {
    const formattedId = cert.CertID ? `#CT-${String(cert.CertID).padStart(4, '0')}` : '-';
    return `
      <tr>
        <td><strong>${formattedId}</strong></td>
        <td>${cert.CertName}</td>
        <td>${cert.Issuer || 'N/A'}</td>
        <td>${cert.Category || 'General'}</td>
      </tr>
    `;
  }).join('');
}

function filterCertifications() {
  const query = document.getElementById('search-cert').value.toLowerCase();
  const filtered = allCertifications.filter(c => 
    c.CertName.toLowerCase().includes(query) || 
    (c.Issuer && c.Issuer.toLowerCase().includes(query)) ||
    (c.Category && c.Category.toLowerCase().includes(query))
  );
  renderCertTable(filtered);
}

function openCertModal() {
  document.getElementById('certModal').style.display = 'flex';
}

function closeCertModal() {
  document.getElementById('certModal').style.display = 'none';
}