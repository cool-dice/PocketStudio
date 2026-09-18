import { Check, Download, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { STORE_SKILLS, type StoreSkill } from "./data";

/** One store card: icon, name, description, rating and an import toggle. */
function StoreCard({
  skill,
  imported,
  onImport,
}: {
  skill: StoreSkill;
  imported: boolean;
  onImport: (id: string) => void;
}) {
  const Icon = skill.icon;

  return (
    <li
      className={cn(
        "flex w-[262px] shrink-0 snap-start flex-col rounded-xl border bg-card p-4 shadow-sm transition-colors",
        imported ? "border-primary/40" : "hover:border-primary/40",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
          aria-hidden="true"
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="font-medium leading-snug">{skill.name}</p>
          <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
            {skill.description}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1.5 text-xs">
        <Star
          className="size-3.5 fill-amber-400 text-amber-500"
          aria-hidden="true"
        />
        <span className="font-medium tabular-nums">{skill.rating.toFixed(1)}</span>
        <span className="text-muted-foreground/70">
          · {skill.reviews} отзывов
        </span>
      </div>

      <div className="mt-auto pt-3">
        {imported ? (
          <Button variant="outline" size="sm" disabled className="w-full">
            <Check className="size-3.5 text-primary" aria-hidden="true" />
            Импортирован
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => onImport(skill.id)}
          >
            <Download className="size-3.5" aria-hidden="true" />
            Импортировать
          </Button>
        )}
      </div>
    </li>
  );
}

/** Horizontal, snap-scrolling row of skills available for import. */
export function StoreSection({
  importedIds,
  onImport,
}: {
  importedIds: Set<string>;
  onImport: (id: string) => void;
}) {
  return (
    <ul
      aria-label="Доступные для импорта скиллы"
      className="vf-scroll-x flex snap-x gap-3 overflow-x-auto pb-2"
    >
      {STORE_SKILLS.map((skill) => (
        <StoreCard
          key={skill.id}
          skill={skill}
          imported={importedIds.has(skill.id)}
          onImport={onImport}
        />
      ))}
    </ul>
  );
}
