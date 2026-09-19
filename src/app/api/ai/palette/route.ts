import { NextResponse } from "next/server";
import { z } from "zod";

import { aiChatJson, aiErrorResponse } from "@/lib/ai";
import { PALETTE_SYSTEM } from "@/lib/ai/prompts";
import { db } from "@/lib/db";
import {
  normalizeStylePalette,
  type PaletteMeta,
  type StylePalette,
} from "@/lib/palette";
import { artifactDto } from "@/lib/workspace-shapes";
import { ensureWorkspace } from "@/lib/workspace-api";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/* ── POST /api/ai/palette — собрать палитру стиля проекта (LLM) ── */

const schema = z.object({
  projectId: z.string().trim().min(1),
  brief: z.string().trim().max(2_000).optional(),
});

const TYPE_LABELS: Record<string, string> = {
  film: "фильм / видеопродакшн",
  book: "книга",
  music: "музыкальный проект",
  app: "приложение",
  universal: "универсальный проект",
};

/** LLM → нормализованная палитра; бросает ошибку, если ответ нечитаем. */
async function requestPalette(
  userId: string,
  briefText: string,
): Promise<StylePalette> {
  const raw = await aiChatJson<unknown>(userId, "palette", PALETTE_SYSTEM, briefText);
  const palette =
    normalizeStylePalette(raw) ??
    (typeof raw === "string"
      ? normalizeStylePalette(rawFallback(raw))
      : null);
  if (!palette) throw new Error("модель вернула слишком мало цветов");
  return palette;
}

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректный запрос" },
      { status: 400 },
    );
  }
  const { projectId, brief } = parsed.data;

  const check = await ensureWorkspace(req, projectId);
  if (!check.ok) return check.response;

  /* Бриф: данные воркспейса + пожелания пользователя. */
  const workspace = await db.project.findFirst({
    where: { id: projectId, userId: check.userId },
    select: { name: true, type: true, description: true },
  });
  if (!workspace) {
    return NextResponse.json({ error: "Воркспейс не найден" }, { status: 404 });
  }

  const briefText = [
    `Проект: ${workspace.name}`,
    `Тип: ${TYPE_LABELS[workspace.type] ?? workspace.type}`,
    workspace.description
      ? `Описание: ${workspace.description.slice(0, 800)}`
      : null,
    brief ? `Пожелания к стилю: ${brief}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  /* LLM → строгий JSON с фолбэком и понятной 502 при провале. */
  let palette: StylePalette;
  try {
    palette = await requestPalette(check.userId, briefText);
  } catch (err) {
    const mapped = aiErrorResponse(
      err,
      "Модель вернула нечитаемую палитру — попробуйте ещё раз или уточните бриф",
    );
    if (mapped.status >= 500) {
      console.error(
        "[ai/palette] failed:",
        err instanceof Error ? err.message : err,
      );
    }
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }

  /* Сохраняем как артефакт воркспейса (type file, stage style). */
  const meta: PaletteMeta = { kind: "palette", ...palette, brief: briefText };
  const artifact = await db.artifact.create({
    data: {
      projectId,
      type: "file",
      title: "Палитра стиля",
      stage: "style",
      prompt: briefText,
      meta: JSON.stringify(meta),
    },
  });

  return NextResponse.json(
    { artifact: artifactDto(artifact), palette },
    { status: 201 },
  );
}

/** Фолбэк-парсер: {...} регуляркой из произвольного текста модели. */
function rawFallback(raw: string): Record<string, unknown> {
  const m = /\{[\s\S]*\}/.exec(raw.replace(/```json/gi, "").replace(/```/g, ""));
  if (!m) return {};
  try {
    const parsed = JSON.parse(m[0]) as unknown;
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
