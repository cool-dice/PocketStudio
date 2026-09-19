import { NextResponse } from "next/server";
import { z } from "zod";

import {
  aiChatText,
  aiErrorResponse,
  isUnconfiguredToolError,
  resolveToolRoute,
  UNCONFIGURED_TOOL_MESSAGE,
} from "@/lib/ai";
import { DESCRIBE_SYSTEM } from "@/lib/ai/prompts";
import { db } from "@/lib/db";
import { scheduleIndexEntity } from "@/lib/rag";
import { ensureOwned } from "@/lib/workspace-api";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/* ── POST /api/ai/describe — сгенерировать описание сущности (LLM) ──
 * Unconfigured `describe` fails immediately with UNCONFIGURED_TOOL_MESSAGE
 * (400) — never a hang on the LLM and never a fake bio persist. Empty or
 * failed LLM leaves the previous card description untouched. */

const schema = z.object({
  entityId: z.string().trim().min(1),
});

const DESCRIBE_FAILED =
  "Не удалось сгенерировать описание — предыдущий текст на месте";
const DESCRIBE_EMPTY =
  "Модель вернула пустое описание — предыдущий текст на месте";

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
    await resolveToolRoute(db, check.userId, "describe");
  } catch (err) {
    if (isUnconfiguredToolError(err)) {
      return NextResponse.json(
        { error: UNCONFIGURED_TOOL_MESSAGE },
        { status: 400 },
      );
    }
    const mapped = aiErrorResponse(err, DESCRIBE_FAILED);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }

  try {
    const description = (
      await aiChatText(
        check.userId,
        "describe",
        DESCRIBE_SYSTEM,
        `Вид: ${entity.kind}\nНазвание: ${entity.name}\nПодпись: ${entity.short ?? "—"}\nТекущее описание: ${entity.description || "(пусто)"}`,
      )
    ).trim();
    if (!description) {
      return NextResponse.json({ error: DESCRIBE_EMPTY }, { status: 502 });
    }

    const updated = await db.entity.update({
      where: { id: entity.id },
      data: { description },
    });
    scheduleIndexEntity(db, updated.id);

    return NextResponse.json({ entityId: updated.id, description });
  } catch (err) {
    const mapped = aiErrorResponse(err, DESCRIBE_FAILED);
    if (mapped.status >= 500) {
      console.error("[ai/describe] failed:", err instanceof Error ? err.message : err);
    }
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
