import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { app } from '../app.js';
import { prisma } from '../db/index.js';
import { authHeader, createUser, resetDb } from './helpers.js';

describe('counter integrity', () => {
  beforeEach(async () => {
    await resetDb();
  });

  // The like count is a derived view (Redis, maintained by the CDC consumer),
  // so the write path only touches the source of truth: the Like row.
  it('like then unlike adds then removes the Like row', async () => {
    const authorId = await createUser('author');
    const likerId = await createUser('liker');
    const post = await prisma.post.create({
      data: { postedById: authorId, text: 'hi' },
    });

    await request(app)
      .put(`/api/v1/posts/${post.id}/like`)
      .set('Authorization', authHeader(likerId))
      .expect(204);
    expect(await prisma.like.count({ where: { postId: post.id } })).toBe(1);

    await request(app)
      .put(`/api/v1/posts/${post.id}/like`)
      .set('Authorization', authHeader(likerId))
      .expect(204);
    expect(await prisma.like.count({ where: { postId: post.id } })).toBe(0);
  });

  it('follow then unfollow returns both counters to zero', async () => {
    const aId = await createUser('a');
    const bId = await createUser('b');

    await request(app)
      .put(`/api/v1/users/follow/${bId}`)
      .set('Authorization', authHeader(aId))
      .expect(204);
    expect((await prisma.user.findUnique({ where: { id: aId } }))?.followingCount).toBe(1);
    expect((await prisma.user.findUnique({ where: { id: bId } }))?.followersCount).toBe(1);

    await request(app)
      .put(`/api/v1/users/follow/${bId}`)
      .set('Authorization', authHeader(aId))
      .expect(204);
    expect((await prisma.user.findUnique({ where: { id: aId } }))?.followingCount).toBe(0);
    expect((await prisma.user.findUnique({ where: { id: bId } }))?.followersCount).toBe(0);
    expect(await prisma.userFollows.count()).toBe(0);
  });
});

describe('searchUsers follow status (batched)', () => {
  it('reports isFollowing correctly for a mix of followed and unfollowed users', async () => {
    await resetDb();
    const meId = await createUser('me');
    const alphaId = await createUser('searchalpha');
    await createUser('searchbeta');
    await createUser('searchgamma');

    await request(app)
      .put(`/api/v1/users/follow/${alphaId}`)
      .set('Authorization', authHeader(meId))
      .expect(204);

    const res = await request(app)
      .get('/api/v1/posts/search/users')
      .query({ q: 'search', limit: 10 })
      .set('Authorization', authHeader(meId));

    expect(res.status).toBe(200);
    const body = res.body as {
      users: { username: string; isFollowing: boolean }[];
    };
    const byName = new Map(body.users.map((u) => [u.username, u.isFollowing]));

    expect(byName.size).toBe(3);
    expect(byName.get('searchalpha')).toBe(true);
    expect(byName.get('searchbeta')).toBe(false);
    expect(byName.get('searchgamma')).toBe(false);
  });
});
