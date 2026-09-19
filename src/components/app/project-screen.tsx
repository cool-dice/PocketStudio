"use client";

/**
 * ProjectScreen — project detail (center zone, mainArea === "project"):
 * header (back, name + origin badge + stats chips, checkpoint / discuss /
 * history actions, kebab menu with rename + delete), left file tree
 * (collapsible folders, colored file glyphs, dirty dots; a Sheet on <md)
 * and the editor area (tab bar + Monaco, ⌘S/Ctrl+S save with toasts).
 *
 * Refetches the tree + open file + stats when projectFilesVersion bumps
 * (WS project:updated for THIS project) — dirty buffers are never clobbered.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ChevronRight,
  Download,
  Eye,
  File,
  FileCode2,
  FileDiff,
  Folder,
  FolderOpen,
  GitCommitHorizontal,
  Loader2,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Save,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

import { DiffDialog } from "@/components/app/diff-dialog";
import { MonacoEditor } from "@/components/app/monaco-editor";
import { PreviewInspector } from "@/components/app/preview-inspector";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useProjects } from "@/hooks/use-projects";
import { useThreads } from "@/hooks/use-threads";
import { api, ApiError } from "@/lib/api";
import { PREVIEW_HTML_HINT, PREVIEW_LISTING_HINT } from "@/lib/studio-copy";
import { pluralFiles, relativeTime } from "@/lib/format";
import { languageFromPath, OriginBadge, fileDotStyle } from "@/lib/project-style";
import { isDeletableRelPath } from "@/lib/rel-path";
import { useAppUi } from "@/lib/store";
import type { CommitInfo, FileEntry, Project } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ProjectScreenProps {
  projectId: string;
  onOpenMobileNav: () => void;
}

/* ── Open-file buffer ── */

interface OpenFile {
  path: string;
  content: string;
  original: string;
  language: string;
}

/* ── Nested tree ── */

interface TreeNode {
  name: string;
  path: string;
  type: "file" | "dir";
  size: number;
  children: TreeNode[];
}

function buildTree(entries: FileEntry[]): TreeNode[] {
  const root: TreeNode = { name: "", path: "", type: "dir", size: 0, children: [] };
  for (const entry of entries) {
    const segments = entry.path.split("/");
    let node = root;
    segments.forEach((seg, i) => {
      const isLeaf = i === segments.length - 1;
      const path = segments.slice(0, i + 1).join("/");
      let child = node.children.find((c) => c.name === seg);
      if (!child) {
        child = {
          name: seg,
          path,
          type: isLeaf ? entry.type : "dir",
          size: isLeaf ? entry.size : 0,
          children: [],
        };
        node.children.push(child);
      }
      node = child;
    });
  }
  const sortRec = (n: TreeNode) => {
    n.children.sort((a, b) => {
      if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name, "ru");
    });
    n.children.forEach(sortRec);
  };
  sortRec(root);
  return root.children;
}

