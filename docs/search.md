# Search (CDC → Elasticsearch derived index)

Search was an `ILIKE '%q%'` query — a case-insensitive sequential scan over `Post.text`
and `User.username/name`, unindexable and with no relevance ranking. The CDC→search-index
pattern replaces it: a Node consumer tails the same `Post`/`User` change streams the other
views use and maintains an Elasticsearch index the API queries for full-text, fuzzy,
relevance-ranked results. The index is a **derived view** — Postgres stays the source of
truth and the read path falls back to the old ILIKE query when ES is cold or down.

```
owl.public.Post / owl.public.User (Redpanda, Debezium JSON)
      │
      ▼  searchIndexer consumer (kafkajs)
  postSearchEffect / userSearchEffect (pure) → index | delete
      │  live post → index doc; soft/hard delete → delete doc
      ▼  ES: owl-posts (_id=postId, field: text), owl-users (_id=userId, fields: username, name)
      │
  GET /api/v1/posts/search/{posts,users} ─▶ ES match/multi_match (fuzzy)
      │   ─▶ ranked ids ─▶ hydrate from Postgres (in rank order) ─▶ response
      ▼   (ES down/cold ─▶ ILIKE fallback on Postgres)
  client: Explore (search) page — accounts then infinite posts
```

- **Truth**: `Post`/`User` rows in Postgres. **View**: ES indices `owl-posts`, `owl-users`. The consumer is the single writer; the API only reads (cache, not truth).
- ES returns **ids only** (`_source: false`); the real shape (author, `isLiked`, like counts, `isFollowing`) is hydrated from Postgres in relevance order — the same id-hydration the trending/feed views use, so search reflects live counts and the index stays small.

## Run (after `pnpm cdc:up`)

```sh
pnpm es:up                          # start Elasticsearch (profile: es)
pnpm --filter server search:reconcile   # backfill both indices from Postgres
pnpm --filter server consume:search      # tail CDC and keep the indices live
pnpm es:down                        # stop Elasticsearch
```

The consumer creates the indices with their mappings on startup; `search:reconcile` drops
and rebuilds them (for the initial backfill, since `snapshot.mode=no_data` means historical
rows aren't in Kafka, and for repairing drift). ES REST: http://localhost:9200.

## Design notes & trade-offs

- **Why Elasticsearch, not Postgres `tsvector`/GIN.** A GIN-indexed full-text column would have been lighter and prod-ready. ES was chosen deliberately to *learn the CDC→search-index derived-view pattern* (the project's theme) and for résumé keyword signal — its skills transfer to OpenSearch 1:1. Honest framing: at this scale Postgres FTS would be the pragmatic choice; ES earns its place when search needs analyzers, relevance tuning, or to scale independently of the primary DB.
- **Why a consumer, not a Kafka Connect ES sink.** A consumer matches the other views (likeCounter, timelineFanout), gives full control over the doc shape, and handles soft-delete-as-update trivially (a sink would need SMT/tombstone logic, and the Debezium image doesn't bundle the ES sink connector). Trade-off: a sink is less code and a more "connector ecosystem" story — a reasonable alternative.
- **Soft deletes leave the index.** `postSearchEffect` maps an update that flips `isDeleted` (and hard deletes) to a **delete**, so the index holds exactly the live posts and queries need no `isDeleted` filter. Mirrors the feed consumer's ZREM-on-soft-delete.
- **Offset pagination.** Relevance order isn't id-monotonic, so the keyset-by-id cursor used elsewhere doesn't apply; the cursor is repurposed as an offset (`from`/`size`) on **both** the ES and fallback paths, so its meaning is identical regardless of which serves. The client already treats `nextCursor` opaquely (same as For-You) — no client change.
- **Fail-fast read, patient write.** The read path uses a 2s per-request timeout (`READ_TIMEOUT`) so a slow/down ES falls back to ILIKE fast; the client default stays generous so the bulk backfill isn't cut off mid-flush. (A 2s *global* timeout initially aborted `search:reconcile` — the fix that split them.)
- **Cache, not truth; graceful fallback.** Any ES error returns null from the query layer and the endpoint serves the ILIKE query. Degraded (seq scan, substring not fuzzy) but up.

## Verified

End-to-end on the live stack (ES 8.15 + CDC backbone):

- **Live path** — inserting a `Post` with a distinctive token flowed Postgres → Debezium → Redpanda → consumer → ES; `GET /posts/search/posts` returned it fully hydrated (author, `isLiked`, like count). A **fuzzy** query (one-letter typo) still matched it.
- **Soft delete** — `UPDATE … SET isDeleted=true` removed the ES doc (`_doc` 404) and dropped it from the API results.
- **Backfill** — `search:reconcile` indexed **exactly** the Postgres counts: 1,000,020 live posts and 100,011 users.
- **User search + pagination** — `q=user1` ranked `user1` first (exact-handle boost); successive `cursor` offsets returned non-overlapping pages.
- **Fallback** — server integration tests run with ES pointed at a dead port, so they exercise the ILIKE fallback against `owl_test` and pass; the pure CDC→effect mappers are unit-tested.

## Out of scope / next

- **Local only.** ES (a ~1GB-heap JVM service) stays out of prod per the prod-realtime decision, like Redpanda/Debezium/Flink. Prod search falls back to the ILIKE query (or would adopt Postgres FTS). The consumer is local too.
- **Minimal mappings/relevance.** Default analyzer, no custom tokenizer/synonyms, no field boosting beyond an exact-username sub-field. Relevance tuning (analyzers, `search_after` deep pagination, highlighting) is a noted refinement.
- **At-least-once + reconcile**, like the other consumers — no exactly-once. `search:reconcile` repairs any drift.
