import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { scheduleIndexArtifact, scheduleRemove } from "@/lib/rag";
import { unlinkGeneratedFile } from "@/lib/gen-files";
import { ensureOwned } from "@/lib/workspace-api";
import { artifactDto } from "@/lib/workspace-shapes";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/* ── PATCH /api/artifacts/[id] — избранное/описание/стадия ── */

const patchSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  stage: z.string().max(40).nullable().optional(),
  favorite: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const artifactRow = await db.artifact.findUnique({ where: { id } });
  const check = await ensureOwned(req, artifactRow);
  if (!check.ok) return check.response;
  const artifact = check.row;

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректный запрос" },
      { status: 400 },
    );
  }

  const updated = await db.artifact.update({
    where: { id },
    data: parsed.data,
  });

  scheduleIndexArtifact(db, updated.id);

  return NextResponse.json({ artifact: artifactDto(updated) });
}

/* ── DELETE /api/artifacts/[id] ── */

export async function DELETE(req: Request, { params }: Params) {
  const { id } = await params;
  const artifactRow = await db.artifact.findUnique({ where: { id } });
  const check = await ensureOwned(req, artifactRow);
  if (!check.ok) return check.response;
  const artifact = check.row;

  await db.artifact.delete({ where: { id } });
  unlinkGeneratedFile(artifact.url);
  scheduleRemove(db, check.userId, "artifact", id);
  return NextResponse.json({ ok: true });
}
