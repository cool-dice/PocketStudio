import { describe, expect, test } from "bun:test";

import { mcpRuntimeStatus } from "./mcp-runtime";

describe("mcpRuntimeStatus", () => {
  test("disabled is off", () => {
    expect(
      mcpRuntimeStatus({
        enabled: false,
        external: false,
        adapter: "browser",
        agentBrowser: true,
      }),
    ).toBe("off");
  });

  test("external enabled is config_saved", () => {
    expect(
      mcpRuntimeStatus({
        enabled: true,
        external: true,
        adapter: null,
        agentBrowser: false,
      }),
    ).toBe("config_saved");
  });

  test("browser adapter without CLI is cli_missing", () => {
    expect(
      mcpRuntimeStatus({
        enabled: true,
        external: false,
        adapter: "browser",
        agentBrowser: false,
      }),
    ).toBe("cli_missing");
  });

  test("builtin fetch is ready without a binary", () => {
    expect(
      mcpRuntimeStatus({
        enabled: true,
        external: false,
        adapter: "fetch",
        agentBrowser: false,
      }),
    ).toBe("ready");
  });
});
