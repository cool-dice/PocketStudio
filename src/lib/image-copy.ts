/**
 * Honest image / gallery copy. Load failure is not an empty gallery;
 * failed generation is not a clickable PNG.
 */

export const IMAGE_GALLERY_EMPTY = "Пока нет картинок";
export const IMAGE_GALLERY_EMPTY_HINT =
  "Опишите кадр в панели генерации или попросите оркестратора в чате.";
export const IMAGE_GALLERY_FILTER_EMPTY =
  "Ничего не найдено — попробуйте изменить запрос или фильтры";
export const IMAGE_GALLERY_LOAD_ERROR = "Не удалось загрузить галерею";
export const IMAGE_GALLERY_LOAD_ERROR_HINT =
  "Проверьте соединение и обновите — это не пустая галерея.";

export type GalleryListView = "loading" | "error" | "empty" | "ready";

/** Skeletons while fetching — never flash «пока нет картинок» as a 404. */
export function galleryListView(
  loading: boolean,
  loadError: string | null,
  count: number,
): GalleryListView {
  if (loading) return "loading";
  if (loadError) return "error";
  if (count === 0) return "empty";
  return "ready";
}

export const IMAGE_GEN_FAILED = "Генерация не удалась";
export const IMAGE_GEN_FAILED_HINT =
  "Картинка не сохранена и не показывается. Попробуйте ещё раз.";
export const IMAGE_GEN_UNCONFIGURED_HINT =
  "Откройте Админ → Модели ИИ и назначьте модель для изображений.";

export const IMAGE_MISSING_FILE = "Файл отсутствует";
export const IMAGE_MISSING_FILE_HINT =
  "Запись в галерее есть, но файла на диске нет — ссылка не открывается.";

export const IMAGE_EMPTY_FILE = "Генерация вернула пустой файл — попробуйте ещё раз";

/** Reject data-URIs, placeholders, and missing blobs so the UI never 404s. */
export function isHonestImageUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  if (url.startsWith("data:")) return false;
  if (/placeholder/i.test(url)) return false;
  return url.startsWith("/gen/") || /^https?:\/\//i.test(url);
}

/** Only a live image URL is an <img> src — missing blobs are not shown. */
export function displayableImageSrc(
  item: { url?: string | null; fileMissing?: boolean } | null | undefined,
): string | null {
  if (!item?.url || item.fileMissing) return null;
  return isHonestImageUrl(item.url) ? item.url : null;
}
