import { afterAll, describe, expect, test } from "bun:test";

import { hashPassword, signSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { GatewayError } from "@/lib/ai/errors";
import { resolveToolRoute } from "@/lib/ai/resolve";
import { UNCONFIGURED_TOOL_MESSAGE } from "@/lib/ai/tools";

import { POST as analyze } from "../ai/analyze/route";
import { GET as listFindings } from "./route";
import { PATCH as patchFinding } from "./[id]/route";

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

describe.skipIf(SKIP_PG)("findings: unconfigured, persist, IDOR", () => {
  afterAll(async () => {
    for (const id of ids.reverse()) {
      await db.user.delete({ where: { id } }).catch(() => {});
    }
  });

  async function seedUser(label: string) {
    const user = await db.user.create({
      data: {
        name: label,
        email: `finding-${label}-${stamp}@example.test`,
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
      data: { userId: user.id, name: `Книга ${label}`, type: "book" },
    });
    const document = await db.document.create({
      data: { projectId: ws.id, title: "Рукопись" },
    });
    await db.documentSection.create({
      data: {
        documentId: document.id,
        title: "гл. 1",
        content: "У Марины были зелёные глаза. В гавани горел маяк.",
      },
    });
    return { user, token, ws, document };
  }

  test("unconfigured document_check is Russian and creates no findings", async () => {
    const { user, token, ws, document } = await seedUser("nocheck");
    const prior = await db.finding.create({
      data: {
        projectId: ws.id,
        documentId: document.id,
        type: "omission",
        title: "уже была",
        quote: "маяк",
        status: "open",
      },
    });

    let unconfigured = false;
    try {
      await resolveToolRoute(db, user.id, "document_check");
    } catch (err) {
      unconfigured =
        err instanceof GatewayError && err.message === UNCONFIGURED_TOOL_MESSAGE;
    }
    if (!unconfigured) {
      expect(UNCONFIGURED_TOOL_MESSAGE).toMatch(/Администратор ещё не настроил/);
      return;
    }

    const before = await db.finding.count({ where: { projectId: ws.id } });
    const res = await analyze(
      jsonRequest(
        "http://localhost/api/ai/analyze",
        "POST",
        { documentId: document.id, scope: "manuscript" },
        token,
      ),
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string; findings?: unknown };
    expect(json.error).toBe(UNCONFIGURED_TOOL_MESSAGE);
    expect(json.findings).toBeUndefined();
    expect(json.error).toMatch(/[А-Яа-яЁё]/);

    expect(await db.finding.count({ where: { projectId: ws.id } })).toBe(before);
    const still = await db.finding.findUnique({ where: { id: prior.id } });
    expect(still?.title).toBe("уже была");
    expect(still?.status).toBe("open");
  });

  test("Finding rows persist across GET; resolve/dismiss survive reload", async () => {
    const { token, ws, document } = await seedUser("persist");
    const created = await db.finding.create({
      data: {
        projectId: ws.id,
        documentId: document.id,
        scope: "manuscript",
        type: "contradiction",
        severity: "critical",
        title: "Глаза расходятся",
        quote: "У Марины были зелёные глаза.",
        advice: "Сверить канон",
        sourceRef: "гл. 1",
        status: "open",
      },
    });

    const listed = await listFindings(
      jsonRequest(
        `http://localhost/api/findings?projectId=${ws.id}`,
        "GET",
        undefined,
        token,
      ),
    );
    expect(listed.status).toBe(200);
    const listedJson = (await listed.json()) as {
      findings: Array<{
        id: string;
        title: string;
        quote: string | null;
        status: string;
        documentId: string | null;
      }>;
    };
    const row = listedJson.findings.find((f) => f.id === created.id);
    expect(row?.title).toBe("Глаза расходятся");
    expect(row?.quote).toBe("У Марины были зелёные глаза.");
    expect(row?.status).toBe("open");
    expect(row?.documentId).toBe(document.id);

    const fixed = await patchFinding(
      jsonRequest(
        `http://localhost/api/findings/${created.id}`,
        "PATCH",
        { status: "fixed" },
        token,
      ),
      { params: Promise.resolve({ id: created.id }) },
    );
    expect(fixed.status).toBe(200);
    const fixedJson = (await fixed.json()) as { finding: { status: string } };
    expect(fixedJson.finding.status).toBe("fixed");

    const dismissed = await patchFinding(
      jsonRequest(
        `http://localhost/api/findings/${created.id}`,
        "PATCH",
        { status: "dismissed" },
        token,
      ),
      { params: Promise.resolve({ id: created.id }) },
    );
    expect(dismissed.status).toBe(200);

    const reload = await listFindings(
      jsonRequest(
        `http://localhost/api/findings?projectId=${ws.id}`,
        "GET",
        undefined,
        token,
      ),
    );
    expect(reload.status).toBe(200);
    const reloadJson = (await reload.json()) as {
      findings: Array<{ id: string; status: string; quote: string | null }>;
    };
    const again = reloadJson.findings.find((f) => f.id === created.id);
    expect(again?.status).toBe("dismissed");
    expect(again?.quote).toBe("У Марины были зелёные глаза.");

    const live = await db.finding.findUnique({ where: { id: created.id } });
    expect(live?.status).toBe("dismissed");
    expect(live?.title).toBe("Глаза расходятся");
  });

  test("other user cannot list, patch, or analyze another user's findings", async () => {
    const owner = await seedUser("owner");
    const attacker = await seedUser("atk");
    const finding = await db.finding.create({
      data: {
        projectId: owner.ws.id,
        documentId: owner.document.id,
        type: "inconsistency",
        title: "секретная находка",
        quote: "маяк",
        status: "open",
      },
    });

    const stolenList = await listFindings(
      jsonRequest(
        `http://localhost/api/findings?projectId=${owner.ws.id}`,
        "GET",
        undefined,
        attacker.token,
      ),
    );
    expect(stolenList.status).toBe(404);
    const stolenListJson = (await stolenList.json()) as {
      error: string;
      findings?: unknown;
    };
    expect(stolenListJson.findings).toBeUndefined();
    expect(stolenListJson.error).toMatch(/не найден/i);

    const ownList = await listFindings(
      jsonRequest(
        `http://localhost/api/findings?projectId=${attacker.ws.id}`,
        "GET",
        undefined,
        attacker.token,
      ),
    );
    expect(ownList.status).toBe(200);
    const ownJson = (await ownList.json()) as { findings: Array<{ id: string }> };
    expect(ownJson.findings.some((f) => f.id === finding.id)).toBe(false);

    const stolenPatch = await patchFinding(
      jsonRequest(
        `http://localhost/api/findings/${finding.id}`,
        "PATCH",
        { status: "fixed" },
        attacker.token,
      ),
      { params: Promise.resolve({ id: finding.id }) },
    );
    expect(stolenPatch.status).toBe(404);
    const stolenPatchJson = (await stolenPatch.json()) as {
      finding?: unknown;
      error: string;
    };
    expect(stolenPatchJson.finding).toBeUndefined();

    const stolenAnalyze = await analyze(
      jsonRequest(
        "http://localhost/api/ai/analyze",
        "POST",
        { documentId: owner.document.id },
        attacker.token,
      ),
    );
    expect(stolenAnalyze.status).toBe(404);
    const stolenAnalyzeJson = (await stolenAnalyze.json()) as {
      findings?: unknown;
      error: string;
    };
    expect(stolenAnalyzeJson.findings).toBeUndefined();

    const still = await db.finding.findUnique({ where: { id: finding.id } });
    expect(still?.status).toBe("open");
    expect(still?.title).toBe("секретная находка");
  });
});
