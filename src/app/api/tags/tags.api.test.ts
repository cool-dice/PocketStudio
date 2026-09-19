import { afterAll, describe, expect, test } from "bun:test";

import { hashPassword, signSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  TAG_NAME_EMPTY,
  TAG_NAME_TAKEN,
  TAG_NOT_FOUND,
} from "@/lib/notebook-taxonomy";

import { GET as listTags, POST as createTag } from "./route";
import { DELETE as deleteTag, PATCH as patchTag } from "./[id]/route";
import { GET as listNotes } from "../notes/route";

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

describe.skipIf(SKIP_PG)("tags API: own CRUD, empty vs error, IDOR", () => {
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
        email: `tags-${label}-${stamp}@example.test`,
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
    const list = await listTags(jsonRequest("http://localhost/api/tags", "GET"));
    expect(list.status).toBe(401);

    const created = await createTag(
      jsonRequest("http://localhost/api/tags", "POST", { name: "канон" }),
    );
    expect(created.status).toBe(401);

    const patched = await patchTag(
      jsonRequest("http://localhost/api/tags/nope", "PATCH", { name: "x" }),
      { params: Promise.resolve({ id: "nope" }) },
    );
    expect(patched.status).toBe(401);

    const deleted = await deleteTag(
      jsonRequest("http://localhost/api/tags/nope", "DELETE"),
      { params: Promise.resolve({ id: "nope" }) },
    );
    expect(deleted.status).toBe(401);
  });

  test("successful empty list is [] — not an error payload", async () => {
    const { token } = await seedUser("empty");
    const res = await listTags(
      jsonRequest("http://localhost/api/tags", "GET", undefined, token),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { tags: unknown[]; error?: string };
    expect(json.error).toBeUndefined();
    expect(json.tags).toEqual([]);
    expect(JSON.stringify(json)).not.toMatch(/пока нет|не удалось/i);
  });

  test("empty name is 400 field error, not 201", async () => {
    const { token } = await seedUser("blank");
    const empty = await createTag(
      jsonRequest("http://localhost/api/tags", "POST", { name: "  #  " }, token),
    );
    expect(empty.status).toBe(400);
    const json = (await empty.json()) as {
      error: string;
      fields?: { name?: string };
      tag?: unknown;
    };
    expect(json.tag).toBeUndefined();
    expect(json.error).toBe(TAG_NAME_EMPTY);
    expect(json.fields?.name).toBe(TAG_NAME_EMPTY);
  });

  test("create/rename/delete own; duplicate name 409", async () => {
    const { token } = await seedUser("owner-crud");
    const created = await createTag(
      jsonRequest("http://localhost/api/tags", "POST", { name: "#канон" }, token),
    );
    expect(created.status).toBe(201);
    const createdJson = (await created.json()) as {
      tag: { id: string; name: string; noteCount: number };
    };
    expect(createdJson.tag.name).toBe("канон");
    expect(createdJson.tag.noteCount).toBe(0);

    const dup = await createTag(
      jsonRequest("http://localhost/api/tags", "POST", { name: "канон" }, token),
    );
    expect(dup.status).toBe(409);
    const dupJson = (await dup.json()) as { error: string; tag?: unknown };
    expect(dupJson.tag).toBeUndefined();
    expect(dupJson.error).toBe(TAG_NAME_TAKEN);

    const params = { params: Promise.resolve({ id: createdJson.tag.id }) };
    const renamed = await patchTag(
      jsonRequest(
        `http://localhost/api/tags/${createdJson.tag.id}`,
        "PATCH",
        { name: "персонаж" },
        token,
      ),
      params,
    );
    expect(renamed.status).toBe(200);
    const renamedJson = (await renamed.json()) as { tag: { name: string } };
    expect(renamedJson.tag.name).toBe("персонаж");

    const deleted = await deleteTag(
      jsonRequest(
        `http://localhost/api/tags/${createdJson.tag.id}`,
        "DELETE",
        undefined,
        token,
      ),
      params,
    );
    expect(deleted.status).toBe(200);
    const deletedJson = (await deleted.json()) as { ok: boolean; notes?: unknown };
    expect(deletedJson.ok).toBe(true);
    expect(deletedJson.notes).toBeUndefined();
  });

  test("list is owner-scoped; attacker PATCH/DELETE are 404 and do not wipe", async () => {
    const { user: owner, token: ownerToken } = await seedUser("victim");
    const { token: attackerToken } = await seedUser("atk");

    const tag = await db.tag.create({
      data: { userId: owner.id, name: `маяк-${stamp}`, color: "stone" },
    });
    const params = { params: Promise.resolve({ id: tag.id }) };

    const stolenList = await listTags(
      jsonRequest("http://localhost/api/tags", "GET", undefined, attackerToken),
    );
    expect(stolenList.status).toBe(200);
    const stolenJson = (await stolenList.json()) as {
      tags: { id: string; name: string }[];
    };
    expect(stolenJson.tags.some((t) => t.id === tag.id)).toBe(false);
    expect(JSON.stringify(stolenJson)).not.toContain(`маяк-${stamp}`);

    const patched = await patchTag(
      jsonRequest(
        `http://localhost/api/tags/${tag.id}`,
        "PATCH",
        { name: "взлом" },
        attackerToken,
      ),
      params,
    );
    expect(patched.status).toBe(404);
    const patchedJson = (await patched.json()) as { error: string; tag?: unknown };
    expect(patchedJson.tag).toBeUndefined();
    expect(patchedJson.error).toBe(TAG_NOT_FOUND);

    const deleted = await deleteTag(
      jsonRequest(
        `http://localhost/api/tags/${tag.id}`,
        "DELETE",
        undefined,
        attackerToken,
      ),
      params,
    );
    expect(deleted.status).toBe(404);
    const deletedJson = (await deleted.json()) as {
      error: string;
      ok?: boolean;
      notes?: unknown;
    };
    expect(deletedJson.ok).toBeUndefined();
    expect(deletedJson.notes).toBeUndefined();
    expect(deletedJson.error).toBe(TAG_NOT_FOUND);

    const still = await db.tag.findUnique({ where: { id: tag.id } });
    expect(still?.name).toBe(`маяк-${stamp}`);

    const ownerList = await listTags(
      jsonRequest("http://localhost/api/tags", "GET", undefined, ownerToken),
    );
    const ownerJson = (await ownerList.json()) as { tags: { id: string }[] };
    expect(ownerJson.tags.some((t) => t.id === tag.id)).toBe(true);
  });

  test("deleting a tag unlinks own notes only — never leaks another user", async () => {
    const { user: owner, token: ownerToken } = await seedUser("del-own");
    const { user: other, token: otherToken } = await seedUser("del-other");

    const ownerTag = await db.tag.create({
      data: { userId: owner.id, name: "канон", color: "stone" },
    });
    const otherTag = await db.tag.create({
      data: { userId: other.id, name: "канон", color: "stone" },
    });
    const mine = await db.note.create({
      data: { userId: owner.id, rawText: "моя мысль" },
    });
    const secret = await db.note.create({
      data: { userId: other.id, rawText: "секрет чужого тега" },
    });
    await db.noteTag.create({ data: { noteId: mine.id, tagId: ownerTag.id } });
    await db.noteTag.create({ data: { noteId: secret.id, tagId: otherTag.id } });

    const deleted = await deleteTag(
      jsonRequest(
        `http://localhost/api/tags/${ownerTag.id}`,
        "DELETE",
        undefined,
        ownerToken,
      ),
      { params: Promise.resolve({ id: ownerTag.id }) },
    );
    expect(deleted.status).toBe(200);
    const body = await deleted.text();
    expect(body).not.toContain("секрет чужого тега");
    expect(body).not.toContain(secret.id);
    const deletedJson = JSON.parse(body) as { ok: boolean; notes?: unknown };
    expect(deletedJson.ok).toBe(true);
    expect(deletedJson.notes).toBeUndefined();

    const mineLink = await db.noteTag.findUnique({
      where: { noteId_tagId: { noteId: mine.id, tagId: ownerTag.id } },
    });
    expect(mineLink).toBeNull();
    const mineNote = await db.note.findUnique({ where: { id: mine.id } });
    expect(mineNote?.rawText).toBe("моя мысль");

    const secretLink = await db.noteTag.findUnique({
      where: { noteId_tagId: { noteId: secret.id, tagId: otherTag.id } },
    });
    expect(secretLink).not.toBeNull();
    const secretNote = await db.note.findUnique({ where: { id: secret.id } });
    expect(secretNote?.rawText).toBe("секрет чужого тега");

    const otherNotes = await listNotes(
      jsonRequest("http://localhost/api/notes", "GET", undefined, otherToken),
    );
    const otherJson = (await otherNotes.json()) as {
      notes: { id: string; tags?: { name: string }[] }[];
    };
    expect(otherJson.notes.some((n) => n.id === secret.id)).toBe(true);
    expect(
      otherJson.notes.find((n) => n.id === secret.id)?.tags?.some((t) => t.name === "канон"),
    ).toBe(true);
    expect(JSON.stringify(otherJson)).not.toContain(mine.id);
  });
});
