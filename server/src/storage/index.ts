import path from 'node:path';

import { DiskStorage } from './diskStorage.js';
import { S3Storage } from './s3Storage.js';
import { Storage } from './types.js';

// Where disk uploads land. A relative path resolves against the server's cwd;
// in prod this should be an absolute path backed by a mounted volume.
export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR ?? 'uploads');

const API_PREFIX = process.env.API_PREFIX ?? '/api/v1';

// Files are served under the API prefix so one URL works everywhere: the Vite
// dev proxy (/api) and Caddy (/api/v1/*) both already forward it to Express.
export const MEDIA_ROUTE = '/media';
export const MEDIA_URL_BASE = `${API_PREFIX}${MEDIA_ROUTE}`;

function createStorage(): Storage {
  const driver = process.env.STORAGE_DRIVER ?? 'disk';
  switch (driver) {
    case 's3':
      return new S3Storage();
    case 'disk':
      return new DiskStorage(UPLOAD_DIR, MEDIA_URL_BASE);
    default:
      throw new Error(`Unknown STORAGE_DRIVER: ${driver}`);
  }
}

export const storage: Storage = createStorage();

export * from './types.js';
