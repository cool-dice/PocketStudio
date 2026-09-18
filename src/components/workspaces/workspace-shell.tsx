"use client";

/**
 * WorkspaceShell — контекстная оболочка воркспейса (PS-3-b).
 *
 * Хедер (крошки, иконка типа, бейджи, прогресс, действия) + единая строка
 * вкладок типа + контент вкладки. «Обзор» (живой пайплайн) и «Заметки»
 * рендерятся здесь; остальные вкладки — через шов WorkspaceTabContent
 * (волна PS-3-d встраивает туда реальные модули студии).
 */

import { useState } from "react";

import { NotesTab } from "@/components/workspaces/notes-tab";
import { OverviewTab } from "@/components/workspaces/overview-tab";
import { WorkspaceHeader } from "@/components/workspaces/workspace-header";
import {
  WORKSPACE_TABPANEL_ID,
  WorkspaceTabsBar,
} from "@/components/workspaces/workspace-tabs-bar";
import { WorkspaceTabContent } from "@/components/workspaces/workspace-tabs";
import { Button } from "@/components/ui/button";
import { useAppUi } from "@/lib/store";
import {
  findWorkspace,
  WORKSPACE_TAB_META,
  type WorkspaceTab,
} from "@/lib/workspace-data";

export function WorkspaceShell({
  onOpenMobileNav,
}: {
  onOpenMobileNav: () => void;
}) {
  const activeWorkspaceId = useAppUi((s) => s.activeWorkspaceId);
  const activeWorkspaceOverride = useAppUi((s) => s.activeWorkspaceOverride);
  const workspaceTab = useAppUi((s) => s.workspaceTab);
  const setWorkspaceTab = useAppUi((s) => s.setWorkspaceTab);
  const closeWorkspace = useAppUi((s) => s.closeWorkspace);

  /** Локальный диалог оболочки («Настроить»): гаснет при смене вкладки. */
  const [settingsOpen, setSettingsOpen] = useState(false);

  /** Воркспейс мастера (override) имеет приоритет над мок-данными. */
  const workspace = activeWorkspaceOverride ?? findWorkspace(activeWorkspaceId);

  function handleTabChange(tab: WorkspaceTab) {
    setSettingsOpen(false);
    setWorkspaceTab(tab);
  }

  if (!workspace) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-background">
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <Button variant="ghost" size="sm" onClick={closeWorkspace}>
            ← Воркспейсы
          </Button>
        </div>
        <div className="flex flex-1 items-center justify-center p-8">
          <p className="text-sm text-muted-foreground">
            Воркспейс не найден — вернитесь к списку.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* ── Хедер воркспейса ── */}
      <WorkspaceHeader
        workspace={workspace}
        tab={workspaceTab}
        onOpenMobileNav={onOpenMobileNav}
        onBack={closeWorkspace}
        settingsOpen={settingsOpen}
        onOpenSettings={() => setSettingsOpen(true)}
        onCloseSettings={() => setSettingsOpen(false)}
      />

      {/* ── Единая строка вкладок ── */}
      <div className="shrink-0 border-b">
        <WorkspaceTabsBar
          workspace={workspace}
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
          <NotesTab workspace={workspace} />
        ) : (
          /* Шов для PS-3-d: реальные модули студии в контексте воркспейса. */
          <WorkspaceTabContent
            workspace={workspace}
            tab={workspaceTab}
            onOpenMobileNav={onOpenMobileNav}
          />
        )}
      </div>
    </div>
  );
}
