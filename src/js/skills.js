// State
let allSkills = [];

// DOM Elements
const skillModal = document.getElementById('skillModal');
const addSkillForm = document.getElementById('addSkillForm');
const skillNameInput = document.getElementById('skillName');
const skillCategoryInput = document.getElementById('skillCategory');
const skillsTableBody = document.getElementById('skills-table-body');

// Helper: Safely retrieve logged-in User ID from storage
function getStoredUserId() {
  const storedUser = JSON.parse(localStorage.getItem("user") || sessionStorage.getItem("user") || "{}");
  return storedUser.userId || storedUser.UserID || storedUser.id || localStorage.getItem('userId') || sessionStorage.getItem('userId') || window.currentUserId || '';
}

// Load skills on page ready with Route Guard
document.addEventListener('DOMContentLoaded', () => {
  // --- ROUTE GUARD: Verify user credentials before running any logic ---
  const currentUserId = getStoredUserId();
  if (!currentUserId) {
    window.location.href = "index.html";
    return;
  }

  fetchSkills();
});

// Modal Controls
function openSkillModal() {
  if (skillModal) {
    skillModal.style.display = 'flex';
    if (addSkillForm) addSkillForm.reset();
  }
}

function closeSkillModal() {
  if (skillModal) {
    skillModal.style.display = 'none';
  }
}

// Fetch skills from API
async function fetchSkills() {
  const activeUserId = getStoredUserId();

  try {
    const res = await fetch('/api/skills', {
      headers: { 
        'x-user-id': activeUserId.toString() 
      }
    });

    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem("user");
      sessionStorage.removeItem("user");
      window.location.href = "index.html";
      return;
    }

    if (!res.ok) throw new Error('Failed to load skills');
    allSkills = await res.json();
    renderSkillsTable(allSkills);
  } catch (err) {
    console.error('Error fetching skills:', err);
    if (skillsTableBody) {
      skillsTableBody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: #dc2626;">Failed to load skills.</td></tr>`;
    }
  }
}

// Render Skills to Table
function renderSkillsTable(skills) {
  if (!skillsTableBody) return;

  if (skills.length === 0) {
    skillsTableBody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: #64748b;">No skills found.</td></tr>`;
    return;
  }

  skillsTableBody.innerHTML = skills.map(s => `
    <tr>
      <td style="font-weight: 600; color: #64748b;">#SK-${String(s.SkillID || s.id).padStart(4, '0')}</td>
      <td style="font-weight: 500;">${escapeHtml(s.SkillName || s.name)}</td>
      <td>${escapeHtml(s.Category || s.category)}</td>
    </tr>
  `).join('');
}

// Form Submission Event Listener
if (addSkillForm) {
  addSkillForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const activeUserId = getStoredUserId();

    if (!activeUserId) {
      alert("Session invalid or expired. Please log in again.");
      window.location.href = "index.html";
      return;
    }

    const SkillName = skillNameInput.value.trim();
    const Category = skillCategoryInput.value.trim();

    if (!SkillName || !Category) {
      alert('Skill Name and Category are required.');
      return;
    }

    try {
      const res = await fetch('/api/skills', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': activeUserId.toString()
        },
        body: JSON.stringify({ SkillName, Category })
      });

      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem("user");
        sessionStorage.removeItem("user");
        window.location.href = "index.html";
        return;
      }

      if (res.ok) {
        closeSkillModal();
        fetchSkills();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to save skill.');
      }
    } catch (err) {
      console.error('Error saving skill:', err);
      alert('An error occurred while saving.');
    }
  });
}

// Live Search Filter
function filterSkills() {
  const query = document.getElementById('search-skill').value.toLowerCase().trim();
  const filtered = allSkills.filter(s => {
    const name = (s.SkillName || s.name || '').toLowerCase();
    const category = (s.Category || s.category || '').toLowerCase();
    return name.includes(query) || category.includes(query);
  });
  renderSkillsTable(filtered);
}

// Utility to escape HTML
function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Bind modal control functions globally for inline HTML click events
window.openSkillModal = openSkillModal;
window.closeSkillModal = closeSkillModal;
window.filterSkills = filterSkills;