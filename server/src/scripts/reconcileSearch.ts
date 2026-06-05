// Rebuilds the Elasticsearch search indices (owl-posts, owl-users) from Postgres.
// The indices are a cache — cold/missing indices already fall back to the ILIKE
// query — so this is for the initial backfill and for repairing drift from the
// searchIndexer consumer, not for correctness.
//
//   pnpm --filter server search:reconcile          # both indices
//   pnpm --filter server search:reconcile -- posts # only posts
//   pnpm --filter server search:reconcile -- users # only users
//
// Indices are dropped and recreated with their mappings, then bulk-loaded with
// keyset pagination over Postgres (so the 1M-post load-test set streams in
// batches instead of loading into memory). The bulk helper handles chunking and
// backpressure.

import { Pool } from 'pg';

import { es } from '../elasticsearch.js';
import {
  ensureSearchIndices,
  POSTS_INDEX,
  toPostDoc,
  toUserDoc,
  USERS_INDEX,
} from '../features/search/search.js';

const BATCH = 5000;

/** Page a table by ascending id, yielding one row at a time across batches. */
async function* pageById<T extends { id: number }>(
  pool: Pool,
  sql: (afterId: number, limit: number) => string,
  params: (afterId: number, limit: number) => unknown[],
): AsyncGenerator<T> {
  let afterId = 0;
  for (;;) {
    const { rows } = await pool.query<T>(sql(afterId, BATCH), params(afterId, BATCH));
    if (rows.length === 0) return;
    for (const row of rows) yield row;
    afterId = rows[rows.length - 1].id;
    if (rows.length < BATCH) return;
  }
}

async function bulkIndex<T extends { id: number }>(
  index: string,
  source: AsyncGenerator<T>,
  toDoc: (row: T) => object,
): Promise<number> {
  let queued = 0;
  const result = await es.helpers.bulk({
    datasource: source,
    // Tuple form: the action targets the row by id, the second element is the
    // trimmed document body actually indexed (so `id`/`isDeleted` aren't stored).
    onDocument: (row) => {
      // Heartbeat so a multi-minute backfill of the 1M set shows progress rather
      // than looking hung (the bulk helper otherwise only resolves at the end).
      if (++queued % 50_000 === 0) process.stdout.write(`  queued ${queued}...\r`);
      return [{ index: { _index: index, _id: String(row.id) } }, toDoc(row)];
    },
    onDrop: (doc) => console.error(`[search:reconcile] dropped ${index} doc:`, doc.error),
  });
  return result.successful;
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set.');

  const which = process.argv.slice(2);
  const doPosts = which.length === 0 || which.includes('posts');
  const doUsers = which.length === 0 || which.includes('users');

  const pool = new Pool({ connectionString, max: 2 });
  const started = Date.now();
  try {
    // Fresh start: drop then recreate with mappings (encapsulated in search.ts).
    if (doPosts) await es.indices.delete({ index: POSTS_INDEX }, { ignore: [404] });
    if (doUsers) await es.indices.delete({ index: USERS_INDEX }, { ignore: [404] });
    await ensureSearchIndices();

    if (doPosts) {
      console.log('Indexing posts...');
      const posts = pageById<{ id: number; text: string; postedById: number }>(
        pool,
        () =>
          `SELECT id, text, "postedById" FROM "Post"
            WHERE "isDeleted" = false AND id > $1 ORDER BY id ASC LIMIT $2`,
        (afterId, limit) => [afterId, limit],
      );
      const n = await bulkIndex(POSTS_INDEX, posts, toPostDoc);
      console.log(`✓ indexed ${n} posts`);
    }

    if (doUsers) {
      console.log('Indexing users...');
      const users = pageById<{ id: number; username: string; name: string | null }>(
        pool,
        () =>
          `SELECT id, username, name FROM "User"
            WHERE id > $1 ORDER BY id ASC LIMIT $2`,
        (afterId, limit) => [afterId, limit],
      );
      const n = await bulkIndex(USERS_INDEX, users, toUserDoc);
      console.log(`✓ indexed ${n} users`);
    }

    const secs = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`Done in ${secs}s`);
  } finally {
    await pool.end();
    await es.close();
  }
}

main().catch((err: unknown) => {
  console.error('\nReconcile failed:', err);
  process.exit(1);
});
