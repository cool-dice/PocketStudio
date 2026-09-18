"use client";

/**
 * AppUi store (zustand) — cross-component UI state:
 * main area routing (chat ⇄ notebook ⇄ projects ⇄ project detail),
 * context-panel note detail, the ⌘K capture dialog, the create-project
 * dialog (optionally pre-bound to a note) and version counters so mounted
 * screens silently refetch after mutations / WS events.
 *
 * Use atomic selectors in components: useAppUi((s) => s.mainArea).
 * In callbacks outside React (WS handlers), use useAppUi.getState().
 */

import { create } from "zustand";

import { api } from "@/lib/api";
import type { Note } from "@/lib/types";
import type {
  WorkspaceSummary,
  WorkspaceTab,
} from "@/lib/workspace-data";

export type MainArea =
  | "chat"
  | "notebook"
  | "projects"
  | "project"
  | "admin"
  /* ── PocketStudio modules (visual vision first, functionality later) ── */
  | "documents" // Книги / статьи / сценарии
  | "images" // Генерация изображений + галерея
  | "design" // Универсальный редактор: растр + макеты
  | "audio" // Аудио: озвучка, музыка, подкасты
  | "video" // Карманная киностудия
  | "deploy" // Сборка → реестр → хост
  | "mcp" // MCP-интеграции
  | "skills" // Импорт и создание скиллов
  | "monetize" // Публикации и доход
  /* ── PS-3: единый поток — воркспейсы ── */
  | "home" // Главная: дашборд и быстрый старт
  | "workspaces" // Список воркспейсов
  | "library" // Библиотека: весь контент всех воркспейсов
  | "tools" // Инструменты: скиллы, интеграции, монетизация, админ
  | "workspace"; // Контекстная оболочка воркспейса


interface AppUiState {
  /** Which screen occupies the center zone. */
  mainArea: MainArea;
  setMainArea: (area: MainArea) => void;

  /** Context panel visibility (desktop xl+ aside). */
  contextOpen: boolean;
  setContextOpen: (open: boolean) => void;

  /** Note shown in the context panel (null → placeholder content). */
  contextNote: Note | null;
  /**
   * Open a note in the context panel.
   * auto=true (agent tool result) never pops the mobile dialog;
   * explicit clicks always open it below xl.
   */
  openNote: (note: Note, opts?: { auto?: boolean }) => void;
  /** Close the note → panel falls back to the placeholder. */
  closeNote: () => void;
  /**
   * Replace the open note in place (favorite toggle, fresh REST data, or a
   * live WS pipeline payload — note:analyzing / note:analyzed). No-op when
   * the ids don't match, so stale events never hijack the panel.
   */
  updateContextNote: (note: Note) => void;
  /** Refetch the open note from the REST API (no-op when closed). */
  refreshNote: () => Promise<void>;

  /** Mobile (<xl) note-detail dialog. */
  noteDialogOpen: boolean;
  closeNoteDialog: () => void;

  /** ⌘K quick-capture dialog. */
  captureOpen: boolean;
  setCaptureOpen: (open: boolean) => void;

  /** Incremented on every note mutation → mounted use-notes refetch. */
  notesVersion: number;
  bumpNotes: () => void;

  /** Project detail screen: the project being shown (mainArea === "project"). */
  activeProjectId: string | null;
  /** Open the project detail screen (center zone). */
  openProject: (id: string) => void;
  /** Leave the project detail screen → back to the projects list. */
  closeProject: () => void;

  /** Incremented on every project mutation → mounted use-projects refetch. */
  projectsVersion: number;
  bumpProjects: () => void;

  /**
   * Incremented when the ACTIVE project's files change (WS project:updated
   * for this project, manual saves trigger a local tree refresh anyway).
   * The project screen refetches the tree + open file when it bumps.
   */
  projectFilesVersion: number;
  bumpProjectFiles: () => void;

  /** Create-project dialog (global, mounted in AppShell). */
  createProjectOpen: boolean;
  /** Open the create dialog; noteId pre-binds it to a note (kind 'context'). */
  openCreateProject: (noteId?: string) => void;
  setCreateProjectOpen: (open: boolean) => void;
  /** Note the dialog is bound to (null → regular create). */
  createProjectNoteId: string | null;

