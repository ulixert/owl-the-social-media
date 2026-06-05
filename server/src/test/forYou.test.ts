import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import { app } from '../app.js';
import { prisma } from '../db/index.js';
import { rankCandidates, scorePost, Signals } from '../features/post/forYou.js';
import { authHeader, createUser, resetDb } from './helpers.js';

const NOW = Date.UTC(2026, 0, 1, 12, 0, 0);
const noSignals: Signals = {
  isFollowed: false,
  socialProofCount: 0,
  isTrending: false,
};

function post(id: number, over: Partial<Parameters<typeof scorePost>[0]> = {}) {
  return {
    id,
    postedById: id, // unique author per post unless overridden
    createdAt: new Date(NOW),
    likesCount: 0,
    commentsCount: 0,
    ...over,
  };
}

describe('scorePost (pure ranking heuristic)', () => {
  it('rewards popularity, social proof, follow, and trending', () => {
    const base = scorePost(post(1), noSignals, NOW);
    expect(scorePost(post(1, { likesCount: 100 }), noSignals, NOW)).toBeGreaterThan(base);
    expect(scorePost(post(1), { ...noSignals, socialProofCount: 3 }, NOW)).toBeGreaterThan(base);
    expect(scorePost(post(1), { ...noSignals, isFollowed: true }, NOW)).toBeGreaterThan(base);
    expect(scorePost(post(1), { ...noSignals, isTrending: true }, NOW)).toBeGreaterThan(base);
  });

  it('decays with age', () => {
    const fresh = scorePost(post(1, { createdAt: new Date(NOW) }), noSignals, NOW);
    const old = scorePost(
      post(1, { createdAt: new Date(NOW - 7 * 24 * 3600_000) }),
      noSignals,
      NOW,
    );
    expect(fresh).toBeGreaterThan(old);
  });
});

describe('rankCandidates', () => {
  it('orders by score descending', () => {
    const ranked = rankCandidates(
      [
        { post: post(1, { postedById: 1 }), signals: noSignals },
        { post: post(2, { postedById: 2 }), signals: { ...noSignals, socialProofCount: 5 } },
        { post: post(3, { postedById: 3 }), signals: { ...noSignals, isFollowed: true } },
      ],
      NOW,
    );
    expect(ranked[0].id).toBe(2); // highest social proof wins
  });

  it('caps posts per author for diversity', () => {
    const flood = [1, 2, 3, 4].map((id) => ({
      post: post(id, { postedById: 99, likesCount: 100 }),
      signals: noSignals,
    }));
    const other = { post: post(5, { postedById: 7 }), signals: noSignals };
    const ranked = rankCandidates([...flood, other], NOW);
    expect(ranked.filter((p) => p.postedById === 99)).toHaveLength(2);
    expect(ranked.map((p) => p.id)).toContain(5);
  });
});

describe('GET /posts/for-you (ranked feed)', () => {
  let viewer: number;
  let alice: number;
  let pOwn: number;
  let pFollowedOld: number;
  let pPopularSocial: number;

  beforeAll(async () => {
    await resetDb();
    viewer = await createUser('viewer');
    alice = await createUser('alice'); // followed
    const carol = await createUser('carol'); // not followed (discovery)
    await prisma.userFollows.create({
      data: { followerId: viewer, followingId: alice },
    });

    pOwn = (await prisma.post.create({ data: { postedById: viewer, text: 'mine' } })).id;
    pFollowedOld = (
      await prisma.post.create({
        data: {
          postedById: alice,
          text: 'old followed',
          createdAt: new Date(Date.now() - 10 * 24 * 3600_000),
        },
      })
    ).id;
    // Not followed, but popular AND liked by a followee → should rank highly.
    pPopularSocial = (
      await prisma.post.create({
        data: { postedById: carol, text: 'popular', likesCount: 8 },
      })
    ).id;
    await prisma.like.create({ data: { userId: alice, postId: pPopularSocial } });
  });

  it('ranks, excludes own posts, and surfaces popular+social above stale follows', async () => {
    const res = await request(app)
      .get('/api/v1/posts/for-you')
      .set('Authorization', authHeader(viewer));
    const ids = (res.body as { posts: { id: number }[] }).posts.map((p) => p.id);

    expect(res.status).toBe(200);
    expect(ids).not.toContain(pOwn); // own posts excluded
    expect(ids).toContain(pFollowedOld); // followed candidate present
    expect(ids).toContain(pPopularSocial); // discovery candidate present
    // popular + social-proof + fresh beats a stale followed post
    expect(ids.indexOf(pPopularSocial)).toBeLessThan(ids.indexOf(pFollowedOld));
  });
});
