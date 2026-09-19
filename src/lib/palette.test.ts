import { describe, expect, test } from "bun:test";

import {
  normalizeStylePalette,
  paletteFromArtifact,
  type StylePalette,
} from "./palette";
import type { ArtifactDto } from "./workspace-types";

function artifact(meta: Record<string, unknown> | null, stage = "style"): ArtifactDto {
  return {
    id: "art1",
    projectId: "ws1",
    type: "file",
    title: "Палитра стиля",
    description: null,
    url: null,
    prompt: "бриф",
    entityId: null,
    stage,
    meta,
    favorite: false,
    createdAt: "2026-09-19T00:00:00.000Z",
  };
}

const live: StylePalette = {
  mood: "холодный туман",
  colors: [
    { hex: "#1B2A4A", name: "Ночь", usage: "фон" },
    { hex: "#4E6E8A", name: "Туман", usage: "вторичный" },
    { hex: "#E8C07A", name: "Фонарь", usage: "акцент" },
  ],
  fonts: { heading: "Georgia", body: "Inter", note: "контраст" },
  advice: "Держите тёплый акцент редким.",
};

describe("palette from artifacts", () => {
  test("reads a persisted palette and never invents swatches", () => {
    const parsed = paletteFromArtifact(
      artifact({ kind: "palette", ...live, brief: "триллер" }),
    );
    expect(parsed).toEqual(live);
    expect(parsed?.colors).toHaveLength(3);
    expect(parsed?.colors.every((c) => /^#[0-9A-F]{6}$/.test(c.hex))).toBe(true);
  });

  test("junk or missing palette is null — no default fake swatches", () => {
    expect(paletteFromArtifact(artifact(null))).toBeNull();
    expect(paletteFromArtifact(artifact({ kind: "other" }))).toBeNull();
    expect(
      paletteFromArtifact(artifact({ kind: "palette", colors: [{ hex: "red" }] })),
    ).toBeNull();
    expect(paletteFromArtifact(artifact({ kind: "palette", ...live }, "design"))).toBeNull();
    expect(normalizeStylePalette({ colors: [] })).toBeNull();
    expect(normalizeStylePalette({ hex: "#FFFFFF" })).toBeNull();
  });
});
