"use client";

/**
 * Панель персонажа: портрет-градиент, биография, черты,
 * связи (родство/союз/конфликт) и вертикальный таймлайн
 * «Состояния по главам». Мок-кнопка «Сгенерировать портрет
 * по описанию» меняет портрет и добавляет работу в Альбом.
 */

import { Check, Loader2, Sparkles, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { GradientArt } from "./art-placeholder";
import { WipBadge } from "./entity-sheet";
import { MiniChip } from "./narrative-chip";
import { ageLabel, agoLabel } from "./narrative-data";
import {
  CHARACTER_ROLE_META,
  RELATION_META,
  getCharacter,
  type CharacterRelation,
  type StoryCharacter,
} from "./character-data";

export function CharacterSheet({
  characterId,
  portraitGradientOverride,
  isGeneratingPortrait,
  onClose,
  onOpenCharacter,
  onGeneratePortrait,
}: {
  characterId: string | null;
  portraitGradientOverride?: string;
  isGeneratingPortrait: boolean;
  onClose: () => void;
  onOpenCharacter: (id: string) => void;
  onGeneratePortrait: (character: StoryCharacter) => void;
}) {
  const character = characterId ? getCharacter(characterId) : undefined;

  return (
    <Sheet open={Boolean(character)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-md">
        {character ? (
          <>
            <SheetHeader className="shrink-0 border-b px-5 pb-4">
              <SheetTitle className="text-left font-serif text-xl leading-tight">
                {character.name}
              </SheetTitle>
              <SheetDescription className="text-left">
                {character.role} · {ageLabel(character.age)} ·{" "}
                {CHARACTER_ROLE_META[character.roleCategory].single}
              </SheetDescription>
            </SheetHeader>

            <div className="vf-scroll min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
              {/* Портрет */}
              <div className="relative">
                <GradientArt
                  gradient={portraitGradientOverride ?? character.portraitGradient}
                  initials={character.initials}
                  ariaLabel={`Портрет-заглушка: ${character.name}`}
                  className="aspect-[4/5] w-full rounded-xl border"
                  iconClassName="text-6xl"
                />
                {isGeneratingPortrait ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl bg-background/70 backdrop-blur-sm">
                    <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
                    <p className="text-xs font-medium">Рисуем портрет по описанию…</p>
                    <p className="text-[11px] text-muted-foreground">обычно занимает пару секунд</p>
                  </div>
                ) : null}
              </div>

              {/* Биография */}
              <section aria-label="Биография">
                <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Биография
                </h4>
                <p className="mt-2 font-serif text-[15px] leading-[1.75] text-foreground/90">
                  {character.biography}
                </p>
              </section>

              <Separator />

              {/* Черты */}
              <section aria-label="Черты характера">
                <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Черты
                </h4>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {character.traits.map((trait) => (
                    <MiniChip key={trait}>#{trait}</MiniChip>
                  ))}
                </div>
              </section>

              <Separator />

              {/* Связи */}
              <section aria-label="Связи персонажа">
                <h4 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <Users className="size-3.5" aria-hidden="true" />
                  Связи
                </h4>
                <ul className="mt-2 space-y-1.5">
                  {character.relations.map((relation) => (
                    <RelationRow
                      key={`${relation.kind}-${relation.targetId}`}
                      relation={relation}
                      onOpen={() => onOpenCharacter(relation.targetId)}
                    />
                  ))}
                </ul>
              </section>

              <Separator />

              {/* Состояния по главам */}
              <section aria-label="Состояния по главам">
                <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Состояния по главам
                </h4>
                <ol className="relative mt-3 space-y-4 before:absolute before:bottom-2 before:left-[13px] before:top-2 before:w-px before:bg-border">
                  {character.states.map((state) => (
                    <li key={state.chapter} className="relative flex gap-3.5 pl-0">
                      <span
                        className="z-[1] flex size-7 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-card font-mono text-[11px] font-semibold text-primary"
                        aria-label={`Глава ${state.chapter}`}
                      >
                        {state.chapter}
                      </span>
                      <div className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2">
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                          <span className="text-xs font-semibold">{state.status}</span>
                          <span className="text-[11px] text-muted-foreground">{ageLabel(state.age)}</span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          Локация: <span className="text-foreground/80">{state.location}</span>
                        </p>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground/80">
                          {state.note}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
                <p className="mt-3 text-[11px] text-muted-foreground">
                  Появляется в главах: {character.chapters.join(", ")} · обновлена {agoLabel(character.updatedAgo)}
                </p>
              </section>
            </div>

            {/* Действие генерации портрета */}
            <div className="shrink-0 border-t px-5 py-3">
              <Button
                type="button"
                className="w-full"
                disabled={isGeneratingPortrait || Boolean(portraitGradientOverride)}
                onClick={() => onGeneratePortrait(character)}
              >
                {isGeneratingPortrait ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Генерация портрета…
                  </>
                ) : portraitGradientOverride ? (
                  <>
                    <Check className="size-4" aria-hidden="true" />
                    Портрет обновлён — см. Альбом
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" aria-hidden="true" />
                    Сгенерировать портрет по описанию
                  </>
                )}
                <WipBadge className="ml-1.5" />
              </Button>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function RelationRow({
  relation,
  onOpen,
}: {
  relation: CharacterRelation;
  onOpen: () => void;
}) {
  const meta = RELATION_META[relation.kind];
  const target = getCharacter(relation.targetId);
  const Icon = meta.icon;

  return (
    <li className="flex items-center gap-2.5 rounded-lg border bg-background px-3 py-2">
      <span
        className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground"
        aria-hidden="true"
      >
        <Icon className="size-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <button
            type="button"
            onClick={onOpen}
            className="truncate text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {target?.name ?? relation.targetId}
          </button>
          <span className="shrink-0 rounded-full border border-border bg-muted px-1.5 py-px text-[10px] text-muted-foreground">
            {meta.label}
          </span>
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
          {relation.note}
        </span>
      </span>
    </li>
  );
}
