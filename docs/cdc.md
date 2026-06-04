# CDC backbone

Captures row changes from Postgres and streams them onto a Kafka log, so derived
views (like counts, timelines, trending) can be built off the event stream instead
of querying the database on the read path.

```
Postgres (wal_level=logical) --pgoutput--> Debezium (Kafka Connect) --> Redpanda topics
                                                                          ^
                                                          Redpanda Console (UI :8080)
```

This is **local, opt-in infrastructure** (a separate compose file) and has no
consumers yet — this layer only proves change events flow. Each captured table lands
on its own topic: `owl.public.Post`, `owl.public.Like`, `owl.public.UserFollows`, etc.
(`<topic.prefix>.<schema>.<table>`).

## Run

Requires Docker and the dev database already seeded (`pnpm --filter server seed`).

```sh
pnpm cdc:up       # start db (with logical replication) + redpanda + console + connect, and register the connector
pnpm cdc:status   # connector + task state
pnpm cdc:clean    # delete connector + drop replication slot/publication (run before cdc:down)
pnpm cdc:down     # stop the stack (keeps volumes)
```

`cdc:up` recreates the `db` container with `wal_level=logical`; the seeded data
survives (it lives in the `pg_data` volume). A one-shot `connect-setup` container
injects `POSTGRES_*` from `.env.local` into the connector template and registers it,
so no credentials are committed.

- Redpanda Console UI: <http://localhost:8080> (Topics + Kafka Connect tabs)
- Connect REST: <http://localhost:8083>
- Kafka API from the host: `localhost:19092`

## Verify

```sh
# 1) connector + task RUNNING
curl -s http://localhost:8083/connectors/owl-postgres/status | jq

# 2) topics exist
docker exec owl-redpanda-1 rpk topic list

# 3) produce a change and watch it land (op:"c" = create)
docker exec owl-db-1 sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "INSERT INTO public.\"Like\" (\"userId\",\"postId\",\"createdAt\") VALUES (1, 1, now()) ON CONFLICT DO NOTHING;"'
docker exec owl-redpanda-1 rpk topic consume owl.public.Like --offset end --num 1
```

Or watch it live in the Console UI.

## Key choices & trade-offs

- **Debezium via Kafka Connect** (not Debezium Server or the embedded engine): the
  canonical, REST-managed, UI-visible topology — best for learning the real-world
  shape. Debezium Server is lighter but single-sink and not visible in the Console;
  the embedded engine couples CDC into the app process.
- **`pgoutput`** decoding plugin — built into Postgres 16, no custom image.
- **JSON converter, schemas off** — human-readable payloads and no Schema Registry to
  operate. Trade-off: no enforced schema evolution / Avro; fine for a learning loop,
  easy to upgrade later with a registry.
- **`snapshot.mode=no_data`** — captures schema and streams only *new* changes, so the
  first bring-up doesn't replay ~8M historical rows from the seeded data. To backfill
  history instead, set `snapshot.mode=initial` in
  `cdc/connectors/owl-postgres.template.json` and re-run `cdc:up` (expect a large,
  slow snapshot).
- **PascalCase tables**: `table.include.list` uses unquoted names (`public.Post`) — the
  value is a regex matched against the case-sensitive stored identifier; SQL-style
  double quotes would be treated as literal characters and fail to match.
- **Redpanda vs Kafka**: Kafka-API compatible and far lighter (single binary, no
  ZooKeeper). The one historical rough edge is AdminClient topic creation, so Connect's
  internal topics and the connector's data topics are created explicitly with
  replication factor 1 (single broker).

## Operational gotchas

- **The replication slot pins WAL.** Once Debezium creates `owl_cdc_slot`, Postgres
  retains WAL until the slot's confirmed LSN advances. If Connect is stopped and left
  down, WAL accumulates in `pg_data` and can fill the disk. Inspect with:
  ```sql
  SELECT slot_name, active,
         pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), confirmed_flush_lsn)) AS retained
  FROM pg_replication_slots;
  ```
- **Always `pnpm cdc:clean` before tearing down.** Deleting the connector does *not*
  drop the slot/publication — they persist in the volume. `cdc:clean` deletes the
  connector and drops `owl_cdc_slot` + `owl_cdc_pub`.
- **`wal_level=logical`** writes somewhat more WAL and adds decoding CPU — negligible on
  a dev box, but it's a real cost in production.

## Next

Build consumers off these topics: a like-counter view in Redis (Phase 2), timeline
fan-out (Phase 3), trending via Flink (Phase 4).
