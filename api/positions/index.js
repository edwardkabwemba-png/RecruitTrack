const sql = require('mssql');

module.exports = async function (context, req) {
  context.res = { headers: { 'Content-Type': 'application/json' } };

  try {
    const pool = await sql.connect(process.env.SqlConnectionString);

    if (req.method === 'GET') {
      const result = await pool.request().query(`
        SELECT PositionID, PositionTitle, IsActive FROM dbo.Positions ORDER BY PositionTitle ASC
      `);
      context.res.status = 200;
      context.res.body = JSON.stringify(result.recordset || []);
      return;
    }

    if (req.method === 'POST') {
      const { positionTitle } = req.body || {};
      if (!positionTitle) {
        context.res.status = 400;
        context.res.body = JSON.stringify({ message: "Position Title is required." });
        return;
      }

      await pool.request()
        .input('PositionTitle', sql.NVarChar(150), positionTitle)
        .query(`INSERT INTO dbo.Positions (PositionTitle, IsActive) VALUES (@PositionTitle, 1)`);

      context.res.status = 201;
      context.res.body = JSON.stringify({ message: "Position added successfully." });
      return;
    }
  } catch (error) {
    context.res.status = 500;
    context.res.body = JSON.stringify({ message: error.message });
  }
};