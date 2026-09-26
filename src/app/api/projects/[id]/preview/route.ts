import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { diskFilesWhere } from "@/lib/project-api";
import { listWorkspaceTree, projectRoot, readWorkspaceFile } from "@/lib/workspace";
import { injectPreviewInspect } from "@/lib/preview-inspect";
import { PREVIEW_HTML_HINT, PREVIEW_LISTING_HINT } from "@/lib/studio-copy";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/projects/[id]/preview
 * Static iframe preview: prefers public/index.html, then index.html, then
 * a generated listing. Not a running Next dev server.
 */
export async function GET(req: Request, { params }: Params) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  const { id } = await params;
  const project = await db.project.findFirst({
    where: diskFilesWhere(id, session.sub),
    select: { id: true, name: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Проект не найден" }, { status: 404 });
  }

  const url = new URL(req.url);
  const fileParam = url.searchParams.get("file");
  const root = projectRoot(project.id);

  if (fileParam) {
    try {
      const file = await readWorkspaceFile(root, fileParam);
      const html = fileParam.endsWith(".html")
        ? injectPreviewInspect(file.content)
        : file.content;
      return new NextResponse(html, {
        headers: {
          "content-type": guessType(fileParam),
          "x-preview-kind": "file",
        },
      });
    } catch {
      return NextResponse.json({ error: "Файл не найден" }, { status: 404 });
    }
  }

  const tree = await listWorkspaceTree(root);
  const files = tree.entries.filter((e) => e.type === "file").map((e) => e.path);
  const index =
    files.find((p) => p === "public/index.html") ??
    files.find((p) => p === "index.html") ??
    files.find((p) => p.endsWith("/index.html"));

  if (index) {
    try {
      const file = await readWorkspaceFile(root, index);
      return NextResponse.json({
        kind: "html",
        running: false,
        file: index,
        src: `/api/projects/${id}/preview?file=${encodeURIComponent(index)}`,
        hint: PREVIEW_HTML_HINT,
      });
    } catch {
      // fall through to listing
    }
  }

  return NextResponse.json({
    kind: "listing",
    running: false,
    file: null,
    src: null,
    files: files.slice(0, 80),
    hint: PREVIEW_LISTING_HINT,
  });
}

function guessType(path: string): string {
  if (path.endsWith(".html")) return "text/html; charset=utf-8";
  if (path.endsWith(".css")) return "text/css; charset=utf-8";
  if (path.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".json")) return "application/json";
  return "text/plain; charset=utf-8";
}
