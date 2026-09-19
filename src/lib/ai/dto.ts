/**
 * Shared DTO helpers for AI provider CRUD (admin + user settings).
 * No Prisma imports of the generated client beyond types used at call sites.
 */

import { maskApiKey } from "./crypto";
import type { AiCapability } from "./tools";

export interface ProviderPublicDto {
  id: string;
  kind: string;
  name: string;
  baseUrl: string;
  apiKeyMasked: string;
  enabled: boolean;
  visibleToUsers: boolean;
  markupPercent: number | null;
  markupMultiplier: number | null;
  extraHeaders: string | null;
  isPlatform: boolean;
  createdAt: string;
  updatedAt: string;
  models: ModelPublicDto[];
}

export interface ModelPublicDto {
  id: string;
  providerId: string;
  modelId: string;
  displayName: string;
  capChat: boolean;
  capImage: boolean;
  capTts: boolean;
  capAsr: boolean;
  capEmbeddings: boolean;
  enabled: boolean;
}

export interface ToolDefaultDto {
  toolId: string;
  label: string;
  capability: AiCapability;
  modelId: string | null;
  model: {
    id: string;
    modelId: string;
    displayName: string;
    providerId: string;
    providerName: string;
  } | null;
}

type ProviderRow = {
  id: string;
  userId: string | null;
  kind: string;
  name: string;
  baseUrl: string;
  apiKeyLast4: string;
  enabled: boolean;
  visibleToUsers: boolean;
  markupPercent: number | null;
  markupMultiplier: number | null;
  extraHeaders: string | null;
  createdAt: Date;
  updatedAt: Date;
  models?: ModelRow[];
};

type ModelRow = {
  id: string;
  providerId: string;
  modelId: string;
  displayName: string;
  capChat: boolean;
  capImage: boolean;
  capTts: boolean;
  capAsr: boolean;
  capEmbeddings: boolean;
  enabled: boolean;
};

export function modelDto(row: ModelRow): ModelPublicDto {
  return {
    id: row.id,
    providerId: row.providerId,
    modelId: row.modelId,
    displayName: row.displayName,
    capChat: row.capChat,
    capImage: row.capImage,
    capTts: row.capTts,
    capAsr: row.capAsr,
    capEmbeddings: row.capEmbeddings,
    enabled: row.enabled,
  };
}

export function providerDto(row: ProviderRow): ProviderPublicDto {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    baseUrl: row.baseUrl,
    apiKeyMasked: maskApiKey(row.apiKeyLast4),
    enabled: row.enabled,
    visibleToUsers: row.visibleToUsers,
    markupPercent: row.markupPercent,
    markupMultiplier: row.markupMultiplier,
    extraHeaders: null,
    isPlatform: row.userId == null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    models: (row.models ?? []).map(modelDto),
  };
}
