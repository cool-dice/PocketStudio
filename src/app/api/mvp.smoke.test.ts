import { afterAll, describe, expect, test } from "bun:test";

import { POST as register } from "./auth/register/route";
import { POST as createNote, GET as listNotes } from "./notes/route";
import { POST as createWorkspace } from "./workspaces/route";
import { POST as aiImage } from "./ai/image/route";
import { db } from "@/lib/db";
import { hashPassword, signSession } from "@/lib/auth";
import { UNCONFIGURED_TOOL_MESSAGE } from "@/lib/ai/tools";

const stamp = Date.now().toString(36);
const email = `mvp-smoke-${stamp}@example.test`;
let userId: string | null = null;
let token: string | null = null;
let workspaceId: string | null = null;

const SKIP_PG = !(process.env.DATABASE_URL ?? "").startsWith("postgres");

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

afterAll(async () => {
  if (userId) {
    await db.user.delete({ where: { id: userId } }).catch(() => {});
  }
  await db.$disconnect().catch(() => {});
});

describe.skipIf(SKIP_PG)("MVP smoke: auth", () => {
  test("register rejects invalid JSON", async () => {
    const res = await register(
      new Request("http://localhost/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{",
      }),
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toMatch(/JSON/i);
  });

  test("register rejects short password with Russian fields", async () => {
    const res = await register(
      jsonRequest("http://localhost/api/auth/register", "POST", {
        name: "Тест",
        email: `bad-${stamp}@example.test`,
        password: "short",
      }),
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string; fields?: Record<string, string> };
    expect(json.error).toBeTruthy();
    expect(json.fields?.password ?? json.error).toMatch(/парол/i);
  });
});

