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

    if (!req.body) {
      context.res.status = 400;
      context.res.body = JSON.stringify({ message: 'No file data received in request.' });
      return;
    }

    // Read filename and dynamic subfolder path
    const rawFileName = decodeURIComponent(req.headers['x-file-name'] || `doc-${Date.now()}.pdf`);
    const folderPath = decodeURIComponent(req.headers['x-folder-path'] || 'Unsorted');
    
    const cleanFileName = rawFileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const cleanFolderPath = folderPath.replace(/[^a-zA-Z0-9_\-/]/g, '_');

    // Blob virtual directory path: CandidateName/DocType/filename.pdf
    const blobName = `${cleanFolderPath}/${Date.now()}-${cleanFileName}`;

    const blobServiceClient = BlobServiceClient.fromConnectionString(connStr);
    const containerClient = blobServiceClient.getContainerClient('documents');
    
    await containerClient.createIfNotExists({ access: 'blob' });

    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.uploadData(req.body, {
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