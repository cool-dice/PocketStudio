import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { ensureWorkspace } from "@/lib/workspace-api";
import { entityDto } from "@/lib/workspace-shapes";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/* ── GET /api/workspaces/[id]/entities — сущности воркспейса ── */

export async function GET(req: Request, { params }: Params) {
  const { id } = await params;
  const check = await ensureWorkspace(req, id);
  if (!check.ok) return check.response;

  const entities = await db.entity.findMany({
    where: { projectId: id },
    orderBy: { updatedAt: "desc" },
    include: { linksFrom: { select: { toId: true } } },
  });

  return NextResponse.json({
    entities: entities.map((e) =>
      entityDto(e, e.linksFrom.map((l) => l.toId)),
    ),
  });
}

/* ── POST /api/workspaces/[id]/entities — создать сущность ── */

const createSchema = z.object({
  setId: z.string().trim().max(60).optional(),
  setName: z.string().trim().max(120).optional(),
  domain: z.enum(["narrative", "product"]).optional(),
  kind: z.enum([
    "character", "location", "event", "item", "faction", "rule",
    "user", "role", "requirement", "module", "integration",
  ]),
  name: z
    .string()
    .trim()
    .min(1, "Название не может быть пустым")
    .max(120, "Название не может превышать 120 символов"),
  short: z.string().trim().max(200).optional(),
  description: z.string().max(20_000).optional(),
  attributes: z
    .array(z.object({ label: z.string().max(60), value: z.string().max(300) }))
    .max(20)
    .optional(),
  tags: z.array(z.string().max(40)).max(12).optional(),
  portrait: z
    .object({ gradient: z.string().max(200), initials: z.string().max(4) })
    .optional(),
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

  const entity = await db.entity.create({
    data: {
      projectId: id,
      setId: data.setId || "main",
      setName: data.setName || "Сущности",
      domain: data.domain ?? (check.kind === "app" ? "product" : "narrative"),
      kind: data.kind,
      name: data.name,
      short: data.short || null,
      description: data.description || "",
      attributes: JSON.stringify(data.attributes ?? []),
      tags: JSON.stringify(data.tags ?? []),
      portrait: data.portrait ? JSON.stringify(data.portrait) : null,
    },
  });

  return NextResponse.json({ entity: entityDto(entity) }, { status: 201 });
}
