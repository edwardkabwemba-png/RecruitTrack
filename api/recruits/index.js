const sql = require('mssql');

module.exports = async function (context, req) {
  context.res = { headers: { 'Content-Type': 'application/json' } };

  try {
    const pool = await sql.connect(process.env.SqlConnectionString);

    if (req.method === 'GET') {
      const { action, id } = req.query;

      // 1. Fetch Top 10 Recruits for Management Page
      if (action === 'recent') {
        const query = `
          SELECT TOP 10 
            r.RecruitID,
            r.FirstName,
            r.Surname,
            r.Email,
            r.Phone,
            r.CreatedDate,
            p.PositionTitle,
            c.ClientName,
            u.FullName AS RecruiterName,
            s.SourceName,
            a.LifecycleStage,
            a.DateSourced
          FROM dbo.Recruits r
          LEFT JOIN dbo.Applications a ON r.RecruitID = a.RecruitID
          LEFT JOIN dbo.Roles ro ON a.RoleID = ro.RoleID
          LEFT JOIN dbo.Positions p ON ro.PositionID = p.PositionID
          LEFT JOIN dbo.Clients c ON ro.ClientID = c.ClientID
          LEFT JOIN dbo.Users u ON a.RecruiterUserID = u.UserID
          LEFT JOIN dbo.Sources s ON a.SourceID = s.SourceID
          ORDER BY r.RecruitID DESC;
        `;

        const result = await pool.request().query(query);
        context.res.status = 200;
        context.res.body = JSON.stringify(result.recordset || []);
        return;
      }

      // 2. Fetch Form Dropdowns
      if (action === 'dropdowns') {
        const recruiters = await pool.request().query("SELECT UserID, FullName FROM dbo.Users WHERE IsActive = 1");
        const sources = await pool.request().query("SELECT SourceID, SourceName FROM dbo.Sources WHERE IsActive = 1");
        const roles = await pool.request().query("SELECT r.RoleID, p.PositionTitle + ' @ ' + c.ClientName AS RoleTitle FROM dbo.Roles r JOIN dbo.Positions p ON r.PositionID = p.PositionID JOIN dbo.Clients c ON r.ClientID = c.ClientID WHERE r.Status = 'Active'");
        const skills = await pool.request().query("SELECT SkillID, SkillName FROM dbo.SkillLibrary ORDER BY SkillName");
        const certs = await pool.request().query("SELECT CertID, CertName FROM dbo.CertificationLibrary ORDER BY CertName");

        context.res.status = 200;
        context.res.body = JSON.stringify({
          recruiters: recruiters.recordset,
          sources: sources.recordset,
          roles: roles.recordset,
          skills: skills.recordset,
          certifications: certs.recordset
        });
        return;
      }
    }

  } catch (error) {
    context.log.error("Recruits API Error:", error);
    context.res.status = 500;
    context.res.body = JSON.stringify({ message: "Server error", error: error.message });
  }
};