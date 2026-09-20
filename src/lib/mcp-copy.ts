/**
 * Honest MCP UI copy. Missing CLI / unsaved process is never «подключено».
 */

import type { McpServerDto } from "@/lib/workspace-types";

export type McpCatalogView = "loading" | "error" | "empty" | "ready";

/** Failed registry fetch is never a zero-server catalog. */
export const MCP_CATALOG_EMPTY = "Серверов в реестре пока нет";
export const MCP_FILTER_EMPTY = "В этой категории серверов нет";
export const MCP_CONNECTED_EMPTY =
  "Ничего не включено — включите сервер из каталога";

export function mcpCatalogView(
  servers: unknown[] | null,
  loadError: string | null,
): McpCatalogView {
  if (loadError) return "error";
  if (servers === null) return "loading";
  if (servers.length === 0) return "empty";
  return "ready";
}

/** Filter-miss copy is not a failed registry fetch and not a zero catalog. */
export function mcpCatalogEmptyCopy(
  view: McpCatalogView,
  filter: string,
): string {
  if (view === "empty") return MCP_CATALOG_EMPTY;
  if (filter === "connected") return MCP_CONNECTED_EMPTY;
  return MCP_FILTER_EMPTY;
}

export function mcpToggleCopy(
  server: Pick<McpServerDto, "name" | "runtimeStatus" | "external">,
  enabled: boolean,
): { title: string; description: string } {
  if (!enabled) {
    return {
      title: `Сервер «${server.name}» отключён`,
      description: "Инструменты сервера скрыты из диалогов",
    };
  }
  if (server.runtimeStatus === "cli_missing") {
    return {
      title: `Сервер «${server.name}» включён — CLI не найден`,
      description:
        "Это не «подключено»: бинаря нет в PATH, инструменты недоступны.",
    };
  }
  if (server.runtimeStatus === "config_saved" || server.external) {
    return {
      title: `Сервер «${server.name}» сохранён в реестре`,
      description: "Конфиг есть; процесс не стартовал (stdio/sse — полная версия).",
    };
  }
  return {
    title: `Сервер «${server.name}» включён`,
    description: "Инструменты доступны оркестратору в чате",
  };
}
