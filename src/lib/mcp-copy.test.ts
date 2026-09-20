import { describe, expect, test } from "bun:test";

import { mcpCatalogView, mcpToggleCopy } from "./mcp-copy";

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
});
