import { NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody } from "@/lib/json-body-limit";

import { db } from "@/lib/db";
import { aiErrorResponse, aiGenerateImage } from "@/lib/ai";
import { unlinkGeneratedFile } from "@/lib/gen-files";
import { IMAGE_EMPTY_FILE, isHonestImageUrl } from "@/lib/image-copy";
import { ensureWorkspace } from "@/lib/workspace-api";
import { liveArtifactDto } from "@/lib/workspace-shapes";
import { scheduleIndexArtifact } from "@/lib/rag";

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
  albumKind: z.enum(["portrait", "illustration", "concept"]).optional(),
});

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
  const { projectId, prompt, title, entityId, stage, size, albumKind } = parsed.data;

  const check = await ensureWorkspace(req, projectId);
  if (!check.ok) return check.response;

  let savedUrl: string | null = null;
  try {
    const { url } = await aiGenerateImage(check.userId, prompt, size ?? "1024x1024");
    if (!isHonestImageUrl(url)) {
      unlinkGeneratedFile(url);
      return NextResponse.json(
        { error: "Провайдер не вернул изображение" },
        { status: 502 },
      );
    }
    savedUrl = url;
    const artifact = await db.artifact.create({
      data: {
        projectId,
        type: albumKind === "portrait" ? "portrait" : "image",
        title: title || prompt.slice(0, 80),
        prompt,
        entityId: entityId || null,
        stage: stage || null,
        url,
        meta: albumKind ? JSON.stringify({ albumKind }) : null,
      },
    });
    savedUrl = null;
    scheduleIndexArtifact(db, artifact.id);
    const dto = liveArtifactDto(artifact);
    if (dto.fileMissing || !isHonestImageUrl(dto.url)) {
      unlinkGeneratedFile(url);
      await db.artifact.delete({ where: { id: artifact.id } }).catch(() => {});
      return NextResponse.json({ error: IMAGE_EMPTY_FILE }, { status: 502 });
    }
    return NextResponse.json({ artifact: dto }, { status: 201 });
  } catch (err) {
    if (savedUrl) unlinkGeneratedFile(savedUrl);
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
