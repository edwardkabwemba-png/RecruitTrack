const sql = require('mssql');

module.exports = async function (context, req) {
  context.res = { headers: { 'Content-Type': 'application/json' } };
  
  const roleId = parseInt(context.bindingData.id, 10);

  if (isNaN(roleId)) {
    context.res.status = 400;
    context.res.body = JSON.stringify({ message: "Invalid Role ID." });
    return;
  }

  let pool;
  try {
    pool = await sql.connect(process.env.SqlConnectionString);
  } catch (connErr) {
    context.log.error("Database connection failed:", connErr);
    context.res.status = 500;
    context.res.body = JSON.stringify({ message: "Database connection failed", error: connErr.message });
    return;
  }

  try {
    // 1. Fetch Role using actual schema column names
    const roleResult = await pool.request()
      .input('RoleID', sql.Int, roleId)
      .query(`
        SELECT 
          r.RoleID,
          r.Status,
          r.SeniorityLevel,
          r.MinEducation,
          r.FieldOfStudy,
          r.MinYearsExperience,
          r.Location,
          r.WorkModel,
          r.RateBudgetMin,
          r.RateBudgetMax,
          p.PositionTitle,
          c.ClientName
        FROM dbo.Roles r
        LEFT JOIN dbo.Positions p ON r.PositionID = p.PositionID
        LEFT JOIN dbo.Clients c ON r.ClientID = c.ClientID
        WHERE r.RoleID = @RoleID
      `);

    if (roleResult.recordset.length === 0) {
      context.res.status = 404;
      context.res.body = JSON.stringify({ message: "Role not found." });
      return;
    }

    const roleData = roleResult.recordset[0];

    // 2. Fetch Recruiters safely
    let recruiters = [];
    try {
      const recruitersResult = await pool.request()
        .input('RoleID', sql.Int, roleId)
        .query(`
          SELECT u.UserID, u.FirstName, u.LastName
          FROM dbo.RoleRecruiters rr
          JOIN dbo.Users u ON rr.UserID = u.UserID
          WHERE rr.RoleID = @RoleID
        `);
      recruiters = recruitersResult.recordset;
    } catch (recErr) {
      context.log.warn("Could not fetch recruiters:", recErr.message);
    }

    // 3. Fetch Candidates safely
    let candidates = [];
    try {
      const candidatesResult = await pool.request()
        .input('RoleID', sql.Int, roleId)
        .query(`
          SELECT 
            rc.RecruitID,
            rc.CandidateName,
            rc.RecruiterInitials,
            rc.Stage,
            rc.ProgressPercentage,
            rc.DocumentsCount,
            rc.TotalDocumentsRequired
          FROM dbo.RoleCandidates rc
          WHERE rc.RoleID = @RoleID
        `);
      candidates = candidatesResult.recordset;
    } catch (candErr) {
      context.log.warn("Could not fetch candidates:", candErr.message);
    }

    context.res.status = 200;
    context.res.body = JSON.stringify({
      role: roleData,
      recruiters: recruiters || [],
      candidates: candidates || []
    });

  } catch (error) {
    context.log.error("Role Details API Error:", error);
    context.res.status = 500;
    context.res.body = JSON.stringify({ 
      message: "Server error querying role details", 
      error: error.message 
    });
  }
};