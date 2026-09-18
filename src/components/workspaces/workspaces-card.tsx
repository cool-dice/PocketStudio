"use client";

/**
 * WorkspaceCard — карточка воркспейса в списке (PS-3-a): большая
 * градиентная обложка с типом и стадией, звезда избранного, прогресс
 * с процентом, состав (заметки/документы/медиа/файлы) и обновление.
 * Клик по карточке открывает оболочку воркспейса (PS-3-b).
 */

import {
  ArrowRight,
  AudioWaveform,
  BookOpenText,
  Clapperboard,
  FolderKanban,
  ImagePlus,
  NotebookPen,
  Star,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  WORKSPACE_TYPE_META,
  type WorkspaceSummary,
} from "@/lib/workspace-data";
import { cn } from "@/lib/utils";

const COUNT_ITEMS = [
  { key: "notes", label: "Заметки", icon: NotebookPen },
  { key: "documents", label: "Документы", icon: BookOpenText },
  { key: "images", label: "Картинки", icon: ImagePlus },
  { key: "audio", label: "Аудио", icon: AudioWaveform },
  { key: "video", label: "Видео", icon: Clapperboard },
  { key: "files", label: "Файлы", icon: FolderKanban },
] as const;

interface WorkspaceCardProps {
  workspace: WorkspaceSummary;
  favorite: boolean;
  onToggleFavorite: (id: string) => void;
  onOpen: (ws: WorkspaceSummary) => void;
}

export function WorkspacesCard({
  workspace,
  favorite,
  onToggleFavorite,
  onOpen,
}: WorkspaceCardProps) {
  const meta = WORKSPACE_TYPE_META[workspace.type];
  const Icon = meta.icon;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg">
      {/* ── Градиентная обложка ── */}
      <button
        type="button"
        onClick={() => onOpen(workspace)}
        title={`Открыть воркспейс «${workspace.title}»`}
        aria-label={`Открыть воркспейс «${workspace.title}»`}
        className={cn(
          "relative block h-28 w-full overflow-hidden bg-gradient-to-br text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 sm:h-32",
          workspace.gradient,
        )}
      >
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(140%_120%_at_85%_-10%,rgba(255,255,255,0.25),transparent_55%)]"
        />
        <span
          aria-hidden="true"
          className="absolute left-4 top-4 flex size-10 items-center justify-center rounded-xl bg-white/15 text-white backdrop-blur-sm"
        >
          <Icon className="size-5" />
        </span>
        <Icon
          aria-hidden="true"
          className="absolute -bottom-3 -right-2 size-20 text-white/15 transition-transform duration-300 group-hover:scale-110"
        />
        <Badge
          className="absolute bottom-3 left-3 border-transparent bg-background/85 text-foreground backdrop-blur-sm hover:bg-background/85"
          title={`Стадия: ${workspace.stage}`}
        >
          {workspace.stage}
        </Badge>
      </button>

      {/* ── Избранное ── */}
      <button
        type="button"
        onClick={() => onToggleFavorite(workspace.id)}
        aria-pressed={favorite}
        aria-label={
          favorite ? "Убрать из избранного" : "Добавить в избранное"
        }
        title={favorite ? "Убрать из избранного" : "Добавить в избранное"}
        className={cn(
          "absolute right-3 top-3 z-10 flex size-8 items-center justify-center rounded-lg border backdrop-blur transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
          favorite
            ? "border-amber-400/60 bg-amber-500/25 text-amber-400"
            : "border-white/25 bg-black/20 text-white/85 hover:bg-black/30 hover:text-white",
        )}
      >
        <Star
          className={cn("size-4", favorite && "fill-amber-400 text-amber-400")}
          aria-hidden="true"
        />
      </button>

      {/* ── Тело карточки ── */}
      <button
        type="button"
        onClick={() => onOpen(workspace)}
        className="flex flex-1 flex-col p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
      >
        <h3 className="truncate text-sm font-semibold" title={workspace.title}>
          {workspace.title}
        </h3>
        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {workspace.subtitle}
        </p>

        {/* Прогресс */}
        <div className="mt-3 space-y-1.5">
          <div className="flex items-baseline justify-between gap-2 text-[11px]">
            <span className="text-muted-foreground">Прогресс конвейера</span>
            <span className="font-semibold tabular-nums">
              {workspace.progress}%
            </span>
          </div>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={workspace.progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Прогресс воркспейса «${workspace.title}»`}
          >
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${workspace.progress}%` }}
            />
          </div>
        </div>

        {/* Состав */}
        <div
          className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t pt-3 text-[11px] text-muted-foreground"
          aria-label="Состав воркспейса"
        >
          {COUNT_ITEMS.map((item) => {
            const value = workspace.counts[item.key];
            return (
              <span
                key={item.key}
                title={`${item.label}: ${value}`}
                className={cn(
                  "inline-flex items-center gap-1",
                  value === 0 && "opacity-40",
                )}
              >
                <item.icon className="size-3.5" aria-hidden="true" />
                <span className="tabular-nums">{value}</span>
              </span>
            );
          })}
        </div>

        {/* Футер */}
        <div className="mt-3 flex items-center justify-between gap-2 text-[11px]">
          <span className="truncate text-muted-foreground">
            обновлён {workspace.updatedAgo}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 font-medium text-primary">
            Открыть
            <ArrowRight
              className="size-3 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </span>
        </div>
      </button>
    </article>
  );
}
