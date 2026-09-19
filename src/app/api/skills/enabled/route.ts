import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { skillDto } from "@/lib/skill-shapes";

export const dynamic = "force-dynamic";

/** Enabled SKILL.md bodies for the agent system prompt. */
export async function GET(req: Request) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  const rows = await db.skill.findMany({
    where: { userId: session.sub, enabled: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({
    skills: rows.map(skillDto),
    promptBlock: rows
      .map(
        (s) =>
          `### ${s.name}\nТриггеры: ${s.triggers}\n\n${s.skillMd}`,
      )
      .join("\n\n"),
  });
}
