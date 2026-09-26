import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { GatewayError } from "@/lib/ai/errors";
import { resolveToolRoute } from "@/lib/ai/resolve";
import { UNCONFIGURED_TOOL_MESSAGE } from "@/lib/ai/tools";
import {
  EMPTY_NOTE_ANALYSIS_MESSAGE,
  failedNoteAnalysisData,
  isUsableNoteText,
  noteAnalysisFieldsForQueue,
} from "@/lib/note-analysis";
import { noteWithCategory } from "@/lib/note-utils";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/notes/[id]/analyze — re-queue a note for the LLM analysis
 * pipeline (tool id `notes`). Unconfigured models fail immediately with
 * UNCONFIGURED_TOOL_MESSAGE and status=error — never a fake 4-block JSON
 * and never a ~5s pending wait for the analyzer worker. Otherwise resets
 * status to "pending"; the worker picks the note up. Re-analysis of a
 * processed note is a legitimate "переанализировать" action.
 */
export async function POST(req: Request, ctx: RouteContext) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const existing = await db.note.findFirst({
    where: { id, userId: session.sub },
    select: { id: true, rawText: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Заметка не найдена" }, { status: 404 });
  }
  if (!isUsableNoteText(existing.rawText)) {
    return NextResponse.json(
      { error: EMPTY_NOTE_ANALYSIS_MESSAGE },
      { status: 422 },
    );
  }

  try {
    await resolveToolRoute(db, session.sub, "notes");
  } catch (err) {
    const unconfigured =
      err instanceof GatewayError && err.message === UNCONFIGURED_TOOL_MESSAGE;
    if (unconfigured) {
      const failed = await db.note.update({
        where: { id },
        data: failedNoteAnalysisData(UNCONFIGURED_TOOL_MESSAGE),
        include: { category: true },
      });
      return NextResponse.json(
        { error: UNCONFIGURED_TOOL_MESSAGE, note: noteWithCategory(failed) },
        { status: 400 },
      );
    }
    throw err;
  }

  const note = await db.note.update({
    where: { id },
    data: noteAnalysisFieldsForQueue(false),
    include: { category: true },
  });

  return NextResponse.json({ note: noteWithCategory(note) });
}
