const sql = require('mssql');

module.exports = async function (context, req) {
  context.res = { headers: { 'Content-Type': 'application/json' } };

  try {
    const pool = await sql.connect(process.env.SqlConnectionString);

    // GET ROLES
    if (req.method === 'GET') {
      const { positionId, clientId } = req.query;

      let query = `
        SELECT 
          r.RoleID, r.PositionID, r.ClientID, r.SeniorityLevel, r.MinEducation, 
          r.FieldOfStudy, r.MinYearsExperience, r.Location, r.WorkModel, 
          r.RateBudgetMin, r.RateBudgetMax, r.Status, r.CreatedByUserID, r.CreatedDate,
          p.PositionTitle, c.ClientName
        FROM dbo.Roles r
        LEFT JOIN dbo.Positions p ON r.PositionID = p.PositionID
        LEFT JOIN dbo.Clients c ON r.ClientID = c.ClientID
      `;

      if (positionId && clientId) {
        query += ` WHERE r.PositionID = @PositionID AND r.ClientID = @ClientID`;
      }

      const request = pool.request();
      if (positionId && clientId) {
        request.input('PositionID', sql.Int, positionId);
        request.input('ClientID', sql.Int, clientId);
      }

      const result = await request.query(query);
      context.res.status = 200;
      context.res.body = JSON.stringify(result.recordset || []);
      return;
    }

    // POST NEW ROLE
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

      const result = await pool.request()
        .input('PositionID', sql.Int, parseInt(positionId))
        .input('ClientID', sql.Int, parseInt(clientId))
        .input('SeniorityLevel', sql.NVarChar(100), seniority || 'Mid')
        .input('MinEducation', sql.NVarChar(100), education || 'None')
        .input('FieldOfStudy', sql.NVarChar(150), fieldOfStudy || null)
        .input('MinYearsExperience', sql.Int, minExperience ? parseInt(minExperience) : 0)
        .input('Location', sql.NVarChar(150), location || null)
        .input('WorkModel', sql.NVarChar(50), workModel || 'Hybrid')
        .input('RateBudgetMin', sql.Decimal(18, 2), rateMin ? parseFloat(rateMin) : null)
        .input('RateBudgetMax', sql.Decimal(18, 2), rateMax ? parseFloat(rateMax) : null)
        .input('Status', sql.NVarChar(50), 'Active')
        .input('CreatedByUserID', sql.Int, createdByUserId ? parseInt(createdByUserId) : 1)
        .input('CreatedDate', sql.DateTime, new Date())
        .query(`
          INSERT INTO dbo.Roles 
            (PositionID, ClientID, SeniorityLevel, MinEducation, FieldOfStudy, MinYearsExperience, Location, WorkModel, RateBudgetMin, RateBudgetMax, Status, CreatedByUserID, CreatedDate)
          OUTPUT INSERTED.RoleID
          VALUES 
            (@PositionID, @ClientID, @SeniorityLevel, @MinEducation, @FieldOfStudy, @MinYearsExperience, @Location, @WorkModel, @RateBudgetMin, @RateBudgetMax, @Status, @CreatedByUserID, @CreatedDate)
        `);

      const newRoleId = result.recordset[0].RoleID;

      context.res.status = 201;
      context.res.body = JSON.stringify({ message: "Role created successfully", roleId: newRoleId });
      return;
    }

  } catch (error) {
    context.log.error("Roles API Error:", error);
    context.res.status = 500;
    context.res.body = JSON.stringify({ message: "Server error", error: error.message });
  }
};