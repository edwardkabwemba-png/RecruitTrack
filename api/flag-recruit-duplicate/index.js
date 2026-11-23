const sql = require('mssql');

module.exports = async function (context, req) {
  context.res = { headers: { 'Content-Type': 'application/json' } };

  try {
    const { recruitId, notes } = req.body || {};
    const userId = req.headers['x-user-id'] || req.body?.userId;

    if (!recruitId || !userId) {
      context.res.status = 400;
      context.res.body = JSON.stringify({ error: "recruitId and valid user authentication are required." });
      return;
    }

    const pool = await sql.connect(process.env.SqlConnectionString || process.env.DATABASE_URL);

    await pool.request()
      .input('CandidateID_A', sql.Int, recruitId)
      .input('CandidateID_B', sql.Int, recruitId)
      .input('MatchReason', sql.NVarChar(100), notes ? `Manual Flag: ${notes}` : 'Manual Recruiter Flag')
      .input('FlaggedByUserID', sql.Int, userId)
      .query(`
        INSERT INTO dbo.DuplicateReviewQueue (CandidateID_A, CandidateID_B, MatchReason, FlaggedByUserID, Status)
        VALUES (@CandidateID_A, @CandidateID_B, @MatchReason, @FlaggedByUserID, 'Pending');
      `);

    context.res.status = 200;
    context.res.body = JSON.stringify({ success: true, message: "Candidate successfully flagged for Admin Duplicate Review." });
  } catch (err) {
    context.log.error("Error flagging recruit duplicate:", err.message);
    context.res.status = 500;
    context.res.body = JSON.stringify({ error: err.message });
  }
};