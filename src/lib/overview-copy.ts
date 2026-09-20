/**
 * Honest overview «Дальше» copy. Seed-story names, 4K, host deploys and
 * «запрос отправлен» are never shown as live status of this workspace.
 */

import {
  PIPELINE_RELEASE_STAGE,
  WORKSPACE_STAGES,
  canonicalStageLabel,
  type WorkspaceType,
} from "./workspace-data";

export interface NextStepPrompt {
  /** Generic action for the current pipeline stage. */
  title: string;
  /** One-line hint — what the module actually does. */
  hint: string;
}

export const OVERVIEW_NEXT_FALLBACK: NextStepPrompt = {
  title: "Продолжить работу над стадией",
  hint: "Откройте нужный модуль или спросите оркестратора в чате — он не видит этот экран сам.",
};

/** Generic next-step prompts: one per type × stage, no seed characters. */
export const NEXT_STEP_PROMPTS: Record<
  WorkspaceType,
  Record<string, NextStepPrompt>
> = {
  film: {
    Сценарий: {
      title: "Писать и править сценарий",
      hint: "Главы живут во вкладке «Документы». Противоречия появятся у аналитика только после проверки.",
    },
    Раскадровка: {
      title: "Собрать кадры сцен",
      hint: "Генерация — во вкладках «Изображения» и «Видео». Пустая раскадровка не фильм.",
    },
    Видеоряд: {
      title: "Дорисовать недостающие кадры",
      hint: "Сборка WebM стартует, только если есть хотя бы один кадр.",
    },
    Озвучка: {
      title: "Озвучить сцены",
      hint: "TTS пишет файл в аудиотеку. Без модели — ошибка, не готовая дорожка.",
    },
    Монтаж: {
      title: "Собрать WebM из сцен",
      hint: "Браузерный рендер или ffmpeg, если он есть. Не Premiere и не выкладка на хост.",
    },
    [PIPELINE_RELEASE_STAGE]: {
      title: "Скачать файлы и собрать оффер",
      hint: "ZIP и WebM остаются в студии. Внешний хост и карточные выплаты — не эта кнопка.",
    },
  },
  book: {
    Замысел: {
      title: "Зафиксировать тему в заметках",
      hint: "Один абзац замысла — без выдуманного прогресса по главам.",
    },
    Структура: {
      title: "Разложить главы в документах",
      hint: "Оглавление появляется после сохранения разделов, не заранее.",
    },
    Черновик: {
      title: "Писать главы",
      hint: "Текст живёт в рукописи. Пустая глава — кнопка «Написать», не готовый том.",
    },
    Правка: {
      title: "Прогнать аналитика по рукописи",
      hint: "Находки появятся только после успешной проверки.",
    },
    Вёрстка: {
      title: "Собрать обложку в дизайне",
      hint: "Растр и макет — ручные правки, не магазинная вёрстка.",
    },
    [PIPELINE_RELEASE_STAGE]: {
      title: "Собрать оффер в студии",
      hint: "Цена и статус живут здесь. Магазины и карточные выплаты не подключены.",
    },
  },
  music: {
    Идея: {
      title: "Записать тему в заметку",
      hint: "Оркестратор разложит гармонию по запросу — не сам, без вашей темы.",
    },
    Демо: {
      title: "Собрать черновой трек в DAW",
      hint: "Дорожки и WAV — в аудиомодуле. Чужой демо-дубль сюда не подставляется.",
    },
    Аранжировка: {
      title: "Разложить дорожки",
      hint: "Карманная DAW, не FL Studio и не готовые чужие партии.",
    },
    Сведение: {
      title: "Свести и экспортировать WAV",
      hint: "Экспорт пишет файл в библиотеку. Пустой микс не «мастер готов».",
    },
    Релиз: {
      title: "Собрать оффер и файлы в студии",
      hint: "Площадки и пресс-кит не подключены — только кабинет студии.",
    },
  },
  app: {
    Идея: {
      title: "Сформулировать задачу в заметках",
      hint: "Метрика лендинга — ваша формулировка, не готовый KPI из макета.",
    },
    Спека: {
      title: "Написать спеку в документах",
      hint: "Блоки появятся после сохранения глав, не из чужого лендинга.",
    },
    Код: {
      title: "Править файлы в IDE",
      hint: "Реальные файлы проекта на диске. Чужой лендинг сюда не подставляется.",
    },
    Тесты: {
      title: "Открыть статическое превью",
      hint: "Это HTML из файлов, не запущенный Next и не прогон на iPad.",
    },
    Деплой: {
      title: "Собрать Dockerfile и ZIP",
      hint: "docker build если демон есть, иначе честный статус «нет демона». Образ не публикуется.",
    },
    Мониторинг: {
      title: "Смотреть локальный preview и логи сборки",
      hint: "Прод-хост и живая воронка не подключены.",
    },
  },
  universal: {
    Подготовка: {
      title: "Собрать материалы в заметках",
      hint: "Ссылки и черновики — ваши. Готовый выпуск сюда не подставляется.",
    },
    Создание: {
      title: "Создать артефакты в модулях",
      hint: "Текст, картинка, трек — после генерации. Без файла голос не играет.",
    },
    Сборка: {
      title: "Экспортировать файлы",
      hint: "ZIP, WAV или WebM из того, что уже есть. Это не публикация на площадку.",
    },
    [PIPELINE_RELEASE_STAGE]: {
      title: "Собрать оффер в студии",
      hint: "Кабинет выплат симулирует оплату. Карточная сеть не подключена.",
    },
  },
};

export function nextStepOf(ws: {
  type: WorkspaceType;
  stage?: string | null;
}): NextStepPrompt {
  const byStage = NEXT_STEP_PROMPTS[ws.type];
  const stage = ws.stage ? canonicalStageLabel(ws.stage) : undefined;
  return (stage ? byStage[stage] : undefined) ?? OVERVIEW_NEXT_FALLBACK;
}

/** Draft sent to the workspace thread — never toast this as already delivered. */
export function overviewAskDraft(
  workspaceName: string,
  stage: string,
  prompt: NextStepPrompt,
): string {
  return [
    `Воркспейс «${workspaceName}», стадия «${stage}».`,
    `${prompt.title}.`,
    prompt.hint,
    "Что предложишь сделать дальше в этом воркспейсе?",
  ].join(" ");
}

export function overviewNextStepBlob(): string {
  const lines: string[] = [OVERVIEW_NEXT_FALLBACK.title, OVERVIEW_NEXT_FALLBACK.hint];
  for (const type of Object.keys(NEXT_STEP_PROMPTS) as WorkspaceType[]) {
    for (const stage of WORKSPACE_STAGES[type]) {
      const prompt = NEXT_STEP_PROMPTS[type][stage];
      if (!prompt) continue;
      lines.push(prompt.title, prompt.hint);
    }
  }
  return lines.join("\n");
}
