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

## What this doesn't fix (next steps)

- **Search** still uses `ILIKE '%q%'` (`searchPosts`/`searchUsers`), which can't
  use a B-tree index and scans. The fix is a real text index (Postgres
  `tsvector`/GIN or an external search index) — a later piece of work.
- **Worst-case fan-in.** The following feed is fast here because the sampled
  user follows many active accounts, so newest-first matches are found quickly.
  A user following a few low-activity accounts still scans far back by id. That
  ceiling is what a precomputed per-user timeline (fan-out) would remove.
