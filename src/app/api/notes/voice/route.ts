import { NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";

import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { noteWithCategory } from "@/lib/note-utils";
import { MAX_NOTE_LENGTH } from "@/lib/types";

/**
 * POST /api/notes/voice — voice capture (Stage 2, worklog Task 2-ctr §5).
 * Body: {audioBase64, mime} → ASR (z-ai-web-dev-sdk, backend only) →
 * create note {rawText: transcription, transcription, status: "pending"} →
 * 201 {note}. The analyzer worker picks the note up automatically.
 */

export const dynamic = "force-dynamic";

/** ~12 MB decoded audio. 90 s of 16 kHz mono PCM16 WAV is only ~2.8 MB. */
const MAX_AUDIO_BYTES = 12 * 1024 * 1024;

/**
 * The ASR service hard-rejects audio longer than ~30 s (verified: 31 s ok,
 * ~33 s → 400 "duration limit 0–30 s"). The client auto-stops at 90 s, so
 * long PCM WAVs are split into ≤ ASR_MAX_SEGMENT_SECONDS segments, each
 * transcribed separately, and the texts are joined.
 */
const ASR_MAX_SEGMENT_SECONDS = 29;

/** Standard base64 alphabet (optionally padded). */
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

/** Minimal PCM WAV layout (found by walking the RIFF chunks). */
interface PcmWavInfo {
  audioFormat: number;
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
  blockAlign: number;
  dataStart: number;
  dataLength: number;
}

/** Parse a RIFF/WAVE header; returns null for non-PCM or malformed input. */
function parsePcmWav(buffer: Buffer): PcmWavInfo | null {
  if (buffer.length < 44) return null;
  if (buffer.toString("ascii", 0, 4) !== "RIFF") return null;
  if (buffer.toString("ascii", 8, 12) !== "WAVE") return null;

  let offset = 12;
  let fmt: { audioFormat: number; channels: number; sampleRate: number; bitsPerSample: number } | null = null;
  let dataStart = -1;
  let dataLength = 0;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    if (id === "fmt " && !fmt) {
      if (size < 16 || offset + 8 + 16 > buffer.length) return null;
      fmt = {
        audioFormat: buffer.readUInt16LE(offset + 8),
        channels: buffer.readUInt16LE(offset + 10),
        sampleRate: buffer.readUInt32LE(offset + 12),
        bitsPerSample: buffer.readUInt16LE(offset + 22),
      };
    } else if (id === "data") {
      dataStart = offset + 8;
      dataLength = Math.min(size, buffer.length - dataStart);
      break;
    }
    offset += 8 + size + (size % 2); // RIFF chunks are word-aligned
  }
  if (!fmt || dataStart < 0) return null;
  const blockAlign = (fmt.bitsPerSample / 8) * fmt.channels;
  if (fmt.audioFormat !== 1 || blockAlign <= 0 || fmt.sampleRate <= 0) {
    return null;
  }
  return { ...fmt, blockAlign, dataStart, dataLength };
}

/** Build a standalone WAV from a byte range of the PCM payload. */
function wavSegment(
  full: Buffer,
  info: PcmWavInfo,
  fromByte: number,
  toByte: number,
): Buffer {
  const data = full.subarray(info.dataStart + fromByte, info.dataStart + toByte);
  const out = Buffer.alloc(44 + data.length);
  out.write("RIFF", 0, "ascii");
  out.writeUInt32LE(36 + data.length, 4);
  out.write("WAVE", 8, "ascii");
  out.write("fmt ", 12, "ascii");
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(info.channels, 22);
  out.writeUInt32LE(info.sampleRate, 24);
  out.writeUInt32LE(info.sampleRate * info.blockAlign, 28);
  out.writeUInt16LE(info.blockAlign, 32);
  out.writeUInt16LE(info.bitsPerSample, 34);
  out.write("data", 36, "ascii");
  out.writeUInt32LE(data.length, 40);
  data.copy(out, 44);
  return out;
}

export async function POST(req: Request) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Некорректный JSON в запросе" },
      { status: 400 },
    );
  }

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

  // ASR via the backend-only SDK. Any failure → 502 (route never throws raw).
  // Long PCM WAVs (>30 s) are segmented — see ASR_MAX_SEGMENT_SECONDS.
  let text: string;
  try {
    const zai = await ZAI.create();
    const audioBuffer = Buffer.from(audioBase64, "base64");
    const pcm = parsePcmWav(audioBuffer);
    const durationSeconds = pcm
      ? pcm.dataLength / (pcm.sampleRate * pcm.blockAlign)
      : 0;

    if (pcm && durationSeconds > ASR_MAX_SEGMENT_SECONDS) {
      const segmentBytes =
        Math.floor(ASR_MAX_SEGMENT_SECONDS * pcm.sampleRate) * pcm.blockAlign;
      const parts: string[] = [];
      for (let start = 0; start < pcm.dataLength; start += segmentBytes) {
        const end = Math.min(start + segmentBytes, pcm.dataLength);
        const segment = wavSegment(audioBuffer, pcm, start, end);
        const res = await zai.audio.asr.create({
          file_base64: segment.toString("base64"),
        });
        const part = (res?.text ?? "").trim();
        if (part) parts.push(part);
      }
      text = parts.join(" ").trim();
    } else {
      const res = await zai.audio.asr.create({ file_base64: audioBase64 });
      text = (res?.text ?? "").trim();
    }
  } catch (err) {
    console.error("[voice] ASR failed:", err);
    return NextResponse.json(
      { error: "Сервис распознавания недоступен, попробуйте позже" },
      { status: 502 },
    );
  }

  if (!text) {
    return NextResponse.json(
      { error: "Не удалось распознать речь — попробуйте записать ещё раз" },
      { status: 422 },
    );
  }

  if (text.length > MAX_NOTE_LENGTH) {
    text = text.slice(0, MAX_NOTE_LENGTH);
  }

  try {
    const note = await db.note.create({
      data: {
        userId: session.sub,
        rawText: text,
        transcription: text,
        status: "pending",
      },
      include: { category: true },
    });

    return NextResponse.json({ note: noteWithCategory(note) }, { status: 201 });
  } catch (err) {
    console.error("[voice] note create failed:", err);
    return NextResponse.json(
      { error: "Не удалось сохранить голосовую заметку" },
      { status: 500 },
    );
  }
}
