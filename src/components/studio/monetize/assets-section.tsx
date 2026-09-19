"use client";

/**
 * Monetize — список артефактов с url. Счётчики по типам + ссылка
 * «открыть». Это файлы в студии, не публикация на хост.
 */

import {
  AppWindow,
  AudioLines,
  Clapperboard,
  ExternalLink,
  FileText,
  ImageIcon,
  Music4,
  Paperclip,
  Rocket,
  Star,
  StickyNote,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import {
  MONETIZE_ASSETS_EMPTY,
  MONETIZE_ASSETS_HINT,
  MONETIZE_ASSETS_NO_FILE,
  MONETIZE_ASSETS_TITLE,
} from "@/lib/monetize-copy";
import type { ArtifactDto, ArtifactType } from "@/lib/workspace-types";
import { cn } from "@/lib/utils";

const TYPE_META: Record<ArtifactType, { label: string; icon: LucideIcon }> = {
  image: { label: "Изображение", icon: ImageIcon },
  portrait: { label: "Портрет", icon: UserRound },
  audio: { label: "Аудио", icon: AudioLines },
  track: { label: "Трек", icon: Music4 },
  video: { label: "Видео", icon: Clapperboard },
  document: { label: "Документ", icon: FileText },
  file: { label: "Файл", icon: Paperclip },
  note: { label: "Заметка", icon: StickyNote },
  scene: { label: "Сцена", icon: Clapperboard },
  app: { label: "Сборка", icon: AppWindow },
  deploy: { label: "Деплой", icon: Rocket },
};

interface CounterGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  types: ArtifactType[];
}

const COUNTER_GROUPS: CounterGroup[] = [
  { id: "images", label: "Изображения", icon: ImageIcon, types: ["image", "portrait"] },
  { id: "audio", label: "Аудио", icon: AudioLines, types: ["audio", "track"] },
  { id: "documents", label: "Документы", icon: FileText, types: ["document"] },
  { id: "video", label: "Видео", icon: Clapperboard, types: ["video", "scene"] },
  { id: "files", label: "Файлы", icon: Paperclip, types: ["file", "note", "app", "deploy"] },
];

export function AssetsSection({
  artifacts,
  loading,
}: {
  artifacts: ArtifactDto[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-xl border bg-card p-4 shadow-sm sm:p-6">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
        <Skeleton className="mt-4 h-24 rounded-lg" />
      </div>
    );
  }

  const ready = artifacts.filter((a) => Boolean(a.url));

  return (
    <section
      aria-label={MONETIZE_ASSETS_TITLE}
      className="rounded-xl border bg-card p-4 shadow-sm sm:p-6"
    >
      <h2 className="text-base font-semibold">{MONETIZE_ASSETS_TITLE}</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {MONETIZE_ASSETS_HINT}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
        {COUNTER_GROUPS.map((group) => {
          const count = artifacts.filter((a) =>
            group.types.includes(a.type),
          ).length;
          const Icon = group.icon;
          return (
            <div
              key={group.id}
              className="flex items-center gap-2.5 rounded-lg border bg-background/60 p-2.5"
            >
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-lg",
                  count > 0
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-muted text-muted-foreground/60",
                )}
                aria-hidden="true"
              >
                <Icon className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-lg font-semibold leading-none tabular-nums">
                  {count}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {group.label}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {ready.length === 0 ? (
        <div className="mt-4 flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center">
          <Paperclip
            className="size-6 text-muted-foreground/50"
            aria-hidden="true"
          />
          <p className="text-sm text-muted-foreground">
            {artifacts.length === 0
              ? MONETIZE_ASSETS_EMPTY
              : MONETIZE_ASSETS_NO_FILE}
          </p>
          <p className="max-w-md text-xs text-muted-foreground/70">
            Сгенерируйте изображения, обложки или озвучку в соответствующих
            модулях студии — они появятся здесь.
          </p>
        </div>
      ) : (
        <ul className="vf-scroll mt-4 max-h-96 divide-y overflow-y-auto rounded-lg border">
          {ready.map((a) => {
            const meta = TYPE_META[a.type] ?? TYPE_META.file;
            const Icon = meta.icon;
            return (
              <li
                key={a.id}
                className="flex items-center gap-3 bg-background/60 px-3 py-2.5 transition-colors hover:bg-muted/40"
              >
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
                  aria-hidden="true"
                >
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                    <span className="truncate">{a.title}</span>
                    {a.favorite ? (
                      <Star
                        className="size-3.5 shrink-0 fill-emerald-500 text-emerald-500"
                        aria-label="В избранном"
                      />
                    ) : null}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {meta.label} ·{" "}
                    {new Date(a.createdAt).toLocaleDateString("ru-RU", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <a
                  href={a.url ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                >
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                  Открыть
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
