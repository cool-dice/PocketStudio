/**
 * Данные чата воркспейса (PS-3-d) — мок-контекст «Оркестратора».
 *
 * Вкладка «Чат» оболочки воркспейса показывает небольшую беседу
 * о КОНКРЕТНОМ воркспейсе (тип + стадия + следующий шаг из
 * overview-data) и отвечает демо-репликой до Фазы A, когда настоящий
 * оркестратор подключится к контексту воркспейса.
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
      "Смонтировать финальные сцены",
      "Сверься с кодексом мира",
      "Собери превью-сборку",
    ],
  },
  book: {
    opener: "Где мы в работе над книгой?",
    intro:
      "Рукопись под контролем: кодекс мира и персонажи синхронизированы, канон проверен на прошлой неделе.",
    prompts: [
      "Продиктую главу — запиши",
      "Проверь канон мира",
      "Собери вёрстку для публикации",
    ],
  },
  music: {
    opener: "С чего начнём работу над музыкой?",
    intro:
      "Демо-дубли на месте: стемы вокала разложены в студии, тональности подобраны.",
    prompts: [
      "Собери бит под новый трек",
      "Разложи вокал на стемы",
      "Подбери обложку релиза",
    ],
  },
  app: {
    opener: "Проверь состояние приложения",
    intro:
      "Код сгенерирован и лежит во вкладке «Код»: компоненты собираются, ошибка только в адаптиве.",
    prompts: [
      "Допиши hero-секцию по спеке",
      "Прогони тесты на 390px",
      "Задеплой preview-версию",
    ],
  },
  universal: {
    opener: "Чем занят этот воркспейс?",
    intro:
      "Все материалы выпуска собраны в одном контексте: сценарий, озвучка и обложка под рукой.",
    prompts: [
      "Собери материалы выпуска",
      "Запиши интро под музыку",
      "Сделай финальный микс",
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
 * Содержит фиксированную формулировку из плана волны PS-3-d.
 */
export function mockReplyFor(ws: WorkspaceSummary): string {
  return (
    "В разработке: оркестратор подключится к воркспейсу в Фазе A — и будет " +
    `отвечать здесь по контексту «${ws.title}» (стадия «${ws.stage}»).`
  );
}
