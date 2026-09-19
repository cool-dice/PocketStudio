"use client";

/**
 * DeployScreen (5-c) — «Экспорт и публикация».
 *
 * Честно: деплой в облако в песочнице недоступен (задел на будущее —
 * домены, сборка, релизы). Рабочая часть — экспорт воркспейса в ZIP
 * со всеми реальными артефактами: GET /api/workspaces/[id]/export
 * (медиа-файлы + manifest, документы .md, сущности, находки, README).
 *
 * Вкладка воркспейса (workspaceId) и глобальный экран с чипами.
 */

import { useCallback, useEffect, useState } from "react";
import {
  CloudOff,
  FileArchive,
  Loader2,
  Rocket,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import { SelectableChip } from "@/components/studio/images/chip";
import {
  ModuleHeader,
  type ModuleScreenProps,
} from "@/components/studio/shared/module-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";
import { useAppUi } from "@/lib/store";
import { WORKSPACE_TYPE_META } from "@/lib/workspace-data";
import type { WorkspaceDto } from "@/lib/workspace-types";
import type { ProjectListItem } from "@/lib/types";
import { DockerfileCard } from "./dockerfile-card";
import { ReadinessCard } from "./readiness-card";
import { FileCode2 } from "lucide-react";

/** Транслитерация RU → lat для имени скачиваемого файла. */
const RU_MAP: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh",
  щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

function fileSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .split("")
    .map((ch) => RU_MAP[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  return slug || "workspace";
}

export function DeployScreen({
  onOpenMobileNav,
  workspaceId,
}: ModuleScreenProps & { workspaceId?: string }) {
  /* Глобальный экран без воркспейса: список воркспейсов + код-проектов. */
  const [workspaces, setWorkspaces] = useState<WorkspaceDto[] | null>(null);
  const [codeProjects, setCodeProjects] = useState<ProjectListItem[]>([]);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const effectiveId = workspaceId ?? pickedId;

  /* Готовность выбранного воркспейса. */
  const [workspace, setWorkspace] = useState<WorkspaceDto | null>(null);
  const [entitiesCount, setEntitiesCount] = useState<number | null>(null);
  const [openFindings, setOpenFindings] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const setMainArea = useAppUi((s) => s.setMainArea);

  /* Загрузка списка воркспейсов и код-проектов для глобального экрана. */
  useEffect(() => {
    if (workspaceId) return;
    let cancelled = false;
    api
      .listWorkspaces()
      .then((ws) => {
        if (!cancelled) setWorkspaces(ws);
      })
      .catch(() => {
        if (!cancelled) setWorkspaces([]);
      });
    api
      .listProjects()
      .then((projects) => {
        if (!cancelled) {
          // Тип ProjectOrigin не знает origin «workspace» (контентные
          // воркспейсы), но API их возвращает — фильтруем по строке.
          setCodeProjects(
            projects.filter((p) => String(p.origin) !== "workspace"),
          );
        }
      })
      .catch(() => {
        // код-проекты — необязательная часть списка
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  /* Готовность: воркспейс + сущности + открытые находки. */
  const loadReadiness = useCallback(async () => {
    if (!effectiveId) {
      setWorkspace(null);
      setEntitiesCount(null);
      setOpenFindings(null);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const [ws, entities, findings] = await Promise.all([
        api.getWorkspace(effectiveId),
        api.listEntities(effectiveId),
        api.listFindings(effectiveId, "open"),
      ]);
      setWorkspace(ws);
      setEntitiesCount(entities.length);
      setOpenFindings(findings.length);
    } catch (err) {
      setWorkspace(null);
      setEntitiesCount(null);
      setOpenFindings(null);
      setLoadError(
        err instanceof ApiError ? err.message : "Не удалось загрузить данные",
      );
    } finally {
      setLoading(false);
    }
  }, [effectiveId]);

  useEffect(() => {
    void loadReadiness();
  }, [loadReadiness]);

  /* Рабочий экспорт: fetch → blob → download. */
  const downloadZip = useCallback(async () => {
    if (!effectiveId || exporting) return;
    setExporting(true);
    try {
      const blob = await api.exportWorkspaceZip(effectiveId);
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `${fileSlug(workspace?.name ?? "workspace")}-export.zip`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
      toast.success("Архив воркспейса готов", {
        description: "Все артефакты, документы и данные внутри",
      });
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Не удалось собрать архив",
      );
    } finally {
      setExporting(false);
    }
  }, [effectiveId, exporting, workspace]);

  const showContent = Boolean(effectiveId);

  return (
    <section
      aria-label="Экспорт и публикация"
      className="flex h-full min-w-0 flex-1 flex-col bg-background"
    >
      <ModuleHeader
        icon={Rocket}
        title="Экспорт и публикация"
        description="Честный экспорт воркспейса: ZIP со всеми реальными артефактами"
        stage="beta"
        onOpenMobileNav={onOpenMobileNav}
      />

      <main className="vf-scroll flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
        {/* Честная карточка: что доступно в песочнице. */}
        <section
          aria-label="О деплое в песочнице"
          className="rounded-xl border border-dashed bg-card p-4 sm:p-6"
        >
          <div className="flex items-start gap-3">
            <span
              className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
              aria-hidden="true"
            >
              <CloudOff className="size-4.5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold">
                Деплой в облако — за пределами песочницы
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Карманная студия работает в изолированной среде без внешних
                доменов и реестров. В полноценной версии здесь будут: домены,
                сборка, релизы и откаты. Сейчас — рабочий экспорт всего
                воркспейса в ZIP.
              </p>
            </div>
          </div>
        </section>

        {/* Глобальный экран: выбор воркспейса чипами. */}
        {!workspaceId ? (
          <section
            aria-label="Выбор воркспейса"
            className="rounded-xl border bg-card p-4"
          >
            <h2 className="text-sm font-medium">Какой воркспейс экспортируем?</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Готовность и экспорт живут внутри воркспейса — выберите нужный.
            </p>
            {workspaces === null ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {Array.from({ length: 4 }, (_, i) => (
                  <Skeleton key={i} className="h-8 w-36 rounded-full" />
                ))}
              </div>
            ) : workspaces.length === 0 && codeProjects.length === 0 ? (
              <div className="mt-4 flex flex-col items-start gap-3 rounded-xl border border-dashed p-4">
                <p className="text-sm text-muted-foreground">
                  Пока нет ни одного воркспейса — сначала создайте его.
                </p>
                <Button size="sm" onClick={() => setMainArea("workspaces")}>
                  <Rocket className="size-4" aria-hidden="true" />
                  К воркспейсам
                </Button>
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {workspaces.map((ws) => {
                  const Meta = WORKSPACE_TYPE_META[ws.type];
                  const Icon = Meta.icon;
                  return (
                    <SelectableChip
                      key={ws.id}
                      label={ws.name}
                      icon={Icon}
                      selected={pickedId === ws.id}
                      count={ws.progress}
                      onClick={() =>
                        setPickedId(pickedId === ws.id ? null : ws.id)
                      }
                      className="max-w-full"
                    />
                  );
                })}
                {codeProjects.map((p) => (
                  <SelectableChip
                    key={p.id}
                    label={p.name}
                    icon={FileCode2}
                    selected={pickedId === p.id}
                    onClick={() =>
                      setPickedId(pickedId === p.id ? null : p.id)
                    }
                    className="max-w-full"
                  />
                ))}
              </div>
            )}
          </section>
        ) : null}

        {!showContent ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-center">
            <FileArchive
              className="size-8 text-muted-foreground/50"
              aria-hidden="true"
            />
            <p className="text-sm text-muted-foreground">
              Выберите воркспейс — покажем готовность и экспорт
            </p>
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center">
            <p className="text-sm text-muted-foreground">{loadError}</p>
            <Button size="sm" variant="outline" onClick={() => void loadReadiness()}>
              Повторить
            </Button>
          </div>
        ) : (
          <>
            <ReadinessCard
              workspace={workspace}
              entitiesCount={entitiesCount}
              openFindings={openFindings}
              loading={loading}
            />

            {/* Dockerfile для воркспейсов с кодом (Фаза D). */}
            {workspace && workspace.origin !== "workspace" ? (
              <DockerfileCard workspace={workspace} />
            ) : null}

            {/* Главный экран действия: экспорт ZIP. */}
            <section
              aria-label="Экспорт воркспейса"
              className="rounded-xl border bg-card p-4 shadow-sm sm:p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold">
                    Скачать ZIP воркспейса
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Архив собирается на сервере из реальных данных — без моков
                  </p>
                </div>
                <Button
                  type="button"
                  size="lg"
                  onClick={() => void downloadZip()}
                  disabled={exporting}
                  className="min-w-44"
                >
                  {exporting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      Собираем архив…
                    </>
                  ) : (
                    <>
                      <FileArchive className="size-4" aria-hidden="true" />
                      Скачать ZIP воркспейса
                    </>
                  )}
                </Button>
              </div>

              <ul className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                <li className="flex items-start gap-2 rounded-lg border bg-background/60 p-2.5">
                  <ShieldCheck
                    className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                    aria-hidden="true"
                  />
                  artifacts/ — все артефакты: медиа-файлы и manifest.json
                </li>
                <li className="flex items-start gap-2 rounded-lg border bg-background/60 p-2.5">
                  <ShieldCheck
                    className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                    aria-hidden="true"
                  />
                  documents/ — рукописи и спеки как .md по секциям
                </li>
                <li className="flex items-start gap-2 rounded-lg border bg-background/60 p-2.5">
                  <ShieldCheck
                    className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                    aria-hidden="true"
                  />
                  entities.json и findings.json — картотека и находки
                </li>
                <li className="flex items-start gap-2 rounded-lg border bg-background/60 p-2.5">
                  <ShieldCheck
                    className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                    aria-hidden="true"
                  />
                  README.md — сводка: стадия, прогресс и состав архива
                </li>
              </ul>
            </section>
          </>
        )}
      </main>
    </section>
  );
}
