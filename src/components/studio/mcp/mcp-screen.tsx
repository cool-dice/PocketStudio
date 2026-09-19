"use client";

/**
 * McpScreen — экран «Интеграции» (Фаза D): РЕАЛЬНЫЙ реестр MCP-серверов.
 *
 * Данные: GET /api/mcp (каталог лениво засеивается на первого входа).
 * Действия: подключить/отключить (PATCH), редактировать конфиг (PATCH),
 * добавить свой сервер (POST → диалог), удалить свой (DELETE).
 * builtin-адаптеры (fetch/filesystem/browser) дают оркестратору живые
 * инструменты в чате; внешние — честно помечены «конфиг на будущее».
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  Blocks,
  Boxes,
  PlugZap,
  RefreshCw,
  Terminal,
} from "lucide-react";
import { toast } from "sonner";

import {
  ModuleHeader,
  type ModuleScreenProps,
} from "@/components/studio/shared/module-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";
import type { McpServerDto } from "@/lib/workspace-types";
import { AddServerDialog } from "./add-server-dialog";
import { ConfigPreviewCard } from "./config-preview-card";
import { ServerCard } from "./server-card";
import { applyFilter, FILTERS, FILTER_LABEL, type McpFilter } from "./mcp-data";
import { cn } from "@/lib/utils";

const STAT_META = {
  connected: {
    icon: PlugZap,
    label: "Включено",
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
  const [servers, setServers] = useState<McpServerDto[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<McpFilter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  /** Растёт при каждом изменении реестра → перезагружает превью конфига. */
  const [configVersion, setConfigVersion] = useState(0);
  const bumpConfig = useCallback(() => setConfigVersion((v) => v + 1), []);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const rows = await api.listMcpServers();
      setServers(rows);
    } catch (err) {
      setLoadError(
        err instanceof ApiError ? err.message : "Не удалось загрузить реестр",
      );
      setServers([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /* Переключение сервера: оптимистично + откат при ошибке. */
  const toggle = useCallback(
    async (id: string, next: boolean) => {
      const target = servers?.find((s) => s.id === id);
      if (!target) return;
      setBusyId(id);
      setServers((prev) =>
        prev
          ? prev.map((s) => (s.id === id ? { ...s, enabled: next } : s))
          : prev,
      );
      try {
        await api.updateMcpServer(id, { enabled: next });
        bumpConfig();
        toast.success(
          next
            ? `Сервер «${target.name}» подключён`
            : `Сервер «${target.name}» отключён`,
          {
            description: next
              ? target.external
                ? "Конфиг сохранён; инструменты заработают в полной версии"
                : "Инструменты доступны оркестратору в чате"
              : "Инструменты сервера скрыты из диалогов",
          },
        );
      } catch (err) {
        setServers((prev) =>
          prev
            ? prev.map((s) => (s.id === id ? { ...s, enabled: !next } : s))
            : prev,
        );
        toast.error(
          err instanceof ApiError ? err.message : "Не удалось изменить сервер",
        );
      } finally {
        setBusyId(null);
      }
    },
    [servers],
  );

  /* Сохранение конфига из карточки. */
  const saveConfig = useCallback(
    async (id: string, config: Record<string, unknown>): Promise<boolean> => {
      const target = servers?.find((s) => s.id === id);
      if (!target) return false;
      setBusyId(id);
      try {
        const updated = await api.updateMcpServer(id, { config });
        bumpConfig();
        setServers((prev) =>
          prev ? prev.map((s) => (s.id === id ? updated : s)) : prev,
        );
        toast.success(`Конфиг «${target.name}» сохранён`);
        return true;
      } catch (err) {
        toast.error(
          err instanceof ApiError ? err.message : "Конфиг не принят сервером",
        );
        return false;
      } finally {
        setBusyId(null);
      }
    },
    [servers],
  );

  /* Удаление своего сервера. */
  const remove = useCallback(
    async (id: string) => {
      const target = servers?.find((s) => s.id === id);
      if (!target) return;
      setBusyId(id);
      try {
        await api.deleteMcpServer(id);
        bumpConfig();
        setServers((prev) => (prev ? prev.filter((s) => s.id !== id) : prev));
        toast.success(`Сервер «${target.name}» удалён из реестра`);
      } catch (err) {
        toast.error(
          err instanceof ApiError ? err.message : "Не удалось удалить сервер",
        );
      } finally {
        setBusyId(null);
      }
    },
    [servers],
  );

  const visible = useMemo(
    () => (servers ? applyFilter(servers, filter) : []),
    [servers, filter],
  );

  const stats = useMemo(() => {
    if (!servers) return null;
    return {
      connected: servers.filter((s) => s.enabled).length,
      available: servers.filter((s) => !s.enabled).length,
      own: servers.filter((s) => s.own).length,
    };
  }, [servers]);

  const filterCount = (f: McpFilter): number => {
    if (!servers) return 0;
    if (f === "all") return servers.length;
    return applyFilter(servers, f).length;
  };

  return (
    <section
      aria-label="Интеграции"
      className="flex h-full min-w-0 flex-1 flex-col bg-background"
    >
      <ModuleHeader
        icon={Blocks}
        title="Интеграции"
        description="MCP-серверы: реестр с реальными инструментами оркестратора"
        stage="beta"
        onOpenMobileNav={onOpenMobileNav}
      >
        <AddServerDialog
          onCreated={(server) => {
            setServers((prev) => (prev ? [...prev, server] : [server]));
            bumpConfig();
          }}
        />
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
            {stats ? (
              <>
                <StatTile
                  icon={STAT_META.connected.icon}
                  value={stats.connected}
                  label={STAT_META.connected.label}
                  tone={STAT_META.connected.tone}
                />
                <StatTile
                  icon={STAT_META.available.icon}
                  value={stats.available}
                  label={STAT_META.available.label}
                  tone={STAT_META.available.tone}
                />
                <StatTile
                  icon={STAT_META.own.icon}
                  value={stats.own}
                  label={STAT_META.own.label}
                  tone={STAT_META.own.tone}
                />
              </>
            ) : (
              Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-[66px] rounded-xl" />
              ))
            )}
          </motion.div>

          {/* b) фильтры + каталог */}
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
                    <span className="ml-1.5 tabular-nums opacity-70">
                      {filterCount(f)}
                    </span>
                  </button>
                );
              })}
            </div>

            {servers === null ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }, (_, i) => (
                  <Skeleton key={i} className="h-48 rounded-2xl" />
                ))}
              </div>
            ) : loadError ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-10 text-center">
                <AlertCircle
                  className="size-8 text-muted-foreground/50"
                  aria-hidden="true"
                />
                <p className="text-sm text-muted-foreground">{loadError}</p>
                <Button size="sm" variant="outline" onClick={() => void load()}>
                  <RefreshCw className="size-4" aria-hidden="true" />
                  Повторить
                </Button>
              </div>
            ) : visible.length === 0 ? (
              <div className="rounded-2xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
                {filter === "connected"
                  ? "Ничего не включено — подключите сервер из каталога"
                  : "В этой категории серверов нет"}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {visible.map((server, i) => (
                  <ServerCard
                    key={server.id}
                    server={server}
                    index={i}
                    busy={busyId === server.id}
                    onToggle={(id, next) => void toggle(id, next)}
                    onConfigSave={saveConfig}
                    onDelete={(id) => void remove(id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* c) реальный конфиг оркестратора */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <ConfigPreviewCard refreshKey={configVersion} />
          </motion.div>

          {/* d) честная сводка */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
            className="rounded-2xl border bg-card p-4 shadow-xs sm:p-5"
          >
            <h2 className="text-sm font-semibold">Как это работает</h2>
            <ul className="mt-2.5 grid gap-2 text-xs leading-relaxed text-muted-foreground sm:grid-cols-2">
              <li className="rounded-lg border bg-background/60 p-2.5">
                <span className="font-medium text-foreground">Fetch, Filesystem, Playwright</span>{" "}
                — builtin-адаптеры: их инструменты сразу доступны
                оркестратору (fetch_url, web_search, browser_read, файлы
                воркспейса)
              </li>
              <li className="rounded-lg border bg-background/60 p-2.5">
                <span className="font-medium text-foreground">GitHub и другие</span>{" "}
                — внешние серверы: конфиг сохраняется в реестре, запуск — в
                полной версии студии
              </li>
              <li className="rounded-lg border bg-background/60 p-2.5">
                Отключение сервера скрывает его инструменты из чата —
                оркестратор честно скажет, чего не хватает
              </li>
              <li className="rounded-lg border bg-background/60 p-2.5">
                Свой сервер можно добавить с stdio-командой или SSE-адресом —
                конфиг попадёт в общий mcp.json
              </li>
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
