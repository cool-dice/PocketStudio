import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { AI_TOOLS } from "@/lib/ai/tools";
import { providerDto } from "@/lib/ai/dto";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const [platform, own, overrides] = await Promise.all([
    db.aiProvider.findMany({
      where: { userId: null, enabled: true, visibleToUsers: true },
      include: { models: { where: { enabled: true }, orderBy: { createdAt: "asc" } } },
      orderBy: { name: "asc" },
    }),
    db.aiProvider.findMany({
      where: { userId: session.sub },
      include: { models: { orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "asc" },
    }),
    db.userToolModel.findMany({
      where: { userId: session.sub },
    }),
  ]);

  const overrideByTool = new Map(overrides.map((o) => [o.toolId, o.modelId]));

  return NextResponse.json({
    tools: AI_TOOLS.map((t) => ({
      ...t,
      modelId: overrideByTool.has(t.id) ? overrideByTool.get(t.id) ?? null : null,
      useStudioDefault: !overrideByTool.has(t.id) || overrideByTool.get(t.id) == null,
    })),
    platformProviders: platform.map((p) => ({
      ...providerDto(p),
      extraHeaders: null,
    })),
    ownProviders: own.map(providerDto),
  });
}
