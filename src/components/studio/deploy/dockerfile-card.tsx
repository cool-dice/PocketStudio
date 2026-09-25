"use client";

/**
 * Dockerfile generator + local docker build. Surface is workspace (app
 * studio) or project (template/github/zip). Never a hosted publish.
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
import { api, ApiError, type DeploySurface } from "@/lib/api";
import {
  DOCKER_BUILD_LOCAL_ONLY,
  DOCKERFILE_NOT_PUBLISHED,
  DOCKERFILE_NOT_PUBLISHED_CODE,
  EMPTY_APP_BUILD_ERROR,
} from "@/lib/docker-copy";

export function DockerfileCard({
  targetId,
  surface,
}: {
  targetId: string;
  surface: DeploySurface;
}) {
  const [kind, setKind] = useState<string | null>(null);
  const [dockerfile, setDockerfile] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [building, setBuilding] = useState(false);
  const [buildLog, setBuildLog] = useState<string | null>(null);
  const [buildStatus, setBuildStatus] = useState<string | null>(null);
  const hint =
    surface === "project"
      ? DOCKERFILE_NOT_PUBLISHED_CODE
      : DOCKERFILE_NOT_PUBLISHED;

  const generate = useCallback(
    async (overwrite = false) => {
      setBusy(true);
      try {
        const res = await api.generateDockerfile(targetId, overwrite, surface);
        setKind(res.kind);
        setDockerfile(res.dockerfile);
        setBuildStatus(res.empty ? "empty" : "ready_zip");
        if (res.empty) {
          toast.message("Заготовка Dockerfile", {
            description: EMPTY_APP_BUILD_ERROR,
          });
        } else {
          toast.success(`Dockerfile готов — профиль: ${res.kind}`, {
            description: res.hint || hint,
          });
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          try {
            const res = await api.generateDockerfile(targetId, true, surface);
            setKind(res.kind);
            setDockerfile(res.dockerfile);
            setBuildStatus(res.empty ? "empty" : "ready_zip");
            toast.success(`Dockerfile перезаписан — профиль: ${res.kind}`, {
              description: res.empty
                ? EMPTY_APP_BUILD_ERROR
                : res.hint || hint,
            });
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
    [targetId, surface, hint],
  );

  async function buildImage() {
    setBuilding(true);
    setBuildLog(null);
    try {
      const res = await api.dockerBuild(targetId, surface);
      setBuildStatus(res.status);
      setBuildLog(res.log);
      if (res.status === "built" && !res.published) {
        toast.success("Образ собран локально", {
          description: DOCKER_BUILD_LOCAL_ONLY,
        });
      } else if (res.status === "unavailable") {
        toast.message("Docker недоступен", {
          description:
            "Команда для локальной сборки в логе. Образ не опубликован.",
        });
      } else if (res.status === "empty") {
        toast.message("Нечего собирать", { description: EMPTY_APP_BUILD_ERROR });
      } else {
        toast.error("Сборка не удалась");
      }
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Не удалось запустить docker build";
      if (err instanceof ApiError && err.status === 400) {
        setBuildStatus("empty");
        setBuildLog(message);
        toast.message("Нечего собирать", { description: message });
      } else {
        toast.error(message);
      }
    } finally {
      setBuilding(false);
    }
  }

  return (
    <section
      aria-label="Dockerfile"
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
            {surface === "project"
              ? "Пишем Dockerfile в корень код-проекта. Это не хост и не «опубликовано»."
              : "Пишем Dockerfile в корень приложения. Это не публикация образа."}
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
            <span className="inline-flex items-center gap-1 rounded-full border bg-muted px-2 py-0.5 font-medium">
              <Check className="size-3" aria-hidden="true" />
              Профиль: {kind}
            </span>
            <span className="inline-flex items-center gap-1">
              <FileCode2 className="size-3.5" aria-hidden="true" />
              {hint}
            </span>
            {buildStatus ? (
              <span className="rounded-full border px-2 py-0.5 font-mono">
                {buildStatus}
              </span>
            ) : null}
          </div>
          <pre className="overflow-x-auto vf-scroll rounded-lg bg-stone-950 p-4 font-mono text-xs leading-relaxed text-stone-300">
            <code>{dockerfile}</code>
          </pre>
          <p className="mt-2.5 text-xs text-muted-foreground">
            «Собрать образ» — локальный docker build. Без демона покажем команду.
            URL хоста не появится.
          </p>
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
          {buildLog ? (
            <pre className="mt-3 max-h-48 overflow-auto rounded-lg bg-stone-950 p-3 font-mono text-[11px] text-stone-300">
              {buildStatus}: {buildLog}
            </pre>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          Профили: Next.js, Vite, Node.js, Python и статика — по файлам на диске.
        </p>
      )}
    </section>
  );
}
