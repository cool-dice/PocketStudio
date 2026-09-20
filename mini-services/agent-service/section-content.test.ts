import { afterAll, describe, expect, test } from "bun:test";

import { hashPassword } from "../../src/lib/auth";
import { db } from "../../src/lib/db";
import { MAX_SECTION_CONTENT_CHARS } from "../../src/lib/section-content";
import { getTool } from "./tools";

const SKIP_PG = !(process.env.DATABASE_URL ?? "").startsWith("postgres");
const stamp = Date.now().toString(36);
const ids: string[] = [];

function ctx(projectId: string | null) {
  return { threadId: "thread-section-cap", mode: "act", projectId };
}

describe.skipIf(SKIP_PG)("create_document / append_section content cap", () => {
  afterAll(async () => {
    for (const id of ids.reverse()) {
      await db.user.delete({ where: { id } }).catch(() => {});
    }
  });

  test("50_001 chars are stored when HTTP allows 200k", async () => {
    expect(MAX_SECTION_CONTENT_CHARS).toBe(200_000);

    const create = getTool("create_document");
    const append = getTool("append_section");
    expect(create).toBeDefined();
    expect(append).toBeDefined();

    const owner = await db.user.create({
      data: {
        name: "SectionCapOwner",
        email: `sec-cap-${stamp}@example.test`,
        passwordHash: await hashPassword("password-ok"),
        role: "client",
      },
    });
    ids.push(owner.id);

    const ws = await db.project.create({
      data: { userId: owner.id, name: "Кап главы", type: "book" },
    });

    const body = "я".repeat(50_001);
    expect(body.length).toBe(50_001);
    expect(body.length).toBeLessThanOrEqual(MAX_SECTION_CONTENT_CHARS);

    const created = await create!.execute(
      { title: "Черновик капа", content: body, sectionTitle: "Глава 1" },
      owner.id,
      ctx(ws.id),
    );
    expect(created.error).toBeUndefined();
    expect(created.document?.sectionId).toBeTruthy();

    const first = await db.documentSection.findUnique({
      where: { id: created.document.sectionId },
    });
    expect(first?.content.length).toBe(50_001);
    expect(first?.content).toBe(body);

    const appended = await append!.execute(
      {
        documentId: created.document.id,
        title: "Глава 2",
        content: body,
      },
      owner.id,
      ctx(ws.id),
    );
    expect(appended.error).toBeUndefined();
    expect(appended.section?.id).toBeTruthy();

    const second = await db.documentSection.findUnique({
      where: { id: appended.section.id },
    });
    expect(second?.content.length).toBe(50_001);
    expect(second?.content).toBe(body);
  });
});
