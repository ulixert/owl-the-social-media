# Feed query benchmarks

Baseline measurements for the read path, captured before and after adding
the feed indexes. This is the "before" for the larger goal of moving hot
reads onto a derived-state/streaming layer — you can't justify Redis or
fan-out without numbers showing where single-node Postgres actually hurts.

## Setup

- Dataset (seeded via `pnpm --filter server seed`): **100k users, 1M posts,
  ~2.3M follow edges, ~6.7M likes**, with a Zipf-distributed social graph
  (a few celebrity accounts collect most followers, popular posts most likes).
- Postgres 16, local. Each query run with `EXPLAIN (ANALYZE, BUFFERS)` at a
  deep cursor (`id < 500000`) so the cost isn't hidden by stopping early.
- Reproduce: `pnpm --filter server exec tsx prisma/seed/benchmark.ts`.

## Results

| Query | Before | After | Speedup |
| --- | --- | --- | --- |
| Replies to a post (`getChildPosts`) | 270.05 ms | 0.08 ms | ~3300× |
| Liked feed (`getLikedPosts`) | 24.83 ms | 1.28 ms | ~19× |
| User posts (`getUserPosts`) | 3.70 ms | 0.10 ms | ~36× |
| Following feed (`getFollowingPosts`) | 9.42 ms | 1.14 ms | ~8× |
| Hot feed (`getHotPosts`) | 0.017 ms | 0.026 ms | already optimal |

## Why the numbers look like this

**Some queries were already fast.** Once pagination became id-keyset
(`ORDER BY id DESC, WHERE id < cursor`), the hot feed rides the primary-key
index directly — no extra index helps. The following feed and the liked feed
were also reasonable before, because the existing `@@unique([followerId,
followingId])` and `@@unique([userId, postId])` constraints already index the
membership lookups by their leading column.

**The dramatic win is replies.** Filtering `WHERE parentPostId = ?` had no
supporting index, so Postgres ran a parallel sequential scan over all 1M posts
and threw away ~333k rows per worker:

```
->  Parallel Seq Scan on "Post"  (actual time=86.403..259.910 rows=2 loops=3)
      Filter: ((NOT "isDeleted") AND ("parentPostId" = 186))
      Rows Removed by Filter: 333331
Execution Time: 270.052 ms
```

After adding `Post(parentPostId, id)` it's an index range scan touching 11
buffers:

```
->  Index Scan Backward using "Post_parentPostId_id_idx" on "Post"
      Index Cond: ("parentPostId" = 186)
Execution Time: 0.081 ms
```

## Indexes added

Only the four the keyset queries actually use:

- `Post(postedById, id)` — user posts, following feed
- `Post(parentPostId, id)` — replies
- `Like(userId, id)` — liked feed
- `Save(userId, id)` — saved feed

Deliberately **not** added: a plain `createdAt` or `likesCount` *ordering* index.
Every feed orders by `id`, so those would never be used — dead weight on every write.

Later added (For-You rework): `Like(userId, createdAt, postId)` — a **covering**
index for a specific access pattern, not feed ordering. See below.

## For-You feed (measurement-driven)

`EXPLAIN ANALYZE` of the old For-You query (`followed OR liked-by-followed OR
likesCount>=3 ORDER BY id`) overturned the assumption: the `likesCount>=3` gate
wasn't the problem (the main scan was a fast backward PK scan). The cost was the
**social-proof subquery** — `Like WHERE userId IN (followees) ORDER BY createdAt
DESC LIMIT 50` — doing a Bitmap Heap Scan over **~4,578 random heap blocks** to fetch
`postId`/`createdAt`, then a sort: **~846 ms cold** (~5 ms warm, when those blocks
are cached). No index covered "recent likes by a set of users."

Fix: the covering index `Like(userId, createdAt, postId)` turns it into an
**Index-Only Scan** (Heap Fetches ~0, ~1 ms, cache-independent).

The feed was then redesigned (candidate generation → heuristic ranking), removing
the global OR entirely; candidate sources are bounded/indexed (~1 ms social-proof,
~0.4 ms recent-popular; followed authors O(1) from the fan-out feed when warm, or a
~168 ms backward-PK-scan DB fallback). See `docs/for-you.md`.

## Real-time notification fan-out (WebSocket + Redis pub/sub)

How far the notification path (`docs/notifications.md`) scales on a single API
instance, and what delivery latency looks like under load. Captured with the
committed harness: `CONN=<n> ROUNDS=5 pnpm --filter server loadtest:notifications`.

### Method

- One Node API instance + one Redis, local. The harness opens `CONN` concurrent
  authenticated WebSocket connections, then each round **publishes one message to
  every connection's channel at once** and records `receive − publish` (wall-clock,
  ms) per delivery. Publishing direct to Redis isolates the ws + pub/sub transport
  from the DB write.
