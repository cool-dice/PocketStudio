"use client";

/**
 * Экран «Аудио» — карманная звуковая студия (Фаза C: живая DAW).
 *
 * Три вкладки, все требуют воркспейс:
 *  - «Озвучка»   — TTS: текст → api.aiTts → WAV-артефакт + библиотека озвучек;
 *  - «Студия»    — настоящая DAW на Web Audio API (daw-engine + daw-studio):
 *    степ-секвенсор барабанов, пиано-ролл синтов, голосовые клипы,
 *    автосохранение и экспорт микса в WAV;
 *  - «Библиотека» — аудиотека воркспейса: озвучки, DAW-миксы, сэмплы.
 *
 * Встроена в воркспейс (workspaceId) либо предлагает выбрать его чипами
 * (глобальный вызов — чипы показываются для всех вкладок).
 */

import { useEffect, useState } from "react";
import { AudioWaveform, FolderOpen, Library, Mic, SlidersHorizontal } from "lucide-react";

import { ModuleHeader, type ModuleScreenProps } from "@/components/studio/shared/module-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import type { WorkspaceDto } from "@/lib/workspace-types";
import { AudioLibraryTab } from "./audio-library-tab";
import { DawStudio } from "./daw-studio";
import { NarrationLibrary } from "./narration-library";
import { NarrationPanel } from "./narration-panel";
import { SelectableChip } from "./chip";

const AUDIO_TABS = [
  { value: "voice", label: "Озвучка", icon: Mic },
  { value: "studio", label: "Студия", icon: SlidersHorizontal },
  { value: "library", label: "Библиотека", icon: Library },
] as const;

type AudioTabValue = (typeof AUDIO_TABS)[number]["value"];

function WorkspacePlaceholder({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex min-h-40 flex-1 items-center justify-center rounded-xl border border-dashed p-6">
      <div className="flex max-w-sm flex-col items-center text-center">
        <span
          aria-hidden="true"
          className="flex size-11 items-center justify-center rounded-xl bg-muted"
        >
          <FolderOpen className="size-5 text-muted-foreground" />
        </span>
        <p className="mt-3 text-sm font-medium">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

export function AudioScreen({
  onOpenMobileNav,
  workspaceId,
}: ModuleScreenProps & { workspaceId?: string }) {
  const [tab, setTab] = useState<AudioTabValue>("voice");

  /* Глобальный вызов (без workspaceId) — воркспейс выбирается чипами. */
  const [workspaces, setWorkspaces] = useState<WorkspaceDto[] | null>(null);
  const [pickedWorkspaceId, setPickedWorkspaceId] = useState<string | null>(null);
  const [libraryKey, setLibraryKey] = useState(0);

  const embeddedWorkspaceId = workspaceId ?? null;
  const activeWorkspaceId = embeddedWorkspaceId ?? pickedWorkspaceId;

  useEffect(() => {
    if (embeddedWorkspaceId) return;
    let cancelled = false;
    api
      .listWorkspaces()
      .then((list) => {
        if (!cancelled) setWorkspaces(list);
      })
      .catch(() => {
        if (!cancelled) setWorkspaces([]);
      });
    return () => {
      cancelled = true;
    };
  }, [embeddedWorkspaceId]);

  const bumpLibrary = () => setLibraryKey((k) => k + 1);

  return (
    <section
      aria-label="Аудио"
      className="relative flex h-full min-w-0 flex-1 flex-col bg-background"
    >
      <ModuleHeader
        icon={AudioWaveform}
        title="Аудио"
        description="Озвучка, DAW-студия и аудиотека"
        stage="beta"
        onOpenMobileNav={onOpenMobileNav}
      />

      <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 sm:p-6">
        {/* Чипы выбора воркспейса — общие для всех вкладок (глобальный вызов). */}
        {!embeddedWorkspaceId ? (
          <section
            aria-label="Выбор воркспейса"
            className="shrink-0 rounded-xl border bg-card p-4 shadow-sm"
          >
            <p className="text-sm font-medium">Воркспейс аудио</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Озвучки, проект студии и аудиотека живут в воркспейсе — выберите,
              с каким работать.
            </p>
            <div className="mt-2.5 flex max-h-24 flex-wrap gap-1.5 overflow-y-auto vf-scroll">
              {workspaces === null ? (
                <>
                  <Skeleton className="h-7 w-36 rounded-full" />
                  <Skeleton className="h-7 w-28 rounded-full" />
                  <Skeleton className="h-7 w-32 rounded-full" />
                </>
              ) : workspaces.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Воркспейсов пока нет — создайте первый в разделе «Воркспейсы».
                </p>
              ) : (
                workspaces.map((ws) => (
                  <SelectableChip
                    key={ws.id}
                    label={ws.name}
                    selected={pickedWorkspaceId === ws.id}
                    onClick={() => setPickedWorkspaceId(ws.id)}
                  />
                ))
              )}
            </div>
          </section>
        ) : null}

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as AudioTabValue)}
          className="flex min-h-0 flex-1 flex-col gap-4"
        >
          <TabsList className="shrink-0 self-start max-w-full overflow-x-auto">
            {AUDIO_TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="gap-1.5">
                <t.icon className="size-4" aria-hidden="true" />
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ── Озвучка (TTS) ── */}
          <TabsContent
            value="voice"
            className="mt-0 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto vf-scroll pr-0.5"
          >
            {activeWorkspaceId ? (
              <>
                <NarrationPanel workspaceId={activeWorkspaceId} onCreated={bumpLibrary} />
                <NarrationLibrary workspaceId={activeWorkspaceId} refreshKey={libraryKey} />
              </>
            ) : (
              <WorkspacePlaceholder
                title="Выберите воркспейс"
                hint="Озвучка живёт в воркспейсе: текст прочитается вслух, а готовый трек с плеером появится в библиотеке ниже."
              />
            )}
          </TabsContent>

          {/* ── DAW-студия ── */}
          <TabsContent
            value="studio"
            className="mt-0 flex min-h-0 flex-1 flex-col overflow-y-auto vf-scroll pr-0.5 scroll-pt-32"
          >
            {activeWorkspaceId ? (
              <DawStudio
                key={activeWorkspaceId}
                projectId={activeWorkspaceId}
                onMixed={bumpLibrary}
              />
            ) : (
              <WorkspacePlaceholder
                title="Выберите воркспейс"
                hint="Проект студии (дорожки, паттерны, миксы) сохраняется в воркспейсе — выберите его, чтобы сыграть трек."
              />
            )}
          </TabsContent>

          {/* ── Аудиотека ── */}
          <TabsContent
            value="library"
            className="mt-0 flex min-h-0 flex-1 flex-col overflow-y-auto vf-scroll pr-0.5"
          >
            {activeWorkspaceId ? (
              <AudioLibraryTab projectId={activeWorkspaceId} refreshKey={libraryKey} />
            ) : (
              <WorkspacePlaceholder
                title="Выберите воркспейс"
                hint="Аудиотека собирает озвучки и миксы конкретного воркспейса — выберите его, чтобы послушать."
              />
            )}
          </TabsContent>
        </Tabs>
      </main>
    </section>
  );
}
