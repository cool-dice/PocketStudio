import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { ensureWorkspace } from "@/lib/workspace-api";
import { emptyTimeline, parseTimeline, tryParseTimeline } from "@/lib/nle-model";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  const { id } = await params;
  const check = await ensureWorkspace(req, id);
  if (!check.ok) return check.response;
  let row = await db.videoProject.findUnique({ where: { projectId: id } });
  if (!row) {
    const empty = emptyTimeline();
    row = await db.videoProject.create({
      data: {
        projectId: id,
        fps: empty.fps,
        timeline: JSON.stringify(empty),
      },
    });
  }
  return NextResponse.json({
    timeline: parseTimeline(row.timeline),
    fps: row.fps,
    updatedAt: row.updatedAt.toISOString(),
  });
}

const putSchema = z.object({
  fps: z.number().int().min(12).max(60).optional(),
  timeline: z.unknown(),
});

export async function PUT(req: Request, { params }: Params) {
  const { id } = await params;
  const check = await ensureWorkspace(req, id);
  if (!check.ok) return check.response;
  const parsed = putSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректный запрос" },
      { status: 400 },
    );
  }
  const normalized = tryParseTimeline(parsed.data.timeline ?? emptyTimeline());
  if (!normalized) {
    return NextResponse.json(
      { error: "Некорректный таймлайн — не сохраняю, чтобы не затереть монтаж" },
      { status: 400 },
    );
  }
  const timeline = JSON.stringify(normalized);
  const fps = parsed.data.fps ?? normalized.fps;
  const row = await db.videoProject.upsert({
    where: { projectId: id },
    create: { projectId: id, fps, timeline },
    update: { fps, timeline },
  });
  return NextResponse.json({
    timeline: parseTimeline(row.timeline),
    fps: row.fps,
    updatedAt: row.updatedAt.toISOString(),
  });
}
