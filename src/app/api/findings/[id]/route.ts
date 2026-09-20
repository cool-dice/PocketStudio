import { NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody } from "@/lib/json-body-limit";

import { db } from "@/lib/db";
import { ensureOwned } from "@/lib/workspace-api";
import { findingDto } from "@/lib/workspace-shapes";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/* ── PATCH /api/findings/[id] — статус находки (исправлено/отклонено) ── */

const patchSchema = z.object({
  status: z.enum(["open", "fixed", "dismissed"]),
});

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const findingRow = await db.finding.findUnique({ where: { id } });
  const check = await ensureOwned(req, findingRow);
  if (!check.ok) return check.response;
  const finding = check.row;

  const jsonRead = await readJsonBody(req, { fallback: {} });
  if (!jsonRead.ok) return jsonRead.response;
  const parsed = patchSchema.safeParse(jsonRead.value);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректный запрос" },
      { status: 400 },
    );
  }

  const updated = await db.finding.update({
    where: { id },
    data: { status: parsed.data.status },
  });

  return NextResponse.json({ finding: findingDto(updated) });
}
