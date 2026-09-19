/**
 * Enable pgvector + HNSW after `prisma db push`. Idempotent.
 */

import { PrismaClient } from "@prisma/client";

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.startsWith("postgres")) {
    console.error("DATABASE_URL должен быть PostgreSQL (postgresql://…), не SQLite.");
    process.exit(1);
  }
  const db = new PrismaClient();
  try {
    await db.$executeRawUnsafe("CREATE EXTENSION IF NOT EXISTS vector");
    await db.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'RagChunk' AND column_name = 'embedding'
        ) THEN
          BEGIN
            ALTER TABLE "RagChunk" ALTER COLUMN embedding TYPE vector(1536);
          EXCEPTION WHEN others THEN
            NULL;
          END;
        END IF;
      END $$;
    `);
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS rag_chunk_embedding_hnsw
        ON "RagChunk"
        USING hnsw (embedding vector_cosine_ops)
    `);
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS rag_chunk_scope_btree
        ON "RagChunk" ("userId", "projectId", "sourceType")
    `);
    console.log("pgvector: extension + RagChunk HNSW index ready.");
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
