const sql = require('mssql');

module.exports = async function (context, req) {
  context.res = { headers: { 'Content-Type': 'application/json' } };

  try {
    const pool = await sql.connect(process.env.SqlConnectionString);

    // GET ALL CERTIFICATIONS
    if (req.method === 'GET') {
      const result = await pool.request().query(`
        SELECT 
          CertID,
          CertName, 
          ISNULL(Issuer, 'N/A') AS Issuer,
          ISNULL(Category, 'General') AS Category 
        FROM dbo.CertificationLibrary 
        ORDER BY CertName ASC
      `);
      
      context.res.status = 200;
      context.res.body = JSON.stringify(result.recordset || []);
      return;
    }

    // POST NEW CERTIFICATION
    if (req.method === 'POST') {
      const { certName, issuer, category } = req.body || {};

      if (!certName) {
        context.res.status = 400;
        context.res.body = JSON.stringify({ message: "Certification Name is required." });
        return;
      }

      await pool.request()
        .input('CertName', sql.NVarChar(150), certName)
        .input('Issuer', sql.NVarChar(150), issuer || 'N/A')
        .input('Category', sql.NVarChar(100), category || 'General')
        .query(`
          INSERT INTO dbo.CertificationLibrary (CertName, Issuer, Category) 
          VALUES (@CertName, @Issuer, @Category)
        `);

      context.res.status = 201;
      context.res.body = JSON.stringify({ message: "Certification added successfully." });
      return;
    }

  } catch (error) {
    context.log.error("Certifications API Error:", error);
    context.res.status = 500;
    context.res.body = JSON.stringify({ message: "Server error", error: error.message });
  }
};