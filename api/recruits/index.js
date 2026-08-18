const sql = require('mssql');

module.exports = async function (context, req) {
  context.res = { headers: { 'Content-Type': 'application/json' } };

  try {
    const pool = await sql.connect(process.env.SqlConnectionString);

    // ==========================================
    // GET REQUESTS
    // ==========================================
    if (req.method === 'GET') {
      const { action } = req.query;

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

    // ==========================================
    // POST REQUEST (CREATE RECRUIT & APPLICATION)
    // ==========================================
    if (req.method === 'POST') {
      const body = req.body || {};

      // Map notice period flexible to UI payload key variations
      const {
        recruiterId, dateSourced, firstName, surname, sourceId,
        countryOfResidence, currentRate, expectedRate,
        email, phone, idType, idNumber, roleId
      } = body;

      // Extract notice period matching frontend variations
      const rawNotice = body.noticePeriod || body.notice || body.noticePeriodDays || '30 Days';

      if (!firstName || !surname || !email) {
        context.res.status = 400;
        context.res.body = JSON.stringify({ message: "First Name, Surname, and Email are required." });
        return;
      }

      const transaction = new sql.Transaction(pool);
      await transaction.begin();

      try {
        const parsedRoleId = parseInt(roleId, 10);
        const validRoleId = !isNaN(parsedRoleId) ? parsedRoleId : null;

        // 1. Insert Candidate into dbo.Recruits
        const recruitReq = new sql.Request(transaction);
        const recruitResult = await recruitReq
          .input('FirstName', sql.NVarChar(100), firstName)
          .input('Surname', sql.NVarChar(100), surname)
          .input('Email', sql.NVarChar(150), email)
          .input('Phone', sql.NVarChar(50), phone || null)
          .input('CountryOfResidency', sql.NVarChar(100), countryOfResidence || 'South Africa')
          .input('IdType', sql.NVarChar(50), idType || null)
          .input('IdNumber', sql.NVarChar(100), idNumber || null)
          .input('CurrentRate', sql.Decimal(18, 2), currentRate && !isNaN(currentRate) ? parseFloat(currentRate) : null)
          .input('ExpectedRate', sql.Decimal(18, 2), expectedRate && !isNaN(expectedRate) ? parseFloat(expectedRate) : 0.00)
          .input('NoticePeriod', sql.NVarChar(50), rawNotice)
          .input('RoleID', sql.Int, validRoleId)
          .input('CreatedDate', sql.DateTime, new Date())
          .query(`
            INSERT INTO dbo.Recruits 
              (FirstName, Surname, Email, Phone, CountryOfResidency, IdType, IdNumber, CurrentRate, ExpectedRate, NoticePeriod, RoleID, CreatedDate)
            OUTPUT INSERTED.RecruitID
            VALUES 
              (@FirstName, @Surname, @Email, @Phone, @CountryOfResidency, @IdType, @IdNumber, @CurrentRate, @ExpectedRate, @NoticePeriod, @RoleID, @CreatedDate);
          `);

        const newRecruitId = recruitResult.recordset[0].RecruitID;

        // 2. Link Candidate to Role inside dbo.Applications
        if (validRoleId) {
          const parsedRecruiterId = parseInt(recruiterId, 10);
          const parsedSourceId = parseInt(sourceId, 10);
          const parsedDate = dateSourced ? new Date(dateSourced) : new Date();

          const appReq = new sql.Request(transaction);
          await appReq
            .input('RecruitID', sql.Int, newRecruitId)
            .input('RoleID', sql.Int, validRoleId)
            .input('RecruiterUserID', sql.Int, !isNaN(parsedRecruiterId) ? parsedRecruiterId : null)
            .input('SourceID', sql.Int, !isNaN(parsedSourceId) ? parsedSourceId : null)
            .input('DateSourced', sql.Date, parsedDate)
            .input('NoticePeriod', sql.NVarChar(50), rawNotice)
            .input('LifecycleStage', sql.NVarChar(50), 'In Discussion')
            .query(`
              INSERT INTO dbo.Applications 
                (RecruitID, RoleID, RecruiterUserID, SourceID, DateSourced, NoticePeriod, LifecycleStage)
              VALUES 
                (@RecruitID, @RoleID, @RecruiterUserID, @SourceID, @DateSourced, @NoticePeriod, @LifecycleStage);
            `);
        }

        await transaction.commit();

        context.res.status = 201;
        context.res.body = JSON.stringify({
          message: "Candidate created successfully.",
          recruitId: newRecruitId
        });
        return;

      } catch (txError) {
        await transaction.rollback();
        context.log.error("Transaction Error:", txError.message);
        context.res.status = 500;
        context.res.body = JSON.stringify({ message: "Database insert error", error: txError.message });
        return;
      }
    }

  } catch (error) {
    context.log.error("Recruits API Error:", error);
    context.res.status = 500;
    context.res.body = JSON.stringify({ message: "Server error", error: error.message });
  }
};