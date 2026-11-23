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

    const body = req.body || {};
    let fileBuffer = null;

    // 1. Primary path: Clean Base64 JSON payload (immune to Azure SWA binary proxy corruption)
    if (body.fileBase64 && typeof body.fileBase64 === 'string') {
      // Strip data URL prefix if present (e.g., "data:application/pdf;base64,...")
      const cleanBase64 = body.fileBase64.includes(',') 
        ? body.fileBase64.split(',')[1] 
        : body.fileBase64;
      fileBuffer = Buffer.from(cleanBase64, 'base64');
    } 
    // 2. Fallback for direct Buffer
    else if (Buffer.isBuffer(req.body)) {
      fileBuffer = req.body;
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      context.res.status = 400;
      context.res.body = JSON.stringify({ message: 'No valid file data received in request.' });
      return;
    }

    // Extract metadata from JSON body or fallback to headers
    const rawFileName = body.fileName || decodeURIComponent(req.headers['x-file-name'] || `doc-${Date.now()}.pdf`);
    const folderPath = body.folderPath || decodeURIComponent(req.headers['x-folder-path'] || 'Unsorted');
    const contentType = body.contentType || req.headers['content-type'] || 'application/pdf';

    const cleanFileName = rawFileName.replace(/[^a-zA-Z0-9._()-]/g, '_');
    const cleanFolderPath = folderPath.replace(/[^a-zA-Z0-9_\-/]/g, '_');

    const blobName = `${cleanFolderPath}/${Date.now()}-${cleanFileName}`;

    const blobServiceClient = BlobServiceClient.fromConnectionString(connStr);
    const containerClient = blobServiceClient.getContainerClient('documents');
    
    await containerClient.createIfNotExists({ access: 'blob' });

    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.uploadData(fileBuffer, {
      blobHTTPHeaders: { 
        blobContentType: contentType,
        blobContentDisposition: `inline; filename="${cleanFileName}"`
      }
    });

    context.res.status = 200;
    context.res.body = JSON.stringify({
      message: 'Upload successful',
      fileUrl: blockBlobClient.url,
      sizeBytes: fileBuffer.length
    });

  } catch (err) {
    context.log.error('Upload Error:', err.message);
    context.res.status = 500;
    context.res.body = JSON.stringify({ message: 'File upload failed', error: err.message });
  }
};