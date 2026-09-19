import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { listMentionSections } from "@/lib/entity-mentions";
import { ensureWorkspace } from "@/lib/workspace-api";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/* ── GET /api/workspaces/[id]/sections — главы для привязки упоминаний ── */

export async function GET(req: Request, { params }: Params) {
  const { id } = await params;
  const check = await ensureWorkspace(req, id);
  if (!check.ok) return check.response;

  const sections = await listMentionSections(db, id);
  return NextResponse.json({ sections });
}
