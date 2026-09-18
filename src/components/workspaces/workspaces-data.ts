/**
 * Воркспейсы — утилиты экрана списка (PS-3-a).
 *
 * Каталогизация: поиск по названию/описанию/типу, чипы типов со
 * счётчиками, сортировка (обновление / прогресс / название). Порядок
 * MOCK_WORKSPACES уже отсортирован по свежести обновлений.
 */

import {
  MOCK_WORKSPACES,
  WORKSPACE_TYPE_META,
  type WorkspaceSummary,
  type WorkspaceType,
} from "@/lib/workspace-data";

export type WorkspacesSort = "updated" | "progress" | "name";
export type WorkspacesTypeFilter = WorkspaceType | "all";

export const WORKSPACES_SORT_OPTIONS: { id: WorkspacesSort; label: string }[] = [
  { id: "updated", label: "По обновлению" },
  { id: "progress", label: "По прогрессу" },
  { id: "name", label: "По названию" },
];

/** Подписи чипов фильтра типов (согласно составу мок-данных). */
export const WORKSPACES_TYPE_CHIPS: {
  id: WorkspacesTypeFilter;
  label: string;
}[] = [
  { id: "all", label: "Все" },
  { id: "film", label: "Фильмы" },
  { id: "book", label: "Книга" },
  { id: "music", label: "Музыка" },
  { id: "app", label: "Приложение" },
  { id: "universal", label: "Универсальный" },
];

/** Ранг свежести обновлений: индекс в исходном мок-списке. */
const UPDATED_RANK = new Map(MOCK_WORKSPACES.map((ws, index) => [ws.id, index]));

/** Каждый токен запроса должен найтись в названии/описании/типе. */
export function matchesWorkspaceQuery(
  ws: WorkspaceSummary,
  query: string,
): boolean {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;
  const haystack = [
    ws.title,
    ws.subtitle,
    ws.description,
    WORKSPACE_TYPE_META[ws.type].label,
  ]
    .join(" ")
    .toLowerCase();
  return trimmed.split(/\s+/).every((token) => haystack.includes(token));
}

/** Отсортированная копия списка под выбранный режим. */
export function sortWorkspaces(
  list: WorkspaceSummary[],
  sort: WorkspacesSort,
): WorkspaceSummary[] {
  const copy = [...list];
  if (sort === "progress") {
    copy.sort((a, b) => b.progress - a.progress);
  } else if (sort === "name") {
    copy.sort((a, b) => a.title.localeCompare(b.title, "ru"));
  } else {
    copy.sort(
      (a, b) =>
        (UPDATED_RANK.get(a.id) ?? list.length) -
        (UPDATED_RANK.get(b.id) ?? list.length),
    );
  }
  return copy;
}
