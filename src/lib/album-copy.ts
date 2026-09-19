/**
 * Honest copy for the document Album tab.
 * Load failure must not read as an empty gallery; a missing blob is not a file.
 */

export const ALBUM_LOAD_ERROR = "Альбом не загрузился";
export const ALBUM_LOAD_ERROR_HINT =
  "Проверьте соединение и обновите вкладку — это не пустой альбом.";

export const ALBUM_EMPTY = "В альбоме пока нет работ";
export const ALBUM_EMPTY_HINT =
  "Сгенерируйте иллюстрацию или добавьте картинку из библиотеки.";

export const ALBUM_FILTER_EMPTY = "В альбоме ничего не нашлось";
export const ALBUM_FILTER_EMPTY_HINT =
  "Попробуйте другой тип, очистите поиск — или сгенерируйте новую работу.";

export const ALBUM_NO_WORKSPACE = "Нет воркспейса для альбома";
export const ALBUM_NO_WORKSPACE_HINT =
  "Откройте воркспейс с документами — альбом привязан к нему, а не к заглушке.";

export const ALBUM_MISSING_FILE = "Файл отсутствует";
export const ALBUM_MISSING_FILE_HINT =
  "Запись в альбоме есть, но файла на диске нет — ссылка не открывается.";

export const ALBUM_FAVORITE_FAILED = "Не удалось обновить избранное";
export const ALBUM_REMOVE_FAILED = "Не удалось убрать работу из альбома";
export const ALBUM_REMOVE_OK = "Убрано из альбома";
export const ALBUM_ADD_FAILED = "Не удалось добавить работу из библиотеки";
export const ALBUM_ADD_OK = "Добавлено в альбом";
export const ALBUM_GENERATE_FAILED = "Не удалось сгенерировать иллюстрацию";
export const ALBUM_GENERATE_FAILED_HINT =
  "Попробуйте ещё раз — генерация занимает до минуты. Альбом не менялся.";
export const ALBUM_VARIATION_FAILED = "Не удалось сгенерировать вариацию";

export const ALBUM_LIBRARY_EMPTY = "В библиотеке нет картинок для добавления";
export const ALBUM_LIBRARY_EMPTY_HINT =
  "Подойдут изображения из других воркспейсов, которых ещё нет в этом альбоме.";
export const ALBUM_LIBRARY_LOAD_ERROR = "Библиотека не загрузилась";

export const ALBUM_ALREADY_HERE = "Эта работа уже в альбоме этого воркспейса";
export const ALBUM_SOURCE_NOT_IMAGE = "В альбом можно добавить только изображение";
