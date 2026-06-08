import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import { app } from '../app.js';
import { prisma } from '../db/index.js';
import { createUser, resetDb } from './helpers.js';

type ChildPostsResponse = {
  childPosts: { id: number; text: string }[];
};

let parentId: number;

describe('GET /posts/:postId/comments sorting', () => {
  beforeAll(async () => {
    await resetDb();
    const authorId = await createUser('author');
    const parent = await prisma.post.create({
      data: { postedById: authorId, text: 'parent' },
    });
    parentId = parent.id;
    // Three replies; created oldest→newest, with non-monotonic like counts so
    // "top" and "recent" produce different orders.
    await prisma.post.create({
      data: { postedById: authorId, text: 'a', parentPostId: parentId, likesCount: 5 },
    });
    await prisma.post.create({
      data: { postedById: authorId, text: 'b', parentPostId: parentId, likesCount: 50 },
    });
    await prisma.post.create({
      data: { postedById: authorId, text: 'c', parentPostId: parentId, likesCount: 1 },
    });
  });

  it('recent: newest first (id desc)', async () => {
    const res = await request(app).get(
      `/api/v1/posts/${parentId}/comments?sort=recent`,
    );
    expect(res.status).toBe(200);
    const ids = (res.body as ChildPostsResponse).childPosts.map((p) => p.id);
    expect(ids).toEqual([...ids].sort((a, b) => b - a));
  });

  it('top: most-liked first (by db like count; order independent of the Redis view)', async () => {
    const res = await request(app).get(
      `/api/v1/posts/${parentId}/comments?sort=top`,
    );
    expect(res.status).toBe(200);
    // b=50, a=5, c=1 — assert the order, not the displayed counts (those can be
    // overridden by the Redis serving view in a shared test environment).
    const texts = (res.body as ChildPostsResponse).childPosts.map((p) => p.text);
    expect(texts).toEqual(['b', 'a', 'c']);
  });
});
