const sql = require('mssql');
const bcrypt = require('bcryptjs');

module.exports = async function (context, req) {
  context.res = {
    headers: { 'Content-Type': 'application/json' }
  };

  try {
    const { email, password } = req.body || {};

    // LOG TO AZURE STREAMING LOGS
    context.log("Received raw body in backend:", JSON.stringify(req.body));

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
      context.res.body = JSON.stringify({ 
        message: "Invalid email or password.",
        receivedJson: req.body // ECHO RECEIVED JSON
      });
      return;
    }

    const user = result.recordset[0];
    const match = await bcrypt.compare(password, user.PasswordHash);

    if (!match) {
      context.res.status = 401;
      context.res.body = JSON.stringify({ 
        message: "Invalid email or password.",
        receivedJson: {
          email: email,
          passwordReceivedLength: password ? password.length : 0
        },
        databaseRecord: {
          emailInDb: user.Email,
          hashLengthInDb: user.PasswordHash ? user.PasswordHash.length : 0
        }
      });
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