import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  WorkspaceError,
  assertInsideRoot,
  checkpointProject,
  deleteWorkspacePath,
  initProjectGit,
  listProjectCommits,
  readWorkspaceFile,
  restoreProjectCheckpoint,
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

  test("first write creates a missing project root", async () => {
    root = path.join(os.tmpdir(), `ps-missing-${Date.now()}`);
    const written = await writeWorkspaceFile(root, "README.md", "# hi\n");
    expect(written.created).toBe(true);
    const read = await readWorkspaceFile(root, "README.md");
    expect(read.content).toBe("# hi\n");
  });

  test("cannot delete the project root", async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "ps-root-"));
    await writeWorkspaceFile(root, "README.md", "# x\n");
    await expect(deleteWorkspacePath(root, ".")).rejects.toThrow(WorkspaceError);
    await expect(deleteWorkspacePath(root, "")).rejects.toThrow(WorkspaceError);
    await expect(deleteWorkspacePath(root, "./")).rejects.toThrow(WorkspaceError);
    const still = await readWorkspaceFile(root, "README.md");
    expect(still.content).toBe("# x\n");
  });
});

describe("git checkpoints stay inside one project root", () => {
  let rootA = "";
  let rootB = "";

  afterEach(async () => {
    if (rootA) await rm(rootA, { recursive: true, force: true });
    if (rootB) await rm(rootB, { recursive: true, force: true });
    rootA = "";
    rootB = "";
  });

  test("restore rolls files back; foreign hash is 404", async () => {
    rootA = await mkdtemp(path.join(os.tmpdir(), "ps-cp-a-"));
    rootB = await mkdtemp(path.join(os.tmpdir(), "ps-cp-b-"));

    await writeWorkspaceFile(rootA, "src/beacon.ts", 'export const v = "alpha";\n');
    await initProjectGit(rootA, "A0");
    const firstA = (await listProjectCommits(rootA, 1))[0];
    expect(firstA).toBeTruthy();

    await writeWorkspaceFile(rootA, "src/beacon.ts", 'export const v = "beta";\n');
    const second = await checkpointProject(rootA, "A1 beta");
    expect(second.noop).toBe(false);

    await writeWorkspaceFile(rootB, "src/other.ts", 'export const v = "foreign";\n');
    await initProjectGit(rootB, "B unique checkpoint");
    const firstB = (await listProjectCommits(rootB, 1))[0];
    expect(firstB).toBeTruthy();

    const aList = await listProjectCommits(rootA, 20);
    expect(aList.some((c) => c.message === "A1 beta")).toBe(true);
    expect(aList.some((c) => c.message.includes("B unique"))).toBe(false);

    await expect(restoreProjectCheckpoint(rootA, firstB!.hash)).rejects.toThrow(
      WorkspaceError,
    );

    const restored = await restoreProjectCheckpoint(rootA, firstA!.hash);
    expect(restored.commit.hash).toBe(firstA!.hash);
    const file = await readWorkspaceFile(rootA, "src/beacon.ts");
    expect(file.content).toContain("alpha");
    expect(file.content).not.toContain("beta");
  });
});
