"use client";

/**
 * WorkspaceChatTab — вкладка «Чат» воркспейса (PS-3-d → Фаза A, PS-5-d).
 *
 * ЖИВОЙ оркестратор: на общем ThreadsProvider находим свежий тред этого
 * воркспейса (Thread.projectId === workspace.id) или создаём новый —
 * агент-сервис резолвит projectId из строки треда, поэтому инструменты
 * (create_entity / check_document / generate_image / tts_narration)
 * работают в скоупе ЭТОГО воркспейса. Тот же тред виден в сайдбаре и
 * виджете на Главной — единая беседа продукта.
 *
 * Шапка: быстрый доступ к модулям воркспейса (чипы → setWorkspaceTab).
 * Тело: MessageBubble'ы общего чата + индикатор фазы + живой план (PlanCard)
 * + Composer (slash-команды, голосовой ввод).
 */

import { useEffect, useRef } from "react";
import { MessageSquare, Sparkles } from "lucide-react";

import { Composer } from "@/components/app/composer";
import { MessageBubble } from "@/components/app/message-bubble";
import { PlanCard } from "@/components/app/plan-card";
import { RagScopeBadge } from "@/components/app/rag-scope-badge";
import { StageBadge } from "@/components/studio/shared/module-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useThreads } from "@/hooks/use-threads";
import { formatPrefetchHint } from "@/lib/rag/prefetch";
import { useAppUi } from "@/lib/store";
import type { TurnPhase } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  WORKSPACE_TABS_BY_TYPE,
  WORKSPACE_TAB_META,
  WORKSPACE_TYPE_META,
  type WorkspaceSummary,
  type WorkspaceTab,
} from "@/lib/workspace-data";

/** Максимум чипов быстрого доступа к модулям в шапке. */
const MODULE_CHIPS_LIMIT = 5;

/** Служебные вкладки — не модули: сам чат, обзор и заметки уже рядом. */
const NON_MODULE_TABS: readonly WorkspaceTab[] = ["chat", "overview", "notes"];

/** Стартовые подсказки пустого треда — клик отправляет живую задачу
 *  оркестратору (задачи подобраны под его инструменты воркспейса). */
const STARTER_PROMPTS: Record<WorkspaceSummary["type"], string[]> = {
  film: [
    "Проверь, чем занят фильм прямо сейчас?",
    "Сгенерируй кадр-референс главной сцены",
    "Проверь сценарий на противоречия",
    "Озвучь реплики главного героя",
  ],
  book: [
    "Где мы в работе над книгой?",
    "Прогони аналитика по рукописи",
    "Создай персонажа для книги",
    "Сгенерируй обложку",
  ],
  music: [
    "С чего начнём работу над музыкой?",
    "Запиши текст трека в заметки",
    "Озвучь текст песни",
    "Сгенерируй обложку трека",
  ],
  app: [
    "Проверь состояние приложения",
    "Собери лендинг релиза",
    "Напиши спеку модуля",
  ],
  universal: [
    "Чем занят этот воркспейс?",
    "Черновик документа",
    "Сгенерируй арт",
    "Проверь текст аналитиком",
  ],
};

/** Модули этого воркспейса для чипов быстрого доступа. */
function moduleTabsOf(ws: WorkspaceSummary): WorkspaceTab[] {
  return WORKSPACE_TABS_BY_TYPE[ws.type]
    .filter((tab) => !NON_MODULE_TABS.includes(tab))
    .slice(0, MODULE_CHIPS_LIMIT);
}

function TypingIndicator({ phase }: { phase: TurnPhase | null }) {
  const label =
    phase === "plan"
      ? "Планировщик составляет шаги"
      : phase === "act"
        ? "Исполнитель работает"
        : phase === "review"
          ? "Ревьюер проверяет результат"
          : "Оркестратор думает";
  return (
    <div className="flex w-full items-start gap-2.5 sm:gap-3">
      <span
        aria-hidden="true"
        className={cn(
          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors duration-300",
          phase
            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
            : "bg-primary/10 text-primary",
        )}
      >
        <Sparkles className="size-3.5" />
      </span>
      <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border bg-card px-4 py-3 text-sm text-muted-foreground">
        <span className="text-xs">{label}</span>
        <span className="flex items-center gap-1 py-0.5">
          <span className="vf-dot" />
          <span className="vf-dot" />
          <span className="vf-dot" />
        </span>
      </div>
    </div>
  );
}

