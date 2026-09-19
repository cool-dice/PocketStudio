"use client";

/**
 * DawTrackCard — карточка дорожки студии: шапка (цвет типа, имя, mute,
 * громкость, панорама, удаление) + редактор по типу: DrumGrid /
 * NoteGrid / VoiceTrackPanel.
 */

import type { LucideIcon } from "lucide-react";
import { Drum, Layers, Mic, Music2, Trash2, Volume2, VolumeX, Waves } from "lucide-react";

import { cn } from "@/lib/utils";
import type {
  DawTrack,
  DrumInstrument,
  TrackKind,
  VoiceClip,
} from "@/lib/daw-model";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { DrumGrid } from "./drum-grid";
import { NoteGrid } from "./note-grid";
import { VoiceTrackPanel } from "./voice-track-panel";

/** Цвет дорожки по типу: drums=amber, bass=emerald, lead=violet, pad=teal, voice=rose. */
export const KIND_META: Record<TrackKind, { dot: string; cell: string; icon: LucideIcon }> = {
  drums: { dot: "bg-amber-500", cell: "bg-amber-500", icon: Drum },
  bass: { dot: "bg-emerald-500", cell: "bg-emerald-500", icon: Music2 },
  lead: { dot: "bg-violet-500", cell: "bg-violet-500", icon: Waves },
  pad: { dot: "bg-teal-500", cell: "bg-teal-500", icon: Layers },
  voice: { dot: "bg-rose-500", cell: "bg-rose-500", icon: Mic },
};

export function DawTrackCard({
  track,
  projectId,
  totalSteps,
  currentStep,
  onPatch,
  onToggleDrum,
  onToggleNote,
  onVoiceChange,
  onRemove,
}: {
  track: DawTrack;
  projectId: string;
  totalSteps: number;
  /** Играющий шаг или −1. */
  currentStep: number;
  onPatch: (patch: Partial<DawTrack>) => void;
  onToggleDrum: (instrument: DrumInstrument, step: number) => void;
  onToggleNote: (step: number, midi: number) => void;
  onVoiceChange: (clip: VoiceClip | undefined) => void;
  onRemove: () => void;
}) {
  const meta = KIND_META[track.kind];
  const KindIcon = meta.icon;

  return (
    <article className="rounded-xl border bg-card shadow-sm" aria-label={`Дорожка «${track.name}»`}>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3">
        {track.kind === "drums" ? (
          <KindIcon className="size-4 shrink-0 text-amber-500" aria-hidden="true" />
        ) : (
          <span className={cn("size-2.5 shrink-0 rounded-full", meta.dot)} aria-hidden="true" />
        )}
        <Input
          value={track.name}
          onChange={(e) => onPatch({ name: e.target.value })}
          maxLength={60}
          aria-label="Имя дорожки"
          className="h-8 w-32 min-w-0 flex-1 border-transparent bg-transparent px-1.5 text-sm font-medium shadow-none focus-visible:border-ring sm:w-40"
        />
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 text-muted-foreground"
          onClick={() => onPatch({ muted: !track.muted })}
          aria-pressed={track.muted}
          aria-label={track.muted ? "Включить дорожку" : "Заглушить дорожку"}
        >
          {track.muted ? (
            <VolumeX className="size-4 text-rose-500" aria-hidden="true" />
          ) : (
            <Volume2 className="size-4" aria-hidden="true" />
          )}
        </Button>
        <div className="flex items-center gap-1.5">
          <Slider
            min={0}
            max={1}
            step={0.05}
            value={[track.volume]}
            onValueChange={([v]) => onPatch({ volume: v })}
            className="w-16 sm:w-20"
            aria-label={`Громкость «${track.name}»`}
          />
          <span className="w-8 text-right text-[10px] tabular-nums text-muted-foreground">
            {Math.round(track.volume * 100)}%
          </span>
        </div>
        <div className="flex items-center gap-1" aria-label={`Панорама «${track.name}»`}>
          <span className="text-[10px] font-semibold text-muted-foreground">L</span>
          <Slider
            min={-1}
            max={1}
            step={0.1}
            value={[track.pan]}
            onValueChange={([v]) => onPatch({ pan: v })}
            className="w-14 sm:w-16"
            aria-label={`Панорама «${track.name}»`}
          />
          <span className="text-[10px] font-semibold text-muted-foreground">R</span>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
              aria-label={`Удалить дорожку «${track.name}»`}
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Удалить дорожку «{track.name}»?</AlertDialogTitle>
              <AlertDialogDescription>
                Паттерн дорожки пропадёт из проекта студии после автосохранения.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Отмена</AlertDialogCancel>
              <AlertDialogAction
                onClick={onRemove}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                Удалить
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </header>

      <div className="border-t p-3">
        {track.kind === "drums" && track.drums ? (
          <DrumGrid
            pattern={track.drums}
            totalSteps={totalSteps}
            currentStep={currentStep}
            onToggle={(instrument, step) => onToggleDrum(instrument, step)}
          />
        ) : null}
        {track.kind !== "drums" && track.kind !== "voice" ? (
          <NoteGrid
            notes={track.notes ?? []}
            waveform={track.waveform ?? "sawtooth"}
            octave={track.octave ?? 3}
            totalSteps={totalSteps}
            currentStep={currentStep}
            accentClass={meta.cell}
            onToggleNote={onToggleNote}
            onWaveformChange={(waveform) => onPatch({ waveform })}
            onOctaveChange={(octave) => onPatch({ octave })}
          />
        ) : null}
        {track.kind === "voice" ? (
          <VoiceTrackPanel
            projectId={projectId}
            clip={track.voice}
            totalSteps={totalSteps}
            onChange={onVoiceChange}
          />
        ) : null}
      </div>
    </article>
  );
}
