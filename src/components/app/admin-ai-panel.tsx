"use client";

/**
 * Admin AI panel — CRUD platform providers, models, and per-tool defaults.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Loader2,
  PlugZap,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api, ApiError } from "@/lib/api";
import type { AiModelDto, AiProviderDto, AiToolDefaultDto } from "@/lib/types";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<string, string> = {
  openai_compatible: "OpenAI-совместимый",
  anthropic_compatible: "Anthropic-совместимый",
};

const EMPTY_PROVIDER = {
  kind: "openai_compatible",
  name: "",
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  enabled: true,
  visibleToUsers: true,
  markupPercent: "" as string,
};

export function AdminAiPanel() {
  const [providers, setProviders] = useState<AiProviderDto[]>([]);
  const [defaults, setDefaults] = useState<AiToolDefaultDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_PROVIDER);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    const [p, d] = await Promise.all([
      api.adminAiProviders(),
      api.adminAiDefaults(),
    ]);
    setProviders(p);
    setDefaults(d);
    setLoadError(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await reload();
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "Не удалось загрузить модели";
          setLoadError(message);
          toast.error(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const createProvider = async () => {
    setSaving(true);
    try {
      const markup = form.markupPercent.trim()
        ? Number(form.markupPercent)
        : null;
      await api.adminCreateAiProvider({
        kind: form.kind,
        name: form.name,
        baseUrl: form.baseUrl,
        apiKey: form.apiKey,
        enabled: form.enabled,
        visibleToUsers: form.visibleToUsers,
        markupPercent: Number.isFinite(markup) ? markup : null,
      });
      setForm(EMPTY_PROVIDER);
      toast.success("Провайдер сохранён");
      await reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  const allModels = providers.flatMap((p) =>
    p.models.map((m) => ({ ...m, providerName: p.name, kind: p.kind })),
  );

  if (loading) {
    return (
      <div
        className="h-40 animate-pulse rounded-2xl border bg-muted/40"
        role="status"
        aria-label="Загрузка провайдеров ИИ"
      />
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card p-10 text-center">
        <p className="text-sm text-muted-foreground">{loadError}</p>
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl"
          onClick={() => {
            setLoading(true);
            void reload().finally(() => setLoading(false));
          }}
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          Повторить
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-card p-4 sm:p-6">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Платформенные провайдеры</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Ключи хранятся на сервере. Студия проксирует запросы с вашей наценкой.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-9 rounded-xl"
            onClick={() => {
              void reload().catch((err) =>
                toast.error(
                  err instanceof Error ? err.message : "Не удалось обновить",
                ),
              );
            }}
            aria-label="Обновить"
          >
            <RefreshCw className="size-4" />
          </Button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Название">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="OpenAI · студия"
              className="h-9 rounded-xl"
            />
          </Field>
          <Field label="Тип">
            <select
              value={form.kind}
              onChange={(e) => {
                const kind = e.target.value;
                setForm({
                  ...form,
                  kind,
                  baseUrl:
                    kind === "anthropic_compatible"
                      ? "https://api.anthropic.com"
                      : "https://api.openai.com/v1",
                });
              }}
              className="h-9 w-full rounded-xl border bg-background px-3 text-sm"
            >
              <option value="openai_compatible">OpenAI-совместимый</option>
              <option value="anthropic_compatible">Anthropic-совместимый</option>
            </select>
          </Field>
          <Field label="Base URL" className="sm:col-span-2">
            <Input
              value={form.baseUrl}
              onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
              placeholder="https://api.openai.com/v1"
              className="h-9 rounded-xl font-mono text-xs"
            />
          </Field>
          <Field label="API-ключ">
            <Input
              type="password"
              value={form.apiKey}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
              placeholder="sk-…"
              className="h-9 rounded-xl"
              autoComplete="off"
            />
          </Field>
          <Field label="Наценка, %">
            <Input
              type="number"
              min={0}
              value={form.markupPercent}
              onChange={(e) => setForm({ ...form, markupPercent: e.target.value })}
              placeholder="0"
              className="h-9 rounded-xl"
            />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-xs">
            <Switch
              checked={form.enabled}
              onCheckedChange={(v) => setForm({ ...form, enabled: v })}
            />
            включён
          </label>
          <label className="flex items-center gap-2 text-xs">
            <Switch
              checked={form.visibleToUsers}
              onCheckedChange={(v) => setForm({ ...form, visibleToUsers: v })}
            />
            виден пользователям
          </label>
          <Button
            size="sm"
            className="ml-auto rounded-xl"
            disabled={saving || !form.name.trim() || !form.apiKey.trim()}
            onClick={() => void createProvider()}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Добавить провайдера
          </Button>
        </div>
      </section>

      {providers.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Пока нет провайдеров — добавьте OpenAI, Anthropic, Groq или локальный llama.cpp
        </p>
      ) : (
        providers.map((p) => (
          <ProviderCard
            key={p.id}
            provider={p}
            onChange={reload}
            admin
          />
        ))
      )}

      <section className="rounded-2xl border bg-card p-4 sm:p-6">
        <h2 className="text-sm font-semibold">Модели по умолчанию</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Какой модели студия вызывает каждый инструмент, если пользователь ничего не выбрал
        </p>
        <ul className="mt-4 space-y-2">
          {defaults.map((d) => (
            <li
              key={d.toolId}
              className="flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{d.label}</p>
                <p className="text-[11px] text-muted-foreground">{d.capability}</p>
              </div>
              <select
                value={d.modelId ?? ""}
                onChange={(e) => {
                  const modelId = e.target.value;
                  if (!modelId) return;
                  void api
                    .adminSetAiDefault(d.toolId, modelId)
                    .then(() => {
                      toast.success("Назначение сохранено");
                      return reload();
                    })
                    .catch((err) =>
                      toast.error(
                        err instanceof Error ? err.message : "Не удалось сохранить",
                      ),
                    );
                }}
                className="h-9 max-w-full rounded-xl border bg-background px-3 text-sm sm:min-w-64"
              >
                <option value="">
                  {d.model
                    ? `${d.model.providerName} · ${d.model.displayName}`
                    : "не назначено"}
                </option>
                {allModels
                  .filter((m) => m.enabled)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.providerName} · {m.displayName} ({m.modelId})
                    </option>
                  ))}
              </select>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("grid gap-1.5", className)}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export function ProviderCard({
  provider,
  onChange,
  admin,
}: {
  provider: AiProviderDto;
  onChange: () => Promise<void>;
  admin: boolean;
}) {
  const [modelId, setModelId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [caps, setCaps] = useState({
    capChat: true,
    capImage: false,
    capTts: false,
    capAsr: false,
    capEmbeddings: false,
  });
  const [testing, setTesting] = useState(false);
  const [busy, setBusy] = useState(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const createModel = async () => {
    setBusy(true);
    try {
      if (admin) {
        await api.adminCreateAiModel(provider.id, {
          modelId,
          displayName: displayName || modelId,
          ...caps,
        });
      } else {
        await api.userCreateAiModel(provider.id, {
          modelId,
          displayName: displayName || modelId,
          ...caps,
        });
      }
      setModelId("");
      setDisplayName("");
      toast.success("Модель добавлена");
      await onChange();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Не удалось добавить модель");
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      const result = admin
        ? await api.adminTestAiProvider(provider.id)
        : await api.userTestAiProvider(provider.id);
      if (mountedRef.current) toast.success(result.detail);
    } catch (err) {
      if (mountedRef.current) {
        toast.error(err instanceof ApiError ? err.message : "Проверка не удалась");
      }
    } finally {
      if (mountedRef.current) setTesting(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      if (admin) await api.adminDeleteAiProvider(provider.id);
      else await api.userDeleteAiProvider(provider.id);
      toast.success("Провайдер удалён");
      await onChange();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Не удалось удалить");
    } finally {
      setBusy(false);
    }
  };

  const toggleEnabled = async (enabled: boolean) => {
    try {
      if (admin) await api.adminUpdateAiProvider(provider.id, { enabled });
      else await api.userUpdateAiProvider(provider.id, { enabled });
      await onChange();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Не удалось обновить");
    }
  };

  return (
    <div className="rounded-2xl border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
            <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
            {provider.name}
            <Badge variant="secondary" className="rounded-full px-1.5 text-[10px]">
              {KIND_LABEL[provider.kind] ?? provider.kind}
            </Badge>
            {!provider.enabled && (
              <Badge variant="outline" className="rounded-full px-1.5 text-[10px]">
                выключен
              </Badge>
            )}
          </p>
          <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
            {provider.baseUrl}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            ключ {provider.apiKeyMasked}
            {admin && provider.markupPercent != null
              ? ` · наценка ${provider.markupPercent}%`
              : ""}
            {admin && provider.visibleToUsers ? " · виден пользователям" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={provider.enabled}
            onCheckedChange={(v) => void toggleEnabled(v)}
            aria-label="Включён"
          />
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl"
            disabled={testing}
            onClick={() => void test()}
          >
            {testing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <PlugZap className="size-4" />
            )}
            Проверить
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-9 rounded-xl text-destructive"
            disabled={busy}
            onClick={() => void remove()}
            aria-label="Удалить провайдера"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <ul className="mt-3 space-y-1.5">
        {provider.models.length === 0 ? (
          <li className="text-xs text-muted-foreground">Моделей пока нет</li>
        ) : (
          provider.models.map((m) => (
            <ModelRow key={m.id} model={m} admin={admin} onChange={onChange} />
          ))
        )}
      </ul>

      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <Input
          value={modelId}
          onChange={(e) => setModelId(e.target.value)}
          placeholder="id модели, gpt-4o-mini"
          className="h-9 rounded-xl font-mono text-xs"
        />
        <Input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Отображаемое имя"
          className="h-9 rounded-xl"
        />
        <Button
          size="sm"
          className="h-9 rounded-xl"
          disabled={busy || !modelId.trim()}
          onClick={() => void createModel()}
        >
          Добавить модель
        </Button>
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
        {(
          [
            ["capChat", "чат"],
            ["capImage", "картинки"],
            ["capTts", "озвучка"],
            ["capAsr", "речь"],
            ["capEmbeddings", "эмбеддинги"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="inline-flex items-center gap-1.5">
            <Checkbox
              checked={caps[key]}
              onCheckedChange={(v) =>
                setCaps((c) => ({ ...c, [key]: v === true }))
              }
            />
            {label}
          </label>
        ))}
      </div>
    </div>
  );
}

function ModelRow({
  model,
  admin,
  onChange,
}: {
  model: AiModelDto;
  admin: boolean;
  onChange: () => Promise<void>;
}) {
  const caps = [
    model.capChat && "чат",
    model.capImage && "картинки",
    model.capTts && "озвучка",
    model.capAsr && "речь",
    model.capEmbeddings && "эмбеддинги",
  ].filter(Boolean);

  return (
    <li className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm">
      <span className="min-w-0 flex-1 truncate">
        <span className="font-medium">{model.displayName}</span>
        <span className="ml-1.5 font-mono text-[11px] text-muted-foreground">
          {model.modelId}
        </span>
      </span>
      <span className="hidden text-[11px] text-muted-foreground sm:inline">
        {caps.join(" · ") || "нет возможностей"}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="size-7 rounded-lg text-destructive"
        aria-label="Удалить модель"
        onClick={() => {
          void (admin ? api.adminDeleteAiModel(model.id) : api.userDeleteAiModel(model.id))
            .then(() => onChange())
            .catch((err) =>
              toast.error(err instanceof Error ? err.message : "Не удалось удалить"),
            );
        }}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </li>
  );
}

export { Label };
