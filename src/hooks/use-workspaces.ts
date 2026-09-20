"use client";

/**
 * useWorkspaces — стор воркспейсов Фазы A (REST /api/workspaces).
 *
 * Модель — как use-projects: module-level кэш + React state, БЕЗ react-query.
 * Несколько точек монтирования (экран списка, Главная, лента активности)
 * делят один живой массив. Сетка с «Показать архив» читает отдельный
 * `?archived=1` бакет, чтобы Главная не видела скрытые воркспейсы.
 *
 * - load() — первичная (не молчаливая) загрузка: loading=true, скелетоны;
 * - invalidate() — тихое обновление после мутаций (мастер создания);
 * - useWorkspace(id) — одиночный воркспейс через api.getWorkspace(id)
 *   с оптимистичным стартом из кэша списка и ручной reload().
 */

import { useCallback, useEffect, useState } from "react";

import { api, ApiError } from "@/lib/api";
import { workspacesListQuery } from "@/lib/workspace-copy";
import type { WorkspaceDto } from "@/lib/workspace-types";

/** Module-level shared cache — живой список на все точки монтирования. */
interface WorkspacesCache {
  workspaces: WorkspaceDto[];
  loading: boolean;
  error: boolean;
  /** Успешно загружен хотя бы раз — до этого каждая перемонтировка ретраит. */
  loadedOnce: boolean;
  inFlight: Promise<void> | null;
  pendingInvalidate: boolean;
  mounted: number;
  listeners: Set<() => void>;
  /** Сетка: «Показать архив» — не смешивается с живым списком Главной. */
  showArchived: boolean;
  archivedWorkspaces: WorkspaceDto[];
  archiveLoading: boolean;
  archiveError: boolean;
  archiveLoadedOnce: boolean;
  archiveInFlight: Promise<void> | null;
  pendingArchiveInvalidate: boolean;
}

const cache: WorkspacesCache = {
  workspaces: [],
  loading: true,
  error: false,
  loadedOnce: false,
  inFlight: null,
  pendingInvalidate: false,
  mounted: 0,
  listeners: new Set(),
  showArchived: false,
  archivedWorkspaces: [],
  archiveLoading: false,
  archiveError: false,
  archiveLoadedOnce: false,
  archiveInFlight: null,
  pendingArchiveInvalidate: false,
};

function notify() {
  cache.listeners.forEach((listener) => listener());
}

function applyWorkspacePatch(
  list: WorkspaceDto[],
  id: string,
  patch: Partial<WorkspaceDto>,
): WorkspaceDto[] {
  return list.map((ws) => (ws.id === id ? { ...ws, ...patch } : ws));
}

async function fetchWorkspaces(silent: boolean): Promise<void> {
  if (cache.inFlight) {
    if (silent) cache.pendingInvalidate = true;
    return cache.inFlight;
  }
  if (!silent) {
    cache.loading = true;
    cache.error = false;
    notify();
  }
  const task = (async () => {
    try {
      cache.workspaces = await api.listWorkspaces(workspacesListQuery(false));
      cache.error = false;
      cache.loadedOnce = true;
    } catch {
      cache.error = true;
    } finally {
      cache.loading = false;
      cache.inFlight = null;
      notify();
      if (cache.pendingInvalidate) {
        cache.pendingInvalidate = false;
        void fetchWorkspaces(true);
      }
    }
  })();
  cache.inFlight = task;
  return task;
}

async function fetchArchivedWorkspaces(silent: boolean): Promise<void> {
  if (cache.archiveInFlight) {
    if (silent) cache.pendingArchiveInvalidate = true;
    return cache.archiveInFlight;
  }
  if (!silent) {
    cache.archiveLoading = true;
    cache.archiveError = false;
    notify();
  }
  const task = (async () => {
    try {
      cache.archivedWorkspaces = await api.listWorkspaces(
        workspacesListQuery(true),
      );
      cache.archiveError = false;
      cache.archiveLoadedOnce = true;
    } catch {
      cache.archiveError = true;
    } finally {
      cache.archiveLoading = false;
      cache.archiveInFlight = null;
      notify();
      if (cache.pendingArchiveInvalidate) {
        cache.pendingArchiveInvalidate = false;
        void fetchArchivedWorkspaces(true);
      }
    }
  })();
  cache.archiveInFlight = task;
  return task;
}

/** Тихо обновить список после мутаций (создание/правка/удаление). */
export function invalidateWorkspaces(): void {
  void fetchWorkspaces(true);
  if (cache.showArchived) void fetchArchivedWorkspaces(true);
}

/**
 * Patch favorite/archive fields in both buckets without leaving the
 * current grid view. Used after a successful PATCH so starring does not
 * refetch the live list over an open archive.
 */
export function patchCachedWorkspace(
  id: string,
  patch: Partial<WorkspaceDto>,
): void {
  cache.workspaces = applyWorkspacePatch(cache.workspaces, id, patch);
  cache.archivedWorkspaces = applyWorkspacePatch(
    cache.archivedWorkspaces,
    id,
    patch,
  );
  notify();
}

