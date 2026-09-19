/**
 * Honest password change. Needs the current password; no email reset
 * (SMTP is not configured — we do not fake a letter).
 */

export const PASSWORD_MIN = 8;

export const PASSWORD_CURRENT_EMPTY = "Укажите текущий пароль";
export const PASSWORD_NEW_EMPTY = "Укажите новый пароль";
export const PASSWORD_NEW_TOO_SHORT =
  "Пароль должен содержать минимум 8 символов";
export const PASSWORD_CONFIRM_EMPTY = "Повторите новый пароль";
export const PASSWORD_CONFIRM_MISMATCH = "Пароли не совпадают";
export const PASSWORD_WRONG_CURRENT = "Неверный текущий пароль";
export const PASSWORD_UNCHANGED = "Новый пароль должен отличаться от текущего";
export const PASSWORD_CHANGED = "Пароль обновлён";
export const PASSWORD_CHANGE_FAILED = "Не удалось сменить пароль";
export const PASSWORD_RATE_LIMITED =
  "Слишком много попыток смены пароля. Подождите и попробуйте снова.";
export const PASSWORD_JSON_INVALID = "Некорректный JSON в запросе";

export const PASSWORD_SECTION_TITLE = "Пароль";
export const PASSWORD_SECTION_HINT =
  "Нужен текущий пароль. После смены остальные сессии сразу перестанут работать. Письмо со сбросом не отправляем — почтовый сервер не настроен.";
export const PASSWORD_CURRENT_LABEL = "Текущий пароль";
export const PASSWORD_NEW_LABEL = "Новый пароль";
export const PASSWORD_CONFIRM_LABEL = "Ещё раз новый";
export const PASSWORD_SUBMIT = "Сменить пароль";
export const PASSWORD_SUBMITTING = "Меняем…";

export type PasswordChangeOk = {
  ok: true;
  currentPassword: string;
  newPassword: string;
};

export type PasswordChangeFail = {
  ok: false;
  error: string;
  fields: Record<string, string>;
};

export type PasswordChangeResult = PasswordChangeOk | PasswordChangeFail;

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * Field validation only. Does not check the stored hash — that is the API.
 * Passwords are not trimmed (spaces may be part of the secret).
 */
export function validatePasswordChange(raw: unknown): PasswordChangeResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: PASSWORD_JSON_INVALID, fields: {} };
  }
  const record = raw as Record<string, unknown>;
  const currentPassword = asString(record.currentPassword);
  const newPassword = asString(record.newPassword);
  const confirmPassword = asString(record.confirmPassword);

  const fields: Record<string, string> = {};
  if (!currentPassword) fields.currentPassword = PASSWORD_CURRENT_EMPTY;
  if (!newPassword) fields.newPassword = PASSWORD_NEW_EMPTY;
  else if (newPassword.length < PASSWORD_MIN) {
    fields.newPassword = PASSWORD_NEW_TOO_SHORT;
  }
  if (!confirmPassword) fields.confirmPassword = PASSWORD_CONFIRM_EMPTY;
  else if (newPassword && confirmPassword !== newPassword) {
    fields.confirmPassword = PASSWORD_CONFIRM_MISMATCH;
  }

  const keys = Object.keys(fields);
  if (keys.length) {
    return {
      ok: false,
      error: fields.currentPassword || fields.newPassword || fields.confirmPassword,
      fields,
    };
  }

  return { ok: true, currentPassword, newPassword };
}

export type PasswordChangeToast =
  | { kind: "success"; message: typeof PASSWORD_CHANGED }
  | { kind: "error"; message: typeof PASSWORD_CHANGE_FAILED };

/** Toast from the PATCH outcome — never include the new password. */
export function passwordChangeToast(ok: boolean): PasswordChangeToast {
  return ok
    ? { kind: "success", message: PASSWORD_CHANGED }
    : { kind: "error", message: PASSWORD_CHANGE_FAILED };
}
