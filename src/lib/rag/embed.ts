/**
 * Embeddings via the studio gateway (tool id `embeddings`).
 */

import type { PrismaClient } from "@prisma/client";

import { createEmbeddings } from "../ai/connector";
import { GatewayError } from "../ai/errors";
import { resolveToolRoute } from "../ai/resolve";
import { UNCONFIGURED_EMBEDDINGS_MESSAGE } from "./types";

export async function embedTexts(
  db: PrismaClient,
  userId: string,
  texts: string[],
): Promise<number[][]> {
  if (texts.length === 0) return [];
  const route = await resolveToolRoute(db, userId, "embeddings");
  const { vectors } = await createEmbeddings(route, texts);
  return vectors;
}

export async function tryEmbedTexts(
  db: PrismaClient,
  userId: string,
  texts: string[],
): Promise<{ vectors: number[][] | null; error: string | null }> {
  try {
    const vectors = await embedTexts(db, userId, texts);
    return { vectors, error: null };
  } catch (err) {
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
