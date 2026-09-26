import type { ReactNode } from "react";

/** Small muted overline with an optional hint on the right of the title. */
export function SectionHeading({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <div className="flex flex-wrap items-baseline gap-x-2.5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h2>
        {hint ? (
          <span className="text-xs text-muted-foreground/70">{hint}</span>
        ) : null}
      </div>
      {action}
    </div>
  );
}
