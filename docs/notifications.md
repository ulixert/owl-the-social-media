# Notifications (WebSocket + Redis pub/sub fan-out)

A like, follow, or reply notifies the recipient in real time. Unlike trending, this feature
does **not** need a stream processor: there's no windowing, no replay, no out-of-order
aggregation — just "write a row, push it to whoever's connected." So the implementation is the
plain one: write the `Notification` row in the **same transaction** as the source action, then
fan it out over a WebSocket using **Redis pub/sub** to reach the connection wherever it lives.

```
like / follow / reply (one Prisma $transaction)
      │  source write  +  createNotification(tx, …)   ← atomic; skips self-notify
      ▼  COMMIT
  publishNotification ─▶ redis PUBLISH notifications:user:{recipientId}   ← best-effort
      │
      ▼  (every API instance) redis PSUBSCRIBE notifications:user:*
  wsHub: Map<userId, Set<ws>> ─▶ send() to that user's local sockets
      │
  browser: useNotificationSocket (one socket/session) ─▶ toast + invalidate React Query
      ▼
  GET /api/v1/notifications        (keyset list, Activity page)
  GET /api/v1/notifications/unread-count   (nav badge)
```

- **Truth**: `Notification` rows in Postgres. **Transport**: Redis pub/sub (ephemeral — not a store). The row is durable the instant the source action commits; the WebSocket is just live delivery on top.

## Why this shape

- **Atomic with the source action.** `createNotification` takes the caller's `Prisma.TransactionClient`, so the notification row and the like/follow/reply commit or roll back together — a notification can't exist for an action that didn't happen, and vice versa.
- **Emit on the positive action only.** Notifications are created in the like-create / follow-create / reply branches, never on the un-action, so toggling like→unlike→like can't spam the recipient. Self-notify (`actorId === recipientId`) returns null and is skipped.
- **Publish is best-effort.** The row is already durably stored and will surface on the next Activity fetch, so a Redis hiccup must never fail the user's action — a like shouldn't 500 because live fan-out was momentarily down. `publishNotification` catches and logs; it never propagates.
- **Why Redis pub/sub, not Kafka.** A broker buys decoupling, replay, and buffering. Live notification delivery wants none of those: a message the recipient wasn't connected for is *not* replayed (they read it from the DB list instead), there's one logical consumer (the API), and no burst pressure to buffer. Pub/sub's fire-and-forget, at-most-once delivery is exactly the semantics here — adding Kafka would be cost (a stateful broker + a replication slot to babysit) with no benefit. Contrast trending, which genuinely needs windowed stream processing; see `docs/trending.md`.
- **Why pub/sub at all (vs. an in-process map).** The `Map<userId, Set<ws>>` only knows the sockets on *this* process. With more than one API instance behind a load balancer, the actor's request and the recipient's socket can land on different instances. `PUBLISH`/`PSUBSCRIBE` decouples "who emitted" from "who holds the socket": every instance subscribes to `notifications:user:*` and delivers to whatever local sockets it has, so it works horizontally with zero sticky-session requirement.

## The WebSocket hub (`server/src/realtime/wsHub.ts`)

- `WebSocketServer({ noServer: true })` shares the existing HTTP server via its `upgrade` event — no second port, so it rides the same TLS/reverse-proxy in prod and the Vite `/api` proxy (`ws: true`) in dev.
- **Auth on the handshake.** The browser `WebSocket` API can't set an `Authorization` header, so the short-lived access token is passed as `?token=…` and verified with the same `jwtVerify` + `ACCESS_TOKEN_SECRET` as REST. A bad/missing token destroys the socket before the upgrade completes (no half-open authenticated connection).
- **Subscriber connection is separate.** A Redis connection in subscriber mode can't issue normal commands, so the hub `duplicate()`s the shared command client for its `PSUBSCRIBE`. One subscription per process; each `pmessage` is routed by parsing the userId out of the channel and looking it up in the local map.
- **Heartbeat.** `ws` doesn't surface liveness, so each socket is tagged and pinged every 30s; any that didn't pong since the last tick is terminated. This reclaims half-open connections (laptop sleep, dropped Wi-Fi) that TCP alone wouldn't notice for a long time.

## Client (`client/src/hooks/useNotificationSocket.ts`)

- One same-origin socket for the whole authenticated session, mounted once in `AppLayout`. On each frame it shows a toast and **invalidates** the notification queries — the socket is the "something changed" signal; the REST hooks (`useNotifications`, `useUnreadCount`) own the data, so the list and the unread badge stay a single source of truth.
- Reconnects with exponential backoff (1s → 30s cap), resetting on a healthy open; tears down cleanly on logout / token change so a stale token's socket never lingers.
- The wire payload is produced by the server's `serializeNotification` and is byte-identical to a REST list row (`notificationInclude` is shared), so the client renders a pushed notification and a fetched one with the same code.

## Verified

End-to-end on the live stack (server + Vite client + Redis): logged in as one user with the Activity socket open, triggered a follow then a like from a second account. The follow and like arrived **live without a reload** — the nav unread badge incremented, a toast fired, and the Activity list showed the new rows newest-first (with the liked post's text snippet). Viewing the page marked all read and cleared the badge. A standalone Node harness also confirms the raw path: a follow produces a WebSocket frame with the hydrated actor payload, the row persists in `GET /notifications`, and `unread-count` reflects it. All 49 server tests stay green (the best-effort publish is what keeps a Redis-down test from 500-ing the like/follow path).

## Out of scope / next

- **No prod broker, by decision.** Redis (already in prod for the like-counter view and refresh-token sessions) is the only new prod dependency — no Kafka/Flink on this path. See the prod-realtime rationale: a broker goes on the critical path only where replay/decoupling/windowing is actually needed.
- **Dedup tradeoff.** No DB unique constraint on `Notification`; emitting only on the positive action handles the common toggle case, but a like→unlike→like still produces a second row. Acceptable for a single-user portfolio app; a partial unique index or upsert is the refinement.
- **At-most-once live delivery.** A notification published while the recipient is offline is not queued for the socket — it's simply read from the durable list on next load. Presence/typing indicators and read receipts (per-notification, beyond mark-all-on-view) are deliberately not built.
- **Messages / DMs** are a separate, larger feature (conversation + message models) and intentionally not part of this phase, though they'd reuse this same hub + pub/sub transport.
- **Migration note.** Prisma can't model the generated `textsearch` tsvector column (`Unsupported`), so its schema diff spuriously emits `ALTER TABLE "Post" … "textsearch" DROP DEFAULT` (rejected by Postgres, error 42601). That one bogus line is removed from this feature's migration; the column, its generation expression, and the search GIN index are untouched.
