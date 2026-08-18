const Busboy = require('busboy');

module.exports = async function (context, req) {
  context.res = { headers: { 'Content-Type': 'application/json' } };

  if (req.method !== 'POST') {
    context.res.status = 405;
    context.res.body = JSON.stringify({ message: 'Method not allowed' });
    return;
  }

  try {
    const contentType = req.headers['content-type'] || req.headers['Content-Type'];
    
    if (!contentType || !contentType.includes('multipart/form-data')) {
      context.res.status = 400;
      context.res.body = JSON.stringify({ message: 'Invalid Content-Type.' });
      return;
    }

    // Convert body into raw Buffer
    const bodyBuffer = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(req.body || '', 'binary');

    const parsedData = await new Promise((resolve, reject) => {
      const busboy = Busboy({ headers: { 'content-type': contentType } });
      const result = { files: [], fields: {} };

      busboy.on('field', (fieldname, val) => {
        result.fields[fieldname] = val;
      });

      busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
        // Compatibility check for Busboy v1.x+
        const name = typeof filename === 'object' ? filename.filename : filename;
        const mime = typeof filename === 'object' ? filename.mimeType : mimetype;

        const chunks = [];
        file.on('data', (data) => chunks.push(data));
        file.on('end', () => {
          result.files.push({
            fieldname,
            filename: name,
            mimeType: mime,
            buffer: Buffer.concat(chunks)
          });
        });
      });

      busboy.on('finish', () => resolve(result));
      busboy.on('error', (err) => reject(err));

      busboy.write(bodyBuffer);
      busboy.end();
    });

    context.log(`DocType: ${parsedData.fields.docType}, Files received: ${parsedData.files.length}`);

    context.res.status = 200;
    context.res.body = JSON.stringify({
      message: 'Upload successful',
      docType: parsedData.fields.docType,
      fileCount: parsedData.files.length
    });

  } catch (err) {
    context.log.error('Upload Error Details:', err);
    context.res.status = 500;
    context.res.body = JSON.stringify({ 
      message: 'Failed to process file upload', 
      error: err.message 
    });
  }
};