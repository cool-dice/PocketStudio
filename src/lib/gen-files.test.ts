import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import path from "node:path";

import { publicGenUrlIfExists, unlinkGeneratedFile } from "./gen-files";

const GEN_DIR = path.join(process.cwd(), "public", "gen");
const NAME = `ps-test-${Date.now()}.png`;
const FILE = path.join(GEN_DIR, NAME);
const URL = `/gen/${NAME}`;

afterEach(() => {
  try {
    rmSync(FILE, { force: true });
  } catch {
    /* ignore */
  }
});

describe("public gen files", () => {
  test("keeps a live /gen url and nulls a missing one", () => {
    mkdirSync(GEN_DIR, { recursive: true });
    writeFileSync(FILE, Buffer.from([1, 2, 3, 4]));
    expect(publicGenUrlIfExists(URL)).toBe(URL);
    expect(publicGenUrlIfExists("/gen/missing-nope.png")).toBe(null);
    expect(publicGenUrlIfExists("https://cdn.example/a.png")).toBe(
      "https://cdn.example/a.png",
    );
    expect(publicGenUrlIfExists(null)).toBe(null);
  });

  test("unlink removes the blob so the url is no longer clickable", () => {
    mkdirSync(GEN_DIR, { recursive: true });
    writeFileSync(FILE, Buffer.from([9, 9]));
    unlinkGeneratedFile(URL);
    expect(existsSync(FILE)).toBe(false);
    expect(publicGenUrlIfExists(URL)).toBe(null);
  });
});
