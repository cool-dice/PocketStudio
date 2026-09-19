import { NextResponse } from "next/server";
import { z } from "zod";

import { aiChatText, aiErrorResponse } from "@/lib/ai";
import { DESCRIBE_SYSTEM } from "@/lib/ai/prompts";
import { ensureOwned } from "@/lib/workspace-api";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/* ── POST /api/ai/describe — сгенерировать описание сущности (LLM) ── */

const schema = z.object({
  entityId: z.string().trim().min(1),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректный запрос" },
      { status: 400 },
    );
  }

  const entityRow = await db.entity.findUnique({
    where: { id: parsed.data.entityId },
  });
  const check = await ensureOwned(req, entityRow);
  if (!check.ok) return check.response;
  const entity = check.row;

  try {
    const description = await aiChatText(
      check.userId,
      "describe",
      DESCRIBE_SYSTEM,
      `Вид: ${entity.kind}\nНазвание: ${entity.name}\nПодпись: ${entity.short ?? "—"}\nТекущее описание: ${entity.description || "(пусто)"}`,
    );

    const updated = await db.entity.update({
      where: { id: entity.id },
      data: { description },
    });

    return NextResponse.json({ entityId: updated.id, description });
  } catch (err) {
    const mapped = aiErrorResponse(
      err,
      "Не удалось сгенерировать описание — попробуйте ещё раз",
    );
    if (mapped.status >= 500) {
      console.error("[ai/describe] failed:", err instanceof Error ? err.message : err);
    }
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
