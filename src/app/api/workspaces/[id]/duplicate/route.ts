import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { workspaceCounts, workspaceDto } from "@/lib/workspace-shapes";
import { ensureCodeWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** POST /api/workspaces/[id]/duplicate — копия метаданных, документов и артефактов. */
export async function POST(req: Request, { params }: Params) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  const { id } = await params;
  const source = await db.project.findFirst({
    where: { id, userId: session.sub },
  });
  if (!source) {
    return NextResponse.json({ error: "Воркспейс не найден" }, { status: 404 });
  }

  const copy = await db.project.create({
    data: {
      userId: session.sub,
      name: `${source.name} (копия)`,
      description: source.description,
      origin: source.origin,
      type: source.type,
      stage: source.stage,
      stageIndex: source.stageIndex,
      progress: source.progress,
      favorite: false,
      archived: false,
    },
  });

  if (source.type === "app" || source.rootPath) {
    try {
      await ensureCodeWorkspace(copy.id);
    } catch {
      // code copy is best-effort; metadata still exists
    }
  }

  const [docs, entities, artifacts, daw] = await Promise.all([
    db.document.findMany({
      where: { projectId: source.id },
      include: { sections: true },
    }),
    db.entity.findMany({ where: { projectId: source.id } }),
    db.artifact.findMany({ where: { projectId: source.id } }),
    db.dawProject.findUnique({ where: { projectId: source.id } }),
  ]);

  for (const doc of docs) {
    await db.document.create({
      data: {
        projectId: copy.id,
        title: doc.title,
        description: doc.description,
        kind: doc.kind,
        sections: {
          create: doc.sections.map((s) => ({
            title: s.title,
            order: s.order,
            content: s.content,
            status: s.status,
          })),
        },
      },
    });
  }

  for (const entity of entities) {
    await db.entity.create({
      data: {
        projectId: copy.id,
        setId: entity.setId,
        setName: entity.setName,
        domain: entity.domain,
        kind: entity.kind,
        name: entity.name,
        short: entity.short,
        description: entity.description,
        attributes: entity.attributes,
        tags: entity.tags,
        refs: entity.refs,
        portrait: entity.portrait,
        image: entity.image,
        imagePrompt: entity.imagePrompt,
        favorite: entity.favorite,
      },
    });
  }

  if (artifacts.length > 0) {
    await db.artifact.createMany({
      data: artifacts.map((a) => ({
        projectId: copy.id,
        type: a.type,
        title: a.title,
        description: a.description,
        url: a.url,
        prompt: a.prompt,
        stage: a.stage,
        meta: a.meta,
        favorite: a.favorite,
      })),
    });
  }

  if (daw) {
    await db.dawProject.create({
      data: {
        projectId: copy.id,
        bpm: daw.bpm,
        bars: daw.bars,
        masterVolume: daw.masterVolume,
        transpose: daw.transpose,
        metronome: daw.metronome,
        tracks: daw.tracks,
      },
    });
  }

  return NextResponse.json(
    { workspace: workspaceDto(copy, await workspaceCounts(copy.id)) },
    { status: 201 },
  );
}
