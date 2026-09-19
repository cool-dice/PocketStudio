import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { workspaceCounts, workspaceDto } from "@/lib/workspace-shapes";
import { WORKSPACE_STAGES } from "@/lib/workspace-data";
import type { WorkspaceKind } from "@/lib/workspace-types";
import { ensureCodeWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

/* ── GET /api/workspaces — список воркспейсов ── */

export async function GET(req: Request) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const projects = await db.project.findMany({
    where: { userId: session.sub, origin: "workspace" },
    orderBy: { updatedAt: "desc" },
  });

  const shaped = await Promise.all(
    projects.map(async (p) => workspaceDto(p, await workspaceCounts(p.id))),
  );

  return NextResponse.json({ workspaces: shaped });
}

/* ── POST /api/workspaces — создать воркспейс ── */

const createSchema = z.object({
  type: z.enum(["film", "book", "music", "app", "universal"]),
  name: z
    .string()
    .trim()
    .min(1, "Название не может быть пустым")
    .max(80, "Название не может превышать 80 символов"),
  description: z
    .string()
    .trim()
    .max(500, "Описание не может превышать 500 символов")
    .optional(),
});

export async function POST(req: Request) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректный запрос" },
      { status: 400 },
    );
  }
  const { type, name, description } = parsed.data;

  const stage = WORKSPACE_STAGES[type as WorkspaceKind][0];
  const project = await db.project.create({
    data: {
      userId: session.sub,
      name,
      description: description || null,
      origin: "workspace",
      type,
      stage,
      stageIndex: 1,
      progress: 0,
    },
  });

  if (type === "app") {
    try {
      const root = await ensureCodeWorkspace(project.id);
      await db.project.update({
        where: { id: project.id },
        data: { rootPath: root },
      });
    } catch (err) {
      console.error(
        "[workspaces] code scaffold failed:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  return NextResponse.json(
    { workspace: workspaceDto(project, await workspaceCounts(project.id)) },
    { status: 201 },
  );
}
