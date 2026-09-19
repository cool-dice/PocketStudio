/**
 * RagChunk persistence. Embeddings go through raw SQL (pgvector).
 * Metadata rows can be read via Prisma.
 */

import { randomUUID } from "node:crypto";

import type { PrismaClient } from "@prisma/client";

import { vectorLiteral } from "./hash";
import type { RagChunkRow, RagScope } from "./types";
import { RAG_EMBEDDING_DIM } from "./types";

export interface UpsertChunkInput {
  userId: string;
  projectId: string | null;
  sourceType: string;
  sourceId: string;
  path: string | null;
  ordinal: number;
  content: string;
  tokenCount: number;
  contentHash: string;
  embedding: number[] | null;
}

export async function deleteSourceChunks(
  db: PrismaClient,
  userId: string,
  sourceType: string,
  sourceId: string,
): Promise<void> {
  await db.ragChunk.deleteMany({ where: { userId, sourceType, sourceId } });
}

export async function loadSourceHashes(
  db: PrismaClient,
  userId: string,
  sourceType: string,
  sourceId: string,
): Promise<Map<number, string>> {
  const rows = await db.ragChunk.findMany({
    where: { userId, sourceType, sourceId },
    select: { ordinal: true, contentHash: true },
  });
  return new Map(rows.map((r) => [r.ordinal, r.contentHash]));
}

export async function upsertChunk(db: PrismaClient, input: UpsertChunkInput): Promise<void> {
  const id = randomUUID().replace(/-/g, "").slice(0, 24);
  const projectId = input.projectId;
  const path = input.path;
  const embeddingSql =
    input.embedding && input.embedding.length === RAG_EMBEDDING_DIM
      ? `${quoteLiteral(vectorLiteral(input.embedding))}::vector`
      : "NULL";

  await db.$executeRawUnsafe(
    `INSERT INTO "RagChunk"
      (id, "userId", "projectId", "sourceType", "sourceId", path, ordinal, content, "tokenCount", embedding, "contentHash", "createdAt", "updatedAt")
     VALUES
      (${quoteLiteral(id)}, ${quoteLiteral(input.userId)}, ${sqlNull(projectId)},
       ${quoteLiteral(input.sourceType)}, ${quoteLiteral(input.sourceId)}, ${sqlNull(path)},
       ${input.ordinal}, ${quoteLiteral(input.content)}, ${input.tokenCount},
       ${embeddingSql}, ${quoteLiteral(input.contentHash)}, NOW(), NOW())
     ON CONFLICT ("userId", "sourceType", "sourceId", ordinal)
     DO UPDATE SET
       "projectId" = EXCLUDED."projectId",
       path = EXCLUDED.path,
       content = EXCLUDED.content,
       "tokenCount" = EXCLUDED."tokenCount",
       embedding = EXCLUDED.embedding,
       "contentHash" = EXCLUDED."contentHash",
       "updatedAt" = NOW()`,
  );
}

export async function searchVector(
  db: PrismaClient,
  scope: RagScope,
  queryEmbedding: number[],
  opts: { kinds?: string[]; limit: number },
): Promise<RagChunkRow[]> {
  if (queryEmbedding.length !== RAG_EMBEDDING_DIM) return [];
  const kinds = (opts.kinds ?? []).filter(Boolean);
  const kindSql =
    kinds.length > 0
      ? `AND c."sourceType" IN (${kinds.map(quoteLiteral).join(",")})`
      : "";
  const scopeSql =
    scope.kind === "workspace"
      ? `AND c."projectId" = ${quoteLiteral(scope.projectId!)}`
      : "";
  const vec = quoteLiteral(vectorLiteral(queryEmbedding));
  const sql = `
    SELECT c.id, c."userId", c."projectId", c."sourceType", c."sourceId", c.path,
           c.ordinal, c.content, c."tokenCount", c."contentHash",
           p.name AS "projectName",
           (1 - (c.embedding <=> ${vec}::vector))::float AS score
    FROM "RagChunk" c
    LEFT JOIN "Project" p ON p.id = c."projectId"
    WHERE c."userId" = ${quoteLiteral(scope.userId)}
      AND c.embedding IS NOT NULL
      ${scopeSql}
      ${kindSql}
    ORDER BY c.embedding <=> ${vec}::vector
    LIMIT ${Math.max(1, Math.min(24, opts.limit))}
  `;
  return (await db.$queryRawUnsafe<RagChunkRow[]>(sql)) ?? [];
}

export async function loadScopedChunks(
  db: PrismaClient,
  scope: RagScope,
  opts: { kinds?: string[]; take: number },
): Promise<RagChunkRow[]> {
  const kinds = (opts.kinds ?? []).filter(Boolean);
  const rows = await db.ragChunk.findMany({
    where: {
      userId: scope.userId,
      ...(scope.kind === "workspace" ? { projectId: scope.projectId } : {}),
      ...(kinds.length > 0 ? { sourceType: { in: kinds } } : {}),
    },
    select: {
      id: true,
      userId: true,
      projectId: true,
      sourceType: true,
      sourceId: true,
      path: true,
      ordinal: true,
      content: true,
      tokenCount: true,
      contentHash: true,
    },
    orderBy: { updatedAt: "desc" },
    take: opts.take,
  });
  const projectIds = [
    ...new Set(rows.map((r) => r.projectId).filter((id): id is string => Boolean(id))),
  ];
  const projects =
    projectIds.length === 0
      ? []
      : await db.project.findMany({
          where: { id: { in: projectIds }, userId: scope.userId },
          select: { id: true, name: true },
        });
  const names = new Map(projects.map((p) => [p.id, p.name]));
  return rows.map((r) => ({
    ...r,
    projectName: r.projectId ? names.get(r.projectId) ?? null : null,
  }));
}

function quoteLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlNull(value: string | null): string {
  return value == null ? "NULL" : quoteLiteral(value);
}
