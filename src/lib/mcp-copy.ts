/**
 * Honest MCP UI copy. Missing CLI / unsaved process is never «подключено».
 */

import type { McpServerDto } from "@/lib/workspace-types";

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
