-- Idempotent pgvector setup. Applied by `bun run db:push` after Prisma schema push.
CREATE EXTENSION IF NOT EXISTS vector;

-- Prisma 6 stores Unsupported("vector") without a dimension. Pin 1536
-- (OpenAI text-embedding-3-small / ada-002). Reindex if you change models.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'RagChunk' AND column_name = 'embedding'
  ) THEN
    BEGIN
      ALTER TABLE "RagChunk" ALTER COLUMN embedding TYPE vector(1536);
    EXCEPTION WHEN others THEN
      -- Already typed, or no rows to recast yet.
      NULL;
    END;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS rag_chunk_embedding_hnsw
  ON "RagChunk"
  USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS rag_chunk_scope_btree
  ON "RagChunk" ("userId", "projectId", "sourceType");
