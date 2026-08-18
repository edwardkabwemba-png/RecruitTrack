const { BlobServiceClient } = require('@azure/storage-blob');
const parseMultipart = require('parse-multipart-data');

module.exports = async function (context, req) {
  context.res = { headers: { 'Content-Type': 'application/json' } };

  if (req.method !== 'POST') {
    context.res.status = 405;
    context.res.body = JSON.stringify({ message: 'Method not allowed' });
    return;
  }

  try {
    const contentType = req.headers['content-type'] || req.headers['Content-Type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      context.res.status = 400;
      context.res.body = JSON.stringify({ message: 'Invalid Content-Type.' });
      return;
    }

    // Extract boundary string
    const boundary = parseMultipart.getBoundary(contentType);
    if (!boundary) {
      context.res.status = 400;
      context.res.body = JSON.stringify({ message: 'Missing boundary in header' });
      return;
    }

    // Standardize body into Buffer format
    let bodyBuffer = req.body;
    if (typeof bodyBuffer === 'string') {
      bodyBuffer = Buffer.from(bodyBuffer, req.isRaw ? 'binary' : 'base64');
    }

    // Robust parsing using parse-multipart-data
    const parts = parseMultipart.parse(bodyBuffer, boundary);
    if (!parts || parts.length === 0) {
      context.res.status = 400;
      context.res.body = JSON.stringify({ message: 'No file found in request' });
      return;
    }

    const uploadedFile = parts[0];

    // Connect to Blob Storage
    const connStr = process.env.AzureWebJobsStorage;
    if (!connStr) {
      throw new Error("AzureWebJobsStorage connection string is missing.");
    }

    const blobServiceClient = BlobServiceClient.fromConnectionString(connStr);
    const containerClient = blobServiceClient.getContainerClient('documents');
    
    // Use public blob access (safe for reading documents via URL)
    await containerClient.createIfNotExists({ access: 'blob' });

    const cleanFilename = (uploadedFile.filename || 'file.pdf').replace(/[^a-zA-Z0-9.-]/g, '_');
    const blobName = `${Date.now()}-${cleanFilename}`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    // Upload raw binary data
    await blockBlobClient.uploadData(uploadedFile.data, {
      blobHTTPHeaders: { blobContentType: uploadedFile.type || 'application/octet-stream' }
    });

    context.res.status = 200;
    context.res.body = JSON.stringify({
      message: 'Upload successful',
      fileUrl: blockBlobClient.url,
      filename: cleanFilename
    });

  } catch (err) {
    context.log.error('Upload Error:', err);
    context.res.status = 500;
    context.res.body = JSON.stringify({ message: 'File upload failed', error: err.message });
  }
};