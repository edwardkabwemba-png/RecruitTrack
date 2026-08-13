const { BlobServiceClient } = require('@azure/storage-blob');
const parseMultipart = require('parse-multipart-data'); // Ensure parse-multipart-data is in package.json

module.exports = async function (context, req) {
  try {
    const boundary = parseMultipart.getBoundary(req.headers['content-type']);
    const parts = parseMultipart.Parse(Buffer.from(req.body), boundary);

    if (!parts || parts.length === 0) {
      context.res = { status: 400, body: JSON.stringify({ message: "No file uploaded" }) };
      return;
    }

    const file = parts[0];
    const fullName = req.query.fullName || 'Unassigned';
    const docType = req.query.docType || 'CV'; // CV, ID, Payslips, Certification, Degree

    // Azure Blob Storage connection
    const blobConnString = process.env.AzureWebJobsStorage || process.env.BlobConnectionString;
    const blobServiceClient = BlobServiceClient.fromConnectionString(blobConnString);
    const containerClient = blobServiceClient.getContainerClient('recruits-documents');
    await containerClient.createIfNotExists({ access: 'container' });

    // Partition Path: FullName/DocType/FileName
    const blobName = `${fullName.trim().replace(/\s+/g, '_')}/${docType}/${Date.now()}_${file.filename}`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.upload(file.data, file.data.length, {
      blobHTTPHeaders: { blobContentType: file.type }
    });

    context.res = {
      status: 200,
      body: JSON.stringify({
        message: "File uploaded successfully",
        blobUrl: blockBlobClient.url,
        docType: docType
      })
    };
  } catch (error) {
    context.log.error("File Upload Error:", error);
    context.res = { status: 500, body: JSON.stringify({ message: "Upload failed", error: error.message }) };
  }
};