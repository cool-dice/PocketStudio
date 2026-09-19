/**
 * MCP-каталог (Фаза D) — фиксированный список известных серверов.
 *
 * Используется двумя сторонами:
 *  - Next REST /api/mcp — лениво засеивает строки McpServer на пользователя;
 *  - фронтенд рисует каталог и честно помечает builtin-адаптеры
 *    (реальные инструменты в песочнице) против внешних stdio/sse
 *    (только сохранённый конфиг).
 *
 * builtin-адаптеры разложены по ключам agent-service:
 *  - filesystem → list_files/read_file/write_file/delete_file/checkpoint
 *  - fetch      → fetch_url/web_search (z-ai-web-dev-sdk page_reader/search)
 *  - browser    → browser_read (agent-browser CLI)
 */

export type McpCategory = "dev" | "content" | "data";
export type McpTransport = "builtin" | "stdio" | "sse";
export type McpAdapter = "filesystem" | "fetch" | "browser";

export interface McpCatalogItem {
  key: string;
  name: string;
  description: string;
  category: McpCategory;
  transport: McpTransport;
  /** Ключ builtin-адаптера песочницы (null для внешних серверов). */
  adapter: McpAdapter | null;
  /** true → в песочнице работают только конфиги, инструменты недоступны. */
  external: boolean;
  toolsCount: number;
  /** Исходное состояние после посева каталога. */
  defaultEnabled: boolean;
  /** Конфиг транспортом: stdio {command,args,env} · sse {url} · builtin {}. */
  config: Record<string, unknown>;
}

export const MCP_CATALOG: McpCatalogItem[] = [
  {
    key: "fetch",
    name: "Fetch",
    description:
      "Чтение веб-страниц и поиск в интернете — реально работает в песочнице",
    category: "content",
    transport: "builtin",
    adapter: "fetch",
    external: false,
    toolsCount: 2,
    defaultEnabled: true,
    config: {},
  },
  {
    key: "filesystem",
    name: "Filesystem",
    description: "Файлы воркспейса: чтение, запись, поиск, git-чекпоинты",
    category: "data",
    transport: "builtin",
    adapter: "filesystem",
    external: false,
    toolsCount: 5,
    defaultEnabled: true,
    config: { root: "./workspace" },
  },
  {
    key: "playwright",
    name: "Playwright",
    description:
      "Живой браузер: открыть страницу и прочитать её как агент",
    category: "dev",
    transport: "builtin",
    adapter: "browser",
    external: false,
    toolsCount: 1,
    defaultEnabled: true,
    config: {},
  },
  {
    key: "github",
    name: "GitHub",
    description: "Проверка PR и Issues, поиск по репозиториям",
    category: "dev",
    transport: "stdio",
    adapter: null,
    external: true,
    toolsCount: 18,
    defaultEnabled: false,
    config: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-github"],
    },
  },
  {
    key: "postgresql",
    name: "PostgreSQL",
    description: "Запросы к базе данных, схема и миграции",
    category: "data",
    transport: "stdio",
    adapter: null,
    external: true,
    toolsCount: 11,
    defaultEnabled: false,
    config: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-postgres"],
    },
  },
  {
    key: "context7",
    name: "Context7",
    description: "Актуальная документация библиотек для промптов",
    category: "content",
    transport: "stdio",
    adapter: null,
    external: true,
    toolsCount: 6,
    defaultEnabled: false,
    config: { command: "npx", args: ["-y", "@upstash/context7-mcp"] },
  },
  {
    key: "figma",
    name: "Figma",
    description: "Макеты, токены и экспорт ассетов",
    category: "dev",
    transport: "stdio",
    adapter: null,
    external: true,
    toolsCount: 9,
    defaultEnabled: false,
    config: {
      command: "npx",
      args: ["-y", "figma-developer-mcp", "--figma-api-key=••••"],
    },
  },
  {
    key: "notion",
    name: "Notion",
    description: "Страницы и базы заметок Notion",
    category: "content",
    transport: "stdio",
    adapter: null,
    external: true,
    toolsCount: 15,
    defaultEnabled: false,
    config: {
      command: "npx",
      args: ["-y", "@notionhq/notion-mcp-server"],
    },
  },
  {
    key: "slack",
    name: "Slack",
    description: "Сообщения и каналы команды",
    category: "content",
    transport: "stdio",
    adapter: null,
    external: true,
    toolsCount: 22,
    defaultEnabled: false,
    config: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-slack"],
    },
  },
  {
    key: "sentry",
    name: "Sentry",
    description: "Ошибки продакшена и тренды релизов",
    category: "dev",
    transport: "stdio",
    adapter: null,
    external: true,
    toolsCount: 7,
    defaultEnabled: false,
    config: {
      command: "npx",
      args: ["-y", "@sentry/mcp-server"],
    },
  },
];

/** Порядок каталога для сортировки списка (свои серверы — в конец). */
export function catalogOrder(key: string | null): number {
  if (!key) return MCP_CATALOG.length;
  const idx = MCP_CATALOG.findIndex((c) => c.key === key);
  return idx < 0 ? MCP_CATALOG.length : idx;
}

/** Валидация конфига по транспорту (для PATCH/POST своего сервера). */
export function validateMcpConfig(
  transport: McpTransport,
  config: unknown,
): { ok: true; config: Record<string, unknown> } | { ok: false; error: string } {
  if (typeof config !== "object" || config === null || Array.isArray(config)) {
    return { ok: false, error: "Конфиг должен быть JSON-объектом" };
  }
  const cfg = config as Record<string, unknown>;

  if (transport === "sse") {
    const url = typeof cfg.url === "string" ? cfg.url.trim() : "";
    if (!/^https?:\/\//.test(url)) {
      return { ok: false, error: "SSE-конфиг требует поле url (http/https)" };
    }
    return { ok: true, config: { url: url } };
  }

  if (transport === "stdio") {
    const command = typeof cfg.command === "string" ? cfg.command.trim() : "";
    if (!command) {
      return { ok: false, error: "stdio-конфиг требует поле command" };
    }
    const args = Array.isArray(cfg.args)
      ? cfg.args.filter(
          (a): a is string => typeof a === "string" && a.trim() !== "",
        )
      : [];
    const env =
      typeof cfg.env === "object" && cfg.env !== null && !Array.isArray(cfg.env)
        ? (cfg.env as Record<string, string>)
        : {};
    return { ok: true, config: { command, ...(args.length ? { args } : {}), ...(Object.keys(env).length ? { env } : {}) } };
  }

  // builtin — конфиг не нужен, сохраняем как есть (плоский объект ≤ 10 полей).
  const keys = Object.keys(cfg);
  if (keys.length > 10) {
    return { ok: false, error: "Слишком много полей в конфиге" };
  }
  return { ok: true, config: cfg };
}
