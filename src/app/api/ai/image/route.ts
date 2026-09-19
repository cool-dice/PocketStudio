import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { aiErrorResponse, aiGenerateImage } from "@/lib/ai";
import { ensureWorkspace } from "@/lib/workspace-api";
import { artifactDto } from "@/lib/workspace-shapes";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/* ── POST /api/ai/image — генерация изображения → артефакт ── */

const schema = z.object({
  projectId: z.string().trim().min(1),
  prompt: z.string().trim().min(3, "Опишите изображение").max(4_000),
  title: z.string().trim().max(160).optional(),
  entityId: z.string().max(40).optional(),
  stage: z.string().max(40).optional(),
  size: z
    .enum(["1024x1024", "1152x864", "864x1152", "1440x720", "720x1440"])
    .optional(),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректный запрос" },
      { status: 400 },
    );
  }
  const { projectId, prompt, title, entityId, stage, size } = parsed.data;

  const check = await ensureWorkspace(req, projectId);
  if (!check.ok) return check.response;

  try {
    const { url } = await aiGenerateImage(check.userId, prompt, size ?? "1024x1024");
    const artifact = await db.artifact.create({
      data: {
        projectId,
        type: "image",
        title: title || prompt.slice(0, 80),
        prompt,
        entityId: entityId || null,
        stage: stage || null,
        url,
      },
    });
    return NextResponse.json({ artifact: artifactDto(artifact) }, { status: 201 });
  } catch (err) {
    const mapped = aiErrorResponse(
      err,
      "Не удалось сгенерировать изображение — попробуйте ещё раз",
    );
    if (mapped.status >= 500) {
      console.error("[ai/image] failed:", err instanceof Error ? err.message : err);
    }
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
