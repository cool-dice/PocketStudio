"use client";

/**
 * Config preview (Фаза D) — РЕАЛЬНЫЙ сгенерированный конфиг включённых
 * серверов: GET /api/mcp/config → {mcpServers: …} с копированием.
 * Подсветка синтаксиса — тонкая ручная (stone + emerald).
 */

import { useCallback, useEffect, useState } from "react";
import { FileJson, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";
import { CopyButton } from "./mcp-bits";

export function ConfigPreviewCard({ refreshKey = 0 }: { refreshKey?: number }) {
  const [config, setConfig] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getMcpConfig();
      setConfig(res.config);
      setCount(res.count);
    } catch (err) {
      // Молчаливый дегрейд: карточка остаётся, но показывает ошибку загрузки.
      setConfig(null);
      if (err instanceof ApiError && err.status !== 401) {
        toast.error("Не удалось загрузить конфиг интеграций");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  return (
    <section
      aria-label="Конфигурация MCP"
      className="rounded-2xl border bg-card p-4 shadow-xs sm:p-5"
    >
      <header className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
          aria-hidden="true"
        >
          <FileJson className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold leading-tight">
            Конфигурация оркестратора
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            mcp.json · включено серверов: {count}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0"
          onClick={() => void load()}
          aria-label="Обновить конфигурацию"
          disabled={loading}
        >
          <RefreshCw
            className={loading ? "size-4 animate-spin" : "size-4"}
            aria-hidden="true"
          />
        </Button>
        {config !== null ? (
          <CopyButton
            text={config}
            label="Скопировать конфигурацию"
            className="shrink-0"
          />
        ) : null}
      </header>

      {loading && config === null ? (
        <Skeleton className="h-40 w-full rounded-lg" />
      ) : config === null ? (
        <p className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
          Конфигурация недоступна — попробуйте обновить
        </p>
      ) : (
        <pre className="overflow-x-auto vf-scroll rounded-lg bg-stone-950 p-4 font-mono text-xs leading-relaxed text-stone-500 selection:bg-emerald-500/30">
          <code>{config}</code>
        </pre>
      )}

      <p className="mt-2.5 flex items-center gap-1.5 text-xs text-muted-foreground">
        {loading ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        ) : null}
        Собирается из реестра интеграций: builtin-адаптеры и stdio/sse-конфиги
      </p>
    </section>
  );
}
