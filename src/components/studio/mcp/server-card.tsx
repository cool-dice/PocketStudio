"use client";

/**
 * Catalog card of one MCP server. «Подключить» переключает статус
 * локально; «Настроить» разворачивает stdio-строку сервера.
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, PlugZap, Plus, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CATEGORY_LABEL, type McpServer } from "./mcp-data";
import { cn } from "@/lib/utils";

const CATEGORY_TONE: Record<McpServer["category"], string> = {
  dev: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  content: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  data: "bg-stone-500/10 text-stone-600 dark:text-stone-400",
};

function StatusBadge({ status }: { status: McpServer["status"] }) {
  if (status === "connected") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
        <Check className="size-3" aria-hidden="true" />
        Подключено
      </span>
    );
  }
  if (status === "available") {
    return (
      <span className="inline-flex shrink-0 items-center rounded-full border text-[11px] font-medium text-stone-600 dark:text-stone-400">
        Доступно
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      Скоро
    </span>
  );
}

export function ServerCard({
  server,
  connected,
  onToggle,
  index,
}: {
  server: McpServer;
  connected: boolean;
  onToggle: (id: string) => void;
  index: number;
}) {
  const [showConfig, setShowConfig] = useState(false);
  const Icon = server.icon;
  const isSoon = server.status === "soon";
  const liveStatus: McpServer["status"] = isSoon
    ? "soon"
    : connected
      ? "connected"
      : "available";

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.32) }}
      className={cn(
        "flex h-full flex-col gap-3 rounded-2xl border bg-card p-4 shadow-xs transition-colors",
        !isSoon && "hover:border-primary/25",
        server.own && "border-dashed",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
          aria-hidden="true"
        >
          <Icon className="size-5" />
        </span>
        <StatusBadge status={liveStatus} />
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="truncate text-sm font-semibold leading-tight">{server.name}</h3>
          {server.own ? (
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-px text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
              свой
            </span>
          ) : null}
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-medium",
              CATEGORY_TONE[server.category],
            )}
          >
            {CATEGORY_LABEL[server.category]}
          </span>
        </div>
        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {server.description}
        </p>
      </div>

      {showConfig ? (
        <code
          id={`${server.id}-config`}
          className="block overflow-x-auto vf-scroll rounded-lg bg-stone-950 p-2.5 font-mono text-[11px] leading-relaxed text-stone-300"
        >
          {server.config}
        </code>
      ) : null}

      <footer className="mt-auto flex items-center justify-between gap-2 border-t pt-3">
        <span className="truncate rounded-full bg-muted px-2.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
          {server.tools} инструментов
        </span>
        {isSoon ? (
          <Button type="button" size="sm" variant="secondary" className="h-7 px-2.5 text-xs" disabled>
            Скоро
          </Button>
        ) : connected ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 rounded-lg px-2.5 text-xs"
            onClick={() => setShowConfig((v) => !v)}
            aria-expanded={showConfig}
            aria-controls={`${server.id}-config`}
          >
            <SlidersHorizontal className="size-3.5" aria-hidden="true" />
            {showConfig ? "Скрыть" : "Настроить"}
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            className="h-7 rounded-lg px-2.5 text-xs"
            onClick={() => onToggle(server.id)}
            aria-label={`Подключить сервер ${server.name}`}
          >
            <Plus className="size-3.5" aria-hidden="true" />
            Подключить
          </Button>
        )}
      </footer>
    </motion.article>
  );
}
