import { describe, expect, test } from "bun:test";

import {
  compactAttributes,
  compactTags,
  relatedFromLinks,
  sameAttributes,
  sameStringList,
  uniqueRelated,
} from "./entity-meta";

describe("entity-meta compact/normalize", () => {
  test("drops empty attribute rows and trims", () => {
    expect(
      compactAttributes([
        { label: "  Возраст ", value: " 17 " },
        { label: "  ", value: "" },
        { label: "", value: "маяк" },
      ]),
    ).toEqual([
      { label: "Возраст", value: "17" },
      { label: "", value: "маяк" },
    ]);
  });

  test("tags strip hash, empty and case-insensitive dupes", () => {
    expect(compactTags([" #Упрямая ", "упрямая", "", "#маяк"])).toEqual([
      "Упрямая",
      "маяк",
    ]);
  });

  test("related drops self and duplicates; links merge both directions", () => {
    expect(uniqueRelated(["a", "a", "self", "b"], "self")).toEqual(["a", "b"]);
    expect(
      relatedFromLinks([{ toId: "a" }, { toId: "b" }], [{ fromId: "b" }, { fromId: "c" }]),
    ).toEqual(["a", "b", "c"]);
  });

  test("sameAttributes / sameStringList compare contents", () => {
    expect(
      sameAttributes([{ label: "k", value: "v" }], [{ label: "k", value: "v" }]),
    ).toBe(true);
    expect(
      sameAttributes([{ label: "k", value: "v" }], [{ label: "k", value: "x" }]),
    ).toBe(false);
    expect(sameStringList(["b", "a"], ["a", "b"])).toBe(true);
    expect(sameStringList(["a"], ["a", "b"])).toBe(false);
  });
});
