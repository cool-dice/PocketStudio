import { afterAll, describe, expect, test } from "bun:test";

import { hashPassword } from "../../src/lib/auth";
import { db } from "../../src/lib/db";
import { getTool } from "./tools";

const SKIP_PG = !(process.env.DATABASE_URL ?? "").startsWith("postgres");
const stamp = Date.now().toString(36);
const ids: string[] = [];

function ctx(
  projectId: string | null,
  mode = "ask",
  threadId = `thread-studio-${stamp}`,
) {
  return { threadId, mode, projectId };
}

describe.skipIf(SKIP_PG)("create_workspace / list_workspaces agent tools", () => {
  afterAll(async () => {
    for (const id of ids.reverse()) {
      await db.user.delete({ where: { id } }).catch(() => {});
    }
  });

  test("creates typed studio, binds only global thread, ask mode allowed", async () => {
    const create = getTool("create_workspace");
    const list = getTool("list_workspaces");
    const createProject = getTool("create_project");
    expect(create && list && createProject).toBeTruthy();

    const owner = await db.user.create({
      data: {
        name: "StudioToolOwner",
        email: `studio-tool-${stamp}@example.test`,
        passwordHash: await hashPassword("password-ok"),
        role: "client",
      },
    });
    ids.push(owner.id);

    const globalThread = await db.thread.create({
      data: { userId: owner.id, title: "Главный чат" },
    });
    const made = await create!.execute(
      { name: `Песня маяк ${stamp}`, type: "песня", description: "демо" },
      owner.id,
      ctx(null, "ask", globalThread.id),
    );
    expect(made.error).toBeUndefined();
    expect(made.bound).toBe(true);
    expect(made.workspace.type).toBe("music");
    expect(made.workspace.origin).toBe("workspace");
    expect(made.workspace.stage).toBe("Идея");
    const rebound = await db.thread.findUnique({
      where: { id: globalThread.id },
    });
    expect(rebound?.projectId).toBe(made.workspace.id);

    const songThread = await db.thread.create({
      data: {
        userId: owner.id,
        projectId: made.workspace.id,
        title: "Уже песня",
      },
    });
    const extra = await create!.execute(
      { name: `Вторая книга ${stamp}`, type: "книга" },
      owner.id,
      ctx(made.workspace.id, "ask", songThread.id),
    );
    expect(extra.error).toBeUndefined();
    expect(extra.bound).toBe(false);
    expect(extra.workspace.id).not.toBe(made.workspace.id);
    const stillBound = await db.thread.findUnique({
      where: { id: songThread.id },
    });
    expect(stillBound?.projectId).toBe(made.workspace.id);

    const listed = await list!.execute({}, owner.id, ctx(null));
    const names = listed.workspaces.map((w: { name: string }) => w.name);
    expect(names).toContain(`Песня маяк ${stamp}`);
    expect(names).toContain(`Вторая книга ${stamp}`);
    expect(
      listed.workspaces.every((w: { type: string }) =>
        ["film", "book", "music", "app", "universal"].includes(w.type),
      ),
    ).toBe(true);

    const blocked = await createProject!.execute(
      { name: "Не приложение" },
      owner.id,
      ctx(made.workspace.id, "act", songThread.id),
    );
    expect(blocked.error).toMatch(/create_workspace|заметк/i);
    expect(blocked.project).toBeUndefined();
  });
});
