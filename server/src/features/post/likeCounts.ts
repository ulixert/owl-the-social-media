import { redis } from '../../redis.js';

// The Redis key holding the derived like count for a post.
export const likeCountKey = (postId: number) => `post:${postId}:likes`;

type PostWithLikeCount = { id: number; likesCount: number };

/**
 * Overrides each post's `likesCount` with the Redis serving view. Falls back to
 * the value already on the row (the last DB value) on a miss, a Redis error, or
 * when Redis isn't connected — the read path stays up even if the view is down.
 * Mutates in place and returns the same array.
 */
export async function withLikeCounts<T extends PostWithLikeCount>(
  posts: T[],
): Promise<T[]> {
  if (posts.length === 0 || redis.status !== 'ready') return posts;

  try {
    const counts = await redis.mget(posts.map((p) => likeCountKey(p.id)));
    posts.forEach((post, i) => {
      const value = counts[i];
      if (value !== null) post.likesCount = Number(value);
    });
  } catch (err) {
    console.error(
      '[likeCounts] redis read failed, using db counts:',
      (err as Error).message,
    );
  }
  return posts;
}

export type LikeEffect = { postId: number; delta: number };

type DebeziumLikeValue = {
  op?: string;
  before?: { postId?: number } | null;
  after?: { postId?: number } | null;
};

/**
 * Pure mapping from a Debezium `Like` change event (JSON, schemas off) to its
 * effect on the per-post counter: create/snapshot-read => +1, delete => -1.
 * Decrements rely on the `Like` table having REPLICA IDENTITY FULL so the
 * delete's `before` image carries `postId`. Returns null for events that don't
 * affect the count.
 */
export function likeEventEffect(
  value: DebeziumLikeValue | null,
): LikeEffect | null {
  switch (value?.op) {
    case 'c':
    case 'r':
      return typeof value.after?.postId === 'number'
        ? { postId: value.after.postId, delta: 1 }
        : null;
    case 'd':
      return typeof value.before?.postId === 'number'
        ? { postId: value.before.postId, delta: -1 }
        : null;
    default:
      return null;
  }
}
