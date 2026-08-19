const { BlobServiceClient } = require('@azure/storage-blob');

module.exports = async function (context, req) {
  context.res = { headers: { 'Content-Type': 'application/json' } };

  if (req.method !== 'POST') {
    context.res.status = 405;
    context.res.body = JSON.stringify({ message: 'Method not allowed' });
    return;
  }

  try {
    // Read from your new allowed environment variable
    const connStr = process.env.CUSTOM_STORAGE_CONNECTION_STRING;
    if (!connStr) {
      throw new Error("Missing CUSTOM_STORAGE_CONNECTION_STRING setting.");
    }

    const contentType = req.headers['content-type'] || req.headers['Content-Type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      context.res.status = 400;
      context.res.body = JSON.stringify({ message: 'Invalid Content-Type.' });
      return;
    }

    let rawBody = req.body;
    if (typeof rawBody === 'string') {
      rawBody = Buffer.from(rawBody, req.isRaw ? 'binary' : 'base64');
    }

    const blobServiceClient = BlobServiceClient.fromConnectionString(connStr);
    const containerClient = blobServiceClient.getContainerClient('documents');
    await containerClient.createIfNotExists({ access: 'blob' });

    const blobName = `doc-${Date.now()}.pdf`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.uploadData(rawBody);

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