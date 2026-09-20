import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { WORKSPACE_OR_CODE_NOT_FOUND, WORKSPACE_OR_CODE_PICK } from "@/lib/composer-binding";
import { readJsonBody } from "@/lib/json-body-limit";

export const dynamic = "force-dynamic";

const linkSchema = z.object({
  projectId: z.string().trim().min(1, WORKSPACE_OR_CODE_PICK),
  kind: z.enum(["reference", "context", "proposal"]).optional(),
});

function projectRef(p: {
  id: string;
  name: string;
  origin: string;
  type: string | null;
}) {
  return { id: p.id, name: p.name, origin: p.origin, type: p.type };
}

/* ── GET /api/notes/[id]/links — projects linked to a note ── */

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  const { id } = await params;

  const note = await db.note.findFirst({ where: { id, userId: session.sub } });
  if (!note) {
    return NextResponse.json({ error: "Заметка не найдена" }, { status: 404 });
  }

  const links = await db.noteLink.findMany({
    where: { noteId: note.id },
    include: {
      project: { select: { id: true, name: true, origin: true, type: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    links: links.map((l) => ({
      id: l.id,
      kind: l.kind,
      project: projectRef(l.project),
    })),
  });
}

/* ── POST /api/notes/[id]/links — link note to an owned project ── */

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  const { id } = await params;

  const note = await db.note.findFirst({ where: { id, userId: session.sub } });
  if (!note) {
    return NextResponse.json({ error: "Заметка не найдена" }, { status: 404 });
  }

  const jsonRead = await readJsonBody(req, { fallback: {} });
  if (!jsonRead.ok) return jsonRead.response;
  const body = jsonRead.value;
  const parsed = linkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Ошибка валидации" },
      { status: 400 },
    );
  }

  const project = await db.project.findFirst({
    where: { id: parsed.data.projectId, userId: session.sub },
  });
  if (!project) {
    return NextResponse.json(
      { error: WORKSPACE_OR_CODE_NOT_FOUND },
      { status: 404 },
    );
  }

  const link = await db.noteLink.create({
    data: {
      noteId: note.id,
      projectId: project.id,
      kind: parsed.data.kind ?? "reference",
    },
  });

  return NextResponse.json(
    {
      link: {
        id: link.id,
        kind: link.kind,
        project: projectRef(project),
      },
    },
    { status: 201 },
  );
}

/* ── DELETE /api/notes/[id]/links?projectId=… — unlink ── */

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  const { id } = await params;

  const note = await db.note.findFirst({ where: { id, userId: session.sub } });
  if (!note) {
    return NextResponse.json({ error: "Заметка не найдена" }, { status: 404 });
  }

  const projectId = new URL(req.url).searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "Параметр projectId обязателен" }, { status: 400 });
  }

  await db.noteLink.deleteMany({ where: { noteId: note.id, projectId } });
  return NextResponse.json({ ok: true });
}
