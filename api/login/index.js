const sql = require('mssql');
const bcrypt = require('bcryptjs');

module.exports = async function (context, req) {
  const { email, password } = req.body || {};

  if (!email || !password) {
    context.res = {
      status: 400,
      body: { message: "Email and password are required." }
    };
    return;
  }

  const connectionString = process.env.SqlConnectionString;

  try {
    const pool = await sql.connect(connectionString);
    const result = await pool.request()
      .input('Email', sql.VarChar, email)
      .query('SELECT UserID, Email, PasswordHash, FullName FROM Users WHERE Email = @Email');

    if (result.recordset.length === 0) {
      context.res = {
        status: 401,
        body: { message: "Invalid email or password." }
      };
      return;
    }

    const user = result.recordset[0];
    const passwordMatches = await bcrypt.compare(password, user.PasswordHash);

    if (!passwordMatches) {
      context.res = {
        status: 401,
        body: { message: "Invalid email or password." }
      };
      return;
    }

    context.res = {
  status: 200,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ message: "Login successful" })
};
  } catch (error) {
    context.log('Database error:', error);
    context.res = {
      status: 500,
      body: { message: "Internal server error." }
    };
  }
};