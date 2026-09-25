#!/usr/bin/env bash
# Per-boot startup: make sure the PostgreSQL daemon is running before the app
# and agent services come up. Idempotent and returns once the DB is ready.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
bash "$REPO_ROOT/.cursor/start-postgres.sh"
