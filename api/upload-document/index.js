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

    // Extract boundary string from header
    const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    if (!boundaryMatch) {
      context.res.status = 400;
      context.res.body = JSON.stringify({ message: 'Missing boundary in multipart header' });
      return;
    }
    const boundary = boundaryMatch[1] || boundaryMatch[2];

    // Safely get raw Buffer (handles Base64 strings, Buffers, or Arrays)
    let rawBody = req.body;
    if (typeof rawBody === 'string') {
      rawBody = Buffer.from(rawBody, req.isRaw ? 'binary' : 'utf8');
    } else if (req.rawBody) {
      rawBody = Buffer.from(req.rawBody, 'binary');
    }

    const parsedData = parseMultipartContent(rawBody, boundary);

    context.log(`Successfully parsed docType: ${parsedData.fields.docType || 'N/A'}`);
    context.log(`Total files parsed: ${parsedData.files.length}`);

    // SUCCESS RESPONSE
    context.res.status = 200;
    context.res.body = JSON.stringify({
      message: 'Upload successful',
      docType: parsedData.fields.docType || 'Document',
      fileCount: parsedData.files.length,
      uploadedFiles: parsedData.files.map(f => f.filename)
    });

  } catch (err) {
    context.log.error('Upload Execution Error:', err.stack || err.message);
    context.res.status = 500;
    context.res.body = JSON.stringify({
      message: 'Failed to process file upload',
      error: err.message
    });
  }
};

// Pure JavaScript Multipart Buffer Parser
function parseMultipartContent(buffer, boundary) {
  const files = [];
  const fields = {};
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  
  let start = 0;
  while (start < buffer.length) {
    const boundaryIdx = buffer.indexOf(boundaryBuffer, start);
    if (boundaryIdx === -1) break;

    const nextBoundaryIdx = buffer.indexOf(boundaryBuffer, boundaryIdx + boundaryBuffer.length);
    if (nextBoundaryIdx === -1) break;

    const part = buffer.slice(boundaryIdx + boundaryBuffer.length, nextBoundaryIdx);
    const headerEndIdx = part.indexOf('\r\n\r\n');

    if (headerEndIdx !== -1) {
      const headerText = part.slice(0, headerEndIdx).toString('utf8');
      const body = part.slice(headerEndIdx + 4, part.length - 2); // trim trailing \r\n

      const nameMatch = headerText.match(/name="([^"]+)"/);
      const filenameMatch = headerText.match(/filename="([^"]+)"/);
      const mimeMatch = headerText.match(/Content-Type:\s*([^\r\n]+)/i);

      if (filenameMatch) {
        files.push({
          fieldname: nameMatch ? nameMatch[1] : 'file',
          filename: filenameMatch[1],
          mimeType: mimeMatch ? mimeMatch[1] : 'application/octet-stream',
          buffer: body
        });
      } else if (nameMatch) {
        fields[nameMatch[1]] = body.toString('utf8');
      }
    }

    start = nextBoundaryIdx;
  }

  return { files, fields };
}