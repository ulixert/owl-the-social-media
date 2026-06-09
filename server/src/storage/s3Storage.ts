import { randomUUID } from 'node:crypto';

import { ALLOWED_UPLOAD_TYPES, Storage, StoredFile } from './types.js';

// S3 backend, enabled with STORAGE_DRIVER=s3. Works against real S3 or any
// S3-compatible store (Cloudflare R2, MinIO, Backblaze B2) via S3_ENDPOINT.
//
// The AWS SDK is imported lazily (see `sdk()`), so a disk-only deploy never loads
// it — keeping the common, cheap path free of the dependency's startup cost.
// Credentials come from the standard AWS chain (env vars, shared config, or the
// instance/task IAM role); never hard-code them here.
//
// Config:
//   S3_BUCKET            (required) target bucket
//   AWS_REGION           bucket region (default us-east-1 for URL construction)
//   S3_CDN_URL           public base URL of a CDN in front of the bucket
//                        (e.g. https://dxxxx.cloudfront.net); falls back to the
//                        bucket's own URL when unset
//   S3_KEY_PREFIX        optional "folder" within the bucket (e.g. "media")
//   S3_ENDPOINT          custom endpoint for S3-compatible stores
//   S3_FORCE_PATH_STYLE  "true" for stores that need path-style URLs (MinIO)
export class S3Storage implements Storage {
  private readonly bucket: string;
  private readonly region: string | undefined;
  private readonly endpoint: string | undefined;
  private readonly forcePathStyle: boolean;
  /** Public base URL the client loads media from (CDN or bucket). No trailing slash. */
  private readonly publicBase: string;
  /** Optional key prefix within the bucket, normalized to "" or "dir/". */
  private readonly keyPrefix: string;

  // Lazily-created client + commands, resolved on first use.
  private sdkPromise?: Promise<{
    client: import('@aws-sdk/client-s3').S3Client;
    PutObjectCommand: typeof import('@aws-sdk/client-s3').PutObjectCommand;
    DeleteObjectCommand: typeof import('@aws-sdk/client-s3').DeleteObjectCommand;
  }>;

  constructor() {
    const bucket = process.env.S3_BUCKET;
    if (!bucket) {
      throw new Error('STORAGE_DRIVER=s3 requires S3_BUCKET to be set.');
    }
    this.bucket = bucket;
    this.region = process.env.AWS_REGION;
    this.endpoint = process.env.S3_ENDPOINT;
    this.forcePathStyle = process.env.S3_FORCE_PATH_STYLE === 'true';
    this.keyPrefix = normalizePrefix(process.env.S3_KEY_PREFIX);

    const cdn = process.env.S3_CDN_URL;
    if (cdn) {
      this.publicBase = stripTrailingSlash(cdn);
    } else if (this.endpoint) {
      this.publicBase = `${stripTrailingSlash(this.endpoint)}/${bucket}`;
    } else {
      this.publicBase = `https://${bucket}.s3.${this.region ?? 'us-east-1'}.amazonaws.com`;
    }
  }

  private async sdk() {
    this.sdkPromise ??= import('@aws-sdk/client-s3').then(
      ({ S3Client, PutObjectCommand, DeleteObjectCommand }) => ({
        client: new S3Client({
          region: this.region,
          endpoint: this.endpoint,
          forcePathStyle: this.forcePathStyle,
        }),
        PutObjectCommand,
        DeleteObjectCommand,
      }),
    );
    return this.sdkPromise;
  }

  async save(buffer: Buffer, contentType: string): Promise<StoredFile> {
    const ext = ALLOWED_UPLOAD_TYPES[contentType];
    if (!ext) throw new Error(`Unsupported upload type: ${contentType}`);

    const { client, PutObjectCommand } = await this.sdk();
    const key = `${this.keyPrefix}${randomUUID()}.${ext}`;
    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        // Keys are immutable (a fresh UUID per upload), so cache hard at the CDN/edge.
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );

    return { key, url: `${this.publicBase}/${key}` };
  }

  async delete(key: string): Promise<void> {
    const { client, DeleteObjectCommand } = await this.sdk();
    await client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

function stripTrailingSlash(s: string): string {
  return s.endsWith('/') ? s.slice(0, -1) : s;
}

function normalizePrefix(prefix: string | undefined): string {
  if (!prefix) return '';
  const trimmed = prefix.replace(/^\/+/, '').replace(/\/+$/, '');
  return trimmed ? `${trimmed}/` : '';
}
