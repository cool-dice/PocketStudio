"use client";

/**
 * useWorkspaces — стор воркспейсов Фазы A (REST /api/workspaces).
 *
 * Модель — как use-projects: module-level кэш + React state, БЕЗ react-query.
 * Несколько точек монтирования (экран списка, Главная, лента активности)
 * делят один массив и один in-flight запрос.
 *
 * - load() — первичная (не молчаливая) загрузка: loading=true, скелетоны;
 * - invalidate() — тихое обновление после мутаций (мастер создания);
 * - useWorkspace(id) — одиночный воркспейс через api.getWorkspace(id)
 *   с оптимистичным стартом из кэша списка и ручной reload().
 */

import { useCallback, useEffect, useState } from "react";

import { api } from "@/lib/api";
import type { WorkspaceDto } from "@/lib/workspace-types";

/** Module-level shared cache — один список на все точки монтирования. */
interface WorkspacesCache {
  workspaces: WorkspaceDto[];
  loading: boolean;
  error: boolean;
  /** Успешно загружен хотя бы раз — до этого каждая перемонтировка ретраит. */
  loadedOnce: boolean;
  inFlight: Promise<void> | null;
  mounted: number;
  listeners: Set<() => void>;
}

const cache: WorkspacesCache = {
  workspaces: [],
  loading: true,
  error: false,
  loadedOnce: false,
  inFlight: null,
  mounted: 0,
  listeners: new Set(),
};

function notify() {
  cache.listeners.forEach((listener) => listener());
}

async function fetchWorkspaces(silent: boolean): Promise<void> {
  if (cache.inFlight) return cache.inFlight;
  if (!silent) {
    cache.loading = true;
    cache.error = false;
    notify();
  }
  const task = (async () => {
    try {
      cache.workspaces = await api.listWorkspaces();
      cache.error = false;
      cache.loadedOnce = true;
    } catch {
      cache.error = true;
    } finally {
      cache.loading = false;
      cache.inFlight = null;
      notify();
    }
  })();
  cache.inFlight = task;
  return task;
}

/** Тихо обновить список после мутаций (создание/правка/удаление). */
export function invalidateWorkspaces(): void {
  void fetchWorkspaces(true);
}

export function useWorkspaces() {
  const [, forceRender] = useState(0);

  useEffect(() => {
    const listener = () => forceRender((v) => v + 1);
    cache.listeners.add(listener);
    cache.mounted += 1;
    return () => {
      cache.listeners.delete(listener);
      cache.mounted -= 1;
    };
  }, []);

  // Первое монтирование в приложении запускает видимую загрузку.
  useEffect(() => {
    if (!cache.loadedOnce) void fetchWorkspaces(false);
  }, []);

  /** Принудительная не молчаливая загрузка (кнопка «Повторить»). */
  const load = useCallback(() => {
    void fetchWorkspaces(false);
  }, []);

  const invalidate = useCallback(() => {
    void fetchWorkspaces(true);
  }, []);

  return {
    workspaces: cache.workspaces,
    loading: cache.loading,
    error: cache.error,
    load,
    invalidate,
  };
}

/** Одиночный воркспейс по id: скелетон → данные из api.getWorkspace(id). */
export function useWorkspace(id: string | null) {
  /** Успешно загруженный воркспейс для конкретного id (null внутри — ошибка). */
  const [loaded, setLoaded] = useState<{
    id: string;
    workspace: WorkspaceDto | null;
  } | null>(null);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    api
      .getWorkspace(id)
      .then((workspace) => {
        if (!cancelled) setLoaded({ id, workspace });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ id, workspace: null });
      });
    return () => {
      cancelled = true;
    };
  }, [id, tick]);

  /** Данные для открытого id (или null — грузится/сменился id). */
  const current = loaded && loaded.id === id ? loaded : null;
  /** Оптимистичный старт: свежесозданный/недавно открытый есть в кэше списка. */
  const workspace = current
    ? current.workspace
    : id
      ? cache.workspaces.find((ws) => ws.id === id) ?? null
      : null;

  return {
    workspace,
    loading: Boolean(id) && !current,
    error: Boolean(id && current && current.workspace === null),
    reload,
  };
}
