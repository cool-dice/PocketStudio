import { describe, expect, test } from "bun:test";

import { rankWorkspacesByRecency } from "./recent-workspaces";

describe("rankWorkspacesByRecency", () => {
  test("a newer thread beats a newer workspace clock", () => {
    const ranked = rankWorkspacesByRecency(
      [
        { id: "fresh-ws", updatedAt: "2026-04-01T00:00:00.000Z" },
        { id: "chatted", updatedAt: "2026-01-01T00:00:00.000Z" },
      ],
      [
        { projectId: "chatted", updatedAt: "2026-05-01T00:00:00.000Z" },
        { projectId: null, updatedAt: "2026-06-01T00:00:00.000Z" },
      ],
    );
    expect(ranked.map((w) => w.id)).toEqual(["chatted", "fresh-ws"]);
  });

  test("falls back to workspace updatedAt when there are no threads", () => {
    const ranked = rankWorkspacesByRecency(
      [
        { id: "a", updatedAt: "2026-01-01T00:00:00.000Z" },
        { id: "b", updatedAt: "2026-02-01T00:00:00.000Z" },
      ],
      [],
    );
    expect(ranked.map((w) => w.id)).toEqual(["b", "a"]);
  });
});
