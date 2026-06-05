import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { ALLOWED_IMAGE_TYPES, Storage, StoredFile } from './types.js';

// Writes uploads to a directory on the local filesystem and serves them back as
// relative URLs under the API prefix (so the same path works through the Vite
// dev proxy and Caddy in prod without extra config). The directory should be a
// mounted volume in prod so images survive container restarts.
export class DiskStorage implements Storage {
  constructor(
    private readonly dir: string,
    private readonly urlBase: string,
  ) {}

  async save(buffer: Buffer, contentType: string): Promise<StoredFile> {
    const ext = ALLOWED_IMAGE_TYPES[contentType];
    if (!ext) throw new Error(`Unsupported image type: ${contentType}`);

    await mkdir(this.dir, { recursive: true });
    const key = `${randomUUID()}.${ext}`;
    await writeFile(path.join(this.dir, key), buffer);

    return { key, url: `${this.urlBase}/${key}` };
  }

  async delete(key: string): Promise<void> {
    // Guard against path traversal: a key is always a bare filename.
    if (key.includes('/') || key.includes('..')) return;
    await unlink(path.join(this.dir, key)).catch(() => undefined);
  }
}
