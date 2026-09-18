/**
 * Обзор воркспейса — хелперы оболочки (Фаза A: работают и с WorkspaceDto,
 * и с легаси WorkspaceSummary вкладок-швов).
 *
 * Здесь живут «живые» подсказки пайплайна: что делать дальше на текущей
 * стадии, к какой вкладке ведёт работа стадии, быстрые действия по типу
 * воркспейса и мелкие утилиты (множественное число, статус стадии).
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
  WORKSPACE_STAGES,
  WORKSPACE_TABS_BY_TYPE,
  type WorkspaceTab,
  type WorkspaceType,
} from "@/lib/workspace-data";

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

// ─────────────────────── «Дальше»: подсказка пайплайна ───────────────────────

export interface NextStepPrompt {
  /** Действие текущей стадии, которое приблизит переход. */
  title: string;
  /** Пояснение одной строкой. */
  hint: string;
}

/** Подсказка «что делать сейчас» по типу и текущей стадии воркспейса. */
export const NEXT_STEP_PROMPTS: Record<WorkspaceType, Record<string, NextStepPrompt>> = {
  film: {
    Сценарий: {
      title: "Прогнать сцену 12 и закрыть сценарий",
      hint: "Оркестратор собрал замечания по диалогам — осталось внести их в финал.",
    },
    Раскадровка: {
      title: "Утвердить раскадровку финала",
      hint: "Шесть кадров перевала ждут пометки «ок» — и видеоряд начнёт собираться сам.",
    },
    Видеоряд: {
      title: "Собрать недостающие планы перевала",
      hint: "Не хватает двух общих планов вьюги и одного крупного — Ари у карты.",
    },
    Озвучка: {
      title: "Записать реплики Маркела в сцене 9",
      hint: "Голос «Марк» уже прогрет — дубль уйдёт прямо в монтаж.",
    },
    Монтаж: {
      title: "Смонтировать финальные сцены",
      hint: "Остались склейки сцен 6–8 и титр с картой — дальше только публикация.",
    },
    Публикация: {
      title: "Опубликовать фильм и собрать отклики",
      hint: "Экспорт в 4K готов: выберите площадки и анонсируйте премьеру.",
    },
  },
  book: {
    Замысел: {
      title: "Зафиксировать тему и конфликт романа",
      hint: "Одним абзацем: чего хочет смотритель и что ему мешает.",
    },
    Структура: {
      title: "Разложить главы по двум таймлайнам",
      hint: "Лето маяка и зима после — чередование уже почти сложилось.",
    },
    Черновик: {
      title: "Дописать главу 9 «Шторм»",
      hint: "До конца недели: 1 240 слов уже есть, осталось 600.",
    },
    Правка: {
      title: "Прогнать главу 3 по чек-листу правок",
      hint: "Оркестратор собрал 12 замечаний — от темпа до речевых тиков Эйнара.",
    },
    Вёрстка: {
      title: "Собрать вёрстку титульных страниц",
      hint: "Шапка, посвящение и карта фьорда — последний взгляд перед публикацией.",
    },
    Публикация: {
      title: "Опубликовать книгу на площадках",
      hint: "Выберите магазины и цену — обложка и аннотация уже готовы.",
    },
  },
  music: {
    Идея: {
      title: "Записать напев основной темы",
      hint: "Одним дублем в заметку-композитор — оркестратор разложит по гармонии.",
    },
    Демо: {
      title: "Свести демо-дубль трека «Прилив»",
      hint: "Голос сел в долю — осталось подровнять бридж.",
    },
    Аранжировка: {
      title: "Расписать партии струнных в припеве",
      hint: "Вокал держит climax — струнным не хватает воздуха во второй куплет.",
    },
    Сведение: {
      title: "Подровнять вокал против бита",
      hint: "Два стема перекрывают хэт — сдвиньте на полтакта.",
    },
    Релиз: {
      title: "Выпустить EP и разослать пресс-кит",
      hint: "Мастер готов: обложка, метаданные и питч для площадок.",
    },
  },
  app: {
    Идея: {
      title: "Сформулировать ключевую метрику лендинга",
      hint: "Одна цифра решает дизайн: заявки, подписки или звонки.",
    },
    Спека: {
      title: "Согласовать состав блоков лендинга",
      hint: "Hero, кейсы, цены, FAQ — отметить, что режем до первого релиза.",
    },
    Код: {
      title: "Дописать hero-секцию по спеке",
      hint: "Оркестратор держит компоненты — остался адаптив и микровзаимодействия.",
    },
    Тесты: {
      title: "Прогнать сборку на реальных экранах",
      hint: "390px, iPad и 1440 — расхождение в 12px уже зафиксировано.",
    },
    Деплой: {
      title: "Задеплоить preview-версию",
      hint: "Сборка v0.3.1 зелёная — можно выкатывать на хост.",
    },
    Мониторинг: {
      title: "Следить за метриками первой недели",
      hint: "Воронка и время на странице приходят в сводку «Доход».",
    },
  },
  universal: {
    Подготовка: {
      title: "Собрать материалы выпуска в одном месте",
      hint: "Ссылки, цитаты и гости — пока в заметках, разложите по блокам.",
    },
    Создание: {
      title: "Записать интро выпуска",
      hint: "Голос «Ника» уже прогрет — 34 секунды тёплого вступления.",
    },
    Сборка: {
      title: "Собрать финальный микс выпуска",
      hint: "Склеить блоки, убрать паузы и добавить перебивки под музыку.",
    },
    Публикация: {
      title: "Опубликовать выпуск и анонсировать",
      hint: "Обложка готова — выберите площадки и время выхода.",
    },
  },
};

