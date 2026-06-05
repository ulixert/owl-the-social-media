import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { app } from '../app.js';
import { prisma } from '../db/index.js';
import {
  CELEBRITY_FOLLOWER_THRESHOLD,
  feedKey,
  mergeFeedPages,
  postEventEffect,
} from '../features/post/feed.js';
import { redis } from '../redis.js';
import { authHeader, createUser, resetDb } from './helpers.js';

describe('postEventEffect (CDC mapping)', () => {
  const post = { id: 7, postedById: 3, isDeleted: false };

  it('maps create and snapshot-read of a live post to add', () => {
    expect(postEventEffect({ op: 'c', after: post })).toEqual({
      op: 'add',
      postId: 7,
      authorId: 3,
    });
    expect(postEventEffect({ op: 'r', after: post })).toEqual({
      op: 'add',
      postId: 7,
      authorId: 3,
    });
  });

  it('maps a soft delete (update flipping isDeleted) to remove', () => {
    expect(
      postEventEffect({ op: 'u', after: { ...post, isDeleted: true } }),
    ).toEqual({ op: 'remove', postId: 7, authorId: 3 });
  });

  it('maps a hard delete to remove using the before image', () => {
    expect(postEventEffect({ op: 'd', before: post })).toEqual({
      op: 'remove',
      postId: 7,
      authorId: 3,
    });
  });

  it('ignores ordinary edits, creates of deleted posts, and malformed events', () => {
    expect(postEventEffect({ op: 'u', after: post })).toBeNull();
    expect(postEventEffect({ op: 'c', after: { ...post, isDeleted: true } })).toBeNull();
    expect(postEventEffect(null)).toBeNull();
    expect(postEventEffect({})).toBeNull();
    expect(postEventEffect({ op: 'c', after: { id: 7 } })).toBeNull();
  });
});

describe('mergeFeedPages', () => {
  it('merges newest-first, de-dupes, and caps to limit', () => {
    expect(mergeFeedPages([9, 6, 3], [8, 6, 2], 4)).toEqual([9, 8, 6, 3]);
  });

  it('handles an empty celebrity slice', () => {
    expect(mergeFeedPages([5, 4], [], 10)).toEqual([5, 4]);
  });
});

describe('Following feed read path (Redis-backed, hybrid)', () => {
  let viewer: number;
  let author: number;
  let normal: number;
  let celeb: number;

  beforeAll(async () => {
    await resetDb();
    viewer = await createUser('viewer');
    author = await createUser('author');
    normal = await createUser('normal');
    // A celebrity the viewer follows: above the fan-out threshold.
    const c = await prisma.user.create({
      data: {
        username: 'celeb',
        email: 'celeb@example.com',
        name: 'celeb',
        password: 'x',
        followersCount: CELEBRITY_FOLLOWER_THRESHOLD + 1,
      },
    });
    celeb = c.id;

    await prisma.userFollows.createMany({
      data: [
        { followerId: viewer, followingId: author },
        { followerId: viewer, followingId: normal },
        { followerId: viewer, followingId: celeb },
      ],
    });
  });

  afterAll(async () => {
    await redis.del(feedKey(viewer));
  });

  it('serves the precomputed feed from Redis when warm', async () => {
    const post = await prisma.post.create({
      data: { postedById: author, text: 'from redis' },
    });
    await redis.zadd(feedKey(viewer), post.id, String(post.id));

    const res = await request(app)
      .get('/api/v1/posts/following')
      .set('Authorization', authHeader(viewer));
    const body = res.body as { posts: { id: number }[] };

    expect(res.status).toBe(200);
    expect(body.posts.map((p) => p.id)).toContain(post.id);

    await redis.del(feedKey(viewer));
    await prisma.post.delete({ where: { id: post.id } });
  });

  it('falls back to the DB pull model when the feed key is missing', async () => {
    const post = await prisma.post.create({
      data: { postedById: author, text: 'from db' },
    });

    const res = await request(app)
      .get('/api/v1/posts/following')
      .set('Authorization', authHeader(viewer));
    const body = res.body as { posts: { id: number }[] };

    expect(res.status).toBe(200);
    expect(body.posts.map((p) => p.id)).toContain(post.id);

    await prisma.post.delete({ where: { id: post.id } });
  });

  it('merges followed celebrities at read time (not from the feed ZSET)', async () => {
    // A normal post is fanned out into the ZSET; the celebrity's is not.
    const normalPost = await prisma.post.create({
      data: { postedById: normal, text: 'normal' },
    });
    const celebPost = await prisma.post.create({
      data: { postedById: celeb, text: 'celeb' },
    });
    await redis.zadd(feedKey(viewer), normalPost.id, String(normalPost.id));

    const res = await request(app)
      .get('/api/v1/posts/following')
      .set('Authorization', authHeader(viewer));
    const ids = (res.body as { posts: { id: number }[] }).posts.map((p) => p.id);

    expect(res.status).toBe(200);
    expect(ids).toContain(normalPost.id); // fanned out
    expect(ids).toContain(celebPost.id); // merged in at read time

    await redis.del(feedKey(viewer));
    await prisma.post.deleteMany({
      where: { id: { in: [normalPost.id, celebPost.id] } },
    });
  });
});