export function ProjectScreen({ projectId, onOpenMobileNav }: ProjectScreenProps) {
  const { remove } = useProjects();
  const { startProjectThread } = useThreads();

  const closeProject = useAppUi((s) => s.closeProject);
  const setMainArea = useAppUi((s) => s.setMainArea);
  const projectFilesVersion = useAppUi((s) => s.projectFilesVersion);

  const [project, setProject] = useState<Project | null>(null);
  const [projectLoading, setProjectLoading] = useState(true);

  const [tree, setTree] = useState<FileEntry[]>([]);
  const [treeTruncated, setTreeTruncated] = useState(false);
  const [treeLoading, setTreeLoading] = useState(true);

  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [mobileTreeOpen, setMobileTreeOpen] = useState(false);

  const [checkpointOpen, setCheckpointOpen] = useState(false);
  const [commitsOpen, setCommitsOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [fileDeletePath, setFileDeletePath] = useState<string | null>(null);
  const [deletingFile, setDeletingFile] = useState(false);
  const [fileDeleteArmed, setFileDeleteArmed] = useState(false);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [discussing, setDiscussing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [previewHint, setPreviewHint] = useState<string | null>(null);

  // Version-bump bookkeeping: the first render does the initial load itself.
  const versionSeenRef = useRef(projectFilesVersion);
  // Separate stale-guards: a project fetch and a tree fetch run in parallel,
  // so they must not invalidate each other's responses.
  const projectSeqRef = useRef(0);
  const treeSeqRef = useRef(0);

  useEffect(() => {
    if (!deleteOpen) {
      setDeleteArmed(false);
      return;
    }
    const t = window.setTimeout(() => setDeleteArmed(true), 400);
    return () => window.clearTimeout(t);
  }, [deleteOpen]);

  useEffect(() => {
    if (fileDeletePath === null) {
      setFileDeleteArmed(false);
      return;
    }
    const t = window.setTimeout(() => setFileDeleteArmed(true), 400);
    return () => window.clearTimeout(t);
  }, [fileDeletePath]);

  const activeFile = openFiles.find((f) => f.path === activePath) ?? null;
  const activeDirty = activeFile !== null && activeFile.content !== activeFile.original;

  /* ── Data loading ── */

  /** Download the project as a zip (cookie-auth navigation, no fetch). */
  const exportZip = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const url = api.projectExportUrl(projectId);
      // Probe with fetch to surface API errors as toasts; on success the
      // blob is handed to the browser as a file download.
      const res = await fetch(url, { credentials: "same-origin" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Не удалось упаковать проект");
      }
      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition") ?? "";
      const match = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
      const fileName = match
        ? decodeURIComponent(match[1])
        : `pocketstudio-project-${projectId}.zip`;
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = fileName;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
      toast.success("Архив проекта готов", {
        description: `${fileName} · ${(blob.size / 1024).toFixed(1)} КБ`,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось упаковать проект");
    } finally {
      setExporting(false);
    }
  }, [projectId, exporting]);

  const openPreview = useCallback(async () => {
    try {
      const preview = await api.projectPreview(projectId);
      setPreviewSrc(preview.src);
      setPreviewHint(
        preview.hint ??
          (preview.kind === "html" ? PREVIEW_HTML_HINT : PREVIEW_LISTING_HINT),
      );
      setPreviewOpen(true);
      if (!preview.src) {
        toast.message("Превью без index.html", {
          description: (preview.files ?? []).slice(0, 8).join(", ") || preview.hint,
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось открыть превью");
    }
  }, [projectId]);


  const loadProject = useCallback(async () => {
    const seq = ++projectSeqRef.current;
    setProjectLoading(true);
    try {
      const loaded = await api.getProject(projectId);
      if (seq === projectSeqRef.current) setProject(loaded);
    } catch (err) {
      if (seq === projectSeqRef.current) {
        toast.error(err instanceof ApiError ? err.message : "Не удалось загрузить проект");
        closeProject();
      }
    } finally {
      if (seq === projectSeqRef.current) setProjectLoading(false);
    }
  }, [projectId, closeProject]);

  const loadTree = useCallback(
    async (silent: boolean) => {
      const seq = ++treeSeqRef.current;
      if (!silent) setTreeLoading(true);
      try {
        const res = await api.getProjectTree(projectId);
        if (seq !== treeSeqRef.current) return;
        setTree(res.tree);
        setTreeTruncated(res.truncated);
      } catch (err) {
        if (seq === treeSeqRef.current) {
          toast.error(err instanceof ApiError ? err.message : "Не удалось загрузить файлы");
        }
      } finally {
        if (seq === treeSeqRef.current) setTreeLoading(false);
      }
    },
    [projectId],
  );

  useEffect(() => {
    setProject(null);
    setTree([]);
    setOpenFiles([]);
    setActivePath(null);
    void loadProject();
    void loadTree(false);
  }, [loadProject, loadTree]);

  // WS / store version bump → refresh tree + stats (+ active file when clean).
  useEffect(() => {
    if (versionSeenRef.current === projectFilesVersion) return;
    versionSeenRef.current = projectFilesVersion;
    void loadTree(true);
    void loadProject();
    // Active file refetch — only when the buffer has no unsaved edits.
    const current = openFiles.find((f) => f.path === activePath);
    if (activePath && current && current.content === current.original) {
      void api
        .getProjectFile(projectId, activePath)
        .then((file) => {
          setOpenFiles((prev) =>
            prev.map((f) =>
              f.path === file.path && f.content === f.original
                ? { ...f, content: file.content, original: file.content }
                : f,
            ),
          );
        })
        .catch(() => {
          // File may have been deleted by the agent — drop the tab quietly.
          setOpenFiles((prev) => prev.filter((f) => f.path !== activePath));
          setActivePath((prev) => (prev === activePath ? null : prev));
        });
    }
  }, [projectFilesVersion]);

  /* ── File open / close / save ── */

  const openFile = useCallback(
    async (path: string) => {
      const existing = openFiles.find((f) => f.path === path);
      if (existing) {
        setActivePath(path);
        setMobileTreeOpen(false);
        return;
      }
      setFileLoading(true);
      setActivePath(path);
      setMobileTreeOpen(false);
      try {
        const file = await api.getProjectFile(projectId, path);
        setOpenFiles((prev) =>
          prev.some((f) => f.path === file.path)
            ? prev
            : [
                ...prev,
                {
                  path: file.path,
                  content: file.content,
                  original: file.content,
                  language: languageFromPath(file.path),
                },
              ],
        );
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Не удалось открыть файл");
        setActivePath(null);
      } finally {
        setFileLoading(false);
      }
    },
    [openFiles, projectId],
  );

  const closeFile = useCallback(
    (path: string) => {
      const idx = openFiles.findIndex((f) => f.path === path);
      const next = openFiles.filter((f) => f.path !== path);
      setOpenFiles(next);
      if (activePath === path) {
        const neighbor = next[Math.min(idx, next.length - 1)];
        setActivePath(neighbor?.path ?? null);
      }
    },
    [openFiles, activePath],
  );

  const saveActiveFile = useCallback(async () => {
    if (!activeFile || activeFile.content === activeFile.original || saving) return;
    setSaving(true);
    try {
      const res = await api.saveProjectFile(
        projectId,
        activeFile.path,
        activeFile.content,
      );
      setOpenFiles((prev) =>
        prev.map((f) =>
          f.path === res.path ? { ...f, original: f.content } : f,
        ),
      );
      toast.success("Сохранено", { description: res.path });
      if (res.created) void loadTree(true);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Не удалось сохранить файл");
    } finally {
      setSaving(false);
    }
  }, [activeFile, projectId, saving, loadTree]);

  // ⌘S / Ctrl+S save (bound to the active buffer).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveActiveFile();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [saveActiveFile]);

  const onChangeContent = useCallback(
    (value: string) => {
      setOpenFiles((prev) =>
        prev.map((f) => (f.path === activePath ? { ...f, content: value } : f)),
      );
    },
    [activePath],
  );

  /* ── Actions ── */

  const discuss = async () => {
    if (!project || discussing) return;
    setDiscussing(true);
    setMainArea("chat");
    await startProjectThread(project.id, `Проект «${project.name}»`);
    setDiscussing(false);
  };

  const doDelete = async () => {
    if (!project) return;
    setDeleting(true);
    try {
      await remove(project.id);
      toast.success("Проект удалён");
      closeProject();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось удалить проект");
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  const doDeleteFile = async () => {
    if (!fileDeletePath || deletingFile) return;
    if (!isDeletableRelPath(fileDeletePath)) {
      toast.error("Нельзя удалить корень проекта");
      setFileDeletePath(null);
      return;
    }
    setDeletingFile(true);
    try {
      const deleted = await api.deleteProjectFile(projectId, fileDeletePath);
      const gone = deleted.path;
      setOpenFiles((prev) =>
        prev.filter((f) => f.path !== gone && !f.path.startsWith(`${gone}/`)),
      );
      setActivePath((cur) =>
        cur && (cur === gone || cur.startsWith(`${gone}/`)) ? null : cur,
      );
      setFileDeletePath(null);
      toast.success("Файл удалён", { description: deleted.path });
      void loadTree(true);
      useAppUi.getState().bumpProjectFiles();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Не удалось удалить файл");
    } finally {
      setDeletingFile(false);
    }
  };

  const treeNodes = useMemo(() => buildTree(tree), [tree]);
  const dirtyPaths = useMemo(
    () =>
      new Set(
        openFiles.filter((f) => f.content !== f.original).map((f) => f.path),
      ),
    [openFiles],
  );

  const headerStats = project?.stats;

  return (
    <section
      aria-label="Проект"
      className="flex min-w-0 flex-1 flex-col bg-background"
    >
      {/* ── Header ── */}
      <header className="flex h-14 shrink-0 items-center gap-1.5 border-b px-2 sm:px-4">
        <Button
          variant="ghost"
          size="icon"
          className="size-9 md:hidden"
          onClick={onOpenMobileNav}
          aria-label="Открыть меню"
        >
          <Menu className="size-4" aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-9 shrink-0"
          onClick={closeProject}
          aria-label="Назад к проектам"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
        </Button>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <h1 className="truncate text-sm font-semibold sm:text-[15px]">
            {projectLoading && !project ? "Загрузка…" : project?.name}
          </h1>
          {project && <OriginBadge origin={project.origin} className="hidden sm:inline-flex" />}
          {headerStats && (
            <span className="hidden items-center gap-2.5 text-[11px] text-muted-foreground lg:flex">
              <span className="inline-flex items-center gap-1">
                <File className="size-3" aria-hidden="true" />
                {headerStats.filesCount} {pluralFiles(headerStats.filesCount)}
              </span>
              <span className="inline-flex items-center gap-1">
                <GitCommitHorizontal className="size-3" aria-hidden="true" />
                {headerStats.commitsCount}
              </span>
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 rounded-xl px-2.5 sm:px-3"
            onClick={() => void exportZip()}
            disabled={!project || exporting}
            aria-label="Скачать проект zip-архивом"
            title="Скачать проект zip-архивом"
          >
            {exporting ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="size-4" aria-hidden="true" />
            )}
            <span className="hidden md:inline">Скачать zip</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 rounded-xl px-2.5 sm:px-3"
            onClick={() => setCheckpointOpen(true)}
            aria-label="Создать чекпоинт"
          >
            <GitCommitHorizontal className="size-4" aria-hidden="true" />
            <span className="hidden md:inline">Чекпоинт</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 rounded-xl px-2.5 sm:px-3"
            onClick={() => void openPreview()}
            aria-label="Превью проекта"
            title="Статический iframe-превью"
          >
            <Eye className="size-4" aria-hidden="true" />
            <span className="hidden md:inline">Превью</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 rounded-xl px-2.5 sm:px-3"
            onClick={() => void discuss()}
            disabled={!project || discussing}
            aria-label="Обсудить проект в чате"
          >
            {discussing ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <MessageSquare className="size-4" aria-hidden="true" />
            )}
            <span className="hidden md:inline">Обсудить</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 rounded-xl px-2.5 sm:px-3"
            onClick={() => setCommitsOpen(true)}
            aria-label="История коммитов"
          >
            <GitCommitHorizontal className="size-4" aria-hidden="true" />
            <span className="hidden md:inline">История</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-9"
                aria-label="Меню проекта"
              >
                <MoreHorizontal className="size-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onSelect={() => setRenameOpen(true)}>
                <Pencil className="size-4" aria-hidden="true" />
                Переименовать
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => setDeleteOpen(true)}
              >
                <Trash2 className="size-4" aria-hidden="true" />
                Удалить проект
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* ── Body: tree + editor ── */}
      <div className="flex min-h-0 flex-1">
        {/* Desktop tree (≥ md) */}
        <nav
          aria-label="Файлы проекта"
          className="vf-scroll hidden w-56 shrink-0 flex-col overflow-y-auto border-r py-2 md:flex"
        >
          <FileTreeBody
            nodes={treeNodes}
            truncated={treeTruncated}
            loading={treeLoading}
            collapsed={collapsed}
            onToggleFolder={(path) =>
              setCollapsed((prev) => {
                const next = new Set(prev);
                if (next.has(path)) next.delete(path);
                else next.add(path);
                return next;
              })
            }
            activePath={activePath}
            dirtyPaths={dirtyPaths}
            onOpenFile={(path) => void openFile(path)}
            onDeleteFile={(path) => {
              if (!isDeletableRelPath(path)) {
                toast.error("Нельзя удалить корень проекта");
                return;
              }
              setFileDeletePath(path);
            }}
          />
        </nav>

        {/* Mobile tree (< md, Sheet) */}
        <Sheet open={mobileTreeOpen} onOpenChange={setMobileTreeOpen}>
          <SheetContent
            side="left"
            className="w-72 gap-0 border-r p-0 sm:max-w-xs"
            aria-describedby={undefined}
          >
            <SheetTitle className="sr-only">Файлы проекта</SheetTitle>
            <div className="flex h-14 items-center gap-2 border-b px-4">
              <Button
                variant="outline"
                size="icon"
                className="size-9 shrink-0 rounded-xl"
                onClick={() => setMobileTreeOpen(false)}
                aria-label="Закрыть файлы"
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
              </Button>
              <p className="truncate text-sm font-semibold">
                {project?.name ?? "Файлы"}
              </p>
            </div>
            <div className="vf-scroll min-h-0 flex-1 overflow-y-auto py-2">
              <FileTreeBody
                nodes={treeNodes}
                truncated={treeTruncated}
                loading={treeLoading}
                collapsed={collapsed}
                onToggleFolder={(path) =>
                  setCollapsed((prev) => {
                    const next = new Set(prev);
                    if (next.has(path)) next.delete(path);
                    else next.add(path);
                    return next;
                  })
                }
                activePath={activePath}
                dirtyPaths={dirtyPaths}
                onOpenFile={(path) => void openFile(path)}
                onDeleteFile={(path) => {
              if (!isDeletableRelPath(path)) {
                toast.error("Нельзя удалить корень проекта");
                return;
              }
              setFileDeletePath(path);
            }}
              />
            </div>
          </SheetContent>
        </Sheet>

        {/* Editor area */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* File actions (tree sheet on mobile + save/delete) */}
          <div className="flex h-10 shrink-0 items-center gap-1.5 border-b px-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 rounded-lg px-2.5 text-xs md:hidden"
              onClick={() => setMobileTreeOpen(true)}
              aria-label="Показать файлы проекта"
            >
              <Folder className="size-3.5" aria-hidden="true" />
              Файлы
            </Button>
            {activeDirty && (
              <span className="text-[11px] text-amber-600 dark:text-amber-400">
                есть изменения
              </span>
            )}
            <div className="flex-1" />
            {activeFile && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 rounded-lg px-2.5 text-xs"
                  onClick={() => void saveActiveFile()}
                  disabled={!activeDirty || saving}
                  aria-label="Сохранить файл"
                >
                  {saving ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Save className="size-3.5" aria-hidden="true" />
                  )}
                  Сохранить
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 rounded-lg px-2.5 text-xs text-destructive hover:text-destructive"
                  onClick={() => {
                    if (!isDeletableRelPath(activeFile.path)) {
                      toast.error("Нельзя удалить корень проекта");
                      return;
                    }
                    setFileDeletePath(activeFile.path);
                  }}
                  disabled={deletingFile}
                  aria-label={`Удалить файл ${activeFile.path}`}
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                  Удалить
                </Button>
              </>
            )}
          </div>

          {/* Tab bar */}
          {openFiles.length > 0 && (
            <div
              role="tablist"
              aria-label="Открытые файлы"
              className="vf-scroll-x flex h-10 shrink-0 items-center gap-0.5 overflow-x-auto border-b px-1"
            >
              {openFiles.map((file) => {
                const active = file.path === activePath;
                const dirty = file.content !== file.original;
                return (
                  <div
                    key={file.path}
                    role="tab"
                    aria-selected={active}
                    className={cn(
                      "group flex shrink-0 items-center gap-1.5 border-b-2 px-2.5 py-1.5 text-xs transition-colors duration-150",
                      active
                        ? "border-primary bg-background font-medium text-foreground"
                        : "border-transparent bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setActivePath(file.path)}
                      className="flex min-w-0 items-center gap-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/60 rounded-md"
                      aria-label={`Файл ${file.path}`}
                    >
                      <FileCode2
                        className={cn("size-3.5 shrink-0", fileDotStyle(file.path))}
                        aria-hidden="true"
                      />
                      <span className="max-w-40 truncate">
                        {file.path.split("/").pop()}
                      </span>
                      {dirty && (
                        <span
                          aria-label="Есть несохранённые изменения"
                          title="Есть несохранённые изменения"
                          className="size-1.5 shrink-0 rounded-full bg-amber-500"
                        />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => closeFile(file.path)}
                      className="shrink-0 rounded-md p-0.5 text-muted-foreground/60 opacity-0 transition-opacity duration-150 hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/60"
                      aria-label={`Закрыть ${file.path}`}
                    >
                      <svg
                        viewBox="0 0 12 12"
                        className="size-2.5"
                        aria-hidden="true"
                      >
                        <path
                          d="M2 2l8 8M10 2l-8 8"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Monaco */}
          <div className="relative min-h-0 flex-1">
            {fileLoading ? (
              <div className="h-full w-full p-4" aria-label="Загрузка файла">
                <div className="space-y-3">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            ) : activeFile ? (
              <MonacoEditor
                value={activeFile.content}
                language={activeFile.language}
                onChange={onChangeContent}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
                <span
                  aria-hidden="true"
                  className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"
                >
                  <FileCode2 className="size-5" />
                </span>
                <p className="text-sm font-medium">Выберите файл слева</p>
                <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
                  Дерево файлов проекта —{" "}
                  <span className="md:hidden">кнопка «Файлы» сверху</span>
                  <span className="hidden md:inline">панель слева</span>.
                  Правки сохраняются через ⌘S / Ctrl+S.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Превью проекта</DialogTitle>
            <DialogDescription>
              {previewHint ?? PREVIEW_HTML_HINT} Кликните
              элемент, чтобы инспектировать.
            </DialogDescription>
          </DialogHeader>
          {previewSrc ? (
            <div className="flex flex-col gap-3 md:flex-row">
              <iframe
                title="Превью проекта"
                src={previewSrc}
                sandbox="allow-scripts allow-same-origin"
                className="h-[60vh] w-full rounded-lg border bg-white"
              />
              <PreviewInspector
                iframeSrc={previewSrc}
                projectName={project?.name ?? "проект"}
                projectId={projectId}
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {PREVIEW_LISTING_HINT}
            </p>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Checkpoint dialog ── */}
      <CheckpointDialog
        open={checkpointOpen}
        onOpenChange={setCheckpointOpen}
        projectId={projectId}
        onDone={() => {
          void loadProject();
        }}
      />

      {/* ── Commits sheet ── */}
      <CommitsSheet
        open={commitsOpen}
        onOpenChange={setCommitsOpen}
        projectId={projectId}
        onRestored={() => {
          useAppUi.getState().bumpProjectFiles();
        }}
      />

      {/* ── Rename dialog ── */}
      <RenameDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        project={project}
        onRenamed={(updated) => setProject((prev) => ({ ...prev, ...updated }))}
      />

      {/* ── Delete confirmation ── */}
      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteOpen(false);
        }}
      >
        <AlertDialogContent
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement)
              .querySelector<HTMLElement>("[data-alert-cancel]")
              ?.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить проект?</AlertDialogTitle>
            <AlertDialogDescription>
              «{project?.name}»: файлы и git-история будут удалены безвозвратно.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-alert-cancel disabled={deleting}>
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={!deleteArmed || deleting}
              onClick={(e) => {
                e.preventDefault();
                if (!deleteArmed) return;
                void doDelete();
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? "Удаляем…" : "Удалить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={fileDeletePath !== null}
        onOpenChange={(open) => {
          if (!open && !deletingFile) setFileDeletePath(null);
        }}
      >
        <AlertDialogContent
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement)
              .querySelector<HTMLElement>("[data-alert-cancel]")
              ?.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить файл?</AlertDialogTitle>
            <AlertDialogDescription>
              «{fileDeletePath}» будет удалён с диска, а его фрагменты исчезнут из поиска по канону.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-alert-cancel disabled={deletingFile}>
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={!fileDeleteArmed || deletingFile}
              onClick={(e) => {
                e.preventDefault();
                if (!fileDeleteArmed) return;
                void doDeleteFile();
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deletingFile ? "Удаляем…" : "Удалить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </section>
  );
}

/* ── File tree (shared desktop/mobile) ── */

function FileTreeBody({
  nodes,
  truncated,
  loading,
  collapsed,
  onToggleFolder,
  activePath,
  dirtyPaths,
  onOpenFile,
  onDeleteFile,
}: {
  nodes: TreeNode[];
  truncated: boolean;
  loading: boolean;
  collapsed: Set<string>;
  onToggleFolder: (path: string) => void;
  activePath: string | null;
  dirtyPaths: Set<string>;
  onOpenFile: (path: string) => void;
  onDeleteFile: (path: string) => void;
}) {
  if (loading) {
    return (
      <div className="space-y-2 px-3 pt-1" aria-label="Загрузка файлов">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-5 w-full rounded-md" />
        ))}
      </div>
    );
  }
  if (nodes.length === 0) {
    return (
      <p className="px-3 pt-2 text-xs leading-relaxed text-muted-foreground">
        В проекте пока нет файлов.
      </p>
    );
  }
  return (
    <ul className="select-none px-1.5">
      {nodes.map((node) => (
        <li key={node.path}>
          <TreeNodeRow
            node={node}
            depth={0}
            collapsed={collapsed}
            onToggleFolder={onToggleFolder}
            activePath={activePath}
            dirtyPaths={dirtyPaths}
            onOpenFile={onOpenFile}
            onDeleteFile={onDeleteFile}
          />
        </li>
      ))}
      {truncated && (
        <li className="px-2 pt-2 pb-1 text-[11px] leading-relaxed text-muted-foreground/80">
          Показаны не все файлы (лимит 2000)
        </li>
      )}
    </ul>
  );
}

function TreeNodeRow({
  node,
  depth,
  collapsed,
  onToggleFolder,
  activePath,
  dirtyPaths,
  onOpenFile,
  onDeleteFile,
}: {
  node: TreeNode;
  depth: number;
  collapsed: Set<string>;
  onToggleFolder: (path: string) => void;
  activePath: string | null;
  dirtyPaths: Set<string>;
  onOpenFile: (path: string) => void;
  onDeleteFile: (path: string) => void;
}) {
  const isOpen = !collapsed.has(node.path);

  if (node.type === "dir") {
    const Icon = isOpen ? FolderOpen : Folder;
    return (
      <div>
        <div
          className="group flex min-h-9 w-full items-center gap-1 rounded-lg pr-1 text-xs text-foreground/90 hover:bg-accent/60"
          style={{ paddingLeft: `${6 + depth * 14}px` }}
        >
          <button
            type="button"
            onClick={() => onToggleFolder(node.path)}
            aria-expanded={isOpen}
            aria-label={`Папка ${node.name}`}
            className="flex min-w-0 flex-1 items-center gap-1 py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            <motion.span
              animate={{ rotate: isOpen ? 90 : 0 }}
              transition={{ duration: 0.15 }}
              className="flex shrink-0 items-center"
              aria-hidden="true"
            >
              <ChevronRight className="size-3.5 text-muted-foreground/70" />
            </motion.span>
            <Icon
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <span className="min-w-0 truncate font-medium">{node.name}</span>
          </button>
          <button
            type="button"
            onClick={() => onDeleteFile(node.path)}
            aria-label={`Удалить папку ${node.name}`}
            className="shrink-0 rounded-md p-1 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
          </button>
        </div>
        <AnimatePresence initial={false}>
          {isOpen && node.children.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <ul>
                {node.children.map((child) => (
                  <li key={child.path}>
                    <TreeNodeRow
                      node={child}
                      depth={depth + 1}
                      collapsed={collapsed}
                      onToggleFolder={onToggleFolder}
                      activePath={activePath}
                      dirtyPaths={dirtyPaths}
                      onOpenFile={onOpenFile}
                      onDeleteFile={onDeleteFile}
                    />
                  </li>
                ))}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  const active = node.path === activePath;
  const dirty = dirtyPaths.has(node.path);

  return (
    <div
      className={cn(
        "group flex min-h-9 w-full items-center gap-1 rounded-lg pr-1 text-xs",
        active
          ? "bg-emerald-500/10 font-medium text-emerald-700 dark:text-emerald-300"
          : "text-foreground/80 hover:bg-accent/60",
      )}
      style={{ paddingLeft: `${6 + depth * 14}px` }}
    >
      <button
        type="button"
        onClick={() => onOpenFile(node.path)}
        aria-current={active ? "true" : undefined}
        aria-label={`Файл ${node.name}`}
        title={node.path}
        className="flex min-w-0 flex-1 items-center gap-1.5 py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
      >
        <FileCode2
          className={cn("size-3.5 shrink-0", fileDotStyle(node.path))}
          aria-hidden="true"
        />
        <span className="min-w-0 truncate">{node.name}</span>
        {dirty && (
          <span
            className="size-1.5 shrink-0 rounded-full bg-amber-500"
            aria-label="Есть несохранённые изменения"
          />
        )}
      </button>
      <button
        type="button"
        onClick={() => onDeleteFile(node.path)}
        aria-label={`Удалить файл ${node.name}`}
        className="shrink-0 rounded-md p-1 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/60"
      >
        <Trash2 className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

/* ── Checkpoint dialog ── */

function CheckpointDialog({
  open,
  onOpenChange,
  projectId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onDone: () => void;
}) {
  const [message, setMessage] = useState("Изменения из редактора");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const trimmed = message.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const checkpoint = await api.createProjectCheckpoint(projectId, trimmed);
      if (checkpoint.noop) {
        toast.info("Изменений нет — чекпоинт не нужен");
      } else if (checkpoint.commit) {
        toast.success("Чекпоинт создан", {
          description: `${checkpoint.commit.short} · ${checkpoint.commit.message}`,
        });
      }
      onOpenChange(false);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось создать чекпоинт");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[50%] max-h-[85vh] translate-y-[-50%] overflow-y-auto gap-0 sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader className="pb-3">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <GitCommitHorizontal className="size-4 text-primary" aria-hidden="true" />
            Чекпоинт
          </DialogTitle>
          <DialogDescription className="sr-only">
            Зафиксировать текущие изменения проекта коммитом
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="checkpoint-message" className="text-xs font-medium text-muted-foreground">
              Сообщение коммита
            </label>
            <Input
              id="checkpoint-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={200}
              disabled={submitting}
              autoFocus
            />
          </div>
          {error && (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          )}
          <Button
            className="h-10 w-full gap-2 rounded-xl"
            onClick={() => void submit()}
            disabled={submitting || message.trim().length === 0}
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Фиксируем…
              </>
            ) : (
              <>
                <GitCommitHorizontal className="size-4" aria-hidden="true" />
                Создать чекпоинт
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Commits sheet ── */

function CommitsSheet({
  open,
  onOpenChange,
  projectId,
  onRestored,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onRestored?: () => void;
}) {
  const [commits, setCommits] = useState<CommitInfo[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [diffCommit, setDiffCommit] = useState<CommitInfo | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<CommitInfo | null>(null);
  const [restoring, setRestoring] = useState(false);

  const loadCommits = useCallback(async () => {
    setLoading(true);
    setCommits(null);
    try {
      const list = await api.listProjectCommits(projectId);
      setCommits(list);
    } catch {
      setCommits([]);
      toast.error("Не удалось загрузить историю");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!open) return;
    void loadCommits();
  }, [open, loadCommits]);

  const confirmRestore = useCallback(async () => {
    if (!restoreTarget || restoring) return;
    setRestoring(true);
    try {
      const restored = await api.restoreProjectCheckpoint(
        projectId,
        restoreTarget.hash,
      );
      toast.success("Чекпоинт восстановлен", {
        description: restored.discardedUncommitted
          ? `${restored.commit.short} · несохранённые файлы сброшены`
          : restored.commit.short,
      });
      setRestoreTarget(null);
      onRestored?.();
      await loadCommits();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Не удалось восстановить чекпоинт",
      );
    } finally {
      setRestoring(false);
    }
  }, [restoreTarget, restoring, projectId, onRestored, loadCommits]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 p-0 sm:max-w-md"
        aria-describedby={undefined}
      >
        <SheetTitle className="flex h-14 shrink-0 items-center gap-2 border-b px-4 text-sm">
          <GitCommitHorizontal className="size-4 text-primary" aria-hidden="true" />
          История коммитов
        </SheetTitle>
        <div className="vf-scroll min-h-0 flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="space-y-3" aria-label="Загрузка истории">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          ) : !commits || commits.length === 0 ? (
            <p className="px-2 pt-4 text-sm leading-relaxed text-muted-foreground">
              Коммитов пока нет.
            </p>
          ) : (
            <ul className="space-y-2">
              {commits.map((commit) => (
                <li
                  key={commit.hash}
                  className="group rounded-xl border bg-card p-3 transition-colors duration-150 hover:border-primary/25"
                >
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="shrink-0 rounded-md border-emerald-500/30 bg-emerald-500/10 font-mono text-[11px] font-normal text-emerald-700 dark:text-emerald-300"
                    >
                      {commit.short}
                    </Badge>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {commit.message}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 shrink-0 gap-1.5 rounded-lg px-2 text-xs text-muted-foreground opacity-100 transition-colors duration-150 hover:bg-primary/10 hover:text-primary md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                      onClick={() => setDiffCommit(commit)}
                      aria-label={`Показать изменения коммита ${commit.short}`}
                    >
                      <FileDiff className="size-3.5" aria-hidden="true" />
                      Diff
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 shrink-0 gap-1.5 rounded-lg px-2 text-xs text-muted-foreground opacity-100 transition-colors duration-150 hover:bg-primary/10 hover:text-primary md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                      onClick={() => setRestoreTarget(commit)}
                      aria-label={`Восстановить чекпоинт ${commit.short}`}
                    >
                      <RotateCcw className="size-3.5" aria-hidden="true" />
                      Откат
                    </Button>
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    {commit.author} · {relativeTime(commit.date)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>

      {/* Diff of the selected checkpoint */}
      <DiffDialog
        open={diffCommit !== null}
        onOpenChange={(open) => {
          if (!open) setDiffCommit(null);
        }}
        projectId={projectId}
        commit={diffCommit}
      />

      <AlertDialog
        open={restoreTarget !== null}
        onOpenChange={(next) => {
          if (!next && !restoring) setRestoreTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Восстановить чекпоинт?</AlertDialogTitle>
            <AlertDialogDescription>
              Рабочая копия этого проекта станет как в {restoreTarget?.short}.
              Несохранённые файлы будут сброшены. Чекпоинт другого проекта
              сюда не подставить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoring}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              disabled={restoring}
              onClick={(event) => {
                event.preventDefault();
                void confirmRestore();
              }}
            >
              {restoring ? "Восстанавливаем…" : "Восстановить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}

/* ── Rename dialog ── */

function RenameDialog({
  open,
  onOpenChange,
  project,
  onRenamed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project | null;
  onRenamed: (updated: Project) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && project) {
      setName(project.name);
      setDescription(project.description ?? "");
      setError(null);
    }
  }, [open, project]);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || !project || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const updated = await api.updateProject(project.id, {
        name: trimmed,
        description: description.trim(),
      });
      onRenamed(updated);
      useAppUi.getState().bumpProjects();
      onOpenChange(false);
      toast.success("Проект обновлён");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось обновить проект");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[50%] max-h-[85vh] translate-y-[-50%] overflow-y-auto gap-0 sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader className="pb-3">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Pencil className="size-4 text-primary" aria-hidden="true" />
            Настройки проекта
          </DialogTitle>
          <DialogDescription className="sr-only">
            Название и описание проекта
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="rename-name" className="text-xs font-medium text-muted-foreground">
              Название
            </label>
            <Input
              id="rename-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              disabled={submitting}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="rename-description" className="text-xs font-medium text-muted-foreground">
              Описание
            </label>
            <Textarea
              id="rename-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={2}
              disabled={submitting}
              className="resize-none"
            />
          </div>
          {error && (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          )}
          <Button
            className="h-10 w-full gap-2 rounded-xl"
            onClick={() => void submit()}
            disabled={submitting || name.trim().length === 0}
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            Сохранить
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
