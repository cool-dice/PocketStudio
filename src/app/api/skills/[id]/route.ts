import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { skillDto } from "@/lib/skill-shapes";
import { scheduleIndexSkill, scheduleRemove } from "@/lib/rag";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

async function ownedSkill(req: Request, id: string) {
  const session = await getUserFromRequest(req);
  if (!session) return { error: NextResponse.json({ error: "Требуется авторизация" }, { status: 401 }) };
  const row = await db.skill.findFirst({ where: { id, userId: session.sub } });
  if (!row) return { error: NextResponse.json({ error: "Скилл не найден" }, { status: 404 }) };
  return { session, row };
}

export async function GET(req: Request, { params }: Params) {
  const { id } = await params;
  const found = await ownedSkill(req, id);
  if ("error" in found && found.error) return found.error;
  return NextResponse.json({ skill: skillDto(found.row!) });
}

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(400).optional(),
  skillMd: z.string().trim().min(8).max(20_000).optional(),
  triggers: z.array(z.string().trim().min(1).max(80)).max(12).optional(),
  enabled: z.boolean().optional(),
  icon: z.string().trim().max(40).optional(),
});

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const found = await ownedSkill(req, id);
  if ("error" in found && found.error) return found.error;
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректный запрос" },
      { status: 400 },
    );
  }
  const row = await db.skill.update({
    where: { id },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.description !== undefined
        ? { description: parsed.data.description }
        : {}),
      ...(parsed.data.skillMd !== undefined ? { skillMd: parsed.data.skillMd } : {}),
      ...(parsed.data.triggers !== undefined
        ? { triggers: JSON.stringify(parsed.data.triggers) }
        : {}),
      ...(parsed.data.enabled !== undefined ? { enabled: parsed.data.enabled } : {}),
      ...(parsed.data.icon !== undefined ? { icon: parsed.data.icon } : {}),
    },
  });
  scheduleIndexSkill(db, row.id);
  return NextResponse.json({ skill: skillDto(row) });
}

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const found = await ownedSkill(req, id);
  if ("error" in found && found.error) return found.error;
  const source = found.row!;
  const copy = await db.skill.create({
    data: {
      userId: source.userId,
      name: `${source.name} (копия)`,
      description: source.description,
      version: source.version,
      source: "created",
      skillMd: source.skillMd,
      triggers: source.triggers,
      icon: source.icon,
      enabled: true,
      purchased: true,
    },
  });
  scheduleIndexSkill(db, copy.id);
  return NextResponse.json({ skill: skillDto(copy) }, { status: 201 });
}

export async function DELETE(req: Request, { params }: Params) {
  const { id } = await params;
  const found = await ownedSkill(req, id);
  if ("error" in found) return found.error;
  await db.skill.delete({ where: { id } });
  scheduleRemove(db, found.session.sub, "skill", id);
  return NextResponse.json({ ok: true });
}
