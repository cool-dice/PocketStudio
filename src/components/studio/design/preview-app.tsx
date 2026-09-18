"use client";

/**
 * Мок-приложение внутри окна превью (режим «Превью (IDE)»): мини-дашборд
 * автора из div-ов — сайдбар, топбар, стат-карточки, график, таблица.
 * Каждый регион обёрнут IdeRegion: в режиме «Дизайнер» наведение
 * подсвечивает элемент, клик выбирает его для инспектора.
 */

import type { ReactNode } from "react";
import {
  Coins,
  FolderKanban,
  LayoutDashboard,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { IDE_ELEMENT_MAP, type IdeElement } from "./layout-data";

const NAV_ITEMS = [
  { label: "Обзор", icon: LayoutDashboard, active: true },
  { label: "Работы", icon: FolderKanban, active: false },
  { label: "Доходы", icon: Coins, active: false },
  { label: "Настройки", icon: SlidersHorizontal, active: false },
];

const STATS = [
  { label: "Доход за месяц", value: "128 400 ₽", delta: "+12%" },
  { label: "Опубликованных работ", value: "24", delta: "+3" },
  { label: "Подписчики", value: "3 918", delta: "+4%" },
];

const CHART_BARS = [
  { m: "апр", v: 32 },
  { m: "май", v: 44 },
  { m: "июн", v: 38 },
  { m: "июл", v: 52 },
  { m: "авг", v: 48 },
  { m: "сен", v: 60 },
  { m: "окт", v: 56 },
  { m: "ноя", v: 68 },
  { m: "дек", v: 64 },
  { m: "янв", v: 76 },
  { m: "фев", v: 84 },
  { m: "мар", v: 96 },
];

const TABLE_ROWS = [
  { name: "Кошелькин Артём", status: "Оплачено", paid: true, amount: "2 400 ₽" },
  { name: "Мельникова Дарья", status: "Ожидает", paid: false, amount: "1 800 ₽" },
  { name: "Ковалёв Степан", status: "Оплачено", paid: true, amount: "3 200 ₽" },
  { name: "Никитина Аня", status: "Оплачено", paid: true, amount: "980 ₽" },
];

/** Общий набор пропсов для интерактивных регионов превью. */
interface RegionProps {
  designer: boolean;
  hoveredId: string | null;
  selectedId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}

/* ────────────────────────── Интерактивный элемент ────────────────────────── */

function IdeRegion({
  el,
  designer,
  hovered,
  selected,
  onHover,
  onSelect,
  className,
  badgeSide = "left",
  dashedHover = false,
  children,
}: {
  el: IdeElement;
  designer: boolean;
  hovered: boolean;
  selected: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  className?: string;
  badgeSide?: "left" | "right";
  dashedHover?: boolean;
  children: ReactNode;
}) {
  if (!designer) {
    return <div className={className}>{children}</div>;
  }
  const outlined = hovered || selected;
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`Элемент ${el.label}`}
      className={cn(
        "relative cursor-pointer outline-none",
        className,
        selected && "outline-2 outline-primary",
        !selected &&
          hovered &&
          (dashedHover
            ? "outline-1 outline-dashed outline-emerald-600/60"
            : "outline-1 outline-primary/70"),
      )}
      onMouseEnter={() => onHover(el.id)}
      onMouseLeave={() => onHover(null)}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(el.id);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          onSelect(el.id);
        }
      }}
    >
      {outlined ? (
        <span
          className={cn(
            "absolute -top-5 z-20 rounded bg-primary px-1.5 py-0.5 font-mono text-[10px] leading-4 whitespace-nowrap text-primary-foreground shadow-md",
            badgeSide === "left" ? "left-0" : "right-0",
          )}
        >
          {el.label}
        </span>
      ) : null}
      {children}
    </div>
  );
}

/* ────────────────────────── Мок-приложение ────────────────────────── */

