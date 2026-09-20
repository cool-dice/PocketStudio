"use client";

/**
 * WorkspaceHeader — хедер оболочки воркспейса (Фаза A).
 *
 * Живые данные из WorkspaceDto: хлебные крошки, крупная градиентная
 * иконка типа, название и подпись, бейджи типа/стадии, компактная
 * лента живых счётчиков counts, прогресс с процентом и временем
 * обновления + мобильная компоновка с гамбургером.
 */

import { useEffect, useState } from "react";
import {
  Archive,
  ArrowLeft,
  AudioWaveform,
  BookOpenText,
  Check,
  ChevronRight,
  Clapperboard,
  Copy,
  FolderKanban,
  ImagePlus,
  Menu,
  MoreHorizontal,
  NotebookPen,
  Pencil,
  RefreshCw,
  Settings2,
  Star,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { timeAgo } from "@/components/workspaces/home-data";
import {
  stageLabelOf,
  workspaceSubtitle,
} from "@/components/workspaces/workspaces-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import { invalidateWorkspaces } from "@/hooks/use-workspaces";
import { useAppUi } from "@/lib/store";
import {
  WORKSPACES_ARCHIVE_ACTION,
  WORKSPACES_FAVORITE_FAILED,
  WORKSPACES_UNARCHIVE_ACTION,
  workspaceArchiveToast,
} from "@/lib/workspace-copy";
import {
  WORKSPACE_TAB_META,
  WORKSPACE_TYPE_META,
  type WorkspaceTab,
} from "@/lib/workspace-data";
import type { WorkspaceDto } from "@/lib/workspace-types";
import { cn } from "@/lib/utils";

/** Живые счётчики хедера — те же шесть категорий, что в карточке списка. */
const COUNT_ITEMS = [
  { key: "notes", label: "Заметки", icon: NotebookPen },
  { key: "documents", label: "Документы", icon: BookOpenText },
  { key: "images", label: "Картинки", icon: ImagePlus },
  { key: "audio", label: "Аудио", icon: AudioWaveform },
  { key: "video", label: "Видео", icon: Clapperboard },
  { key: "files", label: "Файлы", icon: FolderKanban },
] as const;

export interface WorkspaceHeaderProps {
  workspace: WorkspaceDto;
  /** Активная вкладка — последняя крошка. */
  tab: WorkspaceTab;
  onOpenMobileNav: () => void;
  /** Назад к списку воркспейсов. */
  onBack: () => void;
  /** Диалог названия/описания (открытием управляет оболочка). */
  settingsOpen: boolean;
  onOpenSettings: () => void;
  onCloseSettings: () => void;
  /** После PATCH — перезагрузить оболочку. */
  onUpdated?: () => void;
  /** После удаления — назад к списку. */
  onDeleted?: () => void;
}

export function WorkspaceHeader({
  workspace,
  tab,
  onOpenMobileNav,
  onBack,
  settingsOpen,
  onOpenSettings,
  onCloseSettings,
  onUpdated,
  onDeleted,
}: WorkspaceHeaderProps) {
  const meta = WORKSPACE_TYPE_META[workspace.type];
  const stage = stageLabelOf(workspace);
  const updatedAgo = timeAgo(workspace.updatedAt);
  const tabLabel = WORKSPACE_TAB_META[tab].label;

  const [name, setName] = useState(workspace.name);
  const [description, setDescription] = useState(workspace.description ?? "");
  const [saving, setSaving] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (settingsOpen) {
      setName(workspace.name);
      setDescription(workspace.description ?? "");
    }
  }, [settingsOpen, workspace.name, workspace.description]);

  async function reindexWorkspace() {
    setReindexing(true);
    try {
      const res = await api.reindexRag({ projectId: workspace.id });
      toast.success(res.message ?? "Воркспейс переиндексирован");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Не удалось переиндексировать",
      );
    } finally {
      setReindexing(false);
    }
  }

  async function saveMeta() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Название не может быть пустым");
      return;
    }
    setSaving(true);
    try {
      await api.updateWorkspace(workspace.id, {
        name: trimmed,
        description: description.trim() || null,
      });
      toast.success("Воркспейс обновлён");
      onCloseSettings();
      invalidateWorkspaces();
      onUpdated?.();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Не удалось сохранить",
      );
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      await api.deleteWorkspace(workspace.id);
      toast.success("Воркспейс удалён");
      setDeleteOpen(false);
      invalidateWorkspaces();
      onDeleted?.();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Не удалось удалить воркспейс",
      );
    } finally {
      setDeleting(false);
    }
  }

  async function duplicateWorkspace() {
    try {
      const copy = await api.duplicateWorkspace(workspace.id);
      toast.success("Создана копия воркспейса");
      invalidateWorkspaces();
      useAppUi.getState().openWorkspace(copy.id);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Не удалось дублировать",
      );
    }
  }

  async function toggleArchive() {
    const next = !workspace.archived;
    try {
      const updated = await api.updateWorkspace(workspace.id, {
        archived: next,
      });
      const result = workspaceArchiveToast(true, updated.archived);
      toast.success(result.message);
      invalidateWorkspaces();
      if (updated.archived) onDeleted?.();
      else onUpdated?.();
    } catch (err) {
      const failed = workspaceArchiveToast(false, next);
      toast.error(
        err instanceof ApiError ? err.message : failed.message,
      );
    }
  }

  async function toggleFavorite() {
    try {
      await api.updateWorkspace(workspace.id, { favorite: !workspace.favorite });
      invalidateWorkspaces();
      onUpdated?.();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : WORKSPACES_FAVORITE_FAILED,
      );
    }
  }

  return (
    <header className="shrink-0 bg-background">
      <div className="px-4 pt-2.5 sm:px-6">
        {/* ── Хлебные крошки ── */}
        <nav aria-label="Путь к воркспейсу" className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0 md:hidden"
            onClick={onOpenMobileNav}
            aria-label="Открыть навигацию"
          >
            <Menu className="size-4" aria-hidden="true" />
          </Button>
          <button
            type="button"
            onClick={onBack}
            className="shrink-0 rounded-sm outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            Воркспейсы
          </button>
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/50" aria-hidden="true" />
          <span className="hidden max-w-56 truncate sm:inline">{workspace.name}</span>
          <ChevronRight
            className="hidden size-3.5 shrink-0 text-muted-foreground/50 sm:inline"
            aria-hidden="true"
          />
          <span className="truncate font-medium text-foreground">{tabLabel}</span>
        </nav>

        {/* ── Основная строка ── */}
        <div className="mt-2 flex items-start gap-2.5 pb-3 sm:gap-3 sm:pb-4">
          <Button
            variant="ghost"
            size="icon"
            className="size-9 shrink-0"
            onClick={onBack}
            aria-label="Назад к воркспейсам"
          >
            <ArrowLeft className="size-5" aria-hidden="true" />
          </Button>

          <span
            aria-hidden="true"
            className={cn(
              "flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm sm:size-14",
              meta.gradient,
            )}
          >
            <meta.icon className="size-6 sm:size-7" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-lg font-semibold leading-tight sm:text-xl">
                {workspace.name}
              </h1>
              <Badge variant="secondary" title={meta.hint}>
                {meta.label}
              </Badge>
              <Badge
                variant="outline"
                className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              >
                {stage}
              </Badge>
            </div>
            <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
              {workspaceSubtitle(workspace)}
            </p>

            {/* Живые счётчики */}
            <div
              className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground"
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

            {/* Прогресс: мобильная строка */}
            <div className="mt-2 sm:hidden">
              <div
                className="h-1 w-full overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuenow={workspace.progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Прогресс воркспейса"
              >
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${workspace.progress}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
                {workspace.progress}% · {updatedAgo}
              </p>
            </div>
          </div>

          {/* Прогресс: настольный столбик справа */}
          <div className="hidden w-40 shrink-0 pt-1 sm:block">
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={workspace.progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Прогресс воркспейса"
            >
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${workspace.progress}%` }}
              />
            </div>
            <p className="mt-1 text-right text-[11px] tabular-nums text-muted-foreground">
              {workspace.progress}% · {updatedAgo}
            </p>
          </div>

          {/* ── Действия ── */}
          <div className="flex shrink-0 items-center gap-1 pt-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="size-9"
              onClick={() => void toggleFavorite()}
              aria-label={workspace.favorite ? "Убрать из избранного" : "В избранное"}
              title="Избранное"
            >
              <Star
                className={cn(
                  "size-4.5",
                  workspace.favorite && "fill-amber-400 text-amber-400",
                )}
                aria-hidden="true"
              />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-9"
              onClick={onOpenSettings}
              aria-label="Настройки воркспейса"
              title="Настроить воркспейс"
            >
              <Settings2 className="size-4.5" aria-hidden="true" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9"
                  aria-label="Ещё действия с воркспейсом"
                  title="Ещё действия"
                >
                  <MoreHorizontal className="size-4.5" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={onOpenSettings}>
                  <Pencil aria-hidden="true" />
                  Переименовать
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => void duplicateWorkspace()}
                >
                  <Copy aria-hidden="true" />
                  Дублировать
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => void toggleArchive()}
                >
                  <Archive aria-hidden="true" />
                  {workspace.archived
                    ? WORKSPACES_UNARCHIVE_ACTION
                    : WORKSPACES_ARCHIVE_ACTION}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 aria-hidden="true" />
                  Удалить
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* ── Название и описание ── */}
      <Dialog open={settingsOpen} onOpenChange={(open) => (open ? onOpenSettings() : onCloseSettings())}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Воркспейс</DialogTitle>
            <DialogDescription>
              Название и описание хранятся в базе. Тип пайплайна сейчас не меняется.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Название</span>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                aria-label="Название воркспейса"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Описание</span>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                aria-label="Описание воркспейса"
              />
            </label>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-center gap-1.5"
              disabled={reindexing}
              onClick={() => void reindexWorkspace()}
            >
              <RefreshCw className={cn("size-3.5", reindexing && "animate-spin")} />
              {reindexing ? "Индексируем…" : "Переиндексировать"}
            </Button>
            <p className="text-[11px] leading-snug text-muted-foreground">
              Обновить RAG только этого воркспейса. Нужна модель инструмента «Эмбеддинги».
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onCloseSettings}>
              Отмена
            </Button>
            <Button onClick={() => void saveMeta()} disabled={saving || !name.trim()}>
              <Check aria-hidden="true" />
              {saving ? "Сохраняем…" : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить воркспейс?</AlertDialogTitle>
            <AlertDialogDescription>
              «{workspace.name}», документы, сущности и артефакты будут удалены
              безвозвратно.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? "Удаляем…" : "Удалить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  );
}

