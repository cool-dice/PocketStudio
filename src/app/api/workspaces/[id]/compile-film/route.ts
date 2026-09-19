import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { saveGeneratedFile } from "@/lib/ai";
import { compileFilmFfmpeg, whichFfmpeg } from "@/lib/ffmpeg-film";
import {
  EMPTY_TIMELINE_COMPILE_ERROR,
  isExplicitEmptyCompileClips,
} from "@/lib/nle-model";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

type Params = { params: Promise<{ id: string }> };

function publicToAbs(url: string): string | null {
  if (!url.startsWith("/")) return null;
  const abs = path.join(process.cwd(), "public", url.replace(/^\//, ""));
  return fs.existsSync(abs) ? abs : null;
}

export async function POST(req: Request, { params }: Params) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  const { id } = await params;
  const project = await db.project.findFirst({
    where: { id, userId: session.sub },
    select: { id: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Воркспейс не найден" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    clips?: { imageUrl?: string | null; durationSec?: number }[];
  };
  if (isExplicitEmptyCompileClips(body.clips)) {
    return NextResponse.json(
      {
        status: "empty",
        error: EMPTY_TIMELINE_COMPILE_ERROR,
        log: EMPTY_TIMELINE_COMPILE_ERROR,
        url: null,
      },
      { status: 400 },
    );
  }

  const has = await whichFfmpeg();
  if (!has) {
    return NextResponse.json({
      status: "unavailable",
      log: "ffmpeg не найден в PATH. Сборка в браузере (canvas + MediaRecorder) остаётся на вкладке Монтаж.",
      url: null,
    });
  }
  const requested = Array.isArray(body.clips) ? body.clips : null;

  type SceneFile = { abs: string; durationSec: number };
  let withFiles: SceneFile[] = [];

  if (requested && requested.length > 0) {
    withFiles = requested
      .map((c) => {
        const abs = c.imageUrl ? publicToAbs(c.imageUrl) : null;
        return abs
          ? { abs, durationSec: Math.max(1, Math.min(30, c.durationSec ?? 4)) }
          : null;
      })
      .filter((x): x is SceneFile => Boolean(x));
    if (withFiles.length === 0) {
      return NextResponse.json({
        status: "unavailable",
        log: "У клипов таймлайна нет файлов на диске — сборка ffmpeg невозможна.",
        url: null,
      });
    }
  } else {
    const images = await db.artifact.findMany({
      where: {
        projectId: id,
        type: "image",
        stage: { startsWith: "scene:" },
      },
      orderBy: { createdAt: "asc" },
    });
    withFiles = images
      .filter((a) => a.url)
      .map((a) => {
        const abs = publicToAbs(a.url!);
        return abs ? { abs, durationSec: 4 } : null;
      })
      .filter((x): x is SceneFile => Boolean(x));
  }

  if (withFiles.length === 0) {
    return NextResponse.json({
      status: "unavailable",
      log: "Нет кадров сцен на диске. Сгенерируйте раскадровку или соберите фильм в браузере.",
      url: null,
    });
  }

  const outTmp = path.join(process.cwd(), "public", "gen", `film-${id.slice(0, 8)}.webm`);
  fs.mkdirSync(path.dirname(outTmp), { recursive: true });
  const result = await compileFilmFfmpeg(
    withFiles.map((s) => ({
      imagePath: s.abs,
      durationSec: s.durationSec,
    })),
    outTmp,
  );

  if (!result.ok || !fs.existsSync(outTmp)) {
    return NextResponse.json({
      status: "unavailable",
      log: result.log.slice(-4000) || "ffmpeg не смог собрать ролик",
      url: null,
    });
  }

  const buf = fs.readFileSync(outTmp);
  const url = saveGeneratedFile(buf, "webm");
  try {
    fs.unlinkSync(outTmp);
  } catch {
    /* keep */
  }

  const artifact = await db.artifact.create({
    data: {
      projectId: id,
      type: "video",
      title: "Сборка ffmpeg",
      url,
      stage: "nle",
      meta: JSON.stringify({ source: "ffmpeg", scenes: withFiles.length }),
    },
  });

  return NextResponse.json({
    status: "built",
    url,
    artifactId: artifact.id,
    log: result.log.slice(-2000),
  });
}
