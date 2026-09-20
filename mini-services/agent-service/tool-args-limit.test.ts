import { describe, expect, test } from "bun:test";

import {
  LARGE_ARG_TOOLS,
  TOOL_ARGS_LIMIT,
  TOOL_ARGS_LIMIT_LARGE,
  TOOL_ARGS_TOO_LARGE,
  candidateOverLimit,
  gateToolPayload,
  peekToolName,
  prepareToolExecution,
  toolArgsLimitBytes,
  toolArgsTooLargeMessage,
} from "./tool-args-limit";

describe("tool args limits", () => {
  test("default tools cap at 256 KiB; file + chapter tools at 1 MiB", () => {
    expect(toolArgsLimitBytes("create_note")).toBe(TOOL_ARGS_LIMIT);
    expect(toolArgsLimitBytes("search_notes")).toBe(TOOL_ARGS_LIMIT);
    expect(toolArgsLimitBytes("retrieve_canon")).toBe(TOOL_ARGS_LIMIT);
    expect(toolArgsLimitBytes("write_file")).toBe(TOOL_ARGS_LIMIT_LARGE);
    expect(toolArgsLimitBytes("apply_patch")).toBe(TOOL_ARGS_LIMIT_LARGE);
    expect(toolArgsLimitBytes("rewrite_section")).toBe(TOOL_ARGS_LIMIT_LARGE);
    expect(toolArgsLimitBytes("append_section")).toBe(TOOL_ARGS_LIMIT_LARGE);
    expect(toolArgsLimitBytes("create_document")).toBe(TOOL_ARGS_LIMIT_LARGE);
    expect(TOOL_ARGS_LIMIT).toBe(256 * 1024);
    expect(TOOL_ARGS_LIMIT_LARGE).toBe(1024 * 1024);
    expect([...LARGE_ARG_TOOLS].sort()).toEqual(
      [
        "append_section",
        "apply_patch",
        "create_document",
        "rewrite_section",
        "write_file",
      ].sort(),
    );
  });

  test("Russian error names the tool and the cap", () => {
    const msg = toolArgsTooLargeMessage("create_note", TOOL_ARGS_LIMIT);
    expect(msg).toContain(TOOL_ARGS_TOO_LARGE);
    expect(msg).toContain("create_note");
    expect(msg).toContain("256 КБ");
    expect(msg).toMatch(/[А-Яа-яЁё]/);
    expect(toolArgsTooLargeMessage("write_file", TOOL_ARGS_LIMIT_LARGE)).toContain(
      "1 МБ",
    );
  });

  test("peekToolName reads tool / name from the JSON head", () => {
    expect(peekToolName('{"tool":"create_note","args":{}}')).toBe("create_note");
    expect(peekToolName('{"name":"apply_patch","arguments":{}}')).toBe(
      "apply_patch",
    );
    expect(peekToolName('{"function":{"name":"write_file"}}')).toBe("write_file");
    expect(peekToolName("plain text")).toBeNull();
  });

  test("candidateOverLimit rejects a 256 KiB+ create_note dump without caring about parse", () => {
    const raw = `{"tool":"create_note","args":{"text":"${"x".repeat(TOOL_ARGS_LIMIT + 8)}"}}`;
    const over = candidateOverLimit(raw, "create_note");
    expect(over?.ok).toBe(false);
    if (over?.ok === false) {
      expect(over.error).toContain(TOOL_ARGS_TOO_LARGE);
      expect(over.limitBytes).toBe(TOOL_ARGS_LIMIT);
    }
  });

  test("candidateOverLimit allows a 256 KiB+ write_file dump under 1 MiB", () => {
    const raw = `{"tool":"write_file","args":{"path":"a.ts","content":"${"x".repeat(TOOL_ARGS_LIMIT + 8)}"}}`;
    expect(candidateOverLimit(raw, "write_file")).toBeNull();
  });

  test("candidateOverLimit allows a 256 KiB+ rewrite_section dump under 1 MiB", () => {
    const body = "x".repeat(TOOL_ARGS_LIMIT + 8);
    const rewrite = `{"tool":"rewrite_section","args":{"instruction":"${body}"}}`;
    expect(candidateOverLimit(rewrite, "rewrite_section")).toBeNull();
    const append = `{"tool":"append_section","args":{"title":"Глава","content":"${body}"}}`;
    expect(candidateOverLimit(append, "append_section")).toBeNull();
    const create = `{"tool":"create_document","args":{"title":"Черновик","content":"${body}"}}`;
    expect(candidateOverLimit(create, "create_document")).toBeNull();
  });
});

