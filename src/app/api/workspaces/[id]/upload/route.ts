import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { saveGeneratedFile } from "@/lib/ai";
import { ensureWorkspace } from "@/lib/workspace-api";
import { artifactDto } from "@/lib/workspace-shapes";
import { oversizedJsonResponse, readJsonBody } from "@/lib/json-body-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

/* ── POST /api/workspaces/[id]/upload — бинарник → файл → артефакт ──
 * Загрузка пользовательских файлов: сэмплы в DAW, готовые миксы,
 * собранные фильмы. Тело: base64 + mime (проверяемый allowlist). */

/** ~25 МБ бинарника → ~34 МБ base64. */
const MAX_BASE64 = 34_000_000;

const MIME_EXT: Record<string, "wav" | "mp3" | "webm" | "mp4" | "png"> = {
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/ogg": "mp3",
  "audio/webm": "webm",
  "video/webm": "webm",
  "video/mp4": "mp4",
  "image/png": "png",
  "image/jpeg": "png",
};

const schema = z.object({
  dataBase64: z.string().min(8).max(MAX_BASE64),
  mime: z.string().trim().min(3).max(40),
  type: z.enum(["audio", "video", "image", "file"]),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(500).optional(),
  stage: z.string().trim().max(40).optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: Request, { params }: Params) {
  const blocked = oversizedJsonResponse(req);
  if (blocked) return blocked;

  const { id } = await params;
  const check = await ensureWorkspace(req, id);
  if (!check.ok) return check.response;

  const jsonRead = await readJsonBody(req, { fallback: {} });
  if (!jsonRead.ok) return jsonRead.response;
  const parsed = schema.safeParse(jsonRead.value);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректный запрос" },
      { status: 400 },
    );
  }
  const { dataBase64, mime, type, title, description, stage, meta } = parsed.data;

  /* MediaRecorder даёт mime с параметрами кодеков («video/webm;codecs=vp9,opus»)
   * — сверяемся по базовому типу без параметров. */
  const baseMime = mime.split(";")[0]?.trim().toLowerCase() ?? "";
  const ext = MIME_EXT[baseMime];
  if (!ext) {
    return NextResponse.json(
      { error: `Формат ${mime} не поддерживается — WAV, MP3, WebM, MP4 или PNG` },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(dataBase64, "base64");
  if (buffer.length < 256) {
    return NextResponse.json({ error: "Файл пуст или повреждён" }, { status: 400 });
  }
  if (buffer.length > 26_000_000) {
    return NextResponse.json({ error: "Файл больше 25 МБ" }, { status: 413 });
  }

  const url = saveGeneratedFile(buffer, ext);
  const artifact = await db.artifact.create({
    data: {
      projectId: id,
      type,
      title,
      description: description ?? null,
      url,
      stage: stage ?? null,
      meta: meta ? JSON.stringify(meta) : null,
    },
  });
  return NextResponse.json({ artifact: artifactDto(artifact) }, { status: 201 });
}
