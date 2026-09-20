/**
 * Validation for provider/model create+update bodies.
 * Shared-safe (zod lives at repo root).
 */

import { z } from "zod";

import { GatewayError } from "./errors";
import { assertHttpUrl } from "./http";
import { isAiToolId, isProviderKind } from "./tools";

export const providerCreateSchema = z.object({
  kind: z.string().trim().min(1),
  name: z.string().trim().min(1, "Укажите название").max(80),
  baseUrl: z.string().trim().min(1, "Укажите URL"),
  apiKey: z.string().trim().min(1, "Укажите ключ API"),
  enabled: z.boolean().optional(),
  visibleToUsers: z.boolean().optional(),
  markupPercent: z.number().min(0).max(1000).nullable().optional(),
  markupMultiplier: z.number().min(0).max(20).nullable().optional(),
  extraHeaders: z.string().max(4_000).nullable().optional(),
});

export const providerUpdateSchema = z.object({
  kind: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1).max(80).optional(),
  baseUrl: z.string().trim().min(1).optional(),
  apiKey: z.string().trim().min(1).optional(),
  enabled: z.boolean().optional(),
  visibleToUsers: z.boolean().optional(),
  markupPercent: z.number().min(0).max(1000).nullable().optional(),
  markupMultiplier: z.number().min(0).max(20).nullable().optional(),
  extraHeaders: z.string().max(4_000).nullable().optional(),
});

export const modelCreateSchema = z.object({
  modelId: z.string().trim().min(1, "Укажите id модели").max(120),
  displayName: z.string().trim().min(1, "Укажите название").max(80),
  capChat: z.boolean().optional(),
  capImage: z.boolean().optional(),
  capTts: z.boolean().optional(),
  capAsr: z.boolean().optional(),
  capEmbeddings: z.boolean().optional(),
  enabled: z.boolean().optional(),
});

export const modelUpdateSchema = modelCreateSchema.partial().extend({
  modelId: z.string().trim().min(1).max(120).optional(),
  displayName: z.string().trim().min(1).max(80).optional(),
});

export const toolDefaultSchema = z.object({
  toolId: z.string().trim().min(1),
  modelId: z.string().trim().min(1),
});

export const userToolOverrideSchema = z.object({
  modelId: z.string().trim().min(1).nullable(),
});

export function parseKind(kind: string): "openai_compatible" | "anthropic_compatible" {
  if (!isProviderKind(kind)) {
    throw new GatewayError(
      "Тип провайдера: openai_compatible или anthropic_compatible",
      400,
    );
  }
  return kind;
}

export function parseBaseUrl(raw: string): string {
  return assertHttpUrl(raw);
}

export function parseExtraHeadersJson(raw: string | null | undefined): string | null {
  if (raw == null || raw.trim() === "") return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("not object");
    }
    return JSON.stringify(parsed);
  } catch {
    throw new GatewayError("Доп. заголовки должны быть JSON-объектом", 400);
  }
}

export function requireToolId(value: string): string {
  if (!isAiToolId(value)) {
    throw new GatewayError("Неизвестный инструмент", 400);
  }
  return value;
}