describe("gateToolPayload / prepareToolExecution (execute wrapper)", () => {
  test("lets a small create_note through", () => {
    const gate = gateToolPayload({
      tool: "create_note",
      args: { text: "маяк" },
    });
    expect(gate).toEqual({ ok: true });
    const prepared = prepareToolExecution({
      tool: "create_note",
      args: { text: "маяк" },
    });
    expect(prepared.error).toBeNull();
    expect(JSON.parse(prepared.argsForStore)).toEqual({ text: "маяк" });
    expect(prepared.argsForEmit).toEqual({ text: "маяк" });
  });

  test("rejects oversized create_note args with RU error and empty store/emit", () => {
    const args = { text: "x".repeat(TOOL_ARGS_LIMIT + 8) };
    const gate = gateToolPayload({ tool: "create_note", args });
    expect(gate.ok).toBe(false);
    if (gate.ok) throw new Error("expected reject");
    expect(gate.error).toContain(TOOL_ARGS_TOO_LARGE);
    expect(gate.error).toMatch(/[А-Яа-яЁё]/);
    expect(gate.tool).toBe("create_note");

    const prepared = prepareToolExecution({ tool: "create_note", args });
    expect(prepared.error).toBe(gate.error);
    expect(prepared.argsForStore).toBe("{}");
    expect(prepared.argsForEmit).toEqual({});
  });

  test("write_file args between 256 KiB and 1 MiB still execute", () => {
    const args = { path: "a.ts", content: "x".repeat(TOOL_ARGS_LIMIT + 8) };
    expect(gateToolPayload({ tool: "write_file", args })).toEqual({ ok: true });
    expect(gateToolPayload({ tool: "apply_patch", args: { path: "a.ts", newText: args.content } }).ok).toBe(
      true,
    );
  });

  test("chapter tools between 256 KiB and 1 MiB still execute", () => {
    const content = "x".repeat(TOOL_ARGS_LIMIT + 8);
    expect(
      gateToolPayload({
        tool: "rewrite_section",
        args: { action: "custom", instruction: content },
      }),
    ).toEqual({ ok: true });
    expect(
      gateToolPayload({
        tool: "append_section",
        args: { title: "Глава", content },
      }).ok,
    ).toBe(true);
    expect(
      gateToolPayload({
        tool: "create_document",
        args: { title: "Черновик", content },
      }).ok,
    ).toBe(true);
  });

  test("rejects write_file / apply_patch over 1 MiB", () => {
    const args = { path: "a.ts", content: "x".repeat(TOOL_ARGS_LIMIT_LARGE + 8) };
    const write = gateToolPayload({ tool: "write_file", args });
    expect(write.ok).toBe(false);
    if (write.ok) throw new Error("expected reject");
    expect(write.error).toContain("1 МБ");
    expect(write.error).toContain("write_file");

    const patch = gateToolPayload({
      tool: "apply_patch",
      args: { path: "a.ts", newText: args.content },
    });
    expect(patch.ok).toBe(false);
  });

  test("rejects rewrite_section / chapter tools over 1 MiB", () => {
    const content = "x".repeat(TOOL_ARGS_LIMIT_LARGE + 8);
    const rewrite = gateToolPayload({
      tool: "rewrite_section",
      args: { instruction: content },
    });
    expect(rewrite.ok).toBe(false);
    if (rewrite.ok) throw new Error("expected reject");
    expect(rewrite.error).toContain("1 МБ");
    expect(rewrite.error).toContain("rewrite_section");

    expect(
      gateToolPayload({
        tool: "append_section",
        args: { title: "Глава", content },
      }).ok,
    ).toBe(false);
    expect(
      gateToolPayload({
        tool: "create_document",
        args: { title: "Черновик", content },
      }).ok,
    ).toBe(false);
  });

  test("alreadyRejected skips execute and does not persist the dump", () => {
    const error = toolArgsTooLargeMessage("apply_patch", TOOL_ARGS_LIMIT_LARGE);
    const prepared = prepareToolExecution(
      { tool: "apply_patch", args: { dump: "x".repeat(100) } },
      error,
    );
    expect(prepared.error).toBe(error);
    expect(prepared.argsForStore).toBe("{}");
    expect(prepared.argsForEmit).toEqual({});
  });
});
