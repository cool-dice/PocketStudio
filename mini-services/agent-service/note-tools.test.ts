import { afterAll, describe, expect, test } from "bun:test";

import { hashPassword } from "../../src/lib/auth";
import { db } from "../../src/lib/db";
import { getTool } from "./tools";

const SKIP_PG = !(process.env.DATABASE_URL ?? "").startsWith("postgres");
const stamp = Date.now().toString(36);
const ids: string[] = [];

function ctx(projectId: string | null, threadId = `thread-notes-${stamp}`) {
  return { threadId, mode: "ask", projectId };
}

describe.skipIf(SKIP_PG)("create_note / search_notes workspace isolation", () => {
  afterAll(async () => {
    for (const id of ids.reverse()) {
      await db.user.delete({ where: { id } }).catch(() => {});
    }
  });

  test("name resolution, no leak across studios, inbox in global chat", async () => {
    const create = getTool("create_note");
    const search = getTool("search_notes");
    const list = getTool("list_notes");
    const open = getTool("open_note");
    expect(create && search && list && open).toBeTruthy();

    const owner = await db.user.create({
      data: {
        name: "NoteScopeOwner",
        email: `note-scope-${stamp}@example.test`,
        passwordHash: await hashPassword("password-ok"),
        role: "client",
      },
    });
    ids.push(owner.id);
    const stranger = await db.user.create({
      data: {
        name: "NoteScopeStranger",
        email: `note-scope-x-${stamp}@example.test`,
        passwordHash: await hashPassword("password-ok"),
        role: "client",
      },
    });
    ids.push(stranger.id);

    const moon = await db.project.create({
      data: {
        userId: owner.id,
        name: "Лунная соната",
        type: "music",
        origin: "workspace",
      },
    });
    const book = await db.project.create({
      data: {
        userId: owner.id,
        name: "Тишина",
        type: "book",
        origin: "workspace",
      },
    });
    const thread = await db.thread.create({
      data: { userId: owner.id, projectId: moon.id, title: "Луна чат" },
    });

    const byName = await create!.execute(
      { text: `Куплет маяк ${stamp}`, workspaceName: "Лунная" },
      owner.id,
      ctx(null),
    );
    expect(byName.error).toBeUndefined();
    expect(byName.workspaceId).toBe(moon.id);
    const linked = await db.noteLink.findFirst({
      where: { noteId: byName.note.id, projectId: moon.id },
    });
    expect(linked).toBeTruthy();

    const inbox = await create!.execute(
      { text: `Входящая мысль ${stamp}` },
      owner.id,
      ctx(null),
    );
    expect(inbox.error).toBeUndefined();
    expect(inbox.workspaceId).toBeNull();
    const inboxLinks = await db.noteLink.count({
      where: { noteId: inbox.note.id },
    });
    expect(inboxLinks).toBe(0);

    const bookNote = await create!.execute(
      { text: `Черновик книги ${stamp}` },
      owner.id,
      ctx(book.id, "thread-book"),
    );
    expect(bookNote.workspaceId).toBe(book.id);

    const hijack = await create!.execute(
      {
        text: `Остаётся в луне ${stamp}`,
        workspaceName: "Тишина",
        workspaceId: book.id,
      },
      owner.id,
      ctx(moon.id, thread.id),
    );
    expect(hijack.error).toBeUndefined();
    expect(hijack.workspaceId).toBe(moon.id);
    const hijackLinks = await db.noteLink.findMany({
      where: { noteId: hijack.note.id },
    });
    expect(hijackLinks.map((l) => l.projectId)).toEqual([moon.id]);

    const moonSearch = await search!.execute(
      { query: stamp },
      owner.id,
      ctx(moon.id, thread.id),
    );
    const moonPreviews = moonSearch.notes.map((n: { preview: string }) => n.preview);
    expect(moonPreviews.some((p: string) => p.includes("Куплет маяк"))).toBe(true);
    expect(moonPreviews.some((p: string) => p.includes("Остаётся в луне"))).toBe(
      true,
    );
    expect(moonPreviews.some((p: string) => p.includes("Черновик книги"))).toBe(
      false,
    );
    expect(moonPreviews.some((p: string) => p.includes("Входящая мысль"))).toBe(
      false,
    );

    const listed = await list!.execute({ limit: 20 }, owner.id, ctx(moon.id, thread.id));
    const listedIds = listed.notes.map((n: { id: string }) => n.id);
    expect(listedIds).toContain(byName.note.id);
    expect(listedIds).not.toContain(bookNote.note.id);
    expect(listedIds).not.toContain(inbox.note.id);

    const openBookFromMoon = await open!.execute(
      { noteId: bookNote.note.id },
      owner.id,
      ctx(moon.id, thread.id),
    );
    expect(openBookFromMoon.error).toBe("Заметка не найдена");
    expect(openBookFromMoon.rawText).toBeUndefined();

    const openInboxFromMoon = await open!.execute(
      { noteId: inbox.note.id },
      owner.id,
      ctx(moon.id, thread.id),
    );
    expect(openInboxFromMoon.error).toBe("Заметка не найдена");

    const strangerOpen = await open!.execute(
      { noteId: byName.note.id },
      stranger.id,
      ctx(null),
    );
    expect(strangerOpen.error).toBe("Заметка не найдена");
  });
});
