let allSkills = [];

document.addEventListener('DOMContentLoaded', () => {
  fetchSkills();

  document.getElementById('addSkillForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const skillName = document.getElementById('skillName').value.trim();
    const category = document.getElementById('skillCategory').value.trim();

    try {
      const res = await fetch('/api/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillName, category })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to save skill');

      closeSkillModal();
      document.getElementById('addSkillForm').reset();
      fetchSkills();
    } catch (err) {
      alert(err.message);
    }
  });
});

async function fetchSkills() {
  const tbody = document.getElementById('skills-table-body');
  try {
    const res = await fetch('/api/skills');
    const text = await res.text();
    allSkills = text ? JSON.parse(text) : [];

    if (!res.ok) throw new Error(allSkills.message || `Error ${res.status}`);

    renderSkillsTable(allSkills);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:red; padding:20px;">${err.message}</td></tr>`;
  }
}

function renderSkillsTable(skills) {
  const tbody = document.getElementById('skills-table-body');

  if (!Array.isArray(skills) || skills.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding: 20px;">No skills found.</td></tr>`;
    return;
  }

  tbody.innerHTML = skills.map(skill => `
    <tr>
      <td><strong>#SK-${String(skill.SkillID).padStart(4, '0')}</strong></td>
      <td>${skill.SkillName}</td>
      <td>${skill.Category || 'General'}</td>
    </tr>
  `).join('');
}

function filterSkills() {
  const query = document.getElementById('search-skill').value.toLowerCase();
  const filtered = allSkills.filter(s => 
    s.SkillName.toLowerCase().includes(query) || 
    (s.Category && s.Category.toLowerCase().includes(query))
  );
  renderSkillsTable(filtered);
}

function openSkillModal() {
  document.getElementById('skillModal').style.display = 'flex';
}

function closeSkillModal() {
  document.getElementById('skillModal').style.display = 'none';
}