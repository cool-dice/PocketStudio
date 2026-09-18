"use client";

import { motion } from "framer-motion";
import { Plus } from "lucide-react";

import { cn } from "@/lib/utils";

import { StatusChip, type ChipTone } from "./status-chip";
import {
  SCENES,
  SCENE_STATUS_LABEL,
  type SceneStatus,
} from "./video-data";

const STATUS_TONE: Record<SceneStatus, ChipTone> = {
  done: "done",
  generating: "active",
  pending: "pending",
};

/**
 * Горизонтальная лента раскадровки: карточки сцен с уникальными
 * градиентными миниатюрами, статусами и snap-прокруткой,
 * плюс пунктирная карточка «Добавить сцену».
 */
export function SceneStrip({
  selectedSceneId,
  onSelectScene,
}: {
  selectedSceneId: number;
  onSelectScene: (sceneId: number) => void;
}) {
  return (
    <section aria-label="Раскадровка сцен">
      <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="shrink-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Раскадровка
          </h2>
          <span className="truncate rounded-full border bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {SCENES.length} сцен · снап-прокрутка
          </span>
        </div>
        <span
          aria-hidden="true"
          className="hidden shrink-0 font-mono text-[10px] text-muted-foreground/70 sm:block"
        >
          →
        </span>
      </div>

      <div className="vf-scroll -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2">
        {SCENES.map((scene, i) => {
          const selected = scene.id === selectedSceneId;
          const SceneIcon = scene.icon;
          return (
            <motion.button
              key={scene.id}
              type="button"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.25 }}
              onClick={() => onSelectScene(scene.id)}
              aria-pressed={selected}
              className={cn(
                "group w-40 shrink-0 snap-start overflow-hidden rounded-xl border bg-card text-left transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                selected
                  ? "border-primary ring-2 ring-primary"
                  : "hover:border-primary/50",
              )}
            >
              <span className="relative block aspect-video w-full overflow-hidden">
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute inset-0 bg-gradient-to-br",
                    scene.gradient,
                  )}
                />
                <span
                  aria-hidden="true"
                  className="absolute inset-0 bg-[radial-gradient(70%_70%_at_30%_20%,rgba(255,255,255,0.16),transparent_60%)]"
                />
                {scene.status === "generating" ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 animate-pulse bg-amber-400/10"
                  />
                ) : null}
                <SceneIcon
                  aria-hidden="true"
                  className="absolute left-1/2 top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 text-white/35"
                />
                <span
                  aria-hidden="true"
                  className="absolute left-1.5 top-1.5 rounded bg-black/45 px-1.5 py-0.5 font-mono text-[10px] font-medium text-white/90 backdrop-blur"
                >
                  {String(scene.id).padStart(2, "0")}
                </span>
                <span
                  aria-hidden="true"
                  className="absolute bottom-1.5 right-1.5 rounded bg-black/45 px-1.5 py-0.5 font-mono text-[10px] text-white/90 backdrop-blur"
                >
                  {scene.duration}с
                </span>
              </span>
              <span className="block p-2">
                <span className="block truncate text-xs font-medium">
                  {scene.title}
                </span>
                <StatusChip
                  tone={STATUS_TONE[scene.status]}
                  label={SCENE_STATUS_LABEL[scene.status]}
                  className="mt-1.5"
                />
              </span>
            </motion.button>
          );
        })}

        <button
          type="button"
          className="group flex w-40 shrink-0 snap-start flex-col rounded-xl border border-dashed bg-transparent transition-colors hover:border-primary/60 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <span className="flex aspect-video w-full items-center justify-center text-muted-foreground/70 transition-colors group-hover:text-primary">
            <Plus className="size-5" aria-hidden="true" />
          </span>
          <span className="block p-2 text-xs font-medium text-muted-foreground group-hover:text-primary">
            Добавить сцену
          </span>
        </button>
      </div>
    </section>
  );
}
