/**
 * Record token usage for billing. Streamed OpenAI turns only include
 * usage when the request set `stream_options.include_usage`.
 */

import type { ChatUsage, ResolvedRoute } from "./connector";

export interface UsageAuditDb {
  auditLog: {
    create: (args: {
      data: {
        userId: string;
        action: string;
        entity?: string | null;
        entityId?: string | null;
        meta?: string | null;
      };
    }) => Promise<unknown>;
  };
}

export function shouldRecordUsage(usage: ChatUsage): boolean {
  return usage.tokensIn != null || usage.tokensOut != null;
}

export function chatUsageMeta(
  route: ResolvedRoute,
  usage: ChatUsage,
): Record<string, unknown> {
  return {
    tokensIn: usage.tokensIn,
    tokensOut: usage.tokensOut,
    billableTokensOut: usage.billableTokensOut,
    providerId: route.provider.id,
    modelId: route.model.modelId,
    streamed: true,
  };
}

export async function recordChatUsage(
  db: UsageAuditDb,
  opts: {
    userId: string;
    toolId: string;
    route: ResolvedRoute;
    usage: ChatUsage;
  },
): Promise<void> {
  if (!shouldRecordUsage(opts.usage)) return;
  await db.auditLog.create({
    data: {
      userId: opts.userId,
      action: "ai.usage",
      entity: "ai",
      entityId: opts.route.model.id,
      meta: JSON.stringify({
        toolId: opts.toolId,
        ...chatUsageMeta(opts.route, opts.usage),
      }),
    },
  });
}
