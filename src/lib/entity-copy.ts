/**
 * Honest copy for the entity catalog and the open card sheet.
 * Empty fields on a card must not read as «there are no characters in the world».
 */

export const ENTITY_TAB_LOAD_ERROR = "Сущности не загрузились";
export const ENTITY_TAB_LOAD_ERROR_HINT =
  "Проверьте соединение и обновите вкладку — это не пустой набор карточек.";

export const ENTITY_TAB_EMPTY = "Сущностей пока нет";
export const ENTITY_TAB_EMPTY_HINT =
  "Создайте первую запись: для книги это персонажи и локации, для документации — пользователи, роли и требования.";

export const ENTITY_TAB_FILTER_EMPTY = "Сущностей не нашлось";
export const ENTITY_TAB_FILTER_EMPTY_HINT =
  "Попробуйте другой вид или очистите поиск.";

export const ENTITY_SHEET_OPEN_ERROR = "Эту карточку не удалось открыть";
export const ENTITY_SHEET_OPEN_ERROR_HINT =
  "Закройте панель и выберите запись снова. Набор сущностей на месте.";

export const ENTITY_SHEET_NO_ATTRIBUTES = "Атрибутов у этой карточки пока нет.";
export const ENTITY_SHEET_NO_LINKS = "Связей у этой карточки пока нет.";
export const ENTITY_SHEET_NO_TAGS = "Тегов у этой карточки пока нет.";
export const ENTITY_SHEET_NO_PEERS =
  "В этом наборе пока некого связать с этой карточкой.";
export const ENTITY_SHEET_ADD_ATTRIBUTE = "Добавить атрибут";
export const ENTITY_SHEET_ADD_TAG = "Добавить тег";
export const ENTITY_SHEET_ADD_LINK = "Связать с…";
export const ENTITY_SHEET_NO_REFS_NARRATIVE =
  "В главах эта карточка пока не упомянута.";
export const ENTITY_SHEET_NO_REFS_PRODUCT =
  "В документации эта карточка пока не упомянута.";

export const CHARACTER_SHEET_NO_TRAITS = "Черт у этого персонажа пока нет.";
export const CHARACTER_SHEET_NO_LINKS = "Связей у этой карточки пока нет.";
export const CHARACTER_SHEET_NO_REFS =
  "В главах эта карточка пока не упомянута.";
export const CHARACTER_SHEET_NO_PORTRAIT = "У этой карточки пока нет портрета";

export const ENTITY_PORTRAIT_FAILED =
  "Не удалось сгенерировать портрет — предыдущая картинка на месте.";
export const ENTITY_PORTRAIT_FAILED_HINT =
  "Предыдущий портрет сохранён — можно попробовать ещё раз.";
export const ENTITY_PORTRAIT_UNCONFIGURED_HINT =
  "Откройте Админ → Модели ИИ и назначьте модель для изображений.";

export const ENTITY_DELETE_CONFIRM_LEAD = "Удалить карточку";
export const ENTITY_DELETED = "Карточка удалена";
export const ENTITY_DELETE_FAILED = "Не удалось удалить сущность";

/** Phrases that make an open card look like an empty world. */
export const WORLD_EMPTY_RE =
  /нет персонажей в мире|в мире нет персонаж|персонажей в мире нет|персонажей пока нет/i;
