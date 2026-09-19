import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { ensureWorkspace } from "@/lib/workspace-api";
import { artifactDto } from "@/lib/workspace-shapes";
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

  return NextResponse.json({ artifacts: artifacts.map(artifactDto) });
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

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const check = await ensureWorkspace(req, id);
  if (!check.ok) return check.response;

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
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

  return NextResponse.json({ artifact: artifactDto(artifact) }, { status: 201 });
}
