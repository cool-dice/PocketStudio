#!/usr/bin/env bash
# Idempotently start the local PostgreSQL 16 cluster and make sure the
# PocketStudio role/database/pgvector extension exist. Safe to run repeatedly
# (used by both install and start).
set -euo pipefail

export PATH="/usr/lib/postgresql/16/bin:$PATH"

PG_USER="pocketstudio"
PG_PASS="pocketstudio"
PG_DB="pocketstudio"

# Start the cluster if it is not already accepting connections.
if ! sudo -u postgres pg_isready -h 127.0.0.1 -p 5432 >/dev/null 2>&1; then
  echo "[postgres] starting cluster 16/main"
  sudo pg_ctlcluster 16 main start || true
fi

# Wait for readiness (up to ~30s).
for _ in $(seq 1 30); do
  if sudo -u postgres pg_isready -h 127.0.0.1 -p 5432 >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! sudo -u postgres pg_isready -h 127.0.0.1 -p 5432 >/dev/null 2>&1; then
  echo "[postgres] cluster failed to become ready" >&2
  exit 1
fi

# Ensure role exists.
sudo -u postgres psql -v ON_ERROR_STOP=1 -c \
  "DO \$\$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='${PG_USER}') THEN CREATE ROLE ${PG_USER} LOGIN PASSWORD '${PG_PASS}'; END IF; END \$\$;"
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "ALTER ROLE ${PG_USER} CREATEDB;"

# Ensure database exists.
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${PG_DB}'" | grep -q 1; then
  sudo -u postgres createdb -O "${PG_USER}" "${PG_DB}"
fi

# Ensure pgvector extension exists.
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${PG_DB}" -c "CREATE EXTENSION IF NOT EXISTS vector;" >/dev/null

echo "[postgres] ready on 127.0.0.1:5432 (db=${PG_DB})"
