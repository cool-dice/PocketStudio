/**
 * Close dangling markdown tokens while a reply is still streaming so
 * ReactMarkdown does not flicker (unclosed `**`, `` ` ``, fences).
 */

function countUnescaped(src: string, token: string): number {
  let n = 0;
  let i = 0;
  while (i < src.length) {
    const at = src.indexOf(token, i);
    if (at < 0) break;
    n++;
    i = at + token.length;
  }
  return n;
}

function stripCompleteFences(src: string): string {
  return src.replace(/```[\s\S]*?```/g, "");
}

export function stabilizeStreamingMarkdown(src: string): string {
  if (!src) return src;
  let text = src;

  const fenceMarks = countUnescaped(text, "```");
  if (fenceMarks % 2 === 1) text += "\n```";

  const withoutFences = stripCompleteFences(text);
  if (countUnescaped(withoutFences, "`") % 2 === 1) text += "`";

  const forStars = stripCompleteFences(text).replace(/`[^`]*`/g, "");
  if (countUnescaped(forStars, "**") % 2 === 1) text += "**";
  const afterBold = forStars.replace(/\*\*[\s\S]*?\*\*/g, "");
  if (countUnescaped(afterBold, "*") % 2 === 1) text += "*";

  return text;
}
