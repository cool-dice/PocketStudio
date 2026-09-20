/**
 * Composer chip copy when a thread is bound to a code project vs a studio.
 * Music/book/film threads must not read as «Проект:».
 * `/w/{id}` is the workspace shell only — code apps stay on openProject
 * (mainArea "project"), not a fake studio URL.
 */

import { pathFor } from "./app-url";

export type BoundChipKind = "workspace" | "project";

const TYPE_PREFIX: Record<string, string> = {
  music: "Трек",
  book: "Книга",
  film: "Фильм",
  app: "Приложение",
  universal: "Воркспейс",
};

export type BoundChip = {
  label: string;
  kind: BoundChipKind;
  href: string | null;
};

export function boundThreadChip(opts: {
  name: string;
  origin?: string | null;
  type?: string | null;
  id?: string | null;
}): BoundChip {
  if (opts.origin === "workspace") {
    const prefix = TYPE_PREFIX[opts.type ?? ""] ?? "Воркспейс";
    return {
      label: `${prefix}: ${opts.name}`,
      kind: "workspace",
      href: opts.id ? pathFor("workspace", opts.id, "chat") : null,
    };
  }
  return { label: `Проект: ${opts.name}`, kind: "project", href: null };
}

export function boundChipFromLists(opts: {
  id: string | null;
  workspace?: { id: string; name: string; type?: string | null } | null;
  project?: { id: string; name: string; origin?: string | null } | null;
}): BoundChip | null {
  if (!opts.id) return null;
  if (opts.workspace) {
    return boundThreadChip({
      name: opts.workspace.name,
      origin: "workspace",
      type: opts.workspace.type,
      id: opts.workspace.id,
    });
  }
  if (opts.project) {
    return boundThreadChip({
      name: opts.project.name,
      origin: opts.project.origin,
      id: opts.project.id,
    });
  }
  return null;
}

/** Bell click: a studio notification must not open the Next.js project shell. */
export function notificationOpensWorkspace(opts: {
  cachedStudio: boolean;
  fetchOk: boolean;
  title: string;
  body?: string | null;
}): boolean {
  if (opts.cachedStudio || opts.fetchOk) return true;
  return /воркспейс|студи/i.test(`${opts.title} ${opts.body ?? ""}`);
}
