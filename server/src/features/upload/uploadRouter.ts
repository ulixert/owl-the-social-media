import express, { NextFunction, Request, Response, Router } from 'express';
import multer from 'multer';

import { protectRoute } from '../../middlewares/protectRoute.js';
import {
  ALLOWED_UPLOAD_TYPES,
  ALLOWED_VIDEO_TYPES,
} from '../../storage/index.js';
import { uploadImages } from './uploadController.js';

// Sized for video; images are far smaller. multer's limit is per file.
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const MAX_FILES = 4; // matches the client's per-post image cap

// Buffer uploads in memory; the storage backend decides where bytes ultimately
// go. memoryStorage keeps DiskStorage and S3Storage symmetric (both get a Buffer).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype in ALLOWED_UPLOAD_TYPES) cb(null, true);
    else cb(new Error('Only image and video uploads are allowed'));
  },
});

// Translate multer's errors into clean 4xx responses instead of a 500, and
// enforce the media rule: at most one video, never mixed with images.
function handleUpload(req: Request, res: Response, next: NextFunction): void {
  upload.array('files', MAX_FILES)(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError || err instanceof Error) {
      res.status(400).json({ error: err.message });
      return;
    }

    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    const videoCount = files.filter(
      (f) => f.mimetype in ALLOWED_VIDEO_TYPES,
    ).length;
    if (videoCount > 1) {
      res.status(400).json({ error: 'You can attach at most one video.' });
      return;
    }
    if (videoCount === 1 && files.length > 1) {
      res.status(400).json({ error: 'A video must be posted on its own.' });
      return;
    }

    next();
  });
}

export const uploadRouter: Router = express.Router();

uploadRouter.post('/', protectRoute, handleUpload, uploadImages);
