import { afterAll, describe, expect, test } from "bun:test";

import { hashPassword, signSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  CATEGORY_COLOR_INVALID,
  CATEGORY_ICON_INVALID,
  CATEGORY_NAME_EMPTY,
  CATEGORY_NAME_TAKEN,
  CATEGORY_NOT_FOUND,
} from "@/lib/notebook-taxonomy";

import { GET as listCategories, POST as createCategory } from "./route";
import { DELETE as deleteCategory, PATCH as patchCategory } from "./[id]/route";
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

describe.skipIf(SKIP_PG)("categories API: own CRUD, empty vs error, IDOR", () => {
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
        email: `cats-${label}-${stamp}@example.test`,
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
    const list = await listCategories(
      jsonRequest("http://localhost/api/categories", "GET"),
    );
    expect(list.status).toBe(401);

    const created = await createCategory(
      jsonRequest("http://localhost/api/categories", "POST", { name: "Идеи" }),
    );
    expect(created.status).toBe(401);

    const patched = await patchCategory(
      jsonRequest("http://localhost/api/categories/nope", "PATCH", { name: "X" }),
      { params: Promise.resolve({ id: "nope" }) },
    );
    expect(patched.status).toBe(401);

    const deleted = await deleteCategory(
      jsonRequest("http://localhost/api/categories/nope", "DELETE"),
      { params: Promise.resolve({ id: "nope" }) },
    );
    expect(deleted.status).toBe(401);
  });

  test("successful empty list is [] — not an error payload", async () => {
    const { token } = await seedUser("empty");
    const res = await listCategories(
      jsonRequest("http://localhost/api/categories", "GET", undefined, token),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      categories: unknown[];
      error?: string;
    };
    expect(json.error).toBeUndefined();
    expect(json.categories).toEqual([]);
    expect(JSON.stringify(json)).not.toMatch(/пока нет|не удалось/i);
  });

  test("empty name is 400 field error, not 201", async () => {
    const { token } = await seedUser("blank");
    const empty = await createCategory(
      jsonRequest("http://localhost/api/categories", "POST", { name: "   " }, token),
    );
    expect(empty.status).toBe(400);
    const json = (await empty.json()) as {
      error: string;
      fields?: { name?: string };
      category?: unknown;
    };
    expect(json.category).toBeUndefined();
    expect(json.error).toBe(CATEGORY_NAME_EMPTY);
    expect(json.fields?.name).toBe(CATEGORY_NAME_EMPTY);
  });

  test("create/rename/delete own; duplicate name 409", async () => {
    const { token } = await seedUser("owner-crud");
    const created = await createCategory(
      jsonRequest(
        "http://localhost/api/categories",
        "POST",
        { name: "Идеи", color: "emerald", icon: "lightbulb" },
        token,
      ),
    );
    expect(created.status).toBe(201);
    const createdJson = (await created.json()) as {
      category: {
        id: string;
        name: string;
        color: string;
        icon: string;
        noteCount: number;
      };
    };
    expect(createdJson.category.name).toBe("Идеи");
    expect(createdJson.category.color).toBe("emerald");
    expect(createdJson.category.icon).toBe("lightbulb");
    expect(createdJson.category.noteCount).toBe(0);

    const dup = await createCategory(
      jsonRequest("http://localhost/api/categories", "POST", { name: "Идеи" }, token),
    );
    expect(dup.status).toBe(409);
    const dupJson = (await dup.json()) as { error: string; category?: unknown };
    expect(dupJson.category).toBeUndefined();
    expect(dupJson.error).toBe(CATEGORY_NAME_TAKEN);

    const params = { params: Promise.resolve({ id: createdJson.category.id }) };
    const renamed = await patchCategory(
      jsonRequest(
        `http://localhost/api/categories/${createdJson.category.id}`,
        "PATCH",
        { name: "Замысел" },
        token,
      ),
      params,
    );
    expect(renamed.status).toBe(200);
    const renamedJson = (await renamed.json()) as {
      category: { name: string; color: string; icon: string };
    };
    expect(renamedJson.category.name).toBe("Замысел");
    expect(renamedJson.category.color).toBe("emerald");
    expect(renamedJson.category.icon).toBe("lightbulb");

    const deleted = await deleteCategory(
      jsonRequest(
        `http://localhost/api/categories/${createdJson.category.id}`,
        "DELETE",
        undefined,
        token,
      ),
      params,
    );
    expect(deleted.status).toBe(200);
    const deletedJson = (await deleted.json()) as {
      ok: boolean;
      notes?: unknown;
      categories?: unknown;
    };
    expect(deletedJson.ok).toBe(true);
    expect(deletedJson.notes).toBeUndefined();

    const list = await listCategories(
      jsonRequest("http://localhost/api/categories", "GET", undefined, token),
    );
    const listJson = (await list.json()) as { categories: { id: string }[] };
    expect(listJson.categories.some((c) => c.id === createdJson.category.id)).toBe(
      false,
    );
  });

  test("list is owner-scoped; attacker PATCH/DELETE are 404 and do not wipe", async () => {
    const { user: owner, token: ownerToken } = await seedUser("victim");
    const { token: attackerToken } = await seedUser("atk");

    const category = await db.category.create({
      data: {
        userId: owner.id,
        name: `Секрет-${stamp}`,
        color: "rose",
        icon: "heart",
      },
    });
    const params = { params: Promise.resolve({ id: category.id }) };

    const stolenList = await listCategories(
      jsonRequest("http://localhost/api/categories", "GET", undefined, attackerToken),
    );
    expect(stolenList.status).toBe(200);
    const stolenJson = (await stolenList.json()) as {
      categories: { id: string; name: string }[];
    };
    expect(stolenJson.categories.some((c) => c.id === category.id)).toBe(false);
    expect(JSON.stringify(stolenJson)).not.toContain(`Секрет-${stamp}`);

    const patched = await patchCategory(
      jsonRequest(
        `http://localhost/api/categories/${category.id}`,
        "PATCH",
        { name: "Взлом" },
        attackerToken,
      ),
      params,
    );
    expect(patched.status).toBe(404);
    const patchedJson = (await patched.json()) as {
      error: string;
      category?: unknown;
    };
    expect(patchedJson.category).toBeUndefined();
    expect(patchedJson.error).toBe(CATEGORY_NOT_FOUND);

    const deleted = await deleteCategory(
      jsonRequest(
        `http://localhost/api/categories/${category.id}`,
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
    expect(deletedJson.error).toBe(CATEGORY_NOT_FOUND);

    const still = await db.category.findUnique({ where: { id: category.id } });
    expect(still?.name).toBe(`Секрет-${stamp}`);
    expect(still?.userId).toBe(owner.id);

    const ownerList = await listCategories(
      jsonRequest("http://localhost/api/categories", "GET", undefined, ownerToken),
    );
    const ownerJson = (await ownerList.json()) as {
      categories: { id: string; name: string }[];
    };
    expect(ownerJson.categories.some((c) => c.id === category.id)).toBe(true);
  });

  test("deleting a category unlinks own notes only — never leaks another user", async () => {
    const { user: owner, token: ownerToken } = await seedUser("del-own");
    const { user: other, token: otherToken } = await seedUser("del-other");

    const ownerCat = await db.category.create({
      data: { userId: owner.id, name: "Идеи", color: "sky", icon: "brain" },
    });
    const otherCat = await db.category.create({
      data: { userId: other.id, name: "Идеи", color: "sky", icon: "brain" },
    });
    const mine = await db.note.create({
      data: {
        userId: owner.id,
        rawText: "моя мысль про маяк",
        categoryId: ownerCat.id,
      },
    });
    const secret = await db.note.create({
      data: {
        userId: other.id,
        rawText: "секрет чужого блокнота",
        categoryId: otherCat.id,
      },
    });
    await db.note.create({
      data: {
        userId: other.id,
        rawText: "ещё секрет на той же категории",
        categoryId: otherCat.id,
      },
    });

    const listed = await listCategories(
      jsonRequest("http://localhost/api/categories", "GET", undefined, ownerToken),
    );
    const listedJson = (await listed.json()) as {
      categories: { id: string; noteCount: number }[];
    };
    const mineRow = listedJson.categories.find((c) => c.id === ownerCat.id);
    expect(mineRow?.noteCount).toBe(1);
    expect(JSON.stringify(listedJson)).not.toContain("секрет чужого");

    const deleted = await deleteCategory(
      jsonRequest(
        `http://localhost/api/categories/${ownerCat.id}`,
        "DELETE",
        undefined,
        ownerToken,
      ),
      { params: Promise.resolve({ id: ownerCat.id }) },
    );
    expect(deleted.status).toBe(200);
    const body = await deleted.text();
    expect(body).not.toContain("секрет чужого");
    expect(body).not.toContain(secret.id);
    expect(body).not.toContain(otherCat.id);
    const deletedJson = JSON.parse(body) as { ok: boolean; notes?: unknown };
    expect(deletedJson.ok).toBe(true);
    expect(deletedJson.notes).toBeUndefined();

    const mineAfter = await db.note.findUnique({ where: { id: mine.id } });
    expect(mineAfter?.categoryId).toBeNull();
    expect(mineAfter?.rawText).toBe("моя мысль про маяк");

    const secretAfter = await db.note.findUnique({ where: { id: secret.id } });
    expect(secretAfter?.categoryId).toBe(otherCat.id);
    expect(secretAfter?.rawText).toBe("секрет чужого блокнота");

    const otherStill = await db.category.findUnique({ where: { id: otherCat.id } });
    expect(otherStill?.name).toBe("Идеи");

    const otherNotes = await listNotes(
      jsonRequest("http://localhost/api/notes", "GET", undefined, otherToken),
    );
    expect(otherNotes.status).toBe(200);
    const otherJson = (await otherNotes.json()) as {
      notes: { id: string; rawText: string | null; category: { id: string } | null }[];
    };
    expect(otherJson.notes.some((n) => n.id === secret.id)).toBe(true);
    expect(
      otherJson.notes.find((n) => n.id === secret.id)?.category?.id,
    ).toBe(otherCat.id);
    expect(JSON.stringify(otherJson)).not.toContain(mine.id);
  });

  test("POST and PATCH persist allowlisted color/icon; junk is 400", async () => {
    const { token } = await seedUser("style");
    const created = await createCategory(
      jsonRequest(
        "http://localhost/api/categories",
        "POST",
        { name: "Маяк", color: "violet", icon: "rocket" },
        token,
      ),
    );
    expect(created.status).toBe(201);
    const createdJson = (await created.json()) as {
      category: { id: string; color: string; icon: string };
    };
    expect(createdJson.category.color).toBe("violet");
    expect(createdJson.category.icon).toBe("rocket");

    const params = { params: Promise.resolve({ id: createdJson.category.id }) };
    const patched = await patchCategory(
      jsonRequest(
        `http://localhost/api/categories/${createdJson.category.id}`,
        "PATCH",
        { color: "cyan", icon: "coffee" },
        token,
      ),
      params,
    );
    expect(patched.status).toBe(200);
    const patchedJson = (await patched.json()) as {
      category: { color: string; icon: string; name: string };
    };
    expect(patchedJson.category.name).toBe("Маяк");
    expect(patchedJson.category.color).toBe("cyan");
    expect(patchedJson.category.icon).toBe("coffee");

    const listed = await listCategories(
      jsonRequest("http://localhost/api/categories", "GET", undefined, token),
    );
    const listedJson = (await listed.json()) as {
      categories: { id: string; color: string; icon: string }[];
    };
    const row = listedJson.categories.find((c) => c.id === createdJson.category.id);
    expect(row?.color).toBe("cyan");
    expect(row?.icon).toBe("coffee");

    const badColor = await createCategory(
      jsonRequest(
        "http://localhost/api/categories",
        "POST",
        { name: "Мусор", color: "chartreuse", icon: "rocket" },
        token,
      ),
    );
    expect(badColor.status).toBe(400);
    const badColorJson = (await badColor.json()) as {
      error: string;
      fields?: { color?: string };
      category?: unknown;
    };
    expect(badColorJson.category).toBeUndefined();
    expect(badColorJson.fields?.color).toBe(CATEGORY_COLOR_INVALID);

    const badIcon = await patchCategory(
      jsonRequest(
        `http://localhost/api/categories/${createdJson.category.id}`,
        "PATCH",
        { icon: "unicorn" },
        token,
      ),
      params,
    );
    expect(badIcon.status).toBe(400);
    const badIconJson = (await badIcon.json()) as {
      error: string;
      fields?: { icon?: string };
      category?: unknown;
    };
    expect(badIconJson.category).toBeUndefined();
    expect(badIconJson.fields?.icon).toBe(CATEGORY_ICON_INVALID);

    const afterBad = await listCategories(
      jsonRequest("http://localhost/api/categories", "GET", undefined, token),
    );
    const afterBadJson = (await afterBad.json()) as {
      categories: { id: string; color: string; icon: string }[];
    };
    const still = afterBadJson.categories.find((c) => c.id === createdJson.category.id);
    expect(still?.color).toBe("cyan");
    expect(still?.icon).toBe("coffee");
  });
});
