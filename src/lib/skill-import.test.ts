import { describe, expect, test } from "bun:test";

import {
  looksLikeHtml,
  validateImportedSkillMd,
  validateSkillImportUrl,
} from "./skill-import";

describe("skill import rejects HTML and junk as failure", () => {
  test("HTML is not SKILL.md", () => {
    expect(looksLikeHtml("<!DOCTYPE html><html><body>404</body></html>")).toBe(
      true,
    );
    const result = validateImportedSkillMd(
      "<html><head><title>Not found</title></head></html>",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).not.toMatch(/успеш/i);
      expect(result.error).toMatch(/HTML/i);
    }
  });

  test("empty markdown fails", () => {
    const result = validateImportedSkillMd("  hi  ");
    expect(result.ok).toBe(false);
  });

  test("real SKILL.md passes", () => {
    const result = validateImportedSkillMd(
      "---\nname: Копирайтер\n---\n\n## Когда использовать\nПиши главы",
    );
    expect(result.ok).toBe(true);
  });

  test("URL must be http(s)", () => {
    expect(validateSkillImportUrl("ftp://example.com/SKILL.md").ok).toBe(false);
    expect(validateSkillImportUrl("not a url").ok).toBe(false);
    expect(validateSkillImportUrl("https://example.com/SKILL.md").ok).toBe(true);
  });
});
