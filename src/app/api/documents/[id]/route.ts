import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { ensureOwned } from "@/lib/workspace-api";
import { documentDto } from "@/lib/workspace-shapes";
import { scheduleRemove } from "@/lib/rag";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/* ── GET /api/documents/[id] — документ с секциями ── */

export async function GET(req: Request, { params }: Params) {
  const { id } = await params;
  const documentRow = await db.document.findUnique({
    where: { id },
    include: { sections: { orderBy: { order: "asc" } } },
  });
  const check = await ensureOwned(req, documentRow);
  if (!check.ok) return check.response;
  const document = check.row;

  return NextResponse.json({ document: documentDto(document) });
}

/* ── PATCH /api/documents/[id] — название/описание ── */

const patchSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).nullable().optional(),
});

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const documentRow = await db.document.findUnique({ where: { id } });
  const check = await ensureOwned(req, documentRow);
  if (!check.ok) return check.response;
  const document = check.row;

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректный запрос" },
      { status: 400 },
    );
  }

  const updated = await db.document.update({
    where: { id },
    data: {
      ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
      ...(parsed.data.description !== undefined
        ? { description: parsed.data.description }
        : {}),
    },
    include: { sections: { orderBy: { order: "asc" } } },
  });

  return NextResponse.json({ document: documentDto(updated) });
}

/* ── DELETE /api/documents/[id] ── */

export async function DELETE(req: Request, { params }: Params) {
  const { id } = await params;
  const documentRow = await db.document.findUnique({ where: { id } });
  const check = await ensureOwned(req, documentRow);
  if (!check.ok) return check.response;
  const document = check.row;

  const sections = await db.documentSection.findMany({
    where: { documentId: id },
    select: { id: true },
  });
  await db.document.delete({ where: { id } });
  for (const section of sections) {
    scheduleRemove(db, check.userId, "section", section.id);
  }
  return NextResponse.json({ ok: true });
}
