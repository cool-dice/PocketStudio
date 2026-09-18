"use client";

/**
 * WorkspaceHeader — хедер оболочки воркспейса (PS-3-b).
 *
 * Хлебные крошки (Воркспейсы / название / активная вкладка), крупная
 * градиентная иконка типа, название и подпись, бейджи типа/стадии/артефактов,
 * прогресс с процентом, действия («Настроить» — мок-диалог, «⋯» — меню) и
 * мобильная компоновка с гамбургером.
 */

import { useState } from "react";
import {
  Archive,
  ArrowLeft,
  BellRing,
  Check,
  ChevronRight,
  Copy,
  Library,
  Menu,
  MoreHorizontal,
  Pencil,
  Save,
  Settings2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { artifactsOfWorkspace } from "@/components/workspaces/shared/artifacts-data";
import { createdAgoOf, pluralArtifacts } from "@/components/workspaces/overview-data";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import {
  WORKSPACE_STAGES,
  WORKSPACE_TAB_META,
  WORKSPACE_TYPE_META,
  type WorkspaceSummary,
  type WorkspaceTab,
} from "@/lib/workspace-data";
import { cn } from "@/lib/utils";

export interface WorkspaceHeaderProps {
  workspace: WorkspaceSummary;
  /** Активная вкладка — последняя крошка. */
  tab: WorkspaceTab;
  onOpenMobileNav: () => void;
  /** Назад к списку воркспейсов. */
  onBack: () => void;
  /** Мок-диалог «Настроить» (открытием управляет оболочка). */
  settingsOpen: boolean;
  onOpenSettings: () => void;
  onCloseSettings: () => void;
}

export function WorkspaceHeader({
  workspace,
  tab,
  onOpenMobileNav,
  onBack,
  settingsOpen,
  onOpenSettings,
  onCloseSettings,
}: WorkspaceHeaderProps) {
  const meta = WORKSPACE_TYPE_META[workspace.type];
  const artifactCount = artifactsOfWorkspace(workspace.id).length;
  const tabLabel = WORKSPACE_TAB_META[tab].label;

  const [notifyStage, setNotifyStage] = useState(true);
  const [autosave, setAutosave] = useState(true);
  const [inLibrary, setInLibrary] = useState(true);

  function handleMenuAction(action: string) {
    toast.info(action, {
      description: "Демо-режим: действие заработает вместе с реальным хранением воркспейсов.",
    });
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
          <span className="hidden max-w-56 truncate sm:inline">{workspace.title}</span>
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
              workspace.gradient,
            )}
          >
            <meta.icon className="size-6 sm:size-7" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-lg font-semibold leading-tight sm:text-xl">
                {workspace.title}
              </h1>
              <Badge variant="secondary" title={meta.hint}>
                {meta.label}
              </Badge>
              <Badge
                variant="outline"
                className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              >
                {workspace.stage}
              </Badge>
              <Badge variant="outline" className="gap-1 font-normal text-muted-foreground">
                {pluralArtifacts(artifactCount)}
              </Badge>
            </div>
            <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
              {workspace.subtitle}
            </p>

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
                {workspace.progress}% · {workspace.updatedAgo}
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
              {workspace.progress}% · {workspace.updatedAgo}
            </p>
          </div>

          {/* ── Действия ── */}
          <div className="flex shrink-0 items-center gap-1 pt-0.5">
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
                <DropdownMenuItem onClick={() => handleMenuAction("Переименовать")}>
                  <Pencil aria-hidden="true" />
                  Переименовать
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleMenuAction("Дублировать")}>
                  <Copy aria-hidden="true" />
                  Дублировать
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleMenuAction("Архивировать")}>
                  <Archive aria-hidden="true" />
                  Архивировать
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => handleMenuAction("Удалить")}
                >
                  <Trash2 aria-hidden="true" />
                  Удалить
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* ── Мок-диалог «Настроить воркспейс» ── */}
      <Dialog open={settingsOpen} onOpenChange={(open) => (open ? onOpenSettings() : onCloseSettings())}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Настройки воркспейса
              <Badge
                variant="outline"
                className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
              >
                В разработке
              </Badge>
            </DialogTitle>
            <DialogDescription>
              Пока демо: переключатели живут только в этом сеансе. Реальное
              хранение настроек появится вместе с бэкендом воркспейсов.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1">
            <SettingSwitchRow
              icon={BellRing}
              label="Уведомления о смене стадии"
              hint="Присылать сообщение, когда пайплайн переходит на новый этап"
              checked={notifyStage}
              onCheckedChange={setNotifyStage}
            />
            <SettingSwitchRow
              icon={Save}
              label="Автосохранение черновиков"
              hint="Сохранять открытые документы и заметки каждые 30 секунд"
              checked={autosave}
              onCheckedChange={setAutosave}
            />
            <SettingSwitchRow
              icon={Library}
              label="Показывать в Библиотеке"
              hint="Артефакты воркспейса видны в общем каталоге контента"
              checked={inLibrary}
              onCheckedChange={setInLibrary}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Тип «{meta.label}» · пайплайн из {WORKSPACE_STAGES[workspace.type].length}{" "}
            стадий · создан {createdAgoOf(workspace)}
          </p>

          <DialogFooter>
            <Button variant="outline" onClick={onCloseSettings}>
              Закрыть
            </Button>
            <Button
              onClick={() => {
                onCloseSettings();
                toast.success("Настройки сохранены", {
                  description: "Демо-режим: изменения действуют до перезагрузки страницы.",
                });
              }}
            >
              <Check aria-hidden="true" />
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}

function SettingSwitchRow({
  icon: Icon,
  label,
  hint,
  checked,
  onCheckedChange,
}: {
  icon: typeof BellRing;
  label: string;
  hint: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border bg-card/50 p-3 transition-colors hover:bg-accent/50">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
          {hint}
        </span>
      </span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={label} />
    </label>
  );
}
