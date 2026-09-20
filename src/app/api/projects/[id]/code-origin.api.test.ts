import { afterAll, describe, expect, test } from "bun:test";

import { hashPassword, signSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { projectRoot, removeProjectDir, writeWorkspaceFile } from "@/lib/workspace";

import { GET as getProject, DELETE as deleteProject } from "./route";
import { POST as generateDockerfile } from "./dockerfile/route";
import { GET as exportProject } from "./export/route";

const SKIP_PG = !(process.env.DATABASE_URL ?? "").startsWith("postgres");
const stamp = Date.now().toString(36);
const ids: string[] = [];
const projectIds: string[] = [];

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

describe.skipIf(SKIP_PG)("GET /api/projects/[id] is code-origin only", () => {
  afterAll(async () => {
    for (const id of projectIds) {
      await removeProjectDir(id).catch(() => {});
    }
    for (const id of ids.reverse()) {
      await db.user.delete({ where: { id } }).catch(() => {});
    }
  });

  test("studio origin is 404 on project routes; code origin is not a host", async () => {
    const user = await db.user.create({
      data: {
        name: "CodeOnly",
        email: `code-only-${stamp}@example.test`,
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

    const studio = await db.project.create({
      data: {
        userId: user.id,
        name: "Луна",
        type: "music",
        origin: "workspace",
      },
    });
    const code = await db.project.create({
      data: {
        userId: user.id,
        name: "Next App",
        type: "app",
        origin: "template",
      },
    });
    projectIds.push(code.id);
    const root = projectRoot(code.id);
    await writeWorkspaceFile(root, "src/index.ts", "export {}\n");
    await db.project.update({
      where: { id: code.id },
      data: { rootPath: root },
    });

    const studioGet = await getProject(
      jsonRequest(
        `http://localhost/api/projects/${studio.id}`,
        "GET",
        undefined,
        token,
      ),
      { params: Promise.resolve({ id: studio.id }) },
    );
    expect(studioGet.status).toBe(404);
    const studioJson = (await studioGet.json()) as { project?: unknown };
    expect(studioJson.project).toBeUndefined();

    const studioDel = await deleteProject(
      jsonRequest(
        `http://localhost/api/projects/${studio.id}`,
        "DELETE",
        undefined,
        token,
      ),
      { params: Promise.resolve({ id: studio.id }) },
    );
    expect(studioDel.status).toBe(404);
    const still = await db.project.findFirst({ where: { id: studio.id } });
    expect(still?.id).toBe(studio.id);

    const studioDf = await generateDockerfile(
      jsonRequest(
        `http://localhost/api/projects/${studio.id}/dockerfile`,
        "POST",
        { overwrite: true },
        token,
      ),
      { params: Promise.resolve({ id: studio.id }) },
    );
    expect(studioDf.status).toBe(404);
    const studioDfJson = (await studioDf.json()) as {
      dockerfile?: string;
      published?: boolean;
    };
    expect(studioDfJson.dockerfile).toBeUndefined();
    expect(studioDfJson.published).toBeUndefined();

    const codeGet = await getProject(
      jsonRequest(
        `http://localhost/api/projects/${code.id}`,
        "GET",
        undefined,
        token,
      ),
      { params: Promise.resolve({ id: code.id }) },
    );
    expect(codeGet.status).toBe(200);
    const codeJson = (await codeGet.json()) as {
      project: { origin: string; name: string };
    };
    expect(codeJson.project.origin).toBe("template");

    const df = await generateDockerfile(
      jsonRequest(
        `http://localhost/api/projects/${code.id}/dockerfile`,
        "POST",
        { overwrite: true },
        token,
      ),
      { params: Promise.resolve({ id: code.id }) },
    );
    expect(df.status).toBe(200);
    const dfJson = (await df.json()) as {
      published: boolean;
      imageTag: string | null;
      empty: boolean;
    };
    expect(dfJson.published).toBe(false);
    expect(dfJson.imageTag).toBeNull();
    expect(JSON.stringify(dfJson)).not.toMatch(/https?:\/\//);

    const zip = await exportProject(
      jsonRequest(
        `http://localhost/api/projects/${code.id}/export`,
        "GET",
        undefined,
        token,
      ),
      { params: Promise.resolve({ id: code.id }) },
    );
    expect(zip.status).toBe(200);
    expect(zip.headers.get("content-type")).toMatch(/zip/);
  });
});
