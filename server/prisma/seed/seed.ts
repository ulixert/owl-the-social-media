// Seeds a realistic dataset for performance work: a power-law social graph
// where a handful of "celebrity" accounts (the lowest ids) collect most
// followers, posts spread over the past year, and popularity-skewed likes.
//
// Run with:  SEED_CONFIRM=1 pnpm --filter server seed
// Scale via: SEED_USERS / SEED_POSTS / SEED_LIKES (smoke-test small first).
//
// It talks to Postgres directly through a pg Pool (bypassing Prisma) so it can
// use fast multi-row INSERTs and explicit ids.

import { Pool } from 'pg';

import { batchInsert } from './batchInsert.js';
import { buildSentencePool, makeName } from './data.js';
import { logUniformInt, makeZipfSampler, mulberry32, uniformInt } from './rng.js';

const USERS = Number(process.env.SEED_USERS ?? 100_000);
const POSTS = Number(process.env.SEED_POSTS ?? 1_000_000);
const LIKES = Number(process.env.SEED_LIKES ?? 7_000_000);

const CELEBRITIES = 20; // lowest ids; collect the most followers
const FOLLOW_CAP = 150; // max accounts a normal user follows
const REPLY_RATIO = 0.12; // fraction of posts that are replies
const DAYS_WINDOW = 365;
const CHUNK = 50_000; // rows buffered before a flush

const PASSWORD = 'seeded-account-no-login';
const NOW = Date.now();
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function logProgress(label: string, done: number, total: number): void {
  const pct = ((done / total) * 100).toFixed(0);
  process.stdout.write(`  ${label}: ${done}/${total} (${pct}%)\r`);
}

