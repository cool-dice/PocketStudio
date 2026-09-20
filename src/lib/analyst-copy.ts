/**
 * Honest copy for the document Analyst tab.
 * A failed check must not read as “accepted issues” or “all clear”.
 */

export const ANALYST_LOAD_ERROR = "Находки не загрузились";
export const ANALYST_LOAD_ERROR_HINT =
  "Проверьте соединение и обновите вкладку — это не отчёт аналитика.";

export const ANALYST_NEVER_RAN = "Аналитик ещё не запускался";
export const ANALYST_NEVER_RAN_HINT =
  "Нажмите «Проверить документ» — находки появятся здесь только после успешной проверки.";

export const ANALYST_EMPTY_OK = "В этом прогоне противоречий нет";
export const ANALYST_EMPTY_OK_HINT =
  "Модель вернула пустой список. Это не ошибка и не заглушка.";

export const ANALYST_CHECK_FAILED = "Аналитик не справился";
export const ANALYST_CHECK_FAILED_HINT =
  "Это не отчёт о проблемах: проверка не сохранилась, список находок не менялся.";

export const ANALYST_CHECK_UNCONFIGURED_HINT =
  "Откройте Админ → Модели ИИ и назначьте модель для инструмента «Проверка документа».";

export const ANALYST_STATUS_FAILED = "Не удалось обновить находку";
export const ANALYST_NO_DOCUMENTS = "В воркспейсе пока нет документов для проверки.";
export const ANALYST_NOTHING_TO_CHECK = "Проверять пока нечего";
export const ANALYST_NOTHING_TO_CHECK_HINT =
  "Создайте документ во вкладке «Рукопись» — затем возвращайтесь к Аналитику.";
