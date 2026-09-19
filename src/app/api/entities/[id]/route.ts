import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import {
  compactAttributes,
  compactTags,
  relatedFromLinks,
  uniqueRelated,
} from "@/lib/entity-meta";
import { ensureOwned } from "@/lib/workspace-api";
import { entityDto } from "@/lib/workspace-shapes";
import { removeSource, scheduleIndexEntity } from "@/lib/rag";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const linkInclude = {
  linksFrom: { select: { toId: true } },
  linksTo: { select: { fromId: true } },
} as const;

function dtoWithLinks(entity: Parameters<typeof entityDto>[0] & {
  linksFrom: { toId: string }[];
  linksTo: { fromId: string }[];
}) {
  return entityDto(entity, relatedFromLinks(entity.linksFrom, entity.linksTo));
}

/* ── GET /api/entities/[id] ── */

export async function GET(req: Request, { params }: Params) {
  const { id } = await params;
  const entityRow = await db.entity.findUnique({
    where: { id },
    include: linkInclude,
  });
  const check = await ensureOwned(req, entityRow);
  if (!check.ok) return check.response;
  return NextResponse.json({ entity: dtoWithLinks(check.row) });
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
  related: z.array(z.string().min(1).max(64)).max(24).optional(),
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Некорректный JSON в запросе" },
      { status: 400 },
    );
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректный запрос" },
      { status: 400 },
    );
  }
  const data = parsed.data;
  const related =
    data.related !== undefined ? uniqueRelated(data.related, id) : undefined;

  if (related !== undefined && related.length > 0) {
    const peers = await db.entity.findMany({
      where: { projectId: entity.projectId, id: { in: related } },
      select: { id: true },
    });
    if (peers.length !== related.length) {
      return NextResponse.json(
        { error: "Связь указывает на сущность вне этого воркспейса" },
        { status: 400 },
      );
    }
  }

  const updated = await db.$transaction(async (tx) => {
    if (related !== undefined) {
      await tx.entityLink.deleteMany({
        where: { OR: [{ fromId: id }, { toId: id }] },
      });
      if (related.length > 0) {
        await tx.entityLink.createMany({
          data: related.map((toId) => ({
            fromId: id,
            toId,
            kind: "related",
          })),
        });
      }
    }
    return tx.entity.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.short !== undefined ? { short: data.short } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.attributes !== undefined
          ? { attributes: JSON.stringify(compactAttributes(data.attributes)) }
          : {}),
        ...(data.tags !== undefined
          ? { tags: JSON.stringify(compactTags(data.tags)) }
          : {}),
        ...(data.portrait !== undefined
          ? { portrait: data.portrait ? JSON.stringify(data.portrait) : null }
          : {}),
        ...(data.favorite !== undefined ? { favorite: data.favorite } : {}),
      },
      include: linkInclude,
    });
  });

  scheduleIndexEntity(db, updated.id);

  return NextResponse.json({ entity: dtoWithLinks(updated) });
}

/* ── DELETE /api/entities/[id] ── */

export async function DELETE(req: Request, { params }: Params) {
  const { id } = await params;
  const entityRow = await db.entity.findUnique({ where: { id } });
  const check = await ensureOwned(req, entityRow);
  if (!check.ok) return check.response;

  await db.entity.delete({ where: { id } });
  await removeSource(db, check.userId, "entity", id);
  return NextResponse.json({ ok: true });
}
