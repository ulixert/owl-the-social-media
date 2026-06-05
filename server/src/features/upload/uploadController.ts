import { Request, Response } from 'express';

import { storage } from '../../storage/index.js';

// Receives image bytes parsed by multer (in uploadRouter) and hands them to the
// storage backend. The controller never knows whether that's disk or S3 — it
// just returns the public URLs the client should store on the post/profile.
export async function uploadImages(req: Request, res: Response): Promise<void> {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length === 0) {
    res.status(400).json({ error: 'No files uploaded' });
    return;
  }

  try {
    const urls = await Promise.all(
      files.map(async (file) => {
        const stored = await storage.save(file.buffer, file.mimetype);
        return stored.url;
      }),
    );
    res.status(201).json({ urls });
  } catch (err) {
    console.error('Upload failed:', err);
    res.status(500).json({ error: 'Failed to store upload' });
  }
}
