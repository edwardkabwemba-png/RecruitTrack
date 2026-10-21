const sql = require('mssql');

// Cache connection pool outside the request handler
let poolPromise = null;

function getPool() {
  if (!poolPromise) {
    poolPromise = sql.connect(process.env.SqlConnectionString);
  }
  return poolPromise;
}

// Helper functions for parsing numbers safely
const safeParseInt = (val) => {
  if (val === null || val === undefined || val === '') return null;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? null : parsed;
};

const safeParseFloat = (val, defaultVal = null) => {
  if (val === null || val === undefined || val === '') return defaultVal;
  const parsed = parseFloat(val);
  return isNaN(parsed) ? defaultVal : parsed;
};

const safeParseDate = (val) => {
  if (!val) return new Date();
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date() : d;
};

// Exchange rate lookup function converting selected currency to ZAR multiplier
async function getZarExchangeRate(pool, currency) {
  if (!currency || currency === 'ZAR') return 1.0;
  const pair = `${currency}_ZAR`;
  try {
    const res = await pool.request()
      .input('Pair', sql.NVarChar(10), pair)
      .query("SELECT TOP 1 Rate FROM dbo.ExchangeRates WHERE CurrencyPair = @Pair");

    if (res.recordset && res.recordset.length > 0) {
      return parseFloat(res.recordset[0].Rate);
    }
  } catch (err) {
    console.error(`Error looking up exchange rate for ${pair}:`, err.message);
  }
  return 1.0; // Fallback 1:1 if pair is missing
}

