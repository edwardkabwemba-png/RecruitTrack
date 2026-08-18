const Busboy = require('busboy');

module.exports = async function (context, req) {
  context.res = { headers: { 'Content-Type': 'application/json' } };

  if (req.method !== 'POST') {
    context.res.status = 405;
    context.res.body = JSON.stringify({ message: 'Method not allowed' });
    return;
  }

  try {
    // Azure Functions pass the body as raw buffer or base64
    const contentType = req.headers['content-type'] || req.headers['Content-Type'];
    if (!contentType || !contentType.includes('multipart/form-data')) {
      context.res.status = 400;
      context.res.body = JSON.stringify({ message: 'Invalid Content-Type. Expected multipart/form-data.' });
      return;
    }

    const result = await parseMultipartForm(req, contentType);

    // Context / Log check
    context.log(`Uploaded document type: ${result.fields.docType}`);
    context.log(`Received ${result.files.length} file(s)`);

    // TODO: Connect your Azure Blob Storage or local storage upload stream here
    // Example: await blobContainerClient.uploadBlockBlob(filename, buffer, buffer.length);

    context.res.status = 200;
    context.res.body = JSON.stringify({
      message: 'Upload processed successfully',
      docType: result.fields.docType,
      fileCount: result.files.length,
      files: result.files.map(f => ({ filename: f.filename, mimeType: f.mimeType }))
    });

  } catch (err) {
    context.log.error('Upload error:', err);
    context.res.status = 500;
    context.res.body = JSON.stringify({ message: 'Failed to process file upload', error: err.message });
  }
};

// Helper function to parse multipart streams in Azure Functions
function parseMultipartForm(req, contentType) {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({ headers: { 'content-type': contentType } });
    const result = { files: [], fields: {} };

    busboy.on('field', (fieldname, val) => {
      result.fields[fieldname] = val;
    });

    busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
      // Compatibility fallback for busboy v1.x (returns object on filename)
      const actualFilename = typeof filename === 'object' ? filename.filename : filename;
      const actualMimeType = typeof filename === 'object' ? filename.mimeType : mimetype;

      const fileBuffers = [];
      file.on('data', (data) => fileBuffers.push(data));
      file.on('end', () => {
        result.files.push({
          fieldname,
          filename: actualFilename,
          mimeType: actualMimeType,
          buffer: Buffer.concat(fileBuffers)
        });
      });
    });

    busboy.on('finish', () => resolve(result));
    busboy.on('error', (error) => reject(error));

    // Pass the raw body into busboy
    const bodyBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '', 'binary');
    busboy.write(bodyBuffer);
    busboy.end();
  });
}