/**
 * MCP shapes (Фаза D) — строка Prisma → DTO для REST и клиента.
 */

import type { McpServerDto } from "@/lib/workspace-types";

export interface McpRow {
  id: string;
  catalogKey: string | null;
  name: string;
  description: string;
  category: string;
  transport: string;
  adapter: string | null;
  external: boolean;
  toolsCount: number;
  enabled: boolean;
  own: boolean;
  config: string;
  createdAt: Date;
}

function parseConfig(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // fallthrough
  }
  return {};
}

export function mcpDto(row: McpRow): McpServerDto {
  return {
    id: row.id,
    catalogKey: row.catalogKey,
    name: row.name,
    description: row.description,
    category: (["dev", "content", "data"] as const).includes(
      row.category as "dev",
    )
      ? (row.category as McpServerDto["category"])
      : "dev",
    transport: (["builtin", "stdio", "sse"] as const).includes(
      row.transport as "builtin",
    )
      ? (row.transport as McpServerDto["transport"])
      : "stdio",
    adapter: row.adapter,
    external: row.external,
    toolsCount: row.toolsCount,
    enabled: row.enabled,
    own: row.own,
    config: parseConfig(row.config),
    createdAt: row.createdAt.toISOString(),
  };
}
