import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import {
  MCP_CATALOG,
  catalogOrder,
  validateMcpConfig,
} from "@/lib/mcp-catalog";
import { mcpDto } from "@/lib/mcp-shapes";
import {
  attachMcpRuntimeStatus,
  probeMcpRuntime,
  resolveCommandPresence,
  stdioCommandFromConfig,
} from "@/lib/mcp-runtime";

export const dynamic = "force-dynamic";

/** Ленивый посев каталога: строки каталога создаются при первом запросе. */
async function ensureCatalog(userId: string): Promise<void> {
  const existing = await db.mcpServer.findMany({
    where: { userId, own: false },
    select: { catalogKey: true },
  });
  const have = new Set(existing.map((r) => r.catalogKey));
  for (const item of MCP_CATALOG) {
    if (have.has(item.key)) continue;
    await db.mcpServer.create({
      data: {
        userId,
        catalogKey: item.key,
        name: item.name,
        description: item.description,
        category: item.category,
        transport: item.transport,
        config: JSON.stringify(item.config),
        adapter: item.adapter,
        external: item.external,
        toolsCount: item.toolsCount,
        enabled: item.defaultEnabled,
        own: false,
      },
    });
  }
}

/* ── GET /api/mcp — список серверов (каталог + свои) ── */

export async function GET(req: Request) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  await ensureCatalog(session.sub);
  const rows = await db.mcpServer.findMany({
    where: { userId: session.sub },
    orderBy: { createdAt: "asc" },
  });

  const sorted = rows.sort((a, b) => {
    const ownDiff = Number(a.own) - Number(b.own);
    if (ownDiff !== 0) return ownDiff;
    const orderDiff = catalogOrder(a.catalogKey) - catalogOrder(b.catalogKey);
    if (orderDiff !== 0) return orderDiff;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  const runtime = await probeMcpRuntime();
  const dtos = sorted.map(mcpDto);
  const commandPresence = await resolveCommandPresence(
    dtos
      .map((dto) =>
        dto.transport === "stdio" ? stdioCommandFromConfig(dto.config) : null,
      )
      .filter((cmd): cmd is string => Boolean(cmd)),
  );
  return NextResponse.json({
    runtime,
    servers: dtos.map((dto) =>
      attachMcpRuntimeStatus(dto, {
        agentBrowser: runtime.agentBrowser,
        commandPresence,
      }),
    ),
  });
}

/* ── POST /api/mcp — добавить свой сервер ── */

const createSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Название не может быть пустым")
    .max(60, "Максимум 60 символов"),
  description: z.string().trim().max(200).optional(),
  transport: z.enum(["stdio", "sse"]),
  config: z.record(z.string(), z.unknown()),
});

export async function POST(req: Request) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректный запрос" },
      { status: 400 },
    );
  }
  const { name, description, transport, config } = parsed.data;

  const validated = validateMcpConfig(transport, config);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const duplicate = await db.mcpServer.findFirst({
    where: { userId: session.sub, own: true, name },
    select: { id: true },
  });
  if (duplicate) {
    return NextResponse.json(
      { error: "Сервер с таким названием уже добавлен" },
      { status: 409 },
    );
  }

  const row = await db.mcpServer.create({
    data: {
      userId: session.sub,
      catalogKey: null,
      name,
      description: description ?? "Свой MCP-сервер",
      category: "dev",
      transport,
      config: JSON.stringify(validated.config),
      adapter: null,
      external: true,
      toolsCount: 0,
      enabled: true,
      own: true,
    },
  });

  const runtime = await probeMcpRuntime();
  const dto = mcpDto(row);
  const command =
    dto.transport === "stdio" ? stdioCommandFromConfig(dto.config) : null;
  const commandPresence = await resolveCommandPresence(command ? [command] : []);
  return NextResponse.json(
    {
      server: attachMcpRuntimeStatus(dto, {
        agentBrowser: runtime.agentBrowser,
        commandPresence,
      }),
    },
    { status: 201 },
  );
}
