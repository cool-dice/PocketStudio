import { NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody } from "@/lib/json-body-limit";

import {
  ALBUM_ALREADY_HERE,
  ALBUM_SOURCE_NOT_IMAGE,
} from "@/lib/album-copy";
import {
  albumKindForSource,
  albumPersistType,
  copiedAlbumUrl,
  isAlbumSourceRow,
  persistAlbumMeta,
} from "@/lib/album-attach";
import { db } from "@/lib/db";
import { ensureOwned, ensureWorkspace } from "@/lib/workspace-api";
import { liveArtifactDto } from "@/lib/workspace-shapes";
import { scheduleIndexArtifact } from "@/lib/rag";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/* ── GET /api/workspaces/[id]/artifacts — артефакты воркспейса ── */

export async function GET(req: Request, { params }: Params) {
  const { id } = await params;
  const check = await ensureWorkspace(req, id);
  if (!check.ok) return check.response;

  const typeParam = new URL(req.url).searchParams.get("type");
  const artifacts = await db.artifact.findMany({
    where: { projectId: id, ...(typeParam ? { type: typeParam } : {}) },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({
    artifacts: artifacts.map((a) => liveArtifactDto(a)),
  });
}

/* ── POST /api/workspaces/[id]/artifacts — зарегистрировать артефакт ── */

const createSchema = z.object({
  type: z.enum([
    "note", "document", "portrait", "image", "track", "scene",
    "app", "deploy", "audio", "video", "file",
  ]),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(500).optional(),
  url: z.string().max(2_000).optional(),
  prompt: z.string().max(4_000).optional(),
  entityId: z.string().max(40).optional(),
  stage: z.string().max(40).optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

const copySchema = z.object({
  sourceId: z.string().trim().min(1).max(64),
});

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const check = await ensureWorkspace(req, id);
  if (!check.ok) return check.response;

  const jsonRead = await readJsonBody(req, { fallback: {} });
  if (!jsonRead.ok) return jsonRead.response;
  const body = jsonRead.value;
  const copyParsed = copySchema.safeParse(body);
  if (copyParsed.success) {
    return copyFromLibrary(req, id, copyParsed.data.sourceId);
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректный запрос" },
      { status: 400 },
    );
  }
  const data = parsed.data;

  const artifact = await db.artifact.create({
    data: {
      projectId: id,
      type: data.type,
      title: data.title,
      description: data.description || null,
      url: data.url || null,
      prompt: data.prompt || null,
      entityId: data.entityId || null,
      stage: data.stage || null,
      meta: data.meta ? JSON.stringify(data.meta) : null,
    },
  });

  scheduleIndexArtifact(db, artifact.id);

  return NextResponse.json({ artifact: liveArtifactDto(artifact) }, { status: 201 });
}

async function copyFromLibrary(req: Request, projectId: string, sourceId: string) {
  const sourceRow = await db.artifact.findUnique({ where: { id: sourceId } });
  const owned = await ensureOwned(req, sourceRow);
  if (!owned.ok) return owned.response;
  const source = owned.row;

  if (source.projectId === projectId) {
    return NextResponse.json({ error: ALBUM_ALREADY_HERE }, { status: 409 });
  }
  if (!isAlbumSourceRow(source.type, source.meta)) {
    return NextResponse.json({ error: ALBUM_SOURCE_NOT_IMAGE }, { status: 400 });
  }

  const kind = albumKindForSource(source.type, source.meta);
  const artifact = await db.artifact.create({
    data: {
      projectId,
      type: albumPersistType(kind),
      title: source.title,
      description: source.description,
      url: copiedAlbumUrl(source.url),
      prompt: source.prompt,
      entityId: null,
      stage: source.stage,
      meta: persistAlbumMeta(source.meta, kind),
    },
  });

  scheduleIndexArtifact(db, artifact.id);
  return NextResponse.json({ artifact: liveArtifactDto(artifact) }, { status: 201 });
}
