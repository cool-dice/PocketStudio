import { describe, expect, test } from "bun:test";

import {
  PASSWORD_CHANGE_FAILED,
  PASSWORD_CHANGED,
  PASSWORD_CONFIRM_EMPTY,
  PASSWORD_CONFIRM_MISMATCH,
  PASSWORD_CURRENT_EMPTY,
  PASSWORD_JSON_INVALID,
  PASSWORD_MIN,
  PASSWORD_NEW_EMPTY,
  PASSWORD_NEW_TOO_SHORT,
  PASSWORD_RATE_LIMITED,
  PASSWORD_SECTION_HINT,
  PASSWORD_UNCHANGED,
  PASSWORD_WRONG_CURRENT,
  passwordChangeToast,
  validatePasswordChange,
} from "./password-copy";

describe("validatePasswordChange", () => {
  test("rejects junk JSON without echoing secrets", () => {
    expect(validatePasswordChange(null)).toEqual({
      ok: false,
      error: PASSWORD_JSON_INVALID,
      fields: {},
    });
    expect(validatePasswordChange("secret")).toEqual({
      ok: false,
      error: PASSWORD_JSON_INVALID,
      fields: {},
    });
    expect(PASSWORD_JSON_INVALID).toMatch(/[А-Яа-яЁё]/);
  });

  test("empty fields are Russian field errors, not success", () => {
    const empty = validatePasswordChange({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    expect(empty.ok).toBe(false);
    if (empty.ok) return;
    expect(empty.fields.currentPassword).toBe(PASSWORD_CURRENT_EMPTY);
    expect(empty.fields.newPassword).toBe(PASSWORD_NEW_EMPTY);
    expect(empty.fields.confirmPassword).toBe(PASSWORD_CONFIRM_EMPTY);
    expect(empty.error).toBe(PASSWORD_CURRENT_EMPTY);
    expect(JSON.stringify(empty)).not.toMatch(/password-ok|secret/i);
    expect(PASSWORD_CURRENT_EMPTY).toMatch(/[А-Яа-яЁё]/);
    expect(PASSWORD_NEW_EMPTY).toMatch(/[А-Яа-яЁё]/);
  });

  test("short new password and mismatch are distinct", () => {
    const short = validatePasswordChange({
      currentPassword: "password-ok",
      newPassword: "short",
      confirmPassword: "short",
    });
    expect(short).toEqual({
      ok: false,
      error: PASSWORD_NEW_TOO_SHORT,
      fields: { newPassword: PASSWORD_NEW_TOO_SHORT },
    });
    expect(PASSWORD_NEW_TOO_SHORT).toMatch(/8/);
    expect(PASSWORD_MIN).toBe(8);

    const mismatch = validatePasswordChange({
      currentPassword: "password-ok",
      newPassword: "password-new",
      confirmPassword: "password-old",
    });
    expect(mismatch.ok).toBe(false);
    if (mismatch.ok) return;
    expect(mismatch.fields.confirmPassword).toBe(PASSWORD_CONFIRM_MISMATCH);
    expect(JSON.stringify(mismatch)).not.toContain("password-new");
    expect(JSON.stringify(mismatch)).not.toContain("password-old");
    expect(JSON.stringify(mismatch)).not.toContain("password-ok");
  });

  test("does not trim spaces inside a valid password", () => {
    const parsed = validatePasswordChange({
      currentPassword: "password-ok",
      newPassword: " new pass ",
      confirmPassword: " new pass ",
    });
    expect(parsed).toEqual({
      ok: true,
      currentPassword: "password-ok",
      newPassword: " new pass ",
    });
  });
});

describe("password change copy is honest", () => {
  test("success toast never includes the secret; no SMTP reset promise", () => {
    expect(passwordChangeToast(true)).toEqual({
      kind: "success",
      message: PASSWORD_CHANGED,
    });
    expect(passwordChangeToast(false)).toEqual({
      kind: "error",
      message: PASSWORD_CHANGE_FAILED,
    });
    expect(PASSWORD_CHANGED).toMatch(/[А-Яа-яЁё]/);
    expect(PASSWORD_CHANGED).not.toMatch(/password|secret/i);
    expect(PASSWORD_CHANGE_FAILED).toMatch(/не удалось/i);
    expect(PASSWORD_WRONG_CURRENT).toMatch(/[А-Яа-яЁё]/);
    expect(PASSWORD_WRONG_CURRENT).not.toMatch(/hash|bcrypt|email/i);
    expect(PASSWORD_UNCHANGED).toMatch(/[А-Яа-яЁё]/);
    expect(PASSWORD_RATE_LIMITED).toMatch(/попыток/i);
    expect(PASSWORD_SECTION_HINT).toMatch(/почтовый сервер не настроен/i);
    expect(PASSWORD_SECTION_HINT).not.toMatch(/отправим письмо|SMTP готов/i);
  });
});
