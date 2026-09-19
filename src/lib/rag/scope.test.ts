import { describe, expect, test } from "bun:test";

import {
  chunkMatchesScope,
  filterChunksByScope,
  ragScopeFromThread,
  ragScopeLabel,
  resolveRetrieveScope,
} from "./scope";

const userA = "user-a";
const userB = "user-b";
const book = "proj-book";
const coder = "proj-coder";

const corpus = [
  { id: "1", userId: userA, projectId: book, sourceType: "section", body: "Тишина, глава 2" },
  { id: "2", userId: userA, projectId: coder, sourceType: "file", body: "export function agent()" },
  { id: "3", userId: userA, projectId: null, sourceType: "note", body: "инбокс без воркспейса" },
  { id: "4", userId: userB, projectId: book, sourceType: "section", body: "чужой канон" },
];

describe("ragScopeFromThread", () => {
  test("null projectId is global", () => {
    expect(ragScopeFromThread(userA, null)).toEqual({
      kind: "global",
      userId: userA,
      projectId: null,
    });
  });

  test("thread projectId is workspace", () => {
    expect(ragScopeFromThread(userA, coder)).toEqual({
      kind: "workspace",
      userId: userA,
      projectId: coder,
    });
  });
});

describe("resolveRetrieveScope", () => {
  test("workspace thread ignores a requested foreign workspaceId", () => {
    const scope = resolveRetrieveScope({
      userId: userA,
      threadProjectId: coder,
      requestedProjectId: book,
    });
    expect(scope).toEqual({ kind: "workspace", userId: userA, projectId: coder });
  });

  test("global chat may narrow to one owned workspace", () => {
    const scope = resolveRetrieveScope({
      userId: userA,
      threadProjectId: null,
      requestedProjectId: book,
    });
    expect(scope.kind).toBe("workspace");
    expect(scope.projectId).toBe(book);
  });
});

describe("workspace scope never leaks another project", () => {
  test("personal coder workspace sees only that projectId", () => {
    const scope = ragScopeFromThread(userA, coder);
    const hits = filterChunksByScope(corpus, scope);
    expect(hits.map((h) => h.id)).toEqual(["2"]);
    expect(hits.every((h) => h.projectId === coder)).toBe(true);
    expect(hits.some((h) => h.projectId === book)).toBe(false);
    expect(hits.some((h) => h.projectId == null)).toBe(false);
  });

  test("book workspace does not see coder files or inbox notes", () => {
    const hits = filterChunksByScope(corpus, ragScopeFromThread(userA, book));
    expect(hits.map((h) => h.id)).toEqual(["1"]);
  });
});

describe("global scope returns multiple projects for the same user", () => {
  test("includes book, coder, and inbox", () => {
    const hits = filterChunksByScope(corpus, ragScopeFromThread(userA, null));
    expect(hits.map((h) => h.id).sort()).toEqual(["1", "2", "3"]);
    const projects = new Set(hits.map((h) => h.projectId));
    expect(projects.has(book)).toBe(true);
    expect(projects.has(coder)).toBe(true);
    expect(projects.has(null)).toBe(true);
  });
});

describe("ragScopeLabel", () => {
  test("matches the chat badge copy", () => {
    expect(ragScopeLabel("global")).toBe("вся студия");
    expect(ragScopeLabel("workspace")).toBe("этот воркспейс");
  });
});

describe("other userId is isolated", () => {
  test("user A never sees user B chunks", () => {
    const globalA = filterChunksByScope(corpus, ragScopeFromThread(userA, null));
    const workspaceA = filterChunksByScope(corpus, ragScopeFromThread(userA, book));
    expect(globalA.some((h) => h.userId === userB)).toBe(false);
    expect(workspaceA.some((h) => h.userId === userB)).toBe(false);
    expect(chunkMatchesScope(corpus[3]!, ragScopeFromThread(userA, book))).toBe(false);
  });

  test("user B workspace still cannot read user A book chunks even with same projectId string", () => {
    const hits = filterChunksByScope(corpus, ragScopeFromThread(userB, book));
    expect(hits.map((h) => h.id)).toEqual(["4"]);
  });
});
