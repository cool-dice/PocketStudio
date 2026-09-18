"use client";

/**
 * LibraryArtifactDialog (A2-c) — детальный просмотр живого артефакта
 * (ArtifactDto): крупное превью (реальная картинка при url, иначе
 * градиент с иконкой типа), название, описание, промпт, контекст
 * воркспейса и дата, действия: «Открыть в воркспейсе» (переход на
 * вкладку типа контента), «В избранное» (api.updateArtifact),
 * «Скачать» (реальный файл при url).
 */

import { ArrowUpRight, Download, Star } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ArtifactDto, WorkspaceDto } from "@/lib/workspace-types";
import {
  findWorkspace,
  WORKSPACE_TABS_BY_TYPE,
  WORKSPACE_TYPE_META,
} from "@/lib/workspace-data";
import { cn } from "@/lib/utils";
import { useAppUi } from "@/lib/store";
import {
  artifactGradient,
  formatAgo,
  LIBRARY_TYPE_META,
  toWorkspaceSummary,
} from "@/components/workspaces/library-data";

interface LibraryArtifactDialogProps {
  artifact: ArtifactDto | null;
  /** Живые воркспейсы (для контекста и перехода). */
  workspaceById: Record<string, WorkspaceDto>;
  onOpenChange: (open: boolean) => void;
  onToggleFavorite: (artifact: ArtifactDto) => void;
}

export function LibraryArtifactDialog({
  artifact,
  workspaceById,
  onOpenChange,
  onToggleFavorite,
}: LibraryArtifactDialogProps) {
  if (!artifact) return null;

  // Сужение типа для замыканий ниже (параметр не сужается в function-боди).
  const data: ArtifactDto = artifact;
  const kind = LIBRARY_TYPE_META[data.type];
  const KindIcon = kind.icon;
  const gradient = artifactGradient(data);
  const isCssGradient = /gradient\(/.test(gradient);
  const liveWorkspace = workspaceById[data.projectId] ?? null;
  const workspace = liveWorkspace ? toWorkspaceSummary(liveWorkspace) : findWorkspace(data.projectId);
  const wsMeta = workspace ? WORKSPACE_TYPE_META[workspace.type] : null;

  function handleOpenInWorkspace() {
    if (!workspace) {
      toast.error("Воркспейс не найден");
      return;
    }
    // Вкладка типа контента; если у воркспейса такой вкладки нет — Обзор.
    const wsType = workspace.type;
    const tab = WORKSPACE_TABS_BY_TYPE[wsType].includes(kind.tab)
      ? kind.tab
      : "overview";
    onOpenChange(false);
    if (liveWorkspace) {
      useAppUi.getState().openWorkspaceData(workspace, tab);
    } else {
      useAppUi.getState().openWorkspace(workspace.id, tab);
    }
  }

  function handleFavorite() {
    onToggleFavorite(data);
    toast.success(
      data.favorite ? "Убрано из избранного" : "Добавлено в избранное",
      { description: `«${data.title}»` },
    );
  }

  function handleDownload() {
    if (!data.url) {
      toast.info("Файла пока нет", {
        description: "У этого артефакта только концепт-заглушка.",
      });
      return;
    }
    window.open(data.url, "_blank", "noopener,noreferrer");
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
        {/* Крупное превью: реальная картинка или градиент типа */}
        <div
          aria-hidden="true"
          className={cn(
            "flex h-40 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br",
            !isCssGradient && gradient,
          )}
          style={isCssGradient ? { background: gradient } : undefined}
        >
          {artifact.url && artifact.type !== "audio" ? (
            <img
              src={artifact.url}
              alt={artifact.title}
              loading="lazy"
              className="size-full object-cover"
            />
          ) : (
            <KindIcon className="size-12 text-white/90 drop-shadow" />
          )}
        </div>

        <DialogHeader>
          <DialogTitle className="pr-6 leading-tight">{artifact.title}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2">
            <Badge
              variant="secondary"
              className="text-[10px] uppercase tracking-wide"
            >
              {kind.label}
            </Badge>
            {artifact.stage ? (
              <Badge
                variant="outline"
                className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              >
                {artifact.stage}
              </Badge>
            ) : null}
            <span>{formatAgo(artifact.createdAt)}</span>
          </DialogDescription>
        </DialogHeader>

        {artifact.description ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {artifact.description}
          </p>
        ) : null}

        {artifact.prompt ? (
          <div className="rounded-xl border bg-muted/40 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Промпт
            </p>
            <p className="mt-1 text-sm leading-relaxed">{artifact.prompt}</p>
          </div>
        ) : null}

        {/* Контекст воркспейса */}
        {workspace && wsMeta ? (
          <div className="flex items-center gap-2.5 rounded-lg border bg-muted/40 px-3 py-2">
            <span
              aria-hidden="true"
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br text-white",
                workspace.gradient,
              )}
            >
              <wsMeta.icon className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{workspace.title}</p>
              <p className="text-[11px] text-muted-foreground">
                {wsMeta.label} · стадия «{workspace.stage}»
              </p>
            </div>
            <span className="shrink-0 text-[11px] text-muted-foreground/80">
              {formatAgo(artifact.createdAt)}
            </span>
          </div>
        ) : null}

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            type="button"
            className="w-full gap-1.5"
            onClick={handleOpenInWorkspace}
          >
            <ArrowUpRight className="size-4" aria-hidden="true" />
            Открыть в воркспейсе
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              aria-pressed={artifact.favorite}
              className="flex-1 gap-1.5"
              onClick={handleFavorite}
            >
              <Star
                className={cn(
                  "size-4",
                  artifact.favorite && "fill-amber-400 text-amber-400",
                )}
                aria-hidden="true"
              />
              {artifact.favorite ? "В избранном" : "В избранное"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="flex-1 gap-1.5"
              onClick={handleDownload}
            >
              <Download className="size-4" aria-hidden="true" />
              {artifact.url ? "Скачать" : "Файла нет"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
