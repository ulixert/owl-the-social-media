// For-You feed: a two-stage ranked recommendation feed.
//   1. candidate generation — gather a bounded pool from a few sources
//   2. ranking — score each candidate with a transparent weighted heuristic
//   3. diversity/dedup — cap per author, drop the viewer's own posts
//
// Postgres-first (so it runs the same in prod, no Redis required); the Redis
// trending view is folded in as an extra discovery source only when present.
// Not an ML ranker — a heuristic is the right complexity at this scale.

import { prisma } from '../../db/index.js';
import { withLikeCounts } from './likeCounts.js';
import { feedInclude, withIsLiked } from './postSerializers.js';
import { getTrendingPostIds } from './trending.js';

// --- Tunables ---
const POOL = { followed: 100, social: 50, popular: 50 }; // per-source candidate caps
const POPULAR_MIN = 3; // "recent popular" like threshold for discovery candidates
const HALF_LIFE_HOURS = 24; // recency score halves every day
const MAX_PER_AUTHOR = 2; // diversity cap in the ranked output
const WEIGHTS = {
  recency: 3,
  popularity: 1,
  social: 2, // per followee who liked it
  followed: 1.5,
  trending: 1,
};

export type Signals = {
  isFollowed: boolean;
  socialProofCount: number; // how many of the viewer's followees liked it
  isTrending: boolean;
};

export type RankablePost = {
  id: number;
  postedById: number;
  createdAt: Date | string;
  likesCount: number;
  commentsCount: number;
};

function recencyDecay(ageHours: number): number {
  return Math.pow(0.5, Math.max(0, ageHours) / HALF_LIFE_HOURS);
}

/** Transparent weighted score. Pure — unit-tested. */
export function scorePost(post: RankablePost, sig: Signals, now: number): number {
  const ageHours = (now - new Date(post.createdAt).getTime()) / 3_600_000;
  return (
    WEIGHTS.recency * recencyDecay(ageHours) +
    WEIGHTS.popularity * Math.log1p(post.likesCount + post.commentsCount) +
    WEIGHTS.social * sig.socialProofCount +
    WEIGHTS.followed * (sig.isFollowed ? 1 : 0) +
    WEIGHTS.trending * (sig.isTrending ? 1 : 0)
  );
}

/**
 * Rank candidates by score (desc, id-desc tiebreak) and apply a per-author
 * diversity cap. Pure — unit-tested.
 */
export function rankCandidates<T extends RankablePost>(
  candidates: { post: T; signals: Signals }[],
  now: number = Date.now(),
): T[] {
  const scored = candidates
    .map(({ post, signals }) => ({ post, score: scorePost(post, signals, now) }))
    .sort((a, b) => b.score - a.score || b.post.id - a.post.id);

  const perAuthor = new Map<number, number>();
  const out: T[] = [];
  for (const { post } of scored) {
    const seen = perAuthor.get(post.postedById) ?? 0;
    if (seen >= MAX_PER_AUTHOR) continue;
    perAuthor.set(post.postedById, seen + 1);
    out.push(post);
  }
  return out;
}

/**
 * Build the For-You feed for a viewer. `offset` is the opaque cursor (index into
 * the ranked pool); the pool is bounded, so this is a handful of pages.
 */
export async function getForYouFeed(
  viewerId: number,
  offset: number,
  limit: number,
) {
  const follows = await prisma.userFollows.findMany({
    where: { followerId: viewerId },
    select: { followingId: true },
  });
  const followedIds = follows.map((f) => f.followingId);
  const followedSet = new Set(followedIds);

  // --- Candidate generation: bounded, mostly indexed queries ---
  const [followedPosts, socialLikes, popularPosts, trendingIds] =
    await Promise.all([
      followedIds.length
        ? prisma.post.findMany({
            where: { postedById: { in: followedIds }, isDeleted: false },
            orderBy: { id: 'desc' },
            take: POOL.followed,
            select: { id: true },
          })
        : [],
      followedIds.length
        ? prisma.like.findMany({
            where: { userId: { in: followedIds } },
            orderBy: { createdAt: 'desc' },
            take: POOL.social,
            select: { postId: true },
          })
        : [],
      prisma.post.findMany({
        where: { isDeleted: false, likesCount: { gte: POPULAR_MIN } },
        orderBy: { id: 'desc' },
        take: POOL.popular,
        select: { id: true },
      }),
      getTrendingPostIds(POOL.popular), // null when Redis is cold/down
    ]);

  // Social-proof strength: how many followees liked each candidate.
  const socialCount = new Map<number, number>();
  for (const { postId } of socialLikes) {
    socialCount.set(postId, (socialCount.get(postId) ?? 0) + 1);
  }
  const trendingSet = new Set(trendingIds ?? []);

  const candidateIds = new Set<number>([
    ...followedPosts.map((p) => p.id),
    ...socialLikes.map((l) => l.postId),
    ...popularPosts.map((p) => p.id),
    ...(trendingIds ?? []),
  ]);
  if (candidateIds.size === 0) return { posts: [], nextCursor: null };

  // --- Hydrate + real like counts (Redis-or-DB) ---
  const rows = await prisma.post.findMany({
    where: { id: { in: [...candidateIds] }, isDeleted: false },
    include: feedInclude(viewerId),
  });
  await withLikeCounts(rows); // mutates likesCount in place to the served value

  // --- Attach signals, drop own posts, rank ---
  const candidates = rows
    .filter((p) => p.postedById !== viewerId)
    .map((post) => ({
      post,
      signals: {
        isFollowed: followedSet.has(post.postedById),
        socialProofCount: socialCount.get(post.id) ?? 0,
        isTrending: trendingSet.has(post.id),
      },
    }));

  const ranked = rankCandidates(candidates);

  // --- Offset pagination over the ranked pool (counts already applied above) ---
  const page = ranked.slice(offset, offset + limit).map(withIsLiked);
  const nextCursor = offset + limit < ranked.length ? offset + limit : null;

  return { posts: page, nextCursor };
}
