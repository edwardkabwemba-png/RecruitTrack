const sql = require('mssql');

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

async function getZarExchangeRate(pool, currency) {
  if (!currency || currency.toUpperCase().trim() === 'ZAR') return 1.0;
  const pair = `${currency.toUpperCase().trim()}_ZAR`;
  try {
    const res = await pool.request()
      .input('Pair', sql.NVarChar(10), pair)
      .query("SELECT TOP 1 Rate FROM dbo.ExchangeRates WHERE UPPER(CurrencyPair) = UPPER(@Pair)");

    if (res.recordset && res.recordset.length > 0) {
      return parseFloat(res.recordset[0].Rate);
    }
  } catch (err) {
    console.error(`Exchange rate lookup error for ${pair}:`, err.message);
  }
  return 1.0;
}

module.exports = async function (context, req) {
  const sendJson = (status, payload) => {
    context.res = {
      status,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    };
  };

  try {
    const connStr = process.env.SqlConnectionString || process.env.DATABASE_URL;
    if (!connStr) {
      return sendJson(500, { message: "Missing SqlConnectionString in environment settings." });
    }

    const pool = await sql.connect(connStr);

    const loggedInUserHeader = req.headers['x-user-id'] || req.query.userId;
    const activeUserId = safeParseInt(loggedInUserHeader);

    // =========================================================================
    // GET REQUESTS
    // =========================================================================
    if (req.method === 'GET') {
      const { action, id, country, search, stage, roles, classifications, seniority, minExp, skills, hideActive, sort } = req.query;

      if (action === 'locations') {
        const queryCountry = country || 'South Africa';
        const result = await pool.request()
          .input('CountryName', sql.NVarChar(100), queryCountry)
          .query("SELECT LocationID, CityName FROM dbo.Locations WHERE CountryName = @CountryName AND IsActive = 1 ORDER BY CityName ASC");

        return sendJson(200, result.recordset || []);
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
          WHERE r.RecruitID = @RecruitID
          ORDER BY a.ApplicationID DESC;
        `;
        const result = await pool.request().input('RecruitID', sql.Int, safeParseInt(id)).query(query);
        return sendJson(200, result.recordset[0] || {});
      }

      if (action === 'exchangeRates') {
        const rates = await pool.request().query("SELECT CurrencyPair, Rate FROM dbo.ExchangeRates");
        return sendJson(200, rates.recordset || []);
      }

      if (action === 'dropdowns') {
        const recruiters = await pool.request().query("SELECT UserID, FullName FROM dbo.Users WHERE IsActive = 1");
        const sources = await pool.request().query("SELECT SourceID, SourceName FROM dbo.Sources");
        const activeRoles = await pool.request().query("SELECT r.RoleID, p.PositionTitle + ' @ ' + c.ClientName AS RoleTitle FROM dbo.Roles r JOIN dbo.Positions p ON r.PositionID = p.PositionID JOIN dbo.Clients c ON r.ClientID = c.ClientID WHERE ISNULL(r.Status, 'Active') = 'Active' ORDER BY r.RoleID DESC");
        const skillList = await pool.request().query("SELECT SkillID, SkillName FROM dbo.SkillLibrary ORDER BY SkillName");
        const certs = await pool.request().query("SELECT CertID, CertName FROM dbo.CertificationLibrary ORDER BY CertName");
        const positions = await pool.request().query("SELECT PositionID, PositionTitle, classification FROM dbo.Positions WHERE IsActive = 1 ORDER BY PositionTitle ASC");
        const exchangeRates = await pool.request().query("SELECT CurrencyPair, Rate FROM dbo.ExchangeRates");

        return sendJson(200, {
          recruiters: recruiters.recordset || [],
          sources: sources.recordset || [],
          roles: activeRoles.recordset || [],
          skills: skillList.recordset || [],
          certifications: certs.recordset || [],
          positions: positions.recordset || [],
          exchangeRates: exchangeRates.recordset || []
        });
      }

      // =======================================================================
      // TALENT POOL & RECENT RECRUITS
      // =======================================================================
      if (action === 'talentPool' || action === 'recent' || !action) {
        const searchPattern = search && search.trim() !== '' ? `%${search.trim()}%` : null;
        const stageFilter = stage && stage.trim() !== '' && stage.trim() !== 'All' ? stage.trim() : null;
        const seniorityFilter = seniority && seniority.trim() !== '' ? seniority.trim() : null;
        const minExpVal = safeParseFloat(minExp);
        const hideActiveFlag = hideActive === 'true';

        const roleList = roles ? roles.split(',').map(s => s.trim()).filter(Boolean) : [];
        const classList = classifications ? classifications.split(',').map(s => s.trim()).filter(Boolean) : [];
        const skillList = skills ? skills.split(',').map(s => s.trim()).filter(Boolean) : [];

        const reqQuery = pool.request();
        reqQuery.input('Search', sql.NVarChar(100), searchPattern);
        reqQuery.input('Stage', sql.NVarChar(50), stageFilter);
        reqQuery.input('Seniority', sql.NVarChar(50), seniorityFilter);
        reqQuery.input('MinExp', sql.Decimal(4, 1), minExpVal);

        let dynamicClauses = [];
        let roleOrClassClauses = [];

        if (roleList.length > 0) {
          const roleParams = roleList.map((val, idx) => {
            const pName = `RoleFilter${idx}`;
            reqQuery.input(pName, sql.NVarChar(150), val);
            return `r.CurrentRole = @${pName}`;
          });
          roleOrClassClauses.push(`(${roleParams.join(' OR ')})`);
        }

        if (classList.length > 0) {
          const classParams = classList.map((val, idx) => {
            const pName = `ClassFilter${idx}`;
            reqQuery.input(pName, sql.NVarChar(150), val);
            return `r.RoleClassification = @${pName}`;
          });
          roleOrClassClauses.push(`(${classParams.join(' OR ')})`);
        }

        if (roleOrClassClauses.length > 0) {
          dynamicClauses.push(`(${roleOrClassClauses.join(' OR ')})`);
        }

        skillList.forEach((sk, idx) => {
          const pName = `SkillFilter${idx}`;
          reqQuery.input(pName, sql.NVarChar(150), `%${sk}%`);
          dynamicClauses.push(`(r.Skills LIKE @${pName} OR r.OtherSkills LIKE @${pName})`);
        });

        if (hideActiveFlag) {
          dynamicClauses.push(`activeApp.ApplicationID IS NULL`);
        }

        const extraWhereSql = dynamicClauses.length > 0 ? `AND ${dynamicClauses.join(' AND ')}` : '';

        let orderBySql = 'ORDER BY COALESCE(latestApp.DateSourced, r.CreatedDate) DESC, r.RecruitID DESC';
        if (sort === 'experience_desc') {
          orderBySql = 'ORDER BY ISNULL(r.TotalYearsExperience, 0) DESC, r.RecruitID DESC';
        } else if (sort === 'rate_asc') {
          orderBySql = 'ORDER BY ISNULL(r.ExpectedRate, 999999999) ASC, r.RecruitID DESC';
        } else if (sort === 'name_asc') {
          orderBySql = 'ORDER BY r.FirstName ASC, r.Surname ASC';
        }

        const query = `
          SELECT TOP 100
            r.RecruitID,
            r.FirstName,
            r.Surname,
            r.Email,
            r.Phone,
            r.CreatedDate,
            r.CurrentLocation,
            r.CurrentRole,
            r.RoleClassification,
            r.SeniorityLevel,
            r.TotalYearsExperience,
            r.ExpectedRate,
            r.ExpectedRateCurrency,
            r.ExpectedRateRaw,
            r.ExpectedRateFrequency,
            r.Skills,
            r.OtherSkills,
            latestApp.ApplicationID,
            latestApp.RoleID AS LatestRoleID,
            latestApp.PositionTitle,
            latestApp.ClientName,
            latestApp.RecruiterName,
            latestApp.SourceName,
            ISNULL(latestApp.LifecycleStage, 'Sourced') AS Stage,
            latestApp.DateSourced,
            CASE WHEN activeApp.ApplicationID IS NOT NULL THEN 1 ELSE 0 END AS IsInActivePipeline,
            activeApp.RoleID AS ActiveRoleID,
            activeApp.RecruiterName AS ActiveRecruiterName
          FROM dbo.Recruits r
          OUTER APPLY (
            SELECT TOP 1
              a.ApplicationID, a.RoleID, a.LifecycleStage, a.DateSourced,
              p.PositionTitle, c.ClientName, u.FullName AS RecruiterName, s.SourceName
            FROM dbo.Applications a
            LEFT JOIN dbo.Roles ro ON a.RoleID = ro.RoleID
            LEFT JOIN dbo.Positions p ON ro.PositionID = p.PositionID
            LEFT JOIN dbo.Clients c ON ro.ClientID = c.ClientID
            LEFT JOIN dbo.Users u ON a.RecruiterUserID = u.UserID
            LEFT JOIN dbo.Sources s ON a.SourceID = s.SourceID
            WHERE a.RecruitID = r.RecruitID
            ORDER BY a.ApplicationID DESC
          ) latestApp
          OUTER APPLY (
            SELECT TOP 1
              a.ApplicationID, a.RoleID, u.FullName AS RecruiterName
            FROM dbo.Applications a
            LEFT JOIN dbo.Roles ro ON a.RoleID = ro.RoleID
            LEFT JOIN dbo.Users u ON a.RecruiterUserID = u.UserID
            WHERE a.RecruitID = r.RecruitID
              AND ISNULL(a.LifecycleStage, 'Sourced') NOT IN ('Rejected', 'Withdrawn', 'Declined', 'Hired')
              AND ISNULL(ro.Status, 'Active') != 'Closed'
            ORDER BY a.ApplicationID DESC
          ) activeApp
          WHERE 1=1
            AND (
              @Search IS NULL OR 
              r.FirstName LIKE @Search OR 
              r.Surname LIKE @Search OR 
              r.Email LIKE @Search OR 
              r.CurrentRole LIKE @Search OR
              latestApp.PositionTitle LIKE @Search
            )
            AND (@Stage IS NULL OR @Stage = '' OR latestApp.LifecycleStage = @Stage)
            AND (@Seniority IS NULL OR r.SeniorityLevel = @Seniority)
            AND (@MinExp IS NULL OR ISNULL(r.TotalYearsExperience, 0) >= @MinExp)
            ${extraWhereSql}
          ${orderBySql};
        `;

        const result = await reqQuery.query(query);
        return sendJson(200, result.recordset || []);
      }

      return sendJson(400, { message: `Unsupported GET action: ${action}` });
    }

    // =========================================================================
    // POST & PUT REQUESTS
    // =========================================================================
    if (req.method === 'POST' || req.method === 'PUT') {
      let body = req.body || {};
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) {}
      }

      if (body.action === 'submitToRole') {
        const targetRecruitId = safeParseInt(body.recruitId);
        const targetRoleId = safeParseInt(body.roleId);
        const recruiterId = safeParseInt(body.recruiterId) || activeUserId;

        if (!targetRecruitId || !targetRoleId) {
          return sendJson(400, { message: "Candidate ID and Role ID are required." });
        }

        const existingCheck = await pool.request()
          .input('RecruitID', sql.Int, targetRecruitId)
          .input('RoleID', sql.Int, targetRoleId)
          .query("SELECT TOP 1 ApplicationID FROM dbo.Applications WHERE RecruitID = @RecruitID AND RoleID = @RoleID");

        if (existingCheck.recordset && existingCheck.recordset.length > 0) {
          return sendJson(409, { message: "This candidate has already been submitted to the selected role." });
        }

        await pool.request()
          .input('RecruitID', sql.Int, targetRecruitId)
          .input('RoleID', sql.Int, targetRoleId)
          .input('RecruiterUserID', sql.Int, recruiterId)
          .query(`
            INSERT INTO dbo.Applications (
              RecruitID, RoleID, RecruiterUserID, DateSourced,
              LifecycleStage, DocCvStatus, DocIdStatus, DocPaySlipsStatus,
              DocCertsStatus, DocDegreesStatus
            )
            VALUES (
              @RecruitID, @RoleID, @RecruiterUserID, GETDATE(),
              'Sourced', 'Pending', 'Pending', 0, 'Pending', 'Pending'
            );
          `);

        return sendJson(201, { message: "Candidate successfully submitted to role." });
      }

      const rawId = req.query.id || (context.bindingData && context.bindingData.id) || body.recruitId;
      const recruitId = safeParseInt(rawId);
      const isCreate = req.method === 'POST' || !recruitId;
      const targetStage = body.stage || body.lifecycleStage || (isCreate ? 'Sourced' : null);
      const parsedRoleId = safeParseInt(body.roleId || req.query.roleId);

      const assignedRecruiterId = safeParseInt(body.recruiterId) || activeUserId;
      const parsedDateSourced = safeParseDate(body.dateSourced);

      const currentCurrency = (body.currentRateCurrency || body.currentCurrency || 'ZAR').toUpperCase().trim();
      const expectedCurrency = (body.expectedRateCurrency || body.expectedCurrency || 'ZAR').toUpperCase().trim();

      const currentMultiplier = await getZarExchangeRate(pool, currentCurrency);
      const expectedMultiplier = await getZarExchangeRate(pool, expectedCurrency);

      const rawCurrentRate = safeParseFloat(body.currentRateRaw || body.currentRateOriginal || body.currentRate);
      const rawExpectedRate = safeParseFloat(body.expectedRateRaw || body.expectedRateOriginal || body.expectedRate);

      const finalCurrentRateZar = currentCurrency === 'ZAR' 
        ? rawCurrentRate 
        : (rawCurrentRate !== null ? parseFloat((rawCurrentRate * currentMultiplier).toFixed(2)) : null);

      const finalExpectedRateZar = expectedCurrency === 'ZAR' 
        ? rawExpectedRate 
        : (rawExpectedRate !== null ? parseFloat((rawExpectedRate * expectedMultiplier).toFixed(2)) : null);

      const transaction = new sql.Transaction(pool);
      await transaction.begin();

      try {
        let activeRecruitId = recruitId;

        if (isCreate) {
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
              SET FirstName = COALESCE(@FirstName, FirstName),
                  Surname = COALESCE(@Surname, Surname),
                  Email = COALESCE(@Email, Email),
                  Phone = COALESCE(@Phone, Phone),
                  CountryOfResidency = COALESCE(@CountryOfResidency, CountryOfResidency),
                  CurrentLocation = COALESCE(@CurrentLocation, CurrentLocation),
                  SeniorityLevel = COALESCE(@SeniorityLevel, SeniorityLevel),
                  TotalYearsExperience = COALESCE(@TotalYearsExperience, TotalYearsExperience),
                  CurrentRole = COALESCE(@CurrentRole, CurrentRole),
                  RoleClassification = COALESCE(@RoleClassification, RoleClassification),
                  IdType = COALESCE(@IdType, IdType),
                  IdNumber = COALESCE(@IdNumber, IdNumber),
                  CurrentRate = COALESCE(@CurrentRate, CurrentRate),
                  ExpectedRate = COALESCE(@ExpectedRate, ExpectedRate),
                  CurrentRateFrequency = COALESCE(@CurrentRateFrequency, CurrentRateFrequency),
                  CurrentRateCurrency = COALESCE(@CurrentRateCurrency, CurrentRateCurrency),
                  CurrentRateRaw = COALESCE(@CurrentRateRaw, CurrentRateRaw),
                  ExpectedRateFrequency = COALESCE(@ExpectedRateFrequency, ExpectedRateFrequency),
                  ExpectedRateCurrency = COALESCE(@ExpectedRateCurrency, ExpectedRateCurrency),
                  ExpectedRateRaw = COALESCE(@ExpectedRateRaw, ExpectedRateRaw),
                  NoticePeriod = COALESCE(@NoticePeriod, NoticePeriod),
                  Skills = COALESCE(@Skills, Skills),
                  Certifications = COALESCE(@Certifications, Certifications),
                  OtherSkills = COALESCE(@OtherSkills, OtherSkills)
              WHERE RecruitID = @RecruitID;
            `);

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
        return sendJson(200, { 
          message: isCreate ? "Candidate created successfully." : "Candidate updated successfully.",
          recruitId: activeRecruitId 
        });
      } catch (txError) {
        if (transaction._aborted !== true) {
          try { await transaction.rollback(); } catch (_) {}
        }
        context.log.error("Transaction Error:", txError.message);
        return sendJson(500, { message: "Database error during processing.", error: txError.message });
      }
    }

    return sendJson(405, { message: "Method not allowed" });
  } catch (error) {
    context.log.error("Recruits API Error:", error);
    return sendJson(500, { message: "Server error", error: error.message });
  }
};