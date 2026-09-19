/**
 * Full reindex of a user / workspace / (admin) everyone.
 * Sequential in-process queue — no BullMQ.
 */

import { promises as fsp } from "node:fs";
import path from "node:path";

import type { PrismaClient } from "@prisma/client";

import { embeddingsConfigured, tryEmbedTexts } from "./embed";
import {
  indexArtifactById,
  indexEntityById,
  indexFileContent,
  indexFindingById,
  indexNoteById,
  indexSectionById,
  indexSkillById,
} from "./hooks";
import { indexDocument } from "./indexer";
import { isProbablyBinary, shouldSkipFileBytes, shouldSkipPath } from "./skip";
import { deleteSourceChunks } from "./store";
import { EMBEDDING_DIM_MISMATCH_MESSAGE, UNCONFIGURED_EMBEDDINGS_MESSAGE } from "./types";
import { projectRoot } from "../workspace";

export interface ReindexReport {
  notes: number;
  sections: number;
  entities: number;
  artifacts: number;
  skills: number;
  findings: number;
  files: number;
  threads: number;
}

/** Drop chunks whose source row is gone. Idempotent with a full reindex. */
export async function purgeStaleChunks(
  db: PrismaClient,
  userId: string,
  projectId: string | null,
): Promise<number> {
  const rows = await db.ragChunk.findMany({
    where: {
      userId,
      ...(projectId ? { projectId } : {}),
    },
    select: { sourceType: true, sourceId: true },
  });
  const unique = new Map<string, { sourceType: string; sourceId: string }>();
  for (const row of rows) {
    unique.set(`${row.sourceType}:${row.sourceId}`, row);
  }

  const idList = (kind: string) =>
    [...unique.values()].filter((r) => r.sourceType === kind).map((r) => r.sourceId);

  const noteIds = idList("note");
  const sectionIds = idList("section");
  const entityIds = idList("entity");
  const artifactIds = idList("artifact");
  const skillIds = idList("skill");
  const findingIds = idList("finding");

  const live: Record<string, Set<string>> = {
    note: new Set(
      noteIds.length === 0
        ? []
        : (await db.note.findMany({ where: { id: { in: noteIds } }, select: { id: true } })).map(
            (r) => r.id,
          ),
    ),
    section: new Set(
      sectionIds.length === 0
        ? []
        : (
            await db.documentSection.findMany({
              where: { id: { in: sectionIds } },
              select: { id: true },
            })
          ).map((r) => r.id),
    ),
    entity: new Set(
      entityIds.length === 0
        ? []
        : (
            await db.entity.findMany({ where: { id: { in: entityIds } }, select: { id: true } })
          ).map((r) => r.id),
    ),
    artifact: new Set(
      artifactIds.length === 0
        ? []
        : (
            await db.artifact.findMany({
              where: { id: { in: artifactIds } },
              select: { id: true },
            })
          ).map((r) => r.id),
    ),
    skill: new Set(
      skillIds.length === 0
        ? []
        : (await db.skill.findMany({ where: { id: { in: skillIds } }, select: { id: true } })).map(
            (r) => r.id,
          ),
    ),
    finding: new Set(
      findingIds.length === 0
        ? []
        : (
            await db.finding.findMany({
              where: { id: { in: findingIds } },
              select: { id: true },
            })
          ).map((r) => r.id),
    ),
  };

  let removed = 0;
  for (const row of unique.values()) {
    const set = live[row.sourceType];
    if (!set) continue;
    if (set.has(row.sourceId)) continue;
    await deleteSourceChunks(db, userId, row.sourceType, row.sourceId);
    removed += 1;
  }
  return removed;
}

