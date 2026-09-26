import { describe, expect, test } from "bun:test";

import {
  editorLoadError,
  editorProjectFromWorkspace,
  editorSectionLabel,
} from "./editor-project";

describe("app studio file editor vs code-project shell", () => {
  test("workspace meta maps to editor project without a fake host", () => {
    const project = editorProjectFromWorkspace({
      id: "ws-1",
      name: "Карман",
      description: "спека",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
    expect(project.origin).toBe("workspace");
    expect(project.remoteUrl).toBeNull();
    expect(project.name).toBe("Карман");
    expect(JSON.stringify(project)).not.toMatch(/https?:\/\//);
    expect(editorSectionLabel("workspace")).toBe("Код воркспейса");
    expect(editorSectionLabel("project")).toBe("Проект");
    expect(editorLoadError("workspace")).toMatch(/воркспейс/i);
    expect(editorLoadError("project")).toMatch(/проект/i);
    expect(editorLoadError("workspace")).not.toBe(editorLoadError("project"));
  });
});
