const sql = require('mssql');

module.exports = async function (context, req) {
  context.res = { headers: { 'Content-Type': 'application/json' } };

  try {
    const pool = await sql.connect(process.env.SqlConnectionString);

    // Read logged in user ID from headers, query string, or default to 1
    const currentUserId = req.headers['x-user-id'] || req.query.userId || 1;

    // 1. Fetch Current User Details safely
    let currentUser = { name: "Test User", role: "Recruiter" };
    try {
      const userRes = await pool.request()
        .input('UserID', sql.Int, currentUserId)
        .query("SELECT UserID, FullName, Role FROM dbo.Users WHERE UserID = @UserID");

      if (userRes.recordset.length > 0 && userRes.recordset[0].FullName) {
        currentUser.name = userRes.recordset[0].FullName;
        currentUser.role = userRes.recordset[0].Role || "Recruiter";
      }
    } catch (uErr) {
      context.log.warn("User lookup non-fatal error:", uErr.message);
    }

    // 2. Fetch Section 1: Active/Frozen Roles filtered for the logged-in user's assigned roles
    const rolesQuery = `
      SELECT 
        r.RoleID,
        ISNULL(r.Status, 'Active') AS Status,
        p.PositionTitle,
        c.ClientName,
        COUNT(a.ApplicationID) AS TotalCandidates,
        SUM(CASE WHEN a.LifecycleStage = 'Sourced' THEN 1 ELSE 0 END) AS SourcedCount,
        SUM(CASE WHEN a.LifecycleStage = 'Screened' THEN 1 ELSE 0 END) AS ScreenedCount,
        SUM(CASE WHEN a.LifecycleStage = 'CV Prepared' THEN 1 ELSE 0 END) AS CvPreparedCount,
        SUM(CASE WHEN a.LifecycleStage = 'Interviewed' THEN 1 ELSE 0 END) AS InterviewedCount,
        SUM(CASE WHEN a.LifecycleStage = 'Offer Sent' THEN 1 ELSE 0 END) AS OfferSentCount,
        SUM(CASE WHEN a.LifecycleStage = 'Hired' THEN 1 ELSE 0 END) AS HiredCount
      FROM dbo.Roles r
      LEFT JOIN dbo.Positions p ON r.PositionID = p.PositionID
      LEFT JOIN dbo.Clients c ON r.ClientID = c.ClientID
      LEFT JOIN dbo.Applications a ON r.RoleID = a.RoleID
      WHERE Status = 'Active' AND a.RecruiterUserID = @RecruiterUserID OR a.RecruiterUserID IS NULL 
      GROUP BY r.RoleID, r.Status, p.PositionTitle, c.ClientName;
    `;
    const rolesRes = await pool.request()
      .input('RecruiterUserID', sql.Int, currentUserId)
      .query(rolesQuery);

    // 3. Fetch Section 2: Personal Candidates belonging ONLY to the logged-in user
    const candidatesQuery = `
      SELECT 
        r.RecruitID,
        r.FirstName,
        r.Surname,
        p.PositionTitle,
        c.ClientName,
        a.DateSourced,
        ISNULL(a.LifecycleStage, 'Sourced') AS Stage,
        (CASE WHEN a.DocCvStatus = 'Uploaded' THEN 1 ELSE 0 END +
         CASE WHEN a.DocIdStatus = 'Uploaded' THEN 1 ELSE 0 END +
         CASE WHEN a.DocPaySlipsStatus > 0 THEN 1 ELSE 0 END +
         CASE WHEN a.DocCertsStatus = 'Uploaded' THEN 1 ELSE 0 END +
         CASE WHEN a.DocDegreesStatus = 'Uploaded' THEN 1 ELSE 0 END) AS DocsCompleted
      FROM dbo.Recruits r
      INNER JOIN dbo.Applications a ON r.RecruitID = a.RecruitID
      LEFT JOIN dbo.Roles ro ON a.RoleID = ro.RoleID
      LEFT JOIN dbo.Positions p ON ro.PositionID = p.PositionID
      LEFT JOIN dbo.Clients c ON ro.ClientID = c.ClientID
      WHERE a.RecruiterUserID = @RecruiterUserID
      ORDER BY r.RecruitID DESC;
    `;
    const candidatesRes = await pool.request()
      .input('RecruiterUserID', sql.Int, currentUserId)
      .query(candidatesQuery);

    context.res.status = 200;
    context.res.body = JSON.stringify({
      currentUser: currentUser,
      roles: rolesRes.recordset || [],
      candidates: candidatesRes.recordset || []
    });

  } catch (error) {
    context.log.error("Dashboard API Error:", error.message);
    context.res.status = 500;
    context.res.body = JSON.stringify({ 
      message: "Database query execution error.", 
      error: error.message 
    });
  }
};