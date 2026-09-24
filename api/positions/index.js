const sql = require('mssql');

module.exports = async function (context, req) {
  context.res = { headers: { 'Content-Type': 'application/json' } };

  try {
    const pool = await sql.connect(process.env.SqlConnectionString);

    if (req.method === 'GET') {
      const result = await pool.request().query(`
        SELECT PositionID, PositionTitle, Classification, IsActive 
        FROM dbo.Positions 
        ORDER BY PositionTitle ASC
      `);
      context.res.status = 200;
      context.res.body = JSON.stringify(result.recordset || []);
      return;
    }

    if (req.method === 'POST') {
      const { positionTitle, classification } = req.body || {};

      if (!positionTitle || !classification) {
        context.res.status = 400;
        context.res.body = JSON.stringify({ message: "Position Title and Classification are required." });
        return;
      }

      await pool.request()
        .input('PositionTitle', sql.NVarChar(150), positionTitle)
        .input('Classification', sql.NVarChar(100), classification)
        .query(`
          INSERT INTO dbo.Positions (PositionTitle, Classification, IsActive) 
          VALUES (@PositionTitle, @Classification, 1)
        `);

      context.res.status = 201;
      context.res.body = JSON.stringify({ message: "Position added successfully." });
      return;
    }
  } catch (error) {
    context.res.status = 500;
    context.res.body = JSON.stringify({ message: error.message });
  }
};