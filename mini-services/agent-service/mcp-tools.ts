// PocketStudio MCP tools (Фаза D) — builtin-адаптеры реестра интеграций.
//
// Три инструмента, которые включает/выключает пользователь на экране
// «Интеграции» (строки McpServer в Postgres):
//   fetch      → fetch_url  (обычный HTTP + HTML→текст)
//              → web_search (DuckDuckGo HTML)
//   browser    → browser_read (agent-browser CLI: open + read + close)
//   filesystem → list_files/read_file/write_file/delete_file/checkpoint
//                (определены в tools.ts и тегированы mcpAdapter)
//
// Гейтинг выполняет server.ts (allowed adapters на ход), инструменты
// остаются io-free и userId-agnostic — паттерн 1:1 с tools.ts.

import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { ToolDef } from "./tools";

const execFileAsync = promisify(execFile);

// ─────────────────────────── shared helpers ───────────────────────────

/** Первая непустая строка аргумента. */
function optString(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

/** Простейший HTML → читаемый текст (теги/скрипты/сущности → пробел). */
function htmlToText(html: string): string {
  const entities: Record<string, string> = {
    "&nbsp;": " ",
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&apos;": "'",
    "&mdash;": "—",
    "&ndash;": "–",
    "&laquo;": "«",
    "&raquo;": "»",
    "&hellip;": "…",
    "&middot;": "·",
  };
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|blockquote|pre|ul|ol)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_m, code: string) => {
      const num = Number.parseInt(code, 10);
      return Number.isFinite(num) ? String.fromCodePoint(num) : " ";
    })
    .replace(/&[a-z#0-9]+;/gi, (m) => entities[m.toLowerCase()] ?? " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Только http/https (никаких file:// и localhost-обходов). */
function safeUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  return url.toString();
}

// ─────────────────────────── tool: fetch_url ───────────────────────────

const MAX_PAGE_TEXT = 6_000;

const fetchUrl: ToolDef = {
  name: "fetch_url",
  mcpAdapter: "fetch",
  description:
    "Прочитать веб-страницу по ссылке и получить её текст (статья, документация, пост). Используй, когда пользователь делится ссылкой, просит изучить материал или свериться с источником. Возвращает заголовок и очищенный текст страницы.",
  argsSchema: {
    url: "адрес страницы http(s)://… (обязательно)",
  },
  async execute(args: any) {
    if (typeof args !== "object" || args === null) {
      return { error: "Некорректные аргументы инструмента" };
    }
    const raw = optString(args.url, 2_000);
    if (!raw) return { error: "Аргумент url обязателен (адрес страницы)" };
    const url = safeUrl(raw);
    if (!url) {
      return { error: "Нужен корректный http(s) URL" };
    }

    try {
      const res = await fetch(url, {
        redirect: "follow",
        headers: {
          "user-agent":
            "PocketStudio/1.0 (+https://pocketstudio.local; fetch_url)",
          accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
        },
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) {
        return { error: `Страница недоступна (HTTP ${res.status})` };
      }
      const html = await res.text();
      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const title = (titleMatch?.[1] ? htmlToText(titleMatch[1]) : url).slice(0, 200);
      const text = htmlToText(html).slice(0, MAX_PAGE_TEXT);
      if (!text) {
        return { error: "Страница пустая или недоступна для чтения" };
      }
      return {
        message: `Страница прочитана: ${title} (${text.length} симв.)`,
        title,
        url: res.url || url,
        publishedTime: null,
        text,
      };
    } catch (err) {
      return {
        error:
          "Не удалось прочитать страницу: " +
          (err instanceof Error ? err.message : String(err)),
      };
    }
  },
};

// ─────────────────────────── tool: web_search ───────────────────────────

const webSearch: ToolDef = {
  name: "web_search",
  mcpAdapter: "fetch",
  description:
    "Поиск в интернете: свежие факты, документация, ссылки. Возвращает список результатов с заголовком, адресом и сниппетом. Используй, когда знаний может не хватать или пользователь просит найти что-то в сети.",
  argsSchema: {
    query: "поисковый запрос (обязательно, 2–200 символов)",
    num: "сколько результатов: 1–10 (по умолчанию 5)",
  },
  async execute(args: any) {
    if (typeof args !== "object" || args === null) {
      return { error: "Некорректные аргументы инструмента" };
    }
    const query = optString(args.query, 200);
    if (!query || query.length < 2) {
      return { error: "Аргумент query обязателен (поисковый запрос, 2–200 символов)" };
    }
    let num = 5;
    if (typeof args.num === "number" && Number.isFinite(args.num)) {
      num = Math.min(10, Math.max(1, Math.floor(args.num)));
    } else if (typeof args.num === "string" && args.num.trim() !== "") {
      const parsed = Number(args.num);
      if (Number.isFinite(parsed)) num = Math.min(10, Math.max(1, Math.floor(parsed)));
    }

    try {
      const searchUrl =
        "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(query);
      const res = await fetch(searchUrl, {
        headers: {
          "user-agent":
            "PocketStudio/1.0 (+https://pocketstudio.local; web_search)",
          accept: "text/html",
        },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        return { error: `Поиск недоступен (HTTP ${res.status})` };
      }
      const html = await res.text();
      const results: Array<{
        title: string;
        url: string;
        snippet: string;
        host: string;
      }> = [];
      const re =
        /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>|<td[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/td>)/gi;
      let match: RegExpExecArray | null;
      while ((match = re.exec(html)) && results.length < num) {
        const href = match[1] ?? "";
        const title = htmlToText(match[2] ?? "").slice(0, 200);
        const snippet = htmlToText(match[3] || match[4] || "").slice(0, 400);
        let resolved = href;
        try {
          const u = new URL(href, "https://duckduckgo.com");
          const uddg = u.searchParams.get("uddg");
          resolved = uddg ? decodeURIComponent(uddg) : u.toString();
        } catch {
          continue;
        }
        if (!resolved.startsWith("http")) continue;
        let host = "";
        try {
          host = new URL(resolved).host;
        } catch {
          host = "";
        }
        results.push({ title: title || resolved, url: resolved, snippet, host });
      }
      if (results.length === 0) {
        return { error: `По запросу «${query}» ничего не нашлось` };
      }
      return {
        message: `Нашёл ${results.length} ${results.length === 1 ? "результат" : "результатов"} по запросу «${query}»`,
        results,
      };
    } catch (err) {
      return {
        error:
          "Поиск не удался: " +
          (err instanceof Error ? err.message : String(err)),
      };
    }
  },
};

// ─────────────────────────── tool: browser_read ───────────────────────────

const MAX_BROWSER_TEXT = 8_000;

/** Запустить agent-browser CLI с таймаутом в именованной сессии сервиса
 *  (AGENT_BROWSER_SESSION изолирует браузер агента от чужих CLI-сессий:
 *  параллельный QA или другой browser_read не перехватят страницу). */
const AGENT_BROWSER_SESSION = "pocketstudio-agent";

async function runBrowserCli(
  args: string[],
  timeoutMs: number,
): Promise<string> {
  const { stdout } = await execFileAsync("agent-browser", args, {
    timeout: timeoutMs,
    maxBuffer: 4 * 1024 * 1024,
    env: {
      ...process.env,
      AGENT_BROWSER_SESSION,
    },
  });
  return stdout;
}

const browserRead: ToolDef = {
  name: "browser_read",
  mcpAdapter: "browser",
  description:
    "Открыть страницу в живом браузере (Playwright) и прочитать её как агент: реальный рендер, включая JS-сайты, которые недоступны обычному чтению. Возвращает заголовок и текст страницы. Медленнее fetch_url — используй для сложных страниц.",
  argsSchema: {
    url: "адрес страницы http(s)://… (обязательно)",
  },
  async execute(args: any) {
    if (typeof args !== "object" || args === null) {
      return { error: "Некорректные аргументы инструмента" };
    }
    const raw = optString(args.url, 2_000);
    if (!raw) return { error: "Аргумент url обязателен (адрес страницы)" };
    const url = safeUrl(raw);
    if (!url) {
      return { error: "Нужен корректный http(s) URL" };
    }

    try {
      // open → read → close (браузерная сессия не должна течь).
      await runBrowserCli(["open", url], 45_000);
      let text = "";
      let title = url;
      try {
        const out = await runBrowserCli(["read"], 30_000);
        text = out.trim();
        const firstLine = out.split("\n").find((l) => l.trim() !== "") ?? "";
        if (firstLine.startsWith("✓ ")) title = firstLine.slice(2).trim();
      } finally {
        try {
          await runBrowserCli(["close"], 10_000);
        } catch {
          // close — best effort
        }
      }
      if (!text) {
        return { error: "Браузер не смог прочитать страницу" };
      }
      return {
        message: `Страница прочитана браузером: ${title} (${Math.min(text.length, MAX_BROWSER_TEXT)} симв.)`,
        title: title.slice(0, 200),
        url,
        text: text.slice(0, MAX_BROWSER_TEXT),
      };
    } catch (err) {
      return {
        error:
          "Не удалось открыть страницу в браузере: " +
          (err instanceof Error ? err.message : String(err)),
      };
    }
  },
};

// ─────────────────────────── registry export ───────────────────────────

/** Инструменты builtin-адаптеров MCP (Фаза D) — гейтятся server.ts. */
export const MCP_TOOLS: ToolDef[] = [fetchUrl, webSearch, browserRead];
