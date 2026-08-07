const sql = require('mssql');
const bcrypt = require('bcryptjs');

module.exports = async function (context, req) {
  // Ensure default JSON headers
  context.res = {
    headers: { 'Content-Type': 'application/json' },
    body: ''
  };

  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      context.res.status = 400;
      context.res.body = JSON.stringify({ message: "Email and password are required." });
      return;
    }

    const connectionString = process.env.SqlConnectionString;
    if (!connectionString) {
      context.res.status = 500;
      context.res.body = JSON.stringify({ message: "Database connection string is missing." });
      return;
    }

    const pool = await sql.connect(connectionString);
    const result = await pool.request()
      .input('Email', sql.VarChar, email)
      .query('SELECT UserID, Email, PasswordHash, FullName FROM Users WHERE Email = @Email');

    if (result.recordset.length === 0) {
      context.res.status = 401;
      context.res.body = JSON.stringify({ message: "Invalid email or password." });
      return;
    }

    const user = result.recordset[0];
    const match = await bcrypt.compare(password, user.PasswordHash);

    if (!match) {
      context.res.status = 401;
      context.res.body = JSON.stringify({ message: "Invalid email or password." });
      return;
    }

    context.res.status = 200;
    context.res.body = JSON.stringify({
      message: "Login successful",
      user: { id: user.UserID, email: user.Email, name: user.FullName }
    });

  } catch (error) {
    context.log.error("Login execution error:", error.message);
    context.res.status = 500;
    context.res.body = JSON.stringify({ message: "Server error during authentication.", error: error.message });
  }
};