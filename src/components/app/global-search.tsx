"use client";

/**
 * GlobalSearch — Ctrl+P / ⌘P command palette: GET /api/search for the
 * current user (workspace-scoped when a workspace is open). Empty ≠ error.
 * Workspace hits open /w/[id]; notes open the notebook + note panel.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FolderGit2,
  Hash,
  Loader2,
  MessageSquare,
  Search,
  StickyNote,
} from "lucide-react";

import { api, ApiError } from "@/lib/api";
import type { SearchResults } from "@/lib/types";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { useAppUi } from "@/lib/store";
import { useThreads } from "@/hooks/use-threads";
import { cn } from "@/lib/utils";
import {
  SEARCH_DESCRIPTION,
  SEARCH_ERROR,
  SEARCH_ERROR_HINT,
  SEARCH_GROUP_NOTES,
  SEARCH_GROUP_THREADS,
  SEARCH_GROUP_WORKSPACES,
  SEARCH_HINT_GLOBAL,
  SEARCH_HINT_WORKSPACE,
  SEARCH_LOADING,
  SEARCH_MIN_HINT,
  SEARCH_PLACEHOLDER_GLOBAL,
  SEARCH_PLACEHOLDER_WORKSPACE,
  SEARCH_RETRY,
  SEARCH_TITLE,
  searchEmptyMessage,
} from "@/lib/search-copy";

const DEBOUNCE_MS = 250;

export function GlobalSearch() {
  const searchOpen = useAppUi((s) => s.searchOpen);
  const setSearchOpen = useAppUi((s) => s.setSearchOpen);
  const setMainArea = useAppUi((s) => s.setMainArea);
  const openWorkspace = useAppUi((s) => s.openWorkspace);
  const activeWorkspaceId = useAppUi((s) => s.activeWorkspaceId);
  const mainArea = useAppUi((s) => s.mainArea);

  const workspaceId =
    mainArea === "workspace" && activeWorkspaceId ? activeWorkspaceId : null;

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seqRef = useRef(0);

  const { selectThread } = useThreads();

  const runSearch = useCallback(
    (q: string) => {
      const seq = ++seqRef.current;
      setLoading(true);
      setError(null);
      api
        .search(q, workspaceId)
        .then((res) => {
          if (seq !== seqRef.current) return;
          setResults(res);
          setError(null);
        })
        .catch((err: unknown) => {
          if (seq !== seqRef.current) return;
          setResults(null);
          setError(err instanceof ApiError ? err.message : SEARCH_ERROR);
        })
        .finally(() => {
          if (seq === seqRef.current) setLoading(false);
        });
    },
    [workspaceId],
  );

  useEffect(() => {
    if (!searchOpen) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      setError(null);
      setLoading(false);
      return;
    }
    const timer = setTimeout(() => runSearch(q), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, searchOpen, runSearch]);

  const close = useCallback(() => {
    seqRef.current++;
    setSearchOpen(false);
    setQuery("");
    setResults(null);
    setError(null);
    setLoading(false);
  }, [setSearchOpen]);

  const showHint = query.trim().length < 2;
  const nothing =
    !loading && !error && results !== null && results.total === 0 && !showHint;

  const go = useMemo(
    () => ({
      thread: async (id: string, projectId: string | null) => {
        close();
        if (projectId) openWorkspace(projectId);
        else setMainArea("chat");
        await selectThread(id);
      },
      note: (noteId: string) => {
        close();
        setMainArea("notebook");
        void api
          .getNote(noteId)
          .then((note) => useAppUi.getState().openNote(note))
          .catch(() => {});
      },
      workspace: (id: string) => {
        close();
        openWorkspace(id);
      },
    }),
    [close, openWorkspace, setMainArea, selectThread],
  );

  return (
    <CommandDialog
      open={searchOpen}
      onOpenChange={(open) => {
        if (open) setSearchOpen(true);
        else close();
      }}
      title={SEARCH_TITLE}
      description={SEARCH_DESCRIPTION}
      className="sm:max-w-xl"
    >
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder={
          workspaceId ? SEARCH_PLACEHOLDER_WORKSPACE : SEARCH_PLACEHOLDER_GLOBAL
        }
      />
      <CommandList className="vf-scroll max-h-[60dvh]">
        {loading && !showHint && (
          <div
            className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"
            role="status"
          >
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            {SEARCH_LOADING}
          </div>
        )}
        {error && !showHint && !loading && (
          <div
            role="alert"
            className="flex flex-col items-center gap-2 px-4 py-8 text-center"
          >
            <p className="text-sm font-medium">{error}</p>
            <p className="text-xs text-muted-foreground">{SEARCH_ERROR_HINT}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => runSearch(query.trim())}
            >
              {SEARCH_RETRY}
            </Button>
          </div>
        )}
        {nothing && (
          <CommandEmpty>{searchEmptyMessage(query.trim())}</CommandEmpty>
        )}
        {!showHint && !error && results && results.projects.length > 0 && (
          <CommandGroup heading={SEARCH_GROUP_WORKSPACES}>
            {results.projects.map((p) => (
              <CommandItem
                key={`p-${p.id}`}
                value={`воркспейс ${p.name} ${p.description ?? ""}`}
                onSelect={() => go.workspace(p.id)}
                className="gap-3"
              >
                <FolderGit2
                  className="size-4 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{p.name}</span>
                  {p.description && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {p.description}
                    </span>
                  )}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {!showHint && !error && results && results.threads.length > 0 && (
          <CommandGroup heading={SEARCH_GROUP_THREADS}>
            {results.threads.map((t) => (
              <CommandItem
                key={`t-${t.id}`}
                value={`диалог ${t.title} ${t.preview ?? ""}`}
                onSelect={() => void go.thread(t.id, t.projectId)}
                className="gap-3"
              >
                <MessageSquare
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{t.title}</span>
                  {t.preview && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {t.preview}
                    </span>
                  )}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {!showHint && !error && results && results.notes.length > 0 && (
          <CommandGroup heading={SEARCH_GROUP_NOTES}>
            {results.notes.map((n) => (
              <CommandItem
                key={`n-${n.id}`}
                value={`заметка ${n.preview}`}
                onSelect={() => go.note(n.id)}
                className="gap-3"
              >
                <StickyNote
                  className={cn(
                    "size-4 shrink-0",
                    n.favorite ? "text-amber-500" : "text-muted-foreground",
                  )}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{n.preview}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {n.category ? `${n.category.name} · ` : ""}
                    {new Date(n.createdAt).toLocaleDateString("ru-RU")}
                  </span>
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {!results && !loading && !error && showHint && (
          <div className="flex flex-col items-center gap-1.5 px-4 py-8 text-center text-sm text-muted-foreground">
            <Search className="size-5 opacity-50" aria-hidden="true" />
            <p>{SEARCH_MIN_HINT}</p>
            <p className="text-xs opacity-70">
              <Hash className="mr-0.5 inline size-3" aria-hidden="true" />
              {workspaceId ? SEARCH_HINT_WORKSPACE : SEARCH_HINT_GLOBAL}
            </p>
          </div>
        )}
      </CommandList>
    </CommandDialog>
  );
}
