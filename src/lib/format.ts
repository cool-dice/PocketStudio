/**
 * Formatting helpers (ru-RU).
 */

/** "17 сент, 14:32" — short date + time for note cards and details. */
export function formatNoteDate(iso: string): string {
  try {
    const d = new Date(iso);
    const date = d
      .toLocaleDateString("ru-RU", { day: "numeric", month: "short" })
      .replace(/\.$/, "");
    const time = d.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${date}, ${time}`;
  } catch {
    return "";
  }
}

/** Single-line preview of a text, cut to maxLen chars with an ellipsis. */
export function textPreview(text: string | null | undefined, maxLen: number): string {
  const single = (text ?? "").replace(/\s+/g, " ").trim();
  return single.length <= maxLen ? single : `${single.slice(0, maxLen).trimEnd()}…`;
}

/** Russian plural for note counts: 1 заметка / 2 заметки / 5 заметок. */
export function pluralNotes(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "заметка";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "заметки";
  return "заметок";
}
