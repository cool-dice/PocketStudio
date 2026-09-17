import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { noteWithCategory } from "@/lib/note-utils";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/notes/[id]/analyze — re-queue a note for the LLM analysis
 * pipeline (Stage 2). Resets status to "pending" and clears the previous
 * analysis; the agent-service analyzer worker picks the note up within
 * a few seconds. Re-analysis of a processed note is a legitimate
 * "переанализировать" action.
 */
export async function POST(req: Request, ctx: RouteContext) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const existing = await db.note.findFirst({
    where: { id, userId: session.sub },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Заметка не найдена" }, { status: 404 });
  }

  const note = await db.note.update({
    where: { id },
    data: {
      status: "pending",
      positiveBlock: null,
      negativeBlock: null,
      finalBlock: null,
      recommendations: null,
      analysisRaw: null,
      analyzedAt: null,
      errorMessage: null,
      updatedAt: new Date(),
    },
    include: { category: true },
  });

  return NextResponse.json({ note: noteWithCategory(note) });
}
