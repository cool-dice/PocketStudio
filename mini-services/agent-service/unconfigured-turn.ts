/**
 * Fail-fast when the `agent` chat tool has no model.
 * Persist the Russian UNCONFIGURED_TOOL_MESSAGE as an assistant row —
 * never a fake success, never a long socket hang on planner/RAG/LLM.
 */

import type { PrismaClient } from "@prisma/client";

import {
  isUnconfiguredToolError,
  resolveToolRoute,
} from "../../src/lib/ai/resolve";
import { UNCONFIGURED_TOOL_MESSAGE } from "../../src/lib/ai/tools";

export type AgentRouteResolver = (
  db: PrismaClient,
  userId: string,
  toolId: string,
) => Promise<unknown>;

export interface PersistedAssistant {
  id: string;
  threadId: string;
  role: string;
  content: string;
  createdAt: Date;
}

export async function persistAgentUnconfiguredReply(
  db: PrismaClient,
  threadId: string,
): Promise<PersistedAssistant> {
  return db.message.create({
    data: {
      threadId,
      role: "assistant",
      content: UNCONFIGURED_TOOL_MESSAGE,
    },
  });
}

/**
 * Resolve the `agent` tool. If it is unconfigured, persist the Russian
 * error as an assistant message and return it. Configured → null.
 */
export async function replyIfAgentUnconfigured(opts: {
  db: PrismaClient;
  userId: string;
  threadId: string;
  resolve?: AgentRouteResolver;
}): Promise<PersistedAssistant | null> {
  try {
    await (opts.resolve ?? resolveToolRoute)(opts.db, opts.userId, "agent");
    return null;
  } catch (err) {
    if (!isUnconfiguredToolError(err)) throw err;
  }
  return persistAgentUnconfiguredReply(opts.db, opts.threadId);
}
