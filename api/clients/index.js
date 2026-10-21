const sql = require('mssql');

// GET /api/clients
app.get('/api/clients', async (req, res) => {
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

    res.status(200).json(result.recordset);
  } catch (err) {
    console.error("SQL Error fetching clients:", err);
    res.status(500).json({ 
      error: err.message || "Failed to fetch clients from database." 
    });
  }
});

// POST /api/clients
app.post('/api/clients', async (req, res) => {
  const { clientName, ClientName, industry, Industry } = req.body;
  
  // Safely extract parameter values from various frontend payload keys
  const nameVal = (ClientName || clientName || '').trim();
  const industryVal = (Industry || industry || '').trim() || null;

  if (!nameVal) {
    return res.status(400).json({ error: 'ClientName is required.' });
  }

  try {
    const request = pool.request();
    request.input('ClientName', sql.NVarChar(150), nameVal);
    request.input('Industry', sql.NVarChar(150), industryVal);
    request.input('IsActive', sql.Bit, 1); // Default new clients to active (True)

    const insertResult = await request.query(`
      INSERT INTO dbo.Clients (ClientName, Industry, IsActive)
      VALUES (@ClientName, @Industry, @IsActive);
      
      SELECT SCOPE_IDENTITY() AS ClientID;
    `);

    const newClientId = insertResult.recordset && insertResult.recordset[0] 
      ? insertResult.recordset[0].ClientID 
      : null;

    res.status(201).json({ 
      success: true, 
      ClientID: newClientId,
      ClientName: nameVal,
      Industry: industryVal || '',
      IsActive: true
    });
  } catch (err) {
    console.error("SQL Error inserting client:", err);
    res.status(500).json({ 
      error: err.message || "Failed to insert new client into database." 
    });
  }
});