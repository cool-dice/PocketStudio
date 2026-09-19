import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  const tags = await db.tag.findMany({
    where: { userId: session.sub },
    include: { _count: { select: { notes: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({
    tags: tags.map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      noteCount: t._count.notes,
    })),
  });
}
