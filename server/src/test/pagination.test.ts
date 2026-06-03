import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import { app } from '../app.js';
import { prisma } from '../db/index.js';
import { authHeader, createUser, resetDb } from './helpers.js';

type FeedResponse = { posts: { id: number }[]; nextCursor: number | null };

const TOTAL = 25;
const LIMIT = 10;

/** Page through a feed to exhaustion, returning the ids seen in order. */
async function pageAll(path: string, header?: string): Promise<number[]> {
  const ids: number[] = [];
  let cursor = 0;
  for (let guard = 0; guard < 50; guard++) {
    const req = request(app).get(path).query({ cursor, limit: LIMIT });
    if (header) void req.set('Authorization', header);
    const res = await req;
    expect(res.status).toBe(200);
    const body = res.body as FeedResponse;
    ids.push(...body.posts.map((p) => p.id));
    if (body.nextCursor === null) return ids;
    cursor = body.nextCursor;
  }
  throw new Error('pagination did not terminate');
}

describe('id-keyset pagination', () => {
  beforeAll(async () => {
    await resetDb();
    const authorId = await createUser('author');
    await prisma.post.createMany({
      data: Array.from({ length: TOTAL }, (_, i) => ({
        postedById: authorId,
        text: `post ${i}`,
      })),
    });
  });

  it('hot feed returns every post exactly once, newest first, null at tail', async () => {
    const ids = await pageAll('/api/v1/posts/hot');

    expect(ids).toHaveLength(TOTAL); // no skips
    expect(new Set(ids).size).toBe(TOTAL); // no duplicates
    expect(ids).toEqual([...ids].sort((a, b) => b - a)); // descending by id
  });

  it('liked feed paginates on the join table without skips or dupes', async () => {
    const likerId = await createUser('liker');
    // Like every post.
    await prisma.like.createMany({
      data: Array.from({ length: TOTAL }, (_, i) => ({
        userId: likerId,
        postId: i + 1,
      })),
    });

    const ids = await pageAll('/api/v1/posts/liked', authHeader(likerId));

    expect(ids).toHaveLength(TOTAL);
    expect(new Set(ids).size).toBe(TOTAL);
  });
});
