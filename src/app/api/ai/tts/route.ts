import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { aiErrorResponse, aiTts, mapTtsVoice, saveGeneratedFile } from "@/lib/ai";
import { ensureWorkspace } from "@/lib/workspace-api";
import { liveArtifactDto } from "@/lib/workspace-shapes";
import { scheduleIndexArtifact } from "@/lib/rag";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/* ── POST /api/ai/tts — озвучка текста → аудио-артефакт ── */

const MAX_TTS_CHARS = 4_000;

const schema = z.object({
  projectId: z.string().trim().min(1),
  text: z.string().trim().min(3, "Введите текст для озвучки").max(MAX_TTS_CHARS),
  title: z.string().trim().max(160).optional(),
  voice: z.string().trim().max(32).optional(),
  speed: z.number().min(0.5).max(2).optional(),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректный запрос" },
      { status: 400 },
    );
  }
  const { projectId, text, title, voice, speed } = parsed.data;

  const check = await ensureWorkspace(req, projectId);
  if (!check.ok) return check.response;

  try {
    const mappedVoice = mapTtsVoice(voice);
    const buffer = await aiTts(check.userId, text, mappedVoice, speed ?? 1.0);
    if (buffer.length === 0) {
      return NextResponse.json(
        { error: "Озвучка вернула пустой файл — попробуйте ещё раз" },
        { status: 502 },
      );
    }
    const url = saveGeneratedFile(buffer, "wav");
    const artifact = await db.artifact.create({
      data: {
        projectId,
        type: "audio",
        title: title || `Озвучка: ${text.slice(0, 60)}${text.length > 60 ? "…" : ""}`,
        prompt: text.slice(0, 500),
        url,
        stage: "Озвучка",
        meta: JSON.stringify({ voice: mappedVoice, chars: text.length }),
      },
    });
    scheduleIndexArtifact(db, artifact.id);
    return NextResponse.json({ artifact: liveArtifactDto(artifact) }, { status: 201 });
  } catch (err) {
    const mapped = aiErrorResponse(
      err,
      "Не удалось озвучить текст — попробуйте ещё раз",
    );
    if (mapped.status >= 500) {
      console.error("[ai/tts] failed:", err instanceof Error ? err.message : err);
    }
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
