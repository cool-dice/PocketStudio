import { NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody } from "@/lib/json-body-limit";

import { db } from "@/lib/db";
import { ensureOwned } from "@/lib/workspace-api";
import { sectionDto } from "@/lib/workspace-shapes";
import { indexSectionById } from "@/lib/rag";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Сколько последних версий показывать. */
const LIST_LIMIT = 20;

/** Секция + её документ (для проверки владельца). */
async function loadSection(id: string) {
  return db.documentSection.findUnique({
    where: { id },
    include: { document: { select: { id: true, projectId: true } } },
  });
}

/* ── GET /api/sections/[id]/revisions — история версий главы ── */

export async function GET(req: Request, { params }: Params) {
  const { id } = await params;
  const section = await loadSection(id);
  const check = await ensureOwned(req, section?.document ?? null);
  if (!check.ok) return check.response;

  const revisions = await db.documentSectionRevision.findMany({
    where: { sectionId: id },
    orderBy: { createdAt: "desc" },
    take: LIST_LIMIT,
    select: {
      id: true,
      source: true,
      size: true,
      createdAt: true,
      content: true,
    },
  });

  return NextResponse.json({
    revisions: revisions.map((revision) => ({
      id: revision.id,
      source: revision.source === "ai" ? "ai" : revision.source === "restore" ? "restore" : "manual",
      size: revision.size,
      createdAt: revision.createdAt.toISOString(),
      preview:
        revision.content
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 160) || "_(пустая версия)_",
    })),
  });
}

/* ── POST /api/sections/[id]/revisions — восстановить версию ── */

const restoreSchema = z.object({ revisionId: z.string().min(1) });

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const section = await loadSection(id);
  if (!section) {
    return NextResponse.json({ error: "Глава не найдена" }, { status: 404 });
  }
  const check = await ensureOwned(req, section.document);
  if (!check.ok) return check.response;
  const documentRow = check.row;

  const jsonRead = await readJsonBody(req, { fallback: {} });
  if (!jsonRead.ok) return jsonRead.response;
  const parsed = restoreSchema.safeParse(jsonRead.value);
  if (!parsed.success) {
    return NextResponse.json({ error: "Не указана версия для восстановления" }, { status: 400 });
  }

  const revision = await db.documentSectionRevision.findFirst({
    where: { id: parsed.data.revisionId, sectionId: id },
  });
  if (!revision) {
    return NextResponse.json({ error: "Версия не найдена" }, { status: 404 });
  }

  // Снапшот текущего текста перед откатом (source: restore) + откат.
  await db.documentSectionRevision.create({
    data: {
      sectionId: id,
      content: section.content,
      source: "restore",
      size: section.content.length,
    },
  });
  const [updated] = await db.$transaction([
    db.documentSection.update({
      where: { id },
      data: { content: revision.content, updatedAt: new Date() },
    }),
    db.document.update({
      where: { id: documentRow.id },
      data: { updatedAt: new Date() },
    }),
  ]);

  try {
    await indexSectionById(db, updated.id);
  } catch (err) {
    console.error(
      "[sections/restore] reindex failed:",
      err instanceof Error ? err.message : err,
    );
  }

  return NextResponse.json({ section: sectionDto(updated) });
}

/* ── PUT /api/sections/[id]/revisions — создать снапшот вручную ── */

export async function PUT(req: Request, { params }: Params) {
  const { id } = await params;
  const section = await loadSection(id);
  if (!section) {
    return NextResponse.json({ error: "Глава не найдена" }, { status: 404 });
  }
  const check = await ensureOwned(req, section.document);
  if (!check.ok) return check.response;

  await db.documentSectionRevision.create({
    data: {
      sectionId: id,
      content: section.content,
      source: "manual",
      size: section.content.length,
    },
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}
