import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import { SOURCE_META, type MySkill } from "./data";

/**
 * One installed skill: clickable body (selects the skill, opens the detail
 * card below) + an independent enable/disable switch in the corner.
 */
export function SkillCard({
  skill,
  enabled,
  selected,
  onSelect,
  onToggle,
}: {
  skill: MySkill;
  enabled: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
  onToggle: (id: string, next: boolean) => void;
}) {
  const source = SOURCE_META[skill.source];
  const Icon = skill.icon;

  return (
    <article
      aria-current={selected ? "true" : undefined}
      className={cn(
        "relative rounded-xl border bg-card p-4 shadow-sm transition-colors",
        selected
          ? "border-primary/60 ring-1 ring-primary/25"
          : "hover:border-primary/40",
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(skill.id)}
        aria-label={`Открыть скилл «${skill.name}»`}
        aria-expanded={selected}
        className="flex h-full w-full flex-col rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex items-start gap-3 pr-9">
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-opacity",
              !enabled && "opacity-50",
            )}
            aria-hidden="true"
          >
            <Icon className="size-5" />
          </span>
          <span className="min-w-0">
            <span
              className={cn(
                "block truncate font-medium leading-snug",
                !enabled && "text-muted-foreground",
              )}
            >
              {skill.name}
            </span>
            <span className="mt-0.5 block truncate text-sm text-muted-foreground">
              {skill.description}
            </span>
          </span>
        </span>

        <span className="mt-auto flex flex-wrap items-center gap-1.5 pt-4 text-xs">
          <span className="rounded-md border bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
            v{skill.version}
          </span>
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-[11px] font-medium",
              source.className,
            )}
          >
            {source.label}
          </span>
          <span className="ml-auto text-[11px] text-muted-foreground/70">
            использован {skill.usedCount}×
          </span>
        </span>
      </button>

      <span className="absolute right-3.5 top-3.5 flex items-center gap-2">
        <Switch
          checked={enabled}
          onCheckedChange={(next) => onToggle(skill.id, next)}
          aria-label={
            enabled
              ? `Отключить скилл «${skill.name}»`
              : `Включить скилл «${skill.name}»`
          }
        />
      </span>
    </article>
  );
}
