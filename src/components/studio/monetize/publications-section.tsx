import { BarChart3 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { PUBLICATIONS, PUBLICATION_STATUS_META, type Publication } from "./data";

/** One published work from my portfolio. */
function PublicationCard({ publication }: { publication: Publication }) {
  const status = PUBLICATION_STATUS_META[publication.status];
  const Icon = publication.icon;

  return (
    <article className="flex flex-col rounded-xl border bg-card p-4 shadow-sm transition-colors hover:border-primary/40">
      <div className="flex items-start gap-3">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
          aria-hidden="true"
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium leading-snug">{publication.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span>{publication.type}</span>
            <span aria-hidden="true">·</span>
            <Badge variant="outline" className="px-1.5 text-[11px]">
              {publication.platform}
            </Badge>
          </div>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium",
            status.className,
          )}
        >
          {status.label}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="font-mono text-sm font-medium">
            {publication.price ?? "—"}
          </span>
          <span className="text-xs text-muted-foreground">
            {publication.metric}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label={`Статистика: ${publication.title}`}
        >
          <BarChart3 className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </article>
  );
}

/** Portfolio grid: books, articles, tracks and courses I sell. */
export function PublicationsSection() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {PUBLICATIONS.map((publication) => (
        <PublicationCard key={publication.id} publication={publication} />
      ))}
    </div>
  );
}
