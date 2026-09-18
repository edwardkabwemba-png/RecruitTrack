const { Connection, Request } = require('tedious');

module.exports = async function (context, req) {
  const config = {
    server: process.env.DB_SERVER,
    authentication: {
      type: 'default',
      options: {
        userName: process.env.DB_USER,
        password: process.env.DB_PASSWORD
      }
    },
    options: {
      database: process.env.DB_NAME,
      encrypt: true,
      trustServerCertificate: false
    }
  };

  try {
    const data = await new Promise((resolve, reject) => {
      const connection = new Connection(config);

      connection.on('connect', (err) => {
        if (err) return reject(err);

        const sqlQuery = `
          SELECT 
            p.PositionID, p.PositionName, p.IsActive, p.RequiredSkills, c.ClientName,
            COUNT(r.RecruitID) AS TotalCandidates
          FROM dbo.Positions p
          LEFT JOIN dbo.Clients c ON p.ClientID = c.ClientID
          LEFT JOIN dbo.Recruits r ON p.PositionID = r.PositionID
          GROUP BY p.PositionID, p.PositionName, p.IsActive, p.RequiredSkills, c.ClientName;

          SELECT 
            r.RecruitID, r.FirstName, r.Surname, r.DateSourced, r.CvUrl,
            p.PositionName, o.OutcomeName
          FROM dbo.Recruits r
          LEFT JOIN dbo.Positions p ON r.PositionID = p.PositionID
          LEFT JOIN dbo.Outcomes o ON r.OutcomeID = o.OutcomeID
          ORDER BY r.DateSourced DESC;
        `;

        let roles = [];
        let candidates = [];
        let querySetIndex = 0;

        const request = new Request(sqlQuery, (err) => {
          connection.close();
          if (err) return reject(err);
          resolve({ roles, candidates });
        });

        request.on('row', (columns) => {
          let rowObj = {};
          columns.forEach(col => {
            rowObj[col.metadata.colName] = col.value;
          });

          if (querySetIndex === 0) roles.push(rowObj);
          else candidates.push(rowObj);
        });

        request.on('doneInProc', () => {
          querySetIndex++;
        });

        connection.execSql(request);
      });

      connection.connect();
    });

    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: data
    };
  } catch (err) {
    context.res = {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: { error: err.message }
    };
  }
};