import { describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import path from "node:path";

import {
  albumKindForSource,
  albumPersistType,
  copiedAlbumUrl,
  isAlbumSourceRow,
  persistAlbumMeta,
} from "./album-attach";
import { publicGenUrlIfExists } from "./gen-files";

const GEN_DIR = path.join(process.cwd(), "public", "gen");

describe("album attach helpers", () => {
  test("visual types and albumKind meta are album sources; audio is not", () => {
    expect(isAlbumSourceRow("image", null)).toBe(true);
    expect(isAlbumSourceRow("portrait", null)).toBe(true);
    expect(isAlbumSourceRow("file", JSON.stringify({ albumKind: "concept" }))).toBe(
      true,
    );
    expect(isAlbumSourceRow("audio", null)).toBe(false);
    expect(albumKindForSource("portrait", null)).toBe("portrait");
    expect(albumKindForSource("image", JSON.stringify({ albumKind: "concept" }))).toBe(
      "concept",
    );
    expect(albumPersistType("portrait")).toBe("portrait");
    expect(albumPersistType("illustration")).toBe("image");
  });

  test("persistAlbumMeta keeps other keys and sets albumKind", () => {
    const next = persistAlbumMeta(
      JSON.stringify({ gradient: "from-teal-500/60 to-emerald-500/40" }),
      "illustration",
    );
    const parsed = JSON.parse(next) as { gradient: string; albumKind: string };
    expect(parsed.gradient).toMatch(/teal/);
    expect(parsed.albumKind).toBe("illustration");
  });

  test("copiedAlbumUrl duplicates a live /gen blob and drops a missing one", () => {
    const name = `album-copy-${Date.now()}.png`;
    const file = path.join(GEN_DIR, name);
    const url = `/gen/${name}`;
    mkdirSync(GEN_DIR, { recursive: true });
    writeFileSync(file, Buffer.from([7, 7, 7]));
    const dup = copiedAlbumUrl(url);
    expect(dup).toMatch(/^\/gen\/.+\.png$/);
    expect(dup).not.toBe(url);
    expect(publicGenUrlIfExists(dup)).toBe(dup);

    const missing = copiedAlbumUrl("/gen/missing-album-nope.png");
    expect(missing).toBe(null);

    expect(copiedAlbumUrl("https://cdn.example/a.png")).toBe(
      "https://cdn.example/a.png",
    );

    rmSync(file, { force: true });
    if (dup) {
      rmSync(path.join(GEN_DIR, path.basename(dup)), { force: true });
    }
    expect(existsSync(file)).toBe(false);
  });
});
