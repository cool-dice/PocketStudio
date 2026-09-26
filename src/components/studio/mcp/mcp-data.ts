/**
 * MCP module — UI-хелперы над реестром (Фаза D).
 *
 * Данные приходят из REST /api/mcp (строки McpServer пользователя,
 * DTO McpServerDto). Здесь только презентационные словари: иконки по
 * ключу каталога, подписи категорий/фильтров и фильтрующий предикат.
 */

import type { LucideIcon } from "lucide-react";
import {
  AppWindow,
  BookOpen,
  Boxes,
  Database,
  FolderOpen,
  Frame,
  Github,
  Globe,
  Hash,
  NotebookPen,
  ShieldAlert,
  Terminal,
} from "lucide-react";

import type { McpServerDto } from "@/lib/workspace-types";

export type McpFilter = "all" | "connected" | "dev" | "content" | "data";

export const FILTERS: McpFilter[] = ["all", "connected", "dev", "content", "data"];

export const FILTER_LABEL: Record<McpFilter, string> = {
  all: "Все",
  connected: "Включённые",
  dev: "Разработка",
  content: "Контент",
  data: "Данные",
};

export const CATEGORY_LABEL: Record<McpServerDto["category"], string> = {
  dev: "Разработка",
  content: "Контент",
  data: "Данные",
};

/** Иконки по ключу каталога (свои серверы — терминал). Статический
 *  lookup, чтобы не создавать компоненты во время рендера. */
export const MCP_ICON_BY_KEY: Record<string, LucideIcon> = {
  fetch: Globe,
  filesystem: FolderOpen,
  playwright: AppWindow,
  github: Github,
  postgresql: Database,
  context7: BookOpen,
  figma: Frame,
  notion: NotebookPen,
  slack: Hash,
  sentry: ShieldAlert,
};

/** Иконка-фолбэк для своих серверов. */
export const MCP_OWN_ICON: LucideIcon = Terminal;
export const MCP_FALLBACK_ICON: LucideIcon = Boxes;

/** Человекочитаемый конфиг для свёрнутой карточки. */
export function configPreview(server: McpServerDto): string {
  if (server.transport === "builtin") {
    return JSON.stringify({ transport: "builtin", adapter: server.adapter });
  }
  return JSON.stringify(server.config);
}

/** Применить активный фильтр к списку серверов. */
export function applyFilter(
  servers: McpServerDto[],
  filter: McpFilter,
): McpServerDto[] {
  switch (filter) {
    case "connected":
      return servers.filter((s) => s.enabled);
    case "dev":
    case "content":
    case "data":
      return servers.filter((s) => s.category === filter);
    default:
      return servers;
  }
}
