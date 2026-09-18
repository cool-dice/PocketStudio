"use client";

/**
 * ArtifactCard — единая карточка артефакта (PS-3).
 * Одна компонента для заметки/документа/картинки/трека/сцены/файла/деплоя:
 * живёт в Обзоре воркспейса, в Библиотеке и в результатах чата.
 */

import { useState } from "react";
import { Star } from "lucide-react";

import {
  ARTIFACT_KIND_META,
  type ArtifactItem,
} from "@/components/workspaces/shared/artifacts-data";
import { Badge } from "@/components/ui/badge";
import { findWorkspace, WORKSPACE_TYPE_META } from "@/lib/workspace-data";
import { cn } from "@/lib/utils";

export interface ArtifactCardProps {
  artifact: ArtifactItem;
  /** Клик по карточке (открыть артефакт). */
  onOpen?: (artifact: ArtifactItem) => void;
  /** Показывать чип воркспейса (Библиотека, чат). */
  showWorkspace?: boolean;
  /** Компактный режим (внутри стадий Обзора). */
  dense?: boolean;
  className?: string;
}

export function ArtifactCard({
  artifact,
  onOpen,
  showWorkspace = false,
  dense = false,
  className,
}: ArtifactCardProps) {
  const [favorite, setFavorite] = useState(false);
  const kind = ARTIFACT_KIND_META[artifact.kind];
  const Icon = kind.icon;
  const workspace = findWorkspace(artifact.workspaceId);
  const wsMeta = workspace ? WORKSPACE_TYPE_META[workspace.type] : null;

  return (
    <button
      type="button"
      onClick={() => onOpen?.(artifact)}
      aria-label={`Артефакт «${artifact.title}»`}
      className={cn(
        "group relative flex w-full items-start gap-3 rounded-xl border bg-card p-3 text-left outline-none",
        "transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm",
        "focus-visible:ring-2 focus-visible:ring-ring/60",
        dense && "p-2.5",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white",
          artifact.gradient,
          dense ? "size-9" : "size-11",
        )}
      >
        <Icon className={dense ? "size-4" : "size-5"} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span
            className={cn(
              "min-w-0 flex-1 truncate font-medium",
              dense ? "text-sm" : "text-sm",
            )}
          >
            {artifact.title}
          </span>
          <Badge variant="secondary" className="shrink-0 text-[10px] uppercase tracking-wide">
            {kind.label}
          </Badge>
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {artifact.meta}
        </span>
        <span className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground/80">
          {showWorkspace && workspace && wsMeta ? (
            <span className="inline-flex min-w-0 items-center gap-1">
              <wsMeta.icon className="size-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{workspace.title}</span>
            </span>
          ) : (
            <span className="truncate">{artifact.stage}</span>
          )}
          <span aria-hidden="true">·</span>
          <span className="shrink-0">{artifact.createdAgo}</span>
        </span>
      </span>
      <span
        role="button"
        tabIndex={-1}
        aria-label={favorite ? "Убрать из избранного" : "В избранное"}
        onClick={(e) => {
          e.stopPropagation();
          setFavorite((v) => !v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            setFavorite((v) => !v);
          }
        }}
        className="absolute right-2 top-2 shrink-0 rounded-md p-1 text-muted-foreground/50 opacity-0 outline-none transition-opacity duration-150 hover:text-amber-500 focus-visible:opacity-100 group-hover:opacity-100"
      >
        <Star
          className={cn("size-3.5", favorite && "fill-amber-400 text-amber-400")}
          aria-hidden="true"
        />
      </span>
    </button>
  );
}
