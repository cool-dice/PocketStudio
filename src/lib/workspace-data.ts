/**
 * Workspace model — единый творческий контекст (PS-3).
 *
 * Воркспейс = эволюция «проекта»: контейнер всего творчества одного
 * замысла (заметки, документы, медиа, код, деплой, доход). Тип воркспейса
 * задаёт стадийный пайплайн Обзора и состав вкладок оболочки.
 *
 * Пока это визуальная мета (типы, вкладки, стадии). Список воркспейсов
 * живёт в БД (`/api/workspaces`). MOCK_WORKSPACES ниже — только для
 * `scripts/seed-workspaces.ts`, UI их не читает.
 */

import {
  AudioWaveform,
  BookOpenText,
  Clapperboard,
  Code,
  Coins,
  FolderKanban,
  ImagePlus,
  LayoutDashboard,
  MessageSquare,
  Music4,
  NotebookPen,
  PenTool,
  Rocket,
  ScrollText,
  Shapes,
  type LucideIcon,
} from "lucide-react";

// ─────────────────────────── types ───────────────────────────

export type WorkspaceType = "film" | "book" | "music" | "app" | "universal";

export type WorkspaceTab =
  | "overview"
  | "chat"
  | "notes"
  | "documents"
  | "images"
  | "audio"
  | "video"
  | "code"
  | "design"
  | "deploy"
  | "monetize";

export interface WorkspaceSummary {
  id: string;
  type: WorkspaceType;
  title: string;
  subtitle: string;
  description: string;
  /** Человеческая стадия, напр. «Монтаж». */
  stage: string;
  /** 1-based индекс текущей стадии в WORKSPACE_STAGES[type]. */
  stageIndex: number;
  /** 0–100, для прогресс-бара. */
  progress: number;
  updatedAgo: string;
  /** Tailwind-градиент для плитки-обложки. */
  gradient: string;
  counts: {
    notes: number;
    documents: number;
    images: number;
    audio: number;
    video: number;
    files: number;
  };
}

// ─────────────────────────── meta ───────────────────────────

export const WORKSPACE_TYPE_META: Record<
  WorkspaceType,
  { label: string; icon: LucideIcon; hint: string; gradient: string }
> = {
  film: {
    label: "Фильм",
    icon: Clapperboard,
    hint: "Сценарий → раскадровка → видеоряд → озвучка → монтаж → публикация",
    gradient: "from-sky-500/70 via-indigo-500/40 to-violet-500/60",
  },
  book: {
    label: "Книга",
    icon: BookOpenText,
    hint: "Замысел → структура → черновик → правка → вёрстка → публикация",
    gradient: "from-emerald-500/70 via-teal-500/40 to-cyan-500/60",
  },
  music: {
    label: "Музыка",
    icon: Music4,
    hint: "Идея → демо → аранжировка → сведение → релиз",
    gradient: "from-amber-500/70 via-orange-500/40 to-rose-500/60",
  },
  app: {
    label: "Приложение",
    icon: Code,
    hint: "Идея → спека → код → тесты → деплой → мониторинг",
    gradient: "from-violet-500/70 via-purple-500/40 to-fuchsia-500/60",
  },
  universal: {
    label: "Универсальный",
    icon: Shapes,
    hint: "Свободный воркспейс: любые артефакты в одном контексте",
    gradient: "from-stone-500/70 via-stone-400/40 to-emerald-500/50",
  },
};

/** Стадийный пайплайн Обзора по типу воркспейса. */
export const WORKSPACE_STAGES: Record<WorkspaceType, string[]> = {
  film: ["Сценарий", "Раскадровка", "Видеоряд", "Озвучка", "Монтаж", "Публикация"],
  book: ["Замысел", "Структура", "Черновик", "Правка", "Вёрстка", "Публикация"],
  music: ["Идея", "Демо", "Аранжировка", "Сведение", "Релиз"],
  app: ["Идея", "Спека", "Код", "Тесты", "Деплой", "Мониторинг"],
  universal: ["Подготовка", "Создание", "Сборка", "Публикация"],
};

/** Единая строка вкладок оболочки воркспейса (состав зависит от типа).
 *  Chat-first: «Чат» — первая вкладка любого типа: оркестратор
 *  открывается сразу, а Обзор/модули доступны рядом. */
export const WORKSPACE_TABS_BY_TYPE: Record<WorkspaceType, WorkspaceTab[]> = {
  film: ["chat", "overview", "notes", "documents", "images", "video", "design", "monetize"],
  book: ["chat", "overview", "notes", "documents", "design", "monetize"],
  music: ["chat", "overview", "notes", "audio", "design", "monetize"],
  app: ["chat", "overview", "notes", "code", "design", "deploy", "monetize"],
  universal: [
    "chat", "overview", "notes", "documents", "images", "audio", "video", "design", "deploy", "monetize",
  ],
};

export const WORKSPACE_TAB_META: Record<
  WorkspaceTab,
  { label: string; icon: LucideIcon }
