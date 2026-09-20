/**
 * Surgical text replace + minimal unified-diff apply for agent apply_patch.
 * Stays inside one file: no path traversal, no multi-file dumps.
 */

export class PatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PatchError";
  }
}

/** Replace the first exact occurrence of oldText, or all if replaceAll. */
export function applyExactReplace(
  content: string,
  oldText: string,
  newText: string,
  replaceAll = false,
): { next: string; replacements: number } {
  if (!oldText) throw new PatchError("oldText пуст — укажите фрагмент для замены");
  if (!content.includes(oldText)) {
    throw new PatchError("Фрагмент oldText не найден в файле");
  }
  if (replaceAll) {
    const replacements = content.split(oldText).length - 1;
    return { next: content.split(oldText).join(newText), replacements };
  }
  const index = content.indexOf(oldText);
  const next =
    content.slice(0, index) + newText + content.slice(index + oldText.length);
  return { next, replacements: 1 };
}

/**
 * Apply a tiny unified diff (one file, @@ hunks). Enough for agent edits;
 * rejects binary markers and path headers that point elsewhere.
 */
export function applyUnifiedDiff(content: string, patch: string): string {
  const lines = patch.replace(/\r\n/g, "\n").split("\n");
  const hunks: { old: string[]; neu: string[] }[] = [];
  let cur: { old: string[]; neu: string[] } | null = null;

  for (const line of lines) {
    if (
      line.startsWith("diff ") ||
      line.startsWith("index ") ||
      line.startsWith("--- ") ||
      line.startsWith("+++ ")
    ) {
      continue;
    }
    if (line.startsWith("@@")) {
      cur = { old: [], neu: [] };
      hunks.push(cur);
      continue;
    }
    if (!cur) continue;
    if (line.startsWith("+")) cur.neu.push(line.slice(1));
    else if (line.startsWith("-")) cur.old.push(line.slice(1));
    else if (line.startsWith("\\")) continue;
    else {
      const body = line.startsWith(" ") ? line.slice(1) : line;
      cur.old.push(body);
      cur.neu.push(body);
    }
  }

  if (hunks.length === 0) {
    throw new PatchError("В патче нет hunk @@");
  }

  let next = content;
  for (const hunk of hunks) {
    const oldBlock = hunk.old.join("\n");
    const newBlock = hunk.neu.join("\n");
    if (!oldBlock) {
      // insertion at start
      next = `${newBlock}\n${next}`;
      continue;
    }
    if (!next.includes(oldBlock)) {
      throw new PatchError("Hunk не совпал с файлом — прочитайте файл и повторите");
    }
    next = next.replace(oldBlock, newBlock);
  }
  return next;
}

export function applyPatchArgs(opts: {
  content: string;
  oldText?: string | null;
  newText?: string | null;
  patch?: string | null;
  replaceAll?: boolean;
}): { next: string; replacements: number } {
  const patch = (opts.patch ?? "").trim();
  if (patch) {
    const next = applyUnifiedDiff(opts.content, patch);
    return { next, replacements: next === opts.content ? 0 : 1 };
  }
  const oldText = opts.oldText ?? "";
  const newText = opts.newText ?? "";
  return applyExactReplace(opts.content, oldText, newText, Boolean(opts.replaceAll));
}
