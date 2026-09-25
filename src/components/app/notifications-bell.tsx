"use client";

/**
 * NotificationsBell — the sidebar bell (replaces the old «скоро» placeholder).
 *
 * Popover with the persistent history (latest 50): per-type icons, unread
 * markers, relative timestamps, click-through navigation (analysis → note,
 * project events → project screen) and mark-all-read / clear actions.
 * Live updates arrive through the notifications store (WS notification:new).
 *
 * side: "right" (desktop aside) | "bottom" (mobile Sheet — a right-side
 * popover would collide with the viewport edge).
 */

import { useState } from "react";
import {
  AlarmClock,
  Bell,
  BellOff,
  CheckCheck,
  FolderKanban,
  GitCommitHorizontal,
  Sparkles,
  Trash2,
  RefreshCw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { relativeTime, textPreview } from "@/lib/format";
import {
  BELL_CLEAR,
  BELL_CLEARED,
  BELL_EMPTY,
  BELL_EMPTY_HINT,
  BELL_LOAD_ERROR,
  BELL_LOAD_ERROR_HINT,
  BELL_MARK_ALL_READ,
  BELL_RETRY,
  bellListView,
} from "@/lib/notification-copy";
import { notificationOpensWorkspace } from "@/lib/composer-binding";
import { useNotifications } from "@/lib/notifications-store";
import { useAppUi } from "@/lib/store";
import type { Notification, NotificationType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { peekOwnedWorkspace } from "@/hooks/use-workspaces";

const TYPE_META: Record<
  NotificationType,
  { icon: typeof Bell; iconClass: string; ariaLabel: string }
> = {
  analysis_ready: {
    icon: Sparkles,
    iconClass: "text-emerald-600 dark:text-emerald-400",
    ariaLabel: "Готов анализ",
  },
  project_created: {
    icon: FolderKanban,
    iconClass: "text-amber-600 dark:text-amber-400",
    ariaLabel: "Создан воркспейс или проект",
  },
  checkpoint: {
    icon: GitCommitHorizontal,
    iconClass: "text-teal-600 dark:text-teal-400",
    ariaLabel: "Чекпоинт",
  },
  reminder: {
    icon: AlarmClock,
    iconClass: "text-amber-600 dark:text-amber-400",
    ariaLabel: "Напоминание",
  },
  system: {
    icon: Bell,
    iconClass: "text-stone-500 dark:text-stone-400",
    ariaLabel: "Системное",
  },
};

function openStudioOrCodeProject(
  id: string,
  title: string,
  body: string | null,
) {
  const ui = useAppUi.getState();
  if (peekOwnedWorkspace(id)) {
    ui.openWorkspace(id);
    return;
  }
  void api.getWorkspace(id).then(
    () => ui.openWorkspace(id),
    () => {
      if (
        notificationOpensWorkspace({
          cachedStudio: false,
          fetchOk: false,
          title,
          body,
        })
      ) {
        ui.openWorkspace(id);
        return;
      }
      ui.openProject(id);
    },
  );
}

export function NotificationsBell({ side = "right" }: { side?: "right" | "bottom" }) {
  const { notifications, unread, loaded, loadError } = useNotifications();
  const markRead = useNotifications((s) => s.markRead);
  const markAllRead = useNotifications((s) => s.markAllRead);
  const clearAll = useNotifications((s) => s.clearAll);
  const refresh = useNotifications((s) => s.refresh);

  const [open, setOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const listView = bellListView(loaded, loadError, notifications.length);

  // Stale resync: a popover open with an empty/unloaded list (e.g. the socket
  // never connected) still deserves fresh data. A previous load error retries.
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next && (!loaded || loadError)) void refresh();
  };

  const handleItemClick = (n: Notification) => {
    markRead(n.id);
    const ui = useAppUi.getState();
    if ((n.type === "analysis_ready" || n.type === "reminder") && n.entityId) {
      void api
        .getNote(n.entityId)
        .then((note) => {
          ui.openNote(note);
          ui.setMainArea("notebook");
        })
        .catch(() => {
          toast.error("Заметка не найдена — возможно, удалена");
          ui.setMainArea("notebook");
        });
    } else if ((n.type === "project_created" || n.type === "checkpoint") && n.entityId) {
      openStudioOrCodeProject(n.entityId, n.title, n.body);
    }
    setOpen(false);
  };

  const handleClear = async () => {
    setClearing(true);
    try {
      await clearAll();
      toast.success(BELL_CLEARED);
    } finally {
      setClearing(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-9"
          aria-label={
            unread > 0
              ? `Уведомления — непрочитанных: ${unread}`
              : "Уведомления"
          }
        >
          <Bell className="size-4" aria-hidden="true" />
          {unread > 0 && (
            <span
              key={unread}
              aria-hidden="true"
              className={cn(
                "vf-badge-pop absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1",
                "text-[10px] font-semibold leading-4 text-primary-foreground tabular-nums",
                unread > 99 && "px-1.5",
              )}
            >
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side={side}
        sideOffset={8}
        collisionPadding={12}
        className="w-96 max-w-[calc(100vw-1.5rem)] rounded-2xl p-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[side=right]:slide-in-from-left-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Уведомления</p>
            <p className="text-xs text-muted-foreground">
              {unread > 0 ? `непрочитанных: ${unread}` : "всё прочитано"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {unread > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={BELL_MARK_ALL_READ}
                onClick={() => void markAllRead()}
              >
                <CheckCheck className="size-4" aria-hidden="true" />
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 hover:text-destructive"
                aria-label={BELL_CLEAR}
                disabled={clearing}
                onClick={() => void handleClear()}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
        <Separator />

        {/* ── List ── */}
        <div className="vf-scroll max-h-96 overflow-y-auto">
          {listView === "loading" ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="size-8 shrink-0 rounded-lg" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : listView === "error" ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <p className="text-sm font-medium">{loadError ?? BELL_LOAD_ERROR}</p>
              <p className="max-w-56 text-xs leading-relaxed text-muted-foreground">
                {BELL_LOAD_ERROR_HINT}
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-1"
                onClick={() => void refresh()}
              >
                <RefreshCw className="size-4" aria-hidden="true" />
                {BELL_RETRY}
              </Button>
            </div>
          ) : listView === "empty" ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <span className="flex size-11 items-center justify-center rounded-full bg-muted">
                <BellOff className="size-5 text-muted-foreground" aria-hidden="true" />
              </span>
              <p className="text-sm font-medium">{BELL_EMPTY}</p>
              <p className="max-w-56 text-xs leading-relaxed text-muted-foreground">
                {BELL_EMPTY_HINT}
              </p>
            </div>
          ) : (
            <ul className="py-1">
              {notifications.map((n) => {
                const meta = TYPE_META[n.type] ?? TYPE_META.system;
                const Icon = meta.icon;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleItemClick(n)}
                      className={cn(
                        "flex w-full items-start gap-3 px-4 py-2.5 text-left outline-none transition-colors duration-150 hover:bg-accent/60 focus-visible:bg-accent/60",
                        !n.read && "bg-primary/[0.04]",
                      )}
                      aria-label={`${n.title}. ${relativeTime(n.createdAt)}`}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background",
                          !n.read && "border-primary/30",
                        )}
                      >
                        <Icon className={cn("size-4", meta.iconClass)} aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            "flex items-center gap-1.5",
                            !n.read && "font-medium",
                          )}
                        >
                          <span className="min-w-0 truncate text-sm">
                            {n.title}
                          </span>
                          {!n.read && (
                            <span
                              aria-hidden="true"
                              className="size-1.5 shrink-0 rounded-full bg-primary"
                            />
                          )}
                        </span>
                        {n.body && (
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                            {textPreview(n.body, 80)}
                          </span>
                        )}
                        <span className="mt-0.5 block text-[11px] text-muted-foreground/80">
                          {relativeTime(n.createdAt)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
