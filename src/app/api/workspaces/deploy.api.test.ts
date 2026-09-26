import { afterAll, describe, expect, test } from "bun:test";
import JSZip from "jszip";

import { hashPassword, signSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  DOCKERFILE_NOT_PUBLISHED,
  EMPTY_APP_BUILD_ERROR,
} from "@/lib/docker-copy";
import {
  projectRoot,
  removeProjectDir,
  writeWorkspaceFile,
} from "@/lib/workspace";

import { GET as exportWorkspace } from "./[id]/export/route";
import { POST as generateDockerfile } from "./[id]/dockerfile/route";
import { POST as dockerBuild } from "./[id]/docker-build/route";
import { GET as exportProject } from "../projects/[id]/export/route";

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

describe.skipIf(SKIP_PG)("deploy zip / Dockerfile / docker-build honesty", () => {
  afterAll(async () => {
    for (const id of projectIds) {
      await removeProjectDir(id).catch(() => {});
    }
    for (const id of ids.reverse()) {
      await db.user.delete({ where: { id } }).catch(() => {});
    }
  });

  test("zip, dockerfile, and docker-build stay on the owner; empty is not built", async () => {
    const owner = await db.user.create({
      data: {
        name: "DeployOwner",
        email: `dep-owner-${stamp}@example.test`,
        passwordHash: await hashPassword("password-ok"),
        role: "client",
      },
    });
    ids.push(owner.id);
    const attacker = await db.user.create({
      data: {
        name: "DeployAtk",
        email: `dep-atk-${stamp}@example.test`,
        passwordHash: await hashPassword("password-ok"),
        role: "client",
      },
    });
    ids.push(attacker.id);
    const ownerToken = await signSession({
      sub: owner.id,
      email: owner.email,
      name: owner.name,
      role: owner.role,
    });
    const attackerToken = await signSession({
      sub: attacker.id,
      email: attacker.email,
      name: attacker.name,
      role: attacker.role,
    });

    const book = await db.project.create({
      data: {
        userId: owner.id,
        name: "Канон деплоя",
        type: "book",
        origin: "workspace",
      },
    });
    const emptyApp = await db.project.create({
      data: {
        userId: owner.id,
        name: "Пустое приложение",
        type: "app",
        origin: "workspace",
      },
    });
    const codeApp = await db.project.create({
      data: {
        userId: owner.id,
        name: "Код приложения",
        type: "app",
        origin: "workspace",
      },
    });
    const imported = await db.project.create({
      data: {
        userId: owner.id,
        name: "Импорт шаблона",
        type: "app",
        origin: "template",
      },
    });
    projectIds.push(book.id, emptyApp.id, codeApp.id, imported.id);

    await db.document.create({
      data: {
        projectId: book.id,
        title: `глава-${stamp}`,
        sections: {
          create: [{ title: "1", content: `секрет-${stamp}`, order: 0 }],
        },
      },
    });

    const emptyRoot = projectRoot(emptyApp.id);
    await writeWorkspaceFile(emptyRoot, "README.md", "# empty\n");
    await db.project.update({
      where: { id: emptyApp.id },
      data: { rootPath: emptyRoot },
    });

    const codeRoot = projectRoot(codeApp.id);
    await writeWorkspaceFile(
      codeRoot,
      "src/main.ts",
      `export const mark = "deploy-${stamp}";\n`,
    );
    await db.project.update({
      where: { id: codeApp.id },
      data: { rootPath: codeRoot },
    });

    const stolenWsZip = await exportWorkspace(
      jsonRequest(
        `http://localhost/api/workspaces/${book.id}/export`,
        "GET",
        undefined,
        attackerToken,
      ),
      { params: Promise.resolve({ id: book.id }) },
    );
    expect(stolenWsZip.status).toBe(404);
    expect(stolenWsZip.headers.get("content-type")).not.toMatch(/zip/);
    const stolenWsJson = (await stolenWsZip.json()) as {
      error: string;
      status?: string;
    };
    expect(stolenWsJson.error).toMatch(/не найден/i);

    const ownerWsZip = await exportWorkspace(
      jsonRequest(
        `http://localhost/api/workspaces/${book.id}/export`,
        "GET",
        undefined,
        ownerToken,
      ),
      { params: Promise.resolve({ id: book.id }) },
    );
    expect(ownerWsZip.status).toBe(200);
    expect(ownerWsZip.headers.get("content-type")).toMatch(/zip/);
    const packed = await JSZip.loadAsync(await ownerWsZip.arrayBuffer());
    const readme = await packed.file("README.md")?.async("string");
    expect(readme).toContain("Канон деплоя");
    const docNames = Object.keys(packed.files).filter(
      (name) => name.startsWith("documents/") && name.endsWith(".md"),
    );
    expect(docNames.length).toBeGreaterThan(0);
    const docText = await packed.file(docNames[0]!)?.async("string");
    expect(typeof docText).toBe("string");
    expect(docText).toContain(`секрет-${stamp}`);

    const stolenCodeZip = await exportProject(
      jsonRequest(
        `http://localhost/api/projects/${codeApp.id}/export`,
        "GET",
        undefined,
        attackerToken,
      ),
      { params: Promise.resolve({ id: codeApp.id }) },
    );
    expect(stolenCodeZip.status).toBe(404);

    const stolenDf = await generateDockerfile(
      jsonRequest(
        `http://localhost/api/workspaces/${codeApp.id}/dockerfile`,
        "POST",
        { overwrite: true },
        attackerToken,
      ),
      { params: Promise.resolve({ id: codeApp.id }) },
    );
    expect(stolenDf.status).toBe(404);
    const stolenDfJson = (await stolenDf.json()) as {
      dockerfile?: string;
      published?: boolean;
    };
    expect(stolenDfJson.dockerfile).toBeUndefined();
    expect(stolenDfJson.published).toBeUndefined();

    const stolenBuild = await dockerBuild(
      jsonRequest(
        `http://localhost/api/workspaces/${codeApp.id}/docker-build`,
        "POST",
        undefined,
        attackerToken,
      ),
      { params: Promise.resolve({ id: codeApp.id }) },
    );
    expect(stolenBuild.status).toBe(404);
    const stolenBuildJson = (await stolenBuild.json()) as {
      status?: string;
      imageTag?: string | null;
    };
    expect(stolenBuildJson.status).not.toBe("built");
    expect(stolenBuildJson.imageTag ?? null).toBeNull();

    const emptyDf = await generateDockerfile(
      jsonRequest(
        `http://localhost/api/workspaces/${emptyApp.id}/dockerfile`,
        "POST",
        { overwrite: true },
        ownerToken,
      ),
      { params: Promise.resolve({ id: emptyApp.id }) },
    );
    expect(emptyDf.status).toBe(200);
    const emptyDfJson = (await emptyDf.json()) as {
      published: boolean;
      imageTag: string | null;
      status: string;
      empty: boolean;
      hint: string;
    };
    expect(emptyDfJson.published).toBe(false);
    expect(emptyDfJson.imageTag).toBeNull();
    expect(emptyDfJson.status).toBe("ready_zip");
    expect(emptyDfJson.status).not.toBe("built");
    expect(emptyDfJson.empty).toBe(true);
    expect(emptyDfJson.hint).toBe(DOCKERFILE_NOT_PUBLISHED);
    expect(JSON.stringify(emptyDfJson)).not.toMatch(/"published":true/);

    const emptyBuild = await dockerBuild(
      jsonRequest(
        `http://localhost/api/workspaces/${emptyApp.id}/docker-build`,
        "POST",
        undefined,
        ownerToken,
      ),
      { params: Promise.resolve({ id: emptyApp.id }) },
    );
    expect(emptyBuild.status).toBe(400);
    const emptyBuildJson = (await emptyBuild.json()) as {
      status?: string;
      imageTag?: string | null;
      published?: boolean;
      error?: string;
    };
    expect(emptyBuildJson.status).toBe("empty");
    expect(emptyBuildJson.status).not.toBe("built");
    expect(emptyBuildJson.published).toBe(false);
    expect(emptyBuildJson.imageTag).toBeNull();
    expect(emptyBuildJson.error).toBe(EMPTY_APP_BUILD_ERROR);

    const df = await generateDockerfile(
      jsonRequest(
        `http://localhost/api/workspaces/${codeApp.id}/dockerfile`,
        "POST",
        { overwrite: true },
        ownerToken,
      ),
      { params: Promise.resolve({ id: codeApp.id }) },
    );
    expect(df.status).toBe(200);
    const dfJson = (await df.json()) as {
      published: boolean;
      imageTag: string | null;
      empty: boolean;
      status: string;
    };
    expect(dfJson.published).toBe(false);
    expect(dfJson.imageTag).toBeNull();
    expect(dfJson.empty).toBe(false);
    expect(dfJson.status).not.toBe("built");

    const build = await dockerBuild(
      jsonRequest(
        `http://localhost/api/workspaces/${codeApp.id}/docker-build`,
        "POST",
        undefined,
        ownerToken,
      ),
      { params: Promise.resolve({ id: codeApp.id }) },
    );
    expect(build.status).toBe(200);
    const buildJson = (await build.json()) as {
      status: string;
      log: string;
      imageTag: string | null;
      published: boolean;
    };
    expect(buildJson.published).toBe(false);
    expect(buildJson.log.length).toBeGreaterThan(0);
    if (buildJson.status === "built") {
      expect(buildJson.imageTag).toBeTruthy();
    } else {
      expect(["unavailable", "failed"]).toContain(buildJson.status);
      expect(buildJson.imageTag).toBeNull();
      expect(buildJson.log).toMatch(/docker/i);
    }

    const importedDf = await generateDockerfile(
      jsonRequest(
        `http://localhost/api/workspaces/${imported.id}/dockerfile`,
        "POST",
        { overwrite: true },
        ownerToken,
      ),
      { params: Promise.resolve({ id: imported.id }) },
    );
    expect(importedDf.status).toBe(404);
    const importedDfJson = (await importedDf.json()) as {
      dockerfile?: string;
      published?: boolean;
    };
    expect(importedDfJson.dockerfile).toBeUndefined();
    expect(importedDfJson.published).toBeUndefined();
  });
});
