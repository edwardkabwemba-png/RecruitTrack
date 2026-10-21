// GET /api/clients
app.get('/api/clients', async (req, res) => {
  try {
    const result = await pool.request().query(`
      SELECT ClientID, ClientName, Industry, ISNULL(IsActive, 1) AS IsActive
      FROM dbo.Clients
      WHERE IsActive = 1 OR IsActive IS NULL
      ORDER BY ClientName ASC
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error("SQL Error fetching clients:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/clients
app.post('/api/clients', async (req, res) => {
  const { clientName, ClientName, industry, Industry } = req.body;
  const nameVal = (ClientName || clientName || '').trim();
  const industryVal = (Industry || industry || '').trim() || null;

  if (!nameVal) {
    return res.status(400).json({ error: 'ClientName is required.' });
  }

  try {
    const request = pool.request();
    request.input('ClientName', sql.NVarChar, nameVal);
    request.input('Industry', sql.NVarChar, industryVal);
    request.input('IsActive', sql.Bit, 1); // Automatically set IsActive to True

    const insertResult = await request.query(`
      INSERT INTO dbo.Clients (ClientName, Industry, IsActive)
      VALUES (@ClientName, @Industry, @IsActive);
      
      SELECT SCOPE_IDENTITY() AS ClientID;
    `);

    res.status(201).json({ 
      success: true, 
      ClientID: insertResult.recordset[0].ClientID,
      ClientName: nameVal,
      Industry: industryVal,
      IsActive: true
    });
  } catch (err) {
    console.error("SQL Error inserting client:", err);
    res.status(500).json({ error: err.message });
  }
});