import Redis from 'ioredis';
import { Pool } from 'pg';

import { batchInsert } from '../../prisma/seed/batchInsert.js';

// Load generator / measurement harness for the trending pipeline
// (Postgres → Debezium → Redpanda → Flink window → Redis ZSET; see
// docs/trending.md). It writes real `Like` rows and watches the live job, so
// the numbers reflect the whole CDC + stream-processing path, not a mock.
//
//   MODE=verify     pnpm --filter server loadtest:trending   # ranking + end-to-end freshness
//   MODE=throughput LIKES=100000 pnpm --filter server loadtest:trending
//
// Assumes the stack is up: pnpm cdc:up && pnpm flink:up && pnpm flink:submit.
const MODE = process.env.MODE ?? process.argv[2] ?? 'verify';
const TRENDING_KEY = 'trending';
const FLINK = process.env.FLINK_URL ?? 'http://localhost:8081';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Make N fresh posts (authored by user 1) so like counts are clean — no
// collision with seed likes on existing posts.
async function makePosts(n: number, label: string): Promise<number[]> {
  const client = await pool.connect();
  try {
    const ids: number[] = [];
    for (let i = 0; i < n; i++) {
      const { rows } = await client.query<{ id: number }>(
        `INSERT INTO "Post" ("postedById", text, "updatedAt") VALUES (1, $1, now()) RETURNING id`,
        [`${label} ${i}`],
      );
      ids.push(rows[0].id);
    }
    return ids;
  } finally {
    client.release();
  }
}

// Insert `count` likes on `postId` from a distinct block of user ids, all at the
// given event time (the like's createdAt — what Flink buckets on).
async function likePost(
  postId: number,
  userStart: number,
  count: number,
  createdAt: Date,
) {
  const client = await pool.connect();
  try {
    const rows = Array.from({ length: count }, (_, i) => [
      userStart + i,
      postId,
      createdAt,
    ]);
    await batchInsert(client, 'Like', ['userId', 'postId', 'createdAt'], rows, {
      onConflict: 'ON CONFLICT DO NOTHING',
    });
  } finally {
    client.release();
  }
}

// Current cumulative records the Flink source has emitted into the pipeline.
async function flinkSourceRecords(): Promise<number> {
  const jobs = (await (await fetch(`${FLINK}/jobs/overview`)).json()) as {
    jobs: { jid: string; name: string; state: string }[];
  };
  const job = jobs.jobs.find((j) => j.name === 'owl-trending' && j.state === 'RUNNING');
  if (!job) throw new Error('owl-trending job not RUNNING — submit it first');
  const detail = (await (await fetch(`${FLINK}/jobs/${job.jid}`)).json()) as {
    vertices: { name: string; metrics: { 'write-records': number } }[];
  };
  const source = detail.vertices.find((v) => v.name.startsWith('Source'))!;
  return source.metrics['write-records'];
}

async function verify() {
  // A clean ranking we control: A > B > C, plus a small "advancer" post whose
  // now() likes push the watermark ~2 min past the burst so the windows
  // containing it become complete and fire.
  const now = Date.now();
  const past = new Date(now - 150_000); // 2.5 min ago — safely inside the 1h window
  const [a, b, c] = await makePosts(3, 'trend-verify');
  const [adv] = await makePosts(1, 'trend-advancer');
  console.log(`posts: A=${a} (60 likes) B=${b} (40) C=${c} (20), advancer=${adv}`);

  await likePost(a, 1, 60, past);
  await likePost(b, 1, 40, past);
  await likePost(c, 1, 20, past);
  // Advancers at now() drive the watermark forward (max event time − 30s bound).
  await likePost(adv, 1, 5, new Date(now));
  const committed = Date.now();
  console.log('burst committed; polling trending ZSET…');

  // Wait until the ZSET reflects our ranking (A on top), or time out.
  const deadline = committed + 120_000;
  let seen = 0;
  while (Date.now() < deadline) {
    const top = await redis.zrevrange(TRENDING_KEY, 0, 0);
    if (top[0] === String(a)) {
      seen = Date.now();
      break;
    }
    await sleep(200);
  }
  const ranking = await redis.zrevrange(TRENDING_KEY, 0, 4, 'WITHSCORES');
  if (!seen) {
    console.log('TIMED OUT waiting for ZSET to reflect the burst. Current:', ranking);
    return;
  }
  console.log(`end-to-end freshness: ${((seen - committed) / 1000).toFixed(1)} s ` +
    `(PG commit → trending ZSET; includes the window/watermark wait)`);
  console.log('ZSET top:', ranking);
}

async function throughput() {
  const LIKES = Number(process.env.LIKES ?? 100_000);
  const POSTS = Number(process.env.POSTS ?? 20);
  const perPost = Math.floor(LIKES / POSTS);
  const ids = await makePosts(POSTS, 'trend-load');
  console.log(`inserting ~${perPost * POSTS} likes across ${POSTS} posts at now()…`);

  const srcBefore = await flinkSourceRecords();
  const t0 = Date.now();
  // Reuse users 1..perPost for every post: (user, postA) and (user, postB) are
  // already distinct Like rows, so we don't need POSTS*perPost distinct users —
  // perPost just has to be <= the seeded user count.
  for (let i = 0; i < POSTS; i++) {
    await likePost(ids[i], 1, perPost, new Date());
  }
  const insertMs = Date.now() - t0;
  console.log(`DB insert: ${perPost * POSTS} rows in ${insertMs} ms ` +
    `(${Math.round((perPost * POSTS) / insertMs * 1000)} likes/s written)`);

  // Sample the source until it has drained the burst, measuring its rate.
  console.log('draining through CDC → Flink…');
  let prev = srcBefore;
  let stableTicks = 0;
  const rateStart = Date.now();
  let lastRate = 0;
  while (stableTicks < 4 && Date.now() - rateStart < 120_000) {
    await sleep(1000);
    const cur = await flinkSourceRecords();
    lastRate = cur - prev;
    if (lastRate > 0) console.log(`  Flink source: +${lastRate} rec/s (total +${cur - srcBefore})`);
    stableTicks = lastRate === 0 ? stableTicks + 1 : 0;
    prev = cur;
  }
  const drained = await flinkSourceRecords();
  const totalMs = Date.now() - rateStart;
  console.log(`Flink processed ${drained - srcBefore} records in ~${(totalMs / 1000).toFixed(0)}s ` +
    `(~${Math.round((drained - srcBefore) / (totalMs / 1000))} rec/s sustained)`);
}

async function main() {
  if (MODE === 'throughput') await throughput();
  else await verify();
  await pool.end();
  redis.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
