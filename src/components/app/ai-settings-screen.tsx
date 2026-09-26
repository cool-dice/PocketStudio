"use client";

/**
 * User AI settings — own BYOK providers and per-tool model choice.
 */

import { useCallback, useEffect, useState } from "react";
import { KeyRound, Loader2, Menu, Plus, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { ProviderCard } from "@/components/app/admin-ai-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import type { UserAiSettingsDto } from "@/lib/types";

const EMPTY = {
  kind: "openai_compatible",
  name: "",
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
};

export function AiSettingsScreen({
  onOpenMobileNav,
}: {
  onOpenMobileNav: () => void;
}) {
  const [data, setData] = useState<UserAiSettingsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    const next = await api.userAiSettings();
    setData(next);
    setLoadError(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await reload();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Не удалось загрузить настройки";
        if (!cancelled) setLoadError(message);
        toast.error(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const create = async () => {
    setSaving(true);
    try {
      await api.userCreateAiProvider({
        kind: form.kind,
        name: form.name,
        baseUrl: form.baseUrl,
        apiKey: form.apiKey,
      });
      setForm(EMPTY);
      toast.success("Провайдер добавлен");
      await reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  const modelOptions = [
    ...(data?.platformProviders ?? []).flatMap((p) =>
      p.models.filter((m) => m.enabled).map((m) => ({
        id: m.id,
        label: `Студия · ${p.name} · ${m.displayName}`,
      })),
    ),
    ...(data?.ownProviders ?? []).flatMap((p) =>
      p.models.filter((m) => m.enabled).map((m) => ({
        id: m.id,
        label: `Мой · ${p.name} · ${m.displayName}`,
      })),
    ),
  ];

  return (
    <section
      aria-label="Настройки ИИ"
      className="flex min-w-0 flex-1 flex-col bg-background"
    >
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-3 sm:px-4">
        <Button
          variant="ghost"
          size="icon"
          className="size-9 md:hidden"
          onClick={onOpenMobileNav}
          aria-label="Открыть меню"
        >
          <Menu className="size-4" />
        </Button>
        <h1 className="truncate text-sm font-semibold sm:text-[15px]">
          Настройки ИИ
        </h1>
      </header>

      <div className="vf-scroll min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
          {loading ? (
            <div
              className="h-48 animate-pulse rounded-2xl border bg-muted/40"
              role="status"
              aria-label="Загрузка настроек ИИ"
            />
          ) : loadError ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card p-10 text-center">
              <p className="text-sm text-muted-foreground">{loadError}</p>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => {
                  setLoading(true);
                  void reload()
                    .catch((err) => {
                      setLoadError(
                        err instanceof Error
                          ? err.message
                          : "Не удалось загрузить настройки",
                      );
                    })
                    .finally(() => setLoading(false));
                }}
              >
                <RefreshCw className="size-4" aria-hidden="true" />
                Повторить
              </Button>
            </div>
          ) : !data ? (
            <div
              className="h-48 animate-pulse rounded-2xl border bg-muted/40"
              role="status"
              aria-label="Загрузка настроек ИИ"
            />
          ) : (
            <>
              <section className="rounded-2xl border bg-card p-4 sm:p-6">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <Sparkles className="size-4 text-primary" />
                  Модели инструментов
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  «Студия (по умолчанию)» — то, что настроил администратор.
                  Можно выбрать платформенный прокси или свой ключ.
                </p>
                <ul className="mt-4 space-y-2">
                  {data.tools.map((tool) => (
                    <li
                      key={tool.id}
                      className="flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{tool.label}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {tool.description}
                        </p>
                      </div>
                      <select
                        value={tool.useStudioDefault ? "" : tool.modelId ?? ""}
                        onChange={(e) => {
                          const value = e.target.value;
                          void api
                            .userSetToolModel(tool.id, value ? value : null)
                            .then(() => reload())
                            .catch((err) =>
                              toast.error(
                                err instanceof Error
                                  ? err.message
                                  : "Не удалось сохранить",
                              ),
                            );
                        }}
                        className="h-9 rounded-xl border bg-background px-3 text-sm sm:min-w-64"
                      >
                        <option value="">Студия (по умолчанию)</option>
                        {modelOptions.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="rounded-2xl border bg-card p-4 sm:p-6">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <Sparkles className="size-4 text-primary" />
                  RAG / канон
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Переиндексировать заметки, главы, сущности, код и скиллы
                  для поиска в чате. Нужна модель для инструмента «Эмбеддинги».
                  Главный чат видит все воркспейсы; чат воркспейса — только его.
                </p>
                <ReindexButton onDone={reload} />
              </section>

              <section className="rounded-2xl border bg-card p-4 sm:p-6">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <KeyRound className="size-4 text-primary" />
                  Свой провайдер (BYOK)
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Ключ остаётся на сервере и не уходит в браузер после сохранения.
                  Примеры URL: https://api.openai.com/v1 · https://api.anthropic.com ·
                  https://api.groq.com/openai/v1
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Название, напр. Мой OpenAI"
                    className="h-9 rounded-xl"
                  />
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
                    className="h-9 rounded-xl border bg-background px-3 text-sm"
                  >
                    <option value="openai_compatible">OpenAI-совместимый</option>
                    <option value="anthropic_compatible">Anthropic-совместимый</option>
                  </select>
                  <Input
                    value={form.baseUrl}
                    onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                    placeholder="https://api.openai.com/v1"
                    className="h-9 rounded-xl font-mono text-xs sm:col-span-2"
                  />
                  <Input
                    type="password"
                    value={form.apiKey}
                    onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                    placeholder="API-ключ"
                    className="h-9 rounded-xl sm:col-span-2"
                    autoComplete="off"
                  />
                </div>
                <Button
                  size="sm"
                  className="mt-3 rounded-xl"
                  disabled={saving || !form.name.trim() || !form.apiKey.trim()}
                  onClick={() => void create()}
                >
                  {saving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                  Добавить
                </Button>
              </section>

              {data.ownProviders.map((p) => (
                <ProviderCard
                  key={p.id}
                  provider={p}
                  onChange={reload}
                  admin={false}
                />
              ))}

              {data.platformProviders.length > 0 && (
                <section className="rounded-2xl border bg-card p-4 sm:p-6">
                  <h2 className="text-sm font-semibold">Провайдеры студии</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Мы проксируем эти модели своими ключами. Можно выбрать их для
                    инструментов выше.
                  </p>
                  <ul className="mt-3 space-y-2">
                    {data.platformProviders.map((p) => (
                      <li key={p.id} className="rounded-xl border px-3 py-2 text-sm">
                        <p className="font-medium">{p.name}</p>
                        <p className="font-mono text-[11px] text-muted-foreground">
                          {p.baseUrl}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {p.models.map((m) => m.displayName).join(" · ") || "нет моделей"}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function ReindexButton({ onDone }: { onDone: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      className="mt-4 gap-1.5 rounded-xl"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void api
          .reindexRag()
          .then((r) => {
            toast.success(r.message ?? "Канон переиндексирован");
            return onDone();
          })
          .catch((err) =>
            toast.error(
              err instanceof ApiError ? err.message : "Не удалось переиндексировать",
            ),
          )
          .finally(() => setBusy(false));
      }}
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
      {busy ? "Индексируем…" : "Переиндексировать"}
    </Button>
  );
}
