import { NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody } from "@/lib/json-body-limit";

import { db } from "@/lib/db";
import { aiAnalyzeDocument, aiErrorResponse } from "@/lib/ai";
import { scheduleIndexFinding } from "@/lib/rag/hooks";
import { ensureOwned } from "@/lib/workspace-api";
import { findingDto } from "@/lib/workspace-shapes";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

/* ── POST /api/ai/analyze — Аналитик: LLM-анализ документа → находки ──
 * Заменяет существующие открытые находки документа новыми. */

const schema = z.object({
  documentId: z.string().trim().min(1),
  scope: z.enum(["manuscript", "spec", "article"]).optional(),
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
  const { documentId, scope } = parsed.data;

  const documentRow = await db.document.findUnique({
    where: { id: documentId },
    include: { sections: { orderBy: { order: "asc" } } },
  });
  const check = await ensureOwned(req, documentRow);
  if (!check.ok) return check.response;
  const document = check.row;

  const filled = document.sections.filter((s) => s.content.trim().length > 0);
  if (filled.length === 0) {
    return NextResponse.json(
      { error: "Документ пуст — сначала напишите текст" },
      { status: 400 },
    );
  }

  try {
    const drafts = await aiAnalyzeDocument(
      check.userId,
      filled.map((s) => ({ title: s.title, content: s.content })),
    );

    // Открытые находки документа заменяются, статусы fixed/dismissed живут.
    await db.finding.deleteMany({
      where: { documentId, status: "open" },
    });

    const created = await Promise.all(
      drafts.map((draft) =>
        db.finding.create({
          data: {
            projectId: document.projectId,
            documentId,
            scope: scope ?? (document.kind === "spec" ? "spec" : "manuscript"),
            ...draft,
          },
        }),
      ),
    );
    for (const row of created) scheduleIndexFinding(db, row.id);

    return NextResponse.json(
      { findings: created.map(findingDto), replaced: drafts.length },
      { status: 201 },
    );
  } catch (err) {
    const mapped = aiErrorResponse(
      err,
      "Аналитик не справился — попробуйте ещё раз",
    );
    if (mapped.status >= 500) {
      console.error("[ai/analyze] failed:", err instanceof Error ? err.message : err);
    }
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
