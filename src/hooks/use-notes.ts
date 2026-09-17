"use client";

/**
 * useNotes — notebook feed state: paginated notes + categories, filter chips,
 * optimistic favorite/delete, silent refresh on note mutations
 * (store notesVersion) and manual refresh().
 *
 * Loading semantics: full skeleton only for the initial load and filter
 * changes; version-bump refreshes keep the current list visible.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { useAppUi } from "@/lib/store";
import type { Category, Note } from "@/lib/types";

const PAGE_SIZE = 20;

export interface NotesFilters {
  categoryId: string | null;
  favorite: boolean;
}

export function useNotes() {
  const notesVersion = useAppUi((s) => s.notesVersion);

  const [notes, setNotes] = useState<Note[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filters, setFilters] = useState<NotesFilters>({
    categoryId: null,
    favorite: false,
  });
  const [tick, setTick] = useState(0);

  // Guards against stale responses (filter races, fast refresh clicks).
  const seqRef = useRef(0);
  const pageRef = useRef(1);
  const loadingMoreRef = useRef(false);
  const filtersRef = useRef(filters);
  const notesRef = useRef(notes);
  const totalRef = useRef(total);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);
  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);
  useEffect(() => {
    totalRef.current = total;
  }, [total]);

  /** Fetch page 1 (+ categories). silent=true keeps the old list visible. */
  const loadFirstPage = useCallback(
    async (f: NotesFilters, silent: boolean) => {
      const seq = ++seqRef.current;
      if (!silent) setLoading(true);
      try {
        const [list, cats] = await Promise.all([
          api.listNotes({
            categoryId: f.categoryId ?? undefined,
            favorite: f.favorite || undefined,
            page: 1,
            limit: PAGE_SIZE,
          }),
          api.listCategories(),
        ]);
        if (seq !== seqRef.current) return;
        pageRef.current = 1;
        setNotes(list.notes);
        setTotal(list.total);
        setHasMore(list.hasMore);
        setCategories(cats);
      } catch {
        if (seq === seqRef.current) {
          toast.error("Не удалось загрузить заметки");
        }
      } finally {
        if (seq === seqRef.current) setLoading(false);
      }
    },
    [],
  );

  // Initial load + filter changes → full skeleton.
  useEffect(() => {
    void loadFirstPage(filters, false);
  }, [filters, loadFirstPage]);

  // Silent refresh: note created/deleted elsewhere (⌘K, agent tool, panel).
  const silentReadyRef = useRef(false);
  useEffect(() => {
    if (!silentReadyRef.current) {
      silentReadyRef.current = true;
      return;
    }
    void loadFirstPage(filtersRef.current, true);
  }, [notesVersion, tick, loadFirstPage]);

  /** Merge a filter patch; resets to page 1 (no-op when nothing changes). */
  const setFilter = useCallback((patch: Partial<NotesFilters>) => {
    setFilters((prev) => {
      const next = { ...prev, ...patch };
      if (next.categoryId === prev.categoryId && next.favorite === prev.favorite) {
        return prev;
      }
      return next;
    });
  }, []);

  /** Manual refresh (silent — keeps the current list visible). */
  const refresh = useCallback(() => {
    setTick((t) => t + 1);
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMore) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const f = filtersRef.current;
    const page = pageRef.current + 1;
    try {
      const list = await api.listNotes({
        categoryId: f.categoryId ?? undefined,
        favorite: f.favorite || undefined,
        page,
        limit: PAGE_SIZE,
      });
      // A filter change may have raced us — drop this page in that case.
      if (f !== filtersRef.current) return;
      pageRef.current = page;
      setNotes((prev) => {
        const seen = new Set(prev.map((n) => n.id));
        return [...prev, ...list.notes.filter((n) => !seen.has(n.id))];
      });
      setTotal(list.total);
      setHasMore(list.hasMore);
    } catch {
      toast.error("Не удалось загрузить заметки");
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [hasMore]);

  /** Optimistic favorite toggle (reverts with a toast on failure). */
  const toggleFavorite = useCallback(async (note: Note) => {
    const next = !note.favorite;
    setNotes((prev) =>
      prev.map((n) => (n.id === note.id ? { ...n, favorite: next } : n)),
    );
    try {
      const updated = await api.updateNote(note.id, { favorite: next });
      setNotes((prev) =>
        prev.map((n) => (n.id === updated.id ? { ...n, ...updated } : n)),
      );
    } catch {
      setNotes((prev) =>
        prev.map((n) =>
          n.id === note.id ? { ...n, favorite: note.favorite } : n,
        ),
      );
      toast.error("Не удалось обновить заметку");
    }
  }, []);

  /** Optimistic delete with rollback on failure. */
  const deleteNote = useCallback(async (id: string) => {
    const snapshot = notesRef.current;
    const totalSnapshot = totalRef.current;
    setNotes((prev) => prev.filter((n) => n.id !== id));
    setTotal((t) => Math.max(0, t - 1));
    try {
      await api.deleteNote(id);
      // If the deleted note is open in the context panel, close it there.
      const ui = useAppUi.getState();
      if (ui.contextNote?.id === id) ui.closeNote();
      // Silent reload keeps category noteCounts in the chips row fresh.
      ui.bumpNotes();
    } catch {
      setNotes(snapshot);
      setTotal(totalSnapshot);
      toast.error("Не удалось удалить заметку");
    }
  }, []);

  return {
    notes,
    total,
    hasMore,
    categories,
    loading,
    loadingMore,
    filters,
    setFilter,
    loadMore,
    refresh,
    toggleFavorite,
    deleteNote,
  };
}
