import { describe, expect, test } from "bun:test";

import { mcpToggleCopy } from "./mcp-copy";

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
