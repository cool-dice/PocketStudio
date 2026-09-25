/**
 * File-editor surface: a Next.js code app vs the Code tab of an
 * app-type studio. Studios keep GET /api/projects 404; the editor
 * loads workspace meta and disk files instead of pretending /w is a host.
 */

import type { Project } from "./types";

export type EditorSurface = "project" | "workspace";

export function editorProjectFromWorkspace(ws: {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}): Project {
  return {
    id: ws.id,
    name: ws.name,
    description: ws.description,
    origin: "workspace",
    remoteUrl: null,
    createdAt: ws.createdAt,
    updatedAt: ws.updatedAt,
  };
}

export function editorLoadError(surface: EditorSurface): string {
  return surface === "workspace"
    ? "Не удалось загрузить файлы воркспейса"
    : "Не удалось загрузить проект";
}

export function editorSectionLabel(surface: EditorSurface): string {
  return surface === "workspace" ? "Код воркспейса" : "Проект";
}
