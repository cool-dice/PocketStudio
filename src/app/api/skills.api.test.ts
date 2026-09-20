import { afterAll, describe, expect, test } from "bun:test";

import { hashPassword, signSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { wrapSkillDocs } from "@/lib/ai/prompts";
import { buildAgentSystemPrompt } from "../../../mini-services/agent-service/prompts";

import { GET as listSkills, POST as createSkill } from "./skills/route";
import { PATCH as patchSkill } from "./skills/[id]/route";
import { POST as importSkill } from "./skills/import/route";
import { GET as listEnabled } from "./skills/enabled/route";

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

describe.skipIf(SKIP_PG)("skills import / toggle / prompt", () => {
  afterAll(async () => {
    for (const id of ids.reverse()) {
      await db.user.delete({ where: { id } }).catch(() => {});
    }
  });

  test("file/URL errors fail; toggle persists; enabled skills reach the prompt", async () => {
    const user = await db.user.create({
      data: {
        name: "Skills",
        email: `skills-${stamp}@example.test`,
        passwordHash: await hashPassword("password-ok"),
        role: "client",
      },
    });
    ids.push(user.id);
    const token = await signSession({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: "client",
    });

    const htmlImport = await importSkill(
      jsonRequest(
        "http://localhost/api/skills/import",
        "POST",
        { skillMd: "<!DOCTYPE html><html><body>404</body></html>" },
        token,
      ),
    );
    expect(htmlImport.status).toBe(400);
    const htmlJson = (await htmlImport.json()) as { error: string; skill?: unknown };
    expect(htmlJson.skill).toBeUndefined();
    expect(htmlJson.error).toMatch(/HTML/i);
    expect(htmlJson.error).not.toMatch(/успеш/i);

    const badUrl = await importSkill(
      jsonRequest(
        "http://localhost/api/skills/import",
        "POST",
        { url: "ftp://example.com/SKILL.md" },
        token,
      ),
    );
    expect(badUrl.status).toBe(400);
    const badUrlJson = (await badUrl.json()) as { error: string; skill?: unknown };
    expect(badUrlJson.skill).toBeUndefined();
    expect(badUrlJson.error).not.toMatch(/успеш/i);

    const created = await createSkill(
      jsonRequest(
        "http://localhost/api/skills",
        "POST",
        {
          name: `Копирайтер-${stamp}`,
          skillMd: "---\nname: Копирайтер\n---\n\n## Когда использовать\nПиши главы книги",
          triggers: ["книга"],
        },
        token,
      ),
    );
    expect(created.status).toBe(201);
    const createdJson = (await created.json()) as {
      skill: { id: string; enabled: boolean; name: string };
    };
    expect(createdJson.skill.enabled).toBe(true);

    const enabled = await listEnabled(
      jsonRequest("http://localhost/api/skills/enabled", "GET", undefined, token),
    );
    expect(enabled.status).toBe(200);
    const enabledJson = (await enabled.json()) as {
      promptBlock: string;
      skills: { id: string; name: string }[];
    };
    expect(enabledJson.promptBlock).toContain(createdJson.skill.name);
    const prompt = buildAgentSystemPrompt({
      mode: "ask",
      skillDocs: [enabledJson.promptBlock],
    });
    expect(prompt).toContain("Включённые скиллы");
    expect(prompt).toContain(createdJson.skill.name);
    expect(wrapSkillDocs([enabledJson.promptBlock])).toContain("не новая личность");

    const patched = await patchSkill(
      jsonRequest(
        `http://localhost/api/skills/${createdJson.skill.id}`,
        "PATCH",
        { enabled: false },
        token,
      ),
      { params: Promise.resolve({ id: createdJson.skill.id }) },
    );
    expect(patched.status).toBe(200);

    const listed = await listSkills(
      jsonRequest("http://localhost/api/skills", "GET", undefined, token),
    );
    const listedJson = (await listed.json()) as {
      skills: { id: string; enabled: boolean }[];
    };
    expect(
      listedJson.skills.find((s) => s.id === createdJson.skill.id)?.enabled,
    ).toBe(false);

    const enabledAfter = await listEnabled(
      jsonRequest("http://localhost/api/skills/enabled", "GET", undefined, token),
    );
    const enabledAfterJson = (await enabledAfter.json()) as {
      promptBlock: string;
      skills: { id: string }[];
    };
    expect(enabledAfterJson.skills.some((s) => s.id === createdJson.skill.id)).toBe(
      false,
    );
    expect(enabledAfterJson.promptBlock).not.toContain(createdJson.skill.name);
  });
});
