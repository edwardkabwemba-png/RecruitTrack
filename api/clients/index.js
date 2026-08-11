const sql = require('mssql');

module.exports = async function (context, req) {
  context.res = { headers: { 'Content-Type': 'application/json' } };

  try {
    const pool = await sql.connect(process.env.SqlConnectionString);

    if (req.method === 'GET') {
      const result = await pool.request().query(`
        SELECT ClientID, ClientName, IsActive FROM dbo.Clients ORDER BY ClientName ASC
      `);
      context.res.status = 200;
      context.res.body = JSON.stringify(result.recordset || []);
      return;
    }

    if (req.method === 'POST') {
      const { clientName } = req.body || {};
      if (!clientName) {
        context.res.status = 400;
        context.res.body = JSON.stringify({ message: "Client Name is required." });
        return;
      }

      await pool.request()
        .input('ClientName', sql.NVarChar(150), clientName)
        .query(`INSERT INTO dbo.Clients (ClientName, IsActive) VALUES (@ClientName, 1)`);

      context.res.status = 201;
      context.res.body = JSON.stringify({ message: "Client added successfully." });
      return;
    }
  } catch (error) {
    context.res.status = 500;
    context.res.body = JSON.stringify({ message: error.message });
  }
};