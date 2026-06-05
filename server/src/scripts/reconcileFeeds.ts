// Warms the per-user "Following" feeds (feed:{userId} ZSETs) from Postgres.
// Feeds are a cache — cold feeds already fall back to the DB pull query — so this
// is for warming and for repairing drift from the fan-out consumer, not for
// correctness.
//
//   pnpm --filter server feed:reconcile            # all users
//   pnpm --filter server feed:reconcile -- 1 2 3   # only these user ids
//
// For each user it loads the newest FEED_MAX posts from the non-celebrity authors
// they follow (plus their own) and ZADDs them. Celebrities are intentionally
// excluded — they're merged at read time. On the 100k-user load-test dataset a
// full backfill is expensive; pass an explicit id list to warm a subset.

import { Pool } from 'pg';

import {
  CELEBRITY_FOLLOWER_THRESHOLD,
  FEED_MAX,
  feedKey,
} from '../features/post/feed.js';
import { redis } from '../redis.js';

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set.');
  const pool = new Pool({ connectionString, max: 2 });

  const explicitIds = process.argv
    .slice(2)
    .map(Number)
    .filter((n) => Number.isInteger(n));

  const started = Date.now();
  try {
    const { rows: users } = explicitIds.length
      ? await pool.query<{ id: number }>(
          'SELECT id FROM "User" WHERE id = ANY($1)',
          [explicitIds],
        )
      : await pool.query<{ id: number }>('SELECT id FROM "User" ORDER BY id');

    console.log(`Reconciling feeds for ${users.length} users...`);
    let done = 0;
    for (const { id: userId } of users) {
      // Newest FEED_MAX posts from non-celebrity followees + the user's own.
      const { rows: posts } = await pool.query<{ id: number }>(
        `SELECT p.id
           FROM "Post" p
          WHERE p."isDeleted" = false
            AND p."postedById" IN (
              SELECT $1::int
              UNION
              SELECT f."followingId"
                FROM "UserFollows" f
                JOIN "User" u ON u.id = f."followingId"
               WHERE f."followerId" = $1::int
                 AND u."followersCount" < $2::int
            )
          ORDER BY p.id DESC
          LIMIT $3::int`,
        [userId, CELEBRITY_FOLLOWER_THRESHOLD, FEED_MAX],
      );

      const key = feedKey(userId);
      const pipeline = redis.pipeline();
      pipeline.del(key); // rebuild from scratch (idempotent)
      for (const { id } of posts) pipeline.zadd(key, id, String(id));
      await pipeline.exec();

      done++;
      if (done % 500 === 0 || done === users.length) {
        process.stdout.write(`  ${done}/${users.length}\r`);
      }
    }

    const secs = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`\n✓ reconciled ${done} feeds in ${secs}s`);
  } finally {
    await pool.end();
    redis.disconnect();
  }
}

main().catch((err: unknown) => {
  console.error('\nReconcile failed:', err);
  process.exit(1);
});
