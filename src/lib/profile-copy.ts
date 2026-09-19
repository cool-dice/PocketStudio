/**
 * Honest profile name save. Empty input is a field error, not a load
 * failure; success toasts are built from the API outcome, never before.
 */

export const PROFILE_NAME_EMPTY = "Укажите имя";
export const PROFILE_NAME_TOO_SHORT = "Имя должно содержать минимум 2 символа";
export const PROFILE_NAME_TOO_LONG = "Имя не может превышать 60 символов";
export const PROFILE_SAVE_FAILED = "Не удалось сохранить имя";
export const PROFILE_SAVED = "Имя обновлено";
export const PROFILE_NOTHING_TO_SAVE = "Нечего сохранять";
export const PROFILE_DIALOG_TITLE = "Профиль";
export const PROFILE_DIALOG_HINT =
  "Имя видите вы и оркестратор. Тема — на этом устройстве. Пароль — только с текущим.";
export const PROFILE_NAME_LABEL = "Отображаемое имя";
export const PROFILE_THEME_LABEL = "Тема";
export const PROFILE_OPEN = "Профиль";

export const LOGOUT_ALL_SECTION_TITLE = "Сессии";
export const LOGOUT_ALL_HINT =
  "Обычный «Выйти» закрывает только это устройство. Эта кнопка гасит все сессии сразу.";
export const LOGOUT_ALL_BUTTON = "Выйти на всех устройствах";
export const LOGOUT_ALL_CONFIRM_TITLE = "Выйти на всех устройствах?";
export const LOGOUT_ALL_CONFIRM =
  "Другие устройства сразу потеряют доступ. Этот браузер тоже выйдет. Потом можно войти снова.";
export const LOGOUT_ALL_SUBMITTING = "Выходим…";
export const LOGOUT_ALL_DONE = "Вышли на всех устройствах";
export const LOGOUT_ALL_FAILED = "Не удалось выйти на всех устройствах";

export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 60;

export type DisplayNameResult =
  | { ok: true; name: string }
  | { ok: false; error: string };

/** Trim + length. Empty is not a server error and not a success. */
export function validateDisplayName(raw: unknown): DisplayNameResult {
  if (typeof raw !== "string") {
    return { ok: false, error: PROFILE_NAME_EMPTY };
  }
  const name = raw.trim();
  if (!name) return { ok: false, error: PROFILE_NAME_EMPTY };
  if (name.length < DISPLAY_NAME_MIN) {
    return { ok: false, error: PROFILE_NAME_TOO_SHORT };
  }
  if (name.length > DISPLAY_NAME_MAX) {
    return { ok: false, error: PROFILE_NAME_TOO_LONG };
  }
  return { ok: true, name };
}

export type ProfileSaveToast =
  | { kind: "success"; message: typeof PROFILE_SAVED }
  | { kind: "error"; message: typeof PROFILE_SAVE_FAILED };

/**
 * Toast from the PATCH outcome — never call this before the request returns.
 */
export function profileSaveToast(ok: boolean): ProfileSaveToast {
  return ok
    ? { kind: "success", message: PROFILE_SAVED }
    : { kind: "error", message: PROFILE_SAVE_FAILED };
}

/** Field shows empty copy; a failed PATCH never reuses it. */
export function profileNameFieldError(
  trimmedEmpty: boolean,
  serverError: string | null,
): string | null {
  if (serverError) return serverError;
  if (trimmedEmpty) return PROFILE_NAME_EMPTY;
  return null;
}
