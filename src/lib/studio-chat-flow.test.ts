import { describe, expect, test } from "bun:test";

import {
  matchWorkspaceByName,
  pickWorkspaceTarget,
} from "./resolve-workspace";
import { notesWhereForScope, workspaceNoteIsOutOfScope } from "./note-scope";
import { validateWorkspaceCreate } from "./create-typed-workspace";
import { parseWorkspaceKind } from "./workspace-kind";
import { boundChipFromLists, boundThreadChip, notificationOpensWorkspace, LINKED_TARGETS_TITLE, LINKED_TARGETS_EMPTY, linkedTargetAria, isStudioOrigin } from "./composer-binding";
import {
  CODE_PROJECT_SLASH,
  slashOpensWorkspaceType,
  WORKSPACE_SLASH_COMMANDS,
} from "./slash-catalog";
import { emptyDawState } from "./daw-empty";
import { dawHasAudibleContent } from "./daw-model";
import { pathFor } from "./app-url";
import { DAW_EMPTY_TRACKS, DAW_LOAD_ERROR } from "./audio-copy";

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
  test("music workspace is a track, not a project, and href is /w/{id}", () => {
    expect(
      boundThreadChip({
        name: "Луна",
        origin: "workspace",
        type: "music",
        id: "ws-luna",
      }),
    ).toEqual({
      label: "Трек: Луна",
      kind: "workspace",
      href: "/w/ws-luna",
    });
    expect(pathFor("workspace", "ws-luna", "chat")).toBe("/w/ws-luna");
    expect(boundThreadChip({ name: "App", origin: "template", id: "code-1" })).toEqual({
      label: "Проект: App",
      kind: "project",
      href: null,
    });
  });

  test("list lookup prefers studio over a code row with the same id", () => {
    expect(
      boundChipFromLists({
        id: "ws-luna",
        workspace: { id: "ws-luna", name: "Луна", type: "music" },
        project: { id: "ws-luna", name: "Луна", origin: "template" },
      }),
    ).toEqual({
      label: "Трек: Луна",
      kind: "workspace",
      href: "/w/ws-luna",
    });
    expect(
      boundChipFromLists({
        id: "code-1",
        workspace: null,
        project: { id: "code-1", name: "App", origin: "github" },
      }),
    ).toEqual({
      label: "Проект: App",
      kind: "project",
      href: null,
    });
  });
});

describe("notebook linked targets", () => {
  test("copy does not call a studio a project", () => {
    expect(LINKED_TARGETS_TITLE).toMatch(/студи/i);
    expect(LINKED_TARGETS_TITLE).toMatch(/проект/i);
    expect(LINKED_TARGETS_EMPTY).toMatch(/студи/i);
    expect(LINKED_TARGETS_EMPTY).not.toBe("Пока нет связанных проектов.");
    expect(isStudioOrigin("workspace")).toBe(true);
    expect(isStudioOrigin("template")).toBe(false);
    expect(linkedTargetAria("workspace", "Луна", "open")).toMatch(/воркспейс/i);
    expect(linkedTargetAria("project", "App", "open")).toMatch(/проект/i);
    expect(linkedTargetAria("workspace", "Луна", "open")).not.toMatch(
      /открыть проект/i,
    );
  });
});

describe("notificationOpensWorkspace", () => {
  test("studio cache or GET must not open the code project shell", () => {
    expect(
      notificationOpensWorkspace({
        cachedStudio: true,
        fetchOk: false,
        title: "Чекпоинт",
      }),
    ).toBe(true);
    expect(
      notificationOpensWorkspace({
        cachedStudio: false,
        fetchOk: true,
        title: "Агент создал проект «App»",
      }),
    ).toBe(true);
    expect(
      notificationOpensWorkspace({
        cachedStudio: false,
        fetchOk: false,
        title: "Агент создал воркспейс «Луна»",
        body: "Студия создана и привязана к диалогу",
      }),
    ).toBe(true);
    expect(
      notificationOpensWorkspace({
        cachedStudio: false,
        fetchOk: false,
        title: "Агент создал проект «App»",
        body: "Проект создан из шаблона и привязан к диалогу",
      }),
    ).toBe(false);
  });
});

describe("slash catalog", () => {
  test("workspace slashes are not /проект; /проект is Next.js code", () => {
    const names = WORKSPACE_SLASH_COMMANDS.map((c) => c.name);
    expect(names).toEqual(["воркспейс", "студия", "трек", "книга", "фильм"]);
    expect(slashOpensWorkspaceType("трек")).toBe("music");
    expect(slashOpensWorkspaceType("/книга")).toBe("book");
    expect(slashOpensWorkspaceType("фильм")).toBe("film");
    expect(slashOpensWorkspaceType("воркспейс")).toBe("picker");
    expect(slashOpensWorkspaceType("студия")).toBe("picker");
    expect(slashOpensWorkspaceType("проект")).toBeNull();
    expect(CODE_PROJECT_SLASH.name).toBe("проект");
    expect(CODE_PROJECT_SLASH.description.toLowerCase()).toContain("next.js");
    expect(CODE_PROJECT_SLASH.label.toLowerCase()).toContain("код");
    expect(CODE_PROJECT_SLASH.description.toLowerCase()).not.toContain("песн");
  });
});

describe("empty DAW", () => {
  test("new music DAW is silent tracks, not a seed mix or load error", () => {
    const empty = emptyDawState();
    expect(empty.tracks).toEqual([]);
    expect(dawHasAudibleContent(empty)).toBe(false);
    expect(DAW_EMPTY_TRACKS).toMatch(/дорожек пока нет/i);
    expect(DAW_EMPTY_TRACKS).not.toBe(DAW_LOAD_ERROR);
    expect(DAW_LOAD_ERROR).toMatch(/не удалось загрузить/i);
  });
});
