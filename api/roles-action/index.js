const sql = require('mssql');

module.exports = async function (context, req) {
  context.res = { headers: { 'Content-Type': 'application/json' } };

  try {
    const { action, roleId, userId } = req.body || {};

    if (!action || !roleId) {
      context.res.status = 400;
      context.res.body = JSON.stringify({ message: "Missing required parameters." });
      return;
    }

    const pool = await sql.connect(process.env.SqlConnectionString);

    // 1. UPDATE STATUS ACTIONS (Freeze, Unfreeze, Close)
    if (['Freeze', 'Unfreeze', 'Close'].includes(action)) {
      let newStatus = 'Active';
      if (action === 'Freeze') newStatus = 'Frozen';
      if (action === 'Close') newStatus = 'Closed';

      await pool.request()
        .input('RoleID', sql.Int, roleId)
        .input('Status', sql.VarChar, newStatus)
        .query('UPDATE dbo.Roles SET Status = @Status WHERE RoleID = @RoleID');

      context.res.status = 200;
      context.res.body = JSON.stringify({ message: `Role status updated to ${newStatus}` });
      return;
    }

    // 2. JOIN AS CO-RECRUITER ACTION
    if (action === 'Join') {
      if (!userId) {
        context.res.status = 400;
        context.res.body = JSON.stringify({ message: "User ID is required to join." });
        return;
      }

      // Check current recruiter count
      const checkCount = await pool.request()
        .input('RoleID', sql.Int, roleId)
        .query('SELECT COUNT(*) AS TotalCount FROM dbo.RoleRecruiters WHERE RoleID = @RoleID');

      const count = checkCount.recordset[0].TotalCount;

      if (count >= 2) {
        context.res.status = 400;
        context.res.body = JSON.stringify({ message: "Cannot join. Maximum of 2 recruiters already assigned." });
        return;
      }

      // Insert new recruiter link
      await pool.request()
        .input('RoleID', sql.Int, roleId)
        .input('UserID', sql.Int, userId)
        .query('INSERT INTO dbo.RoleRecruiters (RoleID, UserID) VALUES (@RoleID, @UserID)');

      context.res.status = 200;
      context.res.body = JSON.stringify({ message: "Successfully joined as co-recruiter" });
      return;
    }

    context.res.status = 400;
    context.res.body = JSON.stringify({ message: "Invalid action." });

  } catch (error) {
    context.log.error("Action error:", error);
    context.res.status = 500;
    context.res.body = JSON.stringify({ message: "Server error handling action", error: error.message });
  }
};