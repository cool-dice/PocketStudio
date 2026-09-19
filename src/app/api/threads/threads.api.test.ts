import { afterAll, describe, expect, test } from "bun:test";

import { hashPassword, signSession } from "@/lib/auth";
import { db } from "@/lib/db";

import { GET as listThreads, POST as createThread } from "./route";
import {
  GET as getThread,
  PATCH as patchThread,
  DELETE as deleteThread,
} from "./[id]/route";

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

describe.skipIf(SKIP_PG)("threads API: IDOR delete, persist rename/delete, empty list", () => {
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
        email: `threads-${label}-${stamp}@example.test`,
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

  test("401 without a session", async () => {
    const list = await listThreads(jsonRequest("http://localhost/api/threads", "GET"));
    expect(list.status).toBe(401);

    const created = await createThread(
      jsonRequest("http://localhost/api/threads", "POST", {}),
    );
    expect(created.status).toBe(401);

    const got = await getThread(
      jsonRequest("http://localhost/api/threads/nope", "GET"),
      { params: Promise.resolve({ id: "nope" }) },
    );
    expect(got.status).toBe(401);

    const deleted = await deleteThread(
      jsonRequest("http://localhost/api/threads/nope", "DELETE"),
      { params: Promise.resolve({ id: "nope" }) },
    );
    expect(deleted.status).toBe(401);
  });

  test("successful empty list is [] — not an error payload", async () => {
    const { token } = await seedUser("empty");
    const res = await listThreads(
      jsonRequest("http://localhost/api/threads", "GET", undefined, token),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      threads: unknown[];
      error?: string;
    };
    expect(json.error).toBeUndefined();
    expect(json.threads).toEqual([]);
    expect(JSON.stringify(json)).not.toMatch(/пока нет|не удалось/i);
  });

  test("list is owner-scoped; attacker DELETE/PATCH are 404 and do not wipe", async () => {
    const { user: owner, token: ownerToken } = await seedUser("owner");
    const { token: attackerToken } = await seedUser("atk");

    const thread = await db.thread.create({
      data: { userId: owner.id, title: "Секретный диалог", mode: "ask" },
    });
    await db.message.create({
      data: {
        threadId: thread.id,
        role: "user",
        content: "секрет владельца",
      },
    });
    const params = { params: Promise.resolve({ id: thread.id }) };

    const stolenList = await listThreads(
      jsonRequest("http://localhost/api/threads", "GET", undefined, attackerToken),
    );
    expect(stolenList.status).toBe(200);
    const stolenJson = (await stolenList.json()) as {
      threads: { id: string; title: string }[];
    };
    expect(stolenJson.threads.some((t) => t.id === thread.id)).toBe(false);
    expect(JSON.stringify(stolenJson)).not.toContain("Секретный диалог");
    expect(JSON.stringify(stolenJson)).not.toContain(thread.id);
    expect(JSON.stringify(stolenJson)).not.toContain("секрет владельца");

    const got = await getThread(
      jsonRequest(
        `http://localhost/api/threads/${thread.id}`,
        "GET",
        undefined,
        attackerToken,
      ),
      params,
    );
    expect(got.status).toBe(404);
    const gotJson = (await got.json()) as {
      error: string;
      thread?: unknown;
      messages?: unknown;
    };
    expect(gotJson.thread).toBeUndefined();
    expect(gotJson.messages).toBeUndefined();
    expect(gotJson.error).toMatch(/не найден/i);

    const patched = await patchThread(
      jsonRequest(
        `http://localhost/api/threads/${thread.id}`,
        "PATCH",
        { title: "взлом" },
        attackerToken,
      ),
      params,
    );
    expect(patched.status).toBe(404);
    const patchedJson = (await patched.json()) as { thread?: unknown };
    expect(patchedJson.thread).toBeUndefined();

    const archivedByAttacker = await patchThread(
      jsonRequest(
        `http://localhost/api/threads/${thread.id}`,
        "PATCH",
        { archived: true },
        attackerToken,
      ),
      params,
    );
    expect(archivedByAttacker.status).toBe(404);
    const archivedByAttackerJson = (await archivedByAttacker.json()) as {
      thread?: unknown;
    };
    expect(archivedByAttackerJson.thread).toBeUndefined();

    const deleted = await deleteThread(
      jsonRequest(
        `http://localhost/api/threads/${thread.id}`,
        "DELETE",
        undefined,
        attackerToken,
      ),
      params,
    );
    expect(deleted.status).toBe(404);
    const deletedJson = (await deleted.json()) as { ok?: boolean };
    expect(deletedJson.ok).toBeUndefined();

    const still = await db.thread.findUnique({ where: { id: thread.id } });
    expect(still?.title).toBe("Секретный диалог");
    expect(still?.userId).toBe(owner.id);
    expect(still?.archived).toBe(false);

    const ownerList = await listThreads(
      jsonRequest("http://localhost/api/threads", "GET", undefined, ownerToken),
    );
    const ownerJson = (await ownerList.json()) as {
      threads: { id: string; title: string }[];
    };
    expect(ownerJson.threads.some((t) => t.id === thread.id)).toBe(true);
  });

  test("owner PATCH rename persists; owner DELETE removes row and messages", async () => {
    const { user, token } = await seedUser("persist");
    const thread = await db.thread.create({
      data: { userId: user.id, title: "Черновик", mode: "ask" },
    });
    await db.message.create({
      data: {
        threadId: thread.id,
        role: "user",
        content: "черновик сообщения",
      },
    });
    const params = { params: Promise.resolve({ id: thread.id }) };

    const renamed = await patchThread(
      jsonRequest(
        `http://localhost/api/threads/${thread.id}`,
        "PATCH",
        { title: "Маяк у берега" },
        token,
      ),
      params,
    );
    expect(renamed.status).toBe(200);
    const renamedJson = (await renamed.json()) as { thread: { title: string } };
    expect(renamedJson.thread.title).toBe("Маяк у берега");

    const got = await getThread(
      jsonRequest(
        `http://localhost/api/threads/${thread.id}`,
        "GET",
        undefined,
        token,
      ),
      params,
    );
    expect(got.status).toBe(200);
    const gotJson = (await got.json()) as { thread: { title: string } };
    expect(gotJson.thread.title).toBe("Маяк у берега");

    const listed = await listThreads(
      jsonRequest("http://localhost/api/threads", "GET", undefined, token),
    );
    const listedJson = (await listed.json()) as {
      threads: { id: string; title: string }[];
    };
    const row = listedJson.threads.find((t) => t.id === thread.id);
    expect(row?.title).toBe("Маяк у берега");

    const dbAfterRename = await db.thread.findUnique({ where: { id: thread.id } });
    expect(dbAfterRename?.title).toBe("Маяк у берега");

    const deleted = await deleteThread(
      jsonRequest(
        `http://localhost/api/threads/${thread.id}`,
        "DELETE",
        undefined,
        token,
      ),
      params,
    );
    expect(deleted.status).toBe(200);
    const deletedJson = (await deleted.json()) as { ok: boolean };
    expect(deletedJson.ok).toBe(true);

    const gone = await getThread(
      jsonRequest(
        `http://localhost/api/threads/${thread.id}`,
        "GET",
        undefined,
        token,
      ),
      params,
    );
    expect(gone.status).toBe(404);

    const afterList = await listThreads(
      jsonRequest("http://localhost/api/threads", "GET", undefined, token),
    );
    const afterJson = (await afterList.json()) as {
      threads: { id: string }[];
    };
    expect(afterJson.threads.some((t) => t.id === thread.id)).toBe(false);

    const dbGone = await db.thread.findUnique({ where: { id: thread.id } });
    expect(dbGone).toBeNull();
    const leftoverMessages = await db.message.count({
      where: { threadId: thread.id },
    });
    expect(leftoverMessages).toBe(0);
  });

  test("default list hides archived; owner PATCH archive/unarchive; empty archive is []", async () => {
    const { user, token } = await seedUser("archive");
    const live = await db.thread.create({
      data: { userId: user.id, title: "Живой диалог", mode: "ask" },
    });
    const hidden = await db.thread.create({
      data: {
        userId: user.id,
        title: "Скрытый диалог",
        mode: "ask",
        archived: true,
      },
    });
    const paramsLive = { params: Promise.resolve({ id: live.id }) };

    const listed = await listThreads(
      jsonRequest("http://localhost/api/threads", "GET", undefined, token),
    );
    expect(listed.status).toBe(200);
    const listedJson = (await listed.json()) as {
      threads: { id: string; title: string; archived: boolean }[];
      error?: string;
    };
    expect(listedJson.error).toBeUndefined();
    expect(listedJson.threads.some((t) => t.id === live.id)).toBe(true);
    expect(listedJson.threads.some((t) => t.id === hidden.id)).toBe(false);
    expect(JSON.stringify(listedJson)).not.toContain("Скрытый диалог");

    const archivedList = await listThreads(
      jsonRequest(
        "http://localhost/api/threads?archived=1",
        "GET",
        undefined,
        token,
      ),
    );
    expect(archivedList.status).toBe(200);
    const archivedJson = (await archivedList.json()) as {
      threads: { id: string; title: string; archived: boolean }[];
    };
    expect(archivedJson.threads.some((t) => t.id === hidden.id)).toBe(true);
    expect(archivedJson.threads.every((t) => t.archived)).toBe(true);
    expect(archivedJson.threads.some((t) => t.id === live.id)).toBe(false);

    const archived = await patchThread(
      jsonRequest(
        `http://localhost/api/threads/${live.id}`,
        "PATCH",
        { archived: true },
        token,
      ),
      paramsLive,
    );
    expect(archived.status).toBe(200);
    const archivedBody = (await archived.json()) as {
      thread: { archived: boolean };
    };
    expect(archivedBody.thread.archived).toBe(true);

    const afterArchive = await listThreads(
      jsonRequest("http://localhost/api/threads", "GET", undefined, token),
    );
    const afterArchiveJson = (await afterArchive.json()) as {
      threads: { id: string }[];
      error?: string;
    };
    expect(afterArchiveJson.error).toBeUndefined();
    expect(afterArchiveJson.threads).toEqual([]);
    expect(JSON.stringify(afterArchiveJson)).not.toMatch(/пока нет|не удалось/i);

    const archiveAfter = await listThreads(
      jsonRequest(
        "http://localhost/api/threads?archived=1",
        "GET",
        undefined,
        token,
      ),
    );
    const archiveAfterJson = (await archiveAfter.json()) as {
      threads: { id: string }[];
    };
    expect(archiveAfterJson.threads.some((t) => t.id === live.id)).toBe(true);

    const restored = await patchThread(
      jsonRequest(
        `http://localhost/api/threads/${live.id}`,
        "PATCH",
        { archived: false },
        token,
      ),
      paramsLive,
    );
    expect(restored.status).toBe(200);
    const restoredBody = (await restored.json()) as {
      thread: { archived: boolean };
    };
    expect(restoredBody.thread.archived).toBe(false);

    const back = await listThreads(
      jsonRequest("http://localhost/api/threads", "GET", undefined, token),
    );
    const backJson = (await back.json()) as { threads: { id: string }[] };
    expect(backJson.threads.some((t) => t.id === live.id)).toBe(true);

    const { token: emptyToken } = await seedUser("archive-empty");
    const emptyArchive = await listThreads(
      jsonRequest(
        "http://localhost/api/threads?archived=1",
        "GET",
        undefined,
        emptyToken,
      ),
    );
    expect(emptyArchive.status).toBe(200);
    const emptyArchiveJson = (await emptyArchive.json()) as {
      threads: unknown[];
      error?: string;
    };
    expect(emptyArchiveJson.error).toBeUndefined();
    expect(emptyArchiveJson.threads).toEqual([]);
    expect(JSON.stringify(emptyArchiveJson)).not.toMatch(/пока нет|не удалось/i);
  });
});
