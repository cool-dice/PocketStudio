-- Runs on first container init. `scripts/ensure-pgvector.ts` is idempotent
-- and also enables the extension after `prisma db push`.
CREATE EXTENSION IF NOT EXISTS vector;
