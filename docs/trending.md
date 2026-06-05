# Trending (Flink event-time windowed top-K)

Trending is the first view that a plain Kafka consumer *can't* do well: "the most-liked
posts in the last hour, updated continuously." That needs **stateful, event-time, windowed
aggregation** with out-of-order handling — what a stream processor (Flink) is for. A Java
Flink job reads the `Like` CDC stream, counts likes per post in a sliding event-time window,
and writes the top-K to a Redis sorted set the API serves.

```
owl.public.Like (Redpanda, Debezium JSON)
      │
      ▼  Flink job (trending-job/, Java DataStream)
  parse → event time = like.createdAt, watermark (bounded lateness)
      │  keyBy(postId) → sliding window (1h size / 1m slide) → COUNT
      ▼  keyBy(windowEnd) → Top-N (KeyedProcessFunction + event-time timer)
      ▼  RedisTopKSink: rebuild ZSET `trending` (member=postId, score=count)
      │
  GET /api/v1/posts/trending ─▶ ZREVRANGE trending ─▶ hydrate (PG) ─▶ response
      │
  client: /trending page + nav link
```

- **Truth**: `Like` rows in Postgres. **View**: Redis ZSET `trending`. The Flink job is the single writer; the API only reads it (cache, not truth — DB fallback when cold/down).

## Run (after `pnpm cdc:up`)

```sh
pnpm flink:up        # start the Flink jobmanager + taskmanager (profile: flink)
pnpm flink:submit    # build the fat JAR (in a Maven container) and submit it
pnpm flink:down      # stop the cluster
```

Flink web UI: http://localhost:8081 (watch the job, watermarks, and records in/out). The job module is `trending-job/` (build standalone with a Maven container: `docker run --rm -v "$PWD/trending-job":/src -v "$HOME/.m2":/root/.m2 -w /src maven:3.9-eclipse-temurin-17 mvn package`).

## Design notes & trade-offs

- **Why Flink, not a plain consumer.** Sliding **event-time** windows + watermarks + keyed state + Top-N are stateful streaming primitives. A Node consumer would have to reimplement windowing, watermarking, and late-event handling by hand. Contrast the like-counter view, which is a simple per-key counter and genuinely *didn't* need Flink — this is the deliberate "right tool" case.
- **Event time + watermarks.** Windows bucket by each like's own `createdAt`, and a 30s bounded-out-of-orderness watermark tolerates events arriving late/out of order (e.g. CDC lag, backfills). Processing time would miscount under lag. The watermark is the latency-vs-completeness knob: a window only fires once the watermark passes its end, meaning all its events have (within the bound) arrived. Debezium encodes a `timestamp` column as an epoch int whose unit depends on precision; `LikeEvent` normalises ms/µs by magnitude and falls back to the envelope `ts_ms`.
- **Two-stage Top-N.** Stage 1 keys by `postId` and counts per window. Stage 2 re-keys by `windowEnd` so all per-post counts for one window land together, buffers them in `ListState`, and emits the ranked top-K on the event-time timer for that window end. The `RedisTopKSink` rebuilds the `trending` ZSET per emission inside a `MULTI/EXEC` so a reader never sees a half-updated list.
- **Tombstones.** Debezium emits null-valued tombstone records after deletes; `SimpleStringSchema` NPEs on those, so the job uses a null-skipping `NullableStringSchema` (the same lesson as the Node consumers' `if (!message.value) return`).
- **Cache, not truth; graceful fallback.** `getTrendingPostIds` returns null when Redis is cold/down, and the endpoint falls back to a recent-popular DB query (ordered by the stored `likesCount`). Degraded but up.
- **Exactly-once (upgrade path).** Flink checkpointing + the Kafka source give replayable, consistent windowing — stronger than the consumers' at-least-once + reconcile. Not wired for the local demo.

## Verified

End-to-end on the live stack: inserted a burst of `Like` rows for two posts (with `createdAt` ~2 min in the past) plus a few `now()` "advancer" likes to push the watermark past a window boundary. The window fired and the `trending` ZSET reflected the ranking (`post 100` → score 10 above `post 200` → 6). `GET /posts/trending` serves those posts in rank order; with the ZSET empty it falls back to the DB query. Java unit tests cover the `LikeEvent` parser; server tests cover the endpoint's Redis-hit and fallback paths.

## Out of scope / next

- **Local only.** The Flink cluster (a JVM jobmanager + taskmanager) is the heaviest component yet; it stays out of prod per the prod-realtime decision, like the other consumers.
- **Unlike-decrement** isn't modelled — we count likes *given* in the window (op c/r); subtracting unlikes needs the unlike's commit time as its event time. A noted refinement.
- A compact right-rail Trending sidebar (vs. the current full `/trending` page) is left as homepage polish.
