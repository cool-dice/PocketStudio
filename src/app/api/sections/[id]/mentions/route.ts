import { NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody } from "@/lib/json-body-limit";

import { db } from "@/lib/db";
import { parseEntityRefs, relatedFromLinks } from "@/lib/entity-meta";
import {
  addSectionMention,
  entitiesFoundInText,
  loadSectionHints,
} from "@/lib/entity-mentions";
import { scheduleIndexEntity } from "@/lib/rag";
import { ensureOwned } from "@/lib/workspace-api";
import { entityDto } from "@/lib/workspace-shapes";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const linkInclude = {
  linksFrom: { select: { toId: true } },
  linksTo: { select: { fromId: true } },
} as const;

async function loadOwnedSection(req: Request, id: string) {
  const section = await db.documentSection.findUnique({
    where: { id },
    include: { document: { select: { id: true, projectId: true } } },
  });
  if (!section) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Глава не найдена" }, { status: 404 }),
    };
  }
  const check = await ensureOwned(req, section.document);
  if (!check.ok) return check;
  return { ok: true as const, section, userId: check.userId };
}

function mentionCard(row: {
  id: string;
  name: string;
  kind: string;
}) {
  return { id: row.id, name: row.name, kind: row.kind };
}

/* ── GET /api/sections/[id]/mentions — привязано vs найдено в тексте ── */

export async function GET(req: Request, { params }: Params) {
  const { id } = await params;
  const owned = await loadOwnedSection(req, id);
  if (!owned.ok) return owned.response;

  const entities = await db.entity.findMany({
    where: { projectId: owned.section.document.projectId },
    select: { id: true, name: true, kind: true, refs: true },
    orderBy: { updatedAt: "desc" },
  });
  const linked = entities.filter((entity) =>
    parseEntityRefs(entity.refs).items.includes(id),
  );
  const foundInText = entitiesFoundInText(
    owned.section.content,
    entities,
    new Set(linked.map((entity) => entity.id)),
  );

  return NextResponse.json({
    linked: linked.map(mentionCard),
    foundInText: foundInText.map(mentionCard),
  });
}

/* ── POST /api/sections/[id]/mentions — привязать сущность к главе ── */

const postSchema = z.object({
  entityId: z.string().trim().min(1).max(64),
});

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const owned = await loadOwnedSection(req, id);
  if (!owned.ok) return owned.response;

  const jsonRead = await readJsonBody(req, { fallback: {} });
  if (!jsonRead.ok) return jsonRead.response;
  const parsed = postSchema.safeParse(jsonRead.value);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректный запрос" },
      { status: 400 },
    );
  }

  const entityRow = await db.entity.findUnique({
    where: { id: parsed.data.entityId },
    include: linkInclude,
  });
  if (!entityRow || entityRow.projectId !== owned.section.document.projectId) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }

  const refs = addSectionMention(entityRow.refs, entityRow.domain, id);
  const updated = await db.entity.update({
    where: { id: entityRow.id },
    data: { refs },
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
