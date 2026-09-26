"use client";

/**
 * WorkspaceCard — карточка воркспейса в списке: градиентная обложка,
 * тип и стадия, прогресс, живые счётчики counts из БД.
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
import { timeAgo } from "@/components/workspaces/home-data";
import {
  stageLabelOf,
  workspaceSubtitle,
} from "@/components/workspaces/workspaces-data";
import { WORKSPACE_TYPE_META } from "@/lib/workspace-data";
import type { WorkspaceDto } from "@/lib/workspace-types";
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
  workspace: WorkspaceDto;
  onOpen: (id: string) => void;
  onToggleFavorite?: (id: string, next: boolean) => void;
}

export function WorkspacesCard({
  workspace,
  onOpen,
  onToggleFavorite,
}: WorkspaceCardProps) {
  const meta = WORKSPACE_TYPE_META[workspace.type];
  const Icon = meta.icon;
  const stage = stageLabelOf(workspace);

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg">
      {/* ── Градиентная обложка ── */}
      {/* Звезда — сосед кнопки открытия: в HTML button не может быть внутри button. */}
      <div className="relative">
        <button
          type="button"
          onClick={() => onOpen(workspace.id)}
          title={`Открыть воркспейс «${workspace.name}»`}
          aria-label={`Открыть воркспейс «${workspace.name}»`}
          className={cn(
            "relative block h-28 w-full overflow-hidden bg-gradient-to-br text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 sm:h-32",
            meta.gradient,
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
            title={`Стадия: ${stage}`}
          >
            {stage}
          </Badge>
        </button>
        {onToggleFavorite ? (
          <button
            type="button"
            className="absolute right-3 top-3 z-10 rounded-full bg-background/80 p-1.5 text-white backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            aria-label={workspace.favorite ? "Убрать из избранного" : "В избранное"}
            aria-pressed={workspace.favorite}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(workspace.id, !workspace.favorite);
            }}
          >
            <Star
              className={cn(
                "size-4 text-white",
                workspace.favorite && "fill-amber-400 text-amber-400",
              )}
            />
          </button>
        ) : null}
      </div>

      {/* ── Тело карточки ── */}
      <button
        type="button"
        onClick={() => onOpen(workspace.id)}
        className="flex flex-1 flex-col p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
      >
        <h3 className="truncate text-sm font-semibold" title={workspace.name}>
          {workspace.name}
        </h3>
        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {workspaceSubtitle(workspace)}
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
            aria-label={`Прогресс воркспейса «${workspace.name}»`}
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
            обновлён {timeAgo(workspace.updatedAt)}
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
