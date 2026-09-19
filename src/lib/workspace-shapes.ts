/**
 * Серверные шейперы DTO (Фаза A): Prisma-строки → формы из
 * workspace-types для REST API. Содержат подсчёт counts воркспейса.
 */

import { db } from "@/lib/db";
import type {
  ArtifactDto,
  ArtifactType,
  DocumentDto,
  DocumentSectionDto,
  EntityAttribute,
  EntityDomain,
  EntityKind,
  EntityDto,
  EntityRefs,
  FindingDto,
  FindingSeverity,
  FindingStatus,
  FindingType,
  WorkspaceCounts,
  WorkspaceDto,
  WorkspaceKind,
} from "@/lib/workspace-types";

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  origin: string;
  type: string;
  stage: string | null;
  stageIndex: number | null;
  progress: number;
  favorite?: boolean;
  archived?: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count?: {
    threads?: number;
    noteLinks?: number;
    documents?: number;
    entities?: number;
    artifacts?: number;
  };
};

const KINDS: WorkspaceKind[] = ["film", "book", "music", "app", "universal"];

export function workspaceKindOf(type: string): WorkspaceKind {
  return KINDS.includes(type as WorkspaceKind) ? (type as WorkspaceKind) : "universal";
}

export function workspaceDto(
  p: ProjectRow,
  counts: WorkspaceCounts,
): WorkspaceDto {
  return {
    id: p.id,
    type: workspaceKindOf(p.type),
    name: p.name,
    description: p.description,
    origin: p.origin,
    stage: p.stage,
    stageIndex: p.stageIndex,
    progress: p.progress,
    favorite: Boolean(p.favorite),
    archived: Boolean(p.archived),
    counts,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

/** Реальные counts воркспейса по таблицам контента. */
export async function workspaceCounts(projectId: string): Promise<WorkspaceCounts> {
  const [noteLinks, documents, artifacts] = await Promise.all([
    db.noteLink.count({ where: { projectId } }),
    db.document.count({ where: { projectId } }),
    db.artifact.groupBy({
      by: ["type"],
      where: { projectId },
      _count: { _all: true },
    }),
  ]);
  const byType = new Map(artifacts.map((g) => [g.type, g._count._all]));
  const sum = (...types: string[]) =>
    types.reduce((acc, t) => acc + (byType.get(t) ?? 0), 0);
  return {
    notes: noteLinks,
    documents,
    images: sum("image", "portrait"),
    audio: sum("track", "audio"),
    video: sum("scene", "video"),
    files: sum("app", "file", "deploy"),
  };
}

/* ─────────────────────────── documents ─────────────────────────── */

export function wordsCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

type SectionRow = {
  id: string;
  documentId: string;
  title: string;
  order: number;
  content: string;
  status: string;
  updatedAt: Date;
};

export function sectionDto(s: SectionRow): DocumentSectionDto {
  return {
    id: s.id,
    documentId: s.documentId,
    title: s.title,
    order: s.order,
    content: s.content,
    status: s.status === "done" ? "done" : "draft",
    wordsCount: wordsCount(s.content),
    updatedAt: s.updatedAt.toISOString(),
  };
}

type DocumentRow = {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  kind: string;
  updatedAt: Date;
  /** Частичные секции (только content — для подсчёта слов) либо полные. */
  sections?: Array<Pick<SectionRow, "content"> & Partial<SectionRow>>;
  _count?: { sections: number };
};

function isFullSection(s: Partial<SectionRow>): s is SectionRow {
  return (
    typeof s.id === "string" &&
    typeof s.documentId === "string" &&
    typeof s.title === "string" &&
    typeof s.order === "number" &&
    typeof s.status === "string" &&
    s.updatedAt instanceof Date
  );
}

export function documentDto(d: DocumentRow): DocumentDto {
  const sections = d.sections?.filter(isFullSection).map(sectionDto);
  const words =
    d.sections?.reduce((acc, s) => acc + wordsCount(s.content), 0) ?? null;
  return {
    id: d.id,
    projectId: d.projectId,
    title: d.title,
    description: d.description,
    kind: (["manuscript", "spec", "article", "script"].includes(d.kind)
      ? d.kind
      : "manuscript") as DocumentDto["kind"],
    wordsCount: words ?? d._count?.sections ?? 0,
    updatedAt: d.updatedAt.toISOString(),
    sections,
    sectionsCount: sections?.length ?? d._count?.sections ?? 0,
  };
}

/* ─────────────────────────── entities ─────────────────────────── */

const ENTITY_KINDS: EntityKind[] = [
  "character", "location", "event", "item", "faction", "rule",
  "user", "role", "requirement", "module", "integration",
];

type EntityRow = {
  id: string;
  projectId: string;
  setId: string;
  setName: string;
  domain: string;
  kind: string;
  name: string;
  short: string | null;
  description: string;
  attributes: string;
  tags: string;
  refs: string;
  portrait: string | null;
  image: string | null;
  imagePrompt: string | null;
  favorite: boolean;
  updatedAt: Date;
};

export function entityDto(e: EntityRow, related: string[] = []): EntityDto {
  let attributes: EntityAttribute[] = [];
  let tags: string[] = [];
  let refs: EntityRefs = { kind: "chapter", items: [] };
  let portrait: EntityDto["portrait"] = null;
  try {
    attributes = JSON.parse(e.attributes) ?? [];
  } catch { /* дефолт */ }
  try {
    tags = JSON.parse(e.tags) ?? [];
  } catch { /* дефолт */ }
  try {
    const parsed = JSON.parse(e.refs);
    if (parsed && typeof parsed === "object") {
      refs = {
        kind: parsed.kind === "section" ? "section" : "chapter",
        items: Array.isArray(parsed.items) ? parsed.items.map(String) : [],
      };
    }
  } catch { /* дефолт */ }
  try {
    if (e.portrait) portrait = JSON.parse(e.portrait);
  } catch { /* дефолт */ }
  return {
    id: e.id,
    projectId: e.projectId,
    setId: e.setId,
    setName: e.setName,
    domain: (e.domain === "product" ? "product" : "narrative") as EntityDomain,
    kind: (ENTITY_KINDS.includes(e.kind as EntityKind)
      ? e.kind
      : "item") as EntityKind,
    name: e.name,
    short: e.short,
    description: e.description,
    attributes,
    tags,
    refs,
    portrait,
    image: e.image ?? null,
    favorite: e.favorite,
    related,
    updatedAt: e.updatedAt.toISOString(),
  };
}

/* ─────────────────────────── artifacts ─────────────────────────── */

const ARTIFACT_TYPES = [
  "note", "document", "portrait", "image", "track", "scene",
  "app", "deploy", "audio", "video", "file",
];

type ArtifactRow = {
  id: string;
  projectId: string;
  type: string;
  title: string;
  description: string | null;
  url: string | null;
  prompt: string | null;
  entityId: string | null;
  stage: string | null;
  meta: string | null;
  favorite: boolean;
  createdAt: Date;
};

export function artifactDto(a: ArtifactRow): ArtifactDto {
  let meta: ArtifactDto["meta"] = null;
  try {
    if (a.meta) meta = JSON.parse(a.meta);
  } catch { /* дефолт */ }
  return {
    id: a.id,
    projectId: a.projectId,
    type: (ARTIFACT_TYPES.includes(a.type) ? a.type : "file") as ArtifactType,
    title: a.title,
    description: a.description,
    url: a.url,
    prompt: a.prompt,
    entityId: a.entityId,
    stage: a.stage,
    meta,
    favorite: a.favorite,
    createdAt: a.createdAt.toISOString(),
  };
}

/* ─────────────────────────── findings ─────────────────────────── */

type FindingRow = {
  id: string;
  projectId: string;
  documentId: string | null;
  scope: string;
  type: string;
  severity: string;
  title: string;
  quote: string | null;
  advice: string | null;
  sourceRef: string | null;
  status: string;
  createdAt: Date;
};

export function findingDto(f: FindingRow): FindingDto {
  return {
    id: f.id,
    projectId: f.projectId,
    documentId: f.documentId,
    scope: f.scope,
    type: (["contradiction", "omission", "inconsistency"].includes(f.type)
      ? f.type
      : "inconsistency") as FindingType,
    severity: (["info", "warning", "critical"].includes(f.severity)
      ? f.severity
      : "warning") as FindingSeverity,
    title: f.title,
    quote: f.quote,
    advice: f.advice,
    sourceRef: f.sourceRef,
    status: (["open", "fixed", "dismissed"].includes(f.status)
      ? f.status
      : "open") as FindingStatus,
    createdAt: f.createdAt.toISOString(),
  };
}
