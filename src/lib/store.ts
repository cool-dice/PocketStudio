"use client";

/**
 * AppUi store (zustand) — cross-component UI state for Stage 1:
 * main area routing (chat ⇄ notebook), context-panel note detail,
 * the ⌘K capture dialog and a notes version counter (any note mutation
 * bumps it so a mounted NotebookScreen silently refetches).
 *
 * Use atomic selectors in components: useAppUi((s) => s.mainArea).
 * In callbacks outside React (WS handlers), use useAppUi.getState().
 */

import { create } from "zustand";

import { api } from "@/lib/api";
import type { Note } from "@/lib/types";

export type MainArea = "chat" | "notebook";

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
}));
