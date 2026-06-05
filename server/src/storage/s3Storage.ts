import { Storage, StoredFile } from './types.js';

// Placeholder for the eventual S3 backend. The whole point of the Storage seam is
// that turning this on is self-contained: implement the two methods below, add
// the SDK, and set STORAGE_DRIVER=s3 (see ./index.ts). Nothing else changes.
//
// Sketch of the real implementation:
//
//   import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
//   const client = new S3Client({ region: process.env.AWS_REGION });
//   async save(buffer, contentType) {
//     const ext = ALLOWED_IMAGE_TYPES[contentType];
//     const key = `${randomUUID()}.${ext}`;
//     await client.send(new PutObjectCommand({
//       Bucket: this.bucket, Key: key, Body: buffer, ContentType: contentType,
//     }));
//     return { key, url: `${this.cdnBase}/${key}` };  // CloudFront/bucket URL
//   }
//   async delete(key) {
//     await client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
//   }
//
// Stored as a class (not a TODO comment in the controller) precisely so the read
// path — which only sees the returned `url` — never needs to know which backend ran.
export class S3Storage implements Storage {
  save(): Promise<StoredFile> {
    throw new Error(
      'S3Storage is not implemented yet. Install @aws-sdk/client-s3 and fill in s3Storage.ts, ' +
        'or keep STORAGE_DRIVER=disk.',
    );
  }

  delete(): Promise<void> {
    throw new Error('S3Storage is not implemented yet.');
  }
}
