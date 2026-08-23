const sql = require('mssql');

module.exports = async function (context, req) {
  context.res = { headers: { 'Content-Type': 'application/json' } };

  try {
    const pool = await sql.connect(process.env.SqlConnectionString);

    // GET REQUESTS
    if (req.method === 'GET') {
      const { action, id } = req.query;

      if (action === 'getOne' && id) {
        const query = `
          SELECT TOP 1 
            r.*, 
            a.ApplicationID, a.RoleID, a.RecruiterUserID, a.SourceID, a.DateSourced, 
            a.LifecycleStage AS Stage, a.DocCvStatus, a.DocIdStatus, a.DocPaySlipsStatus, 
            a.DocCertsStatus, a.DocDegreesStatus
          FROM dbo.Recruits r
          LEFT JOIN dbo.Applications a ON r.RecruitID = a.RecruitID
          WHERE r.RecruitID = @RecruitID;
        `;
        const result = await pool.request().input('RecruitID', sql.Int, id).query(query);
        context.res.status = 200;
        context.res.body = JSON.stringify(result.recordset[0] || {});
        return;
      }

      if (action === 'recent' || !action) {
        const query = `
          SELECT TOP 50 
            r.RecruitID, r.FirstName, r.Surname, r.Email, r.Phone, r.CreatedDate,
            a.ApplicationID, p.PositionTitle, c.ClientName, u.FullName AS RecruiterName,
            s.SourceName, ISNULL(a.LifecycleStage, 'Sourced') AS Stage, a.DateSourced
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

      if (action === 'dropdowns') {
        const recruiters = await pool.request().query("SELECT UserID, FullName FROM dbo.Users WHERE IsActive = 1");
        const sources = await pool.request().query("SELECT SourceID, SourceName FROM dbo.Sources");
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

    // PUT REQUEST (FULL CANDIDATE UPDATE)
    if (req.method === 'PUT') {
      let body = req.body || {};
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) {}
      }

      const recruitId = parseInt(context.bindingData.id || body.recruitId, 10);
      if (isNaN(recruitId)) {
        context.res.status = 400;
        context.res.body = JSON.stringify({ message: "Invalid Recruit ID." });
        return;
      }

      const transaction = new sql.Transaction(pool);
      await transaction.begin();

      try {
        // 1. Update Candidate Master Data
        const recruitReq = new sql.Request(transaction);
        await recruitReq
          .input('RecruitID', sql.Int, recruitId)
          .input('FirstName', sql.NVarChar(100), body.firstName)
          .input('Surname', sql.NVarChar(100), body.surname)
          .input('Email', sql.NVarChar(150), body.email)
          .input('Phone', sql.NVarChar(50), body.phone)
          .input('CountryOfResidency', sql.NVarChar(100), body.countryOfResidence)
          .input('SeniorityLevel', sql.NVarChar(50), body.seniorityLevel)
          .input('TotalYearsExperience', sql.Decimal(4, 1), body.totalYearsExperience ? parseFloat(body.totalYearsExperience) : null)
          .input('IdType', sql.NVarChar(50), body.idType)
          .input('IdNumber', sql.NVarChar(100), body.idNumber)
          .input('CurrentRate', sql.Decimal(18, 2), body.currentRate ? parseFloat(body.currentRate) : null)
          .input('ExpectedRate', sql.Decimal(18, 2), body.expectedRate ? parseFloat(body.expectedRate) : 0.00)
          .input('NoticePeriod', sql.NVarChar(50), body.noticePeriod)
          .input('Skills', sql.NVarChar(sql.MAX), body.skills)
          .input('Certifications', sql.NVarChar(sql.MAX), body.certifications)
          .input('OtherSkills', sql.NVarChar(sql.MAX), body.otherSkills)
          .query(`
            UPDATE dbo.Recruits
            SET FirstName = @FirstName, Surname = @Surname, Email = @Email, Phone = @Phone,
                CountryOfResidency = @CountryOfResidency, SeniorityLevel = @SeniorityLevel,
                TotalYearsExperience = @TotalYearsExperience, IdType = @IdType, IdNumber = @IdNumber,
                CurrentRate = @CurrentRate, ExpectedRate = @ExpectedRate, NoticePeriod = @NoticePeriod,
                Skills = @Skills, Certifications = @Certifications, OtherSkills = @OtherSkills
            WHERE RecruitID = @RecruitID;
          `);

        // 2. Update Application & Stage
        const appReq = new sql.Request(transaction);
        await appReq
          .input('RecruitID', sql.Int, recruitId)
          .input('RoleID', sql.Int, body.roleId ? parseInt(body.roleId, 10) : null)
          .input('RecruiterUserID', sql.Int, body.recruiterId ? parseInt(body.recruiterId, 10) : null)
          .input('SourceID', sql.Int, body.sourceId ? parseInt(body.sourceId, 10) : null)
          .input('DateSourced', sql.Date, body.dateSourced ? new Date(body.dateSourced) : new Date())
          .input('LifecycleStage', sql.NVarChar(50), body.stage || 'Sourced')
          .query(`
            UPDATE dbo.Applications
            SET RoleID = @RoleID, RecruiterUserID = @RecruiterUserID, SourceID = @SourceID,
                DateSourced = @DateSourced, LifecycleStage = @LifecycleStage
            WHERE RecruitID = @RecruitID;
          `);

        await transaction.commit();

        context.res.status = 200;
        context.res.body = JSON.stringify({ message: "Candidate details updated successfully." });
        return;

      } catch (txError) {
        if (transaction._aborted !== true) {
          try { await transaction.rollback(); } catch (_) {}
        }
        context.log.error("Update Transaction Error:", txError.message);
        context.res.status = 500;
        context.res.body = JSON.stringify({ message: "Database error during update.", error: txError.message });
        return;
      }
    }

  } catch (error) {
    context.log.error("Recruits API Error:", error);
    context.res.status = 500;
    context.res.body = JSON.stringify({ message: "Server error", error: error.message });
  }
};