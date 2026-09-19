import { afterAll, describe, expect, test } from "bun:test";

import { hashPassword, signSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { workspacesListSearch } from "@/lib/workspace-copy";

import { GET as listWorkspaces } from "./route";
import { PATCH as patchWorkspace } from "./[id]/route";

const SKIP_PG = !(process.env.DATABASE_URL ?? "").startsWith("postgres");
const stamp = Date.now().toString(36);

function jsonRequest(
  url: string,
  method: string,
  body?: unknown,
  bearer?: string,
): Request {
  const headers = new Headers({ accept: "application/json" });
  if (body !== undefined) headers.set("content-type", "application/json");
  if (bearer) headers.set("authorization", `Bearer ${bearer}`);
  return new Request(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe.skipIf(SKIP_PG)("workspaces API: archive list honesty + favorites", () => {
  const ids: string[] = [];

  afterAll(async () => {
    for (const id of ids.reverse()) {
      await db.user.delete({ where: { id } }).catch(() => {});
    }
  });

  async function seedUser(label: string) {
    const user = await db.user.create({
      data: {
        name: label,
        email: `ws-archive-${label}-${stamp}@example.test`,
        passwordHash: await hashPassword("password-ok"),
        role: "client",
      },
    });
    ids.push(user.id);
    const token = await signSession({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
    return { user, token };
  }

  test("default list hides archived; toggle ?archived=1; favorite stays; empty archive is []", async () => {
    const { user, token } = await seedUser("grid");
    const live = await db.project.create({
      data: {
        userId: user.id,
        name: "Живой воркспейс",
        type: "book",
        origin: "workspace",
      },
    });
    const hidden = await db.project.create({
      data: {
        userId: user.id,
        name: "Скрытый воркспейс",
        type: "film",
        origin: "workspace",
        archived: true,
      },
    });
    const paramsLive = { params: Promise.resolve({ id: live.id }) };
    const paramsHidden = { params: Promise.resolve({ id: hidden.id }) };

    expect(workspacesListSearch(false)).toBe("");
    const listed = await listWorkspaces(
      jsonRequest("http://localhost/api/workspaces", "GET", undefined, token),
    );
    expect(listed.status).toBe(200);
    const listedJson = (await listed.json()) as {
      workspaces: { id: string; name: string; archived: boolean; favorite: boolean }[];
      error?: string;
    };
    expect(listedJson.error).toBeUndefined();
    expect(listedJson.workspaces.some((w) => w.id === live.id)).toBe(true);
    expect(listedJson.workspaces.some((w) => w.id === hidden.id)).toBe(false);
    expect(JSON.stringify(listedJson)).not.toContain("Скрытый воркспейс");

    expect(workspacesListSearch(true)).toBe("?archived=1");
    const archivedList = await listWorkspaces(
      jsonRequest(
        "http://localhost/api/workspaces?archived=1",
        "GET",
        undefined,
        token,
      ),
    );
    expect(archivedList.status).toBe(200);
    const archivedJson = (await archivedList.json()) as {
      workspaces: { id: string; archived: boolean }[];
    };
    expect(archivedJson.workspaces.some((w) => w.id === hidden.id)).toBe(true);
    expect(archivedJson.workspaces.every((w) => w.archived)).toBe(true);
    expect(archivedJson.workspaces.some((w) => w.id === live.id)).toBe(false);

    const starredLive = await patchWorkspace(
      jsonRequest(
        `http://localhost/api/workspaces/${live.id}`,
        "PATCH",
        { favorite: true },
        token,
      ),
      paramsLive,
    );
    expect(starredLive.status).toBe(200);
    const starredLiveBody = (await starredLive.json()) as {
      workspace: { favorite: boolean; archived: boolean };
    };
    expect(starredLiveBody.workspace.favorite).toBe(true);
    expect(starredLiveBody.workspace.archived).toBe(false);

    const stillLive = await listWorkspaces(
      jsonRequest("http://localhost/api/workspaces", "GET", undefined, token),
    );
    const stillLiveJson = (await stillLive.json()) as {
      workspaces: { id: string; favorite: boolean }[];
    };
    expect(stillLiveJson.workspaces.some((w) => w.id === live.id)).toBe(true);
    expect(stillLiveJson.workspaces.find((w) => w.id === live.id)?.favorite).toBe(
      true,
    );

    const starredHidden = await patchWorkspace(
      jsonRequest(
        `http://localhost/api/workspaces/${hidden.id}`,
        "PATCH",
        { favorite: true },
        token,
      ),
      paramsHidden,
    );
    expect(starredHidden.status).toBe(200);
    const starredHiddenBody = (await starredHidden.json()) as {
      workspace: { favorite: boolean; archived: boolean };
    };
    expect(starredHiddenBody.workspace.favorite).toBe(true);
    expect(starredHiddenBody.workspace.archived).toBe(true);

    const archiveAfterStar = await listWorkspaces(
      jsonRequest(
        "http://localhost/api/workspaces?archived=1",
        "GET",
        undefined,
        token,
      ),
    );
    const archiveAfterStarJson = (await archiveAfterStar.json()) as {
      workspaces: { id: string; favorite: boolean }[];
    };
    expect(archiveAfterStarJson.workspaces.some((w) => w.id === hidden.id)).toBe(
      true,
    );
    expect(
      archiveAfterStarJson.workspaces.find((w) => w.id === hidden.id)?.favorite,
    ).toBe(true);
    const liveAfterStar = await listWorkspaces(
      jsonRequest("http://localhost/api/workspaces", "GET", undefined, token),
    );
    const liveAfterStarJson = (await liveAfterStar.json()) as {
      workspaces: { id: string }[];
    };
    expect(liveAfterStarJson.workspaces.some((w) => w.id === hidden.id)).toBe(
      false,
    );

    const archived = await patchWorkspace(
      jsonRequest(
        `http://localhost/api/workspaces/${live.id}`,
        "PATCH",
        { archived: true },
        token,
      ),
      paramsLive,
    );
    expect(archived.status).toBe(200);
    const archivedBody = (await archived.json()) as {
      workspace: { archived: boolean; favorite: boolean };
    };
    expect(archivedBody.workspace.archived).toBe(true);
    expect(archivedBody.workspace.favorite).toBe(true);

    const afterArchive = await listWorkspaces(
      jsonRequest("http://localhost/api/workspaces", "GET", undefined, token),
    );
    const afterArchiveJson = (await afterArchive.json()) as {
      workspaces: { id: string }[];
      error?: string;
    };
    expect(afterArchiveJson.error).toBeUndefined();
    expect(afterArchiveJson.workspaces).toEqual([]);
    expect(JSON.stringify(afterArchiveJson)).not.toMatch(/пока нет|не удалось/i);

    const archiveAfter = await listWorkspaces(
      jsonRequest(
        "http://localhost/api/workspaces?archived=1",
        "GET",
        undefined,
        token,
      ),
    );
    const archiveAfterJson = (await archiveAfter.json()) as {
      workspaces: { id: string; favorite: boolean }[];
    };
    expect(archiveAfterJson.workspaces.some((w) => w.id === live.id)).toBe(true);
    expect(
      archiveAfterJson.workspaces.find((w) => w.id === live.id)?.favorite,
    ).toBe(true);

    const restored = await patchWorkspace(
      jsonRequest(
        `http://localhost/api/workspaces/${live.id}`,
        "PATCH",
        { archived: false },
        token,
      ),
      paramsLive,
    );
    expect(restored.status).toBe(200);
    const restoredBody = (await restored.json()) as {
      workspace: { archived: boolean; favorite: boolean };
    };
    expect(restoredBody.workspace.archived).toBe(false);
    expect(restoredBody.workspace.favorite).toBe(true);

    const back = await listWorkspaces(
      jsonRequest("http://localhost/api/workspaces", "GET", undefined, token),
    );
    const backJson = (await back.json()) as {
      workspaces: { id: string; favorite: boolean }[];
    };
    expect(backJson.workspaces.some((w) => w.id === live.id)).toBe(true);
    expect(backJson.workspaces.find((w) => w.id === live.id)?.favorite).toBe(
      true,
    );

    const { user: attacker, token: attackerToken } = await seedUser("attacker");
    const stolen = await patchWorkspace(
      jsonRequest(
        `http://localhost/api/workspaces/${live.id}`,
        "PATCH",
        { archived: true },
        attackerToken,
      ),
      paramsLive,
    );
    expect(stolen.status).toBe(404);
    const stolenJson = (await stolen.json()) as { workspace?: unknown };
    expect(stolenJson.workspace).toBeUndefined();
    const stillOwner = await db.project.findUnique({ where: { id: live.id } });
    expect(stillOwner?.archived).toBe(false);
    expect(attacker.id).toBeTruthy();

    const { token: emptyToken } = await seedUser("archive-empty");
    const emptyArchive = await listWorkspaces(
      jsonRequest(
        "http://localhost/api/workspaces?archived=1",
        "GET",
        undefined,
        emptyToken,
      ),
    );
    expect(emptyArchive.status).toBe(200);
    const emptyArchiveJson = (await emptyArchive.json()) as {
      workspaces: unknown[];
      error?: string;
    };
    expect(emptyArchiveJson.error).toBeUndefined();
    expect(emptyArchiveJson.workspaces).toEqual([]);
    expect(JSON.stringify(emptyArchiveJson)).not.toMatch(/пока нет|не удалось/i);
  });
});

describe.skipIf(SKIP_PG)("workspaces API: pipeline stage PATCH honesty", () => {
  const ids: string[] = [];

  afterAll(async () => {
    for (const id of ids.reverse()) {
      await db.user.delete({ where: { id } }).catch(() => {});
    }
  });

  async function seedUser(label: string) {
    const user = await db.user.create({
      data: {
        name: label,
        email: `ws-stage-${label}-${stamp}@example.test`,
        passwordHash: await hashPassword("password-ok"),
        role: "client",
      },
    });
    ids.push(user.id);
    const token = await signSession({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
    return { user, token };
  }

  test("known stage advances index; unknown is 400 and not stored", async () => {
    const { user, token } = await seedUser("film");
    const film = await db.project.create({
      data: {
        userId: user.id,
        name: "Фильм стадий",
        type: "film",
        origin: "workspace",
        stage: "Сценарий",
        stageIndex: 1,
      },
    });
    const params = { params: Promise.resolve({ id: film.id }) };

    const advanced = await patchWorkspace(
      jsonRequest(
        `http://localhost/api/workspaces/${film.id}`,
        "PATCH",
        { stage: "Монтаж" },
        token,
      ),
      params,
    );
    expect(advanced.status).toBe(200);
    const advancedJson = (await advanced.json()) as {
      workspace: { stage: string; stageIndex: number };
    };
    expect(advancedJson.workspace.stage).toBe("Монтаж");
    expect(advancedJson.workspace.stageIndex).toBe(5);

    const legacy = await patchWorkspace(
      jsonRequest(
        `http://localhost/api/workspaces/${film.id}`,
        "PATCH",
        { stage: "Публикация" },
        token,
      ),
      params,
    );
    expect(legacy.status).toBe(200);
    const legacyJson = (await legacy.json()) as {
      workspace: { stage: string; stageIndex: number };
    };
    expect(legacyJson.workspace.stage).toBe("Выпуск");
    expect(legacyJson.workspace.stageIndex).toBe(6);

    const unknown = await patchWorkspace(
      jsonRequest(
        `http://localhost/api/workspaces/${film.id}`,
        "PATCH",
        { stage: "Код" },
        token,
      ),
      params,
    );
    expect(unknown.status).toBe(400);
    const unknownJson = (await unknown.json()) as {
      error: string;
      workspace?: unknown;
    };
    expect(unknownJson.error).toMatch(/неизвестн/i);
    expect(unknownJson.workspace).toBeUndefined();
    const row = await db.project.findUnique({ where: { id: film.id } });
    expect(row?.stage).toBe("Выпуск");
    expect(row?.stageIndex).toBe(6);
  });
});
