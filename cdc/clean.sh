#!/usr/bin/env sh
# Tear down the Debezium connector and the Postgres replication slot/publication
# it created. Run this before `pnpm cdc:down` — deleting the connector does NOT
# drop the slot, and a lingering slot pins WAL (disk grows until it's removed).
set -e

echo "→ deleting Debezium connector (if present)..."
curl -s -X DELETE http://localhost:8083/connectors/owl-postgres >/dev/null 2>&1 || true

# Let Postgres mark the slot inactive before we drop it.
sleep 2

# Connect to the dev DB via the host-exposed port using DATABASE_URL from .env
# (strip the ?schema=public query, which psql does not accept).
URL=$(grep -oE 'DATABASE_URL="?[^"]+' .env | sed -E 's/DATABASE_URL=//; s/"//g; s/\?.*//')

echo "→ dropping replication slot + publication..."
psql "$URL" \
  -c "SELECT pg_drop_replication_slot('owl_cdc_slot') FROM pg_replication_slots WHERE slot_name = 'owl_cdc_slot';" \
  -c "DROP PUBLICATION IF EXISTS owl_cdc_pub;"

echo "✓ CDC cleanup done."
