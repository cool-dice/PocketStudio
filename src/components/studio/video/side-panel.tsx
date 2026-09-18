"use client";

import { AudioLines, Camera, ScrollText } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { ScriptTab } from "./script-tab";
import { ShotsTab } from "./shots-tab";
import { SoundTab } from "./sound-tab";
import type { SceneCard } from "./video-data";

/**
 * Правая панель видео-модуля: Сценарий | Кадры | Звук.
 * Вкладки прокручиваются сами (vf-scroll) на высоких экранах.
 */
export function SidePanel({
  scene,
  playing,
}: {
  scene: SceneCard;
  playing: boolean;
}) {
  return (
    <Tabs
      defaultValue="script"
      className="flex min-h-0 flex-1 flex-col gap-3"
    >
      <TabsList className="grid h-9 w-full shrink-0 grid-cols-3">
        <TabsTrigger value="script">
          <ScrollText aria-hidden="true" />
          Сценарий
        </TabsTrigger>
        <TabsTrigger value="shots">
          <Camera aria-hidden="true" />
          Кадры
        </TabsTrigger>
        <TabsTrigger value="sound">
          <AudioLines aria-hidden="true" />
          Звук
        </TabsTrigger>
      </TabsList>

      <TabsContent value="script" className="min-h-0 flex-1">
        <div className="vf-scroll h-full overflow-y-auto pr-1">
          <ScriptTab scene={scene} />
        </div>
      </TabsContent>

      <TabsContent value="shots" className="min-h-0 flex-1">
        <div className="vf-scroll h-full overflow-y-auto pr-1">
          <ShotsTab />
        </div>
      </TabsContent>

      <TabsContent value="sound" className="min-h-0 flex-1">
        <div className="vf-scroll h-full overflow-y-auto pr-1">
          <SoundTab playing={playing} />
        </div>
      </TabsContent>
    </Tabs>
  );
}
