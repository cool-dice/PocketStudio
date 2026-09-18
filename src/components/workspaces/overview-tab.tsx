"use client";

/**
 * OverviewTab — «Обзор» воркспейса: живой пайплайн типа (PS-3-b).
 *
 * Стадийная дорожка (готово / сейчас / впереди), карточка «Дальше» с
 * подсказкой и переходом к работе, артефакты по стадиям (единая карточка
 * ArtifactCard) и боковая колонка: о воркспейсе, состав, быстрые действия.
 */

import { useMemo } from "react";
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
  Wand2,
} from "lucide-react";
import { toast } from "sonner";

import { ArtifactCard } from "@/components/workspaces/shared/artifact-card";
import {
  ARTIFACT_KIND_META,
  artifactsOfWorkspace,
  type ArtifactItem,
} from "@/components/workspaces/shared/artifacts-data";
import {
  createdAgoOf,
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAppUi } from "@/lib/store";
import {
  WORKSPACE_PIPELINE_TITLE,
  WORKSPACE_STAGES,
  WORKSPACE_TAB_META,
  WORKSPACE_TYPE_META,
  type WorkspaceSummary,
  type WorkspaceTab,
} from "@/lib/workspace-data";
import { cn } from "@/lib/utils";

const COUNT_ITEMS = [
  { key: "notes", label: "Заметки", icon: NotebookPen },
  { key: "documents", label: "Документы", icon: BookOpenText },
  { key: "images", label: "Картинки", icon: ImagePlus },
  { key: "audio", label: "Аудио", icon: AudioWaveform },
  { key: "video", label: "Видео", icon: Clapperboard },
  { key: "files", label: "Файлы", icon: FolderKanban },
] as const;

export function OverviewTab({ workspace }: { workspace: WorkspaceSummary }) {
  const setWorkspaceTab = useAppUi((s) => s.setWorkspaceTab);

  const artifacts = useMemo(
    () => artifactsOfWorkspace(workspace.id),
    [workspace.id],
  );
  const stages = WORKSPACE_STAGES[workspace.type];
  const currentIdx = currentStageIndex(workspace);
  const nextStage = stages[currentIdx + 1];
  const prompt = nextStepOf(workspace);
  const meta = WORKSPACE_TYPE_META[workspace.type];
  const workTab = resolveWorkspaceTab(
    workspace,
    STAGE_WORK_TABS[workspace.type][workspace.stage] ?? "chat",
  );

  /** Клик по карточке артефакта → его модуль внутри воркспейса (N3). */
  function openArtifact(artifact: ArtifactItem) {
    const tab: WorkspaceTab = ARTIFACT_KIND_META[artifact.kind].tab;
    setWorkspaceTab(resolveWorkspaceTab(workspace, tab));
  }

  function askOrchestrator() {
    toast.info("Оркестратор", {
      description: `Запрос «${prompt.title}» отправлен — ответ появится во вкладке «Чат».`,
    });
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
                  {pluralArtifacts(artifacts.length)}
                </span>
              </div>

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
                      <div className="space-y-2 p-3">
                        {list.map((artifact) => (
                          <ArtifactCard
                            key={artifact.id}
                            artifact={artifact}
                            dense
                            onOpen={openArtifact}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="px-4 py-3 text-xs text-muted-foreground/70">
                        Пока пусто — артефакты этой стадии появятся по ходу работы.
                      </p>
                    )}
                  </section>
                );
              })}
            </div>

            {/* Боковая колонка */}
            <aside className="min-w-0 space-y-4" aria-label="Сводка воркспейса">
              {/* О воркспейсе */}
              <section className="rounded-xl border bg-card p-4">
                <h2 className="text-sm font-semibold">О воркспейсе</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {workspace.description}
                </p>
                <dl className="mt-3 space-y-1.5 text-xs">
                  <div className="flex items-baseline justify-between gap-2">
                    <dt className="text-muted-foreground">Тип</dt>
                    <dd className="font-medium">{meta.label}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <dt className="text-muted-foreground">Создан</dt>
                    <dd className="font-medium">{createdAgoOf(workspace)}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <dt className="text-muted-foreground">Обновлён</dt>
                    <dd className="font-medium">{workspace.updatedAgo}</dd>
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
                  {workspace.progress}% · стадия «{workspace.stage}»
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
                      {action.wip ? (
                        <Badge
                          variant="outline"
                          className="shrink-0 border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-700 dark:text-amber-400"
                        >
                          В разработке
                        </Badge>
                      ) : null}
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
