import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the AWS SDK so the S3 backend can be exercised without a bucket or network.
// vi.mock is hoisted and applies to S3Storage's lazy `import('@aws-sdk/client-s3')`.
const sendMock = vi.fn<(cmd: unknown) => Promise<void>>();
const clientConfigs: unknown[] = [];

vi.mock('@aws-sdk/client-s3', () => {
  class S3Client {
    constructor(config: unknown) {
      clientConfigs.push(config);
    }
    send = sendMock;
  }
  class PutObjectCommand {
    readonly type = 'put';
    constructor(public input: Record<string, unknown>) {}
  }
  class DeleteObjectCommand {
    readonly type = 'delete';
    constructor(public input: Record<string, unknown>) {}
  }
  return { S3Client, PutObjectCommand, DeleteObjectCommand };
});

import { S3Storage } from '../storage/s3Storage.js';

const UUID_RE = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

// Set only the S3_* / AWS_* vars a test needs; clear the rest so cases don't leak.
function setEnv(vars: Record<string, string | undefined>) {
  for (const key of [
    'S3_BUCKET',
    'AWS_REGION',
    'S3_CDN_URL',
    'S3_KEY_PREFIX',
    'S3_ENDPOINT',
    'S3_FORCE_PATH_STYLE',
  ]) {
    delete process.env[key];
  }
  for (const [key, value] of Object.entries(vars)) {
    if (value !== undefined) process.env[key] = value;
  }
}

beforeEach(() => {
  sendMock.mockReset();
  sendMock.mockResolvedValue(undefined);
  clientConfigs.length = 0;
});

describe('S3Storage', () => {
  it('requires S3_BUCKET', () => {
    setEnv({});
    expect(() => new S3Storage()).toThrow(/S3_BUCKET/);
  });

  it('rejects unsupported content types', async () => {
    setEnv({ S3_BUCKET: 'owl-media' });
    await expect(
      new S3Storage().save(Buffer.from('x'), 'application/zip'),
    ).rejects.toThrow(/Unsupported upload type/);
  });

  it('PutObjects the buffer under a uuid key and returns the bucket URL', async () => {
    setEnv({ S3_BUCKET: 'owl-media', AWS_REGION: 'eu-west-1' });
    const body = Buffer.from('imagebytes');

    const { key, url } = await new S3Storage().save(body, 'image/png');

    expect(key).toMatch(new RegExp(`^${UUID_RE}\\.png$`));
    expect(url).toBe(`https://owl-media.s3.eu-west-1.amazonaws.com/${key}`);

    expect(sendMock).toHaveBeenCalledTimes(1);
    const cmd = sendMock.mock.calls[0][0] as { type: string; input: Record<string, unknown> };
    expect(cmd.type).toBe('put');
    expect(cmd.input).toMatchObject({
      Bucket: 'owl-media',
      Key: key,
      Body: body,
      ContentType: 'image/png',
      CacheControl: 'public, max-age=31536000, immutable',
    });
  });

  it('defaults the region to us-east-1 for URL construction', async () => {
    setEnv({ S3_BUCKET: 'owl-media' });
    const { key, url } = await new S3Storage().save(Buffer.from('x'), 'image/jpeg');
    expect(key).toMatch(/\.jpg$/);
    expect(url).toBe(`https://owl-media.s3.us-east-1.amazonaws.com/${key}`);
  });

  it('prefers the CDN base URL when S3_CDN_URL is set', async () => {
    setEnv({
      S3_BUCKET: 'owl-media',
      AWS_REGION: 'eu-west-1',
      S3_CDN_URL: 'https://cdn.example.com/', // trailing slash should be trimmed
    });
    const { key, url } = await new S3Storage().save(Buffer.from('x'), 'image/webp');
    expect(url).toBe(`https://cdn.example.com/${key}`);
  });

  it('applies a key prefix and uses a custom endpoint URL', async () => {
    setEnv({
      S3_BUCKET: 'owl-media',
      S3_ENDPOINT: 'https://r2.example.com',
      S3_KEY_PREFIX: '/media/', // leading/trailing slashes normalized
      S3_FORCE_PATH_STYLE: 'true',
    });
    const { key, url } = await new S3Storage().save(Buffer.from('x'), 'video/mp4');

    expect(key).toMatch(new RegExp(`^media/${UUID_RE}\\.mp4$`));
    expect(url).toBe(`https://r2.example.com/owl-media/${key}`);
    expect(clientConfigs[0]).toMatchObject({
      endpoint: 'https://r2.example.com',
      forcePathStyle: true,
    });
  });

  it('DeleteObjects by key', async () => {
    setEnv({ S3_BUCKET: 'owl-media' });
    await new S3Storage().delete('media/abc.png');

    expect(sendMock).toHaveBeenCalledTimes(1);
    const cmd = sendMock.mock.calls[0][0] as { type: string; input: Record<string, unknown> };
    expect(cmd.type).toBe('delete');
    expect(cmd.input).toMatchObject({ Bucket: 'owl-media', Key: 'media/abc.png' });
  });
});
