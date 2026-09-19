/**
 * Fire-and-forget index-on-write. Failures never hang the request:
 * jobs run in-process with bounded retries.
 */

import type { PrismaClient } from "@prisma/client";

import { indexDocument, removeSource } from "./indexer";
import { MAX_INDEX_FILE_BYTES, shouldSkipFileBytes } from "./skip";
import type { RagSourceType } from "./types";

type QueueJob = {
  id: string;
  attempts: number;
  run: () => Promise<{ embedFailed?: boolean } | void>;
};

const pending: QueueJob[] = [];
let pumping = false;
const MAX_QUEUE = 48;
const MAX_ATTEMPTS = 4;

function jobId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function enqueue(run: QueueJob["run"]): void {
  if (pending.length >= MAX_QUEUE) {
    const dropped = pending.shift();
    console.warn("[rag] queue full, dropped oldest job", dropped?.id);
  }
  pending.push({ id: jobId(), attempts: 0, run });
  void pump();
}

async function pump(): Promise<void> {
  if (pumping) return;
  pumping = true;
  while (pending.length) {
    const job = pending.shift()!;
    try {
      const result = await job.run();
      if (result && result.embedFailed) {
        throw new Error("embeddings unavailable, retry");
      }
    } catch (err) {
      job.attempts += 1;
      if (job.attempts < MAX_ATTEMPTS) {
        const delay = Math.min(8_000, 400 * 2 ** job.attempts);
        await new Promise((r) => setTimeout(r, delay));
        pending.push(job);
      } else {
        console.warn(
          "[rag] index-on-write gave up after retries:",
          err instanceof Error ? err.message : err,
        );
      }
    }
  }
  pumping = false;
}

export function scheduleIndex(
  db: PrismaClient,
  doc: {
    userId: string;
    projectId: string | null;
    sourceType: RagSourceType;
    sourceId: string;
    path?: string | null;
    title?: string | null;
    body: string;
    code?: boolean;
  },
): void {
  enqueue(() => indexDocument(db, doc));
}

export function scheduleRemove(
  db: PrismaClient,
  userId: string,
  sourceType: RagSourceType,
  sourceId: string,
): void {
  enqueue(async () => {
    await removeSource(db, userId, sourceType, sourceId);
  });
}

export async function indexNoteById(db: PrismaClient, noteId: string) {
  const note = await db.note.findUnique({
    where: { id: noteId },
    select: {
      id: true,
      userId: true,
      rawText: true,
      transcription: true,
      positiveBlock: true,
      negativeBlock: true,
      finalBlock: true,
      recommendations: true,
      links: { select: { projectId: true }, take: 1 },
    },
  });
  if (!note) {
    return;
  }
  const body = [
    note.rawText,
    note.transcription,
    note.positiveBlock,
    note.negativeBlock,
    note.finalBlock,
    note.recommendations,
  ]
    .filter((p) => p && p.trim())
    .join("\n\n");
  return indexDocument(db, {
    userId: note.userId,
    projectId: note.links[0]?.projectId ?? null,
    sourceType: "note",
    sourceId: note.id,
    title: "Заметка",
    body,
  });
}

export async function indexSectionById(db: PrismaClient, sectionId: string) {
  const section = await db.documentSection.findUnique({
    where: { id: sectionId },
    select: {
      id: true,
      title: true,
      content: true,
      document: { select: { projectId: true, project: { select: { userId: true } } } },
    },
  });
  if (!section) return;
  return indexDocument(db, {
    userId: section.document.project.userId,
    projectId: section.document.projectId,
    sourceType: "section",
    sourceId: section.id,
    title: section.title,
    body: section.content,
  });
}

