/**
 * Обзор воркспейса — хелперы оболочки (Фаза A: работают и с WorkspaceDto,
 * и с легаси WorkspaceSummary вкладок-швов).
 *
 * Здесь живут честные подсказки пайплайна (generic copy, не сид-история),
 * вкладка работы стадии, быстрые действия и мелкие утилиты.
 */

import {
  AudioWaveform,
  BookOpenText,
  Clapperboard,
  Coins,
  FileCode2,
  ImagePlus,
  NotebookPen,
  Rocket,
  Sparkles,
  Wand2,
  type LucideIcon,
} from "lucide-react";

import {
  PIPELINE_RELEASE_STAGE,
  WORKSPACE_STAGES,
  WORKSPACE_TABS_BY_TYPE,
  type WorkspaceTab,
  type WorkspaceType,
} from "@/lib/workspace-data";
import {
  nextStepOf as nextStepFromCopy,
  type NextStepPrompt,
} from "@/lib/overview-copy";

export type { NextStepPrompt };
export { NEXT_STEP_PROMPTS } from "@/lib/overview-copy";

/**
 * Минимальная форма воркспейса для стадийных хелперов: ей удовлетворяют
 * и WorkspaceDto (Фаза A), и легаси WorkspaceSummary вкладок-швов.
 */
export interface StageSource {
  type: WorkspaceType;
  stage?: string | null;
  stageIndex?: number | null;
}

// ─────────────────────── малые утилиты ───────────────────────

/** Русская форма множественного числа: pluralRu(3, "артефакт", "артефакта", "артефактов"). */
export function pluralRu(n: number, one: string, few: string, many: string): string {
  const mod10 = Math.abs(n) % 10;
  const mod100 = Math.abs(n) % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

/** «6 артефактов» / «1 артефакт» / «2 артефакта». */
export function pluralArtifacts(n: number): string {
  return `${n} ${pluralRu(n, "артефакт", "артефакта", "артефактов")}`;
}

/** «14 заметок» / «1 заметка» / «3 заметки». */
export function pluralNotes(n: number): string {
  return `${n} ${pluralRu(n, "заметка", "заметки", "заметок")}`;
}

/** 0-based индекс текущей стадии, зажатый в границы пайплайна типа. */
export function currentStageIndex(ws: StageSource): number {
  const pipelineLength = WORKSPACE_STAGES[ws.type].length;
  const stageIndex = ws.stageIndex ?? 1;
  return Math.min(Math.max(stageIndex, 1), pipelineLength) - 1;
}

export type StageStatus = "done" | "current" | "todo";

/** Статус стадии по её 0-based индексу относительно текущей. */
export function stageStatusOf(index: number, ws: StageSource): StageStatus {
  const current = currentStageIndex(ws);
  if (index < current) return "done";
  if (index === current) return "current";
  return "todo";
}

/** Подпись статуса стадии для человека. */
export const STAGE_STATUS_LABEL: Record<StageStatus, string> = {
  done: "готово",
  current: "в работе",
  todo: "впереди",
};

/**
 * Вкладка вклада, в которую ведёт работа стадии; если у типа нет такой
 * вкладки (напр. «аудио» у фильма) — ведём в чат к оркестратору.
 */
export function resolveWorkspaceTab(
  ws: Pick<StageSource, "type">,
  tab: WorkspaceTab,
): WorkspaceTab {
  return WORKSPACE_TABS_BY_TYPE[ws.type].includes(tab) ? tab : "chat";
}

/** Подсказка «что делать сейчас» — generic copy, не сид-история. */
export function nextStepOf(ws: StageSource): NextStepPrompt {
  return nextStepFromCopy(ws);
}

/** Вкладка, где живёт работа стадии (всегда в пределах типа воркспейса). */
export const STAGE_WORK_TABS: Record<WorkspaceType, Record<string, WorkspaceTab>> = {
  film: {
    Сценарий: "documents",
    Раскадровка: "images",
    Видеоряд: "video",
    Озвучка: "video",
    Монтаж: "video",
    [PIPELINE_RELEASE_STAGE]: "monetize",
  },
  book: {
    Замысел: "notes",
    Структура: "documents",
    Черновик: "documents",
    Правка: "documents",
    Вёрстка: "design",
    [PIPELINE_RELEASE_STAGE]: "monetize",
  },
  music: {
    Идея: "notes",
    Демо: "audio",
    Аранжировка: "audio",
    Сведение: "audio",
    Релиз: "monetize",
  },
  app: {
    Идея: "notes",
    Спека: "documents",
    Код: "code",
    Тесты: "code",
    Деплой: "deploy",
    Мониторинг: "deploy",
  },
  universal: {
    Подготовка: "notes",
    Создание: "audio",
    Сборка: "video",
    [PIPELINE_RELEASE_STAGE]: "monetize",
  },
};

// ─────────────────────── быстрые действия Обзора ───────────────────────

export interface QuickAction {
  label: string;
  icon: LucideIcon;
  tab: WorkspaceTab;
}

export const QUICK_ACTIONS: Record<WorkspaceType, QuickAction[]> = {
  film: [
    { label: "Сгенерировать сцену", icon: Clapperboard, tab: "video" },
    { label: "Нарисовать кадр", icon: ImagePlus, tab: "images" },
    { label: "Открыть сценарий", icon: BookOpenText, tab: "documents" },
  ],
  book: [
    { label: "Написать главу", icon: NotebookPen, tab: "documents" },
    { label: "Сгенерировать портрет", icon: Sparkles, tab: "documents" },
    { label: "Спросить оркестратора", icon: Wand2, tab: "chat" },
  ],
  music: [
    { label: "Собрать трек", icon: AudioWaveform, tab: "audio" },
    { label: "Обложка релиза", icon: ImagePlus, tab: "design" },
    { label: "Текст песни", icon: NotebookPen, tab: "notes" },
  ],
  app: [
    { label: "Открыть код", icon: FileCode2, tab: "code" },
    { label: "Dockerfile и zip", icon: Rocket, tab: "deploy" },
    { label: "Сводка дохода", icon: Coins, tab: "monetize" },
  ],
  universal: [
    { label: "Записать заметку", icon: NotebookPen, tab: "notes" },
    { label: "Спросить оркестратора", icon: Sparkles, tab: "chat" },
    { label: "План монетизации", icon: Rocket, tab: "monetize" },
  ],
};

