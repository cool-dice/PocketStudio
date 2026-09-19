"use client";

/**
 * MonetizeScreen (5-c) — «Монетизация» на живых данных.
 *
 * Вкладка воркспейса (workspaceId передаётся швом workspace-tabs):
 *  1) карточка «План монетизации» — LLM-план (POST /api/ai/monetize),
 *     сохранённый как Document kind="spec" с секциями; рендер по секциям,
 *     регенерация через AlertDialog с брифом;
 *  2) «Прогноз» — CSS bar-chart из маркера ПРОГНОЗ_JSON секции плана;
 *  3) «Активы к публикации» — реальные артефакты воркспейса из БД;
 *  4) кабинет офферов и выплат (симуляция, без карточной сети).
 * Глобальный экран (без id): чипы воркспейсов → выбрал → тот же контент.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Coins, RefreshCw } from "lucide-react";
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
import { WORKSPACE_TYPE_META } from "@/lib/workspace-data";
import type {
  ArtifactDto,
  DocumentDto,
} from "@/lib/workspace-types";
import { AssetsSection } from "./assets-section";
import { ForecastChart } from "./forecast-chart";
import { isPlanDocument, planFromDocument } from "./plan-data";
import { PlanCard } from "./plan-card";
import { SectionHeading } from "./section-heading";
import { OfferCabinet } from "./offer-cabinet";
import { monetizePaymentsHint } from "@/lib/payout-copy";

export function MonetizeScreen({
  onOpenMobileNav,
  workspaceId,
}: ModuleScreenProps & { workspaceId?: string }) {
  const { workspaces, loading: wsLoading, error: wsError, load: loadWorkspaces } =
    useWorkspaces();
  const [pickedId, setPickedId] = useState<string | null>(null);
  const effectiveId = workspaceId ?? pickedId;

  /* Контент выбранного воркспейса. */
  const [planDoc, setPlanDoc] = useState<DocumentDto | null>(null);
  const [artifacts, setArtifacts] = useState<ArtifactDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  /* Загрузка контента воркспейса: план-документ + все артефакты. */
  const loadContent = useCallback(async () => {
    if (!effectiveId) {
      setPlanDoc(null);
      setArtifacts([]);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const [docs, arts] = await Promise.all([
        api.listDocuments(effectiveId),
        api.listArtifacts(effectiveId),
      ]);
      const found = docs.find(isPlanDocument) ?? null;
      const full = found ? await api.getDocument(found.id) : null;
      setPlanDoc(full);
      setArtifacts(arts);
    } catch (err) {
      setPlanDoc(null);
      setArtifacts([]);
      setLoadError(
        err instanceof ApiError ? err.message : "Не удалось загрузить данные",
      );
    } finally {
      setLoading(false);
    }
  }, [effectiveId]);

  useEffect(() => {
    void loadContent();
  }, [loadContent]);

  const plan = useMemo(
    () => (planDoc ? planFromDocument(planDoc) : null),
    [planDoc],
  );

  /* Сборка/пересборка плана через LLM (15–25 секунд). */
  const runGenerate = useCallback(
    async (brief: string) => {
      if (!effectiveId) return;
      setGenerating(true);
      try {
        const res = await api.aiMonetize(effectiveId, brief || undefined);
        setPlanDoc(res.document);
        toast.success("План монетизации готов", {
          description: res.document.title,
        });
      } catch (err) {
        toast.error(
          err instanceof ApiError ? err.message : "Не удалось собрать план",
          { description: "Модель иногда занята — попробуйте ещё раз." },
        );
      } finally {
        setGenerating(false);
      }
    },
    [effectiveId],
  );

  const showContent = Boolean(effectiveId);

  return (
    <section
      aria-label="Монетизация"
      className="flex h-full min-w-0 flex-1 flex-col bg-background"
    >
      <ModuleHeader
        icon={Coins}
        title="Монетизация"
        description={monetizePaymentsHint()}
        stage="beta"
        onOpenMobileNav={onOpenMobileNav}
      >
        {showContent && loadError ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadContent()}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Повторить
          </Button>
        ) : null}
      </ModuleHeader>

      <main className="vf-scroll flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
        {/* Глобальный экран: выбор воркспейса чипами. */}
        {!workspaceId ? (
          <section
            aria-label="Выбор воркспейса"
            className="rounded-xl border bg-card p-4"
          >
            <h2 className="text-sm font-medium">План какого воркспейса?</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              План монетизации живёт внутри воркспейса — выберите, для чего
              считаем.
            </p>
            <WorkspacePickerStatus
              loading={!workspaceId && wsLoading}
              error={!workspaceId && wsError}
              empty={!workspaceId && !wsLoading && !wsError && workspaces.length === 0}
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
                      count={ws.counts.images + ws.counts.audio}
                      onClick={() =>
                        setPickedId(pickedId === ws.id ? null : ws.id)
                      }
                      className="max-w-full"
                    />
                  );
                })}
            </WorkspacePickerStatus>
          </section>
        ) : null}

        {!showContent ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-center">
            <Coins
              className="size-8 text-muted-foreground/50"
              aria-hidden="true"
            />
            <p className="text-sm text-muted-foreground">
              Выберите воркспейс — соберём для него план
            </p>
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center">
            <p className="text-sm text-muted-foreground">{loadError}</p>
            <Button size="sm" variant="outline" onClick={() => void loadContent()}>
              <RefreshCw className="size-4" aria-hidden="true" />
              Повторить
            </Button>
          </div>
        ) : (
          <>
            <PlanCard
              planDoc={planDoc}
              plan={plan}
              generating={generating}
              onGenerate={(brief) => void runGenerate(brief)}
            />

            <section aria-label="Прогноз дохода" className="space-y-3">
              <SectionHeading
                title="Прогноз"
                hint="помесячно, ₽ — из плана монетизации"
              />
              <ForecastChart
                forecast={plan?.forecast ?? null}
                loading={loading}
              />
            </section>

            <AssetsSection artifacts={artifacts} loading={loading} />
            {effectiveId ? <OfferCabinet workspaceId={effectiveId} /> : null}
          </>
        )}
      </main>
    </section>
  );
}
