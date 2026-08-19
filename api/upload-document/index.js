const { BlobServiceClient } = require('@azure/storage-blob');

module.exports = async function (context, req) {
  // 1. Default headers
  context.res = { headers: { 'Content-Type': 'application/json' } };

  // 2. Reject non-POST requests
  if (req.method !== 'POST') {
    context.res.status = 405;
    context.res.body = JSON.stringify({ message: 'Method not allowed' });
    return;
  }

  try {
    // 3. Verify environment variable
    const connStr = process.env.CUSTOM_STORAGE_CONNECTION_STRING;
    if (!connStr) {
      throw new Error("Missing CUSTOM_STORAGE_CONNECTION_STRING setting in Azure Configuration.");
    }

    // 4. Validate Content-Type
    const contentType = req.headers['content-type'] || req.headers['Content-Type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      context.res.status = 400;
      context.res.body = JSON.stringify({ message: 'Invalid Content-Type. Expected multipart/form-data.' });
      return;
    }

    // 5. Convert request body to Buffer safely
    let rawBody = req.body;
    if (!rawBody) {
      context.res.status = 400;
      context.res.body = JSON.stringify({ message: 'No file data received in request.' });
      return;
    }

    if (typeof rawBody === 'string') {
      rawBody = Buffer.from(rawBody, req.isRaw ? 'binary' : 'base64');
    }

    // 6. Connect to Azure Blob Storage
    const blobServiceClient = BlobServiceClient.fromConnectionString(connStr);
    const containerClient = blobServiceClient.getContainerClient('documents');
    
    // Ensure container exists with public access for reading document URLs
    await containerClient.createIfNotExists({ access: 'blob' });

    // 7. Generate unique filename and upload binary data
    const blobName = `doc-${Date.now()}.pdf`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.uploadData(rawBody);

    // 8. Return success response with permanent Azure Blob URL
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