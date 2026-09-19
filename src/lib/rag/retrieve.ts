/**
 * retrieve() — agent + /api/rag/search.
 * Vector search when embeddings exist; keyword fallback in the SAME scope.
 */

import type { PrismaClient } from "@prisma/client";

import { rankCanonHits } from "../retrieve";
import { tryEmbedTexts } from "./embed";
import { chunkMatchesScope } from "./scope";
import { loadScopedChunks, searchVector } from "./store";
import type { RagChunkRow, RagHit, RagScope, RetrieveResult } from "./types";

const KEYWORD_NOTICE = "поиск без эмбеддингов";

/** Drop chunks whose project was archived (global chat) or whose note/section is gone. */
async function filterLiveChunks(
  db: PrismaClient,
  scope: RagScope,
  rows: RagChunkRow[],
): Promise<RagChunkRow[]> {
  if (rows.length === 0) return rows;
  let next = rows;
  if (scope.kind === "global") {
    const projectIds = [
      ...new Set(next.map((r) => r.projectId).filter((id): id is string => Boolean(id))),
    ];
    if (projectIds.length > 0) {
      const archived = await db.project.findMany({
        where: { id: { in: projectIds }, archived: true },
        select: { id: true },
      });
      const skip = new Set(archived.map((p) => p.id));
      next = next.filter((r) => !r.projectId || !skip.has(r.projectId));
    }
  }
  const noteIds = [
    ...new Set(next.filter((r) => r.sourceType === "note").map((r) => r.sourceId)),
  ];
  const sectionIds = [
    ...new Set(next.filter((r) => r.sourceType === "section").map((r) => r.sourceId)),
  ];
  const liveNotes =
    noteIds.length === 0
      ? null
      : new Set(
          (
            await db.note.findMany({
              where: { id: { in: noteIds } },
              select: { id: true },
            })
          ).map((n) => n.id),
        );
  const liveSections =
    sectionIds.length === 0
      ? null
      : new Set(
          (
            await db.documentSection.findMany({
              where: { id: { in: sectionIds } },
              select: { id: true },
            })
          ).map((s) => s.id),
        );
  if (!liveNotes && !liveSections) return next;
  return next.filter((r) => {
    if (r.sourceType === "note" && liveNotes) return liveNotes.has(r.sourceId);
    if (r.sourceType === "section" && liveSections) return liveSections.has(r.sourceId);
    return true;
  });
}

export async function retrieve(
  db: PrismaClient,
  opts: {
    scope: RagScope;
    query: string;
    kinds?: string[];
    limit?: number;
  },
): Promise<RetrieveResult> {
  const query = opts.query.trim();
  const limit = Math.min(12, Math.max(1, opts.limit ?? 8));
  if (!query) {
    return {
      query,
      scope: opts.scope.kind,
      mode: "keyword",
      notice: KEYWORD_NOTICE,
      hits: [],
    };
  }

  const embedded = await tryEmbedTexts(db, opts.scope.userId, [query]);
  if (embedded.vectors?.[0]) {
    const rows = await searchVector(db, opts.scope, embedded.vectors[0], {
      kinds: opts.kinds,
      limit: limit * 2,
    });
    const scoped = rows.filter((r) => chunkMatchesScope(r, opts.scope));
    const live = await filterLiveChunks(db, opts.scope, scoped);
    const hits = live.slice(0, limit).map(rowToHit);
    if (hits.length > 0) {
      return {
        query,
        scope: opts.scope.kind,
        mode: "vector",
        notice: null,
        hits,
      };
    }
  }

  const fallback = await keywordRetrieve(db, opts.scope, query, {
    kinds: opts.kinds,
    limit,
  });
  return {
    query,
    scope: opts.scope.kind,
    mode: "keyword",
    notice: KEYWORD_NOTICE,
    hits: fallback,
  };
}

export async function keywordRetrieve(
  db: PrismaClient,
  scope: RagScope,
  query: string,
  opts: { kinds?: string[]; limit: number },
): Promise<RagHit[]> {
  const rows = await loadScopedChunks(db, scope, {
    kinds: opts.kinds,
    take: 400,
  });
  const scoped = rows.filter((r) => chunkMatchesScope(r, scope));
  const live = await filterLiveChunks(db, scope, scoped);
  const ranked = rankCanonHits(
    query,
    live.map((r) => ({
      kind: (r.sourceType === "section" || r.sourceType === "entity" || r.sourceType === "note"
        ? r.sourceType
        : "note") as "note" | "section" | "entity",
      id: r.id,
      title: hitTitle(r.sourceType, r.path, r.projectName),
      body: r.content,
      workspaceId: r.projectId,
    })),
    opts.limit,
  );
  const byId = new Map(live.map((r) => [r.id, r]));
  return ranked.map((h) => {
    const row = byId.get(h.id);
    return {
      kind: row?.sourceType ?? h.kind,
      id: h.id,
      sourceId: row?.sourceId ?? h.id,
      title: h.title,
      excerpt: h.excerpt,
      workspaceId: h.workspaceId,
      workspaceName: row?.projectName ?? null,
      path: row?.path ?? null,
      score: 1,
    };
  });
}

function rowToHit(row: {
  id: string;
  sourceType: string;
  sourceId: string;
  path: string | null;
  content: string;
  projectId: string | null;
  projectName?: string | null;
  score?: number;
}): RagHit {
  const excerpt = row.content.replace(/\s+/g, " ").trim().slice(0, 280);
  return {
    kind: row.sourceType,
    id: row.id,
    sourceId: row.sourceId,
    title: hitTitle(row.sourceType, row.path, row.projectName),
    excerpt,
    workspaceId: row.projectId,
    workspaceName: row.projectName ?? null,
    path: row.path,
    score: typeof row.score === "number" ? row.score : 0,
  };
}

function hitTitle(
  sourceType: string,
  path: string | null,
  projectName: string | null | undefined,
): string {
  if (path) return path;
  const kindLabel: Record<string, string> = {
    note: "Заметка",
    section: "Глава",
    entity: "Сущность",
    artifact: "Артефакт",
    file: "Файл",
    thread: "Диалог",
    skill: "Скилл",
    finding: "Находка",
  };
  const label = kindLabel[sourceType] ?? sourceType;
  return projectName ? `${label} · ${projectName}` : label;
}
