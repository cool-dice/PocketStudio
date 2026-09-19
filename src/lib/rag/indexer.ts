/**
 * Index one canon source. Skip re-embed when contentHash is unchanged.
 */

import type { PrismaClient } from "@prisma/client";

import { chunkCode, chunkText, type TextChunk } from "./chunk";
import { tryEmbedTexts } from "./embed";
import { ragContentHash } from "./hash";
import { deleteSourceChunks, loadSourceHashes, upsertChunk } from "./store";
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
): Promise<{ chunks: number; embedded: number; skipped: number }> {
  const body = (doc.body ?? "").trim();
  if (!body) {
    await deleteSourceChunks(db, doc.userId, doc.sourceType, doc.sourceId);
    return { chunks: 0, embedded: 0, skipped: 0 };
  }
  const prefix = doc.title?.trim() ? `# ${doc.title.trim()}\n\n` : "";
  const full = `${prefix}${body}`;
  const pieces: TextChunk[] = doc.code
    ? chunkCode(full, doc.path)
    : chunkText(full);

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
  const BATCH = 16;
  for (let i = 0; i < toEmbed.length; i += BATCH) {
    const batch = toEmbed.slice(i, i + BATCH);
    const { vectors } = await tryEmbedTexts(
      db,
      doc.userId,
      batch.map((b) => b.chunk.content),
    );
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

  return { chunks: pieces.length, embedded, skipped };
}

export async function removeSource(
  db: PrismaClient,
  userId: string,
  sourceType: RagSourceType,
  sourceId: string,
): Promise<void> {
  await deleteSourceChunks(db, userId, sourceType, sourceId);
}