  /** Global search dialog (Ctrl+P / ⌘P, Stage 4). */
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;

  /* ── PS-3: воркспейсы — единый творческий контекст ── */

  /** Открытый воркспейс (mainArea === "workspace"): id из мок-данных. */
  activeWorkspaceId: string | null;
  /** Объект-переопределение (воркспейс, созданный мастером на клиенте). */
  activeWorkspaceOverride: WorkspaceSummary | null;
  /** Активная вкладка оболочки воркспейса. */
  workspaceTab: WorkspaceTab;
  /** Открыть мок-воркспейс по id (optionally на конкретной вкладке). */
  openWorkspace: (id: string, tab?: WorkspaceTab) => void;
  /** Открыть клиентский воркспейс-объект (мастер создания). */
  openWorkspaceData: (ws: WorkspaceSummary, tab?: WorkspaceTab) => void;
  /** Выйти из воркспейса → к списку. */
  closeWorkspace: () => void;
  /** Переключить вкладку открытого воркспейса. */
  setWorkspaceTab: (tab: WorkspaceTab) => void;
}

export const useAppUi = create<AppUiState>((set, get) => ({
  mainArea: "chat",
  setMainArea: (mainArea) => set({ mainArea }),

  contextOpen: true,
  setContextOpen: (contextOpen) => set({ contextOpen }),

  contextNote: null,
  noteDialogOpen: false,

  openNote: (note, opts) =>
    set({
      contextNote: note,
      contextOpen: true,
      noteDialogOpen: opts?.auto ? false : true,
    }),

  closeNote: () => set({ contextNote: null, noteDialogOpen: false }),

  updateContextNote: (note) =>
    set((state) =>
      state.contextNote?.id === note.id ? { contextNote: note } : {},
    ),

  refreshNote: async () => {
    const id = get().contextNote?.id;
    if (!id) return;
    try {
      const note = await api.getNote(id);
      set((state) =>
        state.contextNote?.id === note.id ? { contextNote: note } : {},
      );
    } catch {
      // Keep the currently shown note when the refetch fails.
    }
  },

  closeNoteDialog: () => set({ noteDialogOpen: false }),

  captureOpen: false,
  setCaptureOpen: (captureOpen) => set({ captureOpen }),

  notesVersion: 0,
  bumpNotes: () => set((state) => ({ notesVersion: state.notesVersion + 1 })),

  activeProjectId: null,
  openProject: (id) =>
    set((state) => ({
      mainArea: "project",
      activeProjectId: id,
      // A fresh open always sees the newest files.
      projectFilesVersion: state.projectFilesVersion + 1,
    })),
  closeProject: () => set({ mainArea: "projects", activeProjectId: null }),

  projectsVersion: 0,
  bumpProjects: () =>
    set((state) => ({ projectsVersion: state.projectsVersion + 1 })),

  projectFilesVersion: 0,
  bumpProjectFiles: () =>
    set((state) => ({ projectFilesVersion: state.projectFilesVersion + 1 })),

  createProjectOpen: false,
  createProjectNoteId: null,
  openCreateProject: (noteId) =>
    set({ createProjectOpen: true, createProjectNoteId: noteId ?? null }),
  setCreateProjectOpen: (open) => {
    if (open) {
      set({ createProjectOpen: true });
    } else {
      // Closing always unbinds the note.
      set({ createProjectOpen: false, createProjectNoteId: null });
    }
  },

  searchOpen: false,
  setSearchOpen: (searchOpen) => set({ searchOpen }),

  activeWorkspaceId: null,
  activeWorkspaceOverride: null,
  workspaceTab: "overview",
  openWorkspace: (id, tab) =>
    set({
      mainArea: "workspace",
      activeWorkspaceId: id,
      activeWorkspaceOverride: null,
      workspaceTab: tab ?? "overview",
    }),
  openWorkspaceData: (ws, tab) =>
    set({
      mainArea: "workspace",
      activeWorkspaceId: ws.id,
      activeWorkspaceOverride: ws,
      workspaceTab: tab ?? "overview",
    }),
  closeWorkspace: () =>
    set({
      mainArea: "workspaces",
      activeWorkspaceId: null,
      activeWorkspaceOverride: null,
      workspaceTab: "overview",
    }),
  setWorkspaceTab: (workspaceTab) => set({ workspaceTab }),
}));
