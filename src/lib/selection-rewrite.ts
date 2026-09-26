/**
 * Pure helpers for the manuscript selection chat.
 * The model rewrites only the highlighted span; the editor splices it back.
 */

export function selectionTargetFromRange(
  value: string,
  start: number,
  end: number,
): { start: number; end: number; text: string } | null {
  if (!Number.isInteger(start) || !Number.isInteger(end)) return null;
  if (start < 0 || end > value.length || end <= start) return null;
  return { start, end, text: value.slice(start, end) };
}

/** Replace [start, end) and leave every other character untouched. */
export function replaceTextRange(
  source: string,
  start: number,
  end: number,
  replacement: string,
): string | null {
  const target = selectionTargetFromRange(source, start, end);
  if (!target) return null;
  return source.slice(0, target.start) + replacement + source.slice(target.end);
}

/** Drop a markdown fence if the model wrapped the fragment. */
export function selectionReplacementFromModel(raw: string): string {
  let text = raw.replace(/\r\n/g, "\n").trim();
  const fence = /^```[^\n]*\n([\s\S]*?)\n?```$/.exec(text);
  if (fence?.[1] != null) text = fence[1].trim();
  return text;
}

export function clampFloater(opts: {
  anchorTop: number;
  anchorLeft: number;
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
  margin?: number;
}): { top: number; left: number } {
  const margin = opts.margin ?? 8;
  const gap = 10;
  let top = opts.anchorTop + 22;
  let left = opts.anchorLeft;
  if (left + opts.width > opts.viewportWidth - margin) {
    left = opts.viewportWidth - opts.width - margin;
  }
  if (left < margin) left = margin;
  if (top + opts.height > opts.viewportHeight - margin) {
    top = opts.anchorTop - opts.height - gap;
  }
  if (top < margin) top = margin;
  return { top, left };
}
