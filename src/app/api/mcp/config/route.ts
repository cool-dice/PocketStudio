import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

/* ── GET /api/mcp/config — сгенерированный MCP-конфиг включённых серверов ──
 *
 * Реальный конфиг оркестратора: по каждой включённой строке реестра —
 * блок её транспортом (builtin-адаптер / stdio-команда / sse-url).
 */

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

export async function GET(req: Request) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const rows = await db.mcpServer.findMany({
    where: { userId: session.sub, enabled: true },
    orderBy: { createdAt: "asc" },
    select: { name: true, transport: true, adapter: true, config: true },
  });

  const mcpServers: Record<string, Record<string, unknown>> = {};
  for (const row of rows) {
    const config = parseConfig(row.config);
    if (row.transport === "builtin") {
      mcpServers[row.name.toLowerCase()] = {
        transport: "builtin",
        adapter: row.adapter,
        ...config,
      };
    } else if (row.transport === "sse") {
      mcpServers[row.name.toLowerCase()] = {
        transport: "sse",
        url: typeof config.url === "string" ? config.url : "",
      };
    } else {
      mcpServers[row.name.toLowerCase()] = {
        transport: "stdio",
        command: typeof config.command === "string" ? config.command : "",
        ...(Array.isArray(config.args) ? { args: config.args } : {}),
        ...(config.env && typeof config.env === "object"
          ? { env: config.env }
          : {}),
      };
    }
  }

  const json = JSON.stringify({ mcpServers }, null, 2);
  return NextResponse.json({ config: json, count: rows.length });
}
