import multer from 'multer';

const storage = multer.memoryStorage();

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const ALLOWED_EXTENSIONS = [
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
  'pdf',
  'txt',
  'csv',
  'docx',
  'xlsx',
];

const fileFilter = (req, file, cb) => {
  if (!file) {
    return cb(null, true);
  }

  const mime = (file.mimetype || '').toLowerCase();
  const ext = (file.originalname || '').split('.').pop().toLowerCase();

  const isMimeAllowed = ALLOWED_MIME_TYPES.includes(mime);
  const isExtAllowed = ALLOWED_EXTENSIONS.includes(ext);

  if (isMimeAllowed || isExtAllowed) {
    cb(null, true);
  } else {
    const error = new Error(
      'Unsupported file format. Supported formats: JPEG, PNG, WebP, GIF, PDF, TXT, CSV, DOCX, XLSX.'
    );
    error.status = 400;
    cb(error, false);
  }
};

export const chatAttachmentUpload = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15 MB limit
    files: 1,
  },
  fileFilter,
});

const attachmentFields = chatAttachmentUpload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'image', maxCount: 1 },
]);

/**
 * Express middleware that seamlessly accepts attachment uploads under either 'file' or 'image' field name
 */
export const handleAttachmentUpload = (req, res, next) => {
  attachmentFields(req, res, (err) => {
    if (err) return next(err);
    if (req.files) {
      req.file = req.files.file?.[0] || req.files.image?.[0] || null;
    }
    next();
  });
};

export const chatImageUpload = chatAttachmentUpload;

export default chatAttachmentUpload;

