import { afterAll, describe, expect, test } from "bun:test";

import { hashPassword, signSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { EMPTY_NOTE_ANALYSIS_MESSAGE } from "@/lib/note-analysis";

import { POST as analyze } from "./[id]/analyze/route";

const SKIP_PG = !(process.env.DATABASE_URL ?? "").startsWith("postgres");
const stamp = Date.now().toString(36);

function jsonRequest(id: string, bearer?: string): Request {
  const headers = new Headers({ accept: "application/json" });
  if (bearer) headers.set("authorization", `Bearer ${bearer}`);
  return new Request(`http://localhost/api/notes/${id}/analyze`, {
    method: "POST",
    headers,
  });
}

describe.skipIf(SKIP_PG)("POST /api/notes/[id]/analyze honesty", () => {
  let userId: string | null = null;
  let token: string | null = null;

  afterAll(async () => {
    if (userId) {
      await db.user.delete({ where: { id: userId } }).catch(() => {});
    }
  });

  test("empty note is 422 and is not re-queued as success", async () => {
    const user = await db.user.create({
      data: {
        name: "Analyze",
        email: `note-analyze-${stamp}@example.test`,
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

    const empty = await db.note.create({
      data: { userId: user.id, rawText: "  ", status: "pending" },
    });
    const res = await analyze(jsonRequest(empty.id, token), {
      params: Promise.resolve({ id: empty.id }),
    });
    expect(res.status).toBe(422);
    const json = (await res.json()) as { error: string; note?: { status: string } };
    expect(json.error).toBe(EMPTY_NOTE_ANALYSIS_MESSAGE);
    expect(json.note).toBeUndefined();
    const still = await db.note.findUnique({ where: { id: empty.id } });
    expect(still?.status).toBe("pending");
    expect(still?.analyzedAt).toBeNull();
  });

  test("missing note is 404 in Russian", async () => {
    expect(token).toBeTruthy();
    const res = await analyze(jsonRequest("missing-note-id", token!), {
      params: Promise.resolve({ id: "missing-note-id" }),
    });
    expect(res.status).toBe(404);
    const json = (await res.json()) as { error: string };
    expect(json.error).toMatch(/не найдена/i);
  });
});
