"use client";

/**
 * SidebarContent — logo + notifications bell, «Новый диалог», thread list
 * (rename inline / delete with confirm), collections (soon), profile menu
 * (theme toggle, admin panel for admins, logout) with a WS status dot.
 * Rendered inside the desktop <aside> and the mobile <Sheet>.
 */

import { useState } from "react";
import {
  Bell,
  Check,
  FolderKanban,
  LogOut,
  MessageSquarePlus,
  Moon,
  NotebookPen,
  PenLine,
  Pencil,
  Search,
  Shield,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";

import { Logo } from "@/components/logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { useProjects } from "@/hooks/use-projects";
import { useSocket } from "@/hooks/use-socket";
import { useThreads } from "@/hooks/use-threads";
import { ORIGIN_META } from "@/lib/project-style";
import { useAppUi } from "@/lib/store";
import type { ThreadListItem } from "@/lib/types";
import { cn } from "@/lib/utils";

interface SidebarContentProps {
  /** Close the mobile sheet after selecting/creating a thread. */
  onNavigate?: () => void;
  /** Reserve space for the Sheet close button. */
  sheetMode?: boolean;
}

export function SidebarContent({ onNavigate, sheetMode }: SidebarContentProps) {
  const { user, logout } = useAuth();
  const { connected } = useSocket();
  const { projects } = useProjects();
  const {
    threads,
    threadsLoading,
    activeThreadId,
    selectThread,
    newThread,
    deleteThread,
    renameThread,
  } = useThreads();
  const mainArea = useAppUi((s) => s.mainArea);
  const setMainArea = useAppUi((s) => s.setMainArea);
  const setCaptureOpen = useAppUi((s) => s.setCaptureOpen);
  const setSearchOpen = useAppUi((s) => s.setSearchOpen);
  const activeProjectId = useAppUi((s) => s.activeProjectId);
  const openProject = useAppUi((s) => s.openProject);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ThreadListItem | null>(null);
  const [creating, setCreating] = useState(false);

  const initials = (user?.name ?? "U")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  const handleSelect = (id: string) => {
    onNavigate?.();
    setMainArea("chat");
    void selectThread(id);
  };

  const handleNewThread = async () => {
    onNavigate?.();
    setMainArea("chat");
    setCreating(true);
    try {
      await newThread();
    } finally {
      setCreating(false);
    }
  };

  const handleOpenNotebook = () => {
    onNavigate?.();
    setMainArea("notebook");
  };

  const handleOpenProjects = () => {
    onNavigate?.();
    setMainArea("projects");
  };

  const handleOpenProject = (id: string) => {
    onNavigate?.();
    openProject(id);
  };

  const handleOpenCapture = () => {
    onNavigate?.();
    setCaptureOpen(true);
  };

  const handleOpenSearch = () => {
    onNavigate?.();
    setSearchOpen(true);
  };

  const startRename = (thread: ThreadListItem) => {
    setRenamingId(thread.id);
    setRenameValue(thread.title);
  };

  const commitRename = () => {
    if (renamingId) {
      void renameThread(renamingId, renameValue);
    }
    setRenamingId(null);
  };

  const confirmDelete = () => {
    if (deleteTarget) {
      onNavigate?.();
      void deleteThread(deleteTarget.id);
    }
    setDeleteTarget(null);
  };

  return (
    <>
      {/* ── Header: logo + notifications ── */}
      <div
        className={cn(
          "flex h-14 shrink-0 items-center justify-between border-b px-4",
          sheetMode && "pr-12",
        )}
      >
        <Logo />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative size-9"
              disabled
              aria-label="Уведомления (скоро)"
            >
              <Bell className="size-4" aria-hidden="true" />
              <span
                aria-hidden="true"
                className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary"
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Уведомления появятся скоро</TooltipContent>
        </Tooltip>
      </div>

      {/* ── New thread + quick capture + search ── */}
      <div className="flex gap-2 p-3">
        <Button
          className="min-w-0 flex-1 justify-center gap-2 rounded-xl"
          onClick={() => void handleNewThread()}
          disabled={creating}
        >
          <MessageSquarePlus className="size-4 shrink-0" aria-hidden="true" />
          <span className="truncate">
            {creating ? "Создаём…" : "Новый диалог"}
          </span>
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="size-10 shrink-0 rounded-xl"
              onClick={handleOpenSearch}
              aria-label="Поиск по VibeFlow (Ctrl+P)"
            >
              <Search className="size-4" aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Поиск · Ctrl P</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="size-10 shrink-0 rounded-xl"
              onClick={handleOpenCapture}
              aria-label="Записать мысль (Ctrl+K)"
            >
              <PenLine className="size-4" aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Записать мысль · Ctrl K</TooltipContent>
        </Tooltip>
      </div>

      {/* ── Threads ── */}
      <nav aria-label="Диалоги" className="flex min-h-0 flex-1 flex-col px-3">
        <h3 className="px-1 pb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Диалоги
        </h3>
        <div className="vf-scroll min-h-0 flex-1 overflow-y-auto pb-2">
          {threadsLoading ? (
            <div className="space-y-2 px-1 pt-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : threads.length === 0 ? (
            <p className="px-1 pt-2 text-sm leading-relaxed text-muted-foreground">
              Пока нет диалогов. Начните новый — и он появится здесь.
            </p>
          ) : (
            <ul className="space-y-1">
              {threads.map((thread) => {
                const active = thread.id === activeThreadId;
                if (renamingId === thread.id) {
                  return (
                    <li key={thread.id}>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          commitRename();
                        }}
                        className="flex items-center gap-1 rounded-lg border bg-background px-2 py-1"
                      >
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") setRenamingId(null);
                          }}
                          maxLength={120}
                          aria-label="Новое название диалога"
                          className="h-8 min-w-0 flex-1 bg-transparent text-sm outline-none"
                        />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="icon"
                          className="size-7 shrink-0"
                          aria-label="Сохранить название"
                        >
                          <Check className="size-3.5" aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7 shrink-0"
                          onClick={() => setRenamingId(null)}
                          aria-label="Отменить переименование"
                        >
                          <X className="size-3.5" aria-hidden="true" />
                        </Button>
                      </form>
                    </li>
                  );
                }
                return (
                  <li key={thread.id} className="group">
                    <div
                      className={cn(
                        "flex items-center gap-1 rounded-lg px-2 py-1.5 transition-colors duration-150",
                        active
                          ? "bg-accent"
                          : "hover:bg-accent/60",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => handleSelect(thread.id)}
                        aria-current={active ? "true" : undefined}
                        className="min-w-0 flex-1 py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/60 rounded-md"
                      >
                        <span
                          className={cn(
                            "block truncate text-sm",
                            active ? "font-medium" : "font-normal",
                          )}
                        >
                          {thread.title}
                        </span>
                        {thread.lastMessage && (
                          <span className="block truncate text-xs text-muted-foreground">
                            {thread.lastMessage.role === "assistant"
                              ? "VibeFlow: "
                              : ""}
                            {thread.lastMessage.content}
                          </span>
                        )}
                      </button>
                      <span className="flex shrink-0 items-center opacity-100 transition-opacity duration-150 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() => startRename(thread)}
                          aria-label={`Переименовать диалог «${thread.title}»`}
                        >
                          <Pencil className="size-3.5" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 hover:text-destructive"
                          onClick={() => setDeleteTarget(thread)}
                          aria-label={`Удалить диалог «${thread.title}»`}
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                        </Button>
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </nav>

      {/* ── Collections ── */}
      <div className="shrink-0 border-t p-3">
        <h3 className="px-1 pb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Коллекции
        </h3>
        <ul className="space-y-1">
          <li>
            <button
              type="button"
              onClick={handleOpenNotebook}
              aria-current={mainArea === "notebook" ? "true" : undefined}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-sm outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring/60",
                mainArea === "notebook"
                  ? "bg-accent font-medium text-accent-foreground"
                  : "text-foreground/90 hover:bg-accent/60",
              )}
            >
              <NotebookPen
                className={cn(
                  "size-4 shrink-0 transition-colors duration-150",
                  mainArea === "notebook" && "text-primary",
                )}
                aria-hidden="true"
              />
              <span className="flex-1 text-left">Блокнот</span>
            </button>
          </li>
        </ul>
      </div>

      {/* ── Projects ── */}
      <div className="shrink-0 border-t p-3">
        <h3 className="px-1 pb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Проекты
        </h3>
        <ul className="space-y-1">
          <li>
            <button
              type="button"
              onClick={handleOpenProjects}
              aria-current={mainArea === "projects" ? "true" : undefined}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-sm outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring/60",
                mainArea === "projects"
                  ? "bg-accent font-medium text-accent-foreground"
                  : "text-foreground/90 hover:bg-accent/60",
              )}
            >
              <FolderKanban
                className={cn(
                  "size-4 shrink-0 transition-colors duration-150",
                  (mainArea === "projects" || mainArea === "project") &&
                    "text-primary",
                )}
                aria-hidden="true"
              />
              <span className="flex-1 text-left">Все проекты</span>
              {projects.length > 0 && (
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {projects.length}
                </span>
              )}
            </button>
          </li>
        </ul>
        {projects.length > 0 && (
          <div className="vf-scroll mt-1 max-h-48 overflow-y-auto">
            <ul className="space-y-0.5">
              {projects.map((project) => {
                const active =
                  mainArea === "project" && activeProjectId === project.id;
                const meta = ORIGIN_META[project.origin] ?? ORIGIN_META.template;
                const Icon = meta.icon;
                return (
                  <li key={project.id}>
                    <button
                      type="button"
                      onClick={() => handleOpenProject(project.id)}
                      aria-current={active ? "true" : undefined}
                      title={project.name}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring/60",
                        active
                          ? "bg-accent font-medium text-accent-foreground"
                          : "text-foreground/80 hover:bg-accent/60",
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-3.5 shrink-0",
                          active ? meta.iconClass : "text-muted-foreground/70",
                        )}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1 truncate text-left">
                        {project.name}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {/* ── Profile ── */}
      <div className="shrink-0 border-t p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Меню профиля"
              className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left outline-none transition-colors duration-150 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              <span className="relative">
                <Avatar className="size-8">
                  <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                    {initials || "U"}
                  </AvatarFallback>
                </Avatar>
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-sidebar",
                    connected ? "bg-emerald-500" : "vf-status-pulse bg-amber-500",
                  )}
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {user?.name}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {connected ? "на связи" : "переподключение…"}
                </span>
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60">
            <DropdownMenuLabel className="min-w-0">
              <span className="block truncate font-medium">{user?.name}</span>
              <span className="block truncate text-xs font-normal text-muted-foreground">
                {user?.email}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <ThemeToggleItem />
            {user?.role === "admin" && (
              <DropdownMenuItem disabled>
                <Shield className="size-4" aria-hidden="true" />
                Админка
                <Badge variant="secondary" className="ml-auto text-[10px]">
                  скоро
                </Badge>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => void logout()}
            >
              <LogOut className="size-4" aria-hidden="true" />
              Выйти
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ── Delete confirmation ── */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить диалог?</AlertDialogTitle>
            <AlertDialogDescription>
              «{deleteTarget?.title}» и вся его история будут удалены
              безвозвратно.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ThemeToggleItem() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  return (
    <DropdownMenuItem
      onSelect={(e) => {
        // Keep the menu open when flipping the switch.
        e.preventDefault();
        setTheme(isDark ? "light" : "dark");
      }}
    >
      <Sun className="size-4 dark:hidden" aria-hidden="true" />
      <Moon className="hidden size-4 dark:block" aria-hidden="true" />
      Тёмная тема
      <Switch
        checked={isDark}
        aria-label="Тёмная тема"
        className="ml-auto"
        onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
        onClick={(e) => e.stopPropagation()}
      />
    </DropdownMenuItem>
  );
}
