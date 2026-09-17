"use client";

/**
 * GlobalSearch — Ctrl+P / ⌘P command palette (Stage 4): fuzzy-ish substring
 * search across threads, notes and projects (GET /api/search). Selecting a
 * hit navigates: thread → chat area + activate, note → context panel,
 * project → project detail screen. Debounced 250 ms, ≥2 chars, grouped
 * result sections with icons, keyboard-first cmdk UX.
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

import { api } from "@/lib/api";
import type { SearchResults } from "@/lib/types";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useAppUi } from "@/lib/store";
import { useThreads } from "@/hooks/use-threads";
import { cn } from "@/lib/utils";

const DEBOUNCE_MS = 250;

export function GlobalSearch() {
  const searchOpen = useAppUi((s) => s.searchOpen);
  const setSearchOpen = useAppUi((s) => s.setSearchOpen);
  const setMainArea = useAppUi((s) => s.setMainArea);
  const openProject = useAppUi((s) => s.openProject);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const seqRef = useRef(0);

  const { selectThread } = useThreads();

  const runSearch = useCallback((q: string) => {
    const seq = ++seqRef.current;
    setLoading(true);
    api
      .search(q)
      .then((res) => {
        if (seq !== seqRef.current) return;
        setResults(res);
      })
      .catch(() => {
        if (seq !== seqRef.current) return;
        setResults({ threads: [], notes: [], projects: [], total: 0 });
      })
      .finally(() => {
        if (seq === seqRef.current) setLoading(false);
      });
  }, []);

  // Debounced search whenever the palette is open.
  useEffect(() => {
    if (!searchOpen) return;
    const q = query.trim();
    if (q.length < 2) return; // hint state is derived at render time
    const timer = setTimeout(() => runSearch(q), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, searchOpen, runSearch]);

  /** Close + reset (event-handler context, not an effect). */
  const close = useCallback(() => {
    seqRef.current++; // cancel in-flight responses
    setSearchOpen(false);
    setQuery("");
    setResults(null);
    setLoading(false);
  }, [setSearchOpen]);

  const showHint = query.trim().length < 2;
  const nothing =
    !loading && results !== null && results.total === 0 && !showHint;

  const go = useMemo(
    () => ({
      thread: async (id: string) => {
        close();
        setMainArea("chat");
        await selectThread(id);
      },
      note: (noteId: string) => {
        close();
        // Cheap open: fetch full note → context panel (mobile gets a dialog).
        void api
          .getNote(noteId)
          .then((note) => useAppUi.getState().openNote(note))
          .catch(() => {});
      },
      project: (id: string) => {
        close();
        openProject(id);
      },
    }),
    [close, openProject, setMainArea, selectThread],
  );

  return (
    <CommandDialog
      open={searchOpen}
      onOpenChange={(open) => {
        if (open) setSearchOpen(true);
        else close();
      }}
      title="Поиск по VibeFlow"
      description="Диалоги, заметки и проекты"
      className="sm:max-w-xl"
    >
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Поиск по диалогам, заметкам и проектам…"
      />
      <CommandList className="vf-scroll max-h-[60dvh]">
        {loading && !showHint && (
          <div
            className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"
            role="status"
          >
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Ищем…
          </div>
        )}
        {nothing && (
          <CommandEmpty>
            Ничего не нашлось по «{query.trim()}». Попробуйте другое слово.
          </CommandEmpty>
        )}
        {results && results.projects.length > 0 && (
          <CommandGroup heading="Проекты">
            {results.projects.map((p) => (
              <CommandItem
                key={`p-${p.id}`}
                value={`проект ${p.name} ${p.description ?? ""}`}
                onSelect={() => go.project(p.id)}
                className="gap-3"
              >
                <FolderGit2 className="size-4 shrink-0 text-primary" aria-hidden="true" />
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
        {results && results.threads.length > 0 && (
          <CommandGroup heading="Диалоги">
            {results.threads.map((t) => (
              <CommandItem
                key={`t-${t.id}`}
                value={`диалог ${t.title} ${t.preview ?? ""}`}
                onSelect={() => void go.thread(t.id)}
                className="gap-3"
              >
                <MessageSquare className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
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
        {results && results.notes.length > 0 && (
          <CommandGroup heading="Заметки">
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
        {!results && !loading && showHint && (
          <div className="flex flex-col items-center gap-1.5 px-4 py-8 text-center text-sm text-muted-foreground">
            <Search className="size-5 opacity-50" aria-hidden="true" />
            <p>Введите минимум 2 символа</p>
            <p className="text-xs opacity-70">
              <Hash className="mr-0.5 inline size-3" aria-hidden="true" />
              диалоги · заметки · проекты — всё сразу
            </p>
          </div>
        )}
      </CommandList>
    </CommandDialog>
  );
}