/** Вьюпорт браузера: приложение-дашборд автора. */
export function PreviewApp({
  designer,
  device,
  hoveredId,
  selectedId,
  onHover,
  onSelect,
}: RegionProps & { device: "desktop" | "mobile" }) {
  const els = IDE_ELEMENT_MAP;
  const region = (id: keyof typeof els) => ({
    el: els[id],
    designer,
    hovered: hoveredId === id,
    selected: selectedId === id,
    onHover,
    onSelect,
  });

  return (
    <IdeRegion
      {...region("root")}
      badgeSide="right"
      dashedHover
      className={cn(
        "mx-auto overflow-hidden rounded-lg border bg-[#100f0e] text-stone-300 shadow-inner",
        device === "mobile"
          ? "flex max-w-[390px] flex-col"
          : "flex w-full",
      )}
    >
      {/* Сайдбар приложения */}
      {device === "desktop" ? (
        <IdeRegion
          {...region("sidebar")}
          className="w-48 shrink-0 border-r border-stone-800/80 bg-[#131110]"
        >
          <div className="flex flex-col gap-1 p-3">
            <div className="mb-2 flex items-center gap-2 px-1">
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Sparkles className="size-4" aria-hidden="true" />
              </span>
              <span className="text-sm font-semibold text-stone-100">
                PocketStudio
              </span>
            </div>
            <ul className="space-y-0.5">
              {NAV_ITEMS.map((item) => (
                <li key={item.label}>
                  <span
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs",
                      item.active
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-stone-400",
                    )}
                  >
                    <item.icon className="size-4" aria-hidden="true" />
                    {item.label}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex items-center gap-2 rounded-lg border border-stone-800 px-2.5 py-2">
              <span className="flex size-7 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
                АС
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-medium text-stone-200">
                  Алиса Совина
                </span>
                <span className="block text-[10px] text-stone-500">
                  Про-аккаунт
                </span>
              </span>
            </div>
          </div>
        </IdeRegion>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Топбар */}
        <IdeRegion
          {...region("topbar")}
          className="flex h-14 shrink-0 items-center gap-3 border-b border-stone-800/80 px-5"
        >
          <span className="flex h-8 min-w-0 max-w-64 flex-1 items-center gap-2 rounded-lg border border-stone-800 bg-[#161514] px-3 text-xs text-stone-500">
            Поиск по кабинету…
          </span>
          <span className="ml-auto flex items-center gap-3">
            <IdeRegion
              {...region("cta")}
              className="rounded-lg bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground"
            >
              Обновить данные
            </IdeRegion>
          </span>
        </IdeRegion>

        {/* Контент */}
        <main className="flex-1 space-y-4 p-4 sm:p-5">
          <div>
            <h3 className="text-base font-semibold text-stone-100">
              Кабинет автора
            </h3>
            <p className="text-xs text-stone-500">
              март 2026 · все проекты
            </p>
          </div>

          {/* Стат-карточки */}
          <IdeRegion
            {...region("stats")}
            className={cn(
              "grid gap-3",
              device === "mobile" ? "grid-cols-1" : "grid-cols-3",
            )}
          >
            {STATS.map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-stone-800/80 bg-[#171512] p-4"
              >
                <p className="text-[11px] text-stone-500">{s.label}</p>
                <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-stone-100">
                  {s.value}
                </p>
                <span className="mt-1.5 inline-flex rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                  {s.delta}
                </span>
              </div>
            ))}
          </IdeRegion>

          {/* График */}
          <IdeRegion
            {...region("chart")}
            className="rounded-xl border border-stone-800/80 bg-[#171512] p-4"
          >
            <div className="mb-3 flex items-center gap-2">
              <p className="text-xs font-medium text-stone-200">
                Доход по месяцам
              </p>
              <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-stone-500">
                <span className="size-2 rounded-sm bg-emerald-500" aria-hidden="true" />
                12 мес
              </span>
            </div>
            <div
              className="flex h-28 items-end gap-1.5 border-b border-stone-800/70 pb-px"
              role="img"
              aria-label="Столбчатый график дохода за 12 месяцев"
            >
              {CHART_BARS.map((bar) => (
                <span
                  key={bar.m}
                  title={`${bar.m} · доход`}
                  className="w-full cursor-default rounded-t-sm bg-gradient-to-t from-emerald-800 to-emerald-500 transition-opacity hover:opacity-80"
                  style={{ height: `${bar.v}%` }}
                  aria-hidden="true"
                />
              ))}
            </div>
          </IdeRegion>

          {/* Таблица */}
          <IdeRegion
            {...region("table")}
            className="rounded-xl border border-stone-800/80 bg-[#171512] p-2"
          >
            <ul className="divide-y divide-stone-800/60">
              {TABLE_ROWS.map((row) => (
                <li
                  key={row.name}
                  className="flex items-center gap-3 px-2 py-2.5"
                >
                  <span className="size-6 shrink-0 rounded-full bg-stone-700" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-xs text-stone-300">
                    {row.name}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                      row.paid
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-amber-500/10 text-amber-700 dark:text-amber-400",
                    )}
                  >
                    {row.status}
                  </span>
                  <span className="shrink-0 font-mono text-xs tabular-nums text-stone-400">
                    {row.amount}
                  </span>
                </li>
              ))}
            </ul>
          </IdeRegion>
        </main>
      </div>
    </IdeRegion>
  );
}
