import { NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth";
import {
  aiErrorResponse,
  aiTranscribe,
  isUnconfiguredToolError,
  resolveToolRoute,
  UNCONFIGURED_TOOL_MESSAGE,
} from "@/lib/ai";
import { db } from "@/lib/db";
import { MAX_NOTE_LENGTH } from "@/lib/types";
import { ASR_EMPTY, ASR_UNAVAILABLE, isUsableTranscript } from "@/lib/voice-copy";
import { oversizedJsonResponse, readJsonBody } from "@/lib/json-body-limit";

/**
 * POST /api/notes/voice — transcribe only.
 * Body: {audioBase64, mime} → ASR (OpenAI-compatible /v1/audio/transcriptions)
 * → 200 { text }. Does not create a Note, NoteLink, or RAG chunk — the client
 * puts the text in the composer and POSTs /api/notes once on save.
 *
 * Unconfigured `asr` fails immediately (400 UNCONFIGURED_TOOL_MESSAGE) after
 * auth — before reading the audio body and before calling the provider.
 */

export const dynamic = "force-dynamic";

/** ~12 MB decoded audio. */
const MAX_AUDIO_BYTES = 12 * 1024 * 1024;

/** Standard base64 alphabet (optionally padded). */
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

export async function POST(req: Request) {
  const blocked = oversizedJsonResponse(req);
  if (blocked) return blocked;

  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  try {
    await resolveToolRoute(db, session.sub, "asr");
  } catch (err) {
    if (isUnconfiguredToolError(err)) {
      return NextResponse.json(
        { error: UNCONFIGURED_TOOL_MESSAGE },
        { status: 400 },
      );
    }
    const mapped = aiErrorResponse(err, ASR_UNAVAILABLE);
    if (mapped.status >= 500) {
      console.error(
        "[voice] ASR resolve failed:",
        err instanceof Error ? err.message : err,
      );
    }
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }

  const jsonRead = await readJsonBody(req);
  if (!jsonRead.ok) return jsonRead.response;
  const body = jsonRead.value;

  const { audioBase64, mime } = (body ?? {}) as {
    audioBase64?: unknown;
    mime?: unknown;
  };

  if (typeof audioBase64 !== "string" || audioBase64.length === 0) {
    return NextResponse.json({ error: "Аудио отсутствует" }, { status: 400 });
  }
  if (typeof mime !== "string" || !mime.startsWith("audio/")) {
    return NextResponse.json(
      { error: "Неподдерживаемый формат аудио" },
      { status: 400 },
    );
  }
  if (!BASE64_RE.test(audioBase64)) {
    return NextResponse.json(
      { error: "Некорректные аудио-данные" },
      { status: 400 },
    );
  }

  const decodedBytes = Math.floor((audioBase64.length * 3) / 4);
  if (decodedBytes > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { error: "Аудио слишком длинное — максимум 12 МБ" },
      { status: 413 },
    );
  }

  let text: string;
  try {
    const audioBuffer = Buffer.from(audioBase64, "base64");
    text = (await aiTranscribe(session.sub, audioBuffer, mime)).trim();
  } catch (err) {
    const mapped = aiErrorResponse(err, ASR_UNAVAILABLE);
    if (mapped.status >= 500) {
      console.error("[voice] ASR failed:", err instanceof Error ? err.message : err);
    }
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }

  if (!isUsableTranscript(text)) {
    return NextResponse.json({ error: ASR_EMPTY }, { status: 422 });
  }

  if (text.length > MAX_NOTE_LENGTH) {
    text = text.slice(0, MAX_NOTE_LENGTH);
  }

  return NextResponse.json({ text }, { status: 200 });
}
