import { describe, expect, test } from "bun:test";

import {
  MCP_CATALOG_EMPTY,
  MCP_CONNECTED_EMPTY,
  MCP_FILTER_EMPTY,
  mcpCatalogEmptyCopy,
  mcpCatalogView,
  mcpToggleCopy,
} from "./mcp-copy";

describe("mcpToggleCopy never claims connected when CLI is missing", () => {
  test("cli_missing enable copy", () => {
    const copy = mcpToggleCopy(
      { name: "Playwright", runtimeStatus: "cli_missing", external: false },
      true,
    );
    expect(copy.title).not.toMatch(/подключ/i);
    expect(copy.description).toMatch(/не «подключено»|бинаря нет/i);
  });

  test("config_saved enable copy", () => {
    const copy = mcpToggleCopy(
      { name: "GitHub", runtimeStatus: "config_saved", external: true },
      true,
    );
    expect(copy.title).not.toMatch(/подключ/i);
    expect(copy.description).toMatch(/не стартовал/i);
  });
});

describe("mcpCatalogView", () => {
  test("load error is error, not an empty catalog", () => {
    expect(mcpCatalogView(null, "Не удалось загрузить реестр")).toBe("error");
    expect(mcpCatalogView([], "Не удалось загрузить реестр")).toBe("error");
  });

  test("null without error is loading; empty array is empty", () => {
    expect(mcpCatalogView(null, null)).toBe("loading");
    expect(mcpCatalogView([], null)).toBe("empty");
    expect(mcpCatalogView([{ id: "1" }], null)).toBe("ready");
  });

  test("empty catalog copy is not a filter miss and not a load error", () => {
    expect(mcpCatalogEmptyCopy("empty", "all")).toBe(MCP_CATALOG_EMPTY);
    expect(mcpCatalogEmptyCopy("ready", "connected")).toBe(MCP_CONNECTED_EMPTY);
    expect(mcpCatalogEmptyCopy("ready", "dev")).toBe(MCP_FILTER_EMPTY);
    expect(MCP_CATALOG_EMPTY).not.toMatch(/категор/i);
    expect(MCP_CATALOG_EMPTY).not.toMatch(/не удалось/i);
  });
});
