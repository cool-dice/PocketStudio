import { describe, expect, test } from "bun:test";

import {
  THEME_PREF_LABELS,
  THEME_PREFS,
  THEME_STORAGE_KEY,
  cycleThemePref,
  parseThemePref,
  readStoredThemePref,
  themeToggleAriaLabel,
} from "./theme-pref";

describe("theme preference persistence helpers", () => {
  test("storage key is the next-themes default so reload keeps the choice", () => {
    expect(THEME_STORAGE_KEY).toBe("theme");
  });

  test("dark / light / system parse; junk falls back to system", () => {
    expect(parseThemePref("dark")).toBe("dark");
    expect(parseThemePref("light")).toBe("light");
    expect(parseThemePref("system")).toBe("system");
    expect(parseThemePref("")).toBe("system");
    expect(parseThemePref("auto")).toBe("system");
    expect(parseThemePref(undefined)).toBe("system");
    expect(readStoredThemePref("dark")).toBe("dark");
    expect(readStoredThemePref(null)).toBe("system");
    expect(readStoredThemePref("")).toBe("system");
  });

  test("cycle visits all three prefs and labels are Russian", () => {
    expect(cycleThemePref("light")).toBe("dark");
    expect(cycleThemePref("dark")).toBe("system");
    expect(cycleThemePref("system")).toBe("light");
    expect(cycleThemePref("nope")).toBe("light");
    expect(THEME_PREFS).toEqual(["light", "dark", "system"]);
    for (const pref of THEME_PREFS) {
      expect(THEME_PREF_LABELS[pref]).toMatch(/[А-Яа-яЁё]/);
    }
    expect(themeToggleAriaLabel("dark")).toMatch(/тёмн/i);
    expect(themeToggleAriaLabel("dark")).toMatch(/систем/i);
  });
});
