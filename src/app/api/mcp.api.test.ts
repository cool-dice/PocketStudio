import { afterAll, describe, expect, test } from "bun:test";

import { hashPassword, signSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { enabledMcpAdapters, whichCommand } from "@/lib/mcp-runtime";

import { GET as listMcp, POST as createMcp } from "./mcp/route";
import { PATCH as patchMcp } from "./mcp/[id]/route";

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

describe.skipIf(SKIP_PG)("MCP registry API", () => {
  afterAll(async () => {
    for (const id of ids.reverse()) {
      await db.user.delete({ where: { id } }).catch(() => {});
    }
  });

  test("adding a server persists; disable gates tools; missing binary is not connected", async () => {
    const user = await db.user.create({
      data: {
        name: "MCP",
        email: `mcp-${stamp}@example.test`,
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

    const created = await createMcp(
      jsonRequest(
        "http://localhost/api/mcp",
        "POST",
        {
          name: `own-${stamp}`,
          transport: "stdio",
          config: { command: "pocketstudio-missing-mcp-bin", args: ["--stdio"] },
        },
        token,
      ),
    );
    expect(created.status).toBe(201);
    const createdJson = (await created.json()) as {
      server: { id: string; name: string; enabled: boolean; runtimeStatus: string };
    };
    expect(createdJson.server.enabled).toBe(true);
    expect(createdJson.server.runtimeStatus).toBe("cli_missing");

    const listed = await listMcp(
      jsonRequest("http://localhost/api/mcp", "GET", undefined, token),
    );
    expect(listed.status).toBe(200);
    const listedJson = (await listed.json()) as {
      servers: {
        id: string;
        name: string;
        enabled: boolean;
        adapter: string | null;
        external: boolean;
        runtimeStatus?: string;
        catalogKey: string | null;
      }[];
    };
    const own = listedJson.servers.find((s) => s.id === createdJson.server.id);
    expect(own).toBeTruthy();
    expect(own?.runtimeStatus).toBe("cli_missing");

    const playwright = listedJson.servers.find((s) => s.catalogKey === "playwright");
    expect(playwright).toBeTruthy();
    if (playwright?.enabled && !(await whichCommand("agent-browser"))) {
      expect(playwright.runtimeStatus).toBe("cli_missing");
    }

    const fetchRow = listedJson.servers.find((s) => s.catalogKey === "fetch");
    expect(fetchRow?.enabled).toBe(true);
    const fsRow = listedJson.servers.find((s) => s.catalogKey === "filesystem");
    expect(fsRow).toBeTruthy();

    const disabled = await patchMcp(
      jsonRequest(
        `http://localhost/api/mcp/${fsRow!.id}`,
        "PATCH",
        { enabled: false },
        token,
      ),
      { params: Promise.resolve({ id: fsRow!.id }) },
    );
    expect(disabled.status).toBe(200);
    const disabledJson = (await disabled.json()) as {
      server: { enabled: boolean; runtimeStatus: string };
    };
    expect(disabledJson.server.enabled).toBe(false);
    expect(disabledJson.server.runtimeStatus).toBe("off");

    const again = await listMcp(
      jsonRequest("http://localhost/api/mcp", "GET", undefined, token),
    );
    const againJson = (await again.json()) as {
      servers: { adapter: string | null; enabled: boolean; external: boolean }[];
    };
    const adapters = enabledMcpAdapters(againJson.servers);
    expect(adapters.has("filesystem")).toBe(false);
    expect(adapters.has("fetch")).toBe(true);
  });
});
