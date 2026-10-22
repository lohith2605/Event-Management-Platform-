import { Readable } from 'node:stream';
import { getCloudinary } from '../config/cloudinary.js';

export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_DOCUMENT_SIZE = 15 * 1024 * 1024; // 15MB

const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_DOCUMENT_EXTENSIONS = ['pdf', 'txt', 'csv', 'docx', 'xlsx'];

/**
 * Validates buffer magic bytes against supported image signatures
 *
 * @param {Buffer} buffer
 * @returns {{ valid: boolean, type?: string }}
 */
export const validateImageSignature = (buffer) => {
  if (!buffer || buffer.length < 12) {
    return { valid: false };
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { valid: true, type: 'image/jpeg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { valid: true, type: 'image/png' };
  }

  // GIF: GIF87a or GIF89a (47 49 46 38 37/39 61)
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    return { valid: true, type: 'image/gif' };
  }

  // WebP: RIFF (bytes 0-3) ... WEBP (bytes 8-11)
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { valid: true, type: 'image/webp' };
  }

  return { valid: false };
};

/**
 * Validates any attachment (image or document) content, size, and magic signatures.
 * Rejects unsupported types, executables, scripts, and HTML injections.
 *
 * @param {Buffer} buffer
 * @param {string} originalName
 * @param {string} mimeType
 * @returns {{ valid: boolean, category?: 'image'|'document', resourceType?: 'image'|'raw', mimeType?: string, error?: string }}
 */
export const validateAttachmentFile = (buffer, originalName = '', mimeType = '') => {
  if (!buffer || buffer.length === 0) {
    return { valid: false, error: 'Attachment file buffer is empty.' };
  }

  const rawExt = (originalName || '').split('.').pop() || '';
  const ext = rawExt.toLowerCase();

  // 1. Check for supported image formats first
  const imageSig = validateImageSignature(buffer);
  if (imageSig.valid) {
    if (buffer.length > MAX_IMAGE_SIZE) {
      return { valid: false, error: 'Image exceeds the maximum allowed size of 10MB.' };
    }
    return {
      valid: true,
      category: 'image',
      resourceType: 'image',
      mimeType: imageSig.type,
    };
  }

  // 2. Reject if size exceeds general document limit (15MB)
  if (buffer.length > MAX_DOCUMENT_SIZE) {
    return { valid: false, error: 'Document exceeds the maximum allowed size of 15MB.' };
  }

  // Reject explicit executable or dangerous headers regardless of extension
  // Windows MZ header (0x4D, 0x5A)
  if (buffer.length >= 2 && buffer[0] === 0x4d && buffer[1] === 0x5a) {
    return { valid: false, error: 'Executable files are strictly forbidden.' };
  }
  // Linux ELF header (0x7F, 0x45, 0x4C, 0x46)
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x7f &&
    buffer[1] === 0x45 &&
    buffer[2] === 0x4c &&
    buffer[3] === 0x46
  ) {
    return { valid: false, error: 'Executable files are strictly forbidden.' };
  }
  // Shebang script header (0x23, 0x21) -> #!
  if (buffer.length >= 2 && buffer[0] === 0x23 && buffer[1] === 0x21) {
    return { valid: false, error: 'Script files are strictly forbidden.' };
  }

  // 3. PDF validation (%PDF- signature at byte 0: 0x25, 0x50, 0x44, 0x46, 0x2D)
  if (
    buffer.length >= 5 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2d
  ) {
    if (ext && ext !== 'pdf') {
      return { valid: false, error: 'File content does not match its extension (PDF expected).' };
    }
    return {
      valid: true,
      category: 'document',
      resourceType: 'raw',
      mimeType: 'application/pdf',
    };
  }

  // 4. DOCX and XLSX validation (ZIP container PK\x03\x04: 0x50, 0x4B, 0x03, 0x04)
  const isZipContainer =
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04;

  if (isZipContainer) {
    if (ext === 'docx') {
      return {
        valid: true,
        category: 'document',
        resourceType: 'raw',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      };
    }
    if (ext === 'xlsx') {
      return {
        valid: true,
        category: 'document',
        resourceType: 'raw',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
    }
    // Generic zip files or unsupported zip archives are rejected
    return {
      valid: false,
      error: 'Unsupported archive format. Only DOCX and XLSX office documents are permitted.',
    };
  }

  // 5. TXT and CSV text validation
  if (ext === 'txt' || ext === 'csv' || mimeType === 'text/plain' || mimeType === 'text/csv') {
    // Check for binary NUL bytes (0x00) within the first 8192 bytes
    const checkLength = Math.min(buffer.length, 8192);
    for (let i = 0; i < checkLength; i++) {
      if (buffer[i] === 0x00) {
        return { valid: false, error: 'Binary or corrupted content detected in text document.' };
      }
    }

    // Check for dangerous HTML / PHP / Script tags in initial text chunk
    const textHeader = buffer.subarray(0, Math.min(buffer.length, 4096)).toString('utf-8');
    const dangerousTagPattern = /<\s*(?:!doctype\s+html|html|script|iframe|object|embed|\?php|<%)/i;
    if (dangerousTagPattern.test(textHeader)) {
      return { valid: false, error: 'HTML, script, or executable code detected in document.' };
    }

    const determinedMime = ext === 'csv' || mimeType.includes('csv') ? 'text/csv' : 'text/plain';

    return {
      valid: true,
      category: 'document',
      resourceType: 'raw',
      mimeType: determinedMime,
    };
  }

  return {
    valid: false,
    error: 'Unsupported file type. Supported formats: JPEG, PNG, WebP, GIF, PDF, TXT, CSV, DOCX, XLSX.',
  };
};

