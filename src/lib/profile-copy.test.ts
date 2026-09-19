import { describe, expect, test } from "bun:test";

import {
  DISPLAY_NAME_MAX,
  DISPLAY_NAME_MIN,
  PROFILE_NAME_EMPTY,
  PROFILE_NAME_TOO_LONG,
  PROFILE_NAME_TOO_SHORT,
  PROFILE_SAVE_FAILED,
  PROFILE_SAVED,
  profileNameFieldError,
  profileSaveToast,
  validateDisplayName,
} from "./profile-copy";

describe("display name empty vs error", () => {
  test("empty and whitespace are field errors, not success", () => {
    expect(validateDisplayName("")).toEqual({
      ok: false,
      error: PROFILE_NAME_EMPTY,
    });
    expect(validateDisplayName("   ")).toEqual({
      ok: false,
      error: PROFILE_NAME_EMPTY,
    });
    expect(validateDisplayName(null)).toEqual({
      ok: false,
      error: PROFILE_NAME_EMPTY,
    });
    expect(PROFILE_NAME_EMPTY).toMatch(/[А-Яа-яЁё]/);
    expect(PROFILE_NAME_EMPTY).not.toMatch(/не удалось/i);
    expect(PROFILE_SAVE_FAILED).not.toBe(PROFILE_NAME_EMPTY);
  });

  test("too short / too long are distinct from empty", () => {
    expect(validateDisplayName("Я")).toEqual({
      ok: false,
      error: PROFILE_NAME_TOO_SHORT,
    });
    expect(validateDisplayName("x".repeat(DISPLAY_NAME_MAX + 1))).toEqual({
      ok: false,
      error: PROFILE_NAME_TOO_LONG,
    });
    expect(PROFILE_NAME_TOO_SHORT).not.toBe(PROFILE_NAME_EMPTY);
    expect(PROFILE_NAME_TOO_LONG).not.toBe(PROFILE_SAVE_FAILED);
    expect(DISPLAY_NAME_MIN).toBe(2);
  });

  test("trims a valid name", () => {
    expect(validateDisplayName("  Анна  ")).toEqual({
      ok: true,
      name: "Анна",
    });
  });

  test("field error prefers server failure over empty copy", () => {
    expect(profileNameFieldError(true, PROFILE_SAVE_FAILED)).toBe(
      PROFILE_SAVE_FAILED,
    );
    expect(profileNameFieldError(true, null)).toBe(PROFILE_NAME_EMPTY);
    expect(profileNameFieldError(false, null)).toBeNull();
  });
});

describe("profile save toast after PATCH", () => {
  test("success toast only when ok — never before the API", () => {
    expect(profileSaveToast(false)).toEqual({
      kind: "error",
      message: PROFILE_SAVE_FAILED,
    });
    expect(profileSaveToast(true)).toEqual({
      kind: "success",
      message: PROFILE_SAVED,
    });
    expect(PROFILE_SAVED).toMatch(/[А-Яа-яЁё]/);
    expect(PROFILE_SAVE_FAILED).toMatch(/не удалось/i);
    expect(PROFILE_SAVED).not.toMatch(/не удалось/i);
  });
});
