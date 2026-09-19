"use client";

/**
 * Three-way theme radios (light / dark / system). next-themes writes
 * THEME_STORAGE_KEY so the choice survives reload.
 */

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import {
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import {
  THEME_PREF_LABELS,
  THEME_PREFS,
  parseThemePref,
  type ThemePref,
} from "@/lib/theme-pref";
import { PROFILE_THEME_LABEL } from "@/lib/profile-copy";

const THEME_ICONS = {
  light: Sun,
  dark: Moon,
  system: Monitor,
} as const;

export function ThemeMenuItems() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const value: ThemePref = mounted ? parseThemePref(theme) : "system";

  return (
    <>
      <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
        {PROFILE_THEME_LABEL}
      </DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={value}
        onValueChange={(next) => setTheme(parseThemePref(next))}
      >
        {THEME_PREFS.map((pref) => {
          const Icon = THEME_ICONS[pref];
          return (
            <DropdownMenuRadioItem key={pref} value={pref}>
              <Icon className="size-4" aria-hidden="true" />
              {THEME_PREF_LABELS[pref]}
            </DropdownMenuRadioItem>
          );
        })}
      </DropdownMenuRadioGroup>
    </>
  );
}
