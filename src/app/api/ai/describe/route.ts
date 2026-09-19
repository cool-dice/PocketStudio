import { NextResponse } from "next/server";
import { z } from "zod";

import { aiChatText, aiErrorResponse } from "@/lib/ai";
import { ensureOwned } from "@/lib/workspace-api";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/* ── POST /api/ai/describe — сгенерировать описание сущности (LLM) ── */

const schema = z.object({
  entityId: z.string().trim().min(1),
});

const DESCRIBE_SYSTEM = `Ты — сценарист и технический писатель студии. Тебе дают карточку сущности (вид, название, краткая подпись, текущее описание).
Напиши живое, конкретное описание на русском языке: 2–3 абзаца, без списков и без повторения входных данных слово в слово.
Для персонажей — характер и голос; для лора (локации/предметы/события/фракции/правила) — атмосферу и роль в истории; для продуктовых сущностей (пользователи/роли/требования/модули/интеграции) — практическую ценность и границы ответственности.
Отвечай только текстом описания.`;

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
