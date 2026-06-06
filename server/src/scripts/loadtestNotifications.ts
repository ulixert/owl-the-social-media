import Redis from 'ioredis';
import jwt from 'jsonwebtoken';
import { WebSocket } from 'ws';

import { prisma } from '../db/index.js';
import { notificationChannel } from '../features/notification/notificationService.js';

// Load test for the notification fan-out path. Opens CONN concurrent
// authenticated WebSocket connections against a running server, then publishes
// one message to each connection's Redis channel and measures the publish→receive
// delivery latency (p50/p99). This isolates the thing we scale — the WebSocket
// hub + Redis pub/sub fan-out — from the DB write, so the number reflects
// transport behaviour under load on a single API instance.
//
// Run against a live server (see package.json `loadtest:notifications`):
//   CONN=5000 ROUNDS=5 pnpm --filter server loadtest:notifications
const CONN = Number(process.env.CONN ?? process.argv[2] ?? 1000);
const ROUNDS = Number(process.env.ROUNDS ?? 5);
const HOST = process.env.WS_HOST ?? 'localhost:3000';
const OPEN_BATCH = 500; // connections opened per batch, to avoid a thundering herd
const DELIVER_TIMEOUT_MS = 10_000;
const SECRET = process.env.ACCESS_TOKEN_SECRET;

type TaggedWS = WebSocket & { userId: number };

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return NaN;
  const idx = Math.min(
    sortedAsc.length - 1,
    Math.floor((p / 100) * sortedAsc.length),
  );
  return sortedAsc[idx];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!SECRET) throw new Error('ACCESS_TOKEN_SECRET not set (run with --env-file=.env)');

  // Real, existing user ids so the hub's user-exists check passes.
  const users = await prisma.user.findMany({
    select: { id: true },
    orderBy: { id: 'asc' },
    take: CONN,
  });
  const ids = users.map((u) => u.id);
  console.log(`Target: ${ids.length} connections to ws://${HOST}, ${ROUNDS} rounds`);

  // Per-round latency collector; the message handler computes recv − publish.
  let latencies: number[] = [];
  const sockets: TaggedWS[] = [];

  const openOne = (id: number) =>
    new Promise<void>((resolve) => {
      const token = jwt.sign({ userId: id }, SECRET, { expiresIn: '15m' });
      const ws = new WebSocket(
        `ws://${HOST}/api/v1/ws?token=${token}`,
      ) as TaggedWS;
      ws.userId = id;
      ws.on('open', () => resolve());
      ws.on('error', () => resolve()); // count established below; failures just don't open
      ws.on('message', (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString()) as { __t?: number };
          if (msg.__t) latencies.push(Date.now() - msg.__t);
        } catch {
          /* ignore */
        }
      });
      sockets.push(ws);
    });

  // Open in batches and time it.
  const openStart = Date.now();
  for (let i = 0; i < ids.length; i += OPEN_BATCH) {
    await Promise.all(ids.slice(i, i + OPEN_BATCH).map(openOne));
  }
  const established = sockets.filter((s) => s.readyState === WebSocket.OPEN).length;
  const openMs = Date.now() - openStart;
  console.log(
    `Established ${established}/${ids.length} connections in ${openMs} ms ` +
      `(${Math.round((established / openMs) * 1000)} conn/s)`,
  );

  // Dedicated publisher (mirrors what the API does on a like/follow/reply).
  const pub = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

  const openIds = sockets
    .filter((s) => s.readyState === WebSocket.OPEN)
    .map((s) => s.userId);

  const roundStats: { delivered: number; p50: number; p99: number; max: number }[] = [];
  for (let round = 1; round <= ROUNDS; round++) {
    latencies = [];
    // One message per connected user, each stamped at its own publish moment.
    const pipeline = pub.pipeline();
    for (const id of openIds) {
      pipeline.publish(
        notificationChannel(id),
        JSON.stringify({ __t: Date.now(), type: 'LIKE' }),
      );
    }
    await pipeline.exec();

    // Wait until everything lands (or the timeout).
    const deadline = Date.now() + DELIVER_TIMEOUT_MS;
    while (latencies.length < openIds.length && Date.now() < deadline) {
      await sleep(20);
    }

    const sorted = [...latencies].sort((a, b) => a - b);
    const stat = {
      delivered: sorted.length,
      p50: percentile(sorted, 50),
      p99: percentile(sorted, 99),
      max: sorted.length ? sorted[sorted.length - 1] : NaN,
    };
    roundStats.push(stat);
    console.log(
      `round ${round}: delivered ${stat.delivered}/${openIds.length}  ` +
        `p50 ${stat.p50}ms  p99 ${stat.p99}ms  max ${stat.max}ms`,
    );
    await sleep(500);
  }

  // Aggregate across rounds (drop round 1 as warm-up if more than one round).
  const measured = roundStats.length > 1 ? roundStats.slice(1) : roundStats;
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  console.log('\n=== summary (excl. warm-up round) ===');
  console.log(`connections established : ${established}`);
  console.log(`open throughput         : ${Math.round((established / openMs) * 1000)} conn/s`);
  console.log(`delivery ratio          : ${(avg(measured.map((r) => r.delivered)) / openIds.length * 100).toFixed(2)}%`);
  console.log(`fan-out latency p50      : ${avg(measured.map((r) => r.p50)).toFixed(1)} ms`);
  console.log(`fan-out latency p99      : ${avg(measured.map((r) => r.p99)).toFixed(1)} ms`);
  console.log(`fan-out latency max      : ${Math.max(...measured.map((r) => r.max))} ms`);

  for (const s of sockets) s.terminate();
  pub.disconnect();
  await prisma.$disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
