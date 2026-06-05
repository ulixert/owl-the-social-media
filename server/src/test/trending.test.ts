import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { app } from '../app.js';
import { prisma } from '../db/index.js';
import { TRENDING_KEY } from '../features/post/trending.js';
import { redis } from '../redis.js';
import { createUser, resetDb } from './helpers.js';

describe('GET /posts/trending (Redis-backed, Flink view)', () => {
  let hot: number;
  let warm: number;

  beforeAll(async () => {
    await resetDb();
    const author = await createUser('author');
    const p1 = await prisma.post.create({
      data: { postedById: author, text: 'hot', likesCount: 1 },
    });
    const p2 = await prisma.post.create({
      data: { postedById: author, text: 'warm', likesCount: 1 },
    });
    hot = p1.id;
    warm = p2.id;
  });

  afterAll(async () => {
    await redis.del(TRENDING_KEY);
  });

  it('serves posts in the trending view ranked by score', async () => {
    // Flink would write these; warm has the higher window count.
    await redis.zadd(TRENDING_KEY, 5, String(hot));
    await redis.zadd(TRENDING_KEY, 99, String(warm));

    const res = await request(app).get('/api/v1/posts/trending');
    const ids = (res.body as { posts: { id: number }[] }).posts.map((p) => p.id);

    expect(res.status).toBe(200);
    // Ranked by score: warm (99) before hot (5).
    expect(ids.indexOf(warm)).toBeLessThan(ids.indexOf(hot));
    expect(ids).toContain(hot);

    await redis.del(TRENDING_KEY);
  });

  it('falls back to a recent-popular DB query when the view is empty', async () => {
    // No trending ZSET → fallback orders by stored likesCount.
    await prisma.post.update({ where: { id: hot }, data: { likesCount: 50 } });

    const res = await request(app).get('/api/v1/posts/trending');
    const ids = (res.body as { posts: { id: number }[] }).posts.map((p) => p.id);

    expect(res.status).toBe(200);
    expect(ids).toContain(hot); // present via the fallback
  });
});
