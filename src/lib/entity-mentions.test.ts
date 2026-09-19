import { describe, expect, test } from "bun:test";

import {
  entitiesFoundInText,
  mentionTitle,
  mentionsOfRefs,
  nameMentionedInText,
} from "./entity-mentions";

describe("entity mentions resolve/search", () => {
  test("linked section uses live title; unknown id stays a caption", () => {
    const hints = new Map([
      ["sec-1", { id: "sec-1", title: "Шторм у маяка", documentTitle: "Рукопись" }],
    ]);
    const mentions = mentionsOfRefs(
      { kind: "chapter", items: ["sec-1", "1"] },
      hints,
    );
    expect(mentions[0]).toEqual({
      id: "sec-1",
      title: "Шторм у маяка",
      documentTitle: "Рукопись",
      source: "linked",
    });
    expect(mentions[1]?.source).toBe("label");
    expect(mentions[1]?.title).toBe("гл. 1");
    expect(mentionTitle("SRS-2", "section")).toBe("SRS-2");
  });

  test("found-in-text skips already linked and short names", () => {
    const entities = [
      { id: "a", name: "Марина" },
      { id: "b", name: "Тимур" },
      { id: "c", name: "Я" },
    ];
    expect(nameMentionedInText("Марина", "Марина стоит у маяка.")).toBe(true);
    expect(
      entitiesFoundInText("Марина стоит у маяка.", entities, new Set(["a"])).map(
        (e) => e.id,
      ),
    ).toEqual([]);
    expect(
      entitiesFoundInText("Марина стоит у маяка.", entities, new Set()).map(
        (e) => e.id,
      ),
    ).toEqual(["a"]);
  });
});
