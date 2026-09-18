"use client";

/**
 * LibrarySection (A2-c) — секция Библиотеки по типу контента
 * («Изображения», «Портреты», «Треки»…): заголовок с иконкой типа и
 * счётчиком + сетка/список живых карточек артефактов (ArtifactDto).
 * Карточка: image с url → превьюшка-картинка; остальные — иконка типа
 * на градиенте. Избранное переключается прямо с карточки.
 */

import { Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { ArtifactDto, ArtifactType, WorkspaceDto } from "@/lib/workspace-types";
import { WORKSPACE_TYPE_META } from "@/lib/workspace-data";
import { cn } from "@/lib/utils";
import {
  artifactGradient,
  formatAgo,
  LIBRARY_TYPE_META,
  libraryGridClassName,
  type LibraryView,
} from "@/components/workspaces/library-data";

interface LibrarySectionProps {
  type: ArtifactType;
  items: ArtifactDto[];
  view: LibraryView;
  workspaceById: Record<string, WorkspaceDto>;
  onOpenArtifact: (artifact: ArtifactDto) => void;
  onToggleFavorite: (artifact: ArtifactDto) => void;
}

export function LibrarySection({
  type,
  items,
  view,
  workspaceById,
  onOpenArtifact,
  onToggleFavorite,
}: LibrarySectionProps) {
  const meta = LIBRARY_TYPE_META[type];
  const TypeIcon = meta.icon;

  return (
    <section aria-label={meta.plural}>
      <header className="mb-3 flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white",
            meta.gradient,
          )}
        >
          <TypeIcon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold leading-tight">
              {meta.plural}
            </h3>
            <span
              className="shrink-0 rounded-full bg-muted px-1.5 py-px text-[10px] font-semibold leading-none tabular-nums text-muted-foreground"
              aria-label={`${items.length}`}
            >
              {items.length}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {items.some((a) => a.url) ? "есть сгенерированные файлы" : "концепты и заглушки"}
          </p>
        </div>
      </header>
      <div className={libraryGridClassName(view)}>
        {items.map((artifact) => (
          <LibraryCard
            key={artifact.id}
            artifact={artifact}
            workspace={workspaceById[artifact.projectId] ?? null}
            onOpen={onOpenArtifact}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </div>
    </section>
  );
}

function LibraryCard({
  artifact,
  workspace,
  onOpen,
  onToggleFavorite,
}: {
  artifact: ArtifactDto;
  workspace: WorkspaceDto | null;
  onOpen: (artifact: ArtifactDto) => void;
  onToggleFavorite: (artifact: ArtifactDto) => void;
}) {
  const meta = LIBRARY_TYPE_META[artifact.type];
  const TypeIcon = meta.icon;
  const gradient = artifactGradient(artifact);
  const isCssGradient = /gradient\(/.test(gradient);
  const WsIcon = workspace ? WORKSPACE_TYPE_META[workspace.type]?.icon : null;

  return (
    <div
      className={cn(
        "group relative flex w-full items-start gap-3 rounded-xl border bg-card p-3 text-left outline-none",
        "transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm",
      )}
    >
      <button
        type="button"
        onClick={() => onOpen(artifact)}
        aria-label={`Артефакт «${artifact.title}»`}
        className="flex min-w-0 flex-1 items-start gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-card rounded-xl"
      >
        {/* Превью: реальная картинка или градиент с иконкой типа */}
        <span
          aria-hidden="true"
          className={cn(
            "relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg text-white",
            !isCssGradient && "bg-gradient-to-br",
            isCssGradient ? "" : gradient,
          )}
          style={isCssGradient ? { background: gradient } : undefined}
        >
          {artifact.url && artifact.type !== "audio" ? (
            <img
              src={artifact.url}
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute inset-0 size-full object-cover"
            />
          ) : (
            <TypeIcon className="relative size-5" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {artifact.title}
            </span>
            <Badge
              variant="secondary"
              className="shrink-0 text-[10px] uppercase tracking-wide"
            >
              {meta.label}
            </Badge>
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {artifact.description ??
              artifact.prompt ??
              (artifact.stage ? `Стадия: ${artifact.stage}` : "—")}
          </span>
          <span className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground/80">
            {workspace && WsIcon ? (
              <span className="inline-flex min-w-0 items-center gap-1">
                <WsIcon className="size-3 shrink-0" aria-hidden="true" />
                <span className="truncate">{workspace.name}</span>
              </span>
            ) : null}
            <span aria-hidden="true">·</span>
            <span className="shrink-0">{formatAgo(artifact.createdAt)}</span>
          </span>
        </span>
      </button>
      <button
        type="button"
        aria-label={artifact.favorite ? "Убрать из избранного" : "В избранное"}
        onClick={() => onToggleFavorite(artifact)}
        className="absolute right-2 top-2 shrink-0 rounded-md p-1 text-muted-foreground/50 opacity-60 outline-none transition-opacity duration-150 hover:text-amber-500 focus-visible:opacity-100 group-hover:opacity-100"
      >
        <Star
          className={cn(
            "size-3.5",
            artifact.favorite && "fill-amber-400 text-amber-400",
          )}
          aria-hidden="true"
        />
      </button>
    </div>
  );
}
