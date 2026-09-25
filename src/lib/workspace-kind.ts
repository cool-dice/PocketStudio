/**
 * Typed studio kinds (film/book/music/app/universal) plus Russian aliases
 * the agent and HTTP create-workspace paths both accept.
 */

export const WORKSPACE_KINDS = [
  "film",
  "book",
  "music",
  "app",
  "universal",
] as const;

export type WorkspaceKindName = (typeof WORKSPACE_KINDS)[number];

const KIND_ALIASES: Record<string, WorkspaceKindName> = {
  film: "film",
  book: "book",
  music: "music",
  app: "app",
  universal: "universal",
  "фильм": "film",
  кино: "film",
  видео: "film",
  "книга": "book",
  роман: "book",
  "музыка": "music",
  "песня": "music",
  трек: "music",
  "приложение": "app",
  "универсальный": "universal",
};

export function parseWorkspaceKind(raw: unknown): WorkspaceKindName | null {
  if (typeof raw !== "string") return null;
  const key = raw.trim().toLowerCase();
  if (!key) return null;
  return KIND_ALIASES[key] ?? null;
}

export function isWorkspaceKind(value: string): value is WorkspaceKindName {
  return (WORKSPACE_KINDS as readonly string[]).includes(value);
}

/** First pipeline stage — must match WORKSPACE_STAGES in workspace-data.ts. */
export const WORKSPACE_FIRST_STAGE: Record<WorkspaceKindName, string> = {
  film: "Сценарий",
  book: "Замысел",
  music: "Идея",
  app: "Идея",
  universal: "Подготовка",
};

export const CREATE_WORKSPACE_NAME_EMPTY = "Название не может быть пустым";
export const CREATE_WORKSPACE_NAME_LONG =
  "Название не может превышать 80 символов";
export const CREATE_WORKSPACE_DESC_LONG =
  "Описание не может превышать 500 символов";
export const CREATE_WORKSPACE_TYPE_BAD =
  "Тип воркспейса: film, book, music, app или universal (фильм, книга, музыка, песня, трек, приложение, универсальный)";
