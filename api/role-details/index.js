const sql = require('mssql');

module.exports = async function (context, req) {
  context.res = { headers: { 'Content-Type': 'application/json' } };
  
  const roleId = parseInt(context.bindingData.id || req.query.id, 10);

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
    // 1. Fetch Role Metadata
    const roleResult = await pool.request()
      .input('RoleID', sql.Int, roleId)
      .query(`
        SELECT 
          ro.RoleID, 
          ro.SeniorityLevel, 
          ro.MinYearsExperience, 
          ro.MinEducation,
          ro.WorkModel, 
          ro.RateBudgetMin, 
          ro.RateBudgetMax, 
          ro.Status,
          p.PositionTitle, 
          c.ClientName
        FROM dbo.Roles ro
        LEFT JOIN dbo.Positions p ON ro.PositionID = p.PositionID
        LEFT JOIN dbo.Clients c ON ro.ClientID = c.ClientID
        WHERE ro.RoleID = @RoleID
      `);

    if (roleResult.recordset.length === 0) {
      context.res.status = 404;
      context.res.body = JSON.stringify({ message: "Role not found." });
      return;
    }

    const roleData = roleResult.recordset[0];

    // 2. Fetch Recruiters Assigned to this Role
    let recruiters = [];
    try {
      const recruitersResult = await pool.request()
        .input('RoleID', sql.Int, roleId)
        .query(`
          SELECT DISTINCT u.UserID, u.FullName, u.AvatarInitials
          FROM dbo.Applications a
          JOIN dbo.Users u ON a.RecruiterUserID = u.UserID
          WHERE a.RoleID = @RoleID
        `);
      recruiters = recruitersResult.recordset;
    } catch (recErr) {
      context.log.warn("Could not fetch recruiters:", recErr.message);
    }

    // 3. Fetch Candidates on this Role
    let candidates = [];
    try {
      const candidatesResult = await pool.request()
        .input('RoleID', sql.Int, roleId)
        .query(`
          SELECT 
            r.RecruitID,
            CONCAT(r.FirstName, ' ', r.Surname) AS CandidateName,
            u.AvatarInitials AS RecruiterInitials,
            ISNULL(a.LifecycleStage, 'Sourced') AS Stage,
            a.IsFailed,
            CASE 
              WHEN a.IsFailed = 1 THEN 0
              WHEN a.LifecycleStage = 'Sourced' THEN 14
              WHEN a.LifecycleStage = 'In Discussion' THEN 28
              WHEN a.LifecycleStage = 'Screened' THEN 43
              WHEN a.LifecycleStage = 'CV Prepared' THEN 57
              WHEN a.LifecycleStage = 'Interviewed' THEN 71
              WHEN a.LifecycleStage = 'Offer Sent' THEN 85
              WHEN a.LifecycleStage = 'Hired' THEN 100
              ELSE 14
            END AS ProgressPercentage,
            (
              (CASE WHEN r.DocumentUrl IS NOT NULL AND r.DocumentUrl <> '' THEN 1 ELSE 0 END) +
              (CASE WHEN a.DocCvStatus = 'Uploaded' THEN 1 ELSE 0 END) +
              (CASE WHEN a.DocIdStatus = 'Uploaded' THEN 1 ELSE 0 END) +
              (CASE WHEN a.DocPaySlipsStatus > 0 THEN 1 ELSE 0 END) +
              (CASE WHEN a.DocCertsStatus = 'Uploaded' THEN 1 ELSE 0 END) +
              (CASE WHEN a.DocDegreesStatus = 'Uploaded' THEN 1 ELSE 0 END)
            ) AS UploadedDocCount
          FROM dbo.Applications a
          JOIN dbo.Recruits r ON a.RecruitID = r.RecruitID
          LEFT JOIN dbo.Users u ON a.RecruiterUserID = u.UserID
          WHERE a.RoleID = @RoleID
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