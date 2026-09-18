/**
 * Артефакты воркспейсов — единая единица контента (Фаза A).
 *
 * Артефакт = любой творческий объект: заметка, глава, картинка, трек,
 * сцена, файл кода, деплой. Одна карточка (ArtifactCard) показывает его
 * в Обзоре воркспейса, в Библиотеке и в результатах чата. Моки
 * (MOCK_ARTIFACTS/artifactsOfWorkspace) остаются для вкладок-швов
 * (notes-tab); мои экраны работают через artifactItemFromDto из БД.
 */

import {
  BookOpenText,
  Clapperboard,
  Coins,
  FileCode2,
  ImagePlus,
  Music4,
  NotebookPen,
  PenTool,
  Rocket,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import { timeAgo } from "@/components/workspaces/home-data";
import type { WorkspaceTab } from "@/lib/workspace-data";
import type { ArtifactDto } from "@/lib/workspace-types";

// ─────────────────────────── types ───────────────────────────

export type ArtifactKind =
  | "note"
  | "document"
  | "portrait"
  | "image"
  | "track"
  | "scene"
  | "app"
  | "deploy";

export interface ArtifactItem {
  id: string;
  workspaceId: string;
  kind: ArtifactKind;
  title: string;
  /** Короткая мета-строка: «Глава 7 · 1 240 слов». */
  meta: string;
  /** Стадия пайплайна, к которой прицеплен артефакт (в Обзоре). */
  stage: string;
  createdAgo: string;
  gradient: string;
  /** Ссылка на готовый файл (сгенерированные изображения) — если есть. */
  url?: string | null;
}

// ─────────────────────────── meta ───────────────────────────

export const ARTIFACT_KIND_META: Record<
  ArtifactKind,
  { label: string; icon: LucideIcon; tab: WorkspaceTab }
> = {
  note: { label: "Заметка", icon: NotebookPen, tab: "notes" },
  document: { label: "Документ", icon: BookOpenText, tab: "documents" },
  portrait: { label: "Портрет", icon: UserRound, tab: "documents" },
  image: { label: "Изображение", icon: ImagePlus, tab: "images" },
  track: { label: "Трек", icon: Music4, tab: "audio" },
  scene: { label: "Сцена", icon: Clapperboard, tab: "video" },
  app: { label: "Файл кода", icon: FileCode2, tab: "code" },
  deploy: { label: "Деплой", icon: Rocket, tab: "deploy" },
};

/** Иконки для особых разделов Библиотеки (не артефакты, а модули). */
export const ARTIFACT_MONETIZE_ICON = Coins;
export const ARTIFACT_DESIGN_ICON = PenTool;

// ─────────────────────────── mock data ───────────────────────────

/** Мок-артефакты визуальной волны PS-3. */
export const MOCK_ARTIFACTS: ArtifactItem[] = [
  // — Хроники Долгой Зимы (film) —
  {
    id: "art-1",
    workspaceId: "ws-film-dwinter",
    kind: "document",
    title: "Сценарий «Хроники Долгой Зимы»",
    meta: "42 сцены · финальная правка",
    stage: "Сценарий",
    createdAgo: "3 дня назад",
    gradient: "from-sky-500/60 to-indigo-500/40",
  },
  {
    id: "art-2",
    workspaceId: "ws-film-dwinter",
    kind: "note",
    title: "Финал: Ари отпускает лёд",
    meta: "мысль · блок «Что если…»",
    stage: "Сценарий",
    createdAgo: "2 дня назад",
    gradient: "from-stone-400/50 to-stone-500/30",
  },
  {
    id: "art-3",
    workspaceId: "ws-film-dwinter",
    kind: "image",
    title: "Раскадровка — сцена 05",
    meta: "1024×576 · зимний перевал",
    stage: "Раскадровка",
    createdAgo: "вчера",
    gradient: "from-cyan-500/60 to-blue-500/40",
  },
  {
    id: "art-4",
    workspaceId: "ws-film-dwinter",
    kind: "scene",
    title: "Сцена 03 — Мост через бездну",
    meta: "0:42 · сгенерирована",
    stage: "Видеоряд",
    createdAgo: "вчера",
    gradient: "from-indigo-500/60 to-violet-500/40",
  },
  {
    id: "art-5",
    workspaceId: "ws-film-dwinter",
    kind: "track",
    title: "Озвучка — Маркел, гл. 3",
    meta: "1:10 · голос «Марк»",
    stage: "Озвучка",
    createdAgo: "16 ч назад",
    gradient: "from-amber-500/60 to-orange-500/40",
  },
  {
    id: "art-6",
    workspaceId: "ws-film-dwinter",
    kind: "scene",
    title: "Сцена 07 — Вьюга",
    meta: "1:05 · в монтаже",
    stage: "Монтаж",
    createdAgo: "12 мин назад",
    gradient: "from-sky-600/60 to-cyan-500/40",
  },
  // — Тишина фьорда (book) —
  {
    id: "art-7",
    workspaceId: "ws-book-fjord",
    kind: "document",
    title: "Глава 9. Шторм",
    meta: "1 240 слов · черновик",
    stage: "Черновик",
    createdAgo: "1 ч назад",
    gradient: "from-emerald-500/60 to-teal-500/40",
  },
  {
    id: "art-8",
    workspaceId: "ws-book-fjord",
    kind: "portrait",
    title: "Портрет: смотритель Эйнар",
    meta: "сгенерирован по описанию",
    stage: "Замысел",
    createdAgo: "2 дня назад",
    gradient: "from-teal-500/60 to-emerald-500/40",
  },
  {
    id: "art-9",
    workspaceId: "ws-book-fjord",
    kind: "note",
    title: "Система глав: два таймлайна",
    meta: "структура · 12 карточек",
    stage: "Структура",
    createdAgo: "3 дня назад",
    gradient: "from-stone-400/50 to-emerald-500/30",
  },
  // — Лунная соната №2 (music) —
  {
    id: "art-10",
    workspaceId: "ws-music-moon",
    kind: "track",
    title: "Демо «Прилив»",
    meta: "3:12 · Am · 92 BPM",
    stage: "Демо",
    createdAgo: "2 дня назад",
    gradient: "from-amber-500/60 to-rose-500/40",
  },
  {
    id: "art-11",
    workspaceId: "ws-music-moon",
    kind: "track",
    title: "Вокал — дубль 2",
    meta: "стем · +2 полутона",
    stage: "Аранжировка",
    createdAgo: "5 ч назад",
    gradient: "from-orange-500/60 to-amber-500/40",
  },
  {
    id: "art-12",
    workspaceId: "ws-music-moon",
    kind: "image",
    title: "Обложка EP",
    meta: "1200×1200 · вариант 3",
    stage: "Идея",
    createdAgo: "вчера",
    gradient: "from-rose-500/60 to-pink-500/40",
  },
  // — PocketLanding (app) —
  {
    id: "art-13",
    workspaceId: "ws-app-landing",
    kind: "app",
    title: "src/app/page.tsx",
    meta: "312 строк · правки агента",
    stage: "Код",
    createdAgo: "вчера",
    gradient: "from-violet-500/60 to-purple-500/40",
  },
  {
    id: "art-14",
    workspaceId: "ws-app-landing",
    kind: "note",
    title: "Требования к лендингу",
    meta: "спека · из заметки",
    stage: "Спека",
    createdAgo: "3 дня назад",
    gradient: "from-stone-400/50 to-violet-500/30",
  },
  {
    id: "art-15",
    workspaceId: "ws-app-landing",
    kind: "deploy",
    title: "Сборка v0.3.1",
    meta: "пройдена · готова к деплою",
    stage: "Тесты",
    createdAgo: "вчера",
    gradient: "from-fuchsia-500/60 to-violet-500/40",
  },
  // — Подкаст (universal) —
  {
    id: "art-16",
    workspaceId: "ws-uni-podcast",
    kind: "document",
    title: "Сценарий выпуска №12",
    meta: "8 блоков · хронометраж 28 мин",
    stage: "Подготовка",
    createdAgo: "2 дня назад",
    gradient: "from-emerald-500/50 to-stone-400/40",
  },
  {
    id: "art-17",
    workspaceId: "ws-uni-podcast",
    kind: "track",
    title: "Озвучка интро",
    meta: "0:34 · голос «Ника»",
    stage: "Создание",
    createdAgo: "вчера",
    gradient: "from-emerald-500/60 to-amber-500/40",
  },
];

/** Найти артефакты воркспейса. */
export function artifactsOfWorkspace(workspaceId: string): ArtifactItem[] {
  return MOCK_ARTIFACTS.filter((a) => a.workspaceId === workspaceId);
}

// ─────────────────────── БД → карточка (Фаза A) ───────────────────────

/** Дефолтные градиенты по типу артефакта (когда в meta нет tailwind-строки). */
const KIND_GRADIENTS: Record<ArtifactKind, string> = {
  note: "from-stone-500/60 to-stone-400/40",
  document: "from-emerald-600/60 to-teal-500/40",
  portrait: "from-teal-600/60 to-emerald-500/40",
  image: "from-cyan-600/60 to-sky-500/40",
  track: "from-amber-500/60 to-orange-500/40",
  scene: "from-sky-600/60 to-indigo-500/40",
  app: "from-violet-600/60 to-purple-500/40",
  deploy: "from-fuchsia-600/60 to-violet-500/40",
};

/** Служебные типы БД → один из 8 видов карточек. */
const KIND_BY_TYPE: Record<string, ArtifactKind> = {
  note: "note",
  document: "document",
  portrait: "portrait",
  image: "image",
  track: "track",
  scene: "scene",
  app: "app",
  deploy: "deploy",
  audio: "track",
  video: "scene",
  file: "app",
};

/** Принимает только tailwind-градиенты («from-… to-…»), CSS — в дефолт. */
function normalizeGradient(raw: string | undefined, kind: ArtifactKind): string {
  const trimmed = (raw ?? "").trim();
  return /^from-/.test(trimmed) ? trimmed : KIND_GRADIENTS[kind];
}

/** Артефакт из REST /api/workspaces/[id]/artifacts → карточка Обзора. */
export function artifactItemFromDto(dto: ArtifactDto): ArtifactItem {
  const meta = (dto.meta ?? {}) as Record<string, unknown>;
  const albumKind =
    typeof meta.albumKind === "string" ? meta.albumKind : null;

  let kind: ArtifactKind;
  if (albumKind === "portrait") kind = "portrait";
  else if (albumKind === "concept" || albumKind === "illustration") kind = "image";
  else kind = KIND_BY_TYPE[dto.type] ?? "app";

  return {
    id: dto.id,
    workspaceId: dto.projectId,
    kind,
    title: dto.title,
    meta:
      dto.description?.trim() ||
      ARTIFACT_KIND_META[kind].label.toLowerCase(),
    stage: dto.stage ?? "",
    createdAgo: timeAgo(dto.createdAt),
    gradient: normalizeGradient(
      typeof meta.gradient === "string" ? meta.gradient : undefined,
      kind,
    ),
    url: dto.url,
  };
}
