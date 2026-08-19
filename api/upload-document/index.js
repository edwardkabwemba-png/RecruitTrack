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

    // Resolve binary data into a Node Buffer from any incoming format
    let fileBuffer = null;
    if (Buffer.isBuffer(req.body)) {
      fileBuffer = req.body;
    } else if (req.rawBody) {
      fileBuffer = Buffer.isBuffer(req.rawBody) 
        ? req.rawBody 
        : Buffer.from(req.rawBody, typeof req.rawBody === 'string' ? 'utf8' : 'binary');
    } else if (typeof req.body === 'string') {
      fileBuffer = Buffer.from(req.body, 'base64');
    } else if (req.body && req.body.data) {
      fileBuffer = Buffer.from(req.body.data);
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      context.res.status = 400;
      context.res.body = JSON.stringify({ message: 'No valid file binary data received in request.' });
      return;
    }

    // Extract headers
    const rawFileName = decodeURIComponent(req.headers['x-file-name'] || `doc-${Date.now()}.pdf`);
    const folderPath = decodeURIComponent(req.headers['x-folder-path'] || 'Unsorted');
    
    const cleanFileName = rawFileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const cleanFolderPath = folderPath.replace(/[^a-zA-Z0-9_\-/]/g, '_');

    // Folder path format: FirstName_Surname/Category/timestamp-filename.pdf
    const blobName = `${cleanFolderPath}/${Date.now()}-${cleanFileName}`;

    const blobServiceClient = BlobServiceClient.fromConnectionString(connStr);
    const containerClient = blobServiceClient.getContainerClient('documents');
    
    await containerClient.createIfNotExists({ access: 'blob' });

    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    // Upload verified Buffer
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