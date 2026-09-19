import { afterAll, describe, expect, test } from "bun:test";

import { hashPassword, signSession } from "@/lib/auth";
import { GatewayError } from "@/lib/ai/errors";
import { resolveToolRoute } from "@/lib/ai/resolve";
import { UNCONFIGURED_TOOL_MESSAGE } from "@/lib/ai/tools";
import { db } from "@/lib/db";
import { paletteFromArtifact } from "@/lib/palette";
import type { ArtifactDto } from "@/lib/workspace-types";

import { POST as generatePalette } from "./palette/route";
import { POST as describeEntity } from "./describe/route";
import { GET as listArtifacts } from "../workspaces/[id]/artifacts/route";

const SKIP_PG = !(process.env.DATABASE_URL ?? "").startsWith("postgres");
const stamp = Date.now().toString(36);
const ids: string[] = [];

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

describe.skipIf(SKIP_PG)("ai/palette and ai/describe: unconfigured, persist, IDOR", () => {
  afterAll(async () => {
    for (const id of ids.reverse()) {
      await db.user.delete({ where: { id } }).catch(() => {});
    }
  });

  async function seedUser(label: string) {
    const user = await db.user.create({
      data: {
        name: label,
        email: `paldesc-${label}-${stamp}@example.test`,
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
    const ws = await db.project.create({
      data: { userId: user.id, name: `Стиль ${label}`, type: "book" },
    });
    return { user, token, ws };
  }

  test("unconfigured palette is Russian and creates no artifact", async () => {
    const { user, token, ws } = await seedUser("nopalette");
    let unconfigured = false;
    try {
      await resolveToolRoute(db, user.id, "palette");
    } catch (err) {
      unconfigured =
        err instanceof GatewayError && err.message === UNCONFIGURED_TOOL_MESSAGE;
    }
    if (!unconfigured) {
      expect(UNCONFIGURED_TOOL_MESSAGE).toMatch(/Администратор ещё не настроил/);
      return;
    }

    const before = await db.artifact.count({
      where: { projectId: ws.id, stage: "style" },
    });
    const res = await generatePalette(
      jsonRequest(
        "http://localhost/api/ai/palette",
        "POST",
        { projectId: ws.id, brief: "холодный триллер" },
        token,
      ),
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as {
      error: string;
      artifact?: unknown;
      palette?: unknown;
    };
    expect(json.error).toBe(UNCONFIGURED_TOOL_MESSAGE);
    expect(json.error).toMatch(/[А-Яа-яЁё]/);
    expect(json.artifact).toBeUndefined();
    expect(json.palette).toBeUndefined();
    expect(await db.artifact.count({ where: { projectId: ws.id, stage: "style" } })).toBe(
      before,
    );
  });

  test("persisted palette artifact reloads without fake swatches", async () => {
    const { token, ws } = await seedUser("persistpal");
    const meta = {
      kind: "palette",
      mood: "северная сказка",
      colors: [
        { hex: "#2C3E50", name: "Ночь", usage: "фон" },
        { hex: "#7F8C8D", name: "Камень", usage: "вторичный" },
        { hex: "#E74C3C", name: "Костёр", usage: "акцент" },
      ],
      fonts: { heading: "Georgia", body: "Inter", note: "тепло" },
      advice: "Акцент редкий.",
      brief: "сказка",
    };
    await db.artifact.create({
      data: {
        projectId: ws.id,
        type: "file",
        title: "Палитра стиля",
        stage: "style",
        prompt: "сказка",
        meta: JSON.stringify(meta),
      },
    });

    const list = await listArtifacts(
      jsonRequest(
        `http://localhost/api/workspaces/${ws.id}/artifacts`,
        "GET",
        undefined,
        token,
      ),
      { params: Promise.resolve({ id: ws.id }) },
    );
    expect(list.status).toBe(200);
    const body = (await list.json()) as { artifacts: ArtifactDto[] };
    const parsed = body.artifacts.map(paletteFromArtifact).find(Boolean);
    expect(parsed?.mood).toBe("северная сказка");
    expect(parsed?.colors).toHaveLength(3);
    expect(parsed?.colors.map((c) => c.hex)).toEqual([
      "#2C3E50",
      "#7F8C8D",
      "#E74C3C",
    ]);
  });

  test("unconfigured describe is Russian and does not rewrite the card", async () => {
    const { user, token, ws } = await seedUser("nodesc");
    const entity = await db.entity.create({
      data: {
        projectId: ws.id,
        kind: "character",
        name: "Эйнар",
        description: "смотритель маяка",
      },
    });
    let unconfigured = false;
    try {
      await resolveToolRoute(db, user.id, "describe");
    } catch (err) {
      unconfigured =
        err instanceof GatewayError && err.message === UNCONFIGURED_TOOL_MESSAGE;
    }
    if (!unconfigured) {
      expect(UNCONFIGURED_TOOL_MESSAGE).toMatch(/Администратор ещё не настроил/);
      return;
    }

    const res = await describeEntity(
      jsonRequest(
        "http://localhost/api/ai/describe",
        "POST",
        { entityId: entity.id },
        token,
      ),
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as {
      error: string;
      description?: unknown;
      entityId?: unknown;
    };
    expect(json.error).toBe(UNCONFIGURED_TOOL_MESSAGE);
    expect(json.description).toBeUndefined();
    const live = await db.entity.findUnique({ where: { id: entity.id } });
    expect(live?.description).toBe("смотритель маяка");
  });

  test("palette and describe are 404 for another user's ids", async () => {
    const owner = await seedUser("palowner");
    const attacker = await seedUser("palatk");
    const entity = await db.entity.create({
      data: {
        projectId: owner.ws.id,
        kind: "location",
        name: "Маяк",
        description: "секрет",
      },
    });

    const pal = await generatePalette(
      jsonRequest(
        "http://localhost/api/ai/palette",
        "POST",
        { projectId: owner.ws.id },
        attacker.token,
      ),
    );
    expect(pal.status).toBe(404);
    const palJson = (await pal.json()) as { error: string; palette?: unknown };
    expect(palJson.palette).toBeUndefined();
    expect(palJson.error).toMatch(/не найден/i);

    const desc = await describeEntity(
      jsonRequest(
        "http://localhost/api/ai/describe",
        "POST",
        { entityId: entity.id },
        attacker.token,
      ),
    );
    expect(desc.status).toBe(404);
    const descJson = (await desc.json()) as {
      error: string;
      description?: unknown;
    };
    expect(descJson.description).toBeUndefined();
    expect(JSON.stringify(descJson)).not.toContain("секрет");
  });
});
