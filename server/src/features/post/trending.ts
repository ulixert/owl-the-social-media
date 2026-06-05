// The trending view: most-liked posts in a recent sliding window, computed by
// the Flink job (trending-job/) and written to a Redis ZSET. This module is the
// read side — it serves that ZSET, ordered by score, with a DB fallback.
//
//   trending  → ZSET, member = postId, score = likes in the window
//
// Cache, not truth: when Redis is cold/down we fall back to a "recent popular"
// query so the endpoint stays up (degraded — the column counts can be stale).

import { prisma } from '../../db/index.js';
import { redis } from '../../redis.js';
import { feedInclude, withIsLiked } from './currentUserPostController.js';
import { withLikeCounts } from './likeCounts.js';

export const TRENDING_KEY = 'trending';

/** Top trending post ids (highest score first), or null to signal DB fallback. */
export async function getTrendingPostIds(limit: number): Promise<number[] | null> {
  if (redis.status !== 'ready') return null;
  try {
    const ids = await redis.zrevrange(TRENDING_KEY, 0, limit - 1);
    if (ids.length === 0) return null;
    return ids.map(Number);
  } catch (err) {
    console.error('[trending] redis read failed, falling back to db:', (err as Error).message);
    return null;
  }
}

/** Degraded fallback: recent posts ordered by their stored like count. */
async function recentPopularFromDb(limit: number, viewerId: number | undefined) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const posts = await prisma.post.findMany({
    where: { isDeleted: false, createdAt: { gte: since } },
    orderBy: { likesCount: 'desc' },
    take: limit,
    include: feedInclude(viewerId),
  });
  return withLikeCounts(posts.map(withIsLiked));
}

/**
 * Resolve the trending feed: Flink's Redis ranking hydrated from Postgres (kept
 * in ZSET score order), or the DB fallback. Trending is a bounded top-K, so
 * there's no pagination cursor.
 */
export async function getTrendingFeed(limit: number, viewerId: number | undefined) {
  const ids = await getTrendingPostIds(limit);
  if (ids === null) return recentPopularFromDb(limit, viewerId);

  const rows = await prisma.post.findMany({
    where: { id: { in: ids }, isDeleted: false },
    include: feedInclude(viewerId),
  });
  // Preserve the trending rank (Redis order), not the DB order; drop any
  // stale/deleted ids that no longer hydrate.
  const byId = new Map(rows.map((p) => [p.id, p]));
  const ranked = ids.map((id) => byId.get(id)).filter((p) => p !== undefined);
  return withLikeCounts(ranked.map(withIsLiked));
}