/**
 * Uploads an image or document buffer to Cloudinary
 *
 * @param {Buffer} fileBuffer
 * @param {string} originalName
 * @param {string} mimeType
 * @returns {Promise<object>} Attachment metadata
 */
export const uploadChatAttachmentToCloudinary = async (fileBuffer, originalName = '', mimeType = '') => {
  if (!fileBuffer || fileBuffer.length === 0) {
    throw new Error('Attachment file buffer is empty.');
  }

  const validation = validateAttachmentFile(fileBuffer, originalName, mimeType);
  if (!validation.valid) {
    throw new Error(validation.error || 'Unsupported or malformed file content.');
  }

  const cloudinary = getCloudinary();
  if (!cloudinary) {
    throw new Error('Cloudinary is not configured on the server.');
  }

  const isImage = validation.resourceType === 'image';
  const folder = isImage ? 'utsav/chat_images' : 'utsav/chat_documents';

  return new Promise((resolve, reject) => {
    const uploadOptions = {
      folder,
      resource_type: validation.resourceType,
    };

    if (isImage) {
      uploadOptions.allowed_formats = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
      uploadOptions.transformation = [{ quality: 'auto:good', fetch_format: 'auto' }];
    } else {
      // For raw documents, preserve clean base name and extension in public_id
      const rawExt = (originalName || '').split('.').pop() || '';
      const sanitizedBase = (originalName || 'document')
        .replace(/\.[^/.]+$/, '')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 50);
      const safePublicId = `${Date.now()}_${sanitizedBase}${rawExt ? `.${rawExt.toLowerCase()}` : ''}`;

      uploadOptions.public_id = safePublicId;
      uploadOptions.use_filename = true;
      uploadOptions.unique_filename = true;
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error || !result) {
          reject(new Error(error?.message || 'Failed to upload attachment to Cloudinary.'));
          return;
        }

        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          originalName: originalName || (isImage ? 'image' : 'document'),
          mimeType: validation.mimeType || mimeType || (isImage ? 'image/jpeg' : 'application/octet-stream'),
          size: result.bytes || fileBuffer.length,
          resourceType: result.resource_type || validation.resourceType,
          width: result.width || null,
          height: result.height || null,
        });
      }
    );

    Readable.from(fileBuffer).pipe(uploadStream);
  });
};

/**
 * Backward compatibility alias for image-specific uploads
 */
export const uploadChatImageToCloudinary = async (fileBuffer, originalName = '', mimeType = '') => {
  return uploadChatAttachmentToCloudinary(fileBuffer, originalName, mimeType);
};

/**
 * Streams a Cloudinary asset to the client with safe download headers.
 * Protects against SSRF by verifying the URL origin is strictly Cloudinary.
 *
 * @param {string} url
 * @param {import('express').Response} res
 * @param {{ filename?: string, mimeType?: string, isInline?: boolean }} options
 */
export const streamAttachmentFromCloudinary = async (
  url,
  res,
  { filename = 'attachment', mimeType = 'application/octet-stream', isInline = false } = {}
) => {
  if (!url || typeof url !== 'string' || !url.startsWith('https://res.cloudinary.com/')) {
    const error = new Error('Invalid or untrusted asset URL.');
    error.status = 400;
    throw error;
  }

  const response = await fetch(url);
  if (!response.ok) {
    const error = new Error(`Failed to retrieve file from storage (${response.statusText}).`);
    error.status = response.status === 404 ? 404 : 502;
    throw error;
  }

  const safeFilename = (filename || 'download').replace(/[\r\n"/\\]/g, '_');
  const encodedFilename = encodeURIComponent(safeFilename);
  const dispositionType = isInline ? 'inline' : 'attachment';

  res.setHeader(
    'Content-Disposition',
    `${dispositionType}; filename="${safeFilename}"; filename*=UTF-8''${encodedFilename}`
  );
  res.setHeader(
    'Content-Type',
    mimeType || response.headers.get('content-type') || 'application/octet-stream'
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-cache');

  const contentLength = response.headers.get('content-length');
  if (contentLength) {
    res.setHeader('Content-Length', contentLength);
  }

  Readable.fromWeb(response.body).pipe(res);
};

/**
 * Deletes an uploaded asset from Cloudinary
 *
 * @param {string} publicId
 * @param {string} resourceType
 * @returns {Promise<object>}
 */
export const deleteCloudinaryAsset = async (publicId, resourceType = 'image') => {
  if (!publicId) return null;
  const cloudinary = getCloudinary();
  if (!cloudinary) return null;

  try {
    return await cloudinary.uploader.destroy(publicId, { resource_type: resourceType || 'image' });
  } catch (err) {
    console.warn(`Failed to destroy Cloudinary asset ${publicId}:`, err.message);
    return null;
  }
};

