const sql = require('mssql');

module.exports = async function (context, req) {
  context.res = { headers: { 'Content-Type': 'application/json' } };

  try {
    const connectionString = process.env.SqlConnectionString || process.env.DATABASE_URL;
    const pool = await sql.connect(connectionString);

    // =========================================================================
    // GET: List roles with recruiter initials, IDs, and candidate counts
    // =========================================================================
    if (req.method === 'GET') {
      const search = req.query.search || '';
      const status = req.query.status || '';
      const myRoles = req.query.myRoles === 'true';
      const activeUserId = req.headers['x-user-id'] || req.query.userId;

      let whereClauses = [];
      if (search) {
        whereClauses.push(`(p.PositionTitle LIKE '%${search}%' OR c.ClientName LIKE '%${search}%')`);
      }
      if (status) {
        whereClauses.push(`r.Status = '${status}'`);
      }
      if (myRoles && activeUserId) {
        whereClauses.push(`r.RoleID IN (SELECT RoleID FROM dbo.RoleRecruiters WHERE UserID = ${parseInt(activeUserId)})`);
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

      const result = await pool.request().query(query);
      context.res.status = 200;
      context.res.body = JSON.stringify(result.recordset);
      return;
    }

    // =========================================================================
    // POST: Create New Role (Matches dbo.Roles & dbo.RoleRecruiters schemas)
    // =========================================================================
    if (req.method === 'POST') {
      const body = req.body || {};
      const createdByUserId = req.headers['x-user-id'] || body.userId;

      const positionId = parseInt(body.positionId || body.PositionID);
      const clientId = parseInt(body.clientId || body.ClientID);

      if (!positionId || !clientId) {
        context.res.status = 400;
        context.res.body = JSON.stringify({ error: "Position and Client are required fields." });
        return;
      }

      if (!createdByUserId) {
        context.res.status = 400;
        context.res.body = JSON.stringify({ error: "CreatedByUserID (x-user-id header) is required." });
        return;
      }

      const transaction = new sql.Transaction(pool);
      await transaction.begin();

      try {
        const request = new sql.Request(transaction);

        // Required NOT NULL columns from dbo.Roles schema
        request.input('PositionID', sql.Int, positionId);
        request.input('ClientID', sql.Int, clientId);
        request.input('SeniorityLevel', sql.NVarChar(100), body.seniority || 'Mid-Level');
        request.input('MinEducation', sql.NVarChar(100), body.education || 'Bachelors Degree');
        request.input('MinYearsExperience', sql.Int, body.minExperience ? parseInt(body.minExperience) : 0);
        request.input('Status', sql.NVarChar(50), 'Active');
        request.input('CreatedByUserID', sql.Int, parseInt(createdByUserId));

        // Optional NULL columns from dbo.Roles schema
        request.input('FieldOfStudy', sql.NVarChar(150), body.fieldOfStudy || null);
        request.input('Location', sql.NVarChar(150), body.location || null);
        request.input('WorkModel', sql.NVarChar(50), body.workModel || 'Hybrid');
        request.input('RateBudgetMin', sql.Decimal(18, 2), body.rateMin ? parseFloat(body.rateMin) : null);
        request.input('RateBudgetMax', sql.Decimal(18, 2), body.rateMax ? parseFloat(body.rateMax) : null);

        const insertRoleQuery = `
          INSERT INTO dbo.Roles (
            PositionID, 
            ClientID, 
            SeniorityLevel, 
            MinEducation, 
            FieldOfStudy, 
            MinYearsExperience, 
            Location, 
            WorkModel, 
            RateBudgetMin, 
            RateBudgetMax, 
            Status, 
            CreatedByUserID, 
            CreatedDate
          )
          OUTPUT INSERTED.RoleID
          VALUES (
            @PositionID, 
            @ClientID, 
            @SeniorityLevel, 
            @MinEducation, 
            @FieldOfStudy, 
            @MinYearsExperience, 
            @Location, 
            @WorkModel, 
            @RateBudgetMin, 
            @RateBudgetMax, 
            @Status, 
            @CreatedByUserID, 
            GETDATE()
          );
        `;

        const roleRes = await request.query(insertRoleQuery);
        const newRoleId = roleRes.recordset[0].RoleID;

        // Insert into dbo.RoleRecruiters (RoleID, UserID)[cite: 7]
        let recruitersList = Array.isArray(body.recruiters) ? body.recruiters.map(Number) : [];
        const creatorIdNum = parseInt(createdByUserId);

        if (!recruitersList.includes(creatorIdNum)) {
          recruitersList.push(creatorIdNum);
        }

        for (const uId of recruitersList) {
          if (!uId || isNaN(uId)) continue;
          
          const recReq = new sql.Request(transaction);
          recReq.input('RoleID', sql.Int, newRoleId);
          recReq.input('UserID', sql.Int, uId);
          
          await recReq.query(`
            IF NOT EXISTS (SELECT 1 FROM dbo.RoleRecruiters WHERE RoleID = @RoleID AND UserID = @UserID)
            BEGIN
              INSERT INTO dbo.RoleRecruiters (RoleID, UserID) VALUES (@RoleID, @UserID);
            END
          `);
        }

        await transaction.commit();

        context.res.status = 201;
        context.res.body = JSON.stringify({ 
          success: true, 
          roleId: newRoleId, 
          message: "Role successfully created." 
        });
        return;

      } catch (txnErr) {
        await transaction.rollback();
        context.log.error("Transaction error creating role:", txnErr.message);
        context.res.status = 500;
        context.res.body = JSON.stringify({ error: `Database error: ${txnErr.message}` });
        return;
      }
    }

    context.res.status = 405;
    context.res.body = JSON.stringify({ error: "Method not allowed" });

  } catch (err) {
    context.log.error("Error in /api/roles:", err.message);
    context.res.status = 500;
    context.res.body = JSON.stringify({ error: `Server error: ${err.message}` });
  }
};