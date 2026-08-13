const sql = require('mssql');

module.exports = async function (context, req) {
  context.res = { headers: { 'Content-Type': 'application/json' } };
  const roleId = context.bindingData.id;

  if (!roleId) {
    context.res.status = 400;
    context.res.body = JSON.stringify({ message: "Role ID is required." });
    return;
  }

  try {
    const pool = await sql.connect(process.env.SqlConnectionString);

    // 1. Fetch main Role Details along with Client, Position, Skills, and Certifications
    const roleResult = await pool.request()
      .input('RoleID', sql.Int, roleId)
      .query(`
        SELECT 
          r.RoleID,
          r.Status,
          r.Seniority,
          r.MinEducation,
          r.MinExperienceYears,
          r.WorkModel,
          r.MinSalary,
          r.MaxSalary,
          r.RequiredSkills,
          r.NiceToHaveSkills,
          r.RequiredCertifications,
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

    // 2. Fetch Assigned Recruiters for this Role
    const recruitersResult = await pool.request()
      .input('RoleID', sql.Int, roleId)
      .query(`
        SELECT u.UserID, u.FirstName, u.LastName
        FROM dbo.RoleRecruiters rr
        JOIN dbo.Users u ON rr.UserID = u.UserID
        WHERE rr.RoleID = @RoleID
      `);

    // 3. Fetch Candidates submitted or associated with this Role
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

    context.res.status = 200;
    context.res.body = JSON.stringify({
      role: roleData,
      recruiters: recruitersResult.recordset || [],
      candidates: candidatesResult.recordset || []
    });

  } catch (error) {
    context.log.error("Role Details API Error:", error);
    context.res.status = 500;
    context.res.body = JSON.stringify({ message: "Server error fetching role details", error: error.message });
  }
};