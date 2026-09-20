import { describe, expect, test } from "bun:test";

import {
  DOCUMENTS_LOAD_ERROR,
  documentsAfterCreate,
  documentsListView,
} from "./documents-list";

describe("documentsListView", () => {
  test("load error is error, not empty", () => {
    expect(documentsListView(false, true, 0)).toBe("error");
    expect(documentsListView(false, true, 2)).toBe("error");
  });

  test("successful empty list is empty", () => {
    expect(documentsListView(false, false, 0)).toBe("empty");
  });

  test("loading beats empty and error", () => {
    expect(documentsListView(true, false, 0)).toBe("loading");
    expect(documentsListView(true, true, 0)).toBe("loading");
  });
});

describe("documentsAfterCreate", () => {
  test("new document is prepended so the library is not a dead toast", () => {
    const next = documentsAfterCreate(
      [{ id: "a" }],
      { id: "b" },
    );
    expect(next.map((d) => d.id)).toEqual(["b", "a"]);
  });
});

describe("documents load copy", () => {
  test("error copy is not the empty library", () => {
    expect(DOCUMENTS_LOAD_ERROR).toMatch(/не удалось загрузить/i);
    expect(DOCUMENTS_LOAD_ERROR).not.toMatch(/пока нет/i);
  });
});
