import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { AI_TOOLS } from "@/lib/ai/tools";
import { isGatewayError } from "@/lib/ai/errors";
import { requireToolId, toolDefaultSchema } from "@/lib/ai/provider-input";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  try {
    const rows = await db.toolModelDefault.findMany({
      include: {
        model: {
          include: { provider: { select: { id: true, name: true, userId: true } } },
        },
      },
    });
    const byTool = new Map(rows.map((r) => [r.toolId, r]));

    const defaults = AI_TOOLS.map((tool) => {
      const row = byTool.get(tool.id);
      return {
        toolId: tool.id,
        label: tool.label,
        description: tool.description,
        capability: tool.capability,
        modelId: row?.modelId ?? null,
        model: row
          ? {
              id: row.model.id,
              modelId: row.model.modelId,
              displayName: row.model.displayName,
              providerId: row.model.provider.id,
              providerName: row.model.provider.name,
            }
          : null,
      };
    });

    return NextResponse.json({ defaults });
  } catch {
    console.error("[admin/ai/defaults] list failed");
    return NextResponse.json(
      { error: "Не удалось загрузить назначения моделей" },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  const parsed = toolDefaultSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректный запрос" },
      { status: 400 },
    );
  }

  try {
    const toolId = requireToolId(parsed.data.toolId);
    const model = await db.aiModel.findFirst({
      where: { id: parsed.data.modelId, provider: { userId: null }, enabled: true },
      include: { provider: true },
    });
    if (!model || !model.provider.enabled) {
      return NextResponse.json(
        { error: "Модель не найдена или отключена" },
        { status: 404 },
      );
    }

    await db.toolModelDefault.upsert({
      where: { toolId },
      create: { toolId, modelId: model.id },
      update: { modelId: model.id },
    });

    return NextResponse.json({ ok: true, toolId, modelId: model.id });
  } catch (err) {
    if (isGatewayError(err)) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Не удалось сохранить назначение" }, { status: 500 });
  }
}
