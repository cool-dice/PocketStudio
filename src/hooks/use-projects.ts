"use client";

/**
 * useProjects — project list state following the use-notes pattern, but with
 * a MODULE-LEVEL CACHE: several components mount this hook simultaneously
 * (sidebar section, projects screen, composer project chip) and they must
 * share one array and one in-flight request instead of racing each other.
 *
 * - Initial fetch on first mount anywhere; version-bump refreshes (store
 *   projectsVersion) are silent and deduped while a request is in flight.
 * - create() accepts the JSON payload (template / github) OR a zip FormData
 *   built by the caller — returns the created project and refreshes.
 * - remove() / rename() are optimistic with rollback (toast on failure).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { api, ApiError } from "@/lib/api";
import { useAppUi } from "@/lib/store";
import type { Project, ProjectListItem } from "@/lib/types";

/** Module-level shared cache — one list for every mount point. */
interface ProjectsCache {
  projects: ProjectListItem[];
  loading: boolean;
  error: boolean;
  version: number;
  inFlight: Promise<void> | null;
  mounted: number;
  listeners: Set<() => void>;
}

const cache: ProjectsCache = {
  projects: [],
  loading: true,
  error: false,
  version: 0,
  inFlight: null,
  mounted: 0,
  listeners: new Set(),
};

function notify() {
  cache.version += 1;
  cache.listeners.forEach((listener) => listener());
}

async function fetchSilently(silent: boolean) {
  if (cache.inFlight) return cache.inFlight;
  if (!silent) {
    cache.loading = true;
    cache.error = false;
    notify();
  }
  const task = (async () => {
    try {
      cache.projects = await api.listProjects();
      cache.error = false;
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

export function useProjects() {
  const projectsVersion = useAppUi((s) => s.projectsVersion);

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

  // First mount anywhere triggers the initial fetch.
  useEffect(() => {
    if (cache.mounted === 1 && cache.projects.length === 0 && !cache.error) {
      void fetchSilently(false);
    }
  }, []);

  // Silent refresh whenever the store version bumps (mutation / WS event).
  const versionSeenRef = useRef(projectsVersion);
  useEffect(() => {
    if (versionSeenRef.current === projectsVersion) return;
    versionSeenRef.current = projectsVersion;
    void fetchSilently(true);
  }, [projectsVersion]);

  const refresh = useCallback(() => {
    void fetchSilently(true);
  }, []);

  /** Create (JSON template/github or zip multipart form) → Project. */
  const create = useCallback(
    async (payload: Parameters<typeof api.createProject>[0] | FormData) => {
      const project =
        payload instanceof FormData
          ? await api.createProjectFromZipRaw(payload)
          : await api.createProject(payload);
      useAppUi.getState().bumpProjects();
      return project;
    },
    [],
  );

  /** Optimistic delete with rollback. */
  const remove = useCallback(async (id: string) => {
    const snapshot = cache.projects;
    cache.projects = cache.projects.filter((p) => p.id !== id);
    notify();
    try {
      await api.deleteProject(id);
      // If the deleted project is open in the detail screen, leave it.
      const ui = useAppUi.getState();
      if (ui.activeProjectId === id) ui.closeProject();
      useAppUi.getState().bumpProjects();
    } catch {
      cache.projects = snapshot;
      notify();
      throw new Error("Не удалось удалить проект");
    }
  }, []);

  /** Rename / edit description with a local patch + silent refetch. */
  const rename = useCallback(
    async (id: string, patch: { name?: string; description?: string }) => {
      try {
        const updated = await api.updateProject(id, patch);
        cache.projects = cache.projects.map((p) =>
          p.id === id ? { ...p, ...updated } : p,
        );
        notify();
        useAppUi.getState().bumpProjects();
        return updated;
      } catch (err) {
        toast.error(
          err instanceof ApiError ? err.message : "Не удалось обновить проект",
        );
        return null;
      }
    },
    [],
  );

  /** Find a project by id from the shared cache (null when unknown). */
  const getById = useCallback(
    (id: string | null): Project | null =>
      id ? cache.projects.find((p) => p.id === id) ?? null : null,
    [],
  );

  return {
    projects: cache.projects,
    loading: cache.loading,
    error: cache.error,
    refresh,
    create,
    remove,
    rename,
    getById,
  };
}
