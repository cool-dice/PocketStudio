"use client";

/**
 * Диалог «Добавить свой MCP-сервер» (Фаза D): название + транспорт
 * (stdio/sse) + JSON-конфиг → POST /api/mcp. Сервер сохраняется в
 * реестр; запуск внешних серверов — за пределами песочницы.
 */

import { useEffect, useState } from "react";
import { Loader2, Plus, Server } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";
import type { McpServerDto } from "@/lib/workspace-types";
import { cn } from "@/lib/utils";

type Transport = "stdio" | "sse";

const DEFAULT_CONFIG: Record<Transport, string> = {
  stdio: '{\n  "command": "bun",\n  "args": ["./tools/mcp-server.ts"]\n}',
  sse: '{\n  "url": "https://mcp.example.com/sse"\n}',
};

const TRANSPORT_HINT: Record<Transport, string> = {
  stdio: "Команда запуска сервера: command + args",
  sse: "Адрес SSE-эндпоинта сервера",
};

export function AddServerDialog({
  onCreated,
}: {
  onCreated: (server: McpServerDto) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [transport, setTransport] = useState<Transport>("stdio");
  const [config, setConfig] = useState(DEFAULT_CONFIG.stdio);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /* Сброс формы при каждом открытии. */
  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
      setTransport("stdio");
      setConfig(DEFAULT_CONFIG.stdio);
      setError(null);
    }
  }, [open]);

  function pickTransport(next: Transport) {
    setTransport(next);
    setConfig(DEFAULT_CONFIG[next]);
    setError(null);
  }

  async function submit() {
    setError(null);
    if (!name.trim()) {
      setError("Укажите название сервера");
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(config);
    } catch {
      setError("Конфиг — это JSON: проверьте синтаксис");
      return;
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      setError("Конфиг должен быть JSON-объектом {…}");
      return;
    }

    setSaving(true);
    try {
      const server = await api.createMcpServer({
        name: name.trim(),
        description: description.trim() || undefined,
        transport,
        config: parsed as Record<string, unknown>,
      });
      onCreated(server);
      toast.success(`Сервер «${server.name}» добавлен в реестр`, {
        description:
          server.runtimeStatus === "cli_missing"
            ? "Конфиг сохранён, но CLI не найден — это не «подключено»."
            : "Конфиг сохранён; запуск внешних серверов заработает в полной версии",
      });
      setOpen(false);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Не удалось добавить сервер",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm">
          <Plus className="size-4" aria-hidden="true" />
          Добавить сервер
        </Button>
      </DialogTrigger>
      <DialogContent className="gap-0 overflow-y-auto p-0 sm:max-w-lg">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Server className="size-4.5 text-primary" aria-hidden="true" />
            Свой MCP-сервер
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs leading-relaxed">
            Сервер попадёт в реестр интеграций с сохранённым конфигом.
            Запуск stdio/sse-серверов — в полной версии студии.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-5">
          <div className="space-y-2">
            <Label htmlFor="mcp-name">Название</Label>
            <Input
              id="mcp-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder="my-mcp-server"
              maxLength={60}
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mcp-description">Описание (необязательно)</Label>
            <Input
              id="mcp-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Что даёт этот сервер"
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label>Транспорт</Label>
            <div
              className="grid grid-cols-2 gap-2"
              role="group"
              aria-label="Транспорт сервера"
            >
              {(["stdio", "sse"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={transport === t}
                  onClick={() => pickTransport(t)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    transport === t
                      ? "border-primary/50 bg-primary/[0.06] text-foreground"
                      : "text-muted-foreground hover:border-primary/30 hover:text-foreground",
                  )}
                >
                  <span className="block font-mono font-semibold">{t}</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    {TRANSPORT_HINT[t]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mcp-config">JSON-конфиг</Label>
            <Textarea
              id="mcp-config"
              value={config}
              onChange={(e) => {
                setConfig(e.target.value);
                setError(null);
              }}
              rows={5}
              className="font-mono text-xs leading-relaxed"
              spellCheck={false}
              aria-describedby="mcp-config-hint"
            />
            <p id="mcp-config-hint" className="text-[11px] text-muted-foreground">
              {transport === "stdio"
                ? "command — исполняемый файл, args — массив аргументов, env — переменные"
                : "url — адрес SSE-эндпоинта (http/https)"}
            </p>
          </div>

          {error ? (
            <p className="text-xs text-rose-600 dark:text-rose-400" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={saving}
          >
            Отмена
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={saving}>
            {saving ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Plus className="size-4" aria-hidden="true" />
            )}
            Добавить в реестр
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
