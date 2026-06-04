import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { app } from '../app.js';
import { prisma } from '../db/index.js';
import { likeCountKey, likeEventEffect } from '../features/post/likeCounts.js';
import { redis } from '../redis.js';
import { createUser, resetDb } from './helpers.js';

describe('like-count read path (Redis-backed)', () => {
  let postId: number;

  beforeAll(async () => {
    await resetDb();
    const authorId = await createUser('author');
    // DB column seeded to 7 so we can tell Redis-override from DB-fallback.
    const post = await prisma.post.create({
      data: { postedById: authorId, text: 'hi', likesCount: 7 },
    });
    postId = post.id;
  });

  afterEach(async () => {
    await redis.del(likeCountKey(postId));
  });

  it('serves likesCount from Redis when the key exists', async () => {
    await redis.set(likeCountKey(postId), 42);

    const res = await request(app).get(`/api/v1/posts/${postId}`);
    const body = res.body as { post: { likesCount: number } };

    expect(res.status).toBe(200);
    expect(body.post.likesCount).toBe(42);
  });

  it('falls back to the DB value on a Redis miss', async () => {
    const res = await request(app).get(`/api/v1/posts/${postId}`);
    const body = res.body as { post: { likesCount: number } };

    expect(res.status).toBe(200);
    expect(body.post.likesCount).toBe(7);
  });
});

describe('likeEventEffect (CDC mapping)', () => {
  it('maps create and snapshot-read to +1', () => {
    expect(likeEventEffect({ op: 'c', after: { postId: 5 } })).toEqual({
      postId: 5,
      delta: 1,
    });
    expect(likeEventEffect({ op: 'r', after: { postId: 9 } })).toEqual({
      postId: 9,
      delta: 1,
    });
  });

  it('maps delete to -1 (using the before image)', () => {
    expect(likeEventEffect({ op: 'd', before: { postId: 5 } })).toEqual({
      postId: 5,
      delta: -1,
    });
  });

  it('ignores updates and malformed events', () => {
    expect(likeEventEffect({ op: 'u', after: { postId: 5 } })).toBeNull();
    expect(likeEventEffect(null)).toBeNull();
    expect(likeEventEffect({})).toBeNull();
    expect(likeEventEffect({ op: 'c', after: {} })).toBeNull();
    expect(likeEventEffect({ op: 'd', before: null })).toBeNull();
  });
});
