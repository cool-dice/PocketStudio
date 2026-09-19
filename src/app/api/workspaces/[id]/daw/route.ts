import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { defaultDawState, normalizeDawState, type DawProjectDto } from "@/lib/daw-model";
import { ensureWorkspace } from "@/lib/workspace-api";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

type DawRow = {
  id: string;
  projectId: string;
  bpm: number;
  bars: number;
  masterVolume: number;
  transpose: number;
  metronome: boolean;
  tracks: string;
  updatedAt: Date;
};

function rowToDto(row: DawRow): DawProjectDto {
  const state = normalizeDawState({
    bpm: row.bpm,
    bars: row.bars,
    masterVolume: row.masterVolume,
    transpose: row.transpose,
    metronome: row.metronome,
    tracks: JSON.parse(row.tracks || "[]"),
  });
  return {
    id: row.id,
    projectId: row.projectId,
    ...(state ?? defaultDawState()),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/* ── GET /api/workspaces/[id]/daw — состояние DAW (get-or-create) ── */

export async function GET(req: Request, { params }: Params) {
  const { id } = await params;
  const check = await ensureWorkspace(req, id);
  if (!check.ok) return check.response;

  const existing = await db.dawProject.findUnique({ where: { projectId: id } });
  if (existing) {
    return NextResponse.json({ project: rowToDto(existing) });
  }

  const seed = defaultDawState();
  const created = await db.dawProject.create({
    data: {
      projectId: id,
      bpm: seed.bpm,
      bars: seed.bars,
      masterVolume: seed.masterVolume,
      transpose: seed.transpose,
      metronome: seed.metronome,
      tracks: JSON.stringify(seed.tracks),
    },
  });
  return NextResponse.json({ project: rowToDto(created) });
}

/* ── PUT /api/workspaces/[id]/daw — сохранить состояние DAW ── */

export async function PUT(req: Request, { params }: Params) {
  const { id } = await params;
  const check = await ensureWorkspace(req, id);
  if (!check.ok) return check.response;

  const state = normalizeDawState(await req.json().catch(() => null));
  if (!state) {
    return NextResponse.json(
      { error: "Некорректное состояние студии" },
      { status: 400 },
    );
  }

  const data = {
    bpm: state.bpm,
    bars: state.bars,
    masterVolume: state.masterVolume,
    transpose: state.transpose,
    metronome: state.metronome,
    tracks: JSON.stringify(state.tracks),
  };
  const row = await db.dawProject.upsert({
    where: { projectId: id },
    update: data,
    create: { projectId: id, ...data },
  });
  return NextResponse.json({ project: rowToDto(row) });
}
