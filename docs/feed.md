# Timeline fan-out (Following feed)

The "Following" timeline moved from a **pull model** (fan-in query at read time) to a
**fan-out-on-write** derived view: a per-user feed precomputed in Redis from the CDC
stream, with a **read-time merge for celebrities** (the hybrid model).

```
POST /posts ──> INSERT "Post" row   (the only write — the source of truth)
                      │
                Debezium CDC
                      │
              owl.public.Post  (Redpanda)
                      │
            timeline-fanout consumer ──> for each follower F (non-celebrity author):
                                              ZADD feed:{F} score=postId
                      │
   GET /posts/following ──> ZREVRANGEBYSCORE feed:{me}  ⊕  recent posts from
                            followed celebrities (DB)  ──> hydrate ──> response
```

- **Truth**: `Post` rows in Postgres. The write path only inserts/updates a Post.
- **View**: `feed:{userId}` — a Redis ZSET, member = `postId`, score = `postId`. Post ids are monotonic with creation time, so scoring by id gives chronological order and matches the keyset-by-id pagination used everywhere else.
- **Rebuildable**: `feed:reconcile` rebuilds feeds from the truth.

## Run (after `pnpm cdc:up`, which includes Redis)

```sh
pnpm --filter server feed:reconcile          # warm/repair feeds from Postgres (all users)
pnpm --filter server feed:reconcile -- 1 2 3 # ...or just these user ids
pnpm --filter server consume:feed            # long-running: apply live Post CDC events
```

The API (`pnpm --filter server dev`) reads from the feed automatically, falling back to the pull query when Redis is cold or down.

## Design notes & trade-offs

- **Fan-out-on-write, single writer.** The consumer is the only writer of `feed:*`; the API only reads. On a new post by author A, it pushes the post id into every follower's feed (plus A's own, so authors see their posts). Reads become a cheap range scan of one per-user list instead of a fan-in `WHERE postedById IN (...)`.
- **Hybrid: celebrities are NOT fanned out.** An author with `>= CELEBRITY_FOLLOWER_THRESHOLD` (default 10000) followers would cause huge write amplification (one post → millions of ZADDs). Those authors are skipped on write and **merged in at read time**: the read path pulls the followed celebrities' recent posts straight from Postgres (rides the `Post(postedById, id)` index) and merges them with the Redis slice. This is the canonical "when NOT to fan out" point.
- **Bounded feeds.** Each feed is trimmed to the newest `FEED_MAX` (default 800) ids (`ZREMRANGEBYRANK`). Deeper pages fall back to the DB pull query — the feed is a hot cache of recent history, not the whole timeline.
- **Eventual consistency.** A new post appears once the consumer processes its CDC event (typically sub-second), not synchronously. Same deliberate trade-off as the like-counter view: decoupling + a simpler write path in exchange for read-your-writes.
- **Soft-delete handling.** `deletePost` sets `isDeleted=true` (an `update`), so Debezium emits an `op=u` carrying `postedById` — the consumer fans out a `ZREM`. No `REPLICA IDENTITY FULL` needed (unlike the `Like` view). As a safety net, the read path re-checks `isDeleted` and id-membership when hydrating, so any stale id left in a ZSET is dropped on read.
- **Graceful degradation / cold start.** `getFollowingFeedIds` returns `null` — and the endpoint serves the original pull query — when Redis isn't `ready`, the feed key doesn't exist yet (new/unwarmed user), or we've paged past what the feed holds. The endpoint stays correct with the streaming stack off entirely.
- **Reconcile = rebuild from source.** `feed:reconcile` recomputes each feed from the newest `FEED_MAX` posts of a user's non-celebrity followees (+ their own) and rewrites the ZSET. Warms cold feeds and repairs the consumer's at-least-once edges. On the 100k-user load-test dataset a full backfill is expensive; pass explicit ids to warm a subset (cold feeds fall back to the DB anyway).

## Verified

End-to-end against the live CDC stack: a post by a normal author (`ada`, 5 followers) appeared in every follower's `feed:*` and in the author's own feed, and not in a non-follower's; soft-deleting it removed it from those feeds. A celebrity's post (user 1, 67.5k followers) was **not** fanned out, and is surfaced only via the read-time merge. Unit tests cover `postEventEffect` (CDC mapping) and `mergeFeedPages`; integration tests cover the Redis-hit, cold-fallback, and celebrity-merge read paths.

## Out of scope / next

- **Prod**: consumers stay local (run via `pnpm`), matching the like-counter and the "CDC not in prod for now" decision. No new compose/CI service.
- **For-You** (`getRecommendedPosts`) is unchanged — it's a ranking problem, handled on its own branch; it can later reuse this feed for its "following" slice and the trending view for its "popular" slice.
- Replies are fanned out like top-level posts (preserving current behavior); filtering them out of the home feed is a possible product refinement.
- Next: trending via Flink (Phase 4).
