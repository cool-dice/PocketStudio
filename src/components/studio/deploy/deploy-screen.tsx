"use client";

/**
 * DeployScreen — ZIP export + local Dockerfile/docker build.
 * Studios use /api/workspaces; code apps use /api/projects.
 * No invented host URL; empty is not «собрано».
 */

import { useCallback, useEffect, useState } from "react";
import {
  CloudOff,
  FileArchive,
  FileCode2,
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
import { WorkspacePickerStatus } from "@/components/studio/shared/workspace-picker-status";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { isCodeProjectOrigin } from "@/lib/code-project-origins";
import {
  DEPLOY_CODE_READY_HINT,
  DEPLOY_CODE_ZIP_HINT,
  DEPLOY_CODE_ZIP_TITLE,
  DEPLOY_PICKER_HINT,
  DEPLOY_PICKER_TITLE,
  DEPLOY_SANDBOX_BLURB,
  DEPLOY_SCREEN_DESCRIPTION,
  DEPLOY_SCREEN_TITLE,
  DEPLOY_STUDIO_ZIP_HINT,
  DEPLOY_STUDIO_ZIP_TITLE,
} from "@/lib/docker-copy";
import type { ProjectListItem } from "@/lib/types";
import { WORKSPACE_TYPE_META } from "@/lib/workspace-data";
import type { WorkspaceDto } from "@/lib/workspace-types";
import { DockerfileCard } from "./dockerfile-card";
import { ReadinessCard } from "./readiness-card";

const RU_MAP: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh",
  щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

function fileSlug(name: string, fallback: string): string {
  const slug = name
    .toLowerCase()
    .split("")
    .map((ch) => RU_MAP[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  return slug || fallback;
}

export function DeployScreen({
  onOpenMobileNav,
  workspaceId,
}: ModuleScreenProps & { workspaceId?: string }) {
  const { workspaces, loading: wsLoading, error: wsError, load: loadWorkspaces } =
    useWorkspaces();
  const [codeProjects, setCodeProjects] = useState<ProjectListItem[]>([]);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const effectiveId = workspaceId ?? pickedId;

  const [workspace, setWorkspace] = useState<WorkspaceDto | null>(null);
  const [codeTarget, setCodeTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [entitiesCount, setEntitiesCount] = useState<number | null>(null);
  const [openFindings, setOpenFindings] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (workspaceId) return;
    let cancelled = false;
    api
      .listProjects()
      .then((projects) => {
        if (!cancelled) {
          setCodeProjects(
            projects.filter((p) => isCodeProjectOrigin(String(p.origin))),
          );
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const isCodePick =
    !workspaceId && codeProjects.some((p) => p.id === effectiveId);

  const loadReadiness = useCallback(async () => {
    if (!effectiveId) {
      setWorkspace(null);
      setCodeTarget(null);
      setEntitiesCount(null);
      setOpenFindings(null);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      if (isCodePick) {
        const project = await api.getProject(effectiveId);
        setCodeTarget({ id: project.id, name: project.name });
        setWorkspace(null);
        setEntitiesCount(null);
        setOpenFindings(null);
        return;
      }
      const [ws, entities, findings] = await Promise.all([
        api.getWorkspace(effectiveId),
        api.listEntities(effectiveId),
        api.listFindings(effectiveId, "open"),
      ]);
      setWorkspace(ws);
      setCodeTarget(null);
      setEntitiesCount(entities.length);
      setOpenFindings(findings.length);
    } catch (err) {
      setWorkspace(null);
      setCodeTarget(null);
      setEntitiesCount(null);
      setOpenFindings(null);
      setLoadError(
        err instanceof ApiError ? err.message : "Не удалось загрузить данные",
      );
    } finally {
      setLoading(false);
    }
  }, [effectiveId, isCodePick]);

  useEffect(() => {
    void loadReadiness();
  }, [loadReadiness]);

  const downloadZip = useCallback(async () => {
    if (!effectiveId || exporting) return;
    setExporting(true);
    const asCode = Boolean(codeTarget);
    try {
      const blob = asCode
        ? await api.exportProjectZip(effectiveId)
        : await api.exportWorkspaceZip(effectiveId);
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      const name = asCode ? codeTarget?.name : workspace?.name;
      anchor.download = `${fileSlug(name ?? "export", asCode ? "project" : "workspace")}-export.zip`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
      toast.success(asCode ? "Архив код-проекта готов" : "Архив воркспейса готов", {
        description: asCode
          ? "Исходники с диска. Это не публикация."
          : "Артефакты, документы и данные внутри",
      });
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Не удалось собрать архив",
      );
    } finally {
      setExporting(false);
    }
  }, [effectiveId, exporting, workspace, codeTarget]);

  const showContent = Boolean(effectiveId);
  const zipTitle = codeTarget ? DEPLOY_CODE_ZIP_TITLE : DEPLOY_STUDIO_ZIP_TITLE;
  const zipHint = codeTarget ? DEPLOY_CODE_ZIP_HINT : DEPLOY_STUDIO_ZIP_HINT;

  return (
    <section
      aria-label={DEPLOY_SCREEN_TITLE}
      className="flex h-full min-w-0 flex-1 flex-col bg-background"
    >
      <ModuleHeader
        icon={Rocket}
        title={DEPLOY_SCREEN_TITLE}
        description={DEPLOY_SCREEN_DESCRIPTION}
        stage="beta"
        onOpenMobileNav={onOpenMobileNav}
      />

      <main className="vf-scroll flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
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
                Облачного хоста нет
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {DEPLOY_SANDBOX_BLURB}
              </p>
            </div>
          </div>
        </section>

        {!workspaceId ? (
          <section aria-label="Выбор цели" className="rounded-xl border bg-card p-4">
            <h2 className="text-sm font-medium">{DEPLOY_PICKER_TITLE}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{DEPLOY_PICKER_HINT}</p>
            <WorkspacePickerStatus
              loading={!workspaceId && wsLoading}
              error={!workspaceId && wsError}
              empty={
                !workspaceId &&
                !wsLoading &&
                !wsError &&
                workspaces.length === 0 &&
                codeProjects.length === 0
              }
              onRetry={loadWorkspaces}
            >
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
                  label={`Код: ${p.name}`}
                  icon={FileCode2}
                  selected={pickedId === p.id}
                  onClick={() =>
                    setPickedId(pickedId === p.id ? null : p.id)
                  }
                  className="max-w-full"
                />
              ))}
            </WorkspacePickerStatus>
          </section>
        ) : null}

        {!showContent ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-center">
            <FileArchive
              className="size-8 text-muted-foreground/50"
              aria-hidden="true"
            />
            <p className="text-sm text-muted-foreground">
              Выберите студию или код-проект
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
            {loading ? (
              <ReadinessCard
                workspace={null}
                entitiesCount={null}
                openFindings={null}
                loading
              />
            ) : codeTarget ? (
              <p className="rounded-xl border border-dashed bg-card px-4 py-3 text-sm text-muted-foreground">
                {DEPLOY_CODE_READY_HINT}
              </p>
            ) : (
              <ReadinessCard
                workspace={workspace}
                entitiesCount={entitiesCount}
                openFindings={openFindings}
                loading={false}
              />
            )}

            {codeTarget ? (
              <DockerfileCard targetId={codeTarget.id} surface="project" />
            ) : null}
            {workspace?.type === "app" ? (
              <DockerfileCard targetId={workspace.id} surface="workspace" />
            ) : null}

            <section
              aria-label="Экспорт ZIP"
              className="rounded-xl border bg-card p-4 shadow-sm sm:p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold">{zipTitle}</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">{zipHint}</p>
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
                      {zipTitle}
                    </>
                  )}
                </Button>
              </div>

              {codeTarget ? (
                <p className="mt-4 text-xs text-muted-foreground">
                  В архиве — файлы репозитория. Dockerfile, если сгенерирован, тоже.
                </p>
              ) : (
                <ul className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                  {[
                    "artifacts/ — медиа и manifest.json",
                    "documents/ — рукописи и спеки как .md",
                    "entities.json и findings.json",
                    "README.md — сводка состава архива",
                  ].map((line) => (
                    <li
                      key={line}
                      className="flex items-start gap-2 rounded-lg border bg-background/60 p-2.5"
                    >
                      <ShieldCheck
                        className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                        aria-hidden="true"
                      />
                      {line}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </section>
  );
}
