"use client";

/**
 * UI-атомы шва вкладок воркспейса (PS-3-d).
 *
 * WorkspaceModuleFrame — лёгкая рамка для встраивания экранов модулей
 * студии внутрь оболочки воркспейса: flex-колонка с overflow-hidden и
 * корректной высотой (h-full + min-h-0), чтобы собственные sticky-
 * заголовки и внутренние скроллы экранов работали без искажений.
 *
 * WorkspaceTabMetaPlaceholder — мягкий фолбэк для вкладок, которые не
 * маршрутизированы во встраивание (Обзор/Заметки обрабатываются самой
 * оболочкой PS-3-b до вызова шва).
 */

import { Sparkles } from "lucide-react";

import {
  WORKSPACE_TAB_META,
  type WorkspaceSummary,
  type WorkspaceTab,
} from "@/lib/workspace-data";
import { cn } from "@/lib/utils";

export function WorkspaceModuleFrame({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden bg-background",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function WorkspaceTabMetaPlaceholder({
  workspace,
  tab,
}: {
  workspace: WorkspaceSummary;
  tab: WorkspaceTab;
}) {
  const meta = WORKSPACE_TAB_META[tab];
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="flex max-w-md flex-col items-center gap-2 text-center">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Sparkles className="size-5" aria-hidden="true" />
        </span>
        <p className="text-sm font-medium">
          «{meta.label}» · {workspace.title}
        </p>
        <p className="text-sm text-muted-foreground">
          Вкладка встраивается волной PS-3: здесь появится соответствующий
          модуль студии в контексте этого воркспейса.
        </p>
      </div>
    </div>
  );
}
