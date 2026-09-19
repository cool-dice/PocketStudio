"use client";

/**
 * Карточка MCP-сервера из реестра (Фаза D): живой статус из БД,
 * «Подключить/Отключить» → PATCH /api/mcp/[id], инлайн-редактор
 * конфига транспортом, удаление своего сервера.
 *
 * Честные бейджи: builtin-адаптеры работают в песочнице (инструменты
 * оркестратора), внешние stdio/sse — сохранённый конфиг на будущее.
 */

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Check,
  CloudOff,
  Loader2,
  PlugZap,
  Plus,
  Save,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { McpServerDto } from "@/lib/workspace-types";
import { CATEGORY_LABEL, configPreview, MCP_FALLBACK_ICON, MCP_ICON_BY_KEY, MCP_OWN_ICON } from "./mcp-data";
import { cn } from "@/lib/utils";

const CATEGORY_TONE: Record<McpServerDto["category"], string> = {
  dev: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  content: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  data: "bg-stone-500/10 text-stone-600 dark:text-stone-400",
};

function StatusBadge({ server }: { server: McpServerDto }) {
  if (server.runtimeStatus === "cli_missing") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
        <CloudOff className="size-3" aria-hidden="true" />
        CLI не найден
      </span>
    );
  }
  if (server.enabled && !server.external) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
        <Check className="size-3" aria-hidden="true" />
        Работает
      </span>
    );
  }
  if (server.enabled && server.external) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
        <CloudOff className="size-3" aria-hidden="true" />
        Конфиг сохранён
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium text-stone-600 dark:text-stone-400">
      Доступно
    </span>
  );
}

export function ServerCard({
  server,
  index,
  busy,
  onToggle,
  onConfigSave,
  onDelete,
}: {
  server: McpServerDto;
  index: number;
  busy: boolean;
  onToggle: (id: string, next: boolean) => void;
  onConfigSave: (id: string, config: Record<string, unknown>) => Promise<boolean>;
  onDelete: (id: string) => void;
}) {
  const [showConfig, setShowConfig] = useState(false);
  const [draft, setDraft] = useState(() => configPreview(server));
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const Icon =
    server.own
      ? MCP_OWN_ICON
      : (MCP_ICON_BY_KEY[server.catalogKey ?? ""] ?? MCP_FALLBACK_ICON);

  async function saveConfig() {
    setSaveError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(draft);
    } catch {
      setSaveError("Это не JSON — проверьте синтаксис");
      return;
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      setSaveError("Конфиг должен быть JSON-объектом {…}");
      return;
    }
    setSaving(true);
    const ok = await onConfigSave(server.id, parsed as Record<string, unknown>);
    setSaving(false);
    if (ok) {
      setShowConfig(false);
      setSaveError(null);
    } else {
      setSaveError("Сервер не принял конфиг — проверьте поля");
    }
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.32) }}
      className={cn(
        "flex h-full flex-col gap-3 rounded-2xl border bg-card p-4 shadow-xs transition-colors",
        "hover:border-primary/25",
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
        <StatusBadge server={server} />
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
        {server.external ? (
          <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground/80">
            Внешний сервер: конфиг сохраняется для полной версии, инструменты
            в песочнице недоступны
          </p>
        ) : server.transport === "builtin" ? (
          <p className="mt-1.5 text-[11px] leading-snug text-emerald-700/90 dark:text-emerald-400/80">
            Builtin-адаптер: инструменты доступны оркестратору в чате
          </p>
        ) : null}
      </div>

      {showConfig ? (
        <div id={`${server.id}-config`} className="space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setSaveError(null);
            }}
            aria-label={`JSON-конфиг сервера ${server.name}`}
            rows={4}
            className="min-w-0 font-mono text-[11px] leading-relaxed"
            spellCheck={false}
          />
          {saveError ? (
            <p className="text-xs text-rose-600 dark:text-rose-400" role="alert">
              {saveError}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              className="h-7 rounded-lg px-2.5 text-xs"
              onClick={() => void saveConfig()}
              disabled={saving || busy}
            >
              {saving ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="size-3.5" aria-hidden="true" />
              )}
              Сохранить конфиг
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2.5 text-xs"
              onClick={() => {
                setShowConfig(false);
                setDraft(configPreview(server));
                setSaveError(null);
              }}
            >
              <X className="size-3.5" aria-hidden="true" />
              Отмена
            </Button>
          </div>
        </div>
      ) : null}

      <footer className="mt-auto flex items-center justify-between gap-2 border-t pt-3">
        <span className="truncate rounded-full bg-muted px-2.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
          {server.toolsCount > 0
            ? `${server.toolsCount} инструментов`
            : server.transport.toUpperCase()}
        </span>
        <div className="flex shrink-0 items-center gap-1.5">
          {server.own ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400"
              onClick={() => onDelete(server.id)}
              disabled={busy}
              aria-label={`Удалить сервер ${server.name}`}
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
            </Button>
          ) : null}
          {server.enabled ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 rounded-lg px-2.5 text-xs"
                onClick={() => setShowConfig((v) => !v)}
                aria-expanded={showConfig}
                aria-controls={`${server.id}-config`}
                disabled={busy}
              >
                <SlidersHorizontal className="size-3.5" aria-hidden="true" />
                {showConfig ? "Скрыть" : "Настроить"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-7 rounded-lg px-2.5 text-xs"
                onClick={() => onToggle(server.id, false)}
                disabled={busy}
              >
                Отключить
              </Button>
            </>
          ) : (
            <Button
              type="button"
              size="sm"
              className="h-7 rounded-lg px-2.5 text-xs"
              onClick={() => onToggle(server.id, true)}
              disabled={busy}
              aria-label={`Подключить сервер ${server.name}`}
            >
              {busy ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className="size-3.5" aria-hidden="true" />
              )}
              Подключить
            </Button>
          )}
        </div>
      </footer>
    </motion.article>
  );
}