module.exports = async function (context, req) {
  context.res = { headers: { 'Content-Type': 'application/json' } };

  try {
    const pool = await getPool();

    // Read active logged-in user
    const loggedInUserHeader = req.headers['x-user-id'] || req.query.userId;
    const activeUserId = safeParseInt(loggedInUserHeader);

    // =========================================================================
    // GET REQUESTS
    // =========================================================================
    if (req.method === 'GET') {
      const { action, id, country, search, stage } = req.query;

      if (action === 'locations') {
        const queryCountry = country || 'South Africa';
        const result = await pool.request()
          .input('CountryName', sql.NVarChar(100), queryCountry)
          .query("SELECT LocationID, CityName FROM dbo.Locations WHERE CountryName = @CountryName AND IsActive = 1 ORDER BY CityName ASC");

        context.res.status = 200;
        context.res.body = result.recordset || [];
        return;
      }

      if (action === 'getOne' && id) {
        const query = `
          SELECT TOP 1 
            r.*, 
            a.ApplicationID, a.RoleID, a.RecruiterUserID, a.SourceID, a.DateSourced,
            ISNULL(a.LifecycleStage, 'Sourced') AS Stage, a.DocCvStatus, a.DocIdStatus,
            a.DocPaySlipsStatus, a.DocCertsStatus, a.DocDegreesStatus
          FROM dbo.Recruits r
          LEFT JOIN dbo.Applications a ON r.RecruitID = a.RecruitID
          WHERE r.RecruitID = @RecruitID;
        `;
        const result = await pool.request().input('RecruitID', sql.Int, safeParseInt(id)).query(query);
        context.res.status = 200;
        context.res.body = result.recordset[0] || {};
        return;
      }

      if (action === 'recent' || !action) {
        const searchPattern = search && search.trim() !== '' ? `%${search.trim()}%` : null;
        const stageFilter = stage && stage.trim() !== '' && stage.trim() !== 'All' ? stage.trim() : null;

        const reqQuery = pool.request();
        reqQuery.input('Search', sql.NVarChar(100), searchPattern);
        reqQuery.input('Stage', sql.NVarChar(50), stageFilter);

        const query = `
          SELECT TOP 50 
            r.RecruitID, r.FirstName, r.Surname, r.Email, r.Phone, r.CreatedDate, r.CurrentLocation,
            a.ApplicationID, a.RoleID, p.PositionTitle, c.ClientName, u.FullName AS RecruiterName,
            s.SourceName, ISNULL(a.LifecycleStage, 'Sourced') AS Stage, a.DateSourced
          FROM dbo.Recruits r
          LEFT JOIN dbo.Applications a ON r.RecruitID = a.RecruitID
          LEFT JOIN dbo.Roles ro ON a.RoleID = ro.RoleID
          LEFT JOIN dbo.Positions p ON ro.PositionID = p.PositionID
          LEFT JOIN dbo.Clients c ON ro.ClientID = c.ClientID
          LEFT JOIN dbo.Users u ON a.RecruiterUserID = u.UserID
          LEFT JOIN dbo.Sources s ON a.SourceID = s.SourceID
          WHERE 1=1
            AND (
              @Search IS NULL OR 
              r.FirstName LIKE @Search OR 
              r.Surname LIKE @Search OR 
              r.Email LIKE @Search OR 
              p.PositionTitle LIKE @Search
            )
            AND (@Stage IS NULL OR @Stage = '' OR a.LifecycleStage = @Stage)
          ORDER BY r.RecruitID DESC;
        `;
        const result = await reqQuery.query(query);
        context.res.status = 200;
        context.res.body = result.recordset || [];
        return;
      }

      if (action === 'dropdowns') {
        const recruiters = await pool.request().query("SELECT UserID, FullName FROM dbo.Users WHERE IsActive = 1");
        const sources = await pool.request().query("SELECT SourceID, SourceName FROM dbo.Sources");
        const roles = await pool.request().query("SELECT r.RoleID, p.PositionTitle + ' @ ' + c.ClientName AS RoleTitle FROM dbo.Roles r JOIN dbo.Positions p ON r.PositionID = p.PositionID JOIN dbo.Clients c ON r.ClientID = c.ClientID WHERE r.Status = 'Active'");
        const skills = await pool.request().query("SELECT SkillID, SkillName FROM dbo.SkillLibrary ORDER BY SkillName");
        const certs = await pool.request().query("SELECT CertID, CertName FROM dbo.CertificationLibrary ORDER BY CertName");
        const positions = await pool.request().query("SELECT PositionID, PositionTitle, classification FROM dbo.Positions WHERE IsActive = 1 ORDER BY PositionTitle ASC");

        context.res.status = 200;
        context.res.body = {
          recruiters: recruiters.recordset,
          sources: sources.recordset,
          roles: roles.recordset,
          skills: skills.recordset,
          certifications: certs.recordset,
          positions: positions.recordset
        };
        return;
      }
    }

    // =========================================================================
    // POST & PUT REQUESTS
    // =========================================================================
    if (req.method === 'POST' || req.method === 'PUT') {
      let body = req.body || {};
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) {}
      }

      const rawId = req.query.id || (context.bindingData && context.bindingData.id) || body.recruitId;
      const recruitId = safeParseInt(rawId);
      const isCreate = req.method === 'POST' || !recruitId;
      const targetStage = body.stage || body.lifecycleStage || (isCreate ? 'Sourced' : null);
      const parsedRoleId = safeParseInt(body.roleId || req.query.roleId);

      const assignedRecruiterId = safeParseInt(body.recruiterId) || activeUserId;
      const parsedDateSourced = safeParseDate(body.dateSourced);

      // Perform currency conversions to ZAR prior to saving to existing rate columns
      const currentCurrency = body.currentRateCurrency || body.currentCurrency || 'ZAR';
      const expectedCurrency = body.expectedRateCurrency || body.expectedCurrency || 'ZAR';

      const currentMultiplier = await getZarExchangeRate(pool, currentCurrency);
      const expectedMultiplier = await getZarExchangeRate(pool, expectedCurrency);

      const rawCurrentRate = safeParseFloat(body.currentRateRaw || body.currentRate);
      const rawExpectedRate = safeParseFloat(body.expectedRateRaw || body.expectedRate);

      const finalCurrentRateZar = safeParseFloat(body.currentRate) ?? (rawCurrentRate !== null ? rawCurrentRate * currentMultiplier : null);
      const finalExpectedRateZar = safeParseFloat(body.expectedRate) ?? (rawExpectedRate !== null ? rawExpectedRate * expectedMultiplier : 0.00);

      const transaction = new sql.Transaction(pool);
      await transaction.begin();

      try {
        let activeRecruitId = recruitId;

        if (isCreate) {
          // 1a. INSERT NEW RECRUIT
          const recruitReq = new sql.Request(transaction);
          const insertRecruitRes = await recruitReq
            .input('FirstName', sql.NVarChar(100), body.firstName || null)
            .input('Surname', sql.NVarChar(100), body.surname || null)
            .input('Email', sql.NVarChar(150), body.email || null)
            .input('Phone', sql.NVarChar(50), body.phone || null)
            .input('CountryOfResidency', sql.NVarChar(100), body.countryOfResidence || null)
            .input('CurrentLocation', sql.NVarChar(150), body.currentLocation || null)
            .input('SeniorityLevel', sql.NVarChar(50), body.seniorityLevel || null)
            .input('TotalYearsExperience', sql.Decimal(4, 1), safeParseFloat(body.totalYearsExperience))
            .input('CurrentRole', sql.NVarChar(150), body.currentRole || null)
            .input('RoleClassification', sql.NVarChar(150), body.roleClassification || null)
            .input('IdType', sql.NVarChar(50), body.idType || null)
            .input('IdNumber', sql.NVarChar(100), body.idNumber || null)
            .input('CurrentRate', sql.Decimal(18, 2), finalCurrentRateZar)
            .input('ExpectedRate', sql.Decimal(18, 2), finalExpectedRateZar)
            .input('CurrentRateFrequency', sql.NVarChar(20), body.currentRateFrequency || 'Monthly')
            .input('CurrentRateCurrency', sql.NVarChar(10), currentCurrency)
            .input('CurrentRateRaw', sql.Decimal(18, 2), rawCurrentRate)
            .input('ExpectedRateFrequency', sql.NVarChar(20), body.expectedRateFrequency || 'Monthly')
            .input('ExpectedRateCurrency', sql.NVarChar(10), expectedCurrency)
            .input('ExpectedRateRaw', sql.Decimal(18, 2), rawExpectedRate)
            .input('NoticePeriod', sql.NVarChar(50), body.noticePeriod || null)
            .input('Skills', sql.NVarChar(sql.MAX), body.skills || null)
            .input('Certifications', sql.NVarChar(sql.MAX), body.certifications || null)
            .input('OtherSkills', sql.NVarChar(sql.MAX), body.otherSkills || null)
            .query(`
              INSERT INTO dbo.Recruits (
                FirstName, Surname, Email, Phone, CountryOfResidency, CurrentLocation, SeniorityLevel,
                TotalYearsExperience, CurrentRole, RoleClassification, IdType, IdNumber, 
                CurrentRate, ExpectedRate, CurrentRateFrequency, CurrentRateCurrency, CurrentRateRaw,
                ExpectedRateFrequency, ExpectedRateCurrency, ExpectedRateRaw,
                NoticePeriod, Skills, Certifications, OtherSkills, CreatedDate
              )
              OUTPUT INSERTED.RecruitID
              VALUES (
                @FirstName, @Surname, @Email, @Phone, @CountryOfResidency, @CurrentLocation, @SeniorityLevel,
                @TotalYearsExperience, @CurrentRole, @RoleClassification, @IdType, @IdNumber, 
                @CurrentRate, @ExpectedRate, @CurrentRateFrequency, @CurrentRateCurrency, @CurrentRateRaw,
                @ExpectedRateFrequency, @ExpectedRateCurrency, @ExpectedRateRaw,
                @NoticePeriod, @Skills, @Certifications, @OtherSkills, GETDATE()
              );
            `);

          activeRecruitId = insertRecruitRes.recordset[0].RecruitID;

          // 2a. INSERT APPLICATION
          const appReq = new sql.Request(transaction);
          await appReq
            .input('RecruitID', sql.Int, activeRecruitId)
            .input('RoleID', sql.Int, parsedRoleId)
            .input('RecruiterUserID', sql.Int, assignedRecruiterId)
            .input('SourceID', sql.Int, safeParseInt(body.sourceId))
            .input('DateSourced', sql.Date, parsedDateSourced)
            .input('LifecycleStage', sql.NVarChar(50), targetStage)
            .input('DocCvStatus', sql.NVarChar(50), body.docCvStatus || 'Pending')
            .input('DocIdStatus', sql.NVarChar(50), body.docIdStatus || 'Pending')
            .input('DocPaySlipsStatus', sql.Int, safeParseInt(body.docPaySlipsStatus) ?? 0)
            .input('DocCertsStatus', sql.NVarChar(50), body.docCertsStatus || 'Pending')
            .input('DocDegreesStatus', sql.NVarChar(50), body.docDegreesStatus || 'Pending')
            .query(`
              INSERT INTO dbo.Applications (
                RecruitID, RoleID, RecruiterUserID, SourceID, DateSourced,
                LifecycleStage, DocCvStatus, DocIdStatus, DocPaySlipsStatus,
                DocCertsStatus, DocDegreesStatus
              )
              VALUES (
                @RecruitID, @RoleID, @RecruiterUserID, @SourceID, @DateSourced,
                @LifecycleStage, @DocCvStatus, @DocIdStatus, @DocPaySlipsStatus,
                @DocCertsStatus, @DocDegreesStatus
              );
            `);
        } else {
          // 1b. UPDATE RECRUIT MASTER
          const recruitReq = new sql.Request(transaction);
          await recruitReq
            .input('RecruitID', sql.Int, activeRecruitId)
            .input('FirstName', sql.NVarChar(100), body.firstName || null)
            .input('Surname', sql.NVarChar(100), body.surname || null)
            .input('Email', sql.NVarChar(150), body.email || null)
            .input('Phone', sql.NVarChar(50), body.phone || null)
            .input('CountryOfResidency', sql.NVarChar(100), body.countryOfResidence || null)
            .input('CurrentLocation', sql.NVarChar(150), body.currentLocation || null)
            .input('SeniorityLevel', sql.NVarChar(50), body.seniorityLevel || null)
            .input('TotalYearsExperience', sql.Decimal(4, 1), safeParseFloat(body.totalYearsExperience))
            .input('CurrentRole', sql.NVarChar(150), body.currentRole || null)
            .input('RoleClassification', sql.NVarChar(150), body.roleClassification || null)
            .input('IdType', sql.NVarChar(50), body.idType || null)
            .input('IdNumber', sql.NVarChar(100), body.idNumber || null)
            .input('CurrentRate', sql.Decimal(18, 2), finalCurrentRateZar)
            .input('ExpectedRate', sql.Decimal(18, 2), finalExpectedRateZar)
            .input('CurrentRateFrequency', sql.NVarChar(20), body.currentRateFrequency || 'Monthly')
            .input('CurrentRateCurrency', sql.NVarChar(10), currentCurrency)
            .input('CurrentRateRaw', sql.Decimal(18, 2), rawCurrentRate)
            .input('ExpectedRateFrequency', sql.NVarChar(20), body.expectedRateFrequency || 'Monthly')
            .input('ExpectedRateCurrency', sql.NVarChar(10), expectedCurrency)
            .input('ExpectedRateRaw', sql.Decimal(18, 2), rawExpectedRate)
            .input('NoticePeriod', sql.NVarChar(50), body.noticePeriod || null)
            .input('Skills', sql.NVarChar(sql.MAX), body.skills || null)
            .input('Certifications', sql.NVarChar(sql.MAX), body.certifications || null)
            .input('OtherSkills', sql.NVarChar(sql.MAX), body.otherSkills || null)
            .query(`
              UPDATE dbo.Recruits
              SET FirstName = @FirstName, Surname = @Surname, Email = @Email, Phone = @Phone,
                  CountryOfResidency = @CountryOfResidency, CurrentLocation = @CurrentLocation,
                  SeniorityLevel = @SeniorityLevel, TotalYearsExperience = @TotalYearsExperience, 
                  CurrentRole = @CurrentRole, RoleClassification = @RoleClassification, 
                  IdType = @IdType, IdNumber = @IdNumber, CurrentRate = @CurrentRate, 
                  ExpectedRate = @ExpectedRate, CurrentRateFrequency = @CurrentRateFrequency,
                  CurrentRateCurrency = @CurrentRateCurrency, CurrentRateRaw = @CurrentRateRaw,
                  ExpectedRateFrequency = @ExpectedRateFrequency, ExpectedRateCurrency = @ExpectedRateCurrency,
                  ExpectedRateRaw = @ExpectedRateRaw, NoticePeriod = @NoticePeriod,
                  Skills = @Skills, Certifications = @Certifications, OtherSkills = @OtherSkills
              WHERE RecruitID = @RecruitID;
            `);

          // 2b. UPSERT APPLICATION
          const appReq = new sql.Request(transaction);
          await appReq
            .input('RecruitID', sql.Int, activeRecruitId)
            .input('RoleID', sql.Int, parsedRoleId)
            .input('RecruiterUserID', sql.Int, assignedRecruiterId)
            .input('SourceID', sql.Int, safeParseInt(body.sourceId))
            .input('DateSourced', sql.Date, parsedDateSourced)
            .input('LifecycleStage', sql.NVarChar(50), targetStage)
            .input('DocCvStatus', sql.NVarChar(50), body.docCvStatus || null)
            .input('DocIdStatus', sql.NVarChar(50), body.docIdStatus || null)
            .input('DocPaySlipsStatus', sql.Int, safeParseInt(body.docPaySlipsStatus))
            .input('DocCertsStatus', sql.NVarChar(50), body.docCertsStatus || null)
            .input('DocDegreesStatus', sql.NVarChar(50), body.docDegreesStatus || null)
            .query(`
              IF EXISTS (SELECT 1 FROM dbo.Applications WHERE RecruitID = @RecruitID)
              BEGIN
                UPDATE dbo.Applications
                SET RoleID = COALESCE(@RoleID, RoleID), 
                    RecruiterUserID = COALESCE(@RecruiterUserID, RecruiterUserID), 
                    SourceID = COALESCE(@SourceID, SourceID),
                    DateSourced = COALESCE(@DateSourced, DateSourced), 
                    LifecycleStage = COALESCE(@LifecycleStage, LifecycleStage),
                    DocCvStatus = COALESCE(@DocCvStatus, DocCvStatus),
                    DocIdStatus = COALESCE(@DocIdStatus, DocIdStatus),
                    DocPaySlipsStatus = COALESCE(@DocPaySlipsStatus, DocPaySlipsStatus),
                    DocCertsStatus = COALESCE(@DocCertsStatus, DocCertsStatus),
                    DocDegreesStatus = COALESCE(@DocDegreesStatus, DocDegreesStatus)
                WHERE RecruitID = @RecruitID;
              END
              ELSE
              BEGIN
                INSERT INTO dbo.Applications (
                  RecruitID, RoleID, RecruiterUserID, SourceID, DateSourced,
                  LifecycleStage, DocCvStatus, DocIdStatus, DocPaySlipsStatus,
                  DocCertsStatus, DocDegreesStatus
                )
                VALUES (
                  @RecruitID, @RoleID, @RecruiterUserID, @SourceID, @DateSourced,
                  ISNULL(@LifecycleStage, 'Sourced'), ISNULL(@DocCvStatus, 'Pending'), 
                  ISNULL(@DocIdStatus, 'Pending'), ISNULL(@DocPaySlipsStatus, 0),
                  ISNULL(@DocCertsStatus, 'Pending'), ISNULL(@DocDegreesStatus, 'Pending')
                );
              END
            `);
        }

        await transaction.commit();
        context.res.status = 200;
        context.res.body = { 
          message: isCreate ? "Candidate created successfully." : "Candidate updated successfully.",
          recruitId: activeRecruitId 
        };
        return;
      } catch (txError) {
        if (transaction._aborted !== true) {
          try { await transaction.rollback(); } catch (_) {}
        }
        context.log.error("Transaction Error:", txError.message);
        context.res.status = 500;
        context.res.body = { message: "Database error during processing.", error: txError.message };
        return;
      }
    }
  } catch (error) {
    context.log.error("Recruits API Error:", error);
    context.res.status = 500;
    context.res.body = { message: "Server error", error: error.message };
  }
};