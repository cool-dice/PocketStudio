import { describe, expect, test } from "bun:test";

import { rankCanonHits, tokenizeQuery } from "./retrieve";

describe("tokenizeQuery", () => {
  test("keeps cyrillic terms", () => {
    expect(tokenizeQuery("Глаза Марины карие")).toEqual(["глаза", "марины", "карие"]);
  });
});

describe("rankCanonHits", () => {
  test("ranks the matching note above noise", () => {
    const hits = rankCanonHits("карие глаза", [
      {
        kind: "note",
        id: "1",
        title: "Портрет",
        body: "У Марины карие глаза в главе 2",
        workspaceId: "w1",
      },
      {
        kind: "section",
        id: "2",
        title: "Глава 1",
        body: "Погода была скверная",
        workspaceId: "w1",
      },
    ]);
    expect(hits[0]?.id).toBe("1");
    expect(hits[0]?.excerpt.toLowerCase()).toContain("карие");
    expect(hits.some((h) => h.id === "2")).toBe(false);
  });
});
