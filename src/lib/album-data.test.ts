import { describe, expect, test } from "bun:test";

import { albumItemOf, isAlbumArtifact } from "@/components/studio/documents/album-data";
import type { ArtifactDto } from "@/lib/workspace-types";

function artifact(partial: Partial<ArtifactDto> & Pick<ArtifactDto, "id" | "title" | "type">): ArtifactDto {
  return {
    projectId: "ws-1",
    description: null,
    url: null,
    prompt: null,
    entityId: null,
    stage: null,
    meta: null,
    favorite: false,
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

describe("album item mapping", () => {
  test("albumKind stubs and missing files stay in the album; audio does not", () => {
    expect(
      isAlbumArtifact(
        artifact({
          id: "a1",
          title: "Концепт",
          type: "file",
          meta: { albumKind: "concept" },
        }),
      ),
    ).toBe(true);
    expect(
      isAlbumArtifact(
        artifact({
          id: "a2",
          title: "Пропало",
          type: "image",
          fileMissing: true,
        }),
      ),
    ).toBe(true);
    expect(
      isAlbumArtifact(artifact({ id: "a3", title: "Трек", type: "audio" })),
    ).toBe(false);
  });

  test("missing file is not exposed as a clickable url on the tile", () => {
    const item = albumItemOf(
      artifact({
        id: "gone",
        title: "Маяк",
        type: "image",
        url: "/gen/gone.png",
        fileMissing: true,
        meta: { albumKind: "illustration" },
      }),
      new Map(),
    );
    expect(item.fileMissing).toBe(true);
    expect(item.url).toBe(null);
    expect(item.kind).toBe("illustration");
  });
});
