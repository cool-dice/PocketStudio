/**
 * Resolve which provider+model to use for a (user, tool) request.
 *
 * Order:
 *   1. User override for that tool (if set, enabled, and allowed)
 *   2. Platform default for that tool
 *   3. GatewayError 400 — UNCONFIGURED_TOOL_MESSAGE
 *
 * Shared-safe: PrismaClient type only, no "@/..." aliases.
 */

import type { PrismaClient } from "@prisma/client";

import { decryptSecret } from "./crypto";
import { GatewayError } from "./errors";
import {
  AI_TOOL_BY_ID,
  UNCONFIGURED_TOOL_MESSAGE,
  isAiToolId,
  isProviderKind,
  type AiCapability,
  type AiToolId,
} from "./tools";
import type { ResolvedModel, ResolvedProvider, ResolvedRoute } from "./connector";

export interface LoadedCandidate {
  providerId: string;
  providerUserId: string | null;
  providerKind: string;
  providerName: string;
  providerBaseUrl: string;
  providerApiKey: string;
  providerExtraHeaders: string | null;
  providerEnabled: boolean;
  providerVisible: boolean;
  markupPercent: number | null;
  markupMultiplier: number | null;
  modelRowId: string;
  modelId: string;
  displayName: string;
  capChat: boolean;
  capImage: boolean;
  capTts: boolean;
  capAsr: boolean;
  capEmbeddings: boolean;
  modelEnabled: boolean;
}

function hasCapability(row: LoadedCandidate, cap: AiCapability): boolean {
  if (cap === "chat") return row.capChat;
  if (cap === "image") return row.capImage;
  if (cap === "tts") return row.capTts;
  if (cap === "asr") return row.capAsr;
  if (cap === "embeddings") return row.capEmbeddings;
  return false;
}

function toRoute(toolId: string, row: LoadedCandidate): ResolvedRoute {
  if (!isProviderKind(row.providerKind)) {
    throw new GatewayError("Неизвестный тип провайдера", 500);
  }
  const provider: ResolvedProvider = {
    id: row.providerId,
    kind: row.providerKind,
    name: row.providerName,
    baseUrl: row.providerBaseUrl,
    apiKey: decryptSecret(row.providerApiKey),
    extraHeaders: row.providerExtraHeaders,
    isPlatform: row.providerUserId == null,
    markupPercent: row.markupPercent,
    markupMultiplier: row.markupMultiplier,
  };
  const model: ResolvedModel = {
    id: row.modelRowId,
    modelId: row.modelId,
    displayName: row.displayName,
    capChat: row.capChat,
    capImage: row.capImage,
    capTts: row.capTts,
    capAsr: row.capAsr,
    capEmbeddings: row.capEmbeddings,
  };
  return { toolId, provider, model };
}

export function pickCandidate(opts: {
  toolId: AiToolId;
  capability: AiCapability;
  override: LoadedCandidate | null;
  platformDefault: LoadedCandidate | null;
  userId: string;
}): LoadedCandidate {
  const overrideOk =
    opts.override &&
    opts.override.modelEnabled &&
    opts.override.providerEnabled &&
    (opts.override.providerUserId === opts.userId ||
      (opts.override.providerUserId == null && opts.override.providerVisible));

  if (opts.override && overrideOk) {
    if (!hasCapability(opts.override, opts.capability)) {
      throw new GatewayError(
        "Выбранная модель не поддерживает этот инструмент — смените модель в настройках",
        400,
      );
    }
    return opts.override;
  }

  const platformOk =
    opts.platformDefault &&
    opts.platformDefault.modelEnabled &&
    opts.platformDefault.providerEnabled &&
    opts.platformDefault.providerUserId == null;

  if (opts.platformDefault && platformOk) {
    if (!hasCapability(opts.platformDefault, opts.capability)) {
      throw new GatewayError(UNCONFIGURED_TOOL_MESSAGE, 400);
    }
    return opts.platformDefault;
  }

  throw new GatewayError(UNCONFIGURED_TOOL_MESSAGE, 400);
}

type ModelWithProvider = {
  id: string;
  modelId: string;
  displayName: string;
  capChat: boolean;
  capImage: boolean;
  capTts: boolean;
  capAsr: boolean;
  capEmbeddings: boolean;
  enabled: boolean;
  provider: {
    id: string;
    userId: string | null;
    kind: string;
    name: string;
    baseUrl: string;
    apiKey: string;
    extraHeaders: string | null;
    enabled: boolean;
    visibleToUsers: boolean;
    markupPercent: number | null;
    markupMultiplier: number | null;
  };
};

