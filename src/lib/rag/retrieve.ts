/**
 * retrieve() — agent + /api/rag/search.
 * Vector search when embeddings exist; keyword fallback in the SAME scope.
 */

import { promises as fsp } from "node:fs";

import type { PrismaClient } from "@prisma/client";

import { throwIfAborted } from "../abort-flag";
import { rankCanonHits } from "../retrieve";
import { projectRoot, safeJoin, WorkspaceError } from "../workspace";
import { tryEmbedTexts } from "./embed";
import { chunkMatchesScope } from "./scope";
import { loadScopedChunks, searchVector } from "./store";
import type { RagChunkRow, RagHit, RagScope, RetrieveResult } from "./types";

const KEYWORD_NOTICE = "поиск без эмбеддингов";

function sourceIds(rows: RagChunkRow[], type: string): string[] {
  return [...new Set(rows.filter((r) => r.sourceType === type).map((r) => r.sourceId))];
}

async function liveIdSet(
  ids: string[],
  load: () => Promise<{ id: string }[]>,
): Promise<Set<string> | null> {
  if (ids.length === 0) return null;
  return new Set((await load()).map((row) => row.id));
}

/** Drop chunks whose project was archived or whose note/section/entity is gone. */
async function filterLiveChunks(
  db: PrismaClient,
  scope: RagScope,
  rows: RagChunkRow[],
  signal?: AbortSignal,
): Promise<RagChunkRow[]> {
  throwIfAborted(signal);
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
  const noteIds = sourceIds(next, "note");
  const sectionIds = sourceIds(next, "section");
  const entityIds = sourceIds(next, "entity");
  const liveNotes = await liveIdSet(noteIds, () =>
    db.note.findMany({ where: { id: { in: noteIds } }, select: { id: true } }),
  );
  const liveSections = await liveIdSet(sectionIds, () =>
    db.documentSection.findMany({
      where: { id: { in: sectionIds } },
      select: { id: true },
    }),
  );
  const liveEntities = await liveIdSet(entityIds, () =>
    db.entity.findMany({ where: { id: { in: entityIds } }, select: { id: true } }),
  );
  if (!liveNotes && !liveSections && !liveEntities) {
    return filterLiveFiles(next, signal);
  }
  const withSources = next.filter((r) => {
    if (r.sourceType === "note" && liveNotes) return liveNotes.has(r.sourceId);
    if (r.sourceType === "section" && liveSections) return liveSections.has(r.sourceId);
    if (r.sourceType === "entity" && liveEntities) return liveEntities.has(r.sourceId);
    return true;
  });
  return filterLiveFiles(withSources, signal);
}

async function filterLiveFiles(
  rows: RagChunkRow[],
  signal?: AbortSignal,
): Promise<RagChunkRow[]> {
  const files = rows.filter((r) => r.sourceType === "file");
  if (files.length === 0) return rows;
  const exists = new Map<string, boolean>();
  for (const row of files) {
    throwIfAborted(signal);
    if (!row.path || !row.projectId) continue;
    const key = `${row.projectId}:${row.path}`;
    if (!exists.has(key)) {
      exists.set(key, await fileExistsOnDisk(row.projectId, row.path));
    }
  }
  return rows.filter((r) => {
    if (r.sourceType !== "file") return true;
    if (!r.path || !r.projectId) return false;
    return exists.get(`${r.projectId}:${r.path}`) === true;
  });
}

async function fileExistsOnDisk(projectId: string, relPath: string): Promise<boolean> {
  try {
    const root = projectRoot(projectId);
    try {
      await fsp.stat(root);
    } catch {
      // No workspace on disk yet — keep indexed chunks (tests / not cloned).
      return true;
    }
    const abs = safeJoin(root, relPath);
    const st = await fsp.stat(abs);
    return st.isFile();
  } catch (err) {
    if (err instanceof WorkspaceError) return false;
    return false;
  }
}

export async function retrieve(
  db: PrismaClient,
  opts: {
    scope: RagScope;
    query: string;
    kinds?: string[];
    limit?: number;
    signal?: AbortSignal;
  },
): Promise<RetrieveResult> {
  const query = opts.query.trim();
  const limit = Math.min(12, Math.max(1, opts.limit ?? 8));
  throwIfAborted(opts.signal);
  if (!query) {
    return {
      query,
      scope: opts.scope.kind,
      mode: "keyword",
      notice: KEYWORD_NOTICE,
      hits: [],
    };
  }

  const embedded = await tryEmbedTexts(db, opts.scope.userId, [query], opts.signal);
  throwIfAborted(opts.signal);
  if (embedded.vectors?.[0]) {
    const rows = await searchVector(db, opts.scope, embedded.vectors[0], {
      kinds: opts.kinds,
      limit: limit * 2,
    });
    const scoped = rows.filter((r) => chunkMatchesScope(r, opts.scope));
    const live = await filterLiveChunks(db, opts.scope, scoped, opts.signal);
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
    signal: opts.signal,
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
  opts: { kinds?: string[]; limit: number; signal?: AbortSignal },
): Promise<RagHit[]> {
  throwIfAborted(opts.signal);
  const rows = await loadScopedChunks(db, scope, {
    kinds: opts.kinds,
    take: 400,
  });
  const scoped = rows.filter((r) => chunkMatchesScope(r, scope));
  const live = await filterLiveChunks(db, scope, scoped, opts.signal);
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
