import { NextResponse } from "next/server";
import { promises as fsp } from "node:fs";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { codeProjectWhere } from "@/lib/project-api";
import { exportProjectZip, projectRoot, WorkspaceError } from "@/lib/workspace";

export const dynamic = "force-dynamic";

/* ── GET /api/projects/[id]/export — download the project as a zip ── */

/** RFC-5987-safe filename: ASCII fallback + UTF-8 encoded value. */
function contentDisposition(name: string): string {
  const ascii =
    name
      .normalize("NFKD")
      .replace(/[^\w.-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "project";
  const utf8 = encodeURIComponent(name).replace(/["\\]/g, "");
  return `attachment; filename="pocketstudio-${ascii}.zip"; filename*=UTF-8''pocketstudio-${utf8}.zip`;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  const { id } = await params;

  const project = await db.project.findFirst({
    where: codeProjectWhere(id, session.sub),
  });
  if (!project) {
    return NextResponse.json({ error: "Проект не найден" }, { status: 404 });
  }

  let zipPath: string;
  try {
    zipPath = await exportProjectZip(projectRoot(project.id));
  } catch (err) {
    if (err instanceof WorkspaceError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: "Не удалось упаковать проект" },
      { status: 500 },
    );
  }

  try {
    const data = await fsp.readFile(zipPath);
    return new NextResponse(new Uint8Array(data), {
      status: 200,
      headers: {
        "content-type": "application/zip",
        "content-disposition": contentDisposition(project.name),
        "content-length": String(data.byteLength),
        "cache-control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Не удалось прочитать архив" },
      { status: 500 },
    );
  } finally {
    void fsp.rm(zipPath, { force: true }).catch(() => {});
  }
}
