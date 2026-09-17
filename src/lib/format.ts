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

/** Russian plural forms: 1 файл / 2 файла / 5 файлов. */
export function pluralRu(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/** Russian plural for files: 1 файл / 2 файла / 5 файлов. */
export function pluralFiles(n: number): string {
  return pluralRu(n, "файл", "файла", "файлов");
}

/** Russian plural for commits: 1 коммит / 2 коммита / 5 коммитов. */
export function pluralCommits(n: number): string {
  return pluralRu(n, "коммит", "коммита", "коммитов");
}

/** Russian plural for changes: 1 изменение / 2 изменения / 5 изменений. */
export function pluralChanges(n: number): string {
  return pluralRu(n, "изменение", "изменения", "изменений");
}

/** Relative ru time: «только что», «5 минут назад», «вчера», else short date. */
export function relativeTime(iso: string): string {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return "";
  const minutes = Math.floor((Date.now() - ts) / 60_000);
  if (minutes < 1) return "только что";
  if (minutes < 60) {
    return `${minutes} ${pluralRu(minutes, "минуту", "минуты", "минут")} назад`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} ${pluralRu(hours, "час", "часа", "часов")} назад`;
  }
  const days = Math.floor(hours / 24);
  if (days === 1) return "вчера";
  if (days < 7) {
    return `${days} ${pluralRu(days, "день", "дня", "дней")} назад`;
  }
  return formatNoteDate(iso);
}

/** Human-readable byte size: 512 Б / 3,4 КБ / 1,2 МБ. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toLocaleString("ru-RU", {
      maximumFractionDigits: 1,
    })} КБ`;
  }
  return `${(bytes / (1024 * 1024)).toLocaleString("ru-RU", {
    maximumFractionDigits: 1,
  })} МБ`;
}
