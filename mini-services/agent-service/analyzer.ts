// PocketStudio analyzer — Stage 2 honest analysis pipeline.
//
// Every new note (from ⌘K capture after the user confirms a transcript, the
// chat agent's create_note tool, or a typed save) is created with status
// "pending". This worker polls Postgres
// every ANALYSIS_POLL_MS, picks the oldest pending notes (up to
// BATCH_PER_TICK, processed sequentially) and runs the 4-block LLM analysis:
//
//   positive (сильные стороны) / negative (риски) / final (синтез) /
//   recommendations (массив конкретных действий) + category suggestion
//   (assigned ONLY when the note has no category yet).
//
// Status flow: pending → processing → processed | error.
// WS events to room `user:${userId}`:
//   "note:analyzing" {noteId}                      — on start
//   "note:analyzed"  {note}                        — on finish (any status)
//
// Crash recovery: on boot every orphaned "processing" row is reset to
// "pending" (single worker process — processing rows at boot are orphans).

import type { Server } from "socket.io";
import { db } from "./db-client";
import { generateLLMResponse } from "./agent";
import { NOTES_ANALYSIS_SYSTEM } from "../../src/lib/ai/prompts";
import { scheduleIndexNote } from "../../src/lib/rag/hooks";
import { createNotification } from "./notifications";
import {
  ANALYSIS_UNREADABLE_MESSAGE,
  EMPTY_NOTE_ANALYSIS_MESSAGE,
  analysisErrorMessage,
  failedNoteAnalysisData,
  isUnconfiguredAnalysisError,
  isUsableNoteText,
  parseNoteAnalysis,
  processedNoteAnalysisData,
  type ParsedNoteAnalysis,
} from "../../src/lib/note-analysis";

const ANALYSIS_POLL_MS = 5000;
const BATCH_PER_TICK = 2;
const MAX_NOTE_TEXT_CHARS = 5000;
const LLM_ATTEMPTS = 2;

// ─────────────────────────── payload ───────────────────────────

interface NoteRowFull {
  id: string;
  userId: string;
  rawText: string | null;
  status: string;
  transcription: string | null;
  categoryId: string | null;
  favorite: boolean;
  positiveBlock: string | null;
  negativeBlock: string | null;
  finalBlock: string | null;
  recommendations: string | null;
  analysisRaw: string | null;
  analyzedAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Wire shape — mirrors src/lib/note-utils.ts noteWithCategory (ISO dates). */
function notePayload(note: NoteRowFull, category: { id: string; name: string; color: string; icon: string } | null) {
  let recommendations: string[] | null = null;
  if (note.recommendations) {
    try {
      const parsed = JSON.parse(note.recommendations);
      if (Array.isArray(parsed)) {
        const items = parsed.filter((r): r is string => typeof r === "string");
        recommendations = items.length > 0 ? items : null;
      }
    } catch {
      recommendations = null;
    }
  }

  return {
    id: note.id,
    rawText: note.rawText,
    status: note.status,
    favorite: note.favorite,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
    transcription: note.transcription,
    positive: note.positiveBlock,
    negative: note.negativeBlock,
    final: note.finalBlock,
    recommendations,
    analyzedAt: note.analyzedAt ? note.analyzedAt.toISOString() : null,
    errorMessage: note.errorMessage,
    category,
  };
}

// ─────────────────────────── helpers ───────────────────────────

/** Find the user's category by exact name, case-insensitive. */
async function findCategoryByName(userId: string, name: string) {
  const lower = name.toLowerCase();
  const categories = await db.category.findMany({ where: { userId } });
  return categories.find((c) => c.name.toLowerCase() === lower) ?? null;
}

// ─────────────────────────── worker ───────────────────────────

let io: Server | undefined;
let timer: ReturnType<typeof setInterval> | null = null;
let ticking = false;

async function emitNote(noteId: string): Promise<void> {
  if (!io) return;
  const note = await db.note.findUnique({
    where: { id: noteId },
    include: { category: { select: { id: true, name: true, color: true, icon: true } } },
  });
  if (!note) return;
  io.to(`user:${note.userId}`).emit(
    "note:analyzed",
    { note: notePayload(note as NoteRowFull, note.category) },
  );
}

async function notifyAnalysisFailed(
  userId: string,
  noteId: string,
  message: string,
): Promise<void> {
  if (!io) return;
  await createNotification(
    io,
    userId,
    "analysis_ready",
    "Анализ заметки не удался",
    message,
    noteId,
  );
}

type GenerateFn = typeof generateLLMResponse;

/** Analyze a single note: pending → processing → processed | error. */
export async function analyzeNote(
  noteId: string,
  generate: GenerateFn = generateLLMResponse,
): Promise<void> {
  const note = await db.note.findUnique({
    where: { id: noteId },
    include: { category: { select: { id: true, name: true } } },
  });
  if (!note || note.status !== "pending") return;

  const edited = (note.rawText ?? "").trim();
  const asr = (note.transcription ?? "").trim();
  const text = edited.slice(0, MAX_NOTE_TEXT_CHARS);
  if (!isUsableNoteText(text)) {
    await db.note.update({
      where: { id: noteId },
      data: failedNoteAnalysisData(EMPTY_NOTE_ANALYSIS_MESSAGE),
    });
    await notifyAnalysisFailed(note.userId, noteId, EMPTY_NOTE_ANALYSIS_MESSAGE);
    await emitNote(noteId);
    return;
  }

  // → processing
  console.log(`[analyzer] note ${noteId.slice(-6)} → processing`);
  await db.note.update({
    where: { id: noteId },
    data: { status: "processing", errorMessage: null, updatedAt: new Date() },
  });
  io?.to(`user:${note.userId}`).emit("note:analyzing", { noteId });

  // Build the user message: existing categories context (for reuse).
  const categories = await db.category.findMany({
    where: { userId: note.userId },
    select: { name: true },
    take: 50,
  });
  const categoryList = categories.map((c) => `«${c.name}»`).join(", ");
  const hasCategoryNote = note.category
    ? `Заметке уже назначена категория «${note.category.name}» — верни её же в category_name.`
    : `У заметки пока нет категории. Подбери подходящую из существующих (${categoryList || "пока никаких"}) или придумай новую (1–2 слова).`;
  const thoughtBlock =
    asr && asr !== edited
      ? `Отредактированный текст:\n"""\n${text}\n"""\n\nИсходная расшифровка:\n"""\n${asr.slice(0, MAX_NOTE_TEXT_CHARS)}\n"""`
      : `Мысль пользователя:\n"""\n${text}\n"""`;
  const userMessage = `${thoughtBlock}\n\n${hasCategoryNote}`;

  let analysis: ParsedNoteAnalysis | null = null;
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= LLM_ATTEMPTS && !analysis; attempt++) {
    try {
      const raw = await generate(NOTES_ANALYSIS_SYSTEM, [
        { role: "user", content: userMessage },
      ], { userId: note.userId, toolId: "notes", jsonMode: true });
      analysis = parseNoteAnalysis(raw);
      if (!analysis) lastError = new Error(ANALYSIS_UNREADABLE_MESSAGE);
    } catch (err) {
      lastError = err;
      if (isUnconfiguredAnalysisError(err)) break;
    }
  }

