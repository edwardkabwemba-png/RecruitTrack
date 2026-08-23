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

  // --- 1. HANDLE UPDATE (PUT) ---
  if (req.method.toUpperCase() === 'PUT') {
    const body = req.body || {};
    
    try {
      const updateResult = await pool.request()
        .input('RoleID', sql.Int, roleId)
        .input('SeniorityLevel', sql.NVarChar(100), body.seniorityLevel || null)
        .input('MinYearsExperience', sql.Int, body.minYearsExperience !== undefined ? body.minYearsExperience : null)
        .input('MinEducation', sql.NVarChar(200), body.minEducation || null)
        .input('WorkModel', sql.NVarChar(100), body.workModel || null)
        .input('RateBudgetMin', sql.Decimal(18, 2), body.rateBudgetMin ? parseFloat(body.rateBudgetMin) : null)
        .input('RateBudgetMax', sql.Decimal(18, 2), body.rateBudgetMax ? parseFloat(body.rateBudgetMax) : null)
        .query(`
          UPDATE dbo.Roles
          SET 
            SeniorityLevel = ISNULL(@SeniorityLevel, SeniorityLevel),
            MinYearsExperience = ISNULL(@MinYearsExperience, MinYearsExperience),
            MinEducation = ISNULL(@MinEducation, MinEducation),
            WorkModel = ISNULL(@WorkModel, WorkModel),
            RateBudgetMin = ISNULL(@RateBudgetMin, RateBudgetMin),
            RateBudgetMax = ISNULL(@RateBudgetMax, RateBudgetMax)
          WHERE RoleID = @RoleID;
        `);

      if (updateResult.rowsAffected[0] === 0) {
        context.res.status = 404;
        context.res.body = JSON.stringify({ message: "Role record not found to update." });
        return;
      }

      context.res.status = 200;
      context.res.body = JSON.stringify({ message: "Role updated successfully." });
      return;
    } catch (updateErr) {
      context.log.error("Error updating role:", updateErr);
      context.res.status = 500;
      context.res.body = JSON.stringify({ message: "Database update failed", error: updateErr.message });
      return;
    }
  }

  // --- 2. HANDLE FETCH (GET) ---
  try {
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

    // Fetch Recruiters
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

    // Fetch Candidates
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