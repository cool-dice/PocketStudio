import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { relatedFromLinks } from "@/lib/entity-meta";
import { loadSectionHints, removeSectionMention } from "@/lib/entity-mentions";
import { scheduleIndexEntity } from "@/lib/rag";
import { ensureOwned } from "@/lib/workspace-api";
import { entityDto } from "@/lib/workspace-shapes";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; entityId: string }> };

const linkInclude = {
  linksFrom: { select: { toId: true } },
  linksTo: { select: { fromId: true } },
} as const;

/* ── DELETE /api/sections/[id]/mentions/[entityId] ── */

export async function DELETE(req: Request, { params }: Params) {
  const { id, entityId } = await params;
  const section = await db.documentSection.findUnique({
    where: { id },
    include: { document: { select: { id: true, projectId: true } } },
  });
  if (!section) {
    return NextResponse.json({ error: "Глава не найдена" }, { status: 404 });
  }
  const check = await ensureOwned(req, section.document);
  if (!check.ok) return check.response;

  const entityRow = await db.entity.findUnique({
    where: { id: entityId },
    include: linkInclude,
  });
  if (!entityRow || entityRow.projectId !== section.document.projectId) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }

  const updated = await db.entity.update({
    where: { id: entityRow.id },
    data: { refs: removeSectionMention(entityRow.refs, id) },
    include: linkInclude,
  });
  scheduleIndexEntity(db, updated.id);

  const hints = await loadSectionHints(db, updated.projectId);
  return NextResponse.json({
    entity: entityDto(
      updated,
      relatedFromLinks(updated.linksFrom, updated.linksTo),
      hints,
    ),
  });
}