describe.skipIf(SKIP_PG)("MVP smoke: workspaces + notes", () => {
  test("unauthenticated workspace create is 401", async () => {
    const res = await createWorkspace(
      jsonRequest("http://localhost/api/workspaces", "POST", {
        type: "book",
        name: "Тишина",
      }),
    );
    expect(res.status).toBe(401);
    const json = (await res.json()) as { error: string };
    expect(json.error).toMatch(/авторизац/i);
  });

  test("creates a user, workspace, and linked note", async () => {
    const user = await db.user.create({
      data: {
        name: "Smoke",
        email,
        passwordHash: await hashPassword("password-ok"),
        role: "client",
      },
    });
    userId = user.id;
    token = await signSession({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    const wsRes = await createWorkspace(
      jsonRequest(
        "http://localhost/api/workspaces",
        "POST",
        { type: "book", name: "Маяк", description: "smoke" },
        token,
      ),
    );
    expect(wsRes.status).toBe(201);
    const wsJson = (await wsRes.json()) as { workspace: { id: string; name: string } };
    expect(wsJson.workspace.name).toBe("Маяк");
    workspaceId = wsJson.workspace.id;

    const noteRes = await createNote(
      jsonRequest(
        "http://localhost/api/notes",
        "POST",
        { text: "маяк в тумане", projectId: workspaceId },
        token,
      ),
    );
    expect(noteRes.status).toBe(201);
    const noteJson = (await noteRes.json()) as { note: { id: string; rawText: string } };
    expect(noteJson.note.rawText).toContain("маяк");

    const listRes = await listNotes(
      jsonRequest(
        `http://localhost/api/notes?projectId=${encodeURIComponent(workspaceId!)}`,
        "GET",
        undefined,
        token,
      ),
    );
    expect(listRes.status).toBe(200);
    const listJson = (await listRes.json()) as { notes: Array<{ id: string }> };
    expect(listJson.notes.some((n) => n.id === noteJson.note.id)).toBe(true);
  });
});

describe.skipIf(SKIP_PG)("MVP smoke: AI unconfigured", () => {
  test("image generation fails in Russian when no provider is set for the user", async () => {
    expect(token && workspaceId).toBeTruthy();
    const res = await aiImage(
      jsonRequest(
        "http://localhost/api/ai/image",
        "POST",
        { projectId: workspaceId, prompt: "маяк в тумане ночью" },
        token!,
      ),
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
    const json = (await res.json()) as { error: string };
    expect(typeof json.error).toBe("string");
    expect(json.error.length).toBeGreaterThan(8);
    // Fresh user has no BYOK and typically no platform default in CI.
    // If a default exists locally, the message is still Russian (not a stack).
    expect(json.error).toMatch(/[А-Яа-яЁё]/);
    if (res.status === 400) {
      expect(json.error).toBe(UNCONFIGURED_TOOL_MESSAGE);
    }
  });
});

describe.skipIf(SKIP_PG)("full app smoke: skills, favorite, duplicate, offers", () => {
  test("skills catalog seeds builtins and toggles persist", async () => {
    expect(token).toBeTruthy();
    const { GET: listSkills, POST: createSkill } = await import("./skills/route");
    const { PATCH: patchSkill } = await import("./skills/[id]/route");
    const list = await listSkills(
      jsonRequest("http://localhost/api/skills", "GET", undefined, token!),
    );
    expect(list.status).toBe(200);
    const body = (await list.json()) as {
      skills: Array<{ id: string; enabled: boolean; catalogKey: string | null }>;
      store: Array<{ key: string }>;
    };
    expect(body.skills.length).toBeGreaterThan(0);
    expect(body.store.length).toBeGreaterThan(0);
    const first = body.skills[0]!;
    const patched = await patchSkill(
      jsonRequest(
        `http://localhost/api/skills/${first.id}`,
        "PATCH",
        { enabled: !first.enabled },
        token!,
      ),
      { params: Promise.resolve({ id: first.id }) },
    );
    expect(patched.status).toBe(200);

    const created = await createSkill(
      jsonRequest(
        "http://localhost/api/skills",
        "POST",
        {
          name: "Smoke skill",
          skillMd: "---\nname: Smoke\n---\n\n## Когда использовать\nтест",
          triggers: ["smoke"],
        },
        token!,
      ),
    );
    expect(created.status).toBe(201);
  });

  test("workspace favorite, duplicate and offer checkout", async () => {
    expect(token && workspaceId).toBeTruthy();
    const { PATCH: patchWs } = await import("./workspaces/[id]/route");
    const { POST: duplicate } = await import("./workspaces/[id]/duplicate/route");
    const { POST: createOffer, GET: listOffers } = await import("./offers/route");
    const { PATCH: checkout } = await import("./offers/[id]/route");

    const fav = await patchWs(
      jsonRequest(
        `http://localhost/api/workspaces/${workspaceId}`,
        "PATCH",
        { favorite: true },
        token!,
      ),
      { params: Promise.resolve({ id: workspaceId! }) },
    );
    expect(fav.status).toBe(200);
    const favJson = (await fav.json()) as { workspace: { favorite: boolean } };
    expect(favJson.workspace.favorite).toBe(true);

    const dup = await duplicate(
      jsonRequest(
        `http://localhost/api/workspaces/${workspaceId}/duplicate`,
        "POST",
        {},
        token!,
      ),
      { params: Promise.resolve({ id: workspaceId! }) },
    );
    expect(dup.status).toBe(201);

    const offerRes = await createOffer(
      jsonRequest(
        "http://localhost/api/offers",
        "POST",
        {
          projectId: workspaceId,
          title: "Глава 1",
          priceCents: 10000,
          paymentMode: "simulated",
        },
        token!,
      ),
    );
    expect(offerRes.status).toBe(201);
    const offerJson = (await offerRes.json()) as { offer: { id: string } };
    const paid = await checkout(
      jsonRequest(
        `http://localhost/api/offers/${offerJson.offer.id}`,
        "PATCH",
        { checkout: true },
        token!,
      ),
      { params: Promise.resolve({ id: offerJson.offer.id }) },
    );
    expect(paid.status).toBe(200);
    const listed = await listOffers(
      jsonRequest(
        `http://localhost/api/offers?projectId=${workspaceId}`,
        "GET",
        undefined,
        token!,
      ),
    );
    expect(listed.status).toBe(200);
  });

  test("design canvas persists and admin invite creates a token", async () => {
    expect(token && workspaceId && userId).toBeTruthy();
    const { GET: getDesign } = await import("./workspaces/[id]/design/route");
    const canvas = await getDesign(
      jsonRequest(
        `http://localhost/api/workspaces/${workspaceId}/design?mode=raster`,
        "GET",
        undefined,
        token!,
      ),
      { params: Promise.resolve({ id: workspaceId! }) },
    );
    expect(canvas.status).toBe(200);
    const canvasJson = (await canvas.json()) as {
      design: { mode: string; payload: { kind: string } };
    };
    expect(canvasJson.design.mode).toBe("raster");
    expect(canvasJson.design.payload.kind).toBe("raster");

    await db.user.update({ where: { id: userId! }, data: { role: "admin" } });
    const { POST: createInvite } = await import("./admin/invites/route");
    const inv = await createInvite(
      jsonRequest(
        "http://localhost/api/admin/invites",
        "POST",
        { email: `invite-${stamp}@example.test`, role: "client" },
        token!,
      ),
    );
    expect(inv.status).toBe(201);
    const invJson = (await inv.json()) as { invite: { token: string } };
    expect(invJson.invite.token.length).toBeGreaterThan(8);
  });

  test("note tags, reminders, stats, payments adapter, health brand", async () => {
    expect(token && userId).toBeTruthy();
    const { GET: getStats } = await import("./notes/stats/route");
    const { GET: getTags } = await import("./tags/route");
    const { GET: getPay } = await import("./payments/status/route");
    const { GET: health } = await import("./route");
    const { PATCH: patchNote } = await import("./notes/[id]/route");

    const noteRes = await createNote(
      jsonRequest(
        "http://localhost/api/notes",
        "POST",
        { text: "канон глаз Марины" },
        token!,
      ),
    );
    expect(noteRes.status).toBe(201);
    const noteJson = (await noteRes.json()) as { note: { id: string } };

    const tagged = await patchNote(
      jsonRequest(
        `http://localhost/api/notes/${noteJson.note.id}`,
        "PATCH",
        { tags: ["канон", "персонаж"], remindAt: new Date(Date.now() + 3600_000).toISOString() },
        token!,
      ),
      { params: Promise.resolve({ id: noteJson.note.id }) },
    );
    expect(tagged.status).toBe(200);
    const taggedJson = (await tagged.json()) as {
      note: { tags: { name: string }[]; remindAt: string | null };
    };
    expect(taggedJson.note.tags.some((t) => t.name === "канон")).toBe(true);
    expect(taggedJson.note.remindAt).toBeTruthy();

    const stats = await getStats(
      jsonRequest("http://localhost/api/notes/stats", "GET", undefined, token!),
    );
    expect(stats.status).toBe(200);
    const statsJson = (await stats.json()) as { days: unknown[]; total14d: number };
    expect(statsJson.days.length).toBe(14);

    const tags = await getTags(
      jsonRequest("http://localhost/api/tags", "GET", undefined, token!),
    );
    expect(tags.status).toBe(200);

    const pay = await getPay(
      jsonRequest("http://localhost/api/payments/status", "GET", undefined, token!),
    );
    expect(pay.status).toBe(200);
    const payJson = (await pay.json()) as { defaultMode: string };
    expect(payJson.defaultMode).toBe("simulated");

    const h = await health();
    const hJson = (await h.json()) as { service: string };
    expect(hJson.service).toBe("pocketstudio");
  });

  test("unauthenticated notes and rag search are 401; login sets ps_session", async () => {
    const { GET: listNotes } = await import("./notes/route");
    const { POST: ragSearch } = await import("./rag/search/route");
    const { POST: login } = await import("./auth/login/route");

    const notes401 = await listNotes(
      jsonRequest("http://localhost/api/notes", "GET"),
    );
    expect(notes401.status).toBe(401);

    const rag401 = await ragSearch(
      jsonRequest("http://localhost/api/rag/search", "POST", { query: "глаза" }),
    );
    expect(rag401.status).toBe(401);

    expect(userId).toBeTruthy();
    await db.user.update({
      where: { id: userId! },
      data: { passwordHash: await hashPassword("password-ok") },
    });
    const loginRes = await login(
      jsonRequest("http://localhost/api/auth/login", "POST", {
        email,
        password: "password-ok",
      }),
    );
    expect(loginRes.status).toBe(200);
    const cookieHeader =
      typeof loginRes.headers.getSetCookie === "function"
        ? loginRes.headers.getSetCookie().join("\n")
        : (loginRes.headers.get("set-cookie") ?? "");
    expect(cookieHeader).toMatch(/ps_session=/);
  });

  test("due reminder fire is idempotent and lists due notes", async () => {
    expect(token).toBeTruthy();
    const { POST: fire } = await import("./notes/reminders/fire/route");
    const { PATCH: patchNote } = await import("./notes/[id]/route");
    const { GET: listNotes } = await import("./notes/route");

    const noteRes = await createNote(
      jsonRequest(
        "http://localhost/api/notes",
        "POST",
        { text: "напомни про маяк" },
        token!,
      ),
    );
    expect(noteRes.status).toBe(201);
    const { note } = (await noteRes.json()) as { note: { id: string } };
    const past = new Date(Date.now() - 60_000).toISOString();
    const tagged = await patchNote(
      jsonRequest(
        `http://localhost/api/notes/${note.id}`,
        "PATCH",
        { remindAt: past },
        token!,
      ),
      { params: Promise.resolve({ id: note.id }) },
    );
    expect(tagged.status).toBe(200);

    const dueList = await listNotes(
      jsonRequest("http://localhost/api/notes?due=1", "GET", undefined, token!),
    );
    expect(dueList.status).toBe(200);
    const dueJson = (await dueList.json()) as { notes: { id: string }[] };
    expect(dueJson.notes.some((n) => n.id === note.id)).toBe(true);

    const first = await fire(
      jsonRequest("http://localhost/api/notes/reminders/fire", "POST", {}, token!),
    );
    expect(first.status).toBe(200);
    const firstJson = (await first.json()) as { fired: number };
    expect(firstJson.fired).toBeGreaterThanOrEqual(1);

    const second = await fire(
      jsonRequest("http://localhost/api/notes/reminders/fire", "POST", {}, token!),
    );
    const secondJson = (await second.json()) as { fired: number };
    expect(secondJson.fired).toBe(0);
  });
});
