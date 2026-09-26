import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { ensureWorkspace } from "@/lib/workspace-api";
import { findingDto } from "@/lib/workspace-shapes";

export const dynamic = "force-dynamic";

/* ── GET /api/findings?projectId=&status= — находки Аналитика ── */

export async function GET(req: Request) {
  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "Не указан projectId" }, { status: 400 });
  }
  const status = url.searchParams.get("status");
  const check = await ensureWorkspace(req, projectId);
  if (!check.ok) return check.response;

  const findings = await db.finding.findMany({
    where: {
      projectId,
      ...(status ? { status } : {}),
    },
    orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
    take: 200,
  });

  return NextResponse.json({ findings: findings.map(findingDto) });
}
