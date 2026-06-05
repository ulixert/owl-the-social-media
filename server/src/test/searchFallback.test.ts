import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import { app } from '../app.js';
import { prisma } from '../db/index.js';
import { authHeader, createUser, resetDb } from './helpers.js';

type PostSearchBody = {
  posts: { id: number; text: string; isLiked: boolean }[];
  nextCursor: number | null;
};

// Integration test for the Postgres full-text-search fallback in searchPostsFromDb.
// Tests run with ELASTICSEARCH_URL pointed at a dead port (.env.test), so every
// /search/posts request deterministically takes the fallback path — which is
// exactly the path we want to exercise here.
describe('post search — Postgres FTS fallback', () => {
  let authorId: number;

  beforeAll(async () => {
    await resetDb();
    authorId = await createUser('searchauthor');
    await prisma.post.createMany({
      data: [
        { postedById: authorId, text: 'the reconcile script rebuilds the counter' },
        { postedById: authorId, text: 'reconciling drift between cache and database' },
        { postedById: authorId, text: 'a totally unrelated post about astronomy' },
        { postedById: authorId, text: 'deleted but matching reconcile', isDeleted: true },
      ],
    });
  });

  it('matches by word and stems (reconcile ~ reconciling), excluding deleted posts', async () => {
    const res = await request(app)
      .get('/api/v1/posts/search/posts')
      .query({ q: 'reconcile', limit: 10 })
      .expect(200);

    const body = res.body as PostSearchBody;
    const texts = body.posts.map((p) => p.text);
    // Both the exact word and its stemmed variant match...
    expect(texts).toContain('the reconcile script rebuilds the counter');
    expect(texts).toContain('reconciling drift between cache and database');
    // ...the unrelated post does not, and the soft-deleted one is excluded.
    expect(texts).not.toContain('a totally unrelated post about astronomy');
    expect(texts).not.toContain('deleted but matching reconcile');
  });

  it('returns no matches for an absent term (not a substring scan)', async () => {
    const res = await request(app)
      .get('/api/v1/posts/search/posts')
      .query({ q: 'photosynthesis', limit: 10 })
      .expect(200);
    const body = res.body as PostSearchBody;
    expect(body.posts).toHaveLength(0);
    expect(body.nextCursor).toBeNull();
  });

  it('hydrates viewer-specific isLiked from Postgres', async () => {
    const viewer = await createUser('searchviewer');
    const [post] = await prisma.post.findMany({
      where: { text: { contains: 'rebuilds' } },
      take: 1,
    });
    await prisma.like.create({ data: { userId: viewer, postId: post.id } });

    const res = await request(app)
      .get('/api/v1/posts/search/posts')
      .query({ q: 'reconcile', limit: 10 })
      .set('Authorization', authHeader(viewer))
      .expect(200);

    const body = res.body as PostSearchBody;
    const liked = body.posts.find((p) => p.id === post.id);
    expect(liked?.isLiked).toBe(true);
  });
});
