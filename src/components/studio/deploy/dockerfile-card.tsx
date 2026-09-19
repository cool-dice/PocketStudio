"use client";

/**
 * DockerfileCard (Фаза D) — генератор Dockerfile для воркспейса с кодом.
 *
 * Кнопка «Сгенерировать» → POST /api/workspaces/[id]/dockerfile
 * (анализ package.json/файлов → Dockerfile + .dockerignore на диск).
 * «Собрать образ» вызывает docker build; если демона нет — честный
 * статус unavailable и команда для локальной машины.
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
  const [building, setBuilding] = useState(false);
  const [buildLog, setBuildLog] = useState<string | null>(null);
  const [buildStatus, setBuildStatus] = useState<string | null>(null);

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

  async function buildImage() {
    setBuilding(true);
    setBuildLog(null);
    try {
      const res = await api.dockerBuild(workspace.id);
      setBuildStatus(res.status);
      setBuildLog(res.log);
      if (res.status === "built") {
        toast.success("Образ собран", { description: res.imageTag ?? undefined });
      } else if (res.status === "unavailable") {
        toast.message("Docker недоступен", { description: "Команда для локальной сборки в логе." });
      } else {
        toast.error("Сборка не удалась");
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Не удалось запустить docker build");
    } finally {
      setBuilding(false);
    }
  }

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
            Нажмите «Собрать образ»: если docker есть — выполним build, иначе
            покажем точную команду для локальной машины.
          </p>
          {dockerfile ? (
            <Button
              className="mt-3"
              variant="outline"
              size="sm"
              disabled={building}
              onClick={() => void buildImage()}
            >
              {building ? <Loader2 className="size-4 animate-spin" /> : null}
              Собрать образ
            </Button>
          ) : null}
          {buildLog ? (
            <pre className="mt-3 max-h-48 overflow-auto rounded-lg bg-stone-950 p-3 font-mono text-[11px] text-stone-300">
              {buildStatus}: {buildLog}
            </pre>
          ) : null}
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
