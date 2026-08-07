const sql = require('mssql');
const crypto = require('crypto');

// Helper function to hash input using SHA-256
function hashPasswordSHA256(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

module.exports = async function (context, req) {
  context.res = { headers: { 'Content-Type': 'application/json' } };

  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      context.res.status = 400;
      context.res.body = JSON.stringify({ message: "Email and password are required." });
      return;
    }

    const connectionString = process.env.SqlConnectionString;
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

    // Hash the incoming plain-text password using SHA-256
    const inputHash = hashPasswordSHA256(password);

    // Compare the generated hex string directly against the stored SQL value
    if (inputHash.toLowerCase() !== user.PasswordHash.toLowerCase()) {
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
    context.res.status = 500;
    context.res.body = JSON.stringify({ message: "Server error", error: error.message });
  }
};