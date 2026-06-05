#!/usr/bin/env sh
# Tear down the Debezium connector and the Postgres replication slot/publication
# it created. Run this before `pnpm cdc:down` — deleting the connector does NOT
# drop the slot, and a lingering slot pins WAL (disk grows until it's removed).
set -e

echo "→ deleting Debezium connector (if present)..."
curl -s -X DELETE http://localhost:8083/connectors/owl-postgres >/dev/null 2>&1 || true

# Let Postgres mark the slot inactive before we drop it.
sleep 2

# Connect to the dev DB on the host-exposed port. We build the connection from
# the POSTGRES_* values in .env.local (the same file connect-setup uses) rather
# than root .env's DATABASE_URL — that one is the IN-CONTAINER url (host "db",
# which doesn't resolve from the host, and an unexpanded ${POSTGRES_DB}). Using
# discrete flags + PGPASSWORD also avoids URL-encoding passwords with special chars.
if [ ! -f .env.local ]; then
  echo "✗ .env.local not found (need POSTGRES_USER/PASSWORD/DB to reach the dev DB)." >&2
  exit 1
fi
unquote() { grep -oE "^$1=.*" .env.local | sed -E "s/^$1=//; s/^\"//; s/\"$//"; }
PGUSER=$(unquote POSTGRES_USER)
PGDATABASE=$(unquote POSTGRES_DB)
PGPASSWORD=$(unquote POSTGRES_PASSWORD)
export PGPASSWORD

echo "→ dropping replication slot + publication..."
psql -h localhost -p "${POSTGRES_HOST_PORT:-5432}" -U "$PGUSER" -d "$PGDATABASE" \
  -c "SELECT pg_drop_replication_slot('owl_cdc_slot') FROM pg_replication_slots WHERE slot_name = 'owl_cdc_slot';" \
  -c "DROP PUBLICATION IF EXISTS owl_cdc_pub;"

echo "✓ CDC cleanup done."
