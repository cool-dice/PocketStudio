// GET /api/admin/audit?limit=50 — recent audit trail (who did what, when).
// → { entries: [{id, action, entity, entityId, createdAt, user | null}] }

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const limitRaw = url.searchParams.get("limit");
  let limit = 50;
  if (limitRaw !== null && limitRaw !== "") {
    const n = Number(limitRaw);
    if (!Number.isInteger(n) || n < 1 || n > 200) {
      return NextResponse.json(
        { error: "Параметр limit должен быть целым числом от 1 до 200" },
        { status: 400 },
      );
    }
    limit = n;
  }

  const entries = await db.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      user: { select: { name: true, email: true } },
    },
  });

  return NextResponse.json({
    entries: entries.map((e) => ({
      id: e.id,
      action: e.action,
      entity: e.entity,
      entityId: e.entityId,
      createdAt: e.createdAt.toISOString(),
      user: e.user
        ? { name: e.user.name, email: e.user.email }
        : null,
    })),
  });
}
