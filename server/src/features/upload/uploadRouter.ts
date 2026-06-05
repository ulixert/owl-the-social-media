import express, { NextFunction, Request, Response, Router } from 'express';
import multer from 'multer';

import { protectRoute } from '../../middlewares/protectRoute.js';
import { ALLOWED_IMAGE_TYPES } from '../../storage/index.js';
import { uploadImages } from './uploadController.js';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_FILES = 4; // matches the client's per-post image cap

// Buffer uploads in memory; the storage backend decides where bytes ultimately
// go. memoryStorage keeps DiskStorage and S3Storage symmetric (both get a Buffer).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype in ALLOWED_IMAGE_TYPES) cb(null, true);
    else cb(new Error('Only image uploads are allowed'));
  },
});

// Translate multer's errors into clean 4xx responses instead of a 500.
function handleUpload(req: Request, res: Response, next: NextFunction): void {
  upload.array('files', MAX_FILES)(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      res.status(400).json({ error: err.message });
      return;
    }
    if (err instanceof Error) {
      res.status(400).json({ error: err.message });
      return;
    }
    next();
  });
}

export const uploadRouter: Router = express.Router();

uploadRouter.post('/', protectRoute, handleUpload, uploadImages);
