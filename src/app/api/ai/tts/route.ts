import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { aiTts, saveGeneratedFile, TTS_VOICES, type TtsVoice } from "@/lib/ai";
import { ensureWorkspace } from "@/lib/workspace-api";
import { artifactDto } from "@/lib/workspace-shapes";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/* ── POST /api/ai/tts — озвучка текста → аудио-артефакт ── */

const MAX_TTS_CHARS = 4_000;

const schema = z.object({
  projectId: z.string().trim().min(1),
  text: z.string().trim().min(3, "Введите текст для озвучки").max(MAX_TTS_CHARS),
  title: z.string().trim().max(160).optional(),
  voice: z.enum(TTS_VOICES).optional(),
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
    const buffer = await aiTts(text, (voice ?? "tongtong") as TtsVoice, speed ?? 1.0);
    const url = saveGeneratedFile(buffer, "wav");
    const artifact = await db.artifact.create({
      data: {
        projectId,
        type: "audio",
        title: title || `Озвучка: ${text.slice(0, 60)}${text.length > 60 ? "…" : ""}`,
        prompt: text.slice(0, 500),
        url,
        stage: "Озвучка",
        meta: JSON.stringify({ voice: voice ?? "tongtong", chars: text.length }),
      },
    });
    return NextResponse.json({ artifact: artifactDto(artifact) }, { status: 201 });
  } catch (err) {
    console.error("[ai/tts] failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "Не удалось озвучить текст — попробуйте ещё раз" },
      { status: 502 },
    );
  }
}
