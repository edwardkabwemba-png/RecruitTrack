const { BlobServiceClient } = require('@azure/storage-blob');

module.exports = async function (context, req) {
  context.log("Processing file upload...");

  // Set standard headers
  context.res = {
    headers: { 'Content-Type': 'application/json' }
  };

  try {
    // 1. Extract headers sent from frontend
    const fileNameHeader = req.headers['x-file-name'];
    const folderPathHeader = req.headers['x-folder-path'];

    if (!fileNameHeader || !folderPathHeader) {
      context.res.status = 400;
      context.res.body = JSON.stringify({ 
        message: "Missing required headers: X-File-Name or X-Folder-Path" 
      });
      return;
    }

    const fileName = decodeURIComponent(fileNameHeader);
    const folderPath = decodeURIComponent(folderPathHeader);
    const blobPath = `${folderPath}/${fileName}`;

    // 2. Extract raw binary content from request body
    const fileBuffer = req.body;
    if (!fileBuffer || fileBuffer.length === 0) {
      context.res.status = 400;
      context.res.body = JSON.stringify({ message: "File payload is empty." });
      return;
    }

    // 3. Connect to Azure Blob Storage
    const connectionString = process.env.AzureWebJobsStorage || process.env.BlobConnectionString;
    if (!connectionString) {
      throw new Error("Missing Azure Storage connection string in application settings.");
    }

    const containerName = process.env.BlobContainerName || 'recruit-documents';
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);

    // Auto-create container if it doesn't exist
    await containerClient.createIfNotExists({ access: 'container' });

    // 4. Upload file buffer to Blob
    const blockBlobClient = containerClient.getBlockBlobClient(blobPath);
    const contentType = req.headers['content-type'] || 'application/octet-stream';

    await blockBlobClient.uploadData(fileBuffer, {
      blobHTTPHeaders: { blobContentType: contentType }
    });

    // 5. Return successful file URL
    context.res.status = 200;
    context.res.body = JSON.stringify({
      message: "File uploaded successfully.",
      fileUrl: blockBlobClient.url,
      blobPath: blobPath
    });

  } catch (error) {
    context.log.error("Upload Error:", error);
    context.res.status = 500;
    context.res.body = JSON.stringify({
      message: "Failed to upload document.",
      error: error.message
    });
  }
};