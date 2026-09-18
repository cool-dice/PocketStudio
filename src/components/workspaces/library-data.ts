/**
 * Локальный инструментарий Библиотеки (PS-3-c): типы фильтров и
 * сортировки, порядок чипов типов, парсер относительного времени,
 * сравнители сортировки и классы сетки. Данные артефактов и воркспейсов
 * живут в shared/artifacts-data и lib/workspace-data — здесь только UI-кит.
 */

import type {
  ArtifactKind,
  ArtifactItem,
} from "@/components/workspaces/shared/artifacts-data";
import { MOCK_WORKSPACES } from "@/lib/workspace-data";

export type LibraryView = "grid" | "list";

export type LibrarySort = "date" | "title" | "kind" | "workspace";

export type LibraryKindFilter = ArtifactKind | "all";

export const LIBRARY_SORT_OPTIONS: { id: LibrarySort; label: string }[] = [
  { id: "date", label: "Сначала новые" },
  { id: "title", label: "По названию" },
  { id: "kind", label: "По типу" },
  { id: "workspace", label: "По воркспейсу" },
];

/** Чипы типов: порядок + подписи во множественном числе (для счётчиков). */
export const LIBRARY_KIND_CHIPS: { kind: ArtifactKind; label: string }[] = [
  { kind: "note", label: "Заметки" },
  { kind: "document", label: "Документы" },
  { kind: "portrait", label: "Портреты" },
  { kind: "image", label: "Изображения" },
  { kind: "track", label: "Треки" },
  { kind: "scene", label: "Сцены" },
  { kind: "app", label: "Код" },
  { kind: "deploy", label: "Деплои" },
];

const KIND_ORDER: ArtifactKind[] = [
  "note",
  "document",
  "portrait",
  "image",
  "track",
  "scene",
  "app",
  "deploy",
];

/** «12 мин назад» → примерные часы давности (для сортировки по свежести). */
export function agoHours(ago: string): number {
  let match = /^(\d+)\s*мин/.exec(ago);
  if (match) return Number(match[1]) / 60;
  match = /^(\d+)\s*ч/.exec(ago);
  if (match) return Number(match[1]);
  if (ago.startsWith("вчера")) return 24;
  match = /^(\d+)\s*дн/.exec(ago);
  if (match) return Number(match[1]) * 24;
  return Number.MAX_SAFE_INTEGER;
}

/** Поиск по названию (и мета-строке — «Глава 7 · 1 240 слов»). */
export function matchesQuery(artifact: ArtifactItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    artifact.title.toLowerCase().includes(q) ||
    artifact.meta.toLowerCase().includes(q)
  );
}

function workspaceOrder(artifact: ArtifactItem): number {
  const index = MOCK_WORKSPACES.findIndex((ws) => ws.id === artifact.workspaceId);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

/** Отсортированная копия списка под текущую сортировку. */
export function sortArtifacts(
  items: ArtifactItem[],
  sort: LibrarySort,
): ArtifactItem[] {
  const sorted = [...items];
  switch (sort) {
    case "title":
      sorted.sort((a, b) => a.title.localeCompare(b.title, "ru"));
      break;
    case "kind":
      sorted.sort(
        (a, b) =>
          KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
          a.title.localeCompare(b.title, "ru"),
      );
      break;
    case "workspace":
      sorted.sort(
        (a, b) =>
          workspaceOrder(a) - workspaceOrder(b) ||
          agoHours(a.createdAgo) - agoHours(b.createdAgo),
      );
      break;
    default:
      sorted.sort((a, b) => agoHours(a.createdAgo) - agoHours(b.createdAgo));
  }
  return sorted;
}

/** Сетка/список артефактов: 1 колонка на мобиле → 4 на широких экранах. */
export function libraryGridClassName(view: LibraryView): string {
  return view === "grid"
    ? "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    : "flex flex-col gap-2";
}

/** Русская плюрализация: 1 артефакт / 2 артефакта / 5 артефактов. */
export function pluralArtifacts(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  let form: 0 | 1 | 2;
  if (mod10 === 1 && mod100 !== 11) form = 0;
  else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) form = 1;
  else form = 2;
  return `${n} ${["артефакт", "артефакта", "артефактов"][form]}`;
}
