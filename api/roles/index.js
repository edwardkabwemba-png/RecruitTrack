const sql = require('mssql');

module.exports = async function (context, req) {
  // Always enforce JSON content type
  context.res = { headers: { 'Content-Type': 'application/json' } };

  try {
    const pool = await sql.connect(process.env.SqlConnectionString);
    
    // Note: Ensure STRING_AGG is executed cleanly
    const result = await pool.request().query(`
      SELECT 
        r.RoleID,
        p.PositionTitle,
        c.ClientName,
        r.Status,
        ISNULL(STRING_AGG(u.AvatarInitials, ','), '') AS RecruiterInitials,
        ISNULL(STRING_AGG(CAST(u.UserID AS VARCHAR), ','), '') AS RecruiterIDs
      FROM dbo.Roles r
      LEFT JOIN dbo.Positions p ON r.PositionID = p.PositionID
      LEFT JOIN dbo.Clients c ON r.ClientID = c.ClientID
      LEFT JOIN dbo.RoleRecruiters rr ON r.RoleID = rr.RoleID
      LEFT JOIN dbo.Users u ON rr.UserID = u.UserID
      GROUP BY r.RoleID, p.PositionTitle, c.ClientName, r.Status
      ORDER BY r.RoleID DESC
    `);

    context.res.status = 200;
    context.res.body = JSON.stringify(result.recordset || []);

  } catch (error) {
    context.log.error("Roles fetch error:", error);
    context.res.status = 500;
    context.res.body = JSON.stringify({ 
      message: "Backend call failure", 
      error: error.message 
    });
  }
};