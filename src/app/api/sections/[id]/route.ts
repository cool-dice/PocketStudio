import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { detachSectionMentions } from "@/lib/entity-mentions";
import { ensureOwned } from "@/lib/workspace-api";
import { snapshotSection } from "@/lib/section-revisions";
import { sectionDto } from "@/lib/workspace-shapes";
import { scheduleIndexEntity, scheduleIndexSection, scheduleRemove } from "@/lib/rag";
import { oversizedJsonResponse, readJsonBody } from "@/lib/json-body-limit";
import { sectionContentSchema } from "@/lib/section-content";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Секция + её документ (для проверки владельца и каскадного updatedAt). */
async function loadSection(id: string) {
  const section = await db.documentSection.findUnique({
    where: { id },
    include: { document: { select: { id: true, projectId: true } } },
  });
  return section;
}

/* ── PATCH /api/sections/[id] — автосохранение текста/статуса ── */

const patchSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  content: sectionContentSchema.optional(),
  status: z.enum(["draft", "done"]).optional(),
});

export async function PATCH(req: Request, { params }: Params) {
  const blocked = oversizedJsonResponse(req);
  if (blocked) return blocked;

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
  const parsed = patchSchema.safeParse(jsonRead.value);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректный запрос" },
      { status: 400 },
    );
  }

  // Снапшот старого текста перед перезаписью (PS-6: история версий).
  if (parsed.data.content !== undefined && parsed.data.content !== section.content) {
    try {
      await snapshotSection(id, section.content, "manual");
    } catch (err) {
      console.error("[sections/patch] snapshot failed:", err instanceof Error ? err.message : err);
    }
  }

  const [updated] = await db.$transaction([
    db.documentSection.update({ where: { id }, data: parsed.data }),
    db.document.update({
      where: { id: documentRow.id },
      data: { updatedAt: new Date() },
    }),
  ]);

  scheduleIndexSection(db, updated.id);

  return NextResponse.json({ section: sectionDto(updated) });
}

/* ── DELETE /api/sections/[id] ── */

export async function DELETE(req: Request, { params }: Params) {
  const { id } = await params;
  const section = await loadSection(id);
  const document = section?.document ?? null;
  const check = await ensureOwned(req, document);
  if (!check.ok) return check.response;
  const documentRow = check.row;

  await db.$transaction([
    db.documentSection.delete({ where: { id } }),
    db.document.update({
      where: { id: documentRow.id },
      data: { updatedAt: new Date() },
    }),
  ]);
  const detached = await detachSectionMentions(db, documentRow.projectId, [id]);
  for (const entityId of detached) scheduleIndexEntity(db, entityId);
  scheduleRemove(db, check.userId, "section", id);
  return NextResponse.json({ ok: true });
}
