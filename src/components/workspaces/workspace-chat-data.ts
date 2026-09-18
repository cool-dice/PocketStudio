/**
 * Данные чата воркспейса (PS-3-d → PS-3.2-a) — мок-контекст «Оркестратора».
 *
 * Оркестратор — ГЛАВНЫЙ инструмент студии: по описанной задаче он
 * генерирует контент и вызывает нужный модуль. Вкладка «Чат» оболочки
 * показывает небольшую беседу о КОНКРЕТНОМ воркспейсе (тип + стадия +
 * следующий шаг из overview-data) и отвечает демо-репликой до Фазы A,
 * когда настоящий оркестратор подключится к контексту воркспейса.
 */

import { nextStepOf } from "@/components/workspaces/overview-data";
import {
  WORKSPACE_TYPE_META,
  type WorkspaceSummary,
  type WorkspaceType,
} from "@/lib/workspace-data";

export interface WorkspaceChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

interface ChatFlavor {
  /** Реплика-открытие пользователя. */
  opener: string;
  /** Первая реплика оркестратора (до деталей воркспейса). */
  intro: string;
  /** Быстрые подсказки композера. */
  prompts: string[];
}

const CHAT_FLAVOR: Record<WorkspaceType, ChatFlavor> = {
  film: {
    opener: "Проверь, чем занят фильм прямо сейчас?",
    intro:
      "Слежу за конвейером: сценарий и раскадровка в порядке, съёмочный материал собран в медиатеке.",
    prompts: [
      "Напиши сцену погони",
      "Собери раскадровку 12–18",
      "Сгенерируй кадр-референс",
      "Озвучь реплики Маркела",
    ],
  },
  book: {
    opener: "Где мы в работе над книгой?",
    intro:
      "Рукопись под контролем: сущности и таймлайны синхронизированы, аналитик прогонял текст на прошлой неделе.",
    prompts: [
      "Напиши главу 5 по плану",
      "Сверься с сущностями мира",
      "Прогони аналитика по рукописи",
      "Сгенерируй обложку",
    ],
  },
  music: {
    opener: "С чего начнём работу над музыкой?",
    intro:
      "Демо-дубли на месте: стемы вокала разложены в студии, тональности подобраны.",
    prompts: [
      "Набросай демо в ля-миноре",
      "Разложи песню на стемы",
      "Подбери тональность вокалу",
    ],
  },
  app: {
    opener: "Проверь состояние приложения",
    intro:
      "Код сгенерирован и лежит во вкладке «Код»: компоненты собираются, ошибка только в адаптиве.",
    prompts: [
      "Собери лендинг релиза",
      "Прогони тесты",
      "Задеплой превью",
    ],
  },
  universal: {
    opener: "Чем занят этот воркспейс?",
    intro:
      "Все материалы выпуска собраны в одном контексте: сценарий, озвучка и обложка под рукой.",
    prompts: [
      "Черновик документа",
      "Сгенерируй арт",
      "Проверь текст аналитиком",
    ],
  },
};

/** Начальная беседа (4 реплики) о конкретном воркспейсе. */
export function chatSeedFor(ws: WorkspaceSummary): WorkspaceChatMessage[] {
  const flavor = CHAT_FLAVOR[ws.type];
  const typeMeta = WORKSPACE_TYPE_META[ws.type];
  const step = nextStepOf(ws);
  return [
    { id: "seed-1", role: "user", text: flavor.opener },
    {
      id: "seed-2",
      role: "assistant",
      text:
        `${flavor.intro} Воркспейс «${ws.title}» — тип «${typeMeta.label}», ` +
        `текущая стадия «${ws.stage}» (${ws.progress}% пути).`,
    },
    { id: "seed-3", role: "user", text: "Что делать дальше?" },
    {
      id: "seed-4",
      role: "assistant",
      text: `${step.title}. ${step.hint}`,
    },
  ];
}

/** Быстрые подсказки по типу воркспейса. */
export function chatPromptsOf(ws: WorkspaceSummary): string[] {
  return CHAT_FLAVOR[ws.type].prompts;
}

/**
 * Демо-ответ оркестратора на новое сообщение (до Фазы A).
 * Оркестратор — главный инструмент: принимает задачу, генерирует
 * контент и открывает нужный модуль воркспейса.
 */
export function mockReplyFor(ws: WorkspaceSummary): string {
  return (
    "Демо до Фазы A: здесь оркестратор — главный инструмент — поймёт задачу, " +
    `соберёт контент и откроет нужный модуль воркспейса «${ws.title}» ` +
    `(стадия «${ws.stage}»).`
  );
}
