#!/usr/bin/env bash
# Repository bootstrap for PocketStudio. Idempotent and self-contained: it
# installs the system dependencies that are not part of the default base image
# (PostgreSQL 16 + pgvector, Bun), then syncs project deps and the DB schema.
# Safe to re-run.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

export PATH="$HOME/.bun/bin:/usr/lib/postgresql/16/bin:$PATH"

# --- System dependencies (only installed when missing) ---------------------
if ! command -v pg_ctlcluster >/dev/null 2>&1 || [ ! -d /usr/lib/postgresql/16 ]; then
  echo "[apt] installing PostgreSQL 16 + pgvector"
  sudo apt-get update -y
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y postgresql-16 postgresql-16-pgvector
fi

if ! command -v bun >/dev/null 2>&1 && [ ! -x "$HOME/.bun/bin/bun" ]; then
  echo "[bun] installing Bun runtime"
  curl -fsSL https://bun.sh/install | bash
fi
export PATH="$HOME/.bun/bin:$PATH"

# --- Local dev env file -----------------------------------------------------
# AUTH_SECRET is generated once and reused so sessions and encrypted provider
# keys stay stable for the life of this environment.
if [ ! -f .env ]; then
  echo "[env] creating .env from .env.example"
  cp .env.example .env
  SECRET="$(openssl rand -base64 32)"
  sed -i "s|^AUTH_SECRET=.*|AUTH_SECRET=${SECRET}|" .env
fi

# --- Database ---------------------------------------------------------------
# Bring up Postgres + pgvector so `prisma db push` can sync the schema.
bash "$REPO_ROOT/.cursor/start-postgres.sh"

# --- Project dependencies + schema -----------------------------------------
echo "[deps] bun install"
bun install --frozen-lockfile

echo "[prisma] generate + db push (schema + pgvector HNSW index)"
bun run db:push

echo "[install] done"
