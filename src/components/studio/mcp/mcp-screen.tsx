"use client";

/**
 * McpScreen — экран «Интеграции» карманной студии.
 * Каталог MCP-серверов с фильтрами, статистикой и примером конфига.
 * Чистый визуальный мок: локальное состояние, без сети.
 */

import { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Blocks, Boxes, PlugZap, Plus, Terminal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ModuleHeader,
  WipBanner,
  type ModuleScreenProps,
} from "@/components/studio/shared/module-header";
import { ConfigPreviewCard } from "./config-preview-card";
import { ServerCard } from "./server-card";
import {
  CUSTOM_SERVER,
  FILTER_LABEL,
  SERVERS,
  type McpFilter,
} from "./mcp-data";
import { cn } from "@/lib/utils";

const FILTERS: McpFilter[] = ["all", "connected", "dev", "content", "data"];

const STAT_META = {
  connected: {
    icon: PlugZap,
    label: "Подключено",
    tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  available: {
    icon: Boxes,
    label: "Доступно",
    tone: "bg-primary/10 text-primary",
  },
  own: {
    icon: Terminal,
    label: "Своих",
    tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
} as const;

function StatTile({
  icon: Icon,
  value,
  label,
  tone,
}: {
  icon: typeof PlugZap;
  value: number;
  label: string;
  tone: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-xs">
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          tone,
        )}
        aria-hidden="true"
      >
        <Icon className="size-4.5" />
      </span>
      <div className="min-w-0">
        <p className="text-xl font-semibold leading-none tabular-nums">{value}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export function McpScreen({ onOpenMobileNav }: ModuleScreenProps) {
  const [connected, setConnected] = useState<Set<string>>(
    () =>
      new Set(SERVERS.filter((s) => s.status === "connected").map((s) => s.id)),
  );
  const [filter, setFilter] = useState<McpFilter>("all");
  const [customAdded, setCustomAdded] = useState(false);

  const toggle = useCallback((id: string) => {
    setConnected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const addCustom = useCallback(() => {
    setCustomAdded(true);
    setConnected((prev) => new Set(prev).add(CUSTOM_SERVER.id));
  }, []);

  const catalog = useMemo(
    () => (customAdded ? [...SERVERS, CUSTOM_SERVER] : SERVERS),
    [customAdded],
  );

  const visible = useMemo(() => {
    switch (filter) {
      case "connected":
        return catalog.filter((s) => connected.has(s.id) && s.status !== "soon");
      case "dev":
      case "content":
      case "data":
        return catalog.filter((s) => s.category === filter);
      default:
        return catalog;
    }
  }, [catalog, connected, filter]);

  const stats = useMemo(() => {
    const connectedCount = catalog.filter(
      (s) => connected.has(s.id) && s.status !== "soon",
    ).length;
    const availableCount = catalog.filter(
      (s) => s.status !== "soon" && !connected.has(s.id),
    ).length;
    const ownCount = catalog.filter((s) => s.own).length;
    return { connectedCount, availableCount, ownCount };
  }, [catalog, connected]);

  const filterCount = (f: McpFilter): number => {
    if (f === "all") return catalog.length;
    if (f === "connected") return stats.connectedCount;
    return catalog.filter((s) => s.category === f).length;
  };

  return (
    <section
      aria-label="Интеграции"
      className="flex h-full min-w-0 flex-1 flex-col bg-background"
    >
      <ModuleHeader
        icon={Blocks}
        title="Интеграции"
        description="MCP-серверы: подключите внешние инструменты к оркестратору"
        stage="wip"
        onOpenMobileNav={onOpenMobileNav}
      >
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={addCustom}
          disabled={customAdded}
        >
          <Plus className="size-4" aria-hidden="true" />
          {customAdded ? "Сервер добавлен" : "Добавить сервер"}
        </Button>
      </ModuleHeader>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto vf-scroll">
        <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
          {/* a) статистика */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-3 gap-3"
          >
            <StatTile
              icon={STAT_META.connected.icon}
              value={stats.connectedCount}
              label={STAT_META.connected.label}
              tone={STAT_META.connected.tone}
            />
            <StatTile
              icon={STAT_META.available.icon}
              value={stats.availableCount}
              label={STAT_META.available.label}
              tone={STAT_META.available.tone}
            />
            <StatTile
              icon={STAT_META.own.icon}
              value={stats.ownCount}
              label={STAT_META.own.label}
              tone={STAT_META.own.tone}
            />
          </motion.div>

          {/* b) фильтры + c/d) каталог */}
          <div className="space-y-4">
            <div
              className="flex flex-wrap items-center gap-1.5"
              role="group"
              aria-label="Фильтр каталога серверов"
            >
              {FILTERS.map((f) => {
                const active = filter === f;
                return (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setFilter(f)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                      active
                        ? "border-transparent bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground",
                    )}
                  >
                    {FILTER_LABEL[f]}
                    <span className="ml-1.5 tabular-nums opacity-70">{filterCount(f)}</span>
                  </button>
                );
              })}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((server, i) => (
                <ServerCard
                  key={server.id}
                  server={server}
                  connected={connected.has(server.id)}
                  onToggle={toggle}
                  index={i}
                />
              ))}

              {/* d) добавить свой сервер */}
              <button
                type="button"
                onClick={addCustom}
                disabled={customAdded}
                aria-label="Добавить свой MCP-сервер"
                className={cn(
                  "flex min-h-40 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed p-4 text-center transition-colors",
                  customAdded
                    ? "cursor-default border-emerald-500/40 text-muted-foreground"
                    : "border-border text-muted-foreground hover:border-primary/40 hover:bg-primary/[0.03] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                )}
              >
                <span
                  className="flex size-10 items-center justify-center rounded-lg bg-muted"
                  aria-hidden="true"
                >
                  <Plus className="size-5" />
                </span>
                <span className="text-sm font-medium">
                  {customAdded ? "Свой сервер добавлен" : "Добавить свой MCP-сервер"}
                </span>
                <span className="text-xs text-muted-foreground">
                  JSON-config или stdio-команда
                </span>
              </button>
            </div>
          </div>

          {/* e) пример конфигурации */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <ConfigPreviewCard />
          </motion.div>

          {/* f) что дальше */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
          >
            <WipBanner
              title="Что дальше"
              description="Подключение MCP-серверов заработает после обновления оркестратора"
              features={["stdio", "SSE", "инструменты", "ресурсы"]}
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
