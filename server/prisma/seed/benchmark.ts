// Runs EXPLAIN (ANALYZE, BUFFERS) on the queries behind the main feed
// endpoints and prints a Markdown report. Run it before and after adding
// indexes to capture the difference.
//
//   pnpm --filter server exec tsx prisma/seed/benchmark.ts > before.md
//
// Uses a deep cursor so the cost of scanning isn't hidden by stopping early.

import { Pool } from 'pg';

const DEEP_POST_CURSOR = 500_000; // page deep into a 1M-row table
const LIMIT = 10;

type Query = { name: string; sql: string; params: unknown[] };

async function scalar(pool: Pool, sql: string): Promise<number> {
  const { rows } = await pool.query<{ v: string | number }>(sql);
  return Number(rows[0]?.v ?? 0);
}

async function explain(pool: Pool, q: Query): Promise<void> {
  const { rows } = await pool.query<{ 'QUERY PLAN': string }>(
    `EXPLAIN (ANALYZE, BUFFERS) ${q.sql}`,
    q.params,
  );
  const plan = rows.map((r) => r['QUERY PLAN']).join('\n');
  const execLine = plan
    .split('\n')
    .find((l) => l.startsWith('Execution Time'));
  const seqScans = (plan.match(/Seq Scan/g) ?? []).length;

  console.log(`### ${q.name}\n`);
  console.log(`- ${execLine ?? 'Execution Time: ?'}`);
  console.log(`- Seq Scans in plan: ${seqScans}\n`);
  console.log('```');
  console.log(plan);
  console.log('```\n');
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set.');
  const pool = new Pool({ connectionString, max: 2 });

  try {
    // Representative parameters drawn from the seeded data.
    const heavyFollower = await scalar(
      pool,
      'SELECT id AS v FROM "User" ORDER BY "followingCount" DESC LIMIT 1',
    );
    const activeAuthor = await scalar(
      pool,
      'SELECT "postedById" AS v FROM "Post" GROUP BY 1 ORDER BY count(*) DESC LIMIT 1',
    );
    const popularParent = await scalar(
      pool,
      `SELECT "parentPostId" AS v FROM "Post" WHERE "parentPostId" IS NOT NULL
       GROUP BY 1 ORDER BY count(*) DESC LIMIT 1`,
    );
    const activeLiker = await scalar(
      pool,
      'SELECT "userId" AS v FROM "Like" GROUP BY 1 ORDER BY count(*) DESC LIMIT 1',
    );
    const deepLikeCursor = await scalar(
      pool,
      'SELECT max(id) / 2 AS v FROM "Like"',
    );

    console.log('# Feed query benchmarks\n');
    console.log(
      `Params: heavyFollower=${heavyFollower}, activeAuthor=${activeAuthor}, ` +
        `popularParent=${popularParent}, activeLiker=${activeLiker}, ` +
        `postCursor=${DEEP_POST_CURSOR}, likeCursor=${deepLikeCursor}\n`,
    );

    const queries: Query[] = [
      {
        name: 'Following feed (getFollowingPosts)',
        sql: `SELECT * FROM "Post"
              WHERE "postedById" IN (
                SELECT "followingId" FROM "UserFollows" WHERE "followerId" = $1
              )
              AND "isDeleted" = false AND "id" < $2
              ORDER BY "id" DESC LIMIT $3`,
        params: [heavyFollower, DEEP_POST_CURSOR, LIMIT],
      },
      {
        name: 'Hot feed (getHotPosts)',
        sql: `SELECT * FROM "Post"
              WHERE "isDeleted" = false AND "id" < $1
              ORDER BY "id" DESC LIMIT $2`,
        params: [DEEP_POST_CURSOR, LIMIT],
      },
      {
        name: 'Replies to a post (getChildPosts)',
        sql: `SELECT * FROM "Post"
              WHERE "parentPostId" = $1 AND "isDeleted" = false
              ORDER BY "id" DESC LIMIT $2`,
        params: [popularParent, LIMIT],
      },
      {
        name: 'User posts (getUserPosts)',
        sql: `SELECT * FROM "Post"
              WHERE "postedById" = $1 AND "parentPostId" IS NULL
              AND "isDeleted" = false
              ORDER BY "id" DESC LIMIT $2`,
        params: [activeAuthor, LIMIT],
      },
      {
        name: 'Liked feed (getLikedPosts)',
        sql: `SELECT l.id, p.*
              FROM "Like" l JOIN "Post" p ON p.id = l."postId"
              WHERE l."userId" = $1 AND l."id" < $2 AND p."isDeleted" = false
              ORDER BY l."id" DESC LIMIT $3`,
        params: [activeLiker, deepLikeCursor, LIMIT],
      },
    ];

    for (const q of queries) {
      await explain(pool, q);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
