"use client";

/**
 * LibrarySection — секция Библиотеки «воркспейс → его артефакты»
 * для группового режима (PS-3-c): заголовок (градиентная плитка типа,
 * название, бейдж типа, стадия и счётчик, переход в воркспейс)
 * + сетка/список карточек артефактов секции.
 */

import { ArrowUpRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArtifactCard } from "@/components/workspaces/shared/artifact-card";
import type { ArtifactItem } from "@/components/workspaces/shared/artifacts-data";
import { useAppUi } from "@/lib/store";
import {
  WORKSPACE_TYPE_META,
  type WorkspaceSummary,
} from "@/lib/workspace-data";
import { cn } from "@/lib/utils";
import {
  libraryGridClassName,
  pluralArtifacts,
  type LibraryView,
} from "@/components/workspaces/library-data";

interface LibrarySectionProps {
  workspace: WorkspaceSummary;
  items: ArtifactItem[];
  view: LibraryView;
  onOpenArtifact: (artifact: ArtifactItem) => void;
}

export function LibrarySection({
  workspace,
  items,
  view,
  onOpenArtifact,
}: LibrarySectionProps) {
  const openWorkspace = useAppUi((s) => s.openWorkspace);
  const meta = WORKSPACE_TYPE_META[workspace.type];
  const TypeIcon = meta.icon;

  return (
    <section aria-label={`Артефакты воркспейса «${workspace.title}»`}>
      <header className="mb-3 flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white",
            workspace.gradient,
          )}
        >
          <TypeIcon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold leading-tight">
              {workspace.title}
            </h3>
            <Badge
              variant="secondary"
              className="shrink-0 text-[10px] uppercase tracking-wide"
            >
              {meta.label}
            </Badge>
          </div>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {workspace.stage} · {pluralArtifacts(items.length)}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          onClick={() => openWorkspace(workspace.id)}
          aria-label={`Открыть воркспейс «${workspace.title}»`}
        >
          <ArrowUpRight className="size-4" aria-hidden="true" />
        </Button>
      </header>
      <div className={libraryGridClassName(view)}>
        {items.map((artifact) => (
          <ArtifactCard
            key={artifact.id}
            artifact={artifact}
            showWorkspace={false}
            onOpen={onOpenArtifact}
          />
        ))}
      </div>
    </section>
  );
}
