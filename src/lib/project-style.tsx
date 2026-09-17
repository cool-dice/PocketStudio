"use client";

/**
 * Project visual language — origin badges (Шаблон / GitHub / Zip), Monaco
 * language detection by file extension and color-coded file glyph styles.
 * All class strings are static so the Tailwind JIT compiler picks them up;
 * opacities keep every color readable in light AND dark mode.
 */

import {
  FileArchive,
  Folder,
  Github,
  LayoutTemplate,
  type LucideIcon,
} from "lucide-react";

import type { ProjectOrigin } from "@/lib/types";

export interface OriginMeta {
  label: string;
  icon: LucideIcon;
  /** Chip look: soft tinted bg + colored text + border. */
  chip: string;
  /** Plain icon color (sidebar dots, inline icons). */
  iconClass: string;
}

export const ORIGIN_META: Record<ProjectOrigin, OriginMeta> = {
  template: {
    label: "Шаблон",
    icon: LayoutTemplate,
    chip: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    iconClass: "text-emerald-600 dark:text-emerald-400",
  },
  github: {
    label: "GitHub",
    icon: Github,
    chip: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
    iconClass: "text-violet-600 dark:text-violet-400",
  },
  zip: {
    label: "Zip",
    icon: FileArchive,
    chip: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    iconClass: "text-amber-600 dark:text-amber-400",
  },
};

/** Origin chip: icon + label, tinted per origin. */
export function OriginBadge({
  origin,
  className,
}: {
  origin: ProjectOrigin;
  className?: string;
}) {
  const meta = ORIGIN_META[origin] ?? ORIGIN_META.template;
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.chip} ${className ?? ""}`}
    >
      <Icon className="size-3" aria-hidden="true" />
      {meta.label}
    </span>
  );
}

/** Folder glyph helpers for the project file tree. */
export const FOLDER_ICON = Folder;

/* ── Monaco language detection ── */

const LANGUAGE_BY_EXT: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  mts: "typescript",
  cts: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  json: "json",
  jsonc: "json",
  css: "css",
  scss: "scss",
  sass: "scss",
  less: "less",
  html: "html",
  htm: "html",
  md: "markdown",
  markdown: "markdown",
  mdx: "markdown",
  py: "python",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  yml: "yaml",
  yaml: "yaml",
  toml: "ini",
  ini: "ini",
  env: "ini",
  txt: "plaintext",
  xml: "xml",
  svg: "xml",
  sql: "sql",
  rb: "ruby",
  go: "go",
  rs: "rust",
  java: "java",
  kt: "kotlin",
  c: "c",
  h: "c",
  cpp: "cpp",
  hpp: "cpp",
  cs: "csharp",
  php: "php",
  swift: "swift",
  dart: "dart",
  vue: "html",
  graphql: "graphql",
  gql: "graphql",
  dockerfile: "dockerfile",
};

/** Monaco language id from a file path (fallback: plaintext). */
export function languageFromPath(path: string): string {
  const base = path.split("/").pop() ?? path;
  const lower = base.toLowerCase();
  if (lower === "dockerfile") return "dockerfile";
  if (lower.startsWith(".env")) return "ini";
  if (lower === ".gitignore" || lower === ".npmrc" || lower === ".editorconfig") {
    return "plaintext";
  }
  const ext = lower.includes(".") ? lower.split(".").pop()! : "";
  return LANGUAGE_BY_EXT[ext] ?? "plaintext";
}

/* ── File glyph colors (tree + editor tabs) ── */

const FILE_ICON_STYLE: Record<string, string> = {
  ts: "text-emerald-600 dark:text-emerald-400",
  tsx: "text-emerald-600 dark:text-emerald-400",
  mts: "text-emerald-600 dark:text-emerald-400",
  js: "text-amber-600 dark:text-amber-400",
  jsx: "text-amber-600 dark:text-amber-400",
  mjs: "text-amber-600 dark:text-amber-400",
  cjs: "text-amber-600 dark:text-amber-400",
  json: "text-amber-600 dark:text-amber-400",
  md: "text-stone-500 dark:text-stone-400",
  mdx: "text-stone-500 dark:text-stone-400",
  css: "text-sky-600 dark:text-sky-400",
  scss: "text-sky-600 dark:text-sky-400",
  less: "text-sky-600 dark:text-sky-400",
  html: "text-orange-600 dark:text-orange-400",
  htm: "text-orange-600 dark:text-orange-400",
  vue: "text-orange-600 dark:text-orange-400",
  py: "text-sky-600 dark:text-sky-400",
  yml: "text-violet-600 dark:text-violet-400",
  yaml: "text-violet-600 dark:text-violet-400",
  toml: "text-violet-600 dark:text-violet-400",
  sh: "text-emerald-600 dark:text-emerald-400",
  lock: "text-stone-500 dark:text-stone-400",
};

/** Colored dot class for a file path (fallback: muted). */
export function fileDotStyle(path: string): string {
  const base = (path.split("/").pop() ?? path).toLowerCase();
  const ext = base.includes(".") ? base.split(".").pop()! : "";
  return FILE_ICON_STYLE[ext] ?? "text-muted-foreground/70";
}

/** Basename of a POSIX path. */
export function baseName(path: string): string {
  return path.split("/").pop() ?? path;
}
