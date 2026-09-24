const sql = require('mssql');

module.exports = async function (context, req) {
  context.res = { headers: { 'Content-Type': 'application/json' } };

  try {
    const pool = await sql.connect(process.env.SqlConnectionString);

    // Read active user ID from header, request body, or recruiters array fallback
    const headerUserId = req.headers['x-user-id'];
    const bodyUserId = req.body && req.body.createdByUserId;
    const recruiterUserId = (req.body && Array.isArray(req.body.recruiters) && req.body.recruiters[0]) 
      ? req.body.recruiters[0].id 
      : null;

    const rawUserId = headerUserId || bodyUserId || recruiterUserId;
    const activeUserId = rawUserId ? parseInt(rawUserId, 10) : null;

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

        // Required Skills Aggregation
        'OUTER APPLY ( ' +
        '  SELECT STRING_AGG(sl.SkillName, \', \') AS RequiredSkills ' +
        '  FROM dbo.RoleSkills rs ' +
        '  JOIN dbo.SkillLibrary sl ON rs.SkillID = sl.SkillID ' +
        '  WHERE rs.RoleID = r.RoleID AND rs.IsRequired = 1 ' +
        ') skReq ' +

        // Nice-To-Have Skills Aggregation
        'OUTER APPLY ( ' +
        '  SELECT STRING_AGG(sl.SkillName, \', \') AS NiceToHaveSkills ' +
        '  FROM dbo.RoleSkills rs ' +
        '  JOIN dbo.SkillLibrary sl ON rs.SkillID = sl.SkillID ' +
        '  WHERE rs.RoleID = r.RoleID AND (rs.IsRequired = 0 OR rs.IsRequired IS NULL) ' +
        ') skNice ' +

        // Certifications Aggregation
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
        recruiters, reqSkills, niceSkills, certifications
      } = req.body || {};

      if (!positionId || !clientId) {
        context.res.status = 400;
        context.res.body = JSON.stringify({ message: "Position and Client are required." });
        return;
      }

      if (!activeUserId || isNaN(activeUserId)) {
        context.res.status = 400;
        context.res.body = JSON.stringify({ message: "Missing or invalid User ID. Please log in again." });
        return;
      }

      // Verify the UserID exists in dbo.Users
      const userCheck = await pool.request()
        .input('CheckUserID', sql.Int, activeUserId)
        .query('SELECT TOP 1 UserID FROM dbo.Users WHERE UserID = @CheckUserID');

      if (!userCheck.recordset || userCheck.recordset.length === 0) {
        context.res.status = 400;
        context.res.body = JSON.stringify({ 
          message: `User with ID ${activeUserId} does not exist in dbo.Users. Please re-authenticate.` 
        });
        return;
      }

      // Use a SQL Transaction to ensure Role + Skills/Certs/Recruiters are saved atomically
      const transaction = new sql.Transaction(pool);
      await transaction.begin();

      try {
        // 1. Insert into dbo.Roles
        const insertRoleQuery = 
          'INSERT INTO dbo.Roles ' +
          '  (PositionID, ClientID, SeniorityLevel, MinEducation, FieldOfStudy, MinYearsExperience, Location, WorkModel, RateBudgetMin, RateBudgetMax, Status, CreatedByUserID, CreatedDate) ' +
          'OUTPUT INSERTED.RoleID ' +
          'VALUES ' +
          '  (@PositionID, @ClientID, @SeniorityLevel, @MinEducation, @FieldOfStudy, @MinYearsExperience, @Location, @WorkModel, @RateBudgetMin, @RateBudgetMax, @Status, @CreatedByUserID, @CreatedDate)';

        const roleReq = new sql.Request(transaction);
        const roleResult = await roleReq
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
          .input('CreatedByUserID', sql.Int, activeUserId)
          .input('CreatedDate', sql.DateTime, new Date())
          .query(insertRoleQuery);

        const newRoleId = roleResult.recordset[0].RoleID;

        // 2. Insert Required Skills into dbo.RoleSkills
        if (Array.isArray(reqSkills) && reqSkills.length > 0) {
          for (const item of reqSkills) {
            const skillId = parseInt(item.id, 10);
            if (!isNaN(skillId)) {
              const skillReq = new sql.Request(transaction);
              await skillReq
                .input('RoleID', sql.Int, newRoleId)
                .input('SkillID', sql.Int, skillId)
                .input('IsRequired', sql.Bit, 1)
                .query('INSERT INTO dbo.RoleSkills (RoleID, SkillID, IsRequired) VALUES (@RoleID, @SkillID, @IsRequired)');
            }
          }
        }

        // 3. Insert Nice-to-Have Skills into dbo.RoleSkills
        if (Array.isArray(niceSkills) && niceSkills.length > 0) {
          for (const item of niceSkills) {
            const skillId = parseInt(item.id, 10);
            if (!isNaN(skillId)) {
              const skillReq = new sql.Request(transaction);
              await skillReq
                .input('RoleID', sql.Int, newRoleId)
                .input('SkillID', sql.Int, skillId)
                .input('IsRequired', sql.Bit, 0)
                .query('INSERT INTO dbo.RoleSkills (RoleID, SkillID, IsRequired) VALUES (@RoleID, @SkillID, @IsRequired)');
            }
          }
        }

        // 4. Insert Certifications into dbo.RoleCertifications
        if (Array.isArray(certifications) && certifications.length > 0) {
          for (const item of certifications) {
            const certReq = new sql.Request(transaction);
            await certReq
              .input('RoleID', sql.Int, newRoleId)
              .input('CertificationName', sql.NVarChar(200), item.label || item.name || item.id)
              .query('INSERT INTO dbo.RoleCertifications (RoleID, CertificationName) VALUES (@RoleID, @CertificationName)');
          }
        }

        // 5. Insert Recruiters into dbo.RoleRecruiters
        if (Array.isArray(recruiters) && recruiters.length > 0) {
          for (const item of recruiters) {
            const recUserId = parseInt(item.id, 10);
            if (!isNaN(recUserId)) {
              const recReq = new sql.Request(transaction);
              await recReq
                .input('RoleID', sql.Int, newRoleId)
                .input('UserID', sql.Int, recUserId)
                .query('INSERT INTO dbo.RoleRecruiters (RoleID, UserID) VALUES (@RoleID, @UserID)');
            }
          }
        }

        // Commit transaction after all inserts complete
        await transaction.commit();

        context.res.status = 201;
        context.res.body = JSON.stringify({ message: "Role created successfully", roleId: newRoleId });
        return;

      } catch (txError) {
        await transaction.rollback();
        throw txError;
      }
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