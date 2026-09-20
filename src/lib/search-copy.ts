/** Honest Russian copy for ⌘P: empty is not an error, error is not empty. */

export const SEARCH_MIN_HINT = "Введите минимум 2 символа";
export const SEARCH_HINT_GLOBAL =
  "диалоги · заметки · воркспейсы · код-проекты · документы · сущности · артефакты";
export const SEARCH_HINT_WORKSPACE = "Ищем в открытом воркспейсе";
export const SEARCH_LOADING = "Ищем…";
export const SEARCH_ERROR = "Поиск не удался";
export const SEARCH_ERROR_HINT =
  "Это не пустой результат — проверьте соединение и повторите.";
export const SEARCH_RETRY = "Повторить";
export const SEARCH_TITLE = "Поиск по PocketStudio";
export const SEARCH_DESCRIPTION =
  "Диалоги, заметки, воркспейсы, код-проекты, документы, сущности и артефакты";
export const SEARCH_PLACEHOLDER_GLOBAL =
  "Поиск по диалогам, заметкам, воркспейсам, код-проектам, документам…";
export const SEARCH_PLACEHOLDER_WORKSPACE = "Поиск в этом воркспейсе…";
export const SEARCH_GROUP_WORKSPACES = "Воркспейсы";
export const SEARCH_GROUP_CODE_PROJECTS = "Код-проекты";
export const SEARCH_GROUP_THREADS = "Диалоги";
export const SEARCH_GROUP_NOTES = "Заметки";
export const SEARCH_GROUP_DOCUMENTS = "Документы";
export const SEARCH_GROUP_ENTITIES = "Сущности";
export const SEARCH_GROUP_ARTIFACTS = "Артефакты";

export function searchEmptyMessage(query: string): string {
  return `Ничего не нашлось по «${query}». Попробуйте другое слово.`;
}
