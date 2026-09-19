"use client";

/**
 * WorkspaceShell — контекстная оболочка воркспейса (Фаза A).
 *
 * Воркспейс загружается из БД по id из стора (api.getWorkspace) с
 * оптимистичным стартом из кэша списка и скелетоном на время загрузки.
 * Хедер и «Обзор» работают с WorkspaceDto; строка вкладок и вкладки-швы
 * (notes-tab, модули студии) получают легаси WorkspaceSummary через
 * summaryFromDto — сигнатуры швов не меняются.
 */

import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";

import { NotesTab } from "@/components/workspaces/notes-tab";
import { OverviewTab } from "@/components/workspaces/overview-tab";
import { WorkspaceHeader } from "@/components/workspaces/workspace-header";
import {
  WORKSPACE_TABPANEL_ID,
  WorkspaceTabsBar,
} from "@/components/workspaces/workspace-tabs-bar";
import { WorkspaceTabContent } from "@/components/workspaces/workspace-tabs";
import { summaryFromDto } from "@/components/workspaces/workspaces-data";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspace } from "@/hooks/use-workspaces";
import { useAppUi } from "@/lib/store";
import {
  WORKSPACE_TAB_META,
  type WorkspaceTab,
} from "@/lib/workspace-data";

export function WorkspaceShell({
  onOpenMobileNav,
}: {
  onOpenMobileNav: () => void;
}) {
  const activeWorkspaceId = useAppUi((s) => s.activeWorkspaceId);
  const workspaceTab = useAppUi((s) => s.workspaceTab);
  const setWorkspaceTab = useAppUi((s) => s.setWorkspaceTab);
  const closeWorkspace = useAppUi((s) => s.closeWorkspace);

  const { workspace, loading, error, reload } = useWorkspace(activeWorkspaceId);

  /** Локальный диалог оболочки («Настроить»): гаснет при смене вкладки. */
  const [settingsOpen, setSettingsOpen] = useState(false);

  /** Легаси-объект для вкладок-швов (notes-tab, модули студии). */
  const summary = useMemo(
    () => (workspace ? summaryFromDto(workspace) : null),
    [workspace],
  );

  function handleTabChange(tab: WorkspaceTab) {
    setSettingsOpen(false);
    setWorkspaceTab(tab);
  }

  if (loading && !workspace) {
    return (
      <WorkspaceSkeleton
        onOpenMobileNav={onOpenMobileNav}
        onBack={closeWorkspace}
      />
    );
  }

  if (!workspace || error || !summary) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-background">
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <Button variant="ghost" size="sm" onClick={closeWorkspace}>
            ← Воркспейсы
          </Button>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Воркспейс не найден — возможно, он был удалён.
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={reload}>
              <RotateCcw className="size-3.5" aria-hidden="true" />
              Повторить
            </Button>
            <Button variant="ghost" size="sm" onClick={closeWorkspace}>
              ← К списку
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* ── Хедер воркспейса (WorkspaceDto: live counts/stage/progress) ── */}
      <WorkspaceHeader
        workspace={workspace}
        tab={workspaceTab}
        onOpenMobileNav={onOpenMobileNav}
        onBack={closeWorkspace}
        settingsOpen={settingsOpen}
        onOpenSettings={() => setSettingsOpen(true)}
        onCloseSettings={() => setSettingsOpen(false)}
        onUpdated={reload}
        onDeleted={closeWorkspace}
      />

      {/* ── Единая строка вкладок ── */}
      <div className="shrink-0 border-b">
        <WorkspaceTabsBar
          workspace={summary}
          activeTab={workspaceTab}
          onTabChange={handleTabChange}
        />
      </div>

      {/* ── Контент вкладки ── */}
      <div
        id={WORKSPACE_TABPANEL_ID}
        role="tabpanel"
        aria-label={`Содержимое вкладки «${WORKSPACE_TAB_META[workspaceTab].label}»`}
        className="min-h-0 flex-1 overflow-hidden"
      >
        {workspaceTab === "overview" ? (
          <OverviewTab workspace={workspace} />
        ) : workspaceTab === "notes" ? (
          <NotesTab workspace={summary} />
        ) : (
          /* Шов для модулей студии: легаси WorkspaceSummary. */
          <WorkspaceTabContent
            workspace={summary}
            tab={workspaceTab}
            onOpenMobileNav={onOpenMobileNav}
          />
        )}
      </div>
    </div>
  );
}

/** Скелетон оболочки: крошки, иконка+название, бейджи, строка вкладок. */
function WorkspaceSkeleton({
  onOpenMobileNav,
  onBack,
}: {
  onOpenMobileNav: () => void;
  onBack: () => void;
}) {
  return (
    <div
      className="flex h-full min-h-0 flex-col bg-background"
      role="status"
      aria-label="Загрузка воркспейса"
    >
      <div className="shrink-0 bg-background px-4 pt-2.5 sm:px-6">
        {/* Крошки */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Button variant="ghost" size="icon" className="size-7 md:hidden" onClick={onOpenMobileNav} aria-label="Открыть навигацию" />
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={onBack}
          >
            ← Воркспейсы
          </Button>
          <span className="sr-only">Воркспейс загружается</span>
        </div>
        {/* Основная строка */}
        <div className="mt-2 flex items-start gap-2.5 pb-4 sm:gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="size-9 shrink-0"
            onClick={onBack}
            aria-label="Назад к воркспейсам"
          >
            <span aria-hidden="true">←</span>
          </Button>
          <Skeleton className="size-12 shrink-0 rounded-xl sm:size-14" />
          <div className="min-w-0 flex-1 space-y-2 pt-0.5">
            <Skeleton className="h-5 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
            <div className="hidden items-center gap-2 sm:flex">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-4 w-16 rounded-full" />
              ))}
            </div>
          </div>
          <Skeleton className="hidden h-1.5 w-40 rounded-full sm:block" />
        </div>
      </div>
      {/* Строка вкладок */}
      <div className="flex shrink-0 gap-1 border-b px-4 pb-2 sm:px-6">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-lg" />
        ))}
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-hidden p-4 sm:p-6">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    </div>
  );
}
