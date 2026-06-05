# For-You feed (candidate generation + heuristic ranking)

The For-You feed is a **two-stage ranked recommendation feed**, not a chronological
list. It replaced an earlier `WHERE followed OR liked-by-followed OR likesCount>=3
ORDER BY id` query, which was really a candidate *filter* + reverse-chronological
sort (no ranking; and `likesCount>=3` matched ~38% of all posts, collapsing For-You
toward the global Hot feed).

```
candidate generation ──> ranking ──> diversity/dedup ──> page
   (bounded sources)     (heuristic)   (per-author cap)
```

Implemented in `server/src/features/post/forYou.ts`; `getRecommendedPosts`
(currentUserPostController.ts) is a thin controller over `getForYouFeed`.

## 1. Candidate generation (bounded, Postgres-first)

A pool (~a few hundred ids) from a few small sources:

- **Followed authors' recent posts** — from the fan-out feed (`getFollowingFeedIds`, Redis, O(1)) when warm; DB fallback (`Post WHERE postedById IN (followees) ORDER BY id DESC`) otherwise.
- **Social proof** — recent posts liked by followees (`Like WHERE userId IN (followees) ORDER BY createdAt DESC LIMIT 50`), plus a count of *how many* followees liked each. Rides the covering index `Like(userId, createdAt, postId)` (index-only).
- **Discovery / popular** — recent posts with `likesCount >= POPULAR_MIN`, beyond your graph. Plus the **trending** view (`getTrendingPostIds`, Redis) when present.

Union → dedupe → drop the viewer's own posts.

## 2. Ranking (transparent heuristic, pure & unit-tested)

```
score = w_recency  · 0.5^(ageHours / HALF_LIFE)        // recency decay, half-life 24h
      + w_pop      · log1p(likes + comments)            // popularity
      + w_social   · (# followees who liked it)         // social proof
      + w_followed · (author is followed ? 1 : 0)       // follow affinity
      + w_trending · (in trending set ? 1 : 0)          // discovery boost
```

Weights, half-life, `POPULAR_MIN`, and pool sizes are tunable constants. Sort by
score desc (id-desc tiebreak). **Not an ML ranker** — a weighted heuristic is the
right complexity at this scale (no engagement training data or serving infra).

## 3. Diversity & pagination

- Dedupe by id; **cap per author** (max 2) so one prolific account can't flood the feed; exclude the viewer's own posts.
- For-You is a ranked *bounded pool*, so it paginates by an **opaque offset** cursor (index into the ranked list). The client treats `nextCursor` opaquely, so no client change. Pages re-rank per request (minor drift is fine for a feed).

## Why Postgres-first

For-You must work in prod, which is Postgres-only (the streaming stack — and the
Redis fan-out/trending views it populates — stays local for now). So the candidate
sources are bounded Postgres queries by default; the Redis views (`getFollowingFeedIds`,
`getTrendingPostIds`) are folded in **only when present**, enriching the feed without
changing the prod path. If the streaming stack is ever productionized, For-You gets
better automatically.

## Performance (measured)

`EXPLAIN ANALYZE` drove this. The original For-You's slow part was *not* the
`likesCount>=3` gate — it was the social-proof subquery doing ~4,578 cold random
heap reads (~846 ms cold) because no index covered "recent likes by a set of users."
The covering index made it index-only (~1 ms). The redesign also removes the global
OR entirely; each candidate source is bounded and indexed (the followed-authors DB
fallback is ~168 ms on the 1M-post load-test set, and O(1) from the fan-out feed when
warm). See `docs/benchmarks.md`.

## Interview framing

"Two-stage feed: candidate generation from a few bounded sources, then a transparent
weighted ranking — recency decay + popularity + social proof + follow affinity — with
per-author diversity. I deliberately didn't build an ML ranker (no training data /
serving infra; a heuristic is right here). And it was measurement-driven: EXPLAIN
showed the real bottleneck was a heap-fetch-heavy social-proof query, not the
popularity gate I'd assumed."
