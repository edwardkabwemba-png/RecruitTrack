const sql = require('mssql');

module.exports = async function (context, req) {
  context.res = { headers: { 'Content-Type': 'application/json' } };

  try {
    const pool = await sql.connect(process.env.SqlConnectionString);

    // Read logged in user ID and search term
    const currentUserId = req.headers['x-user-id'] || req.query.userId || 1;
    const searchTerm = (req.query.search || req.query.q || '').trim();

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

    // 2. Fetch Roles (If search is present, include CLOSED roles and filter by Position or Candidate Name)
    let rolesWhereClause = "WHERE a.RecruiterUserID = @RecruiterUserID";
    if (searchTerm) {
      rolesWhereClause += " AND (p.PositionTitle LIKE @Search OR EXISTS (SELECT 1 FROM dbo.Recruits rec INNER JOIN dbo.Applications app ON rec.RecruitID = app.RecruitID WHERE app.RoleID = r.RoleID AND (rec.FirstName LIKE @Search OR rec.Surname LIKE @Search)))";
    } else {
      rolesWhereClause += " AND r.Status = 'Active'";
    }

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
      ${rolesWhereClause}
      GROUP BY r.RoleID, r.Status, p.PositionTitle, c.ClientName;
    `;

    const rolesRequest = pool.request().input('RecruiterUserID', sql.Int, currentUserId);
    if (searchTerm) {
      rolesRequest.input('Search', sql.VarChar, `%${searchTerm}%`);
    }
    const rolesRes = await rolesRequest.query(rolesQuery);

    // 3. Fetch Candidates (If search is present, include CLOSED roles and filter by Candidate Name or Position)
    let candidatesWhereClause = "WHERE a.RecruiterUserID = @RecruiterUserID";
    if (searchTerm) {
      candidatesWhereClause += " AND (r.FirstName LIKE @Search OR r.Surname LIKE @Search OR p.PositionTitle LIKE @Search)";
    } else {
      candidatesWhereClause += " AND ro.Status = 'Active'";
    }

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
      ${candidatesWhereClause}
      ORDER BY r.RecruitID DESC;
    `;

    const candidatesRequest = pool.request().input('RecruiterUserID', sql.Int, currentUserId);
    if (searchTerm) {
      candidatesRequest.input('Search', sql.VarChar, `%${searchTerm}%`);
    }
    const candidatesRes = await candidatesRequest.query(candidatesQuery);

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