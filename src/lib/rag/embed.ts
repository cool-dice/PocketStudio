/**
 * Embeddings via the studio gateway (tool id `embeddings`).
 */

import type { PrismaClient } from "@prisma/client";

import { isAbortFlag } from "../abort-flag";
import { createEmbeddings } from "../ai/connector";
import { GatewayError } from "../ai/errors";
import { resolveToolRoute } from "../ai/resolve";
import {
  EMBEDDING_DIM_MISMATCH_MESSAGE,
  RAG_EMBEDDING_DIM,
  UNCONFIGURED_EMBEDDINGS_MESSAGE,
} from "./types";

export async function embedTexts(
  db: PrismaClient,
  userId: string,
  texts: string[],
  signal?: AbortSignal,
): Promise<number[][]> {
  if (texts.length === 0) return [];
  const route = await resolveToolRoute(db, userId, "embeddings");
  const { vectors } = await createEmbeddings(route, texts, { signal });
  const dim = vectors[0]?.length ?? 0;
  if (vectors.length > 0 && dim !== RAG_EMBEDDING_DIM) {
    throw new GatewayError(EMBEDDING_DIM_MISMATCH_MESSAGE, 400);
  }
  return vectors;
}

export async function tryEmbedTexts(
  db: PrismaClient,
  userId: string,
  texts: string[],
  signal?: AbortSignal,
): Promise<{ vectors: number[][] | null; error: string | null }> {
  try {
    const vectors = await embedTexts(db, userId, texts, signal);
    return { vectors, error: null };
  } catch (err) {
    if (isAbortFlag(err) || signal?.aborted) throw err;
    if (err instanceof GatewayError && err.status === 400) {
      return { vectors: null, error: err.message };
    }
    const msg = err instanceof Error ? err.message : UNCONFIGURED_EMBEDDINGS_MESSAGE;
    return { vectors: null, error: msg };
  }
}

export async function embeddingsConfigured(
  db: PrismaClient,
  userId: string,
): Promise<boolean> {
  try {
    await resolveToolRoute(db, userId, "embeddings");
    return true;
  } catch {
    return false;
  }
}
