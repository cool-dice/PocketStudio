import { afterAll, describe, expect, test } from "bun:test";

import { hashPassword } from "../../src/lib/auth";
import { db } from "../../src/lib/db";
import {
  DEPLOY_ZIP_HINT,
  EMPTY_APP_BUILD_ERROR,
} from "../../src/lib/docker-copy";
import {
  projectRoot,
  removeProjectDir,
  writeWorkspaceFile,
} from "../../src/lib/workspace";
import { getTool } from "./tools";

const SKIP_PG = !(process.env.DATABASE_URL ?? "").startsWith("postgres");
const stamp = Date.now().toString(36);
const ids: string[] = [];
const projectIds: string[] = [];

const FAKE_SUCCESS =
  /опубликовано на|published to registry|push succeeded|деплой завершён/i;

function ctx(projectId: string | null) {
  return { threadId: "thread-deploy", mode: "act", projectId };
}

describe.skipIf(SKIP_PG)("deploy_project agent tool", () => {
  afterAll(async () => {
    for (const id of projectIds) {
      await removeProjectDir(id).catch(() => {});
    }
    for (const id of ids.reverse()) {
      await db.user.delete({ where: { id } }).catch(() => {});
    }
  });

  test("handler refuses other types, empty is not built, docker missing is chat-visible", async () => {
    const tool = getTool("deploy_project");
    expect(tool).toBeDefined();

    const owner = await db.user.create({
      data: {
        name: "DeployToolOwner",
        email: `dep-tool-${stamp}@example.test`,
        passwordHash: await hashPassword("password-ok"),
        role: "client",
      },
    });
    ids.push(owner.id);
    const stranger = await db.user.create({
      data: {
        name: "DeployToolStranger",
        email: `dep-tool-x-${stamp}@example.test`,
        passwordHash: await hashPassword("password-ok"),
        role: "client",
      },
    });
    ids.push(stranger.id);

    const book = await db.project.create({
      data: { userId: owner.id, name: "Канон деплоя", type: "book" },
    });
    const emptyApp = await db.project.create({
      data: { userId: owner.id, name: "Пустое приложение", type: "app" },
    });
    const codeApp = await db.project.create({
      data: { userId: owner.id, name: "Код приложения", type: "app" },
    });
    projectIds.push(book.id, emptyApp.id, codeApp.id);

    const emptyRoot = projectRoot(emptyApp.id);
    await writeWorkspaceFile(emptyRoot, "README.md", "# empty\n");
    await db.project.update({
      where: { id: emptyApp.id },
      data: { rootPath: emptyRoot },
    });

    const codeRoot = projectRoot(codeApp.id);
    await writeWorkspaceFile(
      codeRoot,
      "src/main.ts",
      `export const mark = "deploy-tool-${stamp}";\n`,
    );
    await db.project.update({
      where: { id: codeApp.id },
      data: { rootPath: codeRoot },
    });

    const bookResult = (await tool!.execute(
      { workspaceId: book.id },
      owner.id,
      ctx(book.id),
    )) as Record<string, unknown>;
    expect(bookResult.status).toBe("refused");
    expect(bookResult.status).not.toBe("built");
    expect(bookResult.published).toBe(false);
    expect(bookResult.imageTag ?? null).toBeNull();
    expect(String(bookResult.error ?? bookResult.message)).toMatch(/книга/i);
    expect(String(bookResult.error ?? bookResult.message)).toMatch(
      /приложение/i,
    );
    expect(JSON.stringify(bookResult)).not.toMatch(/"published":true/);
    expect(JSON.stringify(bookResult)).not.toMatch(FAKE_SUCCESS);

    const stolen = (await tool!.execute(
      { workspaceId: codeApp.id },
      stranger.id,
      ctx(codeApp.id),
    )) as Record<string, unknown>;
    expect(stolen.error).toMatch(/не найден/i);
    expect(stolen.status).not.toBe("built");
    expect(JSON.stringify(stolen)).not.toMatch(/"published":true/);

    const emptyResult = (await tool!.execute(
      { workspaceId: emptyApp.id },
      owner.id,
      ctx(emptyApp.id),
    )) as Record<string, unknown>;
    expect(emptyResult.status).toBe("empty");
    expect(emptyResult.status).not.toBe("built");
    expect(emptyResult.published).toBe(false);
    expect(emptyResult.imageTag ?? null).toBeNull();
    expect(String(emptyResult.message)).toBe(EMPTY_APP_BUILD_ERROR);
    expect(JSON.stringify(emptyResult)).not.toMatch(/"published":true/);
    expect(JSON.stringify(emptyResult)).not.toMatch(FAKE_SUCCESS);

    const codeResult = (await tool!.execute(
      { workspaceId: codeApp.id },
      owner.id,
      ctx(codeApp.id),
    )) as {
      status: string;
      published: boolean;
      imageTag: string | null;
      message: string;
      log: string;
      zipHint?: string;
    };
    expect(codeResult.published).toBe(false);
    expect(JSON.stringify(codeResult)).not.toMatch(/"published":true/);
    expect(JSON.stringify(codeResult)).not.toMatch(FAKE_SUCCESS);
    expect(codeResult.zipHint).toBe(DEPLOY_ZIP_HINT);
    expect(codeResult.message.length).toBeGreaterThan(0);
    if (codeResult.status === "built") {
      expect(codeResult.imageTag).toBeTruthy();
      expect(codeResult.message).toMatch(/не публикация/i);
    } else {
      expect(["unavailable", "failed", "empty"]).toContain(codeResult.status);
      expect(codeResult.status).not.toBe("built");
      if (codeResult.status === "unavailable") {
        expect(codeResult.message).toMatch(/docker/i);
        expect(codeResult.message).toContain(codeResult.log);
      }
    }

    const ctxResult = (await tool!.execute(
      {},
      owner.id,
      ctx(codeApp.id),
    )) as Record<string, unknown>;
    expect(ctxResult.published).toBe(false);
    expect(ctxResult.status).not.toBeUndefined();
  }, 30_000);
});
