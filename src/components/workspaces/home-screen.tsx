"use client";

/**
 * HomeScreen — «Главная» (PS-3-a): дашборд единого потока.
 *
 * Приветствие с быстрым стартом (новый воркспейс / записать мысль /
 * спросить студию), «Продолжить работу» с недавними воркспейсами,
 * лента активности и статистика студии. Мобайл — стопка, lg — герой
 * слева, статистика правой колонкой.
 */

import { useState } from "react";
import {
  Library,
  Menu,
  Mic,
  NotebookPen,
  Plus,
  Sparkles,
  Wrench,
} from "lucide-react";

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

const QUICK_LINKS = [
  { area: "notebook", label: "Блокнот", icon: NotebookPen, hint: "личные заметки вне воркспейсов" },
  { area: "library", label: "Библиотека", icon: Library, hint: "весь контент всех воркспейсов" },
  { area: "tools", label: "Инструменты", icon: Wrench, hint: "скиллы, интеграции, монетизация" },
] as const;

export function HomeScreen({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  const { user } = useAuth();
  const setMainArea = useAppUi((s) => s.setMainArea);
  const setCaptureOpen = useAppUi((s) => s.setCaptureOpen);
  const [createOpen, setCreateOpen] = useState(false);

  const firstName = firstNameOf(user?.name);
  const dateLine = homeDateLine();

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
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

      <div className="vf-scroll min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-6">
            {/* ── Левая колонна: герой, продолжение, активность ── */}
            <div className="min-w-0 space-y-4 sm:space-y-5">
              <section
                aria-label="Приветствие и быстрый старт"
                className="relative overflow-hidden rounded-xl border bg-card p-5 sm:p-6"
              >
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-primary/10 blur-3xl"
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -bottom-28 -left-16 size-56 rounded-full bg-emerald-500/10 blur-3xl"
                />
                <div className="relative flex flex-col gap-4">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                      {dateLine}
                    </p>
                    <h1 className="mt-1.5 text-2xl font-semibold tracking-tight sm:text-3xl">
                      Привет{firstName ? `, ${firstName}` : ""}!
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                      Что творим сегодня?
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => setCreateOpen(true)}>
                      <Plus aria-hidden="true" />
                      Новый воркспейс
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setCaptureOpen(true)}
                      title="⌘K — быстрый захват мысли"
                    >
                      <Mic aria-hidden="true" />
                      Записать мысль
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setMainArea("chat")}
                      title="Откроет чат с оркестратором студии"
                    >
                      <Sparkles aria-hidden="true" />
                      Спросить студию
                    </Button>
                  </div>
                </div>
              </section>

              <HomeRecent />

              <HomeActivity />
            </div>

            {/* ── Правая колонна: статистика и быстрый доступ ── */}
            <aside className="min-w-0 space-y-4" aria-label="Сводка студии">
              <section aria-label="Статистика студии" className="rounded-xl border bg-card p-4">
                <h2 className="text-sm font-semibold">Студия в цифрах</h2>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {HOME_STATS.map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-lg border bg-background/50 p-3"
                      title={stat.label}
                    >
                      <stat.icon className="size-4 text-primary" aria-hidden="true" />
                      <p className="mt-1.5 text-2xl font-semibold leading-none tabular-nums">
                        {stat.value}
                      </p>
                      <p className="mt-1 text-[11px] leading-tight text-muted-foreground">
                        {stat.label}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <section aria-label="Быстрый доступ" className="rounded-xl border bg-card p-4">
                <h2 className="text-sm font-semibold">Быстрый доступ</h2>
                <div className="mt-3 space-y-1.5">
                  {QUICK_LINKS.map((link) => (
                    <button
                      key={link.area}
                      type="button"
                      onClick={() => setMainArea(link.area)}
                      className="group flex w-full items-center gap-2.5 rounded-lg border bg-background/50 px-3 py-2.5 text-left text-sm outline-none transition-all duration-150 hover:border-primary/40 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/60"
                    >
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <link.icon className="size-3.5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{link.label}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {link.hint}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              <p className="px-1 text-[10px] leading-relaxed text-muted-foreground">
                Дашборд единого потока: воркспейсы, блокнот и библиотека.
                {" "}Счётчики недели — демо-цифры, хранение подключается в фазе A.
              </p>
            </aside>
          </div>
        </div>
      </div>

      <CreateWorkspaceDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
