import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { workspaceCounts, workspaceDto } from "@/lib/workspace-shapes";
import {
  WORKSPACE_STAGES,
  canonicalStageLabel,
  pipelineStageIndex,
} from "@/lib/workspace-data";
import type { WorkspaceKind } from "@/lib/workspace-types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/* ── GET /api/workspaces/[id] — воркспейс ── */

export async function GET(req: Request, { params }: Params) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  const { id } = await params;

  const project = await db.project.findFirst({
    where: { id, userId: session.sub },
  });
  if (!project) {
    return NextResponse.json({ error: "Воркспейс не найден" }, { status: 404 });
  }

  return NextResponse.json({
    workspace: workspaceDto(project, await workspaceCounts(project.id)),
  });
}

/* ── PATCH /api/workspaces/[id] — стадия/прогресс/название/описание ── */

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  stage: z.string().trim().max(40).optional(),
  stageIndex: z.number().int().min(1).max(12).optional(),
  progress: z.number().int().min(0).max(100).optional(),
  favorite: z.boolean().optional(),
  archived: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: Params) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  const { id } = await params;

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректный запрос" },
      { status: 400 },
    );
  }

  const existing = await db.project.findFirst({
    where: { id, userId: session.sub },
  });
  if (!existing) {
    return NextResponse.json({ error: "Воркспейс не найден" }, { status: 404 });
  }

  const type = existing.type as WorkspaceKind;
  const stages = WORKSPACE_STAGES[type] ?? WORKSPACE_STAGES.universal;

  // stageIndex по названию стадии — согласованно с пайплайном типа.
  let { stage, stageIndex } = parsed.data;
  if (stage !== undefined) {
    stage = canonicalStageLabel(stage);
  }
  if (stage !== undefined && stageIndex === undefined) {
    const idx = pipelineStageIndex(stages, stage);
    stageIndex = idx >= 0 ? idx + 1 : undefined;
  }
  if (stageIndex !== undefined && stage === undefined) {
    stage = stages[Math.min(stageIndex, stages.length) - 1];
  }

  const project = await db.project.update({
    where: { id },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.description !== undefined
        ? { description: parsed.data.description }
        : {}),
      ...(stage !== undefined ? { stage } : {}),
      ...(stageIndex !== undefined ? { stageIndex } : {}),
      ...(parsed.data.progress !== undefined
        ? { progress: parsed.data.progress }
        : {}),
      ...(parsed.data.favorite !== undefined
        ? { favorite: parsed.data.favorite }
        : {}),
      ...(parsed.data.archived !== undefined
        ? { archived: parsed.data.archived }
        : {}),
    },
  });

  return NextResponse.json({
    workspace: workspaceDto(project, await workspaceCounts(project.id)),
  });
}

/* ── DELETE /api/workspaces/[id] ── */

export async function DELETE(req: Request, { params }: Params) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  const { id } = await params;

  const existing = await db.project.findFirst({
    where: { id, userId: session.sub },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Воркспейс не найден" }, { status: 404 });
  }

  await db.project.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
