const { BlobServiceClient } = require('@azure/storage-blob');

module.exports = async function (context, req) {
  context.res = { headers: { 'Content-Type': 'application/json' } };

  if (req.method !== 'POST') {
    context.res.status = 405;
    context.res.body = JSON.stringify({ message: 'Method not allowed' });
    return;
  }

  try {
    const connStr = process.env.CUSTOM_STORAGE_CONNECTION_STRING;
    if (!connStr) {
      context.res.status = 500;
      context.res.body = JSON.stringify({ message: "Missing CUSTOM_STORAGE_CONNECTION_STRING in Azure settings." });
      return;
    }

    let fileBuffer;
    
    // Support JSON base64 payloads or raw buffer bodies
    if (req.body && req.body.fileData) {
      fileBuffer = Buffer.from(req.body.fileData, 'base64');
    } else if (Buffer.isBuffer(req.body)) {
      fileBuffer = req.body;
    } else if (typeof req.body === 'string') {
      fileBuffer = Buffer.from(req.body, 'base64');
    } else {
      context.res.status = 400;
      context.res.body = JSON.stringify({ message: 'No valid file payload received.' });
      return;
    }

    const fileName = req.body?.fileName || req.headers['x-file-name'] || `doc-${Date.now()}.pdf`;
    const cleanFileName = decodeURIComponent(fileName).replace(/[^a-zA-Z0-9.-]/g, '_');

    const blobServiceClient = BlobServiceClient.fromConnectionString(connStr);
    const containerClient = blobServiceClient.getContainerClient('documents');
    
    await containerClient.createIfNotExists({ access: 'blob' });

    const blobName = `${Date.now()}-${cleanFileName}`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.uploadData(fileBuffer, {
      blobHTTPHeaders: { blobContentType: req.headers['content-type'] || 'application/pdf' }
    });

    context.res.status = 200;
    context.res.body = JSON.stringify({
      message: 'Upload successful',
      fileUrl: blockBlobClient.url
    });

  } catch (err) {
    context.log.error('Upload Error:', err.message);
    context.res.status = 500;
    context.res.body = JSON.stringify({ message: 'File upload failed', error: err.message });
  }
};