import { describe, expect, test } from "bun:test";

import {
  enabledMcpAdapters,
  filesystemOffFromRows,
  mcpRuntimeStatus,
} from "./mcp-runtime";

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

  test("missing stdio command is cli_missing even if external", () => {
    expect(
      mcpRuntimeStatus({
        enabled: true,
        external: true,
        adapter: null,
        agentBrowser: true,
        commandExists: false,
      }),
    ).toBe("cli_missing");
  });
});

describe("enabledMcpAdapters gates tools", () => {
  test("disabled and external adapters are excluded", () => {
    const adapters = enabledMcpAdapters([
      { adapter: "fetch", enabled: true, external: false },
      { adapter: "filesystem", enabled: false, external: false },
      { adapter: "browser", enabled: true, external: false },
      { adapter: null, enabled: true, external: true },
    ]);
    expect([...adapters].sort()).toEqual(["browser", "fetch"]);
    expect(
      filesystemOffFromRows([
        { adapter: "filesystem", enabled: false },
        { adapter: "fetch", enabled: true },
      ]),
    ).toBe(true);
  });
});
