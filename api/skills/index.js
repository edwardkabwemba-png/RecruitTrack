const sql = require('mssql');

module.exports = async function (context, req) {
  context.res = { headers: { 'Content-Type': 'application/json' } };

  try {
    const pool = await sql.connect(process.env.SqlConnectionString);

    // GET Request: Retrieve all skills from SkillLibrary
    if (req.method === 'GET') {
      const result = await pool.request().query(`
        SELECT SkillID, SkillName, Category 
        FROM dbo.SkillLibrary 
        ORDER BY SkillName ASC
      `);
      context.res.status = 200;
      context.res.body = JSON.stringify(result.recordset || []);
      return;
    }

    // POST Request: Insert a new skill
    if (req.method === 'POST') {
      const { skillName, category } = req.body || {};

      if (!skillName) {
        context.res.status = 400;
        context.res.body = JSON.stringify({ message: "Skill Name is required." });
        return;
      }

      await pool.request()
        .input('SkillName', sql.NVarChar(150), skillName)
        .input('Category', sql.NVarChar(100), category || 'General')
        .query(`
          INSERT INTO dbo.SkillLibrary (SkillName, Category) 
          VALUES (@SkillName, @Category)
        `);

      context.res.status = 201;
      context.res.body = JSON.stringify({ message: "Skill added successfully." });
      return;
    }

  } catch (error) {
    context.log.error("Skills API Error:", error);
    context.res.status = 500;
    context.res.body = JSON.stringify({ message: "Server error", error: error.message });
  }
};