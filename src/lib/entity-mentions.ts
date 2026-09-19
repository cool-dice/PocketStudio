/**
 * Entity ↔ section mentions: Entity.refs JSON, resolved against live
 * DocumentSection rows. No graph DB — captions that are not section ids
 * stay labels («подпись»), not fake live links.
 */

import type { PrismaClient } from "@prisma/client";

import {
  parseEntityRefs,
  refsKindOfDomain,
  serializeEntityRefs,
  withRefItem,
  withoutRefItem,
} from "@/lib/entity-meta";
import type {
  EntityMentionDto,
  EntityRefs,
  MentionSectionOption,
} from "@/lib/workspace-types";

export type SectionHint = {
  id: string;
  title: string;
  documentTitle: string;
};

export type SectionHintMap = Map<string, SectionHint>;

export function mentionTitle(
  item: string,
  kind: EntityRefs["kind"],
  hint?: SectionHint,
): string {
  if (hint) return hint.title;
  return kind === "chapter" ? `гл. ${item}` : item;
}

export function mentionsOfRefs(
  refs: EntityRefs,
  hints: SectionHintMap = new Map(),
): EntityMentionDto[] {
  return refs.items.map((id) => {
    const hint = hints.get(id);
    return {
      id,
      title: mentionTitle(id, refs.kind, hint),
      documentTitle: hint?.documentTitle ?? null,
      source: hint ? "linked" : "label",
    };
  });
}

export async function loadSectionHints(
  db: PrismaClient,
  projectId: string,
): Promise<SectionHintMap> {
  const rows = await db.documentSection.findMany({
    where: { document: { projectId } },
    select: {
      id: true,
      title: true,
      document: { select: { title: true } },
    },
  });
  const map: SectionHintMap = new Map();
  for (const row of rows) {
    map.set(row.id, {
      id: row.id,
      title: row.title,
      documentTitle: row.document.title,
    });
  }
  return map;
}

export async function listMentionSections(
  db: PrismaClient,
  projectId: string,
): Promise<MentionSectionOption[]> {
  const rows = await db.documentSection.findMany({
    where: { document: { projectId } },
    orderBy: [{ document: { updatedAt: "desc" } }, { order: "asc" }],
    select: {
      id: true,
      title: true,
      order: true,
      documentId: true,
      document: { select: { title: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    documentId: row.documentId,
    documentTitle: row.document.title,
    order: row.order,
  }));
}

/** False if any id belongs to a section outside this workspace. */
export async function refsStayInProject(
  db: PrismaClient,
  projectId: string,
  items: string[],
): Promise<boolean> {
  if (items.length === 0) return true;
  const found = await db.documentSection.findMany({
    where: { id: { in: items } },
    select: { id: true, document: { select: { projectId: true } } },
  });
  return found.every((row) => row.document.projectId === projectId);
}

export function nameMentionedInText(name: string, text: string): boolean {
  const needle = name.trim().toLowerCase();
  if (needle.length < 2) return false;
  return text.toLowerCase().includes(needle);
}

export function entitiesFoundInText<T extends { id: string; name: string }>(
  text: string,
  entities: T[],
  linkedIds: Set<string>,
): T[] {
  return entities.filter(
    (entity) =>
      !linkedIds.has(entity.id) && nameMentionedInText(entity.name, text),
  );
}

export function addSectionMention(
  rawRefs: string,
  domain: string,
  sectionId: string,
): string {
  const refs = parseEntityRefs(rawRefs);
  const next = withRefItem(
    { kind: refs.kind || refsKindOfDomain(domain), items: refs.items },
    sectionId,
  );
  return serializeEntityRefs(next);
}

export function removeSectionMention(rawRefs: string, sectionId: string): string {
  return serializeEntityRefs(withoutRefItem(parseEntityRefs(rawRefs), sectionId));
}

export async function detachSectionMentions(
  db: PrismaClient,
  projectId: string,
  sectionIds: string[],
): Promise<string[]> {
  if (sectionIds.length === 0) return [];
  const drop = new Set(sectionIds);
  const entities = await db.entity.findMany({
    where: { projectId },
    select: { id: true, refs: true },
  });
  const touched: string[] = [];
  for (const entity of entities) {
    const refs = parseEntityRefs(entity.refs);
    const items = refs.items.filter((item) => !drop.has(item));
    if (items.length === refs.items.length) continue;
    await db.entity.update({
      where: { id: entity.id },
      data: { refs: serializeEntityRefs({ ...refs, items }) },
    });
    touched.push(entity.id);
  }
  return touched;
}
