import { afterAll, describe, expect, test } from "bun:test";

import { hashPassword, signSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { emptyRaster, emptyLayout } from "@/lib/design-model";
import { emptyTimeline } from "@/lib/nle-model";
import { defaultDawState } from "@/lib/daw-model";

import { GET as getDesign, PUT as putDesign } from "./workspaces/[id]/design/route";
import { GET as getTimeline, PUT as putTimeline } from "./workspaces/[id]/timeline/route";
import { GET as getDaw, PUT as putDaw } from "./workspaces/[id]/daw/route";
import { POST as compileFilm } from "./workspaces/[id]/compile-film/route";

const SKIP_PG = !(process.env.DATABASE_URL ?? "").startsWith("postgres");
const stamp = Date.now().toString(36);
let seedN = 0;
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
    body:
      body === undefined
        ? undefined
        : typeof body === "string"
          ? body
          : JSON.stringify(body),
  });
}

describe.skipIf(SKIP_PG)("studio persist: design / NLE / DAW", () => {
  afterAll(async () => {
    for (const id of ids.reverse()) {
      await db.user.delete({ where: { id } }).catch(() => {});
    }
  });

  async function seed() {
    const user = await db.user.create({
      data: {
        name: "Persist",
        email: `persist-${stamp}-${seedN++}@example.test`,
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
    const ws = await db.project.create({
      data: { userId: user.id, name: "Студия persist", type: "universal" },
    });
    return { token, wsId: ws.id };
  }

  test("DesignDoc / VideoProject / DawProject survive GET after PUT; junk 400 does not wipe", async () => {
    const { token, wsId } = await seed();
    const params = { params: Promise.resolve({ id: wsId }) };

    const raster = emptyRaster();
    raster.layers[0]!.dataUrl = "data:image/png;base64,roundtrip";
    const designPut = await putDesign(
      jsonRequest(
        `http://localhost/api/workspaces/${wsId}/design`,
        "PUT",
        { mode: "raster", payload: raster },
        token,
      ),
      params,
    );
    expect(designPut.status).toBe(200);

    const layout = emptyLayout();
    layout.frames[0]!.text = "Кадр persist";
    const layoutPut = await putDesign(
      jsonRequest(
        `http://localhost/api/workspaces/${wsId}/design`,
        "PUT",
        { mode: "layout", payload: layout },
        token,
      ),
      params,
    );
    expect(layoutPut.status).toBe(200);

    const tl = emptyTimeline();
    tl.tracks[0]!.clips.push({
      id: "clip-persist",
      artifactId: "art-persist",
      title: "Сцена 1",
      start: 0,
      inPoint: 0,
      outPoint: 4,
      url: "/gen/persist.png",
      type: "image",
      speed: 1,
      lut: "warm",
      transition: "cut",
      kenBurns: true,
    });
    const tlPut = await putTimeline(
      jsonRequest(
        `http://localhost/api/workspaces/${wsId}/timeline`,
        "PUT",
        { timeline: tl, fps: 24 },
        token,
      ),
      params,
    );
    expect(tlPut.status).toBe(200);

    const daw = defaultDawState(2);
    daw.tracks.push({
      id: "lead-persist",
      name: "Лид",
      kind: "lead",
      volume: 0.6,
      pan: 0,
      muted: false,
      waveform: "square",
      octave: 4,
      notes: [{ step: 1, midi: 64 }],
    });
    const dawPut = await putDaw(
      jsonRequest(`http://localhost/api/workspaces/${wsId}/daw`, "PUT", daw, token),
      params,
    );
    expect(dawPut.status).toBe(200);

    const junkBodies: Array<{
      fn: typeof putDesign;
      url: string;
      body: unknown;
    }> = [
      {
        fn: putDesign,
        url: `http://localhost/api/workspaces/${wsId}/design`,
        body: "{",
      },
      {
        fn: putTimeline,
        url: `http://localhost/api/workspaces/${wsId}/timeline`,
        body: { timeline: { tracks: "nope" } },
      },
      {
        fn: putDaw,
        url: `http://localhost/api/workspaces/${wsId}/daw`,
        body: { bpm: 99 },
      },
    ];
    for (const item of junkBodies) {
      const res = await item.fn(
        jsonRequest(item.url, "PUT", item.body, token),
        params,
      );
      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBeTruthy();
    }

    const designGet = await getDesign(
      jsonRequest(
        `http://localhost/api/workspaces/${wsId}/design?mode=raster`,
        "GET",
        undefined,
        token,
      ),
      params,
    );
    expect(designGet.status).toBe(200);
    const designJson = (await designGet.json()) as {
      design: { payload: { kind: string; layers: Array<{ dataUrl: string }> } };
    };
    expect(designJson.design.payload.kind).toBe("raster");
    expect(designJson.design.payload.layers[0]?.dataUrl).toBe(
      "data:image/png;base64,roundtrip",
    );

    const layoutGet = await getDesign(
      jsonRequest(
        `http://localhost/api/workspaces/${wsId}/design?mode=layout`,
        "GET",
        undefined,
        token,
      ),
      params,
    );
    const layoutJson = (await layoutGet.json()) as {
      design: { payload: { frames: Array<{ text: string }> } };
    };
    expect(layoutJson.design.payload.frames[0]?.text).toBe("Кадр persist");

    const tlGet = await getTimeline(
      jsonRequest(
        `http://localhost/api/workspaces/${wsId}/timeline`,
        "GET",
        undefined,
        token,
      ),
      params,
    );
    const tlJson = (await tlGet.json()) as {
      timeline: { tracks: Array<{ clips: Array<{ id: string; lut: string | null }> }> };
    };
    expect(tlJson.timeline.tracks[0]?.clips[0]?.id).toBe("clip-persist");
    expect(tlJson.timeline.tracks[0]?.clips[0]?.lut).toBe("warm");

    const dawGet = await getDaw(
      jsonRequest(`http://localhost/api/workspaces/${wsId}/daw`, "GET", undefined, token),
      params,
    );
    const dawJson = (await dawGet.json()) as {
      project: { tracks: Array<{ id: string; notes?: Array<{ midi: number }> }> };
    };
    const lead = dawJson.project.tracks.find((t) => t.id === "lead-persist");
    expect(lead?.notes?.[0]?.midi).toBe(64);
  });

  test("empty canvas save is OK; empty timeline compile is not success", async () => {
    const { token, wsId } = await seed();
    const params = { params: Promise.resolve({ id: wsId }) };

    const blank = await putDesign(
      jsonRequest(
        `http://localhost/api/workspaces/${wsId}/design`,
        "PUT",
        { mode: "raster", payload: emptyRaster() },
        token,
      ),
      params,
    );
    expect(blank.status).toBe(200);

    const before = await db.artifact.count({ where: { projectId: wsId, type: "video" } });
    const emptyCompile = await compileFilm(
      jsonRequest(
        `http://localhost/api/workspaces/${wsId}/compile-film`,
        "POST",
        { clips: [] },
        token,
      ),
      params,
    );
    expect(emptyCompile.status).toBe(400);
    const compileJson = (await emptyCompile.json()) as {
      status?: string;
      url?: string | null;
      error?: string;
    };
    expect(compileJson.status).not.toBe("built");
    expect(compileJson.url).toBeNull();
    expect(compileJson.error).toMatch(/пустой таймлайн/i);
    const after = await db.artifact.count({ where: { projectId: wsId, type: "video" } });
    expect(after).toBe(before);
  });
});
