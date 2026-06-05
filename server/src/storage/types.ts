// The storage seam. Everything that persists an uploaded image goes through this
// interface, so swapping the backend (disk now, S3 later) is a one-class change:
// implement `Storage`, register it in the factory in ./index.ts, flip a STORAGE_DRIVER
// env var. Nothing in the app or the seed imports a concrete backend directly.

export interface StoredFile {
  /** Stable identifier within the backend (filename on disk, object key in S3). */
  key: string;
  /** Public URL the client can load the image from. */
  url: string;
}

export interface Storage {
  /** Persist bytes and return where they now live. */
  save(buffer: Buffer, contentType: string): Promise<StoredFile>;
  /** Remove a previously stored object. Optional: backends may no-op. */
  delete(key: string): Promise<void>;
}

// Image types we accept on upload, mapped to the file extension we store under.
export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};
