"use client";

/**
 * HomeScreen — «Главная» (PS-3-a → PS-3.2-a): чат-центричный экран.
 *
 * Главный герой — настоящий чат оркестратора (ChatArea embedded) слева
 * и во всю ширину на мобильном. На lg+ справа — узкий рельс сводки:
 * приветствие, быстрый старт (новый воркспейс / записать мысль),
 * недавние воркспейсы, активность и статистика студии.
 * На мобильном под шапкой — горизонтальная лента «Продолжить работу».
 */

import { useState } from "react";
import { Menu, Mic, Plus } from "lucide-react";

import { ChatArea } from "@/components/app/chat-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useAppUi } from "@/lib/store";

import { CreateWorkspaceDialog } from "@/components/workspaces/create-workspace-dialog";
import { HomeActivity } from "@/components/workspaces/home-activity";
import { HomeRecent } from "@/components/workspaces/home-recent";
import {
  firstNameOf,
  homeDateLine,
  HOME_STATS,
} from "@/components/workspaces/home-data";
import {
  MOCK_WORKSPACES,
  WORKSPACE_TYPE_META,
} from "@/lib/workspace-data";
import { cn } from "@/lib/utils";

/** Чипы мобильной ленты «Продолжить работу». */
const STRIP_LIMIT = 5;

export function HomeScreen({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  const { user } = useAuth();
  const contextOpen = useAppUi((s) => s.contextOpen);
  const setContextOpen = useAppUi((s) => s.setContextOpen);
  const openWorkspace = useAppUi((s) => s.openWorkspace);
  const setCaptureOpen = useAppUi((s) => s.setCaptureOpen);
  const [createOpen, setCreateOpen] = useState(false);

  const firstName = firstNameOf(user?.name);
  const dateLine = homeDateLine();

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-background">
      {/* ── Компактная мобильная шапка (гамбургер навигации) ── */}
      <header className="sticky top-0 z-10 shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            className="size-9 shrink-0"
            onClick={onOpenMobileNav}
            aria-label="Открыть навигацию"
          >
            <Menu className="size-5" aria-hidden="true" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-semibold leading-tight">Главная</h1>
            <p className="truncate text-xs text-muted-foreground">{dateLine}</p>
          </div>
          <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-700 dark:text-amber-400">
            В разработке
          </Badge>
        </div>
      </header>

      {/* ── Мобильная лента «Продолжить работу» (на lg+ её заменяет рельс) ── */}
      <section
        aria-label="Продолжить работу"
        className="shrink-0 border-b bg-background/95 lg:hidden"
      >
        <p className="px-4 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Продолжить работу
        </p>
        <div className="vf-scroll-x flex gap-2 overflow-x-auto px-4 pb-2.5">
          {MOCK_WORKSPACES.slice(0, STRIP_LIMIT).map((ws) => {
            const meta = WORKSPACE_TYPE_META[ws.type];
            return (
              <button
                key={ws.id}
                type="button"
                onClick={() => openWorkspace(ws.id)}
                title={`Открыть «${ws.title}» — сразу в чате оркестратора`}
                className="flex shrink-0 items-center gap-2 rounded-full border bg-card py-1 pl-1 pr-3 text-left outline-none transition-colors duration-150 hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring/60"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-white",
                    ws.gradient,
                  )}
                >
                  <meta.icon className="size-3.5" />
                </span>
                <span className="max-w-36 truncate text-xs font-medium">
                  {ws.title}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Основная зона: чат + (lg+) правый рельс сводки ── */}
      <div className="min-h-0 flex-1 overflow-hidden lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:grid-rows-1">
        {/* Чат — главный инструмент студии */}
        <section
          aria-label="Чат оркестратора"
          className="flex h-full min-h-0 min-w-0 flex-col"
        >
          <ChatArea
            embedded
            contextOpen={contextOpen}
            onToggleContext={() => setContextOpen(!contextOpen)}
            onOpenMobileNav={onOpenMobileNav}
          />
        </section>

        {/* Правый рельс: сводка студии */}
        <aside
          aria-label="Сводка студии"
          className="hidden min-h-0 border-l bg-background lg:flex lg:flex-col"
        >
          <div className="vf-scroll min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
            {/* Приветствие */}
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                {dateLine}
              </p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight">
                Привет{firstName ? `, ${firstName}` : ""}!
              </h2>
            </div>

            {/* Быстрый старт */}
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="group flex w-full items-center gap-2.5 rounded-lg border bg-background/50 px-3 py-2.5 text-left outline-none transition-all duration-150 hover:border-primary/40 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/60"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary" aria-hidden="true">
                  <Plus className="size-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    Новый воркспейс
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    мастер: тип → название
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setCaptureOpen(true)}
                title="⌘K — быстрый захват мысли"
                className="group flex w-full items-center gap-2.5 rounded-lg border bg-background/50 px-3 py-2.5 text-left outline-none transition-all duration-150 hover:border-primary/40 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/60"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary" aria-hidden="true">
                  <Mic className="size-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    Записать мысль
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    голосом или текстом
                  </span>
                </span>
              </button>
            </div>

            {/* Недавние воркспейсы */}
            <HomeRecent />

            {/* Активность */}
            <HomeActivity />

            {/* Статистика */}
            <section aria-label="Статистика студии" className="rounded-xl border bg-card p-3">
              <h3 className="text-sm font-semibold">Студия в цифрах</h3>
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                {HOME_STATS.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-lg border bg-background/50 p-2.5"
                    title={stat.label}
                  >
                    <stat.icon className="size-3.5 text-primary" aria-hidden="true" />
                    <p className="mt-1 text-lg font-semibold leading-none tabular-nums">
                      {stat.value}
                    </p>
                    <p className="mt-1 text-[10px] leading-tight text-muted-foreground">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <p className="px-0.5 text-[10px] leading-relaxed text-muted-foreground">
              Счётчики — демо-цифры: хранение и статистика подключаются
              в Фазе A.
            </p>
          </div>
        </aside>
      </div>

      <CreateWorkspaceDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
