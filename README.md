# OWL

A full-stack, Twitter/Threads-style social media app — built as a playground for exploring **production read-path system design**: change data capture (CDC), event streaming, stream processing, and Redis-backed derived state.

The product itself is a complete social app (auth, posts, threads, feeds, search, notifications). What makes it interesting is the architecture underneath: writes go to PostgreSQL, and the heavy read paths (timeline feeds, like counts, trending, full-text search) are served from **derived state** kept up to date by streaming changes out of Postgres via Debezium → Redpanda → consumers/Flink → Redis & Elasticsearch.

---

## Contents

- [Features](#features)
- [Architecture](#architecture)
  - [Design decisions & tradeoffs](#design-decisions--tradeoffs)
  - [Deliberate simplifications](#deliberate-simplifications)
- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Getting started](#getting-started)
- [Running the streaming stack](#running-the-streaming-stack)
- [Scripts reference](#scripts-reference)
- [Documentation](#documentation)

---

## Features

- **Auth** — signup / login with JWT access tokens and rotating refresh-token families (Argon2 password hashing, Redis-backed sessions).
- **Posts & threads** — text + up to 4 images, nested replies, soft-delete with graceful thread placeholders.
- **Interactions** — like, save/bookmark, repost, reply, with optimistic UI updates.
- **Feeds**
  - **Following** — chronological, served from per-user Redis timelines (fan-out-on-write).
  - **For You** — hybrid ranking blending follows and recent popular posts.
  - **Hot / Trending** — most-liked posts in a rolling window, computed by a Flink job.
- **Search** — full-text search over posts and users via Elasticsearch, with a PostgreSQL `ILIKE`/`tsvector` fallback when ES is unavailable.
- **Real-time notifications** — likes, follows, and replies pushed over WebSocket, fanned out across server instances via Redis Pub/Sub.
- **Profiles & follows** — bios, profile pictures, denormalized follower/following counts, hover preview cards.
- **UX** — responsive layout with mobile bottom nav, light/dark theme.

---

## Architecture

> **The idea.** OWL is built around a realistic read path rather than the simplest one that works. The core bet is a split: **writes stay simple and strongly consistent in PostgreSQL; reads are served from purpose-built, eventually-consistent derived views** (Redis timelines, like counters, a trending board, Elasticsearch indexes) kept in sync by streaming changes out of Postgres. See [Design decisions & tradeoffs](#design-decisions--tradeoffs) for the honest cost of each choice.

**Data plane.** PostgreSQL is the **source of truth**. Everything on the hot read path is **derived state** — a cache that can always be rebuilt from Postgres.

```
                  writes
   client ──────────────────────►  Express API  ──────────►  PostgreSQL
      ▲                                  │                  (wal_level=logical)
      │ reads                            │                        │
      │                                  │ reads                  │ logical replication
      │                                  ▼                        ▼
      │                            ┌──────────┐            Debezium (Kafka Connect)
      │                            │  Redis   │                   │
      │                            │ feeds    │                   ▼
      │                            │ counts   │              Redpanda (Kafka)
      │                            │ trending │            owl.public.{Post,Like,
      │                            │ sessions │             User,UserFollows,...}
      │                            └──────────┘                   │
      │                                  ▲          ┌─────────────┼───────────────┐
      │                                  │          ▼             ▼               ▼
      │                                  │   timeline fan-out  like counter   search indexer
      │                                  │   (consumer)        (consumer)     (consumer)
      │                                  │          │             │               │
      │                                  └──────────┘             │               ▼
      │                                  ▲                        │         Elasticsearch
      │                              Flink trending job ──────────┘
      └───────────────────────  WebSocket notifications (Redis Pub/Sub fan-out)
```

**Request path.** Everything enters through one front door: Caddy terminates TLS, round-robins across API replicas, and serves the built SPA; the API applies Redis-backed per-IP rate limiting before any handler runs. Media uploads go through a storage seam that can swap backends without touching the rest of the app.

```
client (SPA)
   │
   ▼
 Caddy        TLS · round-robin LB across N API replicas · serves the built SPA
   │  forwards /api/v1/*
   ▼
 Express API  per-IP rate limiting (Redis-backed, shared across replicas)
   │
   ├──► PostgreSQL + derived views   (data plane, above)
   │
   └──► storage seam ──┬── DiskStorage   default — local disk, Docker volume in prod
                       └── S3Storage     S3 / R2 / MinIO — PutObject, returns CDN or bucket URL
```

### Design decisions & tradeoffs

Each choice below is here for a reason — and each one costs something.

- **CDC instead of dual-writes.** The app never writes to Redis/ES on the hot path. Postgres changes are streamed out via logical replication (Debezium → Redpanda) and consumers project them into derived views.
  - *Why:* the write path has one job (commit to Postgres) and can't half-succeed by updating the DB but not the cache. Adding a new derived view is just adding a consumer — no app changes.
  - *Cost:* everything downstream is **eventually consistent** (a like count or new post lags by the consumer's processing time), and you take on real operational weight — a replication slot that will bloat the WAL if a consumer stalls, plus a broker to run.

- **Fan-out-on-write timelines.** A new post is pushed into each follower's Redis sorted set at write time, so reading a Following feed is a single range query.
  - *Why:* reads vastly outnumber writes; this moves the work to the cheaper side and makes the feed read O(page size).
  - *Cost:* write amplification — one post by a user with N followers is N Redis writes. High-follower "celebrity" accounts are therefore *excluded* and merged in at read time, which adds a special case to the read path. A user who posts before the fan-out consumer catches up won't immediately appear in followers' feeds.

- **Derived state is disposable, not authoritative.** Redis feeds, like counters, the trending board, and ES indexes are all rebuildable from Postgres; `feed:reconcile`, `like:reconcile`, and `search:reconcile` do exactly that.
  - *Why:* it makes drift a non-event — if a consumer drops a message or Redis is flushed, you reconcile instead of debugging divergence by hand.
  - *Cost:* you maintain two code paths for the same data (the streaming projection *and* the batch rebuild) and have to keep them in agreement.

- **Denormalized counters** (`likesCount`, `followersCount`, …) live on the row.
  - *Why:* feeds render counts without an aggregate query per post.
  - *Cost:* they can drift from the true `COUNT(*)`, which is the other reason reconciliation exists.

- **Graceful degradation over hard dependencies.** If Redis or Elasticsearch is down, the API falls back to querying Postgres directly.
  - *Why:* the optional infra stays optional — the app boots and works without the streaming stack running.
  - *Cost:* fallback paths are slower and less-exercised, so they can rot silently unless tested.

- **Event-time (not arrival-time) windows in the trending job.** Flink windows by the like's own timestamp with bounded-lateness watermarks.
  - *Why:* trending stays correct even when events arrive late or out of order — arrival-time windows would miscount during lag spikes.
  - *Cost:* more conceptual overhead (watermarks, allowed lateness) and a result that's intentionally delayed until the window can close.

- **Pluggable storage behind a `Storage` interface** (`server/src/storage/`). Both a disk backend and an S3 backend (also S3-compatible: Cloudflare R2, MinIO) are implemented; the controllers, client, and seed only ever see a returned URL and don't know which one ran.
  - *Why:* the media backend is a config switch (`STORAGE_DRIVER`), not a refactor. Disk keeps deploys cheap and self-contained; S3 (+ a CDN URL) is a few env vars away, with no changes to the app, the read path, or the proxy (uploads are served under `/api/v1/media/...`, a path Caddy and the Vite proxy already forward). The AWS SDK is imported lazily, so disk-only deploys don't load it.
  - *Cost:* the disk backend ties media to a single host's volume — it doesn't fan out across replicas the way the stateless API does, so multi-replica media serving means switching to S3.

- **Keyset pagination** (`(id)` cursors, not `OFFSET`) — cheap deep pagination for infinite scroll, at the price of no random page access.

- **Stateless API behind Caddy round-robin** — the API holds no per-process state, so Caddy can fan requests across N replicas; rate limiting, sessions, and WebSocket notifications are all Redis-backed so they work identically across instances rather than per-process.

### Deliberate simplifications

These are scoped-out on purpose, not oversights — clear places the design could grow.

- **No schema registry.** Debezium emits JSON with schemas inline. Simple and self-contained; Avro/Protobuf + a registry would add compatibility guarantees if the topic contracts grew.
- **At-least-once delivery with idempotent projections.** Consumers tolerate replays by writing idempotently rather than relying on exactly-once.
- **Reconciliation is on-demand.** The rebuild scripts (`*:reconcile`) exist and work, but are run manually rather than scheduled or driven by drift detection.
- **Static celebrity threshold.** The fan-out cutoff for high-follower accounts is a fixed constant — a simple stand-in for an adaptive hybrid policy.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, React Router 7, Vite, Mantine, TanStack Query, Zustand, React Hook Form |
| Backend | Node.js, Express 5, TypeScript |
| Database | PostgreSQL 16 (logical replication) via Prisma 7 |
| Cache / derived state | Redis 7 (`ioredis`) |
| Auth | JWT (`jsonwebtoken`) + Argon2 (`@node-rs/argon2`) |
| Real-time | Native WebSocket (`ws`) + Redis Pub/Sub |
| CDC | Debezium 2.x (Kafka Connect, `pgoutput`) |
| Streaming | Redpanda (Kafka-compatible), `kafkajs` consumers |
| Stream processing | Apache Flink 1.20 (Java/Maven trending job) |
| Search | Elasticsearch 8 (`@elastic/elasticsearch`) |
| Media storage | Pluggable `Storage` seam — local disk (default) or S3 via `STORAGE_DRIVER` |
| Rate limiting | `rate-limiter-flexible` (Redis backend) |
| Reverse proxy / LB | Caddy |
| Validation | Zod (shared package across client & server) |
| Tooling | pnpm workspaces, tsdown, tsx, Vitest, ESLint, Docker Compose |

---

## Repository layout

```
owl/
├── client/                 # React 19 SPA (Vite + Mantine)
├── server/                 # Express API, WebSocket hub, CDC consumers, scripts
│   ├── src/
│   │   ├── features/       # auth, user, post, notification, search, upload
│   │   ├── consumers/      # Kafka consumers (likeCounter, timelineFanout, searchIndexer)
│   │   ├── realtime/       # WebSocket hub + Redis pub/sub fan-out
│   │   ├── scripts/        # reconciliation + load-test scripts
│   │   └── server.ts       # HTTP + WebSocket entry point
│   └── prisma/             # schema, migrations, seed scripts
├── packages/
│   └── validation/         # shared Zod schemas + types
├── cdc/                    # Debezium connector template + setup/clean scripts
├── trending-job/           # Apache Flink job (Java/Maven)
├── docs/                   # architecture deep-dives (see below)
├── docker-compose.yml          # base: db, redis, server, caddy
├── docker-compose.override.yml # local dev overrides
├── docker-compose.cdc.yml      # opt-in: redpanda, debezium, flink, elasticsearch
└── Caddyfile               # reverse proxy + load balancing
```

---

## Getting started

### Prerequisites

- **Node.js** 18+
- **pnpm** 11.5+ (`npm install -g pnpm`)
- **Docker** + Docker Compose (for Postgres, Redis, and the optional streaming stack)

### 1. Install

```bash
pnpm install
```

### 2. Start the core infrastructure (Postgres + Redis)

```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml up -d db redis
```

### 3. Apply migrations and seed data

```bash
pnpm --filter server exec prisma migrate deploy
pnpm --filter server seed        # or: seed:demo for a larger, image-rich dataset
```

### 4. Run the app in dev mode

```bash
pnpm dev
```

This runs the client and server in parallel:

- **Client** — Vite dev server (default `http://localhost:5173`), proxies `/api` (and the notification WebSocket) to the API.
- **Server** — Express API on `http://localhost:3000`.

> **Environment variables** live in `.env` files at the repo root and in `server/` and `client/`. The server needs (at minimum) `DATABASE_URL`, `REDIS_URL`, `ACCESS_TOKEN_SECRET`, and `REFRESH_TOKEN_SECRET`. CDC consumers additionally need `KAFKA_BROKERS`; the search indexer needs `ELASTICSEARCH_URL`.

### Production-like run (Docker)

Build and run everything behind Caddy (client served as static assets, API proxied):

```bash
docker compose up --build
# app available at http://localhost:8001
```

---

## Running the streaming stack

The streaming infrastructure is **opt-in** — the app runs fine without it (reads fall back to Postgres). Bring it up to exercise the derived-state read path.

### CDC (Debezium → Redpanda)

```bash
pnpm cdc:up        # postgres (logical), redis, redpanda, console, debezium connect
pnpm cdc:status    # check the connector is RUNNING
# Redpanda Console UI: http://localhost:8080
```

Then run the consumers (each in its own terminal) to project changes into derived state:

```bash
pnpm --filter server consume:likes    # Like events  → Redis like counters
pnpm --filter server consume:feed     # Post events  → per-user Redis timelines
pnpm --filter server consume:search   # Post/User    → Elasticsearch indexes
```

Rebuild derived state from Postgres at any time:

```bash
pnpm --filter server like:reconcile
pnpm --filter server feed:reconcile
pnpm --filter server search:reconcile
```

Tear down (clean the replication slot first):

```bash
pnpm cdc:clean && pnpm cdc:down
```

### Trending (Apache Flink)

```bash
pnpm flink:up      # jobmanager + taskmanager
pnpm flink:submit  # build the fat JAR and submit the job
# Flink dashboard: http://localhost:8081
pnpm flink:down
```

The job consumes the `Like` topic and maintains a top-K trending board in Redis using event-time sliding windows.

### Elasticsearch (search)

```bash
pnpm es:up         # single-node Elasticsearch
# then run consume:search to populate the indexes
pnpm es:down
```

### Load balancing demo

```bash
pnpm lb:up         # 2 server replicas behind Caddy round-robin
pnpm lb:down
```

---

## Scripts reference

Run from the repo root.

| Script | Description |
|---|---|
| `pnpm dev` | Client + server in watch mode |
| `pnpm build` / `pnpm start` | Build / start all packages |
| `pnpm lint` | Lint all packages |
| `pnpm cdc:up` / `cdc:down` / `cdc:status` / `cdc:clean` | Manage the CDC stack |
| `pnpm flink:up` / `flink:submit` / `flink:down` | Manage the Flink trending job |
| `pnpm es:up` / `es:down` | Manage Elasticsearch |
| `pnpm lb:up` / `lb:down` | Multi-replica load-balancing demo |

Server-scoped (`pnpm --filter server <script>`):

| Script | Description |
|---|---|
| `seed` / `seed:demo` | Seed the database |
| `consume:likes` / `consume:feed` / `consume:search` | CDC consumers |
| `like:reconcile` / `feed:reconcile` / `search:reconcile` | Rebuild derived state |
| `loadtest:notifications` / `loadtest:trending` | Load-test scripts |
| `test` / `test:watch` | Vitest |

---

## Documentation

Deeper write-ups of each subsystem live in [`docs/`](docs/):

| Doc | Topic |
|---|---|
| [cdc.md](docs/cdc.md) | CDC pipeline, Debezium setup, gotchas |
| [feed.md](docs/feed.md) | Fan-out-on-write timeline design |
| [for-you.md](docs/for-you.md) | For You ranking |
| [like-counter.md](docs/like-counter.md) | Like-count derived view |
| [trending.md](docs/trending.md) | Flink trending job |
| [search.md](docs/search.md) | Full-text search + fallback |
| [notifications.md](docs/notifications.md) | Real-time notification system |
| [auth-sessions.md](docs/auth-sessions.md) | JWT refresh-token rotation |
| [storage.md](docs/storage.md) | File upload & serving |
| [benchmarks.md](docs/benchmarks.md) | Performance benchmarks |

---

## License

MIT
