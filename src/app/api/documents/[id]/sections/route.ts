import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { ensureOwned } from "@/lib/workspace-api";
import { sectionDto } from "@/lib/workspace-shapes";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/* ── POST /api/documents/[id]/sections — добавить главу/раздел ── */

const createSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Название не может быть пустым")
    .max(120, "Название не может превышать 120 символов"),
});

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const documentRow = await db.document.findUnique({
    where: { id },
    include: { sections: { select: { order: true } } },
  });
  const check = await ensureOwned(req, documentRow);
  if (!check.ok) return check.response;
  const document = check.row;

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректный запрос" },
      { status: 400 },
    );
  }

  const order = document.sections.reduce((max, s) => Math.max(max, s.order), -1) + 1;
  const section = await db.documentSection.create({
    data: {
      documentId: id,
      title: parsed.data.title,
      order,
    },
  });

  return NextResponse.json({ section: sectionDto(section) }, { status: 201 });
}
