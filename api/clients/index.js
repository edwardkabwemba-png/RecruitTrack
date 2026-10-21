const sql = require('mssql');

module.exports = async function (context, req) {
  context.log('HTTP trigger function processing request for /api/clients');

  // Verify connection string exists in Azure Application Settings
  const connectionString = process.env.SqlConnectionString || process.env.DATABASE_URL;
  if (!connectionString) {
    context.log.error('CRITICAL: SqlConnectionString is missing from Azure Application Settings.');
    context.res = {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Database connection string configuration is missing on the server.' })
    };
    return;
  }

  let pool;
  try {
    pool = await sql.connect(connectionString);
  } catch (connErr) {
    context.log.error('CRITICAL: SQL Connection failed:', connErr.message);
    context.res = {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to connect to Azure SQL Database.', details: connErr.message })
    };
    return;
  }

  // ==========================================
  // GET METHOD — Fetch Clients
  // ==========================================
  if (req.method === 'GET') {
    try {
      const result = await pool.request().query(`
        SELECT 
          ClientID,
          ISNULL(ClientName, '') AS ClientName,
          ISNULL(Industry, '') AS Industry,
          CASE WHEN IsActive = 1 OR IsActive IS NULL THEN 1 ELSE 0 END AS IsActive
        FROM dbo.Clients
        WHERE IsActive = 1 OR IsActive IS NULL
        ORDER BY ClientName ASC
      `);

      context.res = {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result.recordset || [])
      };
    } catch (err) {
      context.log.error('Error executing GET query on dbo.Clients:', err.message);
      context.res = {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Database query failed.', details: err.message })
      };
    }
  }

  // ==========================================
  // POST METHOD — Insert New Client
  // ==========================================
  else if (req.method === 'POST') {
    try {
      const body = req.body || {};
      const nameVal = String(body.ClientName || body.clientName || '').trim();
      const industryVal = String(body.Industry || body.industry || '').trim() || null;

      if (!nameVal) {
        context.res = {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'ClientName is required.' })
        };
        return;
      }

      const request = pool.request();
      request.input('ClientName', sql.NVarChar(150), nameVal);
      request.input('Industry', sql.NVarChar(150), industryVal);
      request.input('IsActive', sql.Bit, 1);

      const insertResult = await request.query(`
        INSERT INTO dbo.Clients (ClientName, Industry, IsActive)
        VALUES (@ClientName, @Industry, @IsActive);
        
        SELECT SCOPE_IDENTITY() AS ClientID;
      `);

      const newClientId = insertResult.recordset && insertResult.recordset[0] 
        ? insertResult.recordset[0].ClientID 
        : null;

      context.res = {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          success: true, 
          ClientID: newClientId,
          ClientName: nameVal,
          Industry: industryVal || '',
          IsActive: 1
        })
      };
    } catch (err) {
      context.log.error('Error executing POST insert on dbo.Clients:', err.message);
      context.res = {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Failed to insert client.', details: err.message })
      };
    }
  }
};