import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { aiErrorResponse, aiGenerateImage } from "@/lib/ai";
import { ensureOwned } from "@/lib/workspace-api";
import { artifactDto, entityDto } from "@/lib/workspace-shapes";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Params = { params: Promise<{ id: string }> };

/** Формулировки промпта под вид сущности (narrative-домен). */
const KIND_PROMPT: Record<string, string> = {
  character:
    "Кинематографичный портрет персонажа по описанию: крупный план лица, выразительный взгляд, атмосфера характера, мягкий направленный свет, детализированный цифровой арт",
  location:
    "Атмосферная иллюстрация места по описанию: широкий план, глубина, природный или городской свет, кинематографичная композиция, детализированный цифровой арт",
  item: "Реквизит-иллюстрация предмета по описанию: крупный план, фактура материала, студийный свет, тёмный фон, концепт-арт",
  faction:
    "Символ-эмблема группы по описанию: геральдический знак, строгая композиция, контрастные цвета, цифровой арт",
  event:
    "Динамичная иллюстрация события по описанию: действие в разгаре, кинематографичный ракурс, свет и движение, цифровой арт",
  rule:
    "Концептуальная иллюстрация закона мира по описанию: символизм, минимализм, один центральный образ, цифровой арт",
};

const PRODUCT_PROMPT =
  "Концептуальная иллюстрация по описанию: чистая композиция, деловой стиль, современный цифровой арт";

/* ── POST /api/entities/[id]/portrait — сгенерировать портрет ── */

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const entityRow = await db.entity.findUnique({ where: { id } });
  const check = await ensureOwned(req, entityRow);
  if (!check.ok) return check.response;
  const entity = check.row;

  const bio = [entity.short, entity.description]
    .filter(Boolean)
    .join(" ")
    .slice(0, 600);
  const style = KIND_PROMPT[entity.kind] ?? PRODUCT_PROMPT;
  const prompt = `${style}. ${entity.name}: ${bio}`;

  try {
    const { url } = await aiGenerateImage(check.userId, prompt, "1024x1024");
    if (!url || url.startsWith("data:") || /placeholder/i.test(url)) {
      return NextResponse.json(
        { error: "Провайдер не вернул изображение" },
        { status: 502 },
      );
    }
    const [updated, artifact] = await db.$transaction([
      db.entity.update({
        where: { id },
        data: { image: url, imagePrompt: prompt.slice(0, 2000) },
      }),
      db.artifact.create({
        data: {
          projectId: entity.projectId,
          type: "portrait",
          title: `${entity.name} — портрет`,
          prompt: prompt.slice(0, 2000),
          entityId: entity.id,
          url,
        },
      }),
    ]);
    return NextResponse.json(
      { entity: entityDto(updated), artifact: artifactDto(artifact) },
      { status: 201 },
    );
  } catch (err) {
    const mapped = aiErrorResponse(
      err,
      "Не удалось нарисовать портрет — попробуйте ещё раз",
    );
    if (mapped.status >= 500) {
      console.error("[entity/portrait] failed:", err instanceof Error ? err.message : err);
    }
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

/* ── DELETE /api/entities/[id]/portrait — убрать картинку ── */

export async function DELETE(req: Request, { params }: Params) {
  const { id } = await params;
  const entityRow = await db.entity.findUnique({ where: { id } });
  const check = await ensureOwned(req, entityRow);
  if (!check.ok) return check.response;

  const updated = await db.entity.update({
    where: { id },
    data: { image: null, imagePrompt: null },
  });
  return NextResponse.json({ entity: entityDto(updated) });
}