  if (!analysis) {
    const message = analysisErrorMessage(lastError);
    console.warn(`[analyzer] note ${noteId.slice(-6)} → error: ${message}`);
    await db.note.update({
      where: { id: noteId },
      data: failedNoteAnalysisData(message),
    });
    await notifyAnalysisFailed(note.userId, noteId, message);
    await emitNote(noteId);
    return;
  }

  // Category: only assign when the note has none.
  let categoryId = note.categoryId;
  if (!categoryId && analysis.categoryName) {
    const existing = await findCategoryByName(note.userId, analysis.categoryName);
    if (existing) {
      categoryId = existing.id;
    } else {
      try {
        const created = await db.category.create({
          data: {
            userId: note.userId,
            name: analysis.categoryName,
            color: analysis.categoryColor,
            icon: analysis.categoryIcon,
          },
        });
        categoryId = created.id;
      } catch {
        const raced = await findCategoryByName(note.userId, analysis.categoryName);
        if (raced) categoryId = raced.id;
      }
    }
  }

  await db.note.update({
    where: { id: noteId },
    data: {
      ...processedNoteAnalysisData(analysis),
      ...(categoryId ? { categoryId } : {}),
    },
  });
  scheduleIndexNote(db, noteId);
  console.log(`[analyzer] note ${noteId.slice(-6)} → processed (cat: ${categoryId ? analysis.categoryName : "kept"})`);
  if (io) {
    await createNotification(
      io,
      note.userId,
      "analysis_ready",
      "Анализ заметки готов",
      (note.rawText ?? "").trim() || undefined,
      noteId,
    );
  }
  await emitNote(noteId);
}

async function tick(): Promise<void> {
  if (ticking) return;
  ticking = true;
  try {
    const pending = await db.note.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "asc" },
      take: BATCH_PER_TICK,
      select: { id: true },
    });
    if (pending.length > 0) {
      console.log(`[analyzer] tick: ${pending.length} pending note(s)`);
    }
    for (const { id } of pending) {
      try {
        await analyzeNote(id);
      } catch (err) {
        console.error(`[analyzer] note ${id} failed:`, err instanceof Error ? err.message : String(err));
        try {
          await db.note.update({
            where: { id },
            data: failedNoteAnalysisData("Анализ не удался (внутренняя ошибка)"),
          });
          await emitNote(id);
        } catch {
          // best effort — the next boot recovery will requeue
        }
      }
    }
  } catch (err) {
    console.error("[analyzer] tick failed:", err instanceof Error ? err.message : String(err));
  } finally {
    ticking = false;
  }
}

/** Boot the worker (call once from server.ts main()). */
export async function startAnalyzer(server: Server): Promise<void> {
  io = server;

  // Crash recovery: orphaned "processing" rows → back to "pending".
  try {
    const revived = await db.note.updateMany({
      where: { status: "processing" },
      data: { status: "pending" },
    });
    if (revived.count > 0) {
      console.log(`[analyzer] requeued ${revived.count} orphaned note(s) after restart`);
    }
  } catch (err) {
    console.warn("[analyzer] recovery update failed:", err instanceof Error ? err.message : String(err));
  }

  // Kick one immediate tick then the interval.
  void tick();
  timer = setInterval(() => void tick(), ANALYSIS_POLL_MS);
  console.log(`[analyzer] worker started (poll ${ANALYSIS_POLL_MS}ms, batch ${BATCH_PER_TICK})`);
}

export function stopAnalyzer(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
