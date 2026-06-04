# Like-counter derived view

The first read-optimized view built on the CDC backbone. The post like count moved
from the denormalized `Post.likesCount` column (kept in sync by a dual-write in the
request path) to a **Redis counter maintained asynchronously from the change stream**.

```
PUT /posts/:id/like ──> INSERT/DELETE "Like" row   (the only write — the source of truth)
                                │
                          Debezium CDC
                                │
                        owl.public.Like  (Redpanda)
                                │
                     like-counter consumer        post:{id}:likes (Redis)
                                                          │
            GET feeds / GET /posts/:id ──> withLikeCounts() reads Redis ──> response
```

- **Truth**: `Like` rows in Postgres. The write path only inserts/deletes a Like.
- **View**: `post:{id}:likes` in Redis, maintained by the consumer (`+1` on create, `-1`
  on delete). The read path serves counts from here.
- **Rebuildable**: `like:reconcile` recomputes the view from the truth.

## Run (after `pnpm cdc:up`, which now includes Redis)

```sh
pnpm --filter server like:reconcile   # seed/repair Redis counts from Postgres
pnpm --filter server consume:likes    # long-running: apply live CDC deltas to Redis
```

The API (`pnpm --filter server dev`) reads counts from Redis automatically.

## Design notes & trade-offs

- **Counter, single writer.** `post:{id}:likes` is a plain integer (`INCRBY`). The
  *consumer is the only writer*; the API never touches the counter. This avoids
  double-count races. (A per-post SET of liker ids would be idempotent but duplicates the
  truth and costs ~1GB at this scale — rejected.)
- **Eventual consistency.** A like is reflected once the consumer processes the CDC event
  (typically sub-second), not synchronously. The client invalidates + refetches on
  like/unlike, so it may briefly show the pre-like count until the consumer catches up.
  This is the deliberate trade-off of a derived view: decoupling and a simpler write path
  in exchange for read-your-writes. (A client-side optimistic update would mask the lag.)
- **`REPLICA IDENTITY FULL` on `Like`.** Postgres' default identity is the PK only, so a
  delete's `before` image would lack `postId` and the consumer couldn't know which post to
  decrement. `FULL` emits the whole old row (migration
  `20260604000000_like_replica_identity_full`).
- **Reconcile = rebuild from source.** `like:reconcile` runs
  `SELECT "postId", count(*) FROM "Like" GROUP BY 1` and `SET`s Redis (posts with count >
  0). Seed it once, and re-run any time to repair drift — this covers the consumer's
  at-least-once edges (a crash before an offset commit could replay a few events). For a
  full rebuild from scratch, `FLUSHDB` first.
- **Graceful degradation.** `withLikeCounts()` wraps Redis in try/catch and checks the
  connection; on a miss/error/disconnect it falls back to the post row's `likesCount`. The
  API stays up if Redis is down — counts just go stale until it returns.
- **`Post.likesCount` is now vestigial.** No longer written; kept only as the read-path
  fallback. Could be dropped once the view is trusted everywhere.

## Verified

Reconcile is exact (`post:1:likes` == `SELECT count(*) ... WHERE "postId"=1`). With the
consumer running, inserting a `Like` row drove `post:1000001:likes` 0→1 and deleting it
drove it 1→0 (delete carried `postId` thanks to `REPLICA IDENTITY FULL`).

## Out of scope / next

- **Prod**: the production compose has no Redis yet, so a prod server falls back to the
  (now-frozen) DB column. Productionizing = add Redis + the consumer to the prod compose.
- Reposts/comments counts stay DB-backed for now.
- Next: timeline fan-out (Phase 3), trending via Flink (Phase 4).
