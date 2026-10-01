// API Base Endpoint
const API_URL = '/api/sources';

// Global state for filtering
let allSources = [];

// Helper: Safely retrieve logged-in User ID from storage
function getStoredUserId() {
  const storedUser = JSON.parse(localStorage.getItem("user") || sessionStorage.getItem("user") || "{}");
  return storedUser.userId || storedUser.UserID || storedUser.id || localStorage.getItem('userId') || sessionStorage.getItem('userId') || window.currentUserId || '';
}

// Load data on page ready with Route Guard
document.addEventListener('DOMContentLoaded', () => {
  // --- ROUTE GUARD: Verify user credentials before running any logic ---
  const currentUserId = getStoredUserId();
  if (!currentUserId) {
    window.location.href = "index.html";
    return;
  }

  fetchSources();
});

/**
 * Fetch and display sources on page load
 */
async function fetchSources() {
  const tbody = document.getElementById('sources-table-body');
  const activeUserId = getStoredUserId();

  try {
    const res = await fetch(API_URL, {
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

    if (!res.ok) throw new Error('Failed to fetch sources');
    
    allSources = await res.json();
    renderSourcesTable(allSources);
  } catch (err) {
    console.error('Error loading sources:', err);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: #dc2626;">Error loading sources from database.</td></tr>`;
    }
  }
}

/**
 * Render Sources inside the HTML table
 */
function renderSourcesTable(sources) {
  const tbody = document.getElementById('sources-table-body');
  if (!tbody) return;

  if (sources.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: #64748b;">No sources found.</td></tr>`;
    return;
  }

  tbody.innerHTML = sources.map(source => `
    <tr>
      <td>#${source.SourceID}</td>
      <td style="font-weight: 500; color: #1e293b;">${escapeHtml(source.SourceName)}</td>
      <td style="text-align: right;">
        <button onclick="deleteSource(${source.SourceID})" style="background: none; border: none; color: #dc2626; cursor: pointer; font-size: 0.85rem;" title="Delete Source">
          Delete
        </button>
      </td>
    </tr>
  `).join('');
}

/**
 * Modal Open / Close Controls
 */
function openSourceModal() {
  const modal = document.getElementById('sourceModal');
  const input = document.getElementById('sourceName');
  const errorMsg = document.getElementById('sourceNameError');

  if (modal) modal.style.display = 'flex';
  if (input) input.value = '';
  if (errorMsg) errorMsg.style.display = 'none';
}

function closeSourceModal() {
  const modal = document.getElementById('sourceModal');
  if (modal) modal.style.display = 'none';
}

/**
 * Save new Source with strict REQUIRED validation
 */
async function saveSource(event) {
  event.preventDefault();
  
  const activeUserId = getStoredUserId();

  if (!activeUserId) {
    alert("Session invalid or expired. Please log in again.");
    window.location.href = "index.html";
    return;
  }

  const input = document.getElementById('sourceName');
  const errorMsg = document.getElementById('sourceNameError');
  const SourceName = input ? input.value.trim() : '';

  // Required Field Validation (Cannot be empty or whitespace)
  if (!SourceName) {
    if (errorMsg) errorMsg.style.display = 'block';
    if (input) input.focus();
    return;
  }

  if (errorMsg) errorMsg.style.display = 'none';

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-user-id': activeUserId.toString()
      },
      body: JSON.stringify({ SourceName })
    });

    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem("user");
      sessionStorage.removeItem("user");
      window.location.href = "index.html";
      return;
    }

    if (response.ok) {
      closeSourceModal();
      fetchSources();
    } else {
      const err = await response.json();
      alert(err.error || 'Failed to save source.');
    }
  } catch (err) {
    console.error('Error saving source:', err);
  }
}

/**
 * Delete Source by SourceID
 */
async function deleteSource(id) {
  const activeUserId = getStoredUserId();

  if (!activeUserId) {
    alert("Session invalid or expired. Please log in again.");
    window.location.href = "index.html";
    return;
  }

  if (!confirm('Are you sure you want to delete this recruitment source?')) return;

  try {
    const res = await fetch(`${API_URL}/${id}`, { 
      method: 'DELETE',
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

    if (res.ok) {
      fetchSources();
    } else {
      alert('Failed to delete source.');
    }
  } catch (err) {
    console.error('Error deleting source:', err);
  }
}

/**
 * Live search/filter function for the filter-bar
 */
function filterSources() {
  const query = document.getElementById('search-source').value.toLowerCase().trim();
  const filtered = allSources.filter(src => 
    src.SourceName.toLowerCase().includes(query) || 
    String(src.SourceID).includes(query)
  );
  renderSourcesTable(filtered);
}

/**
 * Helper utility to prevent XSS vulnerability
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Bind functions to window so inline event handlers (`onclick`, `onsubmit`) can access them
window.openSourceModal = openSourceModal;
window.closeSourceModal = closeSourceModal;
window.saveSource = saveSource;
window.deleteSource = deleteSource;
window.filterSources = filterSources;