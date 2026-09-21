const sql = require('mssql');
const bcrypt = require('bcryptjs');

module.exports = async function (context, req) {
  context.res = { headers: { 'Content-Type': 'application/json' } };

  try {
    const pool = await sql.connect(process.env.SqlConnectionString);

    if (req.method === 'GET') {
      const result = await pool.request().query(`
        SELECT 
          UserID, 
          FullName, 
          Email, 
          ISNULL(Role, 'Recruiter') AS Role, 
          ISNULL(AvatarInitials, 'U') AS AvatarInitials, 
          ISNULL(IsActive, 1) AS IsActive 
        FROM dbo.Users 
        ORDER BY UserID DESC
      `);
      
      context.res.status = 200;
      context.res.body = JSON.stringify(result.recordset || []);
      return;
    }

    if (req.method === 'POST') {
      const { fullName, email, role, password } = req.body || {};

      // Validate required fields including password
      if (!fullName || !email || !password) {
        context.res.status = 400;
        context.res.body = JSON.stringify({ message: "Full Name, Email, and Password are required." });
        return;
      }

      // Hash the password securely (10 salt rounds)
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      // Generate initials from Full Name
      const initials = fullName
        .split(' ')
        .filter(n => n)
        .map(n => n[0].toUpperCase())
        .slice(0, 2)
        .join('');

      // Insert user record into DB
      await pool.request()
        .input('FullName', sql.NVarChar(100), fullName)
        .input('Email', sql.NVarChar(150), email)
        .input('PasswordHash', sql.NVarChar(255), passwordHash)
        .input('Role', sql.NVarChar(50), role || 'Recruiter')
        .input('AvatarInitials', sql.NVarChar(5), initials)
        .input('IsActive', sql.Bit, 1)
        .query(`
          INSERT INTO dbo.Users (FullName, Email, PasswordHash, Role, AvatarInitials, IsActive)
          VALUES (@FullName, @Email, @PasswordHash, @Role, @AvatarInitials, @IsActive)
        `);

      context.res.status = 201;
      context.res.body = JSON.stringify({ message: "User created successfully." });
      return;
    }

  } catch (error) {
    context.log.error("Users API Error:", error);
    context.res.status = 500;
    context.res.body = JSON.stringify({ message: "Server error", error: error.message });
  }
};