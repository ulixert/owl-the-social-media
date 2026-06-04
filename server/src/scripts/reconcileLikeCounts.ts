// Rebuilds the Redis like-count view from the source of truth (Postgres).
// Run once to seed it, and any time to repair drift from the CDC consumer.
//
//   pnpm --filter server like:reconcile
//
// Sets post:{id}:likes for every post with at least one like. Posts with zero
// likes are left unset (reads fall back to 0 / the DB column). For a full
// rebuild from scratch, FLUSHDB first.

import { Pool } from 'pg';

import { likeCountKey } from '../features/post/likeCounts.js';
import { redis } from '../redis.js';

const BATCH = 5000;

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set.');
  const pool = new Pool({ connectionString, max: 2 });

  const started = Date.now();
  try {
    console.log('Reconciling like counts from Postgres...');
    const { rows } = await pool.query<{ postId: number; count: number }>(
      'SELECT "postId", count(*)::int AS count FROM "Like" GROUP BY "postId"',
    );
    console.log(`Computed ${rows.length} post counts; writing to Redis...`);

    let written = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
      const pipeline = redis.pipeline();
      for (const row of rows.slice(i, i + BATCH)) {
        pipeline.set(likeCountKey(row.postId), row.count);
      }
      await pipeline.exec();
      written += Math.min(BATCH, rows.length - i);
      process.stdout.write(`  ${written}/${rows.length}\r`);
    }

    const secs = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`\n✓ reconciled ${written} post like counts in ${secs}s`);
  } finally {
    await pool.end();
    redis.disconnect();
  }
}

main().catch((err: unknown) => {
  console.error('\nReconcile failed:', err);
  process.exit(1);
});
