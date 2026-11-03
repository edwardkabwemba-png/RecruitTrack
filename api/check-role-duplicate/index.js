const sql = require('mssql');

module.exports = async function (context, req) {
  context.res = { headers: { 'Content-Type': 'application/json' } };

  try {
    const rawPosId = req.query.positionId || req.body?.positionId;
    const rawClientId = req.query.clientId || req.body?.clientId;

    const positionId = parseInt(rawPosId, 10);
    const clientId = parseInt(rawClientId, 10);

    if (isNaN(positionId) || isNaN(clientId)) {
      context.res.status = 200;
      context.res.body = JSON.stringify({ exists: false });
      return;
    }

    const connectionString = process.env.SqlConnectionString || process.env.DATABASE_URL;
    const pool = await sql.connect(connectionString);

    const query = `
      SELECT TOP 1 
        r.RoleID,
        p.PositionTitle,
        c.ClientName,
        ISNULL(u.FullName, 'Recruiter') AS CreatorName,
        r.CreatedDate
      FROM dbo.Roles r
      LEFT JOIN dbo.Positions p ON r.PositionID = p.PositionID
      LEFT JOIN dbo.Clients c ON r.ClientID = c.ClientID
      LEFT JOIN dbo.Users u ON r.CreatedByUserID = u.UserID
      WHERE r.PositionID = @PositionID 
        AND r.ClientID = @ClientID 
        AND ISNULL(r.Status, 'Active') != 'Closed'
      ORDER BY r.RoleID DESC;
    `;

    const result = await pool.request()
      .input('PositionID', sql.Int, positionId)
      .input('ClientID', sql.Int, clientId)
      .query(query);

    if (result.recordset && result.recordset.length > 0) {
      const match = result.recordset[0];
      const createdDateStr = match.CreatedDate 
        ? new Date(match.CreatedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        : 'Recently';

      context.res.status = 200;
      context.res.body = JSON.stringify({
        exists: true,
        duplicateRole: {
          roleId: match.RoleID,
          positionTitle: match.PositionTitle || 'Position',
          clientName: match.ClientName || 'Client',
          creatorName: match.CreatorName,
          createdDate: createdDateStr
        }
      });
      return;
    }

    context.res.status = 200;
    context.res.body = JSON.stringify({ exists: false });

  } catch (err) {
    context.log.error("Error in check-role-duplicate:", err.message);
    context.res.status = 500;
    context.res.body = JSON.stringify({ error: err.message });
  }
};