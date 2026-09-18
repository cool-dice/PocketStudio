"use client";

/**
 * WorkspaceTabsBar — единая строка вкладок оболочки воркспейса (PS-3-b).
 *
 * Состав вкладок зависит от типа воркспейса (WORKSPACE_TABS_BY_TYPE).
 * Горизонтальный скролл на мобильных (vf-scroll-x), активная вкладка —
 * изумрудный primary-стиль. Клавиатура: Tab фокусирует, ←/→ переключают.
 */

import { useRef } from "react";

import {
  WORKSPACE_TABS_BY_TYPE,
  WORKSPACE_TAB_META,
  type WorkspaceSummary,
  type WorkspaceTab,
} from "@/lib/workspace-data";
import { cn } from "@/lib/utils";

export const WORKSPACE_TABPANEL_ID = "workspace-tabpanel";

export interface WorkspaceTabsBarProps {
  workspace: WorkspaceSummary;
  activeTab: WorkspaceTab;
  /** Переключение вкладки (оболочка заодно закрывает локальные диалоги). */
  onTabChange: (tab: WorkspaceTab) => void;
}

export function WorkspaceTabsBar({
  workspace,
  activeTab,
  onTabChange,
}: WorkspaceTabsBarProps) {
  const tabs = WORKSPACE_TABS_BY_TYPE[workspace.type];
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const idx = tabs.indexOf(activeTab);
    if (idx === -1) return;
    const dir = e.key === "ArrowRight" ? 1 : -1;
    const next = (idx + dir + tabs.length) % tabs.length;
    tabRefs.current[next]?.focus();
    onTabChange(tabs[next]);
  }

  return (
    <div
      role="tablist"
      aria-label="Разделы воркспейса"
      onKeyDown={handleKeyDown}
      className="vf-scroll-x flex shrink-0 gap-1 overflow-x-auto px-4 pb-2 sm:px-6"
    >
      {tabs.map((tab, i) => {
        const meta = WORKSPACE_TAB_META[tab];
        const active = tab === activeTab;
        return (
          <button
            key={tab}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={WORKSPACE_TABPANEL_ID}
            onClick={() => onTabChange(tab)}
            className={cn(
              "flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm outline-none transition-colors duration-150",
              "focus-visible:ring-2 focus-visible:ring-ring/60",
              active
                ? "bg-primary/10 font-medium text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <meta.icon className="size-4 shrink-0" aria-hidden="true" />
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}