export async function reindexUserData(
  db: PrismaClient,
  opts: {
    actorUserId: string;
    targetUserId: string;
    projectId?: string | null;
    requireEmbeddings?: boolean;
  },
): Promise<ReindexReport> {
  if (opts.requireEmbeddings !== false) {
    const ok = await embeddingsConfigured(db, opts.actorUserId);
    if (!ok) {
      throw new Error(UNCONFIGURED_EMBEDDINGS_MESSAGE);
    }
    const probe = await tryEmbedTexts(db, opts.actorUserId, ["pocketstudio"]);
    if (probe.error && probe.error === EMBEDDING_DIM_MISMATCH_MESSAGE) {
      throw new Error(EMBEDDING_DIM_MISMATCH_MESSAGE);
    }
  }

  const report: ReindexReport = {
    notes: 0,
    sections: 0,
    entities: 0,
    artifacts: 0,
    skills: 0,
    findings: 0,
    files: 0,
    threads: 0,
  };

  const noteWhere = opts.projectId
    ? { userId: opts.targetUserId, links: { some: { projectId: opts.projectId } } }
    : { userId: opts.targetUserId };
  const notes = await db.note.findMany({ where: noteWhere, select: { id: true } });
  await purgeStaleChunks(db, opts.targetUserId, opts.projectId ?? null);
  for (const n of notes) {
    await indexNoteById(db, n.id);
    report.notes += 1;
  }

  const sections = await db.documentSection.findMany({
    where: {
      document: {
        project: { userId: opts.targetUserId, ...(opts.projectId ? { id: opts.projectId } : {}) },
      },
    },
    select: { id: true },
  });
  for (const s of sections) {
    await indexSectionById(db, s.id);
    report.sections += 1;
  }

  const entities = await db.entity.findMany({
    where: { project: { userId: opts.targetUserId, ...(opts.projectId ? { id: opts.projectId } : {}) } },
    select: { id: true },
  });
  for (const e of entities) {
    await indexEntityById(db, e.id);
    report.entities += 1;
  }

  const artifacts = await db.artifact.findMany({
    where: { project: { userId: opts.targetUserId, ...(opts.projectId ? { id: opts.projectId } : {}) } },
    select: { id: true },
  });
  for (const a of artifacts) {
    await indexArtifactById(db, a.id);
    report.artifacts += 1;
  }

  if (!opts.projectId) {
    const skills = await db.skill.findMany({
      where: { userId: opts.targetUserId },
      select: { id: true },
    });
    for (const s of skills) {
      await indexSkillById(db, s.id);
      report.skills += 1;
    }
  }

  const findings = await db.finding.findMany({
    where: { project: { userId: opts.targetUserId, ...(opts.projectId ? { id: opts.projectId } : {}) } },
    select: { id: true },
  });
  for (const f of findings) {
    await indexFindingById(db, f.id);
    report.findings += 1;
  }

  const threads = await db.thread.findMany({
    where: {
      userId: opts.targetUserId,
      ...(opts.projectId ? { projectId: opts.projectId } : {}),
    },
    select: {
      id: true,
      title: true,
      projectId: true,
      messages: {
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { role: true, content: true },
      },
    },
  });
  for (const t of threads) {
    const body = t.messages
      .slice()
      .reverse()
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => m.content)
      .join("\n");
    if (!body.trim()) continue;
    await indexDocument(db, {
      userId: opts.targetUserId,
      projectId: t.projectId,
      sourceType: "thread",
      sourceId: t.id,
      title: t.title,
      body,
    });
    report.threads += 1;
  }

  const projects = await db.project.findMany({
    where: {
      userId: opts.targetUserId,
      ...(opts.projectId ? { id: opts.projectId } : {}),
      rootPath: { not: null },
    },
    select: { id: true },
  });
  for (const p of projects) {
    report.files += await indexProjectFiles(db, opts.targetUserId, p.id);
  }

  return report;
}

async function indexProjectFiles(
  db: PrismaClient,
  userId: string,
  projectId: string,
): Promise<number> {
  const root = projectRoot(projectId);
  let counted = 0;
  async function walk(dir: string): Promise<void> {
    let dirents;
    try {
      dirents = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const d of dirents) {
      const abs = path.join(dir, d.name);
      const rel = path.relative(root, abs).split(path.sep).join("/");
      if (shouldSkipPath(rel)) continue;
      if (d.isDirectory()) {
        await walk(abs);
        continue;
      }
      if (!d.isFile()) continue;
      try {
        const stat = await fsp.stat(abs);
        if (shouldSkipFileBytes(stat.size)) continue;
        const buf = await fsp.readFile(abs);
        if (isProbablyBinary(buf)) continue;
        await indexFileContent(db, {
          userId,
          projectId,
          relPath: rel,
          content: buf.toString("utf8"),
        });
        counted += 1;
      } catch {
        // skip unreadable
      }
    }
  }
  await walk(root);
  return counted;
}

export async function reindexAllUsers(
  db: PrismaClient,
  actorUserId: string,
): Promise<{ users: number }> {
  const ok = await embeddingsConfigured(db, actorUserId);
  if (!ok) throw new Error(UNCONFIGURED_EMBEDDINGS_MESSAGE);
  const probe = await tryEmbedTexts(db, actorUserId, ["pocketstudio"]);
  if (probe.error === EMBEDDING_DIM_MISMATCH_MESSAGE) {
    throw new Error(EMBEDDING_DIM_MISMATCH_MESSAGE);
  }
  const users = await db.user.findMany({ select: { id: true } });
  for (const u of users) {
    await reindexUserData(db, {
      actorUserId,
      targetUserId: u.id,
      requireEmbeddings: false,
    });
  }
  return { users: users.length };
}