export async function indexEntityById(db: PrismaClient, entityId: string) {
  const entity = await db.entity.findUnique({
    where: { id: entityId },
    select: {
      id: true,
      name: true,
      short: true,
      description: true,
      attributes: true,
      projectId: true,
      project: { select: { userId: true } },
    },
  });
  if (!entity) return;
  return indexDocument(db, {
    userId: entity.project.userId,
    projectId: entity.projectId,
    sourceType: "entity",
    sourceId: entity.id,
    title: entity.name,
    body: [entity.short, entity.description, entity.attributes].filter(Boolean).join("\n"),
  });
}

export async function indexArtifactById(db: PrismaClient, artifactId: string) {
  const artifact = await db.artifact.findUnique({
    where: { id: artifactId },
    select: {
      id: true,
      title: true,
      description: true,
      prompt: true,
      type: true,
      projectId: true,
      project: { select: { userId: true } },
    },
  });
  if (!artifact) return;
  return indexDocument(db, {
    userId: artifact.project.userId,
    projectId: artifact.projectId,
    sourceType: "artifact",
    sourceId: artifact.id,
    title: artifact.title,
    body: [artifact.type, artifact.description, artifact.prompt].filter(Boolean).join("\n"),
  });
}

export async function indexSkillById(db: PrismaClient, skillId: string) {
  const skill = await db.skill.findUnique({
    where: { id: skillId },
    select: { id: true, userId: true, name: true, description: true, skillMd: true, triggers: true },
  });
  if (!skill) return;
  return indexDocument(db, {
    userId: skill.userId,
    projectId: null,
    sourceType: "skill",
    sourceId: skill.id,
    title: skill.name,
    body: [skill.description, skill.triggers, skill.skillMd].filter(Boolean).join("\n"),
  });
}

export async function indexFindingById(db: PrismaClient, findingId: string) {
  const finding = await db.finding.findUnique({
    where: { id: findingId },
    select: {
      id: true,
      title: true,
      quote: true,
      advice: true,
      sourceRef: true,
      projectId: true,
      project: { select: { userId: true } },
    },
  });
  if (!finding) return;
  return indexDocument(db, {
    userId: finding.project.userId,
    projectId: finding.projectId,
    sourceType: "finding",
    sourceId: finding.id,
    title: finding.title,
    body: [finding.quote, finding.advice, finding.sourceRef].filter(Boolean).join("\n"),
  });
}

export async function indexFileContent(
  db: PrismaClient,
  opts: {
    userId: string;
    projectId: string;
    relPath: string;
    content: string;
  },
): Promise<void> {
  const bytes = Buffer.byteLength(opts.content, "utf8");
  if (shouldSkipFileBytes(bytes)) {
    console.warn(
      `[rag] skip huge file ${opts.relPath} (${bytes} > ${MAX_INDEX_FILE_BYTES} bytes)`,
    );
    return;
  }
  await indexDocument(db, {
    userId: opts.userId,
    projectId: opts.projectId,
    sourceType: "file",
    sourceId: `${opts.projectId}:${opts.relPath}`,
    path: opts.relPath,
    title: opts.relPath,
    body: opts.content,
    code: true,
  });
}

export function scheduleIndexNote(db: PrismaClient, noteId: string): void {
  enqueue(() => indexNoteById(db, noteId));
}

export function scheduleIndexSection(db: PrismaClient, sectionId: string): void {
  enqueue(() => indexSectionById(db, sectionId));
}

export function scheduleIndexEntity(db: PrismaClient, entityId: string): void {
  enqueue(() => indexEntityById(db, entityId));
}

export function scheduleIndexArtifact(db: PrismaClient, artifactId: string): void {
  enqueue(() => indexArtifactById(db, artifactId));
}

export function scheduleIndexSkill(db: PrismaClient, skillId: string): void {
  enqueue(() => indexSkillById(db, skillId));
}

export function scheduleIndexFinding(db: PrismaClient, findingId: string): void {
  enqueue(() => indexFindingById(db, findingId));
}

export function scheduleIndexFile(
  db: PrismaClient,
  opts: { userId: string; projectId: string; relPath: string; content: string },
): void {
  enqueue(async () => {
    await indexFileContent(db, opts);
  });
}