- This is a **synchronised broadcast** — all `CONN` messages fan out in the same
  instant — so it's the worst case for a single-threaded event loop, not a
  steady-state trickle. Round 1 is dropped as warm-up.

### Results

| Concurrent connections | Delivery | Fan-out p50 | Fan-out p99 |
| --- | --- | --- | --- |
| 1,000  | 100% | 11 ms  | 16 ms  |
| 5,000  | 100% | 45 ms  | 54 ms  |
| 10,000 | 100% | 69 ms  | 94 ms  |
| 16,324 | 100% | 101 ms | 171 ms |

Connection establishment held ~4,000 conn/s up to 10k. **Zero dropped messages**
at every level.

### Reading the numbers

- **A single Node instance holds 10k live connections and fans a simultaneous
  broadcast out to all of them with p99 < 100 ms, 100% delivery.** Latency scales
  roughly linearly because every round pushes `CONN` sends through one event loop in
  one burst; in production, notifications arrive spread over time, not all at once,
  so steady-state per-event latency is far below these synchronised-broadcast figures.
- **The ~16k ceiling is the test client, not the server.** Asking for 20k, only
  16,324 connected — that's the loopback **ephemeral-port range** of a single client
  process (macOS ~49152–65535). The server never errored or dropped; horizontal
  client spread (or more instances) would go further. The honest single-instance
  number is therefore "≥10k comfortable; client-bound past ~16k."
- **Caveats:** localhost loopback (no real network RTT), single API instance, single
  test client, ms-resolution wall clock. Useful for the *shape* (linear fan-out cost,
  100% delivery, where one instance saturates), not as an absolute production SLA.

## What this doesn't fix (next steps)

- **Search** still uses `ILIKE '%q%'` (`searchPosts`/`searchUsers`), which can't
  use a B-tree index and scans. The fix is a real text index (Postgres
  `tsvector`/GIN or an external search index) — a later piece of work.
- **Worst-case fan-in.** The following feed is fast here because the sampled
  user follows many active accounts, so newest-first matches are found quickly.
  A user following a few low-activity accounts still scans far back by id. That
  ceiling is what a precomputed per-user timeline (fan-out) would remove.

## Trending pipeline (CDC → Flink → Redis)

End-to-end measurement of the streaming trending path (`docs/trending.md`):
a `Like` row in Postgres → Debezium → Redpanda → Flink event-time window →
Redis ZSET the API serves. Captured with the committed generator
`MODE=… pnpm --filter server loadtest:trending`, against the live local stack
(`pnpm cdc:up && pnpm flink:up && pnpm flink:submit`).

### Method

- One Postgres + Debezium + single-partition Redpanda + a 1-slot Flink
  taskmanager + Redis, all local. The harness writes real `Like` rows; numbers
  come from the live job's Redis output and Flink's own metrics REST API.
- **Freshness** uses a controlled burst (posts A/B/C with 60/40/20 likes) whose
  event-times are ~2.5 min in the past plus a few `now()` "advancer" likes —
  this pushes the watermark *past* the burst's windows so they're immediately
  complete. That removes the window-completion wait and isolates **pipeline
  propagation** (commit → Debezium → Kafka → Flink → window fire → ZSET).
- **Headroom** samples the Flink source operator's `numRecordsOutPerSecond`,
  `busyTimeMsPerSecond`, and `backPressuredTimeMsPerSecond` during a sustained
  insert.

### Results

| Metric | Value |
| --- | --- |
| End-to-end freshness (PG commit → trending ZSET, window-wait removed) | **~0.8 s** |
| Ranking correctness | exact (A:60 > B:40 > C:20 in the ZSET) |
| Sustained arrival rate observed | ~5,000 events/s |
| Flink source busy time @ 5k/s | **~20–28 ms/s (~2–3% busy)** |
| Backpressure | **0** throughout |

### Reading the numbers

- **Sub-second freshness end-to-end.** ~0.8 s from a Postgres commit to the
  ranking being live in Redis, *through* CDC + a stream processor. The honest
  caveat: this is the propagation cost with the window-completion delay
  deliberately engineered to ~0. In normal operation a like also waits for its
  sliding window to close (slide interval + the 30 s watermark) before it can
  affect the ranking — that wait is **by design** (completeness vs latency), not
  pipeline slowness.
- **Flink is nowhere near the bottleneck.** At ~5k events/s the window job runs
  **~2–3% busy with zero backpressure** — roughly 30–40× headroom on a single
  1-slot taskmanager before it would saturate. The real ingest ceiling here is
  Postgres `Like` write throughput (multi-row inserts measured at ~10–34k
  rows/s depending on batch/cache warmth), not the stream processing. This is
  the quantified version of "Flink earns its place on *correctness* (windowing/
  watermarks), not because the volume demands it" — see `docs/trending.md`.
- **Caveats:** single local node, single Kafka partition (no parallelism),
  loopback, dev hardware. Useful for the *shape* (sub-second propagation, large
  processing headroom, where the real bottleneck sits), not a production SLA.
