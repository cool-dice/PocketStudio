/**
 * Fire-and-forget index-on-write. Failures are logged, never thrown to the UI.
 */

import type { PrismaClient } from "@prisma/client";

import { indexDocument, removeSource } from "./indexer";
import type { RagSourceType } from "./types";

const queue: Promise<void>[] = [];
const MAX_QUEUE = 32;

function enqueue(job: () => Promise<void>): void {
  const run = job().catch((err) => {
    console.warn("[rag] index-on-write failed:", err instanceof Error ? err.message : err);
  });
  queue.push(run);
  if (queue.length > MAX_QUEUE) {
    void queue.shift();
  }
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
  enqueue(() => indexDocument(db, doc).then(() => undefined));
}

export function scheduleRemove(
  db: PrismaClient,
  userId: string,
  sourceType: RagSourceType,
  sourceId: string,
): void {
  enqueue(() => removeSource(db, userId, sourceType, sourceId));
}

export async function indexNoteById(db: PrismaClient, noteId: string): Promise<void> {
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
  await indexDocument(db, {
    userId: note.userId,
    projectId: note.links[0]?.projectId ?? null,
    sourceType: "note",
    sourceId: note.id,
    title: "Заметка",
    body,
  });
}

export async function indexSectionById(db: PrismaClient, sectionId: string): Promise<void> {
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
  await indexDocument(db, {
    userId: section.document.project.userId,
    projectId: section.document.projectId,
    sourceType: "section",
    sourceId: section.id,
    title: section.title,
    body: section.content,
  });
}

export async function indexEntityById(db: PrismaClient, entityId: string): Promise<void> {
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
  await indexDocument(db, {
    userId: entity.project.userId,
    projectId: entity.projectId,
    sourceType: "entity",
    sourceId: entity.id,
    title: entity.name,
    body: [entity.short, entity.description, entity.attributes].filter(Boolean).join("\n"),
  });
}

export async function indexArtifactById(db: PrismaClient, artifactId: string): Promise<void> {
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
  await indexDocument(db, {
    userId: artifact.project.userId,
    projectId: artifact.projectId,
    sourceType: "artifact",
    sourceId: artifact.id,
    title: artifact.title,
    body: [artifact.type, artifact.description, artifact.prompt].filter(Boolean).join("\n"),
  });
}

export async function indexSkillById(db: PrismaClient, skillId: string): Promise<void> {
  const skill = await db.skill.findUnique({
    where: { id: skillId },
    select: { id: true, userId: true, name: true, description: true, skillMd: true, triggers: true },
  });
  if (!skill) return;
  await indexDocument(db, {
    userId: skill.userId,
    projectId: null,
    sourceType: "skill",
    sourceId: skill.id,
    title: skill.name,
    body: [skill.description, skill.triggers, skill.skillMd].filter(Boolean).join("\n"),
  });
}

export async function indexFindingById(db: PrismaClient, findingId: string): Promise<void> {
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
  await indexDocument(db, {
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
  enqueue(() => indexFileContent(db, opts));
}
