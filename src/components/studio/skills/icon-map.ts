"use client";

import {
  AudioLines,
  AudioWaveform,
  BookOpenText,
  Clapperboard,
  Feather,
  ImagePlus,
  Languages,
  Palette,
  Scissors,
  Timer,
  TrendingUp,
  Wand2,
  type LucideIcon,
} from "lucide-react";

export const SKILL_ICONS: Record<string, LucideIcon> = {
  BookOpenText,
  Clapperboard,
  AudioWaveform,
  Palette,
  TrendingUp,
  Scissors,
  Feather,
  ImagePlus,
  AudioLines,
  Timer,
  Languages,
  Wand2,
};

export function skillIcon(name: string): LucideIcon {
  return SKILL_ICONS[name] ?? Wand2;
}
