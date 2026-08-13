const sql = require('mssql');

module.exports = async function (context, req) {
  context.res = { headers: { 'Content-Type': 'application/json' } };

  try {
    const pool = await sql.connect(process.env.SqlConnectionString);

    // GET Request: Retrieve all sources
    if (req.method === 'GET') {
      const result = await pool.request().query(`
        SELECT SourceID, SourceName 
        FROM dbo.Sources 
        ORDER BY SourceName ASC
      `);
      
      context.res.status = 200;
      context.res.body = JSON.stringify(result.recordset || []);
      return;
    }

    // POST Request: Insert a new source
    if (req.method === 'POST') {
      const { SourceName, sourceName } = req.body || {};
      const nameToSave = (SourceName || sourceName || '').trim();

      // Required Field Validation
      if (!nameToSave) {
        context.res.status = 400;
        context.res.body = JSON.stringify({ message: "SourceName is required and cannot be empty." });
        return;
      }

      await pool.request()
        .input('SourceName', sql.NVarChar(150), nameToSave)
        .query(`
          INSERT INTO dbo.Sources (SourceName) 
          VALUES (@SourceName)
        `);

      context.res.status = 201;
      context.res.body = JSON.stringify({ message: "Source added successfully." });
      return;
    }

    // Fallback for unsupported methods
    context.res.status = 405;
    context.res.body = JSON.stringify({ message: "Method Not Allowed" });

  } catch (error) {
    context.log.error("Sources API Error:", error);
    context.res.status = 500;
    context.res.body = JSON.stringify({ message: "Server error", error: error.message });
  }
};