const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to SQLite Database
const dbPath = path.resolve(__dirname, '../../recruit_track.db');

module.exports = async function (context, req) {
  const method = req.method.toUpperCase();
  const db = new sqlite3.Database(dbPath);

  try {
    // GET: Fetch all recruitment sources
    if (method === 'GET') {
      const sources = await new Promise((resolve, reject) => {
        db.all('SELECT SourceID, SourceName FROM Sources ORDER BY SourceName ASC', [], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      context.res = {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: sources
      };
    } 
    // POST: Add new source (REQUIRED field validation)
    else if (method === 'POST') {
      const { SourceName } = req.body || {};

      // Required validation: Block null, undefined, empty string, or whitespace
      if (!SourceName || typeof SourceName !== 'string' || SourceName.trim() === '') {
        context.res = {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
          body: { error: 'SourceName is a required field and cannot be empty.' }
        };
        return;
      }

      const cleanName = SourceName.trim();

      const result = await new Promise((resolve, reject) => {
        db.run('INSERT INTO Sources (SourceName) VALUES (?)', [cleanName], function (err) {
          if (err) reject(err);
          else resolve({ SourceID: this.lastID, SourceName: cleanName });
        });
      });

      context.res = {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
        body: result
      };
    }
  } catch (err) {
    context.log.error('Database Error:', err.message);
    context.res = {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: { error: 'Internal Server Error', details: err.message }
    };
  } finally {
    db.close();
  }
};