import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { saveGeneratedFile } from "@/lib/ai";
import { compileFilmFfmpeg, whichFfmpeg } from "@/lib/ffmpeg-film";

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

  const has = await whichFfmpeg();
  if (!has) {
    return NextResponse.json({
      status: "unavailable",
      log: "ffmpeg не найден в PATH. Сборка в браузере (canvas + MediaRecorder) остаётся на вкладке Монтаж.",
      url: null,
    });
  }

  const images = await db.artifact.findMany({
    where: {
      projectId: id,
      type: "image",
      stage: { startsWith: "scene:" },
    },
    orderBy: { createdAt: "asc" },
  });
  const withFiles = images
    .filter((a) => a.url)
    .map((a) => ({ artifact: a, abs: publicToAbs(a.url!) }))
    .filter((x): x is { artifact: (typeof images)[number]; abs: string } => Boolean(x.abs));

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
      durationSec: 4,
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
