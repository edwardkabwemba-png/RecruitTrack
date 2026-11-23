const sql = require('mssql');

module.exports = async function (context, req) {
  context.res = { headers: { 'Content-Type': 'application/json' } };

  try {
    const email = (req.query.email || req.body?.email || '').trim().toLowerCase();
    const phoneRaw = (req.query.phone || req.body?.phone || '').replace(/\D/g, ''); // Strip formatting
    const firstName = (req.query.firstName || req.body?.firstName || '').trim();
    const surname = (req.query.surname || req.body?.surname || '').trim();
    const idType = (req.query.idType || req.body?.idType || '').trim();
    const idNumber = (req.query.idNumber || req.body?.idNumber || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const currentRecruitId = req.query.recruitId || req.body?.recruitId || 0;

    const pool = await sql.connect(process.env.SqlConnectionString || process.env.DATABASE_URL);

    // =========================================================================
    // TIER 1: High Confidence Match (Email OR Contact Number)
    // =========================================================================
    if (email || phoneRaw) {
      let tier1Query = `
        SELECT TOP 1 
          r.RecruitID,
          r.FirstName,
          r.Surname,
          r.Email,
          r.ContactNumber,
          ISNULL(u.FullName, 'Recruiter') AS LastRecruiter,
          a.DateSourced,
          p.PositionTitle,
          c.ClientName,
          CASE 
            WHEN LOWER(LTRIM(RTRIM(r.Email))) = @Email THEN 'Email matches an existing record'
            ELSE 'Contact Number matches an existing record'
          END AS MatchReason
        FROM dbo.Recruits r
        LEFT JOIN dbo.Applications a ON r.RecruitID = a.RecruitID
        LEFT JOIN dbo.Roles ro ON a.RoleID = ro.RoleID
        LEFT JOIN dbo.Positions p ON ro.PositionID = p.PositionID
        LEFT JOIN dbo.Clients c ON ro.ClientID = c.ClientID
        LEFT JOIN dbo.Users u ON a.RecruiterUserID = u.UserID
        WHERE r.RecruitID != @CurrentRecruitID
          AND (
            (@Email != '' AND LOWER(LTRIM(RTRIM(r.Email))) = @Email)
            OR
            (@PhoneRaw != '' AND REPLACE(REPLACE(REPLACE(REPLACE(r.ContactNumber, ' ', ''), '-', ''), '+', ''), '(', '') = @PhoneRaw)
          )
        ORDER BY a.DateSourced DESC, r.RecruitID DESC;
      `;

      const t1Res = await pool.request()
        .input('Email', sql.NVarChar(150), email)
        .input('PhoneRaw', sql.NVarChar(50), phoneRaw)
        .input('CurrentRecruitID', sql.Int, currentRecruitId)
        .query(tier1Query);

      if (t1Res.recordset.length > 0) {
        const m = t1Res.recordset[0];
        const dateStr = m.DateSourced 
          ? new Date(m.DateSourced).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
          : 'N/A';

        context.res.status = 200;
        context.res.body = JSON.stringify({
          matchType: 'HIGH_CONFIDENCE', // Blocking Banner (Figure 6)
          matchReason: m.MatchReason,
          candidate: {
            recruitId: m.RecruitID,
            formattedId: `CID-${String(m.RecruitID).padStart(5, '0')}`,
            fullName: `${m.FirstName} ${m.Surname}`,
            lastRecruiter: m.LastRecruiter,
            lastDate: dateStr,
            lastRole: m.PositionTitle ? `${m.PositionTitle} @ ${m.ClientName || ''}` : 'Unassigned'
          }
        });
        return;
      }
    }

    // =========================================================================
    // TIER 2: Soft Non-Blocking Match (First Name + Surname alone)
    // =========================================================================
    if (firstName && surname) {
      const t2Res = await pool.request()
        .input('FirstName', sql.NVarChar(100), firstName)
        .input('Surname', sql.NVarChar(100), surname)
        .input('CurrentRecruitID', sql.Int, currentRecruitId)
        .query(`
          SELECT TOP 1 RecruitID, FirstName, Surname 
          FROM dbo.Recruits 
          WHERE LOWER(LTRIM(RTRIM(FirstName))) = LOWER(@FirstName) 
            AND LOWER(LTRIM(RTRIM(Surname))) = LOWER(@Surname)
            AND RecruitID != @CurrentRecruitID
        `);

      if (t2Res.recordset.length > 0) {
        context.res.status = 200;
        context.res.body = JSON.stringify({
          matchType: 'SOFT_WARNING', // Non-blocking hint
          message: `Possible match: A candidate named "${firstName} ${surname}" already exists in the system. Please verify details.`
        });
        return;
      }
    }

    // =========================================================================
    // TIER 3: ID Number Reconciliation (Queues to Admin Review)
    // =========================================================================
    if (idNumber && currentRecruitId > 0) {
      const t3Res = await pool.request()
        .input('IdNumber', sql.NVarChar(100), idNumber)
        .input('CurrentRecruitID', sql.Int, currentRecruitId)
        .query(`
          SELECT TOP 1 RecruitID 
          FROM dbo.Recruits 
          WHERE UPPER(REPLACE(IdNumber, '-', '')) = @IdNumber
            AND RecruitID != @CurrentRecruitID
        `);

      if (t3Res.recordset.length > 0) {
        const existingId = t3Res.recordset[0].RecruitID;

        // Queue for Admin Duplicate Review
        await pool.request()
          .input('CandidateID_A', sql.Int, existingId)
          .input('CandidateID_B', sql.Int, currentRecruitId)
          .input('MatchReason', sql.NVarChar(100), `Matching ID Number (${idType || 'ID'})`)
          .query(`
            IF NOT EXISTS (
              SELECT 1 FROM dbo.DuplicateReviewQueue 
              WHERE (CandidateID_A = @CandidateID_A AND CandidateID_B = @CandidateID_B)
                 OR (CandidateID_A = @CandidateID_B AND CandidateID_B = @CandidateID_A)
            )
            BEGIN
              INSERT INTO dbo.DuplicateReviewQueue (CandidateID_A, CandidateID_B, MatchReason, Status)
              VALUES (@CandidateID_A, @CandidateID_B, @MatchReason, 'Pending');
            END
          `);
      }
    }

    context.res.status = 200;
    context.res.body = JSON.stringify({ matchType: 'NONE' });

  } catch (err) {
    context.log.error("Error in check-recruit-duplicate:", err.message);
    context.res.status = 500;
    context.res.body = JSON.stringify({ error: err.message });
  }
};