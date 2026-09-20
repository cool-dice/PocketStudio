import { afterAll, describe, expect, test } from "bun:test";

import { hashPassword, signSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseEntityRefs } from "@/lib/entity-meta";
import { indexEntityById, flushRagQueue } from "@/lib/rag/hooks";
import { retrieve } from "@/lib/rag/retrieve";
import { ragScopeFromThread } from "@/lib/rag/scope";

import {
  GET as getEntity,
  PATCH as patchEntity,
} from "./[id]/route";
import {
  GET as getMentions,
  POST as postMention,
} from "../sections/[id]/mentions/route";
import { DELETE as deleteMention } from "../sections/[id]/mentions/[entityId]/route";

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

describe.skipIf(SKIP_PG)("entity mentions: persist, IDOR, RAG", () => {
  afterAll(async () => {
    for (const id of ids.reverse()) {
      await db.user.delete({ where: { id } }).catch(() => {});
    }
  });

  async function seedUser(label: string) {
    const user = await db.user.create({
      data: {
        name: label,
        email: `mention-${label}-${stamp}@example.test`,
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
    const section = await db.documentSection.create({
      data: {
        documentId: document.id,
        title: "Шторм у маяка",
        content: "Марина стоит у огня.",
      },
    });
    const entity = await db.entity.create({
      data: {
        projectId: ws.id,
        kind: "character",
        name: "Марина",
        description: "смотрительница",
        refs: JSON.stringify({ kind: "chapter", items: ["1"] }),
      },
    });
    return { user, token, ws, section, entity };
  }

  test("owner PATCH/POST mention persist; other user 404; foreign section 400", async () => {
    const owner = await seedUser("owner");
    const attacker = await seedUser("atk");
    const marker = `mention-rag-${stamp}-harbor`;
    const named = await db.documentSection.update({
      where: { id: owner.section.id },
      data: { title: marker },
    });
    const entParams = { params: Promise.resolve({ id: owner.entity.id }) };
    const secParams = { params: Promise.resolve({ id: owner.section.id }) };

    const stolenPatch = await patchEntity(
      jsonRequest(
        `http://localhost/api/entities/${owner.entity.id}`,
        "PATCH",
        { refs: { items: [owner.section.id] } },
        attacker.token,
      ),
      entParams,
    );
    expect(stolenPatch.status).toBe(404);
    const stolenPatchJson = (await stolenPatch.json()) as { entity?: unknown };
    expect(stolenPatchJson.entity).toBeUndefined();
    const afterSteal = await db.entity.findUnique({ where: { id: owner.entity.id } });
    expect(parseEntityRefs(afterSteal?.refs).items).toEqual(["1"]);

    const stolenPost = await postMention(
      jsonRequest(
        `http://localhost/api/sections/${owner.section.id}/mentions`,
        "POST",
        { entityId: owner.entity.id },
        attacker.token,
      ),
      secParams,
    );
    expect(stolenPost.status).toBe(404);
    const stolenPostJson = (await stolenPost.json()) as { entity?: unknown };
    expect(stolenPostJson.entity).toBeUndefined();

    const stolenGet = await getMentions(
      jsonRequest(
        `http://localhost/api/sections/${owner.section.id}/mentions`,
        "GET",
        undefined,
        attacker.token,
      ),
      secParams,
    );
    expect(stolenGet.status).toBe(404);

    const stolenDel = await deleteMention(
      jsonRequest(
        `http://localhost/api/sections/${owner.section.id}/mentions/${owner.entity.id}`,
        "DELETE",
        undefined,
        attacker.token,
      ),
      { params: Promise.resolve({ id: owner.section.id, entityId: owner.entity.id }) },
    );
    expect(stolenDel.status).toBe(404);

    const crossPost = await postMention(
      jsonRequest(
        `http://localhost/api/sections/${attacker.section.id}/mentions`,
        "POST",
        { entityId: owner.entity.id },
        attacker.token,
      ),
      { params: Promise.resolve({ id: attacker.section.id }) },
    );
    expect(crossPost.status).toBe(404);

    const foreignSection = await patchEntity(
      jsonRequest(
        `http://localhost/api/entities/${owner.entity.id}`,
        "PATCH",
        { refs: { items: [attacker.section.id] } },
        owner.token,
      ),
      entParams,
    );
    expect(foreignSection.status).toBe(400);
    const stillCaption = await db.entity.findUnique({ where: { id: owner.entity.id } });
    expect(parseEntityRefs(stillCaption?.refs).items).toEqual(["1"]);

    const beforeLink = await getMentions(
      jsonRequest(
        `http://localhost/api/sections/${owner.section.id}/mentions`,
        "GET",
        undefined,
        owner.token,
      ),
      secParams,
    );
    expect(beforeLink.status).toBe(200);
    const beforeJson = (await beforeLink.json()) as {
      linked: { id: string }[];
      foundInText: { id: string; name: string }[];
    };
    expect(beforeJson.linked.some((row) => row.id === owner.entity.id)).toBe(false);
    expect(beforeJson.foundInText.some((row) => row.id === owner.entity.id)).toBe(
      true,
    );

    const patched = await patchEntity(
      jsonRequest(
        `http://localhost/api/entities/${owner.entity.id}`,
        "PATCH",
        { refs: { items: [named.id, "1"] } },
        owner.token,
      ),
      entParams,
    );
    expect(patched.status).toBe(200);
    const patchedJson = (await patched.json()) as {
      entity: {
        refs: { items: string[] };
        mentions: { id: string; title: string; source: string }[];
      };
    };
    expect(patchedJson.entity.refs.items).toEqual([named.id, "1"]);
    const linked = patchedJson.entity.mentions.find((m) => m.id === named.id);
    expect(linked?.source).toBe("linked");
    expect(linked?.title).toBe(marker);
    const caption = patchedJson.entity.mentions.find((m) => m.id === "1");
    expect(caption?.source).toBe("label");

    const live = await db.entity.findUnique({ where: { id: owner.entity.id } });
    expect(parseEntityRefs(live?.refs).items).toEqual([named.id, "1"]);

    const listed = await getMentions(
      jsonRequest(
        `http://localhost/api/sections/${owner.section.id}/mentions`,
        "GET",
        undefined,
        owner.token,
      ),
      secParams,
    );
    expect(listed.status).toBe(200);
    const listedJson = (await listed.json()) as {
      linked: { id: string; name: string }[];
      foundInText: { id: string }[];
    };
    expect(listedJson.linked.some((row) => row.id === owner.entity.id)).toBe(true);
    expect(listedJson.foundInText.some((row) => row.id === owner.entity.id)).toBe(
      false,
    );

    await indexEntityById(db, owner.entity.id);
    await flushRagQueue();
    const hits = await retrieve(db, {
      scope: ragScopeFromThread(owner.user.id, owner.ws.id),
      query: marker,
      limit: 8,
    });
    expect(hits.hits.some((h) => h.sourceId === owner.entity.id)).toBe(true);
    expect(hits.hits.some((h) => h.excerpt.includes(marker))).toBe(true);

    const other = await db.entity.create({
      data: {
        projectId: owner.ws.id,
        kind: "location",
        name: "Маяк",
        description: "скала",
      },
    });
    const posted = await postMention(
      jsonRequest(
        `http://localhost/api/sections/${owner.section.id}/mentions`,
        "POST",
        { entityId: other.id },
        owner.token,
      ),
      secParams,
    );
    expect(posted.status).toBe(200);
    const postedJson = (await posted.json()) as {
      entity: { id: string; refs: { items: string[] } };
    };
    expect(postedJson.entity.refs.items).toContain(owner.section.id);

    const got = await getEntity(
      jsonRequest(
        `http://localhost/api/entities/${other.id}`,
        "GET",
        undefined,
        owner.token,
      ),
      { params: Promise.resolve({ id: other.id }) },
    );
    expect(got.status).toBe(200);
    const gotJson = (await got.json()) as {
      entity: { mentions: { id: string; source: string }[] };
    };
    expect(
      gotJson.entity.mentions.some(
        (m) => m.id === owner.section.id && m.source === "linked",
      ),
    ).toBe(true);

    const cleared = await deleteMention(
      jsonRequest(
        `http://localhost/api/sections/${owner.section.id}/mentions/${other.id}`,
        "DELETE",
        undefined,
        owner.token,
      ),
      { params: Promise.resolve({ id: owner.section.id, entityId: other.id }) },
    );
    expect(cleared.status).toBe(200);
    const afterDel = await db.entity.findUnique({ where: { id: other.id } });
    expect(parseEntityRefs(afterDel?.refs).items).not.toContain(owner.section.id);
  });
});
