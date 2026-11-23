const sql = require('mssql');

module.exports = async function (context, req) {
  context.res = { headers: { 'Content-Type': 'application/json' } };

  try {
    const body = req.body || {};
    const action = body.action;
    const roleId = body.roleId;
    
    // Read userId from body or header
    const userId = body.userId || req.headers['x-user-id'] || req.query.userId;

    if (!action || !roleId) {
      context.res.status = 400;
      context.res.body = JSON.stringify({ message: "Missing required parameters (action and roleId)." });
      return;
    }

    const connectionString = process.env.SqlConnectionString || process.env.DATABASE_URL;
    const pool = await sql.connect(connectionString);

    // ==========================================
    // 1. UPDATE STATUS ACTIONS (Freeze, Unfreeze, Close)
    // ==========================================
    if (['Freeze', 'Unfreeze', 'Close'].includes(action)) {
      let newStatus = 'Active';
      if (action === 'Freeze') newStatus = 'Frozen';
      if (action === 'Close') newStatus = 'Closed';

      await pool.request()
        .input('RoleID', sql.Int, roleId)
        .input('Status', sql.VarChar(20), newStatus)
        .query('UPDATE dbo.Roles SET Status = @Status WHERE RoleID = @RoleID');

      context.res.status = 200;
      context.res.body = JSON.stringify({ success: true, message: `Role status updated to ${newStatus}` });
      return;
    }

    // ==========================================
    // 2. JOIN AS CO-RECRUITER ACTION
    // ==========================================
    if (action === 'Join') {
      if (!userId) {
        context.res.status = 400;
        context.res.body = JSON.stringify({ message: "User ID is required to join as a co-recruiter." });
        return;
      }

      // Check current role status and recruiter assignment count
      const checkRole = await pool.request()
        .input('RoleID', sql.Int, roleId)
        .query(`
          SELECT 
            r.Status,
            (SELECT COUNT(*) FROM dbo.RoleRecruiters WHERE RoleID = @RoleID) AS TotalCount,
            (SELECT COUNT(*) FROM dbo.RoleRecruiters WHERE RoleID = @RoleID AND UserID = @UserID) AS IsAlreadyAssigned
          FROM dbo.Roles r
          WHERE r.RoleID = @RoleID
        `, { UserID: userId });

      if (!checkRole.recordset.length) {
        context.res.status = 404;
        context.res.body = JSON.stringify({ message: "Role not found." });
        return;
      }

      const { Status, TotalCount, IsAlreadyAssigned } = checkRole.recordset[0];

      if (Status === 'Closed') {
        context.res.status = 400;
        context.res.body = JSON.stringify({ message: "Cannot join a closed role." });
        return;
      }

      if (IsAlreadyAssigned > 0) {
        context.res.status = 200;
        context.res.body = JSON.stringify({ success: true, message: "You are already assigned to this role." });
        return;
      }

      if (TotalCount >= 2) {
        context.res.status = 400;
        context.res.body = JSON.stringify({ message: "Cannot join. Maximum of 2 recruiters already assigned to this role." });
        return;
      }

      // Insert new recruiter assignment safely
      await pool.request()
        .input('RoleID', sql.Int, roleId)
        .input('UserID', sql.Int, userId)
        .query(`
          IF NOT EXISTS (SELECT 1 FROM dbo.RoleRecruiters WHERE RoleID = @RoleID AND UserID = @UserID)
          BEGIN
            INSERT INTO dbo.RoleRecruiters (RoleID, UserID) VALUES (@RoleID, @UserID);
          END
        `);

      context.res.status = 200;
      context.res.body = JSON.stringify({ success: true, message: "Successfully joined as co-recruiter." });
      return;
    }

    context.res.status = 400;
    context.res.body = JSON.stringify({ message: "Invalid action type." });

  } catch (error) {
    context.log.error("Action error in /api/roles-action:", error);
    context.res.status = 500;
    context.res.body = JSON.stringify({ message: "Server error handling action", error: error.message });
  }
};