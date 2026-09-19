import { describe, expect, test } from "bun:test";

import {
  artifactSearchHref,
  documentSearchHref,
  emptySearchResults,
  entitySearchHref,
  mapArtifactHits,
  mapDocumentHits,
  mapEntityHits,
  searchExcerpt,
  searchMatches,
  searchSnippet,
  searchTotal,
  SEARCH_MIN_QUERY,
} from "./search";

describe("search matching", () => {
  test("matches ASCII and Cyrillic case-insensitively", () => {
    expect(searchMatches("Хроники Долгой Зимы", "зимы")).toBe(true);
    expect(searchMatches("PocketStudio", "pocket")).toBe(true);
    expect(searchMatches("Маяк", "МАЯК")).toBe(true);
    expect(searchMatches(null, "a")).toBe(false);
    expect(searchMatches("", "ab")).toBe(false);
  });

  test("excerpt windows around the first hit", () => {
    const text = "В начале была мысль, потом маяк за фьордом, потом тишина.";
    const excerpt = searchExcerpt(text, "маяк", 8);
    expect(excerpt).toContain("маяк");
    expect(excerpt.startsWith("…")).toBe(true);
    expect(excerpt.endsWith("…")).toBe(true);
  });

  test("empty results are zeroed and min query is 2", () => {
    const empty = emptySearchResults();
    expect(searchTotal(empty)).toBe(0);
    expect(empty.threads).toEqual([]);
    expect(empty.notes).toEqual([]);
    expect(empty.projects).toEqual([]);
    expect(empty.documents).toEqual([]);
    expect(empty.entities).toEqual([]);
    expect(empty.artifacts).toEqual([]);
    expect(SEARCH_MIN_QUERY).toBe(2);
  });
});

describe("search hrefs and bounded snippets", () => {
  test("documents open the manuscript, entities use documents tab or query", () => {
    expect(documentSearchHref("ws1", "clastworkdoc01")).toBe(
      "/w/ws1?tab=documents&doc=clastworkdoc01",
    );
    expect(entitySearchHref("ws1", "Марина", "book")).toBe(
      "/w/ws1?tab=documents&q=%D0%9C%D0%B0%D1%80%D0%B8%D0%BD%D0%B0",
    );
    expect(entitySearchHref("ws1", "Марина", "music")).toBe(
      "/w/ws1?q=%D0%9C%D0%B0%D1%80%D0%B8%D0%BD%D0%B0",
    );
  });

  test("image artifacts on film go to images tab; otherwise library", () => {
    expect(artifactSearchHref("ws1", "image", "film")).toBe("/w/ws1?tab=images");
    expect(artifactSearchHref("ws1", "image", "book")).toBe("/?area=library");
    expect(artifactSearchHref("ws1", "audio", "film")).toBe("/?area=library");
  });

  test("mappers match title/name/kind and never copy huge bodies", () => {
    const huge = "секретное-тело-" + "я".repeat(4000);
    const docs = mapDocumentHits(
      [{ id: "d1", title: "Глава маяк", kind: "manuscript", projectId: "ws1" }],
      "маяк",
    );
    expect(docs).toEqual([
      {
        id: "d1",
        title: "Глава маяк",
        snippet: "manuscript",
        kind: "manuscript",
        projectId: "ws1",
        href: "/w/ws1?tab=documents&doc=d1",
      },
    ]);
    expect(JSON.stringify(docs)).not.toContain(huge);

    const entities = mapEntityHits(
      [
        {
          id: "e1",
          name: "Марина",
          kind: "character",
          short: "смотрит на маяк",
          projectId: "ws1",
          workspaceType: "book",
        },
      ],
      "марин",
    );
    expect(entities[0]?.name).toBe("Марина");
    expect(entities[0]?.snippet).toContain("маяк");
    expect(entities[0]?.href).toContain("tab=documents");

    const artifacts = mapArtifactHits(
      [
        {
          id: "a1",
          title: "Портрет у фьорда",
          type: "image",
          projectId: "ws1",
          workspaceType: "film",
        },
        {
          id: "a2",
          title: "голос",
          type: "audio",
          projectId: "ws1",
          workspaceType: "film",
        },
      ],
      "image",
    );
    expect(artifacts.map((hit) => hit.id)).toEqual(["a1"]);
    expect(artifacts[0]?.href).toBe("/w/ws1?tab=images");
    const snippet = searchSnippet(huge, "нетсовпадения", "kind");
    expect(snippet.length).toBeLessThan(120);
    expect(snippet.length).toBeLessThan(huge.length);
  });
});