/** Подсказка для текущей стадии (fallback — по типу, из hint-структуры). */
export function nextStepOf(ws: StageSource): NextStepPrompt {
  const byStage = NEXT_STEP_PROMPTS[ws.type];
  return (
    (ws.stage ? byStage[ws.stage] : undefined) ?? {
      title: "Продолжить работу над стадией",
      hint: "Оркестратор подскажет следующий шаг.",
    }
  );
}

/** Вкладка, где живёт работа стадии (всегда в пределах типа воркспейса). */
export const STAGE_WORK_TABS: Record<WorkspaceType, Record<string, WorkspaceTab>> = {
  film: {
    Сценарий: "documents",
    Раскадровка: "images",
    Видеоряд: "video",
    Озвучка: "video",
    Монтаж: "video",
    Публикация: "monetize",
  },
  book: {
    Замысел: "notes",
    Структура: "documents",
    Черновик: "documents",
    Правка: "documents",
    Вёрстка: "design",
    Публикация: "monetize",
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
    Публикация: "monetize",
  },
};

// ─────────────────────── быстрые действия Обзора ───────────────────────

export interface QuickAction {
  label: string;
  icon: LucideIcon;
  tab: WorkspaceTab;
  /** Генерация ещё не настоящая — вешаем бейдж «В разработке». */
  wip?: boolean;
}

export const QUICK_ACTIONS: Record<WorkspaceType, QuickAction[]> = {
  film: [
    { label: "Сгенерировать сцену", icon: Clapperboard, tab: "video", wip: true },
    { label: "Нарисовать кадр", icon: ImagePlus, tab: "images" },
    { label: "Открыть сценарий", icon: BookOpenText, tab: "documents" },
  ],
  book: [
    { label: "Написать главу", icon: NotebookPen, tab: "documents" },
    { label: "Сгенерировать портрет", icon: Sparkles, tab: "documents", wip: true },
    { label: "Спросить оркестратора", icon: Wand2, tab: "chat" },
  ],
  music: [
    { label: "Собрать трек", icon: AudioWaveform, tab: "audio" },
    { label: "Обложка релиза", icon: ImagePlus, tab: "design" },
    { label: "Текст песни", icon: NotebookPen, tab: "notes" },
  ],
  app: [
    { label: "Сгенерировать компонент", icon: FileCode2, tab: "code", wip: true },
    { label: "Задеплоить превью", icon: Rocket, tab: "deploy", wip: true },
    { label: "Сводка дохода", icon: Coins, tab: "monetize" },
  ],
  universal: [
    { label: "Записать заметку", icon: NotebookPen, tab: "notes" },
    { label: "Сгенерировать артефакт", icon: Sparkles, tab: "chat", wip: true },
    { label: "Опубликовать", icon: Rocket, tab: "monetize", wip: true },
  ],
};

