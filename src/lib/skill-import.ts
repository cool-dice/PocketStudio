/**
 * Validate imported SKILL.md (file paste or URL body). HTML / empty
 * payloads must fail — they are not a successful import.
 */

export function looksLikeHtml(text: string): boolean {
  const head = text.trimStart().slice(0, 240).toLowerCase();
  return (
    head.startsWith("<!doctype") ||
    head.startsWith("<html") ||
    /<html[\s>]/.test(head)
  );
}

export function validateImportedSkillMd(
  text: string,
): { ok: true; skillMd: string } | { ok: false; error: string } {
  const skillMd = text.trim();
  if (skillMd.length < 8) {
    return { ok: false, error: "Файл SKILL.md слишком короткий или пустой" };
  }
  if (looksLikeHtml(skillMd)) {
    return { ok: false, error: "Это HTML, а не SKILL.md — импорт отклонён" };
  }
  if (skillMd.length > 20_000) {
    return { ok: false, error: "SKILL.md больше 20 000 символов" };
  }
  return { ok: true, skillMd };
}

export function validateSkillImportUrl(
  url: string,
): { ok: true; url: string } | { ok: false; error: string } {
  const trimmed = url.trim();
  if (!trimmed) {
    return { ok: false, error: "Укажите URL SKILL.md" };
  }
  if (!/^https?:\/\//i.test(trimmed)) {
    return { ok: false, error: "URL должен начинаться с http:// или https://" };
  }
  try {
    new URL(trimmed);
  } catch {
    return { ok: false, error: "Некорректный URL SKILL.md" };
  }
  return { ok: true, url: trimmed };
}