export function WorkspaceChatTab({
  workspace,
}: {
  workspace: WorkspaceSummary;
}) {
  const typeMeta = WORKSPACE_TYPE_META[workspace.type];
  const setWorkspaceTab = useAppUi((s) => s.setWorkspaceTab);
  const moduleTabs = moduleTabsOf(workspace);

  const {
    threads,
    threadsLoading,
    threadsError,
    activeThread,
    messages,
    messagesLoading,
    busy,
    thinking,
    phase,
    tasks,
    selectThread,
    startProjectThread,
    sendMessage,
    canonHint,
  } = useThreads();

  /* Не плодим треды, если предыдущий start ещё в полёте. */
  const bindingRef = useRef(false);

  useEffect(() => {
    if (threadsLoading || threadsError || bindingRef.current) return;
    if (activeThread?.projectId === workspace.id) return;

    const existing = threads.find((t) => t.projectId === workspace.id);
    if (existing) {
      void selectThread(existing.id);
      return;
    }
    bindingRef.current = true;
    void startProjectThread(workspace.id, `Чат · ${workspace.title}`).finally(() => {
      bindingRef.current = false;
    });
  }, [
    threads,
    threadsLoading,
    threadsError,
    activeThread?.projectId,
    workspace.id,
    workspace.title,
    selectThread,
    startProjectThread,
  ]);

  const starters = STARTER_PROMPTS[workspace.type];
  const isScoped = activeThread?.projectId === workspace.id;
  const showEmpty = !messagesLoading && isScoped && messages.length === 0;

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* ── Шапка хаба оркестратора ── */}
      <header className="shrink-0 border-b bg-background/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-3xl items-start gap-3">
          <span
            aria-hidden="true"
            className={`flex size-10 shrink-0 items-center justify-center rounded-xl border bg-gradient-to-br text-white ${workspace.gradient}`}
          >
            <MessageSquare className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-sm font-semibold">
                Оркестратор воркспейса «{workspace.title}»
              </h2>
              <RagScopeBadge scope="workspace" />
              {canonHint && isScoped && (
                <span className="min-w-0 truncate text-[11px] text-muted-foreground">
                  {formatPrefetchHint(
                    canonHint.scope,
                    canonHint.hitCount,
                    canonHint.mode,
                  )}
                </span>
              )}
              <StageBadge stage="beta" />
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {typeMeta.label} · стадия «{workspace.stage}»
              {activeThread && isScoped ? ` · ${activeThread.title}` : ""}
            </p>
            <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
              Главный инструмент: опишите задачу — создаст сущности и артефакты
              в этом воркспейсе и откроет нужный модуль
            </p>
            {moduleTabs.length > 0 && (
              <nav
                aria-label="Быстрый доступ к модулям"
                className="mt-2 flex flex-wrap gap-1.5"
              >
                {moduleTabs.map((tab) => {
                  const meta = WORKSPACE_TAB_META[tab];
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setWorkspaceTab(tab)}
                      title={`Открыть вкладку «${meta.label}»`}
                      aria-label={`Открыть вкладку «${meta.label}»`}
                      className="inline-flex shrink-0 items-center gap-1 rounded-full border bg-card px-2 py-0.5 text-[11px] text-muted-foreground outline-none transition-colors duration-150 hover:border-primary/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60"
                    >
                      <meta.icon className="size-3" aria-hidden="true" />
                      {meta.label}
                    </button>
                  );
                })}
              </nav>
            )}
          </div>
        </div>
      </header>

      {/* ── Беседа ── */}
      <div
        className="vf-scroll min-h-0 flex-1 overflow-y-auto"
        aria-live="polite"
        aria-label="Беседа с оркестратором воркспейса"
      >
        {messagesLoading || !isScoped ? (
          <div className="mx-auto w-full max-w-3xl space-y-4 p-4 sm:px-6">
            <Skeleton className="h-12 w-2/3" />
            <Skeleton className="ml-auto h-9 w-1/2" />
            <Skeleton className="h-12 w-3/4" />
          </div>
        ) : showEmpty ? (
          <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 px-4 py-10 text-center sm:px-6">
            <span
              aria-hidden="true"
              className={`flex size-14 items-center justify-center rounded-2xl border bg-gradient-to-br text-white ${workspace.gradient}`}
            >
              <Sparkles className="size-6" />
            </span>
            <div>
              <p className="text-sm font-medium">
                Диалог привязан к «{workspace.title}»
              </p>
              <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
                Оркестратор видит стадию, документы и сущности этого
                воркспейса — опишите задачу или начните с подсказки.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-1.5">
              {starters.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void sendMessage(prompt)}
                  disabled={busy}
                  className="shrink-0 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground outline-none transition-colors hover:border-primary/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-3xl space-y-4 p-4 pb-6 sm:space-y-5 sm:px-6">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {thinking && <TypingIndicator phase={phase?.phase ?? null} />}
          </div>
        )}
      </div>

      {/* ── Живой план + композер ── */}
      <PlanCard tasks={isScoped ? tasks : []} busy={busy} phase={isScoped ? phase : null} />
      <Composer locked={!isScoped} scopeProjectId={workspace.id} />

      <span aria-live="polite" className="sr-only">
        {busy ? "Оркестратор печатает" : ""}
      </span>
    </div>
  );
}
