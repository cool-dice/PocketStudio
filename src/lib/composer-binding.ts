/**
 * Composer chip copy when a thread is bound to a code project vs a studio.
 * Music/book/film threads must not read as «Проект:».
 */

export type BoundChipKind = "workspace" | "project";

const TYPE_PREFIX: Record<string, string> = {
  music: "Трек",
  book: "Книга",
  film: "Фильм",
  app: "Приложение",
  universal: "Воркспейс",
};

export function boundThreadChip(opts: {
  name: string;
  origin?: string | null;
  type?: string | null;
}): { label: string; kind: BoundChipKind } {
  if (opts.origin === "workspace") {
    const prefix = TYPE_PREFIX[opts.type ?? ""] ?? "Воркспейс";
    return { label: `${prefix}: ${opts.name}`, kind: "workspace" };
  }
  return { label: `Проект: ${opts.name}`, kind: "project" };
}
