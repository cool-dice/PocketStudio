import { NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody } from "@/lib/json-body-limit";

import { db } from "@/lib/db";
import { ensureWorkspace } from "@/lib/workspace-api";
import { documentDto } from "@/lib/workspace-shapes";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/* ── GET /api/workspaces/[id]/documents — документы воркспейса ── */

export async function GET(req: Request, { params }: Params) {
  const { id } = await params;
  const check = await ensureWorkspace(req, id);
  if (!check.ok) return check.response;

  const documents = await db.document.findMany({
    where: { projectId: id },
    orderBy: { updatedAt: "desc" },
    include: { sections: { select: { content: true } } },
  });

  return NextResponse.json({
    documents: documents.map((d) => documentDto(d)),
  });
}

/* ── POST /api/workspaces/[id]/documents — создать документ ── */

const createSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Название не может быть пустым")
    .max(120, "Название не может превышать 120 символов"),
  description: z.string().trim().max(500).optional(),
  kind: z.enum(["manuscript", "spec", "article", "script"]).optional(),
});

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const check = await ensureWorkspace(req, id);
  if (!check.ok) return check.response;

  const jsonRead = await readJsonBody(req, { fallback: {} });
  if (!jsonRead.ok) return jsonRead.response;
  const parsed = createSchema.safeParse(jsonRead.value);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректный запрос" },
      { status: 400 },
    );
  }

  const document = await db.document.create({
    data: {
      projectId: id,
      title: parsed.data.title,
      description: parsed.data.description || null,
      kind: parsed.data.kind ?? (check.kind === "app" ? "spec" : "manuscript"),
      sections: {
        create: { title: "Глава 1", order: 0, content: "" },
      },
    },
    include: { sections: { orderBy: { order: "asc" } } },
  });

  return NextResponse.json({ document: documentDto(document) }, { status: 201 });
}
