"use client";

/**
 * DockerfileCard (Фаза D) — генератор Dockerfile для воркспейса с кодом.
 *
 * Кнопка «Сгенерировать» → POST /api/workspaces/[id]/dockerfile
 * (анализ package.json/файлов → Dockerfile + .dockerignore на диск).
 * Превью сгенерированного файла + честная пометка: сборка образа
 * в песочнице недоступна, файл готов к docker build в полной версии.
 */

import { useCallback, useState } from "react";
import {
  Check,
  Container,
  FileCode2,
  Loader2,
  RefreshCw,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import type { WorkspaceDto } from "@/lib/workspace-types";

export function DockerfileCard({ workspace }: { workspace: WorkspaceDto }) {
  const [kind, setKind] = useState<string | null>(null);
  const [dockerfile, setDockerfile] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const generate = useCallback(
    async (overwrite = false) => {
      setBusy(true);
      try {
        const res = await api.generateDockerfile(workspace.id, overwrite);
        setKind(res.kind);
        setDockerfile(res.dockerfile);
        toast.success(`Dockerfile готов — профиль: ${res.kind}`, {
          description:
            "Файлы Dockerfile и .dockerignore сохранены в корне проекта",
        });
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          // Уже есть — перегенерируем поверх по подтверждению.
          try {
            const res = await api.generateDockerfile(workspace.id, true);
            setKind(res.kind);
            setDockerfile(res.dockerfile);
            toast.success(`Dockerfile перезаписан — профиль: ${res.kind}`);
            return;
          } catch (retry) {
            toast.error(
              retry instanceof ApiError
                ? retry.message
                : "Не удалось перезаписать Dockerfile",
            );
            return;
          }
        }
        toast.error(
          err instanceof ApiError
            ? err.message
            : "Не удалось сгенерировать Dockerfile",
        );
      } finally {
        setBusy(false);
      }
    },
    [workspace.id],
  );

  return (
    <section
      aria-label="Dockerfile воркспейса"
      className="rounded-xl border bg-card p-4 shadow-sm sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Container
              className="size-4.5 shrink-0 text-primary"
              aria-hidden="true"
            />
            Dockerfile
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Генератор анализирует файлы проекта и пишет готовый к сборке
            Dockerfile в корень
          </p>
        </div>
        <Button
          type="button"
          variant={dockerfile ? "outline" : "default"}
          onClick={() => void generate(Boolean(dockerfile))}
          disabled={busy}
          className="shrink-0"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : dockerfile ? (
            <RefreshCw className="size-4" aria-hidden="true" />
          ) : (
            <Wand2 className="size-4" aria-hidden="true" />
          )}
          {dockerfile ? "Перегенерировать" : "Сгенерировать Dockerfile"}
        </Button>
      </div>

      {dockerfile ? (
        <div className="mt-4">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-700 dark:text-emerald-400">
              <Check className="size-3" aria-hidden="true" />
              Профиль: {kind}
            </span>
            <span className="inline-flex items-center gap-1">
              <FileCode2 className="size-3.5" aria-hidden="true" />
              Dockerfile + .dockerignore сохранены в проекте
            </span>
          </div>
          <pre className="overflow-x-auto vf-scroll rounded-lg bg-stone-950 p-4 font-mono text-xs leading-relaxed text-stone-300">
            <code>{dockerfile}</code>
          </pre>
          <p className="mt-2.5 text-xs text-muted-foreground">
            Сборка образа (docker build) — в полной версии студии: в песочнице
            нет Docker-демона. Файл уже в проекте — вкладка «Код» покажет его
            в дереве файлов.
          </p>
        </div>
      ) : (
        <p className="mt-3 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          Поддерживаемые профили: Next.js, Vite, Node.js, Python и статика —
          выберется автоматически по файлам воркспейса.
        </p>
      )}
    </section>
  );
}
