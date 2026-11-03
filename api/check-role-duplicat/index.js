let currentDuplicateRoleId = null;
let ignoreDuplicateWarning = false;

document.addEventListener("DOMContentLoaded", () => {
  const positionSelect = document.getElementById("positionSelect") || document.getElementById("positionIdInput");
  const clientSelect = document.getElementById("clientSelect") || document.getElementById("clientIdInput");

  positionSelect?.addEventListener("change", checkDuplicateRole);
  clientSelect?.addEventListener("change", checkDuplicateRole);
});

async function checkDuplicateRole() {
  if (ignoreDuplicateWarning) return;

  const positionSelect = document.getElementById("positionSelect") || document.getElementById("positionIdInput");
  const clientSelect = document.getElementById("clientSelect") || document.getElementById("clientIdInput");

  const positionId = positionSelect ? positionSelect.value : "";
  const clientId = clientSelect ? clientSelect.value : "";

  // Only check when both Position and Client are selected
  if (!positionId || !clientId) {
    dismissDuplicateBanner();
    return;
  }

  try {
    const activeUserId = getStoredUserId();
    const res = await fetch(`/api/check-role-duplicate?positionId=${positionId}&clientId=${clientId}`, {
      headers: { "x-user-id": activeUserId.toString() }
    });

    if (!res.ok) return;
    const data = await res.json();

    if (data.exists && data.duplicateRole) {
      const dup = data.duplicateRole;
      currentDuplicateRoleId = dup.roleId;

      // Update amber banner details dynamically
      document.getElementById("dupTitle").textContent = `${dup.positionTitle} @ ${dup.clientName}, #RL-0${dup.roleId}`;
      document.getElementById("dupCreator").textContent = dup.creatorName;
      document.getElementById("dupDate").textContent = dup.createdDate;

      // "View Role" button handler
      document.getElementById("btnViewRole").onclick = () => {
        window.open(`role-details.html?id=${dup.roleId}`, '_blank');
      };

      // Reuse your existing handleRoleAction function!
      document.getElementById("btnJoinRole").onclick = async () => {
        await handleRoleAction('Join', dup.roleId);
        window.location.href = "roles.html"; // Redirect to roles table after joining
      };

      // Show amber banner
      const banner = document.getElementById("duplicateBanner");
      if (banner) banner.style.display = "flex";
    } else {
      dismissDuplicateBanner();
    }
  } catch (err) {
    console.error("Error checking duplicate role:", err);
  }
}

function dismissDuplicateBanner() {
  ignoreDuplicateWarning = true;
  const banner = document.getElementById("duplicateBanner");
  if (banner) banner.style.display = "none";
}