function fromPrisma(row: ModelWithProvider): LoadedCandidate {
  return {
    providerId: row.provider.id,
    providerUserId: row.provider.userId,
    providerKind: row.provider.kind,
    providerName: row.provider.name,
    providerBaseUrl: row.provider.baseUrl,
    providerApiKey: row.provider.apiKey,
    providerExtraHeaders: row.provider.extraHeaders,
    providerEnabled: row.provider.enabled,
    providerVisible: row.provider.visibleToUsers,
    markupPercent: row.provider.markupPercent,
    markupMultiplier: row.provider.markupMultiplier,
    modelRowId: row.id,
    modelId: row.modelId,
    displayName: row.displayName,
    capChat: row.capChat,
    capImage: row.capImage,
    capTts: row.capTts,
    capAsr: row.capAsr,
    capEmbeddings: row.capEmbeddings,
    modelEnabled: row.enabled,
  };
}

const MODEL_INCLUDE = {
  provider: {
    select: {
      id: true,
      userId: true,
      kind: true,
      name: true,
      baseUrl: true,
      apiKey: true,
      extraHeaders: true,
      enabled: true,
      visibleToUsers: true,
      markupPercent: true,
      markupMultiplier: true,
    },
  },
} as const;

/** True only for the shared UNCONFIGURED_TOOL_MESSAGE (no model assigned). */
export async function isToolUnconfigured(
  db: PrismaClient,
  userId: string,
  toolId: string,
): Promise<boolean> {
  try {
    await resolveToolRoute(db, userId, toolId);
    return false;
  } catch (err) {
    return err instanceof GatewayError && err.message === UNCONFIGURED_TOOL_MESSAGE;
  }
}

export async function resolveToolRoute(
  db: PrismaClient,
  userId: string,
  toolId: string,
): Promise<ResolvedRoute> {
  if (!isAiToolId(toolId)) {
    throw new GatewayError("Неизвестный инструмент", 400);
  }
  const tool = AI_TOOL_BY_ID[toolId];

  const [overrideRow, defaultRow] = await Promise.all([
    db.userToolModel.findUnique({
      where: { userId_toolId: { userId, toolId } },
      include: { model: { include: MODEL_INCLUDE } },
    }),
    db.toolModelDefault.findUnique({
      where: { toolId },
      include: { model: { include: MODEL_INCLUDE } },
    }),
  ]);

  const override =
    overrideRow?.modelId && overrideRow.model
      ? fromPrisma(overrideRow.model)
      : null;
  const platformDefault = defaultRow?.model ? fromPrisma(defaultRow.model) : null;

  const picked = pickCandidate({
    toolId,
    capability: tool.capability,
    override,
    platformDefault,
    userId,
  });
  return toRoute(toolId, picked);
}

/** Probe a stored provider (admin/user test button) without a tool default. */
export async function routeForProviderTest(
  db: PrismaClient,
  providerId: string,
  ownerUserId: string | null,
): Promise<ResolvedRoute> {
  const provider = await db.aiProvider.findUnique({
    where: { id: providerId },
    include: { models: { where: { enabled: true }, take: 1, orderBy: { createdAt: "asc" } } },
  });
  if (!provider) throw new GatewayError("Провайдер не найден", 404);
  if (ownerUserId === null) {
    if (provider.userId !== null) throw new GatewayError("Провайдер не найден", 404);
  } else if (provider.userId !== ownerUserId) {
    throw new GatewayError("Провайдер не найден", 404);
  }
  if (!isProviderKind(provider.kind)) {
    throw new GatewayError("Неизвестный тип провайдера", 400);
  }
  const model = provider.models[0];
  return {
    toolId: "agent",
    provider: {
      id: provider.id,
      kind: provider.kind,
      name: provider.name,
      baseUrl: provider.baseUrl,
      apiKey: decryptSecret(provider.apiKey),
      extraHeaders: provider.extraHeaders,
      isPlatform: provider.userId == null,
      markupPercent: provider.markupPercent,
      markupMultiplier: provider.markupMultiplier,
    },
    model: {
      id: model?.id ?? "probe",
      modelId: model?.modelId ?? "dummy",
      displayName: model?.displayName ?? "probe",
      capChat: model?.capChat ?? true,
      capImage: model?.capImage ?? false,
      capTts: model?.capTts ?? false,
      capAsr: model?.capAsr ?? false,
      capEmbeddings: model?.capEmbeddings ?? false,
    },
  };
}
