import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { findOwnedCodeProject } from "@/lib/project-api";
import {
  WorkspaceError,
  projectRoot,
  projectStats,
  removeProjectDir,
} from "@/lib/workspace";
import { readJsonBody } from "@/lib/json-body-limit";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  name: z.string().trim().min(1, "Название не может быть пустым").max(80).optional(),
  description: z.string().trim().max(500).optional(),
});

async function getOwnedProject(id: string, userId: string) {
  return findOwnedCodeProject(id, userId);
}

/* ── GET /api/projects/[id] — detail with stats ── */

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  const { id } = await params;

  const project = await getOwnedProject(id, session.sub);
  if (!project) {
    return NextResponse.json({ error: "Проект не найден" }, { status: 404 });
  }

  let stats = { filesCount: 0, commitsCount: 0, lastCommit: null as never };
  try {
    stats = (await projectStats(projectRoot(project.id))) as typeof stats;
  } catch {
    // workspace dir missing → zeros
  }

  const linkedNotes = await db.noteLink.findMany({
    where: { projectId: project.id },
    include: {
      note: {
        select: {
          id: true,
          rawText: true,
          status: true,
          category: { select: { id: true, name: true, color: true, icon: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
      origin: project.origin,
      remoteUrl: project.remoteUrl,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      stats,
      notes: linkedNotes.map((l) => ({
        id: l.note.id,
        preview: (l.note.rawText ?? "").replace(/\s+/g, " ").slice(0, 120),
        status: l.note.status,
        category: l.note.category,
        linkKind: l.kind,
      })),
    },
  });
}

/* ── PATCH /api/projects/[id] — rename / edit description ── */

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  const { id } = await params;

  const project = await getOwnedProject(id, session.sub);
  if (!project) {
    return NextResponse.json({ error: "Проект не найден" }, { status: 404 });
  }

  const jsonRead = await readJsonBody(req, { fallback: {} });
  if (!jsonRead.ok) return jsonRead.response;
  const body = jsonRead.value;
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ошибка валидации" }, { status: 400 });
  }

  const updated = await db.project.update({
    where: { id: project.id },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.description !== undefined
        ? { description: parsed.data.description }
        : {}),
    },
  });

  return NextResponse.json({
    project: {
      id: updated.id,
      name: updated.name,
      description: updated.description,
      origin: updated.origin,
      remoteUrl: updated.remoteUrl,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
}

/* ── DELETE /api/projects/[id] — remove row + workspace dir ── */

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  const { id } = await params;

  const project = await getOwnedProject(id, session.sub);
  if (!project) {
    return NextResponse.json({ error: "Проект не найден" }, { status: 404 });
  }

  try {
    await removeProjectDir(project.id);
  } catch (err) {
    if (err instanceof WorkspaceError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    // Disk removal is best-effort: DB cascade still clears relations.
  }
  await db.project.delete({ where: { id: project.id } });

  return NextResponse.json({ ok: true });
}
