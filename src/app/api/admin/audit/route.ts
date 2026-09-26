// GET /api/admin/audit?limit=30&offset=0 — recent audit trail.
// → { entries, hasMore }. Never returns meta / API keys.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import {
  AUDIT_LOAD_ERROR,
  auditPageHasMore,
  parseAuditPage,
  toPublicAuditEntry,
} from "@/lib/audit-copy";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const page = parseAuditPage(
    url.searchParams.get("limit"),
    url.searchParams.get("offset"),
  );
  if (!page.ok) {
    return NextResponse.json({ error: page.error }, { status: 400 });
  }

  let rows;
  try {
    rows = await db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: page.offset,
      take: page.limit + 1,
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
      },
    });
  } catch {
    console.error("[admin/audit] failed");
    return NextResponse.json({ error: AUDIT_LOAD_ERROR }, { status: 500 });
  }

  const hasMore = auditPageHasMore(rows.length, page.limit);
  const slice = hasMore ? rows.slice(0, page.limit) : rows;
  return NextResponse.json({
    entries: slice.map(toPublicAuditEntry),
    hasMore,
  });
}
