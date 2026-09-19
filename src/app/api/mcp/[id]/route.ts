import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { validateMcpConfig } from "@/lib/mcp-catalog";
import type { McpTransport } from "@/lib/mcp-catalog";
import { mcpDto } from "@/lib/mcp-shapes";

export const dynamic = "force-dynamic";

/* ── PATCH /api/mcp/[id] — включить/выключить, переименовать, конфиг ── */

const patchSchema = z.object({
  enabled: z.boolean().optional(),
  name: z.string().trim().min(1).max(60).optional(),
  description: z.string().trim().max(200).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  const { id } = await ctx.params;

  const row = await db.mcpServer.findFirst({
    where: { id, userId: session.sub },
  });
  if (!row) {
    return NextResponse.json({ error: "Сервер не найден" }, { status: 404 });
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректный запрос" },
      { status: 400 },
    );
  }
  const data = parsed.data;

  const update: Record<string, unknown> = {};
  if (typeof data.enabled === "boolean") update.enabled = data.enabled;
  if (data.name) update.name = data.name;
  if (typeof data.description === "string") update.description = data.description;

  if (data.config !== undefined) {
    const transport = row.transport as McpTransport;
    const validated = validateMcpConfig(transport, data.config);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }
    update.config = JSON.stringify(validated.config);
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Нечего обновлять" }, { status: 400 });
  }

  const updated = await db.mcpServer.update({
    where: { id: row.id },
    data: update,
  });
  return NextResponse.json({ server: mcpDto(updated) });
}

/* ── DELETE /api/mcp/[id] — убрать свой сервер из реестра ── */

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  const { id } = await ctx.params;

  const row = await db.mcpServer.findFirst({
    where: { id, userId: session.sub },
    select: { id: true, own: true },
  });
  if (!row) {
    return NextResponse.json({ error: "Сервер не найден" }, { status: 404 });
  }
  if (!row.own) {
    return NextResponse.json(
      { error: "Серверы каталога можно только отключить" },
      { status: 400 },
    );
  }

  await db.mcpServer.delete({ where: { id: row.id } });
  return NextResponse.json({ ok: true });
}
