import { describe, expect, test } from "bun:test";

import { documentDto } from "./workspace-shapes";

describe("documentDto list honesty", () => {
  const base = {
    id: "d1",
    projectId: "p1",
    title: "Раскадровка фильма",
    description: null,
    kind: "script",
    updatedAt: new Date("2026-09-20T12:00:00.000Z"),
  };

  test("content-only sections still count chapters", () => {
    const dto = documentDto({
      ...base,
      sections: [
        { content: "кадр один" },
        { content: "кадр два" },
        { content: "кадр три" },
        { content: "кадр четыре" },
      ],
    });
    expect(dto.sectionsCount).toBe(4);
    expect(dto.sections).toBeUndefined();
    expect(dto.wordsCount).toBe(8);
  });

  test("_count is used when section rows are omitted", () => {
    const dto = documentDto({
      ...base,
      _count: { sections: 3 },
    });
    expect(dto.sectionsCount).toBe(3);
  });

  test("truly empty document is 0, not a ghost chapter", () => {
    const dto = documentDto({
      ...base,
      sections: [],
      _count: { sections: 0 },
    });
    expect(dto.sectionsCount).toBe(0);
    expect(dto.sections).toBeUndefined();
  });
});
