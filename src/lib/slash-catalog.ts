/**
 * Composer slash tokens for typed studios vs Next.js code projects.
 * `/проект` is code only — music/book/film use `/трек` `/книга` `/фильм`.
 */

import type { WorkspaceType } from "@/lib/workspace-data";

export interface WorkspaceSlashSpec {
  name: string;
  label: string;
  description: string;
  /** undefined → type picker (step 1). */
  type: WorkspaceType | undefined;
}

export const WORKSPACE_SLASH_COMMANDS: readonly WorkspaceSlashSpec[] = [
  {
    name: "воркспейс",
    label: "Новый воркспейс",
    description: "Создать студию: фильм, книга, трек, приложение или универсальный",
    type: undefined,
  },
  {
    name: "студия",
    label: "Новая студия",
    description: "Создать творческий воркспейс (не код Next.js)",
    type: undefined,
  },
  {
    name: "трек",
    label: "Новый трек",
    description: "Создать музыкальный воркспейс",
    type: "music",
  },
  {
    name: "книга",
    label: "Новая книга",
    description: "Создать книжный воркспейс",
    type: "book",
  },
  {
    name: "фильм",
    label: "Новый фильм",
    description: "Создать воркспейс фильма",
    type: "film",
  },
];

export const CODE_PROJECT_SLASH = {
  name: "проект",
  label: "Новый код",
  description: "Создать код-проект Next.js: шаблон, GitHub или zip",
} as const;

export function slashOpensWorkspaceType(token: string): WorkspaceType | "picker" | null {
  const name = token.replace(/^\//, "").toLowerCase();
  const spec = WORKSPACE_SLASH_COMMANDS.find((c) => c.name === name);
  if (!spec) return null;
  return spec.type ?? "picker";
}
