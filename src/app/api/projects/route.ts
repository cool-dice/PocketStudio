import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import {
  WorkspaceError,
  createFromGithub,
  createFromTemplate,
  createFromZip,
  initProjectGit,
  projectRoot,
  projectStats,
} from "@/lib/workspace";
import { promises as fsp } from "node:fs";
import path from "node:path";
import os from "node:os";
import { oversizedJsonResponse, readJsonBody } from "@/lib/json-body-limit";
import { CODE_PROJECT_ORIGINS } from "@/lib/code-project-origins";

export const dynamic = "force-dynamic";

const MAX_ZIP_BYTES = 20 * 1024 * 1024; // upload cap (compressed)

const createSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Название не может быть пустым")
    .max(80, "Название не может превышать 80 символов"),
  description: z.string().trim().max(500, "Описание не может превышать 500 символов").optional(),
  origin: z.enum(["template", "github"], "Недопустимый источник проекта"),
  remoteUrl: z.string().trim().optional(),
  noteId: z.string().trim().optional(),
});

function workspaceErrorResponse(err: unknown) {
  if (err instanceof WorkspaceError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error("[projects] unexpected error:", err);
  return NextResponse.json(
    { error: "Внутренняя ошибка сервера" },
    { status: 500 },
  );
}

function projectShape(p: {
  id: string;
  name: string;
  description: string | null;
  origin: string;
  remoteUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    origin: p.origin,
    remoteUrl: p.remoteUrl,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

/* ── GET /api/projects — list with stats ── */

export async function GET(req: Request) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const projects = await db.project.findMany({
    where: { userId: session.sub, origin: { in: [...CODE_PROJECT_ORIGINS] } },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { threads: true, noteLinks: true } } },
  });

  const shaped = await Promise.all(
    projects.map(async (p) => {
      let stats = { filesCount: 0, commitsCount: 0, lastCommit: null as never };
      try {
        stats = (await projectStats(projectRoot(p.id))) as typeof stats;
      } catch {
        // dir vanished (e.g. wiped externally) → zeros
      }
      return {
        ...projectShape(p),
        threadsCount: p._count.threads,
        notesLinked: p._count.noteLinks,
        stats,
      };
    }),
  );

  return NextResponse.json({ projects: shaped });
}

/* ── POST /api/projects — create (template | github | zip) ── */

export async function POST(req: Request) {
  const blocked = oversizedJsonResponse(req);
  if (blocked) return blocked;

  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const contentType = req.headers.get("content-type") ?? "";

  try {
    // ── multipart: zip import ──
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const name = String(form.get("name") ?? "").trim();
      const description = String(form.get("description") ?? "").trim() || null;
      const noteIdRaw = form.get("noteId");
      const noteId = typeof noteIdRaw === "string" && noteIdRaw.trim() ? noteIdRaw.trim() : null;
      const file = form.get("file");

      if (!name || name.length > 80) {
        return NextResponse.json(
          { error: "Название проекта обязательно (1–80 символов)" },
          { status: 400 },
        );
      }
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "Файл архива обязателен" }, { status: 400 });
      }
      if (file.size === 0 || file.size > MAX_ZIP_BYTES) {
        return NextResponse.json(
          { error: "Архив должен быть от 1 байта до 20 МБ" },
          { status: 413 },
        );
      }

      // temp zip path, then extract into the project workspace dir
      const tmp = path.join(os.tmpdir(), `vf-${Date.now()}-${Math.random().toString(36).slice(2)}.zip`);
      await fsp.writeFile(tmp, Buffer.from(await file.arrayBuffer()));

      const project = await db.project.create({
        data: {
          userId: session.sub,
          name,
          description,
          origin: "zip",
          rootPath: "",
        },
      });

      const root = projectRoot(project.id);
      try {
        await createFromZip(tmp, root);
        await initProjectGit(root, "Чекпоинт 0: проект импортирован из zip");
        await fsp.rm(tmp, { force: true });
      } catch (err) {
        await fsp.rm(tmp, { force: true });
        await fsp.rm(root, { recursive: true, force: true }).catch(() => {});
        await db.project.delete({ where: { id: project.id } }).catch(() => {});
        return workspaceErrorResponse(err);
      }

      await linkNoteAndFinish(project.id, noteId, session.sub);
      const stats = await projectStats(root);
      const updated = await db.project.update({
        where: { id: project.id },
        data: { rootPath: root },
      });
      return NextResponse.json(
        { project: { ...projectShape(updated), stats } },
        { status: 201 },
      );
    }

    // ── JSON: template | github ──
    const jsonRead = await readJsonBody(req, { fallback: {} });
    if (!jsonRead.ok) return jsonRead.response;
    const body = jsonRead.value;
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".") || "_";
        if (!fields[key]) fields[key] = issue.message;
      }
      return NextResponse.json({ error: "Ошибка валидации", fields }, { status: 400 });
    }

    const { name, description, origin, remoteUrl } = parsed.data;
    const noteId = parsed.data.noteId ?? null;

    if (origin === "github" && !remoteUrl) {
      return NextResponse.json(
        { error: "Ошибка валидации", fields: { remoteUrl: "URL репозитория обязателен" } },
        { status: 400 },
      );
    }

    const project = await db.project.create({
      data: {
        userId: session.sub,
        name,
        description: description ?? null,
        origin,
        remoteUrl: origin === "github" ? remoteUrl : null,
        rootPath: "",
      },
    });

    const root = projectRoot(project.id);
    try {
      if (origin === "template") {
        await createFromTemplate(root);
        await initProjectGit(root);
      } else {
        await createFromGithub(remoteUrl!, root);
      }
    } catch (err) {
      await fsp.rm(root, { recursive: true, force: true }).catch(() => {});
      await db.project.delete({ where: { id: project.id } }).catch(() => {});
      return workspaceErrorResponse(err);
    }

    await linkNoteAndFinish(project.id, noteId, session.sub);
    const stats = await projectStats(root);
    const updated = await db.project.update({
      where: { id: project.id },
      data: { rootPath: root },
    });
    return NextResponse.json(
      { project: { ...projectShape(updated), stats } },
      { status: 201 },
    );
  } catch (err) {
    return workspaceErrorResponse(err);
  }
}

/** Attach an optional originating note (NoteLink kind 'context'). */
async function linkNoteAndFinish(
  projectId: string,
  noteId: string | null,
  userId: string,
): Promise<void> {
  if (!noteId) return;
  const note = await db.note.findFirst({ where: { id: noteId, userId } });
  if (!note) return;
  await db.noteLink
    .create({ data: { noteId: note.id, projectId, kind: "context" } })
    .catch(() => {
      // unique [noteId, projectId] race → link already exists
    });
}
