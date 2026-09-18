"use client";

/**
 * Deploy (5-c) — «Готовность воркспейса»: реальный чеклист из БД.
 * Артефакты по типам (изображения/аудио/видео/документы), сущности,
 * открытые находки аналитика и общий прогресс пайплайна воркспейса.
 */

import {
  AudioLines,
  FileText,
  ImageIcon,
  Search,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { WorkspaceDto } from "@/lib/workspace-types";

interface ChecklistRow {
  id: string;
  label: string;
  icon: LucideIcon;
  value: number | null;
  hint: string;
}

export function ReadinessCard({
  workspace,
  entitiesCount,
  openFindings,
  loading,
}: {
  workspace: WorkspaceDto | null;
  entitiesCount: number | null;
  openFindings: number | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-sm sm:p-6">
        <Skeleton className="h-5 w-48" />
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
    );
  }

  if (!workspace) return null;

  const rows: ChecklistRow[] = [
    {
      id: "images",
      label: "Изображений",
      icon: ImageIcon,
      value: workspace.counts.images,
      hint: "обложки, иллюстрации, портреты",
    },
    {
      id: "audio",
      label: "Аудио",
      icon: AudioLines,
      value: workspace.counts.audio,
      hint: "озвучка, треки",
    },
    {
      id: "documents",
      label: "Документов",
      icon: FileText,
      value: workspace.counts.documents,
      hint: "рукописи, спеки, статьи",
    },
    {
      id: "entities",
      label: "Сущностей",
      icon: Users,
      value: entitiesCount,
      hint: "персонажи, лор, требования",
    },
    {
      id: "findings",
      label: "Открытых находок",
      icon: Search,
      value: openFindings,
      hint: "замечания Аналитика",
    },
  ];

  return (
    <section
      aria-label="Готовность воркспейса"
      className="rounded-xl border bg-card p-4 shadow-sm sm:p-6"
    >
      <h2 className="text-base font-semibold">Готовность воркспейса</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Что реально лежит в этом воркспейсе — прямо из базы студии
      </p>

      <ul className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
        {rows.map((row) => {
          const Icon = row.icon;
          const empty = row.value === 0;
          return (
            <li
              key={row.id}
              title={row.hint}
              className="flex items-center gap-2.5 rounded-lg border bg-background/60 p-2.5"
            >
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-lg",
                  empty
                    ? "bg-muted text-muted-foreground/60"
                    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                )}
                aria-hidden="true"
              >
                <Icon className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-lg font-semibold leading-none tabular-nums">
                  {row.value ?? "—"}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {row.label}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-5">
        <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground">
            Прогресс пайплайна
            {workspace.stage ? ` · ${workspace.stage}` : ""}
          </span>
          <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
            {workspace.progress}%
          </span>
        </div>
        <Progress
          value={workspace.progress}
          aria-label={`Прогресс пайплайна: ${workspace.progress}%`}
          className="h-2"
        />
      </div>
    </section>
  );
}
