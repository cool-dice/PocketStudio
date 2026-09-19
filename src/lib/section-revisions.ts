import { db } from "@/lib/db";

/** Сколько последних версий хранить на главу. */
export const KEEP_REVISIONS = 20;
/** Минимальная паууза между автоснапшотами одной сессии правки (мс). */
export const SNAPSHOT_GAP_MS = 10 * 60 * 1000;

/**
 * Сохранить снапшот текста главы перед перезаписью (PS-6).
 * Дедупликация: подряд идущие снапшоты одной сессии правки (быстрее
 * SNAPSHOT_GAP_MS) и идентичный текст — пропускаются. Хвост длиннее
 * KEEP_REVISIONS обрезается.
 */
export async function snapshotSection(
  sectionId: string,
  content: string,
  source: "manual" | "ai",
  opts?: { force?: boolean },
): Promise<void> {
  const latest = await db.documentSectionRevision.findFirst({
    where: { sectionId },
    orderBy: { createdAt: "desc" },
    select: { content: true, createdAt: true },
  });

  if (latest) {
    // Идентичный текст — снапшот не нужен.
    if (latest.content === content) return;
    // ИИ-правка и force всегда пишут версию, чтобы можно было откатить.
    const skipGap = opts?.force || source === "ai";
    // Сессия правки ещё активна — не плодим микроверсии.
    if (!skipGap && Date.now() - latest.createdAt.getTime() < SNAPSHOT_GAP_MS) {
      return;
    }
  }

  await db.$transaction(async (tx) => {
    await tx.documentSectionRevision.create({
      data: { sectionId, content, source, size: content.length },
    });
    const tail = await tx.documentSectionRevision.findMany({
      where: { sectionId },
      orderBy: { createdAt: "desc" },
      skip: KEEP_REVISIONS,
      select: { id: true },
    });
    if (tail.length > 0) {
      await tx.documentSectionRevision.deleteMany({
        where: { id: { in: tail.map((row) => row.id) } },
      });
    }
  });
}
