import { describe, expect, test } from "bun:test";

import { MAX_AGENT_FILE_BYTES } from "../../mini-services/agent-service/tools";
import {
  MAX_SECTION_CONTENT_CHARS,
  sectionContentFromModelOutput,
  sectionContentFromToolArg,
  sectionContentSchema,
} from "./section-content";

describe("shared section content cap", () => {
  test("HTTP and agent share 200_000 chars — 50_001 is allowed", () => {
    expect(MAX_SECTION_CONTENT_CHARS).toBe(200_000);
    expect(MAX_SECTION_CONTENT_CHARS).toBeGreaterThan(50_000);

    const mid = "x".repeat(50_001);
    expect(sectionContentSchema.safeParse(mid).success).toBe(true);
    expect(sectionContentFromToolArg(mid)).toBe(mid);
    expect(sectionContentFromToolArg(mid).length).toBe(50_001);
  });

  test("over the shared cap: HTTP rejects, agent slices", () => {
    const over = "x".repeat(MAX_SECTION_CONTENT_CHARS + 1);
    expect(sectionContentSchema.safeParse(over).success).toBe(false);
    expect(sectionContentFromToolArg(over).length).toBe(MAX_SECTION_CONTENT_CHARS);
  });

  test("disk write stays 200 KiB — chapter chars are not a disk raise", () => {
    expect(MAX_AGENT_FILE_BYTES).toBe(200 * 1024);
  });

  test("rewrite_section slices unbounded model output to 200k", () => {
    const over = "я".repeat(MAX_SECTION_CONTENT_CHARS + 40);
    const rewritten = sectionContentFromModelOutput("rewrite", "старый", over);
    expect(rewritten.length).toBe(MAX_SECTION_CONTENT_CHARS);
    expect(rewritten).toBe(over.slice(0, MAX_SECTION_CONTENT_CHARS));

    const mid = "x".repeat(50_001);
    expect(sectionContentFromModelOutput("write", "", mid).length).toBe(50_001);

    const continued = sectionContentFromModelOutput(
      "continue",
      "преамбула",
      over,
    );
    expect(continued.length).toBe(MAX_SECTION_CONTENT_CHARS);
    expect(continued.startsWith("преамбула\n\n")).toBe(true);
  });
});
