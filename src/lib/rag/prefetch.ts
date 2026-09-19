/**
 * Heuristic prefetch for retrieve_canon: run RAG before the first model
 * turn on content/code questions. Trivial chitchat stays untouched.
 */

const CHITCHAT =
  /^(привет|здравствуй(?:те)?|хай|hi|hello|hey|ок|ok|спасибо|thanks|thank you|пожалуйста|добрый (?:день|вечер|утро)|как дела|что нового|пока|bye)[\s!.?…]*$/i;

const CANON_HINT =
  /глав|персонаж|канон|файл|код|api|путь|\.tsx|\.ts|\.js|глаз|кто |что |как |где |почему|зачем|function|import |class |интерфейс|сущност|докумен|скилл|напоминан|проект|воркспейс|марин|marina|chapter|scene/i;

export function looksLikeCanonQuestion(text: string): boolean {
  const t = text.trim();
  if (!t || t.length < 8) return false;
  if (CHITCHAT.test(t)) return false;
  if (/[?]/.test(t)) return true;
  if (t.length >= 40) return true;
  return CANON_HINT.test(t);
}

export function formatPrefetchBlock(
  hits: Array<{
    title: string;
    excerpt: string;
    path?: string | null;
    workspaceName?: string | null;
  }>,
): string {
  if (hits.length === 0) return "";
  const lines = hits.slice(0, 6).map((h, i) => {
    const loc = [h.workspaceName, h.path ?? h.title].filter(Boolean).join(" · ");
    return `${i + 1}. ${loc}\n${h.excerpt}`;
  });
  return (
    "Автоконтекст RAG (извлечён до первого ответа; при необходимости вызови retrieve_canon повторно):\n" +
    lines.join("\n\n")
  );
}
