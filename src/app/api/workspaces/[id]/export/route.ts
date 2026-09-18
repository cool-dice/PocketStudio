import { NextResponse } from "next/server";
import { promises as fsp } from "node:fs";
import path from "node:path";
import JSZip from "jszip";

import { db } from "@/lib/db";
import { ensureWorkspace } from "@/lib/workspace-api";
import { artifactDto, entityDto, findingDto } from "@/lib/workspace-shapes";

export const dynamic = "force-dynamic";

/* ── GET /api/workspaces/[id]/export — честный ZIP-экспорт воркспейса ──
 * Внутри архива всё реальное содержимое: артефакты (медиа-файлы +
 * manifest.json), документы (.md по секциям), entities.json, findings.json
 * и README.md со сводкой. Облачный деплой — за пределами песочницы. */

type Params = { params: Promise<{ id: string }> };

const TYPE_LABELS: Record<string, string> = {
  film: "Фильм",
  book: "Книга",
  music: "Музыка",
  app: "Приложение",
  universal: "Универсальный",
};

/** Транслитерация RU → lat + безопасный slug для имён файлов. */
const RU_MAP: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh",
  щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

function slugify(name: string): string {
  const translit = name
    .toLowerCase()
    .split("")
    .map((ch) => RU_MAP[ch] ?? ch)
    .join("");
  const slug = translit
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  return slug || "workspace";
}

/** Slug уже ASCII (транслитерация), поэтому достаточно простого filename. */
function contentDisposition(slug: string): string {
  return `attachment; filename="${slug}-export.zip"`;
}

export async function GET(req: Request, { params }: Params) {
  const { id } = await params;
  const check = await ensureWorkspace(req, id);
  if (!check.ok) return check.response;

  const project = await db.project.findFirst({
    where: { id, userId: check.userId },
  });
  if (!project) {
    return NextResponse.json({ error: "Воркспейс не найден" }, { status: 404 });
  }

  const [artifacts, documents, entities, findings] = await Promise.all([
    db.artifact.findMany({ where: { projectId: id }, orderBy: { createdAt: "asc" } }),
    db.document.findMany({
      where: { projectId: id },
      include: { sections: { orderBy: { order: "asc" } } },
      orderBy: { updatedAt: "asc" },
    }),
    db.entity.findMany({ where: { projectId: id }, orderBy: { updatedAt: "asc" } }),
    db.finding.findMany({ where: { projectId: id }, orderBy: { createdAt: "asc" } }),
  ]);

  const zip = new JSZip();

  /* ── documents/ — каждый документ как .md ── */
  const usedDocNames = new Set<string>();
  for (const doc of documents) {
    let filename = `${slugify(doc.title)}.md`;
    let n = 2;
    while (usedDocNames.has(filename)) {
      filename = `${slugify(doc.title)}-${n++}.md`;
    }
    usedDocNames.add(filename);

    const md = [
      `# ${doc.title}`,
      "",
      doc.description ? `> ${doc.description}` : "",
      `_${["manuscript", "spec", "article", "script"].includes(doc.kind) ? doc.kind : "document"} · ${doc.sections.length} секц. · обновлён ${doc.updatedAt.toLocaleString("ru-RU")}_`,
      "",
      ...doc.sections.flatMap((s) => [`## ${s.title}`, "", s.content.trim() || "_(пусто)_", ""]),
    ].join("\n");
    zip.file(`documents/${filename}`, md);
  }

  /* ── artifacts/ — медиа-файлы (/gen/...) + manifest.json ── */
  const publicDir = path.join(process.cwd(), "public");
  const manifest: Array<
    ReturnType<typeof artifactDto> & { file: string | null }
  > = [];
  let filesPacked = 0;
  for (const a of artifacts) {
    const dto = artifactDto(a);
    const cleanUrl = dto.url ? dto.url.split("?")[0] : null;
    let file: string | null = null;
    if (cleanUrl && cleanUrl.startsWith("/gen/")) {
      file = `artifacts/${path.basename(cleanUrl)}`;
      try {
        const data = await fsp.readFile(path.join(publicDir, cleanUrl));
        zip.file(file, data);
        filesPacked++;
      } catch {
        /* Файл пропал с диска — остаётся только запись в manifest. */
        file = null;
      }
    }
    manifest.push({
      ...dto,
      /** Путь файла внутри архива (null — файла нет на диске). */
      file,
    });
  }
  zip.file("artifacts/manifest.json", JSON.stringify(manifest, null, 2));

  /* ── entities.json / findings.json ── */
  zip.file(
    "entities.json",
    JSON.stringify(entities.map((e) => entityDto(e)), null, 2),
  );
  zip.file(
    "findings.json",
    JSON.stringify(findings.map((f) => findingDto(f)), null, 2),
  );

  /* ── README.md ── */
  const openFindings = findings.filter((f) => f.status === "open").length;
  const byType = artifacts.reduce<Record<string, number>>((acc, a) => {
    acc[a.type] = (acc[a.type] ?? 0) + 1;
    return acc;
  }, {});
  zip.file(
    "README.md",
    [
      `# ${project.name}`,
      "",
      `**Тип:** ${TYPE_LABELS[project.type] ?? project.type} · **Стадия:** ${project.stage ?? "—"} · **Прогресс:** ${project.progress}%`,
      "",
      project.description ? project.description : "",
      "",
      "## Состав архива",
      "",
      "| Что | Сколько |",
      "| --- | --- |",
      `| Документы (documents/*.md) | ${documents.length} |`,
      `| Артефакты (artifacts/) | ${artifacts.length} |`,
      `| — медиа-файлы в архиве | ${filesPacked} |`,
      `| Сущности (entities.json) | ${entities.length} |`,
      `| Находки аналитика (findings.json) | ${findings.length} (открытых: ${openFindings}) |`,
      "",
      `Изображений: ${byType.image ?? 0} · аудио: ${byType.audio ?? 0} · видео: ${byType.video ?? 0}`,
      "",
      "Экспорт создан студией VibeFlow (карманная студия творчества).",
      `Дата экспорта: ${new Date().toLocaleString("ru-RU")}`,
      "",
    ].join("\n"),
  );

  try {
    const buffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });
    const slug = slugify(project.name);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "content-type": "application/zip",
        "content-disposition": contentDisposition(slug),
        "content-length": String(buffer.byteLength),
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    console.error(
      "[workspaces/export] zip failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { error: "Не удалось упаковать воркспейс" },
      { status: 500 },
    );
  }
}
