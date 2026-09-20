import { describe, expect, test } from "bun:test";

import {
  matchWorkspaceByName,
  pickWorkspaceTarget,
} from "./resolve-workspace";
import { notesWhereForScope, workspaceNoteIsOutOfScope } from "./note-scope";
import { validateWorkspaceCreate } from "./create-typed-workspace";
import { parseWorkspaceKind } from "./workspace-kind";
import { boundThreadChip } from "./composer-binding";

describe("parseWorkspaceKind", () => {
  test("accepts English kinds and Russian aliases", () => {
    expect(parseWorkspaceKind("music")).toBe("music");
    expect(parseWorkspaceKind("песня")).toBe("music");
    expect(parseWorkspaceKind("трек")).toBe("music");
    expect(parseWorkspaceKind("книга")).toBe("book");
    expect(parseWorkspaceKind("фильм")).toBe("film");
    expect(parseWorkspaceKind("приложение")).toBe("app");
    expect(parseWorkspaceKind("универсальный")).toBe("universal");
    expect(parseWorkspaceKind("  Песня  ")).toBe("music");
    expect(parseWorkspaceKind("song")).toBeNull();
    expect(parseWorkspaceKind("")).toBeNull();
  });
});

describe("validateWorkspaceCreate", () => {
  test("requires name and known type", () => {
    expect(validateWorkspaceCreate({ name: "   ", type: "music" })).toEqual({
      error: "Название не может быть пустым",
    });
    expect(validateWorkspaceCreate({ name: "Луна", type: "song" })).toEqual({
      error:
        "Тип воркспейса: film, book, music, app или universal (фильм, книга, музыка, песня, трек, приложение, универсальный)",
    });
    expect(validateWorkspaceCreate({ name: "Луна", type: "песня" })).toEqual({
      name: "Луна",
      type: "music",
      description: null,
    });
  });
});

describe("matchWorkspaceByName", () => {
  const rows = [
    { id: "1", name: "Лунная соната" },
    { id: "2", name: "Тишина" },
    { id: "3", name: "Тихий омут" },
  ];

  test("exact then startsWith then includes", () => {
    expect(matchWorkspaceByName(rows, "тишина")?.id).toBe("2");
    expect(matchWorkspaceByName(rows, "Тихий")?.id).toBe("3");
    expect(matchWorkspaceByName(rows, "сонат")?.id).toBe("1");
    expect(matchWorkspaceByName(rows, "нет такого")).toBeUndefined();
  });
});

describe("pickWorkspaceTarget", () => {
  test("workspace thread ignores foreign id and name", () => {
    expect(
      pickWorkspaceTarget("ws-open", "ws-other", "Чужая студия"),
    ).toEqual({ kind: "thread" });
  });

  test("global chat prefers id then name then none", () => {
    expect(pickWorkspaceTarget(null, "ws-1", "Луна")).toEqual({
      kind: "id",
      id: "ws-1",
    });
    expect(pickWorkspaceTarget(null, null, "Луна")).toEqual({
      kind: "name",
      name: "Луна",
    });
    expect(pickWorkspaceTarget(null, null, null)).toEqual({ kind: "none" });
  });
});

describe("note scope", () => {
  test("workspace where requires NoteLink", () => {
    expect(notesWhereForScope("u1", "ws-1")).toEqual({
      userId: "u1",
      links: { some: { projectId: "ws-1" } },
    });
    expect(notesWhereForScope("u1", null)).toEqual({ userId: "u1" });
  });

  test("workspace thread cannot see unlinked or foreign notes", () => {
    expect(workspaceNoteIsOutOfScope("ws-a", ["ws-b"])).toBe(true);
    expect(workspaceNoteIsOutOfScope("ws-a", [])).toBe(true);
    expect(workspaceNoteIsOutOfScope("ws-a", ["ws-a"])).toBe(false);
    expect(workspaceNoteIsOutOfScope(null, ["ws-b"])).toBe(false);
  });
});

describe("boundThreadChip", () => {
  test("music workspace is a track, not a project", () => {
    expect(
      boundThreadChip({ name: "Луна", origin: "workspace", type: "music" }),
    ).toEqual({ label: "Трек: Луна", kind: "workspace" });
    expect(boundThreadChip({ name: "App", origin: "template" })).toEqual({
      label: "Проект: App",
      kind: "project",
    });
  });
});
