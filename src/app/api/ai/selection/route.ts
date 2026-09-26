import { NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody } from "@/lib/json-body-limit";

import {
  aiChatText,
  aiErrorResponse,
  isUnconfiguredToolError,
  resolveToolRoute,
  UNCONFIGURED_TOOL_MESSAGE,
} from "@/lib/ai";
import {
  SECTION_SELECTION_SYSTEM,
  selectionRewriteUserPrompt,
} from "@/lib/ai/prompts";
import { db } from "@/lib/db";
import { selectionReplacementFromModel } from "@/lib/selection-rewrite";
import { ensureOwned } from "@/lib/workspace-api";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/* ── POST /api/ai/selection — rewrite the highlighted fragment only ──
 * Same tool id as chapter rewrite (`rewrite_section`). Unconfigured model
 * fails immediately with UNCONFIGURED_TOOL_MESSAGE (400). The route returns
 * replacement text and does not write the chapter — the editor splices the
 * span so the rest of the document and native undo stay intact. */

const schema = z.object({
  sectionId: z.string().trim().min(1, "Укажите главу"),
  selection: z
    .string()
    .min(1, "Выделите фрагмент текста")
    .max(20_000, "Фрагмент слишком длинный"),
  instruction: z
    .string()
    .trim()
    .min(1, "Напишите, как изменить фрагмент")
    .max(2_000, "Инструкция слишком длинная"),
});

const SELECTION_FAILED = "Не удалось изменить фрагмент — попробуйте ещё раз";
const SELECTION_EMPTY = "Модель вернула пустой фрагмент — выделение на месте";

export async function POST(req: Request) {
  const jsonRead = await readJsonBody(req, { fallback: {} });
  if (!jsonRead.ok) return jsonRead.response;
  const parsed = schema.safeParse(jsonRead.value);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректный запрос" },
      { status: 400 },
    );
  }

  const { sectionId, selection, instruction } = parsed.data;
  const section = await db.documentSection.findUnique({
    where: { id: sectionId },
    include: { document: { select: { id: true, projectId: true } } },
  });
  if (!section) {
    return NextResponse.json({ error: "Глава не найдена" }, { status: 404 });
  }
  const check = await ensureOwned(req, section.document);
  if (!check.ok) return check.response;

  try {
    await resolveToolRoute(db, check.userId, "rewrite_section");
  } catch (err) {
    if (isUnconfiguredToolError(err)) {
      return NextResponse.json(
        { error: UNCONFIGURED_TOOL_MESSAGE },
        { status: 400 },
      );
    }
    const mapped = aiErrorResponse(err, SELECTION_FAILED);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }

  try {
    const generated = await aiChatText(
      check.userId,
      "rewrite_section",
      SECTION_SELECTION_SYSTEM,
      selectionRewriteUserPrompt(selection, instruction),
    );
    const text = selectionReplacementFromModel(generated);
    if (!text) {
      return NextResponse.json({ error: SELECTION_EMPTY }, { status: 502 });
    }
    return NextResponse.json({ text });
  } catch (err) {
    const mapped = aiErrorResponse(err, SELECTION_FAILED);
    if (mapped.status >= 500) {
      console.error("[ai/selection] failed:", err instanceof Error ? err.message : err);
    }
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
