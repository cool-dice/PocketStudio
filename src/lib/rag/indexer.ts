/**
 * Index one canon source. Skip re-embed when contentHash is unchanged.
 */

import type { PrismaClient } from "@prisma/client";

import { chunkCode, chunkText, type TextChunk } from "./chunk";
import { tryEmbedTexts } from "./embed";
import { ragContentHash } from "./hash";
import {
  deleteFileChunksForPath,
  deleteSourceChunks,
  loadSourceHashes,
  upsertChunk,
} from "./store";
import type { RagSourceType } from "./types";

export interface IndexDocument {
  userId: string;
  projectId: string | null;
  sourceType: RagSourceType;
  sourceId: string;
  path?: string | null;
  title?: string | null;
  body: string;
  code?: boolean;
}

export async function indexDocument(
  db: PrismaClient,
  doc: IndexDocument,
): Promise<{ chunks: number; embedded: number; skipped: number; embedFailed: boolean }> {
  const body = (doc.body ?? "").trim();
  if (!body) {
    await deleteSourceChunks(db, doc.userId, doc.sourceType, doc.sourceId);
    return { chunks: 0, embedded: 0, skipped: 0, embedFailed: false };
  }
  const prefix = doc.title?.trim() ? `# ${doc.title.trim()}\n\n` : "";
  let full = `${prefix}${body}`;
  if (full.length > 200_000) full = full.slice(0, 200_000);
  const pieces: TextChunk[] = (doc.code
    ? chunkCode(full, doc.path)
    : chunkText(full)
  ).slice(0, 40);

  const existing = await loadSourceHashes(db, doc.userId, doc.sourceType, doc.sourceId);
  const keepOrdinals = new Set(pieces.map((p) => p.ordinal));
  for (const ordinal of existing.keys()) {
    if (!keepOrdinals.has(ordinal)) {
      await db.ragChunk.deleteMany({
        where: {
          userId: doc.userId,
          sourceType: doc.sourceType,
          sourceId: doc.sourceId,
          ordinal,
        },
      });
    }
  }

  const toEmbed: { idx: number; chunk: TextChunk; hash: string }[] = [];
  let skipped = 0;
  for (const chunk of pieces) {
    const hash = ragContentHash(chunk.content, {
      sourceType: doc.sourceType,
      sourceId: doc.sourceId,
      path: doc.path ?? null,
      ordinal: chunk.ordinal,
    });
    if (existing.get(chunk.ordinal) === hash) {
      skipped += 1;
      continue;
    }
    toEmbed.push({ idx: chunk.ordinal, chunk, hash });
  }

  let embedded = 0;
  let embedFailed = false;
  const BATCH = 16;
  for (let i = 0; i < toEmbed.length; i += BATCH) {
    const batch = toEmbed.slice(i, i + BATCH);
    const { vectors, error } = await tryEmbedTexts(
      db,
      doc.userId,
      batch.map((b) => b.chunk.content),
    );
    if (error && !vectors) {
      const permanent =
        /не настроена|Anthropic не умеет|не умеет считать эмбеддинги|не той длины|измерений/i.test(
          error,
        );
      if (!permanent) embedFailed = true;
    }
    for (let j = 0; j < batch.length; j++) {
      const item = batch[j]!;
      const embedding = vectors?.[j] ?? null;
      if (embedding) embedded += 1;
      await upsertChunk(db, {
        userId: doc.userId,
        projectId: doc.projectId,
        sourceType: doc.sourceType,
        sourceId: doc.sourceId,
        path: doc.path ?? null,
        ordinal: item.chunk.ordinal,
        content: item.chunk.content,
        tokenCount: item.chunk.tokenCount,
        contentHash: item.hash,
        embedding,
      });
    }
  }

  return { chunks: pieces.length, embedded, skipped, embedFailed };
}

export async function removeSource(
  db: PrismaClient,
  userId: string,
  sourceType: RagSourceType,
  sourceId: string,
): Promise<void> {
  await deleteSourceChunks(db, userId, sourceType, sourceId);
}

export async function removeFileChunks(
  db: PrismaClient,
  userId: string,
  projectId: string,
  relPath: string,
): Promise<void> {
  await deleteFileChunksForPath(db, userId, projectId, relPath);
}
