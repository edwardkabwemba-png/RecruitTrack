const sql = require('mssql');

module.exports = async function (context, req) {
  context.res = { headers: { 'Content-Type': 'application/json' } };

  try {
    const pool = await sql.connect(process.env.SqlConnectionString);

    // ==========================================
    // GET ROLES
    // ==========================================
    if (req.method === 'GET') {
      const { positionId, clientId, id } = req.query;

      let query = 
        'SELECT ' +
        '  r.RoleID, ' +
        '  r.PositionID, ' +
        '  r.ClientID, ' +
        '  r.SeniorityLevel, ' +
        '  r.MinEducation, ' +
        '  r.FieldOfStudy, ' +
        '  r.MinYearsExperience, ' +
        '  r.Location, ' +
        '  r.WorkModel, ' +
        '  r.RateBudgetMin, ' +
        '  r.RateBudgetMax, ' +
        '  r.Status, ' +
        '  r.CreatedByUserID, ' +
        '  r.CreatedDate, ' +
        '  p.PositionTitle, ' +
        '  c.ClientName, ' +
        '  rec.RecruiterInitials, ' +
        '  rec.RecruiterIDs, ' +
        '  skReq.RequiredSkills, ' +
        '  skNice.NiceToHaveSkills, ' +
        '  cert.RequiredCertifications ' +
        'FROM dbo.Roles r ' +
        'LEFT JOIN dbo.Positions p ON r.PositionID = p.PositionID ' +
        'LEFT JOIN dbo.Clients c ON r.ClientID = c.ClientID ' +
        
        // Recruiters Aggregation
        'OUTER APPLY ( ' +
        '  SELECT ' +
        '    STRING_AGG(CAST(ISNULL(u.AvatarInitials, \'\') AS NVARCHAR(10)), \',\') AS RecruiterInitials, ' +
        '    STRING_AGG(CAST(u.UserID AS VARCHAR(10)), \',\') AS RecruiterIDs ' +
        '  FROM dbo.RoleRecruiters rr ' +
        '  JOIN dbo.Users u ON rr.UserID = u.UserID ' +
        '  WHERE rr.RoleID = r.RoleID ' +
        ') rec ' +

        // Required Skills Aggregation (JOINs RoleSkills -> SkillLibrary)
        'OUTER APPLY ( ' +
        '  SELECT STRING_AGG(sl.SkillName, \', \') AS RequiredSkills ' +
        '  FROM dbo.RoleSkills rs ' +
        '  JOIN dbo.SkillLibrary sl ON rs.SkillID = sl.SkillID ' +
        '  WHERE rs.RoleID = r.RoleID AND rs.IsRequired = 1 ' +
        ') skReq ' +

        // Nice-To-Have Skills Aggregation (JOINs RoleSkills -> SkillLibrary)
        'OUTER APPLY ( ' +
        '  SELECT STRING_AGG(sl.SkillName, \', \') AS NiceToHaveSkills ' +
        '  FROM dbo.RoleSkills rs ' +
        '  JOIN dbo.SkillLibrary sl ON rs.SkillID = sl.SkillID ' +
        '  WHERE rs.RoleID = r.RoleID AND (rs.IsRequired = 0 OR rs.IsRequired IS NULL) ' +
        ') skNice ' +

        // Certifications Aggregation (From RoleCertifications)
        'OUTER APPLY ( ' +
        '  SELECT STRING_AGG(rc.CertificationName, \', \') AS RequiredCertifications ' +
        '  FROM dbo.RoleCertifications rc ' +
        '  WHERE rc.RoleID = r.RoleID ' +
        ') cert ';

      let whereConditions = [];

      if (id) {
        whereConditions.push('r.RoleID = @RoleID');
      } else {
        if (positionId) whereConditions.push('r.PositionID = @PositionID');
        if (clientId) whereConditions.push('r.ClientID = @ClientID');
      }

      if (whereConditions.length > 0) {
        query += 'WHERE ' + whereConditions.join(' AND ') + ' ';
      }

      query += 'ORDER BY r.RoleID DESC';

      const request = pool.request();
      if (id) {
        request.input('RoleID', sql.Int, parseInt(id, 10));
      } else {
        if (positionId) request.input('PositionID', sql.Int, parseInt(positionId, 10));
        if (clientId) request.input('ClientID', sql.Int, parseInt(clientId, 10));
      }

      const result = await request.query(query);
      context.res.status = 200;
      context.res.body = JSON.stringify(result.recordset || []);
      return;
    }

    // ==========================================
    // POST NEW ROLE
    // ==========================================
    if (req.method === 'POST') {
      const {
        positionId, clientId, seniority, education, fieldOfStudy,
        minExperience, location, workModel, rateMin, rateMax,
        createdByUserId
      } = req.body || {};

      if (!positionId || !clientId) {
        context.res.status = 400;
        context.res.body = JSON.stringify({ message: "Position and Client are required." });
        return;
      }

      const insertQuery = 
        'INSERT INTO dbo.Roles ' +
        '  (PositionID, ClientID, SeniorityLevel, MinEducation, FieldOfStudy, MinYearsExperience, Location, WorkModel, RateBudgetMin, RateBudgetMax, Status, CreatedByUserID, CreatedDate) ' +
        'OUTPUT INSERTED.RoleID ' +
        'VALUES ' +
        '  (@PositionID, @ClientID, @SeniorityLevel, @MinEducation, @FieldOfStudy, @MinYearsExperience, @Location, @WorkModel, @RateBudgetMin, @RateBudgetMax, @Status, @CreatedByUserID, @CreatedDate)';

      const result = await pool.request()
        .input('PositionID', sql.Int, parseInt(positionId, 10))
        .input('ClientID', sql.Int, parseInt(clientId, 10))
        .input('SeniorityLevel', sql.NVarChar(100), seniority || 'Mid')
        .input('MinEducation', sql.NVarChar(200), education || 'None')
        .input('FieldOfStudy', sql.NVarChar(300), fieldOfStudy || null)
        .input('MinYearsExperience', sql.Int, minExperience ? parseInt(minExperience, 10) : 0)
        .input('Location', sql.NVarChar(300), location || null)
        .input('WorkModel', sql.NVarChar(100), workModel || 'Hybrid')
        .input('RateBudgetMin', sql.Decimal(9, 2), rateMin ? parseFloat(rateMin) : null)
        .input('RateBudgetMax', sql.Decimal(9, 2), rateMax ? parseFloat(rateMax) : null)
        .input('Status', sql.NVarChar(40), 'Active')
        .input('CreatedByUserID', sql.Int, createdByUserId ? parseInt(createdByUserId, 10) : 1)
        .input('CreatedDate', sql.DateTime, new Date())
        .query(insertQuery);

      const newRoleId = result.recordset[0].RoleID;

      context.res.status = 201;
      context.res.body = JSON.stringify({ message: "Role created successfully", roleId: newRoleId });
      return;
    }

  } catch (error) {
    context.log.error("Roles API Error:", error);
    context.res.status = 500;
    context.res.body = JSON.stringify({ 
      message: "Server error", 
      error: error.message 
    });
  }
};