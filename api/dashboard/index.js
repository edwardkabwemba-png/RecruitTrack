const sql = require('mssql');

module.exports = async function (context, req) {
  context.res = { headers: { 'Content-Type': 'application/json' } };

  try {
    const pool = await sql.connect(process.env.SqlConnectionString);

    // Default to UserID 1 or from header
    const currentUserId = req.headers['x-user-id'] || 1;

    // Fetch Current User Details with SQL null checks
    const userRes = await pool.request()
      .input('UserID', sql.Int, currentUserId)
      .query("SELECT UserID, ISNULL(FullName, 'Jigyasa K.') AS FullName, ISNULL(Role, 'Recruiter') AS Role FROM dbo.Users WHERE UserID = @UserID");

    const userRecord = userRes.recordset[0];
    const currentUser = {
      name: userRecord ? userRecord.FullName : "Jigyasa K.",
      role: userRecord ? userRecord.Role : "Recruiter"
    };

    // 1. Fetch Section 1 Roles
    const rolesQuery = `
      SELECT 
        r.RoleID,
        r.Status,
        p.PositionTitle,
        c.ClientName,
        r.RequiredSkills,
        COUNT(a.ApplicationID) AS TotalCandidates,
        SUM(CASE WHEN a.LifecycleStage = 'Sourced' THEN 1 ELSE 0 END) AS SourcedCount,
        SUM(CASE WHEN a.LifecycleStage = 'Screened' THEN 1 ELSE 0 END) AS ScreenedCount,
        SUM(CASE WHEN a.LifecycleStage = 'CV Prepared' THEN 1 ELSE 0 END) AS CvPreparedCount,
        SUM(CASE WHEN a.LifecycleStage = 'Interviewed' THEN 1 ELSE 0 END) AS InterviewedCount,
        SUM(CASE WHEN a.LifecycleStage = 'Offer Sent' THEN 1 ELSE 0 END) AS OfferSentCount,
        SUM(CASE WHEN a.LifecycleStage = 'Hired' THEN 1 ELSE 0 END) AS HiredCount
      FROM dbo.Roles r
      JOIN dbo.Positions p ON r.PositionID = p.PositionID
      JOIN dbo.Clients c ON r.ClientID = c.ClientID
      LEFT JOIN dbo.Applications a ON r.RoleID = a.RoleID
      WHERE r.Status IN ('Active', 'Frozen')
      GROUP BY r.RoleID, r.Status, p.PositionTitle, c.ClientName, r.RequiredSkills;
    `;
    const rolesRes = await pool.request().query(rolesQuery);

    // 2. Fetch Section 2 Recruiter's Own Candidates
    const candidatesQuery = `
      SELECT 
        r.RecruitID,
        r.FirstName,
        r.Surname,
        p.PositionTitle,
        c.ClientName,
        a.DateSourced,
        ISNULL(a.LifecycleStage, 'Sourced') AS Stage,
        (CASE WHEN a.DocCvStatus = 'Received' THEN 1 ELSE 0 END +
         CASE WHEN a.DocIdStatus = 'Received' THEN 1 ELSE 0 END +
         CASE WHEN a.DocPaySlipsStatus = 'Received' THEN 1 ELSE 0 END +
         CASE WHEN a.DocCertsStatus = 'Received' THEN 1 ELSE 0 END +
         CASE WHEN a.DocDegreesStatus = 'Received' THEN 1 ELSE 0 END) AS DocsCompleted
      FROM dbo.Recruits r
      JOIN dbo.Applications a ON r.RecruitID = a.RecruitID
      LEFT JOIN dbo.Roles ro ON a.RoleID = ro.RoleID
      LEFT JOIN dbo.Positions p ON ro.PositionID = p.PositionID
      LEFT JOIN dbo.Clients c ON ro.ClientID = c.ClientID
      WHERE a.RecruiterUserID = @RecruiterUserID
      ORDER BY a.DateSourced DESC;
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
    context.log.error("Dashboard API Error:", error);
    context.res.status = 500;
    context.res.body = JSON.stringify({ message: "Server error", error: error.message });
  }
};