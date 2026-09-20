"use client";

/**
 * HomeScreen — «Главная» (Фаза A): дашборд на живых данных.
 *
 * api.getDashboard() даёт статистику («Студия в цифрах» — воркспейсы,
 * артефакты, заметки за неделю, активные стадии) и ленту «Активность».
 * Чат — виджет в сетке дашборда (PS-4), недавние воркспейсы — HomeRecent
 * из общего стора useWorkspaces. Скелетоны на время загрузки, ошибка
 * статистики — с повтором.
 */

import { useEffect, useState } from "react";
import { Menu, Mic, Plus, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useAppUi } from "@/lib/store";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { api } from "@/lib/api";
import type { DashboardDto } from "@/lib/workspace-types";

import { HomeActivity } from "@/components/workspaces/home-activity";
import { HomeChatWidget } from "@/components/workspaces/home-chat-widget";
import { HomeRecent } from "@/components/workspaces/home-recent";
import {
  firstNameOf,
  homeDateLine,
  homeStats,
} from "@/components/workspaces/home-data";

export function HomeScreen({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  const { user } = useAuth();
  const setCaptureOpen = useAppUi((s) => s.setCaptureOpen);
  const openCreateWorkspace = useAppUi((s) => s.openCreateWorkspace);

  const [dashboard, setDashboard] = useState<DashboardDto | null>(null);
  const [dashLoading, setDashLoading] = useState(true);
  const [dashError, setDashError] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  const { workspaces } = useWorkspaces();
  const workspaceSig = workspaces.map((w) => w.id).join(",");

  useEffect(() => {
    let cancelled = false;
    api
      .getDashboard()
      .then((data) => {
        if (!cancelled) {
          setDashboard(data);
          setDashError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setDashError(true);
      })
      .finally(() => {
        if (!cancelled) setDashLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadTick, workspaceSig]);

  function reloadDashboard() {
    setDashLoading(true);
    setDashError(false);
    setReloadTick((t) => t + 1);
  }

  const firstName = firstNameOf(user?.name);
  const dateLine = homeDateLine();
  const stats = dashboard ? homeStats(dashboard.stats) : null;

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
        </div>
      </header>

      {/* ── Прокручиваемый дашборд ── */}
      <div className="vf-scroll min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-5 md:px-6 md:py-8">
          {/* Приветствие + быстрые действия */}
          <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                {dateLine}
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">
                Привет{firstName ? `, ${firstName}` : ""}!
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Студия готова: спросите, создайте или продолжите начатое
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setCaptureOpen(true)}
                title="⌘K — быстрый захват мысли"
                className="gap-2"
              >
                <Mic className="size-4" aria-hidden="true" />
                Записать мысль
              </Button>
              <Button onClick={() => openCreateWorkspace()} className="gap-2">
                <Plus className="size-4" aria-hidden="true" />
                Новый воркспейс
              </Button>
            </div>
          </header>

          {/* Статистика студии (живые счётчики /api/dashboard) */}
          <section aria-label="Статистика студии">
            {stats ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="group rounded-xl border bg-card p-4 transition-all duration-200 hover:border-primary/40 hover:shadow-sm"
                  >
                    <span
                      className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"
                      aria-hidden="true"
                    >
                      <stat.icon className="size-4" />
                    </span>
                    <p className="mt-3 text-2xl font-bold leading-none tabular-nums tracking-tight">
                      {stat.value}
                    </p>
                    <p className="mt-1.5 text-xs leading-tight text-muted-foreground">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
            ) : dashError ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed px-4 py-5">
                <p className="text-sm text-muted-foreground">
                  Не удалось загрузить статистику студии.
                </p>
                <Button variant="outline" size="sm" onClick={reloadDashboard}>
                  <RotateCcw className="size-3.5" aria-hidden="true" />
                  Повторить
                </Button>
              </div>
            ) : (
              <div
                className="grid grid-cols-2 gap-3 md:grid-cols-4"
                role="status"
                aria-label="Загрузка статистики студии"
              >
                {Array.from({ length: 4 }, (_, i) => (
                  <div key={i} className="rounded-xl border bg-card p-4">
                    <Skeleton className="size-9 rounded-lg" />
                    <Skeleton className="mt-3 h-7 w-14" />
                    <Skeleton className="mt-2 h-3 w-20" />
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Сетка: чат-виджет + активность (min-w-0 — треки не раздувает контент) */}
          <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <div className="flex h-[440px] min-h-0 min-w-0 flex-col sm:h-[480px] lg:h-[540px]">
              <HomeChatWidget />
            </div>
            <div className="flex h-[360px] min-h-0 min-w-0 flex-col sm:h-[420px] lg:h-[540px]">
              <HomeActivity
                items={dashboard?.activity ?? []}
                loading={dashLoading}
              />
            </div>
          </div>

          {/* Недавние воркспейсы */}
          <HomeRecent />

          <p className="pb-2 text-center text-[11px] text-muted-foreground">
            Статистика, активность и воркспейсы — живые данные из БД студии · Фаза A.
          </p>
        </div>
      </div>

      </div>
    </div>
  );
}
