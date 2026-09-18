/**
 * MCP module — curated mock catalog (pure visual, no fetch).
 */

import type { LucideIcon } from "lucide-react";
import {
  AppWindow,
  BookOpen,
  Database,
  FolderOpen,
  Frame,
  Github,
  Hash,
  NotebookPen,
  ShieldAlert,
  Terminal,
} from "lucide-react";

export type McpCategory = "dev" | "content" | "data";
export type McpStatus = "connected" | "available" | "soon";
export type McpFilter = "all" | "connected" | "dev" | "content" | "data";

export const CATEGORY_LABEL: Record<McpCategory, string> = {
  dev: "Разработка",
  content: "Контент",
  data: "Данные",
};

export const FILTER_LABEL: Record<McpFilter, string> = {
  all: "Все",
  connected: "Подключённые",
  dev: "Разработка",
  content: "Контент",
  data: "Данные",
};

export interface McpServer {
  id: string;
  name: string;
  icon: LucideIcon;
  category: McpCategory;
  /** Базовый статус из каталога; «Подключить» переключает локально. */
  status: McpStatus;
  description: string;
  tools: number;
  /** Строка для блока «Настроить» (stdio-команда сервера). */
  config: string;
  /** Пользовательский сервер (не из каталога). */
  own?: boolean;
}

export const SERVERS: McpServer[] = [
  {
    id: "github",
    name: "GitHub",
    icon: Github,
    category: "dev",
    status: "connected",
    description: "Проверка PR и Issues, поиск по репозиториям",
    tools: 18,
    config: '"github": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-github"] }',
  },
  {
    id: "playwright",
    name: "Playwright",
    icon: AppWindow,
    category: "dev",
    status: "connected",
    description: "Управление браузером, скриншоты и e2e-тесты",
    tools: 12,
    config: '"playwright": { "command": "npx", "args": ["-y", "@playwright/mcp@latest"] }',
  },
  {
    id: "filesystem",
    name: "Filesystem",
    icon: FolderOpen,
    category: "data",
    status: "connected",
    description: "Файлы воркспейса: чтение, запись, поиск",
    tools: 8,
    config: '"filesystem": { "command": "bunx", "args": ["mcp-filesystem", "--root", "./workspace"] }',
  },
  {
    id: "pocket-utils",
    name: "pocket-utils",
    icon: Terminal,
    category: "dev",
    status: "connected",
    description: "Ваш stdio-сервер: счётчик слов, YAML-валидатор",
    tools: 5,
    config: '"pocket-utils": { "command": "bun", "args": ["./tools/mcp-server.js"] }',
    own: true,
  },
  {
    id: "postgresql",
    name: "PostgreSQL",
    icon: Database,
    category: "data",
    status: "available",
    description: "Запросы к базе данных, схема и миграции",
    tools: 11,
    config: '"postgres": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-postgres", "postgres://localhost/studio"] }',
  },
  {
    id: "context7",
    name: "Context7",
    icon: BookOpen,
    category: "content",
    status: "available",
    description: "Актуальная документация библиотек для промптов",
    tools: 6,
    config: '"context7": { "command": "npx", "args": ["-y", "@upstash/context7-mcp"] }',
  },
  {
    id: "figma",
    name: "Figma",
    icon: Frame,
    category: "dev",
    status: "available",
    description: "Макеты, токены и экспорт ассетов",
    tools: 9,
    config: '"figma": { "command": "npx", "args": ["-y", "figma-developer-mcp", "--figma-api-key=••••"] }',
  },
  {
    id: "notion",
    name: "Notion",
    icon: NotebookPen,
    category: "content",
    status: "soon",
    description: "Страницы и базы заметок Notion",
    tools: 15,
    config: '"notion": { "command": "npx", "args": ["-y", "@notionhq/notion-mcp-server"] }',
  },
  {
    id: "slack",
    name: "Slack",
    icon: Hash,
    category: "content",
    status: "soon",
    description: "Сообщения и каналы команды",
    tools: 22,
    config: '"slack": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-slack"] }',
  },
  {
    id: "sentry",
    name: "Sentry",
    icon: ShieldAlert,
    category: "dev",
    status: "soon",
    description: "Ошибки продакшена и тренды релизов",
    tools: 7,
    config: '"sentry": { "command": "npx", "args": ["-y", "@sentry/mcp-server"] }',
  },
];

/** Сервер, который пользователь добавляет кнопкой «Добавить свой». */
export const CUSTOM_SERVER: McpServer = {
  id: "my-mcp-server",
  name: "my-mcp-server",
  icon: Terminal,
  category: "dev",
  status: "connected",
  description: "Ваш сервер: node ./mcp-server.js",
  tools: 3,
  config: '"my-mcp-server": { "command": "node", "args": ["./mcp-server.js"] }',
  own: true,
};

export const MCP_CONFIG_JSON = `{
  "mcpServers": {
    "github": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-github"] },
    "playwright": { "command": "npx", "args": ["-y", "@playwright/mcp@latest"] }
  }
}`;