/** Мгновенно вставить созданный воркспейс, не дожидаясь refetch. */
export function upsertWorkspace(workspace: WorkspaceDto): void {
  cache.showArchived = false;
  cache.workspaces = [
    workspace,
    ...cache.workspaces.filter((ws) => ws.id !== workspace.id),
  ];
  cache.error = false;
  cache.loadedOnce = true;
  notify();
}

/** Live or archived row already in memory — no extra GET. */
export function peekOwnedWorkspace(id: string): WorkspaceDto | null {
  return (
    cache.workspaces.find((ws) => ws.id === id) ??
    cache.archivedWorkspaces.find((ws) => ws.id === id) ??
    null
  );
}

/** Сброс при выходе — иначе следующий пользователь видит чужой список. */
export function resetWorkspacesCache(): void {
  cache.workspaces = [];
  cache.loading = true;
  cache.error = false;
  cache.loadedOnce = false;
  cache.inFlight = null;
  cache.pendingInvalidate = false;
  cache.showArchived = false;
  cache.archivedWorkspaces = [];
  cache.archiveLoading = false;
  cache.archiveError = false;
  cache.archiveLoadedOnce = false;
  cache.archiveInFlight = null;
  cache.pendingArchiveInvalidate = false;
  notify();
}

function useWorkspacesSubscription() {
  const [, forceRender] = useState(0);

  useEffect(() => {
    const listener = () => forceRender((v) => v + 1);
    cache.listeners.add(listener);
    cache.mounted += 1;
    return () => {
      cache.listeners.delete(listener);
      cache.mounted -= 1;
      if (cache.mounted <= 0) {
        cache.loadedOnce = false;
        cache.archiveLoadedOnce = false;
        cache.showArchived = false;
      }
    };
  }, []);
}

export function useWorkspaces() {
  useWorkspacesSubscription();

  // Первое монтирование в приложении запускает видимую загрузку.
  useEffect(() => {
    if (!cache.loadedOnce) void fetchWorkspaces(false);
  }, []);

  /** Принудительная не молчаливая загрузка (кнопка «Повторить»). */
  const load = useCallback(() => {
    void fetchWorkspaces(false);
  }, []);

  const invalidate = useCallback(() => {
    invalidateWorkspaces();
  }, []);

  return {
    workspaces: cache.workspaces,
    loading: cache.loading,
    error: cache.error,
    load,
    invalidate,
  };
}

/**
 * Сетка «Воркспейсы»: живой список по умолчанию, тоггл грузит архив.
 * Главная и модули продолжают читать только `useWorkspaces()`.
 */
export function useWorkspacesGrid() {
  useWorkspacesSubscription();

  useEffect(() => {
    if (cache.showArchived) {
      if (!cache.archiveLoadedOnce) void fetchArchivedWorkspaces(false);
    } else if (!cache.loadedOnce) {
      void fetchWorkspaces(false);
    }
  }, []);

  const load = useCallback(() => {
    if (cache.showArchived) void fetchArchivedWorkspaces(false);
    else void fetchWorkspaces(false);
  }, []);

  const invalidate = useCallback(() => {
    invalidateWorkspaces();
  }, []);

  const toggleShowArchived = useCallback(async () => {
    const next = !cache.showArchived;
    cache.showArchived = next;
    notify();
    if (next) await fetchArchivedWorkspaces(false);
    else await fetchWorkspaces(false);
  }, []);

  return {
    workspaces: cache.showArchived
      ? cache.archivedWorkspaces
      : cache.workspaces,
    loading: cache.showArchived ? cache.archiveLoading : cache.loading,
    error: cache.showArchived ? cache.archiveError : cache.error,
    showArchived: cache.showArchived,
    toggleShowArchived,
    load,
    invalidate,
  };
}

/** Одиночный воркспейс по id: скелетон → данные из api.getWorkspace(id). */
export function useWorkspace(id: string | null) {
  const [loaded, setLoaded] = useState<{
    id: string;
    workspace: WorkspaceDto | null;
    status: number;
  } | null>(null);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    api
      .getWorkspace(id)
      .then((workspace) => {
        if (!cancelled) setLoaded({ id, workspace, status: 200 });
      })
      .catch((err) => {
        if (cancelled) return;
        const status = err instanceof ApiError ? err.status : 0;
        setLoaded({
          id,
          workspace: status === 404 ? null : peekOwnedWorkspace(id),
          status,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [id, tick]);

  const current = loaded && loaded.id === id ? loaded : null;
  const workspace = current
    ? current.workspace
    : id
      ? peekOwnedWorkspace(id)
      : null;

  return {
    workspace,
    loading: Boolean(id) && !current,
    status: current?.status ?? null,
    error: Boolean(id && current && current.workspace === null),
    reload,
  };
}
