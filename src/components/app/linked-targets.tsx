"use client";

/**
 * Note-detail chips for NoteLink rows. A studio must open /w/{id}, not the
 * Next.js project shell; copy must not call a track/book a «проект».
 */

import { useCallback, useEffect, useState } from "react";
import { FolderGit2, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import {
  boundThreadChip,
  LINKED_TARGETS_EMPTY,
  LINKED_TARGETS_LOAD_ERROR,
  LINKED_TARGETS_TITLE,
  LINKED_UNLINK_ERROR,
  linkedTargetAria,
} from "@/lib/composer-binding";
import { useAppUi } from "@/lib/store";
import type { NoteProjectLink } from "@/lib/types";

export function LinkedTargets({ noteId }: { noteId: string }) {
  const openProject = useAppUi((s) => s.openProject);
  const openWorkspace = useAppUi((s) => s.openWorkspace);
  const projectsVersion = useAppUi((s) => s.projectsVersion);
  const [links, setLinks] = useState<NoteProjectLink[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadLinks = useCallback(async () => {
    try {
      const list = await api.listNoteLinks(noteId);
      setLinks(list);
      setLoadError(false);
    } catch {
      setLinks([]);
      setLoadError(true);
    }
  }, [noteId]);

  useEffect(() => {
    setLinks(null);
    void loadLinks();
  }, [loadLinks, projectsVersion]);

  const openLinked = (link: NoteProjectLink) => {
    const chip = boundThreadChip({
      name: link.project.name,
      origin: link.project.origin,
      type: link.project.type,
      id: link.project.id,
    });
    if (chip.kind === "workspace") openWorkspace(link.project.id);
    else openProject(link.project.id);
  };

  const unlink = async (link: NoteProjectLink) => {
    if (removingId) return;
    setRemovingId(link.project.id);
    try {
      await api.unlinkNoteFromProject(noteId, link.project.id);
      setLinks((prev) =>
        (prev ?? []).filter((row) => row.project.id !== link.project.id),
      );
    } catch {
      toast.error(LINKED_UNLINK_ERROR);
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="mt-3 border-t pt-3">
      <h4 className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {LINKED_TARGETS_TITLE}
      </h4>
      {links === null ? (
        <div className="mt-2 px-1">
          <Skeleton className="h-6 w-40 rounded-full" />
        </div>
      ) : loadError ? (
        <div className="mt-1.5 px-1">
          <p className="text-xs leading-relaxed text-muted-foreground">
            {LINKED_TARGETS_LOAD_ERROR}
          </p>
          <button
            type="button"
            onClick={() => void loadLinks()}
            className="mt-1 text-xs font-medium text-primary underline-offset-2 hover:underline"
          >
            Повторить
          </button>
        </div>
      ) : links.length === 0 ? (
        <p className="mt-1.5 px-1 text-xs leading-relaxed text-muted-foreground">
          {LINKED_TARGETS_EMPTY}
        </p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {links.map((link) => (
            <LinkedChip
              key={link.id}
              link={link}
              busy={removingId === link.project.id}
              onOpen={() => openLinked(link)}
              onUnlink={() => void unlink(link)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function LinkedChip({
  link,
  busy,
  onOpen,
  onUnlink,
}: {
  link: NoteProjectLink;
  busy: boolean;
  onOpen: () => void;
  onUnlink: () => void;
}) {
  const chip = boundThreadChip({
    name: link.project.name,
    origin: link.project.origin,
    type: link.project.type,
    id: link.project.id,
  });
  return (
    <li className="group/link">
      <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/5 pl-2.5 pr-1.5 py-1 text-[11px] font-medium text-foreground/90">
        <button
          type="button"
          onClick={onOpen}
          aria-label={linkedTargetAria(chip.kind, link.project.name, "open")}
          className="flex min-w-0 items-center gap-1.5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          <FolderGit2
            className="size-3 shrink-0 text-primary"
            aria-hidden="true"
          />
          <span className="max-w-36 truncate">{chip.label}</span>
        </button>
        <button
          type="button"
          onClick={onUnlink}
          disabled={busy}
          aria-label={linkedTargetAria(chip.kind, link.project.name, "unlink")}
          className="flex shrink-0 items-center rounded-full p-0.5 text-muted-foreground/60 opacity-0 transition-opacity duration-150 hover:text-destructive focus-visible:opacity-100 group-hover/link:opacity-100"
        >
          {busy ? (
            <Loader2 className="size-3 animate-spin" aria-hidden="true" />
          ) : (
            <X className="size-3" aria-hidden="true" />
          )}
        </button>
      </span>
    </li>
  );
}
