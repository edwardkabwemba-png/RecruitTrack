const { BlobServiceClient } = require('@azure/storage-blob');

module.exports = async function (context, req) {
  context.log("Upload document request received.");

  try {
    // 1. Read headers (case-insensitive)
    const rawFileName = req.headers['x-file-name'] || req.headers['X-File-Name'];
    const rawFolderPath = req.headers['x-folder-path'] || req.headers['X-Folder-Path'];

    if (!rawFileName || !rawFolderPath) {
      context.res = {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: "Missing required headers: X-File-Name or X-Folder-Path" })
      };
      return;
    }

    const fileName = decodeURIComponent(rawFileName);
    const folderPath = decodeURIComponent(rawFolderPath);

    // 2. Extract binary body buffer safely
    let fileBuffer = req.body;
    if (typeof fileBuffer === 'string') {
      fileBuffer = Buffer.from(fileBuffer, 'binary');
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      context.res = {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: "File buffer is empty or null." })
      };
      return;
    }

    // 3. Azure Blob Upload Logic
    const connectionString = process.env.AzureWebJobsStorage || process.env.BlobConnectionString;
    if (!connectionString) {
      throw new Error("Missing Azure Storage connection string setting.");
    }

    const containerName = process.env.BlobContainerName || 'recruit-documents';
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);

    await containerClient.createIfNotExists({ access: 'container' });

    const blobPath = `${folderPath}/${fileName}`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobPath);
    const contentType = req.headers['content-type'] || 'application/octet-stream';

    await blockBlobClient.uploadData(fileBuffer, {
      blobHTTPHeaders: { blobContentType: contentType }
    });

    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: "Upload successful",
        fileUrl: blockBlobClient.url
      })
    };

  } catch (error) {
    context.log.error("Upload error:", error);
    context.res = {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message })
    };
  }
};