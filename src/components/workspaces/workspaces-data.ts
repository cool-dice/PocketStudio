/**
 * Воркспейсы — утилиты экрана списка (Фаза A: WorkspaceDto из REST).
 *
 * Каталогизация: поиск по названию/описанию/типу, чипы типов со
 * счётчиками, фильтр стадии, сортировка (обновление / прогресс /
 * название). Список из /api/workspaces уже отсортирован по updatedAt.
 */

import {
  WORKSPACE_STAGES,
  WORKSPACE_TYPE_META,
  canonicalStageLabel,
  pipelineStageIndex,
  type WorkspaceSummary,
  type WorkspaceType,
} from "@/lib/workspace-data";
import type { WorkspaceDto } from "@/lib/workspace-types";
import { timeAgo } from "@/components/workspaces/home-data";

export type WorkspacesSort = "updated" | "progress" | "name";
export type WorkspacesTypeFilter = WorkspaceType | "all";

export const WORKSPACES_SORT_OPTIONS: { id: WorkspacesSort; label: string }[] = [
  { id: "updated", label: "По обновлению" },
  { id: "progress", label: "По прогрессу" },
  { id: "name", label: "По названию" },
];

/** Подписи чипов фильтра типов. */
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

// ─────────────────────── нормализация полей DTO ───────────────────────

/** 0-based индекс стадии пайплайна: по названию, иначе по stageIndex. */
export function stageIndexOf(ws: WorkspaceDto): number {
  const stages = WORKSPACE_STAGES[ws.type];
  const byName = pipelineStageIndex(stages, ws.stage ?? "");
  if (byName >= 0) return byName;
  return Math.min(Math.max(ws.stageIndex ?? 1, 1), stages.length) - 1;
}

/** Человекочитаемая стадия: из БД (legacy «Публикация» → «Выпуск»). */
export function stageLabelOf(ws: WorkspaceDto): string {
  return ws.stage
    ? canonicalStageLabel(ws.stage)
    : WORKSPACE_STAGES[ws.type][stageIndexOf(ws)];
}

/** Подпись-строка карточки: описание или подсказка типа. */
export function workspaceSubtitle(ws: WorkspaceDto): string {
  return ws.description?.trim() || WORKSPACE_TYPE_META[ws.type].hint;
}

/** Суммарное число объектов контента по counts. */
export function workspaceItemsTotal(ws: WorkspaceDto): number {
  const c = ws.counts;
  return c.notes + c.documents + c.images + c.audio + c.video + c.files;
}

/**
 * Легаси-объект для вкладок-швов (workspace-tabs / notes-tab ждут
 * WorkspaceSummary): поля мока восстанавливаются из DTO и мет типа.
 */
export function summaryFromDto(ws: WorkspaceDto): WorkspaceSummary {
  const meta = WORKSPACE_TYPE_META[ws.type];
  const pipelineLength = WORKSPACE_STAGES[ws.type].length;
  return {
    id: ws.id,
    type: ws.type,
    title: ws.name,
    subtitle: workspaceSubtitle(ws),
    description: ws.description ?? meta.hint,
    stage: stageLabelOf(ws),
    stageIndex: Math.min(Math.max(ws.stageIndex ?? stageIndexOf(ws) + 1, 1), pipelineLength),
    progress: ws.progress,
    updatedAgo: timeAgo(ws.updatedAt),
    gradient: meta.gradient,
    counts: ws.counts,
  };
}

// ─────────────────────── каталогизация ───────────────────────

/** Каждый токен запроса должен найтись в названии/описании/типе. */
export function matchesWorkspaceQuery(
  ws: WorkspaceDto,
  query: string,
): boolean {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;
  const haystack = [
    ws.name,
    ws.description ?? "",
    WORKSPACE_TYPE_META[ws.type].label,
  ]
    .join(" ")
    .toLowerCase();
  return trimmed.split(/\s+/).every((token) => haystack.includes(token));
}

/** Отсортированная копия списка под выбранный режим. */
export function sortWorkspaces(
  list: WorkspaceDto[],
  sort: WorkspacesSort,
): WorkspaceDto[] {
  const copy = [...list];
  if (sort === "progress") {
    copy.sort((a, b) => b.progress - a.progress);
  } else if (sort === "name") {
    copy.sort((a, b) => a.name.localeCompare(b.name, "ru"));
  } else {
    copy.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }
  return copy;
}
