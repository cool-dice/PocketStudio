/**
 * Theme preference: light / dark / system. next-themes persists this in
 * localStorage under THEME_STORAGE_KEY; reload reads the same key.
 */

export const THEME_STORAGE_KEY = "theme";

export const THEME_PREFS = ["light", "dark", "system"] as const;
export type ThemePref = (typeof THEME_PREFS)[number];

export const THEME_PREF_LABELS: Record<ThemePref, string> = {
  light: "Светлая",
  dark: "Тёмная",
  system: "Как в системе",
};

export function isThemePref(value: unknown): value is ThemePref {
  return value === "light" || value === "dark" || value === "system";
}

/** Unknown / missing → system (matches ThemeProvider defaultTheme). */
export function parseThemePref(raw: unknown): ThemePref {
  return isThemePref(raw) ? raw : "system";
}

/** Read the stored preference; missing or junk is system, not a crash. */
export function readStoredThemePref(raw: string | null | undefined): ThemePref {
  return parseThemePref(raw);
}

export function cycleThemePref(current: unknown): ThemePref {
  const pref = parseThemePref(current);
  const i = THEME_PREFS.indexOf(pref);
  return THEME_PREFS[(i + 1) % THEME_PREFS.length];
}

export function themeToggleAriaLabel(current: unknown): string {
  const next = cycleThemePref(current);
  return `Тема: ${THEME_PREF_LABELS[parseThemePref(current)]}. Следующая — ${THEME_PREF_LABELS[next]}`;
}
