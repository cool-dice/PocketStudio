import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { BUILTIN_SKILLS } from "@/lib/skills-catalog";
import { skillDto, storeDtos } from "@/lib/skill-shapes";
import { scheduleIndexSkill } from "@/lib/rag";

export const dynamic = "force-dynamic";

async function ensureBuiltinSkills(userId: string): Promise<void> {
  const existing = await db.skill.findMany({
    where: { userId, catalogKey: { not: null } },
    select: { catalogKey: true },
  });
  const have = new Set(existing.map((r) => r.catalogKey));
  for (const item of BUILTIN_SKILLS) {
    if (have.has(item.key)) continue;
    await db.skill.create({
      data: {
        userId,
        catalogKey: item.key,
        name: item.name,
        description: item.description,
        version: item.version,
        source: "builtin",
        skillMd: item.skillMd,
        triggers: JSON.stringify(item.triggers),
        icon: item.icon,
        enabled: item.defaultEnabled ?? true,
        purchased: true,
      },
    });
  }
}

export async function GET(req: Request) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  await ensureBuiltinSkills(session.sub);
  const rows = await db.skill.findMany({
    where: { userId: session.sub },
    orderBy: { createdAt: "asc" },
  });
  const owned = new Set(
    rows.map((r) => r.catalogKey).filter((k): k is string => Boolean(k)),
  );

  return NextResponse.json({
    skills: rows.map(skillDto),
    store: storeDtos(owned),
  });
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(400).optional(),
  skillMd: z.string().trim().min(8).max(20_000),
  triggers: z.array(z.string().trim().min(1).max(80)).max(12).optional(),
  icon: z.string().trim().max(40).optional(),
  version: z.string().trim().max(20).optional(),
});

export async function POST(req: Request) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректный запрос" },
      { status: 400 },
    );
  }
  const row = await db.skill.create({
    data: {
      userId: session.sub,
      name: parsed.data.name,
      description: parsed.data.description ?? "",
      skillMd: parsed.data.skillMd,
      triggers: JSON.stringify(parsed.data.triggers ?? []),
      icon: parsed.data.icon ?? "Wand2",
      version: parsed.data.version ?? "1.0",
      source: "created",
      enabled: true,
      purchased: true,
    },
  });
  scheduleIndexSkill(db, row.id);
  return NextResponse.json({ skill: skillDto(row) }, { status: 201 });
}