async function main(): Promise<void> {
  if (process.env.SEED_CONFIRM !== '1') {
    throw new Error(
      'Refusing to seed without SEED_CONFIRM=1 (this TRUNCATEs all tables).',
    );
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set.');

  const rand = mulberry32(Number(process.env.SEED_SEED ?? 42));
  const pool = new Pool({ connectionString, max: 4 });
  const client = await pool.connect();

  const started = Date.now();
  try {
    // Bulk-load tuning: durability is irrelevant for a throwaway seed DB.
    await client.query('SET synchronous_commit = off');

    console.log('Truncating existing data...');
    await client.query(
      'TRUNCATE "Like","Save","Repost","UserFollows","Post","User" RESTART IDENTITY CASCADE',
    );

    // ---- Users (explicit ids 1..USERS) ----
    console.log(`Seeding ${USERS} users...`);
    await client.query('BEGIN');
    {
      const cols = [
        'id',
        'username',
        'email',
        'name',
        'password',
        'biography',
        'createdAt',
        'updatedAt',
      ];
      let buffer: unknown[][] = [];
      for (let id = 1; id <= USERS; id++) {
        const created = new Date(NOW - uniformInt(rand, 0, DAYS_WINDOW) * MS_PER_DAY);
        buffer.push([
          id,
          `user${id}`,
          `user${id}@example.com`,
          makeName(rand),
          PASSWORD,
          id <= CELEBRITIES ? 'Verified account' : null,
          created,
          created,
        ]);
        if (buffer.length >= CHUNK) {
          await batchInsert(client, 'User', cols, buffer);
          logProgress('users', id, USERS);
          buffer = [];
        }
      }
      await batchInsert(client, 'User', cols, buffer);
    }
    await client.query('COMMIT');
    process.stdout.write('\n');

    // ---- Follows (power-law: celebrities dominate followers) ----
    console.log('Seeding follow graph...');
    const userZipf = makeZipfSampler(USERS, 1.07, rand);
    await client.query('BEGIN');
    {
      const cols = ['followerId', 'followingId'];
      let buffer: unknown[][] = [];
      let edges = 0;
      for (let follower = 1; follower <= USERS; follower++) {
        const count = logUniformInt(rand, 1, FOLLOW_CAP);
        const seen = new Set<number>([follower]); // never self-follow
        for (let k = 0; k < count; k++) {
          const target = userZipf();
          if (seen.has(target)) continue;
          seen.add(target);
          buffer.push([follower, target]);
          edges++;
        }
        if (buffer.length >= CHUNK) {
          await batchInsert(client, 'UserFollows', cols, buffer, {
            onConflict: 'ON CONFLICT DO NOTHING',
          });
          logProgress('follows (users)', follower, USERS);
          buffer = [];
        }
      }
      await batchInsert(client, 'UserFollows', cols, buffer, {
        onConflict: 'ON CONFLICT DO NOTHING',
      });
      process.stdout.write(`\n  ${edges} follow edges\n`);
    }
    await client.query('COMMIT');

    // ---- Posts (explicit ids 1..POSTS, createdAt monotonic with id) ----
    console.log(`Seeding ${POSTS} posts...`);
    // Timestamps sorted ascending so id order matches chronological order;
    // this is what makes id-keyset pagination a valid stand-in for createdAt.
    const timestamps = new Float64Array(POSTS);
    for (let i = 0; i < POSTS; i++) {
      timestamps[i] = NOW - rand() * DAYS_WINDOW * MS_PER_DAY;
    }
    timestamps.sort();

    const sentences = buildSentencePool(2000, rand);
    const authorZipf = makeZipfSampler(USERS, 0.8, rand);
    await client.query('BEGIN');
    {
      const cols = [
        'id',
        'postedById',
        'parentPostId',
        'text',
        'images',
        'isDeleted',
        'createdAt',
        'updatedAt',
      ];
      let buffer: unknown[][] = [];
      for (let i = 0; i < POSTS; i++) {
        const id = i + 1;
        const isReply = i > 0 && rand() < REPLY_RATIO;
        const parentId = isReply ? uniformInt(rand, 1, i) : null;
        const created = new Date(timestamps[i]);
        buffer.push([
          id,
          authorZipf(),
          parentId,
          sentences[Math.floor(rand() * sentences.length)],
          [],
          false,
          created,
          created,
        ]);
        if (buffer.length >= CHUNK) {
          await batchInsert(client, 'Post', cols, buffer);
          logProgress('posts', id, POSTS);
          buffer = [];
        }
      }
      await batchInsert(client, 'Post', cols, buffer);
    }
    await client.query('COMMIT');
    process.stdout.write('\n');

    // ---- Likes (popularity-skewed; ON CONFLICT dedups) ----
    console.log(`Seeding ${LIKES} likes...`);
    const postZipf = makeZipfSampler(POSTS, 0.9, rand);
    await client.query('BEGIN');
    {
      const cols = ['userId', 'postId', 'createdAt'];
      let buffer: unknown[][] = [];
      for (let i = 0; i < LIKES; i++) {
        buffer.push([
          uniformInt(rand, 1, USERS),
          postZipf(),
          new Date(NOW - rand() * DAYS_WINDOW * MS_PER_DAY),
        ]);
        if (buffer.length >= CHUNK) {
          await batchInsert(client, 'Like', cols, buffer, {
            onConflict: 'ON CONFLICT DO NOTHING',
          });
          logProgress('likes', i + 1, LIKES);
          buffer = [];
        }
      }
      await batchInsert(client, 'Like', cols, buffer, {
        onConflict: 'ON CONFLICT DO NOTHING',
      });
    }
    await client.query('COMMIT');
    process.stdout.write('\n');

    // ---- Denormalized counters: one aggregate pass each (never per-row) ----
    console.log('Recomputing denormalized counters...');
    await client.query('BEGIN');
    await client.query(`
      UPDATE "User" u SET "followersCount" = c.cnt
      FROM (SELECT "followingId" AS id, count(*) cnt FROM "UserFollows" GROUP BY 1) c
      WHERE u.id = c.id`);
    await client.query(`
      UPDATE "User" u SET "followingCount" = c.cnt
      FROM (SELECT "followerId" AS id, count(*) cnt FROM "UserFollows" GROUP BY 1) c
      WHERE u.id = c.id`);
    await client.query(`
      UPDATE "Post" p SET "likesCount" = c.cnt
      FROM (SELECT "postId" AS id, count(*) cnt FROM "Like" GROUP BY 1) c
      WHERE p.id = c.id`);
    await client.query(`
      UPDATE "Post" p SET "commentsCount" = c.cnt
      FROM (SELECT "parentPostId" AS id, count(*) cnt FROM "Post"
            WHERE "parentPostId" IS NOT NULL GROUP BY 1) c
      WHERE p.id = c.id`);
    await client.query('COMMIT');

    // ---- Fix sequences (explicit ids left them behind) + refresh stats ----
    console.log('Resetting sequences and analyzing...');
    for (const table of ['User', 'Post', 'UserFollows', 'Like']) {
      await client.query(
        `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'),
                       (SELECT COALESCE(MAX(id), 1) FROM "${table}"))`,
      );
    }
    await client.query('ANALYZE');

    const secs = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`\nDone in ${secs}s.`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error('\nSeed failed:', err);
  process.exit(1);
});
