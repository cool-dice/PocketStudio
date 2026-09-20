/**
 * Cheap token-ish chunking for markdown/text and code.
 * ~500–800 tokens with overlap; no tokenizer dependency.
 */

export interface TextChunk {
  ordinal: number;
  content: string;
  tokenCount: number;
}

/** Cyrillic-heavy text ≈ 2 chars/token; code/latin ≈ 4. */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  const cyr = (text.match(/\p{Script=Cyrillic}/gu) ?? []).length;
  const rest = Math.max(0, text.length - cyr);
  return Math.max(1, Math.ceil(cyr / 2 + rest / 4));
}

export function chunkText(
  text: string,
  opts: { targetTokens?: number; overlapTokens?: number } = {},
): TextChunk[] {
  const target = opts.targetTokens ?? 650;
  const overlap = opts.overlapTokens ?? 80;
  const trimmed = text.replace(/\r\n/g, "\n").trim();
  if (!trimmed) return [];

  const paragraphs = trimmed.split(/\n{2,}/);
  const blocks: string[] = [];
  let buf = "";
  let bufTokens = 0;
  const flush = () => {
    const piece = buf.trim();
    if (piece) blocks.push(piece);
    buf = "";
    bufTokens = 0;
  };

  for (const p of paragraphs) {
    const t = estimateTokens(p);
    if (t > target * 1.4) {
      flush();
      blocks.push(...splitLong(p, target));
      continue;
    }
    if (bufTokens + t > target && buf) flush();
    buf = buf ? `${buf}\n\n${p}` : p;
    bufTokens += t;
  }
  flush();

  return withOverlap(blocks, overlap);
}

export function chunkCode(text: string, path?: string | null): TextChunk[] {
  const trimmed = text.replace(/\r\n/g, "\n").trim();
  if (!trimmed) return [];
  const parts = splitCodeLogical(trimmed, path);
  const blocks: string[] = [];
  for (const part of parts) {
    if (estimateTokens(part) > 750) {
      blocks.push(...splitLong(part, 600));
    } else {
      blocks.push(part.trim());
    }
  }
  return withOverlap(
    blocks.filter((b) => b.length > 0),
    60,
  );
}

function splitCodeLogical(text: string, path?: string | null): string[] {
  const ext = (path ?? "").split(".").pop()?.toLowerCase() ?? "";
  const looksCode = /^(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|rb|php|cs|swift)$/.test(ext);
  if (!looksCode) return [text];
  const re =
    /(?:^|\n)(?=(?:export\s+)?(?:async\s+)?(?:function|class|const|let|var|def|fn|pub\s+(?:fn|struct|enum)|interface|type|impl)\b)/g;
  const parts = text.split(re).map((s) => s.trim()).filter(Boolean);
  return parts.length > 1 ? parts : [text];
}

function splitLong(text: string, target: number): string[] {
  const lines = text.split("\n");
  const out: string[] = [];
  let buf: string[] = [];
  let tokens = 0;
  for (const line of lines) {
    const t = estimateTokens(line);
    if (tokens + t > target && buf.length) {
      out.push(buf.join("\n"));
      buf = [];
      tokens = 0;
    }
    buf.push(line);
    tokens += t;
  }
  if (buf.length) out.push(buf.join("\n"));
  return out;
}

function withOverlap(blocks: string[], overlapTokens: number): TextChunk[] {
  const chunks: TextChunk[] = [];
  for (let i = 0; i < blocks.length; i++) {
    let content = blocks[i]!;
    if (i > 0 && overlapTokens > 0) {
      const prev = blocks[i - 1]!;
      const tail = tailTokens(prev, overlapTokens);
      if (tail) content = `${tail}\n${content}`;
    }
    chunks.push({
      ordinal: i,
      content,
      tokenCount: estimateTokens(content),
    });
  }
  return chunks;
}

function tailTokens(text: string, tokens: number): string {
  const words = text.split(/\s+/);
  if (words.length === 0) return "";
  const keep = Math.max(8, Math.min(words.length, tokens));
  return words.slice(-keep).join(" ");
}
