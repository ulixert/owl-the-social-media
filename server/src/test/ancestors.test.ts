import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import { app } from '../app.js';
import { prisma } from '../db/index.js';
import { createUser, resetDb } from './helpers.js';

type AncestorsResponse = { ancestors: { id: number; text?: string }[] };

// root -> reply -> leaf (a 3-deep chain).
let rootId: number;
let replyId: number;
let leafId: number;

describe('GET /posts/:postId/ancestors', () => {
  beforeAll(async () => {
    await resetDb();
    const authorId = await createUser('author');

    const root = await prisma.post.create({
      data: { postedById: authorId, text: 'root' },
    });
    rootId = root.id;
    const reply = await prisma.post.create({
      data: { postedById: authorId, text: 'reply', parentPostId: rootId },
    });
    replyId = reply.id;
    const leaf = await prisma.post.create({
      data: { postedById: authorId, text: 'leaf', parentPostId: replyId },
    });
    leafId = leaf.id;
  });

  it('returns the chain root-first, excluding the post itself', async () => {
    const res = await request(app).get(`/api/v1/posts/${leafId}/ancestors`);

    expect(res.status).toBe(200);
    const { ancestors } = res.body as AncestorsResponse;
    expect(ancestors.map((p) => p.id)).toEqual([rootId, replyId]);
    expect(ancestors.map((p) => p.text)).toEqual(['root', 'reply']);
  });

  it('returns an empty chain for a root post', async () => {
    const res = await request(app).get(`/api/v1/posts/${rootId}/ancestors`);

    expect(res.status).toBe(200);
    expect((res.body as AncestorsResponse).ancestors).toEqual([]);
  });
});
