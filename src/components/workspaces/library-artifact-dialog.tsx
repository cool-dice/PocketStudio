"use client";

/**
 * LibraryArtifactDialog — детальный просмотр артефакта Библиотеки
 * (PS-3-c): крупное градиентное превью, тип, стадия, чип воркспейса,
 * действия: «Открыть в воркспейсе» (переводит на вкладку типа
 * артефакта), «В избранное» (локальный стейт экрана), «Скачать»
 * (заглушка с бейджем «В разработке»).
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
import {
  ARTIFACT_KIND_META,
  type ArtifactItem,
} from "@/components/workspaces/shared/artifacts-data";
import { useAppUi } from "@/lib/store";
import {
  findWorkspace,
  WORKSPACE_TABS_BY_TYPE,
  WORKSPACE_TYPE_META,
} from "@/lib/workspace-data";
import { cn } from "@/lib/utils";

interface LibraryArtifactDialogProps {
  artifact: ArtifactItem | null;
  favorite: boolean;
  onToggleFavorite: (id: string) => void;
  onOpenChange: (open: boolean) => void;
}

export function LibraryArtifactDialog({
  artifact,
  favorite,
  onToggleFavorite,
  onOpenChange,
}: LibraryArtifactDialogProps) {
  if (!artifact) return null;

  const kind = ARTIFACT_KIND_META[artifact.kind];
  const KindIcon = kind.icon;
  const workspace = findWorkspace(artifact.workspaceId);
  const wsMeta = workspace ? WORKSPACE_TYPE_META[workspace.type] : null;

  function handleOpenInWorkspace() {
    if (!artifact) return;
    // Вкладка типа артефакта; если у воркспейса такой вкладки нет
    // (напр. трек в «фильме») — открываем Обзор.
    const kindTab = ARTIFACT_KIND_META[artifact.kind].tab;
    const ws = findWorkspace(artifact.workspaceId);
    const tab =
      ws && WORKSPACE_TABS_BY_TYPE[ws.type].includes(kindTab)
        ? kindTab
        : "overview";
    onOpenChange(false);
    useAppUi.getState().openWorkspace(artifact.workspaceId, tab);
  }

  function handleFavorite() {
    if (!artifact) return;
    onToggleFavorite(artifact.id);
    toast.success(favorite ? "Убрано из избранного" : "Добавлено в избранное", {
      description: `«${artifact.title}»`,
    });
  }

  function handleDownload() {
    toast.info("Скачивание — в разработке", {
      description: "Экспорт артефактов подключается в одной из следующих фаз.",
    });
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
        {/* Крупное превью */}
        <div
          aria-hidden="true"
          className={cn(
            "flex h-40 items-center justify-center rounded-xl bg-gradient-to-br",
            artifact.gradient,
          )}
        >
          <KindIcon className="size-12 text-white/90 drop-shadow" />
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
            <Badge
              variant="outline"
              className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
            >
              {artifact.stage}
            </Badge>
            <span>{artifact.meta}</span>
          </DialogDescription>
        </DialogHeader>

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
                {wsMeta.label} · стадия «{workspace.stage}» · вкладка «
                {kind.label.toLowerCase()}»
              </p>
            </div>
            <span className="shrink-0 text-[11px] text-muted-foreground/80">
              {artifact.createdAgo}
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
              aria-pressed={favorite}
              className="flex-1 gap-1.5"
              onClick={handleFavorite}
            >
              <Star
                className={cn(
                  "size-4",
                  favorite && "fill-amber-400 text-amber-400",
                )}
                aria-hidden="true"
              />
              {favorite ? "В избранном" : "В избранное"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="flex-1 gap-1.5"
              onClick={handleDownload}
            >
              <Download className="size-4" aria-hidden="true" />
              Скачать
              <span
                aria-hidden="true"
                className="rounded-full border border-amber-500/50 bg-amber-500/15 px-1.5 py-px text-[9px] font-semibold leading-none text-amber-700 dark:text-amber-400"
              >
                В разработке
              </span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
