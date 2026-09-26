import { describe, expect, test } from "bun:test";

import {
  clampFloater,
  replaceTextRange,
  selectionReplacementFromModel,
  selectionTargetFromRange,
} from "./selection-rewrite";

const chapter = "Маяк светил. Шторм не стихал. Чайки кричали.";

describe("selection rewrite", () => {
  test("empty and inverted ranges do not open a target", () => {
    expect(selectionTargetFromRange(chapter, 4, 4)).toBeNull();
    expect(selectionTargetFromRange(chapter, 8, 3)).toBeNull();
    expect(selectionTargetFromRange(chapter, -1, 2)).toBeNull();
    expect(selectionTargetFromRange(chapter, 0, chapter.length + 1)).toBeNull();
  });

  test("replaces only the selected span", () => {
    const phrase = "Шторм не стихал.";
    const start = chapter.indexOf(phrase);
    const end = start + phrase.length;
    expect(replaceTextRange(chapter, start, end, "Море стихло.")).toBe(
      "Маяк светил. Море стихло. Чайки кричали.",
    );
  });

  test("shorter and longer replacements keep the surrounding chapter", () => {
    expect(replaceTextRange("абвгде", 2, 4, "X")).toBe("абXде");
    expect(replaceTextRange("абвгде", 2, 4, "XYZ")).toBe("абXYZде");
    expect(replaceTextRange(chapter, 0, "Маяк".length, "Башня")).toBe(
      "Башня светил. Шторм не стихал. Чайки кричали.",
    );
  });

  test("strips a model fence and keeps the fragment", () => {
    expect(selectionReplacementFromModel("  Море стихло.  ")).toBe("Море стихло.");
    expect(
      selectionReplacementFromModel("```text\nМоре стихло.\n```"),
    ).toBe("Море стихло.");
    expect(selectionReplacementFromModel("```\n\n```")).toBe("");
  });

  test("floater stays inside the viewport", () => {
    const nearEnd = clampFloater({
      anchorTop: 700,
      anchorLeft: 900,
      width: 320,
      height: 140,
      viewportWidth: 1000,
      viewportHeight: 800,
    });
    expect(nearEnd.left + 320).toBeLessThanOrEqual(1000 - 8);
    expect(nearEnd.top + 140).toBeLessThanOrEqual(800 - 8);
    expect(nearEnd.top).toBeLessThan(700);

    const open = clampFloater({
      anchorTop: 120,
      anchorLeft: 40,
      width: 320,
      height: 140,
      viewportWidth: 1000,
      viewportHeight: 800,
    });
    expect(open).toEqual({ top: 142, left: 40 });
  });
});
