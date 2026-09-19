import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  WorkspaceError,
  assertInsideRoot,
  deleteWorkspacePath,
  readWorkspaceFile,
  safeJoin,
  writeWorkspaceFile,
} from "./workspace";

describe("safeJoin", () => {
  const root = path.join(os.tmpdir(), "ps-proj");

  test("rejects parent traversal and null bytes", () => {
    expect(() => safeJoin(root, "../secret")).toThrow(WorkspaceError);
    expect(() => safeJoin(root, "foo/../../etc/passwd")).toThrow(WorkspaceError);
    expect(() => safeJoin(root, "foo\0bar")).toThrow(WorkspaceError);
  });

  test("strips absolute prefixes so they stay under root", () => {
    const inside = safeJoin(root, "/etc/passwd");
    expect(inside.startsWith(root)).toBe(true);
    expect(inside.includes("..")).toBe(false);
  });

  test("rejects windows drive and colon segments", () => {
    expect(() => safeJoin(root, "C:\\Windows\\system32")).toThrow(WorkspaceError);
  });
});

describe("assertInsideRoot / file ops vs symlink", () => {
  let root = "";
  let outside = "";

  afterEach(async () => {
    if (root) await rm(root, { recursive: true, force: true });
    if (outside) await rm(outside, { recursive: true, force: true });
    root = "";
    outside = "";
  });

  async function setup() {
    root = await mkdtemp(path.join(os.tmpdir(), "ps-ws-"));
    outside = await mkdtemp(path.join(os.tmpdir(), "ps-out-"));
    await writeFile(path.join(outside, "secret.txt"), "SECRET", "utf8");
    await symlink(outside, path.join(root, "escape"));
  }

  test("write/read/delete refuse a symlink hop out of the project", async () => {
    await setup();
    await expect(assertInsideRoot(root, path.join(root, "escape", "secret.txt"))).rejects.toThrow(
      WorkspaceError,
    );
    await expect(writeWorkspaceFile(root, "escape/pwned.txt", "x")).rejects.toThrow(WorkspaceError);
    await expect(readWorkspaceFile(root, "escape/secret.txt")).rejects.toThrow(WorkspaceError);
    await expect(deleteWorkspacePath(root, "escape/secret.txt")).rejects.toThrow(WorkspaceError);
  });

  test("normal files inside root still work", async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "ps-ws-"));
    const written = await writeWorkspaceFile(root, "src/app.ts", "export const n = 1;\n");
    expect(written.path).toBe("src/app.ts");
    const read = await readWorkspaceFile(root, "src/app.ts");
    expect(read.content).toContain("export const n");
    const deleted = await deleteWorkspacePath(root, "src/app.ts");
    expect(deleted.deleted).toBe(true);
    await expect(readWorkspaceFile(root, "src/app.ts")).rejects.toThrow(WorkspaceError);
  });
});
