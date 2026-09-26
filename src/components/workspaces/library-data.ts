/**
 * Инструментарий Библиотеки на живых данных (A2-c): мета типов
 * артефактов (иконка, подписи, вкладка воркспейса, градиент-фолбэк),
 * поиск, сортировка, секции по типам, форматирование дат и классы сетки.
 * Данные — ArtifactDto из api.listAllArtifacts().
 */

import {
  BookOpenText,
  Clapperboard,
  FileCode2,
  FileText,
  Headphones,
  ImagePlus,
  Music4,
  NotebookPen,
  Rocket,
  UserRound,
  Video,
  type LucideIcon,
} from "lucide-react";

import type { ArtifactType, ArtifactDto, WorkspaceDto } from "@/lib/workspace-types";
import type { WorkspaceTab, WorkspaceSummary, WorkspaceType } from "@/lib/workspace-data";
import { WORKSPACE_TYPE_META } from "@/lib/workspace-data";

export type LibraryView = "grid" | "list";

export type LibrarySort = "date" | "title" | "kind";

export const LIBRARY_SORT_OPTIONS: { id: LibrarySort; label: string }[] = [
  { id: "date", label: "Сначала новые" },
  { id: "title", label: "По названию" },
  { id: "kind", label: "По типу" },
];

export type LibraryKindFilter = ArtifactType | "all";

export interface LibraryTypeMeta {
  /** Единственное число для бейджа карточки. */
  label: string;
  /** Множественное для заголовка секции. */
  plural: string;
  icon: LucideIcon;
  /** Вкладка воркспейса, где живёт этот тип контента. */
  tab: WorkspaceTab;
  /** Градиент-фолбэк для карточек без meta.gradient. */
  gradient: string;
}

export const LIBRARY_TYPE_META: Record<ArtifactType, LibraryTypeMeta> = {
  image: {
    label: "Изображение",
    plural: "Изображения",
    icon: ImagePlus,
    tab: "images",
    gradient: "from-emerald-500/60 to-teal-500/40",
  },
  portrait: {
    label: "Портрет",
    plural: "Портреты",
    icon: UserRound,
    tab: "documents",
    gradient: "from-teal-500/60 to-emerald-500/40",
  },
  track: {
    label: "Трек",
    plural: "Треки",
    icon: Music4,
    tab: "audio",
    gradient: "from-amber-500/60 to-orange-500/40",
  },
  audio: {
    label: "Аудио",
    plural: "Аудио",
    icon: Headphones,
    tab: "audio",
    gradient: "from-orange-500/60 to-amber-500/40",
  },
  scene: {
    label: "Сцена",
    plural: "Сцены",
    icon: Clapperboard,
    tab: "video",
    gradient: "from-sky-600/60 to-cyan-500/40",
  },
  video: {
    label: "Видео",
    plural: "Видео",
    icon: Video,
    tab: "video",
    gradient: "from-cyan-500/60 to-sky-500/40",
  },
  document: {
    label: "Документ",
    plural: "Документы",
    icon: BookOpenText,
    tab: "documents",
    gradient: "from-emerald-500/60 to-teal-500/40",
  },
  note: {
    label: "Заметка",
    plural: "Заметки",
    icon: NotebookPen,
    tab: "notes",
    gradient: "from-stone-400/50 to-emerald-500/30",
  },
  file: {
    label: "Файл",
    plural: "Файлы",
    icon: FileText,
    tab: "overview",
    gradient: "from-stone-500/60 to-stone-400/40",
  },
  app: {
    label: "Код",
    plural: "Код",
    icon: FileCode2,
    tab: "code",
    gradient: "from-violet-500/60 to-purple-500/40",
  },
  deploy: {
    label: "Деплой",
    plural: "Деплои",
    icon: Rocket,
    tab: "deploy",
    gradient: "from-fuchsia-500/60 to-violet-500/40",
  },
};

/** Канонический порядок секций/чипов типов. */
export const LIBRARY_TYPE_ORDER: ArtifactType[] = [
  "image",
  "portrait",
  "track",
  "audio",
  "scene",
  "video",
  "document",
  "note",
  "file",
];

/** Градиент артефакта: meta.gradient или фолбэк по типу. */
export function artifactGradient(artifact: ArtifactDto): string {
  const meta = (artifact.meta ?? {}) as Record<string, unknown>;
  if (typeof meta.gradient === "string" && meta.gradient.trim() !== "") {
    return meta.gradient;
  }
  return LIBRARY_TYPE_META[artifact.type].gradient;
}

/** Поиск по названию, описанию и промпту. */
export function matchesQuery(artifact: ArtifactDto, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    artifact.title.toLowerCase().includes(q) ||
    (artifact.description ?? "").toLowerCase().includes(q) ||
    (artifact.prompt ?? "").toLowerCase().includes(q)
  );
}

/** Сортированная копия списка под текущую сортировку. */
export function sortArtifacts(
  items: ArtifactDto[],
  sort: LibrarySort,
): ArtifactDto[] {
  const sorted = [...items];
  if (sort === "title") {
    sorted.sort((a, b) => a.title.localeCompare(b.title, "ru"));
  } else if (sort === "kind") {
    sorted.sort(
      (a, b) =>
        LIBRARY_TYPE_ORDER.indexOf(a.type) - LIBRARY_TYPE_ORDER.indexOf(b.type) ||
        a.title.localeCompare(b.title, "ru"),
    );
  } else {
    sorted.sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
    );
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

/** Относительное время: «только что» / «12 мин назад» / «3 дня назад». */
export function formatAgo(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return "—";
  const diffMs = Date.now() - ts;
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "только что";
  if (min < 60) return `${min} мин назад`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "вчера";
  if (days < 7) return `${days} ${pluralDays(days)} назад`;
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(
    new Date(ts),
  );
}

function pluralDays(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "день";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "дня";
  return "дней";
}

/** Живой воркспейс → WorkspaceSummary (для перехода из Библиотеки). */
export function toWorkspaceSummary(ws: WorkspaceDto): WorkspaceSummary {
  const meta = WORKSPACE_TYPE_META[ws.type as WorkspaceType] ?? WORKSPACE_TYPE_META.universal;
  return {
    id: ws.id,
    type: ws.type as WorkspaceType,
    title: ws.name,
    subtitle: meta.label,
    description: ws.description ?? "",
    stage: ws.stage ?? "Подготовка",
    stageIndex: ws.stageIndex ?? 1,
    progress: ws.progress,
    updatedAgo: formatAgo(ws.updatedAt),
    gradient: meta.gradient,
    counts: ws.counts,
  };
}
