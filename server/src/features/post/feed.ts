// The timeline fan-out view: a per-user "Following" feed precomputed in Redis,
// maintained from the CDC stream (owl.public.Post) by the timelineFanout consumer.
//
//   feed:{userId}  → ZSET, member = postId, score = postId
//
// Post ids are monotonic with creation time, so scoring by id gives chronological
// order and matches the keyset-by-id pagination used everywhere else (the cursor
// is a post id). The feed is a CACHE, not the source of truth: Postgres stays
// authoritative and the read path falls back to a plain query when Redis is cold
// or down (see getFollowingPosts).

import { prisma } from '../../db/index.js';
import { redis } from '../../redis.js';

/** Newest N posts kept per feed; deeper pages fall back to Postgres. */
export const FEED_MAX = Number(process.env.FEED_MAX ?? 800);

/** Authors with at least this many followers are NOT fanned out (write
 *  amplification); their posts are merged in at read time instead. */
export const CELEBRITY_FOLLOWER_THRESHOLD = Number(
  process.env.CELEBRITY_FOLLOWER_THRESHOLD ?? 10_000,
);

export const feedKey = (userId: number) => `feed:${userId}`;

export type FeedEffect = {
  op: 'add' | 'remove';
  postId: number;
  authorId: number;
};

type DebeziumPostRow = {
  id?: number;
  postedById?: number;
  isDeleted?: boolean;
} | null;

type DebeziumPostValue = {
  op?: string;
  before?: DebeziumPostRow;
  after?: DebeziumPostRow;
};

/**
 * Pure mapping from a Debezium `Post` change event (JSON, schemas off) to its
 * effect on the per-user feeds:
 *   - create / snapshot-read of a live post  => add
 *   - update that flips isDeleted to true     => remove (soft delete)
 *   - hard delete                             => remove (needs before.postedById)
 * Returns null for events that don't change feed membership.
 */
export function postEventEffect(value: unknown): FeedEffect | null {
  const event = value as DebeziumPostValue | null;
  const row = (which: DebeziumPostRow | undefined): FeedEffect | null =>
    typeof which?.id === 'number' && typeof which?.postedById === 'number'
      ? { op: 'add', postId: which.id, authorId: which.postedById }
      : null;

  switch (event?.op) {
    case 'c':
    case 'r': {
      if (event.after?.isDeleted) return null;
      return row(event.after);
    }
    case 'u': {
      // Only soft-deletes change membership; ordinary edits don't.
      if (!event.after?.isDeleted) return null;
      const effect = row(event.after);
      return effect && { ...effect, op: 'remove' };
    }
    case 'd': {
      // Hard delete: the before image carries postedById only with REPLICA
      // IDENTITY FULL; without it we return null and rely on read-time hydration
      // (which filters deleted/missing posts) as the safety net.
      const effect = row(event.before);
      return effect && { ...effect, op: 'remove' };
    }
    default:
      return null;
  }
}

/**
 * Merge the fanned-out feed ids (Redis) with celebrity post ids (DB), newest
 * first, de-duplicated, capped to `limit`. Pure — both inputs are id lists.
 */
export function mergeFeedPages(
  redisIds: number[],
  celebIds: number[],
  limit: number,
): number[] {
  const unique = [...new Set([...redisIds, ...celebIds])];
  unique.sort((a, b) => b - a);
  return unique.slice(0, limit);
}

/** The celebrity authors a user follows (resolved from the DB, always current). */
export async function getFollowedCelebrities(userId: number): Promise<number[]> {
  const rows = await prisma.userFollows.findMany({
    where: {
      followerId: userId,
      following: { followersCount: { gte: CELEBRITY_FOLLOWER_THRESHOLD } },
    },
    select: { followingId: true },
  });
  return rows.map((r) => r.followingId);
}

/**
 * Resolve the page of post ids for a user's Following feed, hybrid-style:
 * the Redis fan-out slice merged with recent posts from followed celebrities.
 * Returns null to signal the caller should fall back to the plain DB query —
 * when Redis is down, the feed isn't built yet, or we've paged past what Redis
 * holds (deeper history lives only in Postgres).
 */
export async function getFollowingFeedIds(
  userId: number,
  cursor: number,
  limit: number,
): Promise<number[] | null> {
  if (redis.status !== 'ready') return null;

  try {
    if (!(await redis.exists(feedKey(userId)))) return null;

    const max = cursor > 0 ? `(${cursor}` : '+inf';
    const redisIds = (
      await redis.zrevrangebyscore(
        feedKey(userId),
        max,
        '-inf',
        'LIMIT',
        0,
        limit,
      )
    ).map(Number);

    // No fanned-out posts at/under the cursor: cold or past the cap — fall back.
    if (redisIds.length === 0) return null;

    const celebrities = await getFollowedCelebrities(userId);
    let celebIds: number[] = [];
    if (celebrities.length > 0) {
      const rows = await prisma.post.findMany({
        where: {
          postedById: { in: celebrities },
          isDeleted: false,
          ...(cursor > 0 ? { id: { lt: cursor } } : {}),
        },
        orderBy: { id: 'desc' },
        take: limit,
        select: { id: true },
      });
      celebIds = rows.map((r) => r.id);
    }

    return mergeFeedPages(redisIds, celebIds, limit);
  } catch (err) {
    console.error('[feed] redis read failed, falling back to db:', (err as Error).message);
    return null;
  }
}
