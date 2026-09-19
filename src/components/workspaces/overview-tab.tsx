"use client";

/**
 * OverviewTab — «Обзор» воркспейса (Фаза A): живой пайплайн типа.
 *
 * Стадийная дорожка (готово / сейчас / впереди), карточка «Дальше» с
 * подсказкой и переходом к работе, артефакты из БД
 * (api.listArtifacts) по стадиям WORKSPACE_STAGES[type] — с тайлами
 * meta.gradient, превью url для готовых изображений и бакетом «Прочее»,
 * боковая колонка: о воркспейсе (live-даты), состав, быстрые действия.
 */

import { useEffect, useState } from "react";
import {
  ArrowRight,
  AudioWaveform,
  BookOpenText,
  Check,
  ChevronRight,
  Clapperboard,
  FolderKanban,
  ImagePlus,
  NotebookPen,
  RotateCcw,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";

import { ArtifactCard } from "@/components/workspaces/shared/artifact-card";
import {
  ARTIFACT_KIND_META,
  artifactItemFromDto,
  type ArtifactItem,
} from "@/components/workspaces/shared/artifacts-data";
import { timeAgo } from "@/components/workspaces/home-data";
import {
  currentStageIndex,
  nextStepOf,
  pluralArtifacts,
  QUICK_ACTIONS,
  resolveWorkspaceTab,
  STAGE_STATUS_LABEL,
  STAGE_WORK_TABS,
  stageStatusOf,
  type StageStatus,
} from "@/components/workspaces/overview-data";
import {
  stageLabelOf,
  workspaceSubtitle,
} from "@/components/workspaces/workspaces-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useAppUi } from "@/lib/store";
import {
  WORKSPACE_PIPELINE_TITLE,
  WORKSPACE_STAGES,
  WORKSPACE_TAB_META,
  WORKSPACE_TYPE_META,
  type WorkspaceTab,
} from "@/lib/workspace-data";
import type { WorkspaceDto } from "@/lib/workspace-types";
import { cn } from "@/lib/utils";

const COUNT_ITEMS = [
  { key: "notes", label: "Заметки", icon: NotebookPen },
  { key: "documents", label: "Документы", icon: BookOpenText },
  { key: "images", label: "Картинки", icon: ImagePlus },
  { key: "audio", label: "Аудио", icon: AudioWaveform },
  { key: "video", label: "Видео", icon: Clapperboard },
  { key: "files", label: "Файлы", icon: FolderKanban },
] as const;

export function OverviewTab({ workspace }: { workspace: WorkspaceDto }) {
  const setWorkspaceTab = useAppUi((s) => s.setWorkspaceTab);

  /** Артефакты из БД, снабжённые id воркспейса (null — грузится/сменился id). */
  const [loaded, setLoaded] = useState<{
    id: string;
    items: ArtifactItem[];
  } | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .listArtifacts(workspace.id)
      .then((list) => {
        if (!cancelled) setLoaded({ id: workspace.id, items: list.map(artifactItemFromDto) });
      })
      .catch(() => {
        if (!cancelled) setFailedId(workspace.id);
      });
    return () => {
      cancelled = true;
    };
  }, [workspace.id, reloadTick]);

  const artifacts = loaded && loaded.id === workspace.id ? loaded.items : null;
  const artifactsError = failedId === workspace.id && !artifacts;

  function reloadArtifacts() {
    setFailedId(null);
    setReloadTick((t) => t + 1);
  }

  const stages = WORKSPACE_STAGES[workspace.type];
  const currentIdx = currentStageIndex(workspace);
  const nextStage = stages[currentIdx + 1];
  const prompt = nextStepOf(workspace);
  const meta = WORKSPACE_TYPE_META[workspace.type];
  const stageLabel = stageLabelOf(workspace);
  const workTab = resolveWorkspaceTab(
    workspace,
    STAGE_WORK_TABS[workspace.type][stageLabel] ?? "chat",
  );

  /** Артефакты со стадией вне пайплайна типа — отдельным бакетом. */
  const extras = (artifacts ?? []).filter((a) => !stages.includes(a.stage));

  /** Клик по карточке артефакта → его модуль внутри воркспейса. */
  function openArtifact(artifact: ArtifactItem) {
    const tab: WorkspaceTab = ARTIFACT_KIND_META[artifact.kind].tab;
    setWorkspaceTab(resolveWorkspaceTab(workspace, tab));
  }

  function askOrchestrator() {
    toast.info("Оркестратор", {
      description: `Запрос «${prompt.title}» отправлен — ответ появится во вкладке «Чат».`,
    });
  }

  function renderArtifact(artifact: ArtifactItem) {
    if (artifact.url) {
      return (
        <ImageArtifactCard
          key={artifact.id}
          artifact={artifact}
          onOpen={openArtifact}
        />
      );
    }
    return (
      <ArtifactCard
        key={artifact.id}
        artifact={artifact}
        dense
        onOpen={openArtifact}
      />
    );
  }

  return (
    <div className="vf-scroll h-full min-h-0 overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
        <div className="space-y-4 sm:space-y-5">
          {/* ── Стадийная дорожка ── */}
          <section aria-label="Стадии пайплайна" className="rounded-xl border bg-card p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold">
                  {WORKSPACE_PIPELINE_TITLE[workspace.type]}
                </h2>
                <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                  {meta.hint}
                </p>
              </div>
              <Badge
                variant="outline"
                className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              >
                стадия {currentIdx + 1} из {stages.length}
              </Badge>
            </div>

            <ol className="vf-scroll-x mt-5 flex items-start overflow-x-auto pb-1">
              {stages.map((stage, i) => {
                const status = stageStatusOf(i, workspace);
                return (
                  <li
                    key={stage}
                    className="flex min-w-[5.25rem] flex-1 flex-col items-center gap-2"
                  >
                    <div className="flex w-full items-center">
                      <span
                        aria-hidden="true"
                        className={cn(
                          "h-0.5 flex-1 rounded-full",
                          i === 0 && "bg-transparent",
                          i !== 0 && i <= currentIdx ? "bg-primary/50" : "bg-border",
                        )}
                      />
                      <StageNode index={i} status={status} />
                      <span
                        aria-hidden="true"
                        className={cn(
                          "h-0.5 flex-1 rounded-full",
                          i === stages.length - 1 && "bg-transparent",
                          i < currentIdx ? "bg-primary/50" : "bg-border",
                        )}
                      />
                    </div>
                    <span
                      className={cn(
                        "text-center text-[11px] leading-tight",
                        status === "current" && "font-medium text-foreground",
                        status === "done" && "text-muted-foreground",
                        status === "todo" && "text-muted-foreground/70",
                      )}
                    >
                      {stage}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>

          {/* ── Дальше: следующая стадия ── */}
          <section
            aria-label="Следующий шаг"
            className="rounded-xl border border-primary/30 bg-primary/[0.06] p-4 sm:p-5"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
                  <ArrowRight className="size-3.5 shrink-0" aria-hidden="true" />
                  Дальше{nextStage ? ` · ${nextStage}` : " · финальная прямая"}
                </p>
                <p className="mt-1.5 text-sm font-semibold sm:text-base">
                  {prompt.title}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  {prompt.hint}
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                <Button
                  size="sm"
                  onClick={() => setWorkspaceTab(workTab)}
                  title={`Откроет вкладку «${WORKSPACE_TAB_META[workTab].label}»`}
                >
                  Продолжить работу
                  <ArrowRight aria-hidden="true" />
                </Button>
                <Button size="sm" variant="outline" onClick={askOrchestrator}>
                  <Wand2 aria-hidden="true" />
                  Спросить оркестратора
                </Button>
              </div>
            </div>
          </section>

          {/* ── Пайплайн + боковая колонка ── */}
          <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start lg:gap-6">
            {/* Артефакты по стадиям */}
            <div className="min-w-0 space-y-3 sm:space-y-4">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold">Артефакты по стадиям</h2>
                <span className="text-xs text-muted-foreground">
                  {artifacts ? pluralArtifacts(artifacts.length) : "загружаем…"}
                </span>
              </div>

              {artifactsError ? (
                <ArtifactsError onRetry={reloadArtifacts} />
              ) : !artifacts ? (
                <ArtifactsSkeleton />
              ) : (
                <>
                  {stages.map((stage, i) => {
                    const list = artifacts.filter((a) => a.stage === stage);
                    const status = stageStatusOf(i, workspace);
                    return (
                      <section key={stage} aria-label={`Стадия «${stage}»`} className="rounded-xl border bg-card">
                        <div className="flex min-w-0 items-center gap-2 border-b px-4 py-2.5">
                          <h3 className="truncate text-sm font-medium">{stage}</h3>
                          <Badge variant="secondary" className="shrink-0 tabular-nums">
                            {list.length}
                          </Badge>
                          <span className="ml-auto shrink-0">
                            <StageStatusChip status={status} />
                          </span>
                        </div>
                        {list.length > 0 ? (
                          <div className="space-y-2 p-3">{list.map(renderArtifact)}</div>
                        ) : (
                          <p className="px-4 py-3 text-xs text-muted-foreground/70">
                            Пока пусто — артефакты этой стадии появятся по ходу работы.
                          </p>
                        )}
                      </section>
                    );
                  })}
                  {extras.length > 0 ? (
                    <section aria-label="Артефакты вне пайплайна" className="rounded-xl border bg-card">
                      <div className="flex min-w-0 items-center gap-2 border-b px-4 py-2.5">
                        <h3 className="truncate text-sm font-medium">Прочее</h3>
                        <Badge variant="secondary" className="shrink-0 tabular-nums">
                          {extras.length}
                        </Badge>
                        <span className="ml-auto shrink-0 text-[11px] text-muted-foreground/70">
                          вне стадий типа
                        </span>
                      </div>
                      <div className="space-y-2 p-3">{extras.map(renderArtifact)}</div>
                    </section>
                  ) : null}
                </>
              )}
            </div>

            {/* Боковая колонка */}
            <aside className="min-w-0 space-y-4" aria-label="Сводка воркспейса">
              {/* О воркспейсе */}
              <section className="rounded-xl border bg-card p-4">
                <h2 className="text-sm font-semibold">О воркспейсе</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {workspaceSubtitle(workspace)}
                </p>
                <dl className="mt-3 space-y-1.5 text-xs">
                  <div className="flex items-baseline justify-between gap-2">
                    <dt className="text-muted-foreground">Тип</dt>
                    <dd className="font-medium">{meta.label}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <dt className="text-muted-foreground">Создан</dt>
                    <dd className="font-medium">{timeAgo(workspace.createdAt)}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <dt className="text-muted-foreground">Обновлён</dt>
                    <dd className="font-medium">{timeAgo(workspace.updatedAt)}</dd>
                  </div>
                </dl>
                <div
                  className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuenow={workspace.progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Прогресс воркспейса"
                >
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${workspace.progress}%` }}
                  />
                </div>
                <p className="mt-1 text-right text-[11px] tabular-nums text-muted-foreground">
                  {workspace.progress}% · стадия «{stageLabel}»
                </p>
              </section>

              {/* Состав */}
              <section className="rounded-xl border bg-card p-4">
                <h2 className="text-sm font-semibold">Состав</h2>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {COUNT_ITEMS.map((item) => {
                    const value = workspace.counts[item.key];
                    return (
                      <div
                        key={item.key}
                        className={cn(
                          "rounded-lg border bg-background/50 p-2.5 text-center",
                          value === 0 && "opacity-50",
                        )}
                        title={`${item.label}: ${value}`}
                      >
                        <item.icon
                          className="mx-auto size-4 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <p className="mt-1 text-lg font-semibold leading-none tabular-nums">
                          {value}
                        </p>
                        <p className="mt-1 text-[10px] leading-none text-muted-foreground">
                          {item.label}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Быстрые действия */}
              <section className="rounded-xl border bg-card p-4">
                <h2 className="text-sm font-semibold">Быстрые действия</h2>
                <div className="mt-3 space-y-1.5">
                  {QUICK_ACTIONS[workspace.type].map((action) => (
                    <button
                      key={action.label}
                      type="button"
                      onClick={() =>
                        setWorkspaceTab(resolveWorkspaceTab(workspace, action.tab))
                      }
                      className="group flex w-full items-center gap-2.5 rounded-lg border bg-background/50 px-3 py-2.5 text-left text-sm outline-none transition-all duration-150 hover:border-primary/40 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/60"
                    >
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <action.icon className="size-3.5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {action.label}
                      </span>
                      <ChevronRight
                        className="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </button>
                  ))}
                </div>
              </section>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────── карточка с изображением ───────────────────────

/** Плотная карточка артефакта с готовым файлом (url) вместо градиентного тайла. */
function ImageArtifactCard({
  artifact,
  onOpen,
}: {
  artifact: ArtifactItem;
  onOpen: (artifact: ArtifactItem) => void;
}) {
  const kind = ARTIFACT_KIND_META[artifact.kind];
  const Icon = kind.icon;
  const src = artifact.url ?? "";
  return (
    <button
      type="button"
      onClick={() => onOpen(artifact)}
      aria-label={`Артефакт «${artifact.title}»`}
      className="group relative flex w-full items-start gap-3 rounded-xl border bg-card p-2.5 text-left outline-none transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring/60"
    >
      <img
        src={src}
        alt={artifact.title}
        loading="lazy"
        className="size-9 shrink-0 rounded-lg border object-cover"
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {artifact.title}
          </span>
          <Badge variant="secondary" className="shrink-0 text-[10px] uppercase tracking-wide">
            {kind.label}
          </Badge>
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {artifact.meta}
        </span>
        <span className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground/80">
          <span className="inline-flex min-w-0 items-center gap-1">
            <Icon className="size-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{artifact.stage || "без стадии"}</span>
          </span>
          <span aria-hidden="true">·</span>
          <span className="shrink-0">{artifact.createdAgo}</span>
        </span>
      </span>
    </button>
  );
}

// ─────────────────────── загрузка артефактов ───────────────────────

function ArtifactsSkeleton() {
  return (
    <div
      className="space-y-3 rounded-xl border bg-card p-4"
      role="status"
      aria-label="Загрузка артефактов"
    >
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-9 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-2/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ArtifactsError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-10 text-center">
      <p className="text-sm font-medium">Не удалось загрузить артефакты</p>
      <p className="text-xs text-muted-foreground">
        Проверьте соединение и повторите — воронка пайплайна уже на месте.
      </p>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        <RotateCcw className="size-3.5" aria-hidden="true" />
        Повторить
      </Button>
    </div>
  );
}

// ─────────────────────── узлы дорожки ───────────────────────

function StageNode({ index, status }: { index: number; status: StageStatus }) {
  if (status === "current") {
    return (
      <span className="relative mx-1.5 flex size-8 shrink-0 items-center justify-center">
        <span
          className="absolute inset-0 animate-ping rounded-full bg-primary/40"
          aria-hidden="true"
        />
        <span className="relative flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          {index + 1}
        </span>
      </span>
    );
  }
  if (status === "done") {
    return (
      <span className="mx-1.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/90 text-primary-foreground">
        <Check className="size-4" aria-hidden="true" />
        <span className="sr-only">стадия пройдена</span>
      </span>
    );
  }
  return (
    <span className="mx-1.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-dashed bg-muted text-sm font-medium text-muted-foreground">
      {index + 1}
    </span>
  );
}

function StageStatusChip({ status }: { status: StageStatus }) {
  if (status === "current") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-primary">
        <span className="relative flex size-2">
          <span
            className="absolute inset-0 animate-ping rounded-full bg-primary/60"
            aria-hidden="true"
          />
          <span className="relative size-2 rounded-full bg-primary" aria-hidden="true" />
        </span>
        {STAGE_STATUS_LABEL[status]}
      </span>
    );
  }
  if (status === "done") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-primary/80">
        <Check className="size-3" aria-hidden="true" />
        {STAGE_STATUS_LABEL[status]}
      </span>
    );
  }
  return (
    <span className="text-[11px] text-muted-foreground/70">
      {STAGE_STATUS_LABEL[status]}
    </span>
  );
}
