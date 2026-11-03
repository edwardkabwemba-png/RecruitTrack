const sql = require('mssql');

module.exports = async function (context, req) {
  const sendJson = (status, body) => {
    context.res = {
      status,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    };
  };

  try {
    const connectionString = process.env.SqlConnectionString || process.env.DATABASE_URL;
    const pool = await sql.connect(connectionString);

    // =========================================================================
    // GET: List roles with recruiter initials, IDs, and candidate counts
    // =========================================================================
    if (req.method === 'GET') {
      const search = (req.query.search || '').trim();
      const status = (req.query.status || '').trim();
      const myRoles = req.query.myRoles === 'true';
      const activeUserId = parseInt(req.headers['x-user-id'] || req.query.userId);

      const request = pool.request();
      let whereClauses = [];

      if (search) {
        request.input('Search', sql.NVarChar, `%${search}%`);
        whereClauses.push(`(p.PositionTitle LIKE @Search OR c.ClientName LIKE @Search)`);
      }
      if (status) {
        request.input('Status', sql.NVarChar, status);
        whereClauses.push(`r.Status = @Status`);
      }
      if (myRoles && !isNaN(activeUserId)) {
        request.input('ActiveUserId', sql.Int, activeUserId);
        whereClauses.push(`r.RoleID IN (SELECT RoleID FROM dbo.RoleRecruiters WHERE UserID = @ActiveUserId)`);
      }

      const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      const query = `
        SELECT 
          r.RoleID,
          p.PositionTitle,
          c.ClientName,
          ISNULL(r.Status, 'Active') AS Status,
          (
            SELECT STRING_AGG(SUBSTRING(u.FullName, 1, 1) + SUBSTRING(u.Surname, 1, 1), ', ')
            FROM dbo.RoleRecruiters rr
            INNER JOIN dbo.Users u ON rr.UserID = u.UserID
            WHERE rr.RoleID = r.RoleID
          ) AS RecruiterInitials,
          (
            SELECT STRING_AGG(CAST(rr.UserID AS VARCHAR), ',')
            FROM dbo.RoleRecruiters rr
            WHERE rr.RoleID = r.RoleID
          ) AS RecruiterIDs,
          (
            SELECT COUNT(*) 
            FROM dbo.Applications a 
            WHERE a.RoleID = r.RoleID
          ) AS CandidateCount
        FROM dbo.Roles r
        LEFT JOIN dbo.Positions p ON r.PositionID = p.PositionID
        LEFT JOIN dbo.Clients c ON r.ClientID = c.ClientID
        ${whereSql}
        ORDER BY r.RoleID DESC;
      `;

      const result = await request.query(query);
      return sendJson(200, result.recordset);
    }

    // =========================================================================
    // POST: Create New Role (Matches dbo.Roles & dbo.RoleRecruiters schemas)
    // =========================================================================
    if (req.method === 'POST') {
      const body = req.body || {};
      const createdByUserId = parseInt(req.headers['x-user-id'] || body.userId);
      const positionId = parseInt(body.positionId || body.PositionID);
      const clientId = parseInt(body.clientId || body.ClientID);

      if (!positionId || !clientId) {
        return sendJson(400, { error: "Position and Client are required fields." });
      }

      if (!createdByUserId || isNaN(createdByUserId)) {
        return sendJson(400, { error: "CreatedByUserID (x-user-id header) is required." });
      }

      const transaction = new sql.Transaction(pool);
      await transaction.begin();

      try {
        const request = new sql.Request(transaction);

        // Inputs for dbo.Roles
        request.input('PositionID', sql.Int, positionId);
        request.input('ClientID', sql.Int, clientId);
        request.input('SeniorityLevel', sql.NVarChar(100), body.seniority || 'Mid-Level');
        request.input('MinEducation', sql.NVarChar(100), body.education || "Bachelor's Degree");
        request.input('FieldOfStudy', sql.NVarChar(150), body.fieldOfStudy || null);
        request.input('MinYearsExperience', sql.Int, body.minExperience ? parseInt(body.minExperience) : 0);
        request.input('Location', sql.NVarChar(150), body.location || null);
        request.input('WorkModel', sql.NVarChar(50), body.workModel || 'Hybrid');
        request.input('RateBudgetMin', sql.Decimal(18, 2), body.rateMin ? parseFloat(body.rateMin) : null);
        request.input('RateBudgetMax', sql.Decimal(18, 2), body.rateMax ? parseFloat(body.rateMax) : null);
        request.input('Status', sql.NVarChar(50), 'Active');
        request.input('CreatedByUserID', sql.Int, createdByUserId);

        const insertRoleQuery = `
          INSERT INTO dbo.Roles (
            PositionID, ClientID, SeniorityLevel, MinEducation, FieldOfStudy, 
            MinYearsExperience, Location, WorkModel, RateBudgetMin, RateBudgetMax, 
            Status, CreatedByUserID, CreatedDate
          )
          OUTPUT INSERTED.RoleID
          VALUES (
            @PositionID, @ClientID, @SeniorityLevel, @MinEducation, @FieldOfStudy, 
            @MinYearsExperience, @Location, @WorkModel, @RateBudgetMin, @RateBudgetMax, 
            @Status, @CreatedByUserID, GETDATE()
          );
        `;

        const roleRes = await request.query(insertRoleQuery);
        const newRoleId = roleRes.recordset[0].RoleID;

        // Extract and deduplicate assigned recruiters
        let rawRecruiters = Array.isArray(body.recruiters) ? body.recruiters.map(Number) : [];
        const recruitersSet = new Set([...rawRecruiters, createdByUserId].filter(id => id && !isNaN(id)));

        // Batch insert assigned recruiters into dbo.RoleRecruiters
        if (recruitersSet.size > 0) {
          const recruitersJson = JSON.stringify(Array.from(recruitersSet).map(id => ({ UserID: id })));
          const recReq = new sql.Request(transaction);
          recReq.input('RoleID', sql.Int, newRoleId);
          recReq.input('RecruitersJson', sql.NVarChar(sql.MAX), recruitersJson);

          await recReq.query(`
            INSERT INTO dbo.RoleRecruiters (RoleID, UserID)
            SELECT @RoleID, JSON_VALUE(val.value, '$.UserID')
            FROM OPENJSON(@RecruitersJson) val
            WHERE NOT EXISTS (
              SELECT 1 FROM dbo.RoleRecruiters 
              WHERE RoleID = @RoleID AND UserID = JSON_VALUE(val.value, '$.UserID')
            );
          `);
        }

        await transaction.commit();
        return sendJson(201, { success: true, roleId: newRoleId, message: "Role successfully created." });

      } catch (txnErr) {
        await transaction.rollback();
        context.log.error("Transaction error creating role:", txnErr.message);
        return sendJson(500, { error: `Database error: ${txnErr.message}` });
      }
    }

    return sendJson(405, { error: "Method not allowed" });

  } catch (err) {
    context.log.error("Error in /api/roles:", err.message);
    return sendJson(500, { error: `Server error: ${err.message}` });
  }
};