import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { ensureOwned } from "@/lib/workspace-api";
import { entityDto } from "@/lib/workspace-shapes";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/* ── GET /api/entities/[id] ── */

export async function GET(req: Request, { params }: Params) {
  const { id } = await params;
  const entityRow = await db.entity.findUnique({
    where: { id },
    include: {
      linksFrom: { select: { toId: true } },
      linksTo: { select: { fromId: true } },
    },
  });
  const check = await ensureOwned(req, entityRow);
  if (!check.ok) return check.response;
  const entity = check.row;

  const related = [
    ...entity.linksFrom.map((l) => l.toId),
    ...entity.linksTo.map((l) => l.fromId),
  ];
  return NextResponse.json({ entity: entityDto(entity, related) });
}

/* ── PATCH /api/entities/[id] — правка сущности ── */

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  short: z.string().trim().max(200).nullable().optional(),
  description: z.string().max(20_000).optional(),
  attributes: z
    .array(z.object({ label: z.string().max(60), value: z.string().max(300) }))
    .max(20)
    .optional(),
  tags: z.array(z.string().max(40)).max(12).optional(),
  portrait: z
    .object({ gradient: z.string().max(200), initials: z.string().max(4) })
    .nullable()
    .optional(),
  favorite: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const entityRow = await db.entity.findUnique({ where: { id } });
  const check = await ensureOwned(req, entityRow);
  if (!check.ok) return check.response;
  const entity = check.row;

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректный запрос" },
      { status: 400 },
    );
  }
  const data = parsed.data;

  const updated = await db.entity.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.short !== undefined ? { short: data.short } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.attributes !== undefined
        ? { attributes: JSON.stringify(data.attributes) }
        : {}),
      ...(data.tags !== undefined ? { tags: JSON.stringify(data.tags) } : {}),
      ...(data.portrait !== undefined
        ? { portrait: data.portrait ? JSON.stringify(data.portrait) : null }
        : {}),
      ...(data.favorite !== undefined ? { favorite: data.favorite } : {}),
    },
    include: { linksFrom: { select: { toId: true } } },
  });

  return NextResponse.json({
    entity: entityDto(updated, updated.linksFrom.map((l) => l.toId)),
  });
}

/* ── DELETE /api/entities/[id] ── */

export async function DELETE(req: Request, { params }: Params) {
  const { id } = await params;
  const entityRow = await db.entity.findUnique({ where: { id } });
  const check = await ensureOwned(req, entityRow);
  if (!check.ok) return check.response;
  const entity = check.row;

  await db.entity.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