> = {
  overview: { label: "Обзор", icon: LayoutDashboard },
  chat: { label: "Чат", icon: MessageSquare },
  notes: { label: "Заметки", icon: NotebookPen },
  documents: { label: "Документы", icon: BookOpenText },
  images: { label: "Изображения", icon: ImagePlus },
  audio: { label: "Аудио", icon: AudioWaveform },
  video: { label: "Видео", icon: Clapperboard },
  code: { label: "Код", icon: FolderKanban },
  design: { label: "Дизайн", icon: PenTool },
  deploy: { label: "Деплой", icon: Rocket },
  monetize: { label: "Доход", icon: Coins },
};

/** Русская подпись типа пайплайна для заголовков Обзора. */
export const WORKSPACE_PIPELINE_TITLE: Record<WorkspaceType, string> = {
  film: "Конвейер фильма",
  book: "Путь книги",
  music: "Путь трека",
  app: "Жизненный цикл приложения",
  universal: "Конвейер воркспейса",
};

// ─────────────────────────── mock data ───────────────────────────

/** Демо-воркспейсы для `scripts/seed-workspaces.ts`. Не импортировать в UI. */
export const MOCK_WORKSPACES: WorkspaceSummary[] = [
  {
    id: "ws-film-dwinter",
    type: "film",
    title: "Хроники Долгой Зимы",
    subtitle: "Короткометражка по собственной новелле",
    description:
      "Экранизация новеллы об Ари и картефе Долгой Зимы: сценарий готов, раскадровка собрана, идёт монтаж финальных сцен.",
    stage: "Монтаж",
    stageIndex: 5,
    progress: 78,
    updatedAgo: "12 мин назад",
    gradient: "from-sky-500/70 via-indigo-500/40 to-violet-500/60",
    counts: { notes: 14, documents: 3, images: 9, audio: 4, video: 8, files: 2 },
  },
  {
    id: "ws-book-fjord",
    type: "book",
    title: "Тишина фьорда",
    subtitle: "Психологический роман, черновик",
    description:
      "История смотрителя маяка и лета, которое изменило всё. Сущности мира и портреты героев ведутся в документах.",
    stage: "Черновик",
    stageIndex: 3,
    progress: 44,
    updatedAgo: "1 ч назад",
    gradient: "from-emerald-500/70 via-teal-500/40 to-cyan-500/60",
    counts: { notes: 22, documents: 5, images: 3, audio: 0, video: 0, files: 0 },
  },
  {
    id: "ws-music-moon",
    type: "music",
    title: "Лунная соната №2",
    subtitle: "EP из четырёх треков",
    description:
      "Электронный EP с живыми стемами вокала: демо записаны, идёт сведение и подбор тональностей.",
    stage: "Сведение",
    stageIndex: 4,
    progress: 70,
    updatedAgo: "3 ч назад",
    gradient: "from-amber-500/70 via-orange-500/40 to-rose-500/60",
    counts: { notes: 6, documents: 1, images: 2, audio: 11, video: 0, files: 0 },
  },
  {
    id: "ws-app-landing",
    type: "app",
    title: "PocketLanding",
    subtitle: "Лендинг для запуска студии",
    description:
      "Next.js-приложение: код сгенерирован оркестратором, проходит тесты перед первым деплоем.",
    stage: "Тесты",
    stageIndex: 4,
    progress: 62,
    updatedAgo: "вчера",
    gradient: "from-violet-500/70 via-purple-500/40 to-fuchsia-500/60",
    counts: { notes: 5, documents: 2, images: 4, audio: 0, video: 0, files: 23 },
  },
  {
    id: "ws-uni-podcast",
    type: "universal",
    title: "Подкаст «Тёплый ламповый»",
    subtitle: "Выпуск №12: голоса и монтаж",
    description:
      "Универсальный воркспейс выпуска: сценарий, озвучка, обложка и сборка финального микса.",
    stage: "Создание",
    stageIndex: 2,
    progress: 38,
    updatedAgo: "вчера",
    gradient: "from-stone-500/70 via-stone-400/40 to-emerald-500/50",
    counts: { notes: 8, documents: 2, images: 1, audio: 6, video: 1, files: 0 },
  },
  {
    id: "ws-film-anna",
    type: "film",
    title: "Клип для Анны",
    subtitle: "Свадебный клип, 3 минуты",
    description:
      "Подарочный клип: идея утверждена, готовится раскадровка из архивных кадров и новых сцен.",
    stage: "Раскадровка",
    stageIndex: 2,
    progress: 22,
    updatedAgo: "2 дня назад",
    gradient: "from-rose-500/70 via-pink-500/40 to-orange-500/60",
    counts: { notes: 4, documents: 1, images: 6, audio: 2, video: 1, files: 0 },
  },
];

/** Найти мок-воркспейс по id. */
export function findWorkspace(id: string | null): WorkspaceSummary | null {
  if (!id) return null;
  return MOCK_WORKSPACES.find((ws) => ws.id === id) ?? null;
}

/** Иконка-заглушка для дефолтных состояний. */
export const WORKSPACE_FALLBACK_ICON = ScrollText;
