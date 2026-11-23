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

    // Resolve binary data into a pure Node Buffer without UTF-8 corruption
    let fileBuffer = null;
    if (Buffer.isBuffer(req.body)) {
      fileBuffer = req.body;
    } else if (req.body instanceof Uint8Array || req.body instanceof ArrayBuffer || ArrayBuffer.isView(req.body)) {
      fileBuffer = Buffer.from(req.body);
    } else if (req.body && req.body.type === 'Buffer' && Array.isArray(req.body.data)) {
      fileBuffer = Buffer.from(req.body.data);
    } else if (Buffer.isBuffer(req.rawBody)) {
      fileBuffer = req.rawBody;
    } else if (typeof req.rawBody === 'string') {
      // Fallback only if host didn't pass binary Buffer; 'latin1' preserves 1:1 byte mapping unlike 'utf8'
      fileBuffer = Buffer.from(req.rawBody, 'latin1');
    } else if (typeof req.body === 'string') {
      fileBuffer = Buffer.from(req.body, 'base64');
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      context.res.status = 400;
      context.res.body = JSON.stringify({ message: 'No valid file binary data received in request.' });
      return;
    }

    // Sanity check: verify PDF magic bytes (%PDF-) if content-type is PDF
    const contentType = req.headers['content-type'] || 'application/pdf';
    if (contentType === 'application/pdf' && fileBuffer.length >= 5) {
      const headerSignature = fileBuffer.subarray(0, 5).toString('ascii');
      if (headerSignature !== '%PDF-') {
        context.log.warn(`Warning: Uploaded PDF header signature is '${headerSignature}' instead of '%PDF-'.`);
      }
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

    // Upload verified Buffer with explicit MIME type and inline disposition
